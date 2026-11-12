import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { readWorkerConfig } from '../dist/config.js';
import { MAX_PENDING, SubmissionQueue } from '../dist/submissions/submission-queue.js';
import { SubmissionService } from '../dist/submissions/submission-service.js';
import { WorkerApp } from '../dist/worker-app.js';

const submission = (id, extra = {}) => ({ id, problem_id: 'problem', status: 'PENDING', language: 'cpp', code: 'code', details: [], ...extra });
const accepted = { status: 'ACCEPTED', timeMs: 10, memoryMb: 1, score: 100, errorLog: null, details: [] };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('queue serializes jobs and deduplicates realtime/poll delivery', async () => {
  const gate = deferred();
  const seen = [];
  const queue = new SubmissionQueue(async row => {
    seen.push(row.id);
    assert.equal(queue.activeIds.size, 1);
    if (row.id === 'a') await gate.promise;
  });
  const drained = queue.enqueue(submission('a'));
  queue.enqueue(submission('a'));
  queue.enqueue(submission('b'));
  queue.enqueue(submission('b'));
  queue.enqueue(submission('ignored', { status: 'ACCEPTED' }));
  assert.deepEqual(seen, ['a']);
  assert.equal(queue.queuedCount, 1);
  gate.resolve();
  await drained;
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(queue.activeIds.size, 0);
});

test('queue stop drops pending work, rejects new work and drains the active job', async () => {
  const gate = deferred();
  const seen = [];
  const queue = new SubmissionQueue(async row => { seen.push(row.id); await gate.promise; });
  queue.enqueue(submission('a'));
  queue.enqueue(submission('b'));
  queue.stop();
  await queue.enqueue(submission('c'));
  assert.equal(queue.queuedCount, 0);
  assert(queue.activeIds.has('a'));
  gate.resolve();
  await queue.waitForIdle();
  assert.deepEqual(seen, ['a']);
});

test('queue instances have isolated state and failures reach the caller', async () => {
  const failed = new SubmissionQueue(async () => { throw new Error('cannot persist'); });
  const seen = [];
  const healthy = new SubmissionQueue(async row => { seen.push(row.id); });
  await assert.rejects(failed.enqueue(submission('a')), /cannot persist/);
  assert.equal(failed.activeIds.size, 0);
  failed.stop();
  await healthy.enqueue(submission('a'));
  assert.deepEqual(seen, ['a']);
});

test('queue runs up to the configured number of jobs concurrently', async () => {
  const gates = new Map();
  let active = 0, peak = 0;
  const queue = new SubmissionQueue(async row => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => gates.set(row.id, resolve));
    active--;
  }, 2);
  const drained = queue.enqueue(submission('a'));
  queue.enqueue(submission('b'));
  queue.enqueue(submission('c'));
  await delay(10);
  assert.equal(peak, 2, 'only the configured number of jobs may run at once');
  assert.equal(queue.activeIds.size, 2);
  gates.get('a')();
  gates.get('b')();
  while (!gates.has('c')) await delay(5);
  assert.equal(peak, 2, 'a freed slot must be reused');
  gates.get('c')();
  await drained;
  assert.equal(queue.activeIds.size, 0);
});

test('queue keeps at most MAX_PENDING jobs in memory; overflow waits in the DB', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const seen = [];
  const queue = new SubmissionQueue(async row => { seen.push(row.id); await blocked; });
  const drained = queue.enqueue(submission('running'));
  for (let i = 0; i < MAX_PENDING + 5; i++) queue.enqueue(submission(`job-${i}`));
  assert.equal(queue.queuedCount, MAX_PENDING);
  release();
  await drained;
  assert.equal(seen.length, MAX_PENDING + 1, 'held jobs still run in order');
  assert.deepEqual(seen.slice(0, 3), ['running', 'job-0', 'job-1']);
  queue.enqueue(submission('job-24'));
  await queue.waitForIdle();
  assert.equal(seen.at(-1), 'job-24', 'a dropped job is accepted again by the next poll');
});

function serviceFixture() {
  const calls = [];
  const repository = {
    claim: async () => { calls.push('claim'); return true; },
    getProblem: async () => { calls.push('problem'); return { id: 'problem' }; },
    getTestcases: async () => { calls.push('testcases'); return [{ id: 'tc' }]; },
    saveResult: async (id, result) => { calls.push(['save', id, result]); },
  };
  const backend = {
    mode: 'local',
    judge: async () => { calls.push('judge'); return accepted; },
    run: async (_row, _problem, input) => { calls.push(['run', input]); return { ...accepted, score: 0 }; },
  };
  return { calls, repository, backend, service: new SubmissionService(repository, backend) };
}

test('service claims before reading or judging; a lost claim does no work', async () => {
  const fixture = serviceFixture();
  await fixture.service.process(submission('a'));
  assert.deepEqual(fixture.calls, ['claim', 'problem', 'testcases', 'judge', ['save', 'a', accepted]]);
  fixture.calls.length = 0;
  fixture.repository.claim = async () => false;
  await fixture.service.process(submission('b'));
  assert.deepEqual(fixture.calls, []);
});

test('custom runs accept empty input, bypass hidden cases and preserve zero score', async () => {
  const { calls, service } = serviceFixture();
  await service.process(submission('a', { is_run: true, details: { custom_input: '' } }));
  assert.deepEqual(calls.slice(0, 3), ['claim', 'problem', ['run', '']]);
  assert.equal(calls.at(-1)[2].score, 0);
  assert(!calls.includes('testcases'));
});

test('custom_input cannot switch a regular submission into an unranked run', async () => {
  const { calls, service } = serviceFixture();
  await service.process(submission('a', { is_run: false, details: { custom_input: 'input' } }));
  assert(calls.includes('judge'));
  assert.equal(calls.at(-1)[2].score, 100);
});

test('backend errors become SYSTEM_ERROR; claim and persistence errors remain fatal', async () => {
  const { calls, repository, backend, service } = serviceFixture();
  backend.judge = async () => { throw new Error('engine unavailable'); };
  await service.process(submission('a'));
  assert.equal(calls.at(-1)[2].status, 'SYSTEM_ERROR');
  assert.equal(calls.at(-1)[2].errorLog, 'engine unavailable');
  repository.saveResult = async () => { throw new Error('cannot persist'); };
  await assert.rejects(service.process(submission('b')), /cannot persist/);
  repository.claim = async () => { throw new Error('claim failed'); };
  await assert.rejects(service.process(submission('c')), /claim failed/);
});

test('worker config validates numeric limits without reading global env', () => {
  const env = { SUPABASE_URL: 'http://127.0.0.1', SUPABASE_SERVICE_ROLE_KEY: 'test-key' };
  assert.equal(readWorkerConfig(env).pollIntervalMs, 2000);
  assert.equal(readWorkerConfig(env).concurrency, 1);
  assert.equal(readWorkerConfig({ ...env, WORKER_CONCURRENCY: '2' }).concurrency, 2);
  assert.throws(() => readWorkerConfig({ ...env, WORKER_CONCURRENCY: '0' }), /Invalid/);
  assert.throws(() => readWorkerConfig({ ...env, WORKER_CONCURRENCY: '9' }), /Invalid/);
  assert.throws(() => readWorkerConfig({ ...env, WORKER_HEALTH_PORT: '70000' }), /Invalid/);
  assert.throws(() => readWorkerConfig({ ...env, WORKER_POLL_INTERVAL_MS: '0' }), /Invalid/);
  assert.throws(() => readWorkerConfig({}), /required/);
});

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function until(check) {
  for (let i = 0; i < 150; i++) {
    try { if (await check()) return; } catch { /* service starting */ }
    await delay(20);
  }
  throw new Error('Timed out waiting for worker');
}

test('WorkerApp owns lifecycle: health, subscription, active drain, offline heartbeat and cleanup', async () => {
  const rest = createServer((_req, res) => res.writeHead(200).end('{}'));
  const restPort = await listen(rest);
  const reservation = createServer();
  const healthPort = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const gate = deferred();
  const processing = deferred();
  const events = [];
  const fixture = serviceFixture();
  fixture.backend.initialize = async () => { events.push('initialize'); };
  fixture.backend.isReady = () => true;
  fixture.backend.close = async () => { events.push('close'); };
  fixture.backend.judge = async () => { processing.resolve(); await gate.promise; return accepted; };
  let incoming;
  const repository = {
    ...fixture.repository,
    getPending: async () => [],
    recoverStale: async active => { assert.equal(active.size, 0); },
    heartbeat: async (_id, _mode, ready) => { events.push(['heartbeat', ready]); },
    subscribe: (callback, onStatus) => { incoming = callback; onStatus('SUBSCRIBED'); return 'channel'; },
    unsubscribe: async channel => { assert.equal(channel, 'channel'); events.push('unsubscribe'); },
  };
  const app = new WorkerApp(readWorkerConfig({ SUPABASE_URL: `http://127.0.0.1:${restPort}`,
    SUPABASE_SERVICE_ROLE_KEY: 'test-key', WORKER_HEALTH_PORT: String(healthPort), WORKER_POLL_INTERVAL_MS: '100' }), repository, fixture.backend);
  const run = app.start();
  try {
    const url = `http://127.0.0.1:${healthPort}/health`;
    await until(async () => (await fetch(url)).ok);
    incoming(submission('active'));
    await processing.promise;
    incoming(submission('pending'));
    const response = await fetch(url);
    const health = await response.json();
    assert.equal(health.processing, 1);
    assert.equal(health.queued, 1);
    assert.equal(health.realtime, 'SUBSCRIBED');
    app.stop();
    assert.equal((await fetch(url)).status, 503);
    assert(!events.includes('close'), 'must not close backend before the active job completes');
    gate.resolve();
    await run;
    assert.deepEqual(fixture.calls.filter(call => Array.isArray(call) && call[0] === 'save').map(call => call[1]), ['active']);
    assert.deepEqual(events.slice(-3), [['heartbeat', false], 'unsubscribe', 'close']);
    await assert.rejects(app.start(), /only be started once/);
  } finally {
    app.stop();
    gate.resolve();
    await run;
    await new Promise(resolve => rest.close(resolve));
  }
});

test('startup failure releases initialized backend even if offline heartbeat also fails', async () => {
  const rest = createServer((_req, res) => res.writeHead(200).end('{}'));
  const port = await listen(rest);
  const events = [];
  const backend = {
    mode: 'engine', initialize: async () => events.push('initialize'),
    close: async () => events.push('close'), isReady: () => false,
  };
  const repository = { heartbeat: async () => { throw new Error('DB offline'); } };
  const app = new WorkerApp(readWorkerConfig({ SUPABASE_URL: `http://127.0.0.1:${port}`,
    SUPABASE_SERVICE_ROLE_KEY: 'test-key', WORKER_HEALTH_PORT: String(port) }), repository, backend);
  try {
    await assert.rejects(app.start(), /EADDRINUSE/);
    assert.deepEqual(events, ['initialize', 'close']);
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200, 'must not close another server using the occupied port');
  } finally {
    await new Promise(resolve => rest.close(resolve));
  }
});

test('engine provider reuses the job metadata, bounds Storage loads and preserves testcase order', async () => {
  const { EngineJudge } = await import('../dist/judging/engine-judge.js');
  let active = 0, peak = 0, snapshot;
  const backend = new EngineJudge({
    getProblem: async () => { throw new Error('metadata fetched twice'); },
    getTestcases: async () => { throw new Error('metadata fetched twice'); },
    resolveTestcaseContent: async tc => {
      peak = Math.max(peak, ++active);
      await delay(tc.id === 'tc-0' ? 10 : 1);
      active--;
      return { inputContent: tc.id, outputContent: `out-${tc.id}` };
    },
  }, 'unused', '127.0.0.1:0');
  backend.client = { submit: async function* (options) {
    snapshot = await backend.provider.registry.get(options.problemIntId)();
    yield { kind: 'compile_info', exitStatus: 0 };
    for (let i = 0; i < 5; i++) yield { kind: 'case_info', info: { case_id: i + 1, result: 'ACCEPTED', time_ms: 1, memory_kib: 1024 } };
    yield { kind: 'summary', summary: { result: 'ACCEPTED' } };
  } };
  const testcases = Array.from({ length: 5 }, (_, i) => ({ id: `tc-${i}`, score: i + 1 }));
  const result = await backend.judge(submission('snapshot'), { id: 'problem', time_limit_ms: 1234, memory_limit_mb: 128 }, testcases);
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.score, 100);
  assert.equal(peak, 5, 'testcase reads must overlap instead of running in pairs');
  assert.deepEqual(snapshot.cases.map(tc => tc.input), testcases.map(tc => tc.id));
  assert.equal(snapshot.timeLimitMs, 1234);
  assert.equal(snapshot.memoryLimitMb, 128);
  assert.equal(backend.provider.registry.size, 0, 'finished jobs must release provider callbacks');
});
