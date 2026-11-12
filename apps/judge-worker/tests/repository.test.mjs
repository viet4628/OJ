import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { JudgeRepository } from '../dist/data/judge-repository.js';
import { WorkerApp } from '../dist/worker-app.js';
import { readWorkerConfig } from '../dist/config.js';
import { setTimeout as delay } from 'node:timers/promises';

test('DB requests abort when stalled and the next poll can recover', async () => {
  let stalled = true;
  const server = createServer((_req, res) => {
    if (!stalled) res.writeHead(200, { 'Content-Type': 'application/json' }).end('[]');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const db = createClient(`http://127.0.0.1:${server.address().port}`, 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repo = new JudgeRepository(db, 50);
  let timer;
  try {
    await Promise.race([
      assert.rejects(repo.getPending(), /timeout|abort/i),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('poll stayed blocked')), 1000); }),
    ]);
    stalled = false;
    assert.deepEqual(await repo.getPending(), []);
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('claim and maintenance abort stalled requests; an unconfirmed result is never blindly retried', async () => {
  const requests = [];
  const server = createServer(req => { requests.push(req.url); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const db = createClient(`http://127.0.0.1:${server.address().port}`, 'test-key', { auth: { persistSession: false } });
  const repo = new JudgeRepository(db, 50);
  try {
    await assert.rejects(repo.claim('job'), /Claim failed.*timeout|Claim failed.*abort/i);
    await assert.rejects(repo.saveResult('job', { status: 'ACCEPTED', details: [] }), /persist.*timeout|persist.*abort/i);
    await assert.rejects(repo.recoverStale(new Set()), /recover.*timeout|recover.*abort/i);
    await assert.rejects(repo.heartbeat('test', 'engine', false, 0, 0), /Heartbeat failed.*timeout|Heartbeat failed.*abort/i);
    assert.equal(requests.length, 5, 'a failed result write is followed by a read-back, not a second write');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

for (const scenario of ['committed', 'judging', 'rejudged']) {
  test(`result write timeout reconciles ${scenario} without overwriting a new state`, async () => {
    let writes = 0;
    const payload = { status: 'ACCEPTED', time_used_ms: 10, memory_used_mb: 1, score: 100, error_log: null, details: [] };
    const server = createServer((req, res) => {
      if (req.method === 'PATCH') {
        writes++;
        assert.equal(new URL(req.url, 'http://fixture').searchParams.get('status'), 'eq.JUDGING');
        if (writes === 1) return;
        return res.writeHead(200, { 'Content-Type': 'application/json' }).end('[{"id":"job"}]');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(scenario === 'committed' ? payload
        : { ...payload, status: scenario === 'judging' ? 'JUDGING' : 'PENDING', score: 0 }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const repo = new JudgeRepository(createClient(`http://127.0.0.1:${server.address().port}`, 'test-key', { auth: { persistSession: false } }), 50);
    try {
      const save = repo.saveResult('job', { status: 'ACCEPTED', timeMs: 10, memoryMb: 1, score: 100, errorLog: null, details: [] });
      if (scenario === 'rejudged') await assert.rejects(save, /Failed to persist/);
      else await save;
      assert.equal(writes, scenario === 'judging' ? 2 : 1);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}

test('a transient read failure is retried once instead of failing the submission', async () => {
  let calls = 0;
  const server = createServer((req, res) => {
    calls++;
    if (calls === 1) return req.socket.destroy();
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([{ id: 'tc' }]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const repo = new JudgeRepository(createClient(`http://127.0.0.1:${server.address().port}`, 'test-key',
    { auth: { persistSession: false } }), 2000);
  try {
    const rows = await repo.getTestcases('problem');
    assert.equal(rows.length, 1);
    assert.equal(calls, 2, 'the read must be retried once');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Storage reads stay within the global download cap', async () => {
  let active = 0, peak = 0;
  const server = createServer((_req, res) => {
    active++; peak = Math.max(peak, active);
    setTimeout(() => { active--; res.writeHead(200, { 'Content-Type': 'text/plain' }).end('payload'); }, 20);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const repo = new JudgeRepository(createClient(`http://127.0.0.1:${server.address().port}`, 'test-key',
    { auth: { persistSession: false } }), 5000);
  const testcases = Array.from({ length: 20 }, (_, i) => ({ id: `tc-${i}`, problem_id: 'p',
    input_path: `${i}.in`, output_path: `${i}.out`, input_content: null, output_content: null, score: 1 }));
  try {
    const contents = await Promise.all(testcases.map(tc => repo.resolveTestcaseContent(tc)));
    assert.equal(contents.length, 20);
    assert.equal(contents.filter(c => c.contentError).length, 0);
    assert(peak <= 8, `too many parallel Storage reads: ${peak}`);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('worker health detects stale polls and recovers after the real DB request times out', async () => {
  let stalled = false;
  const server = createServer((req, res) => {
    if (stalled && req.method === 'GET' && req.url.includes('/submissions')) return;
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('[]');
  });
  const reservation = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const healthPort = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const db = createClient(base, 'test-key', { auth: { persistSession: false } });
  const repository = new JudgeRepository(db, 50);
  repository.subscribe = (_callback, status) => { status('SUBSCRIBED'); return 'test-channel'; };
  repository.unsubscribe = async () => {};
  const app = new WorkerApp(readWorkerConfig({ SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    WORKER_HEALTH_PORT: String(healthPort), WORKER_POLL_INTERVAL_MS: '100' }), repository,
    { mode: 'engine', initialize: async () => {}, isReady: () => true, close: async () => {} });
  const run = app.start();
  const url = `http://127.0.0.1:${healthPort}/health`;
  const until = async check => {
    for (let i = 0; i < 150; i++) { try { if (await check()) return; } catch {} await delay(20); }
    throw new Error('worker did not recover');
  };
  const realNow = Date.now;
  try {
    await until(async () => (await fetch(url)).ok);
    stalled = true;
    await until(async () => (await (await fetch(url)).json()).lastPollError !== null);
    Date.now = () => realNow() + 20000;
    assert.equal((await fetch(url)).status, 503);
    stalled = false;
    await until(async () => (await fetch(url)).ok);
    const health = await (await fetch(url)).json();
    assert.equal(health.lastPollError, null);
    assert(health.lastPollDurationMs >= 0);
  } finally {
    app.stop();
    await run;
    Date.now = realNow;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
