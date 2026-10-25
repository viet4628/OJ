#!/usr/bin/env node
// Dedicated staging only; uses the existing single worker and removes its own fixtures.
import { parseArgs } from 'node:util';
import { readFile, writeFile, statfs, appendFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const { values } = parseArgs({ options: {
  users: { type: 'string', default: '5' }, jobs: { type: 'string', default: '20' },
  duration: { type: 'string', default: '0' }, output: { type: 'string', default: 'load-report.json' },
  health: { type: 'string', default: 'http://127.0.0.1:9090/health' },
  languages: { type: 'string', default: 'cpp' }, cases: { type: 'string', default: '1' },
  storage: { type: 'boolean', default: false }, 'input-bytes': { type: 'string', default: '5' },
  'tle-every': { type: 'string', default: '0' }, 'job-timeout': { type: 'string', default: '1200' },
} });
const users = Number(values.users), jobs = Number(values.jobs), duration = Number(values.duration);
const cases = Number(values.cases), inputBytes = Number(values['input-bytes']);
const tleEvery = Number(values['tle-every']), jobTimeout = Number(values['job-timeout']);
const languages = values.languages.split(',');
if (!Number.isInteger(users) || users < 1 || users > 30 || !Number.isInteger(jobs) || jobs < 1 || jobs > 10000
  || !Number.isFinite(duration) || duration < 0 || !Number.isInteger(cases) || cases < 1 || cases > 100
  || !Number.isInteger(inputBytes) || inputBytes < 5 || inputBytes > 1024 * 1024
  || !Number.isInteger(tleEvery) || tleEvery < 0 || !Number.isFinite(jobTimeout) || jobTimeout < 1 || jobTimeout > 3600
  || languages.some(language => !['cpp', 'python', 'rust'].includes(language))) {
  console.error('Invalid load options: users 1..30, jobs 1..10000, cases 1..100, input-bytes 5..1048576, languages cpp,python,rust.');
  process.exit(1);
}
const config = dotenv.parse(await readFile(new URL('../../../.env', import.meta.url)));
const web = dotenv.parse(await readFile(new URL('../../web/.env.local', import.meta.url)));
if (config.SUPABASE_URL.replace(/\/$/, '') !== web.VITE_SUPABASE_URL.replace(/\/$/, '')) throw new Error('Worker and web must use the same staging.');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: {
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(30000), ...(init?.signal ? [init.signal] : [])]) }),
} };
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, options);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const accounts = [], clients = [], results = [], health = [], resources = [], paths = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = promisify(execFile);
const code = {
  cpp: '#include <cstdio>\nint main(){long long a,b;scanf("%lld%lld",&a,&b);printf("%lld",a+b);}',
  python: 'a,b=map(int,input().split());print(a+b)',
  rust: 'use std::io::{self,Read};fn main(){let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();let mut v=s.split_whitespace().map(|x|x.parse::<i64>().unwrap());println!("{}",v.next().unwrap()+v.next().unwrap());}',
};
const tleCode = { cpp: 'int main(){for(;;){}}', python: 'while True: pass', rust: 'fn main(){loop{std::hint::spin_loop();}}' };
let problem, cleanupFailed = false, stopped = false, stopReason = null, started = 0, finished = 0, timer, sampling;
let nextJob = 0, growthSince = 0, previousPending = 0;
let workerStartedAt, loadStartedAt;
const stop = reason => { stopped = true; stopReason ||= reason; };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
async function sample() {
  const snapshot = { at: new Date().toISOString(), ok: false };
  try {
    const response = await fetch(values.health, { signal: AbortSignal.timeout(5000) });
    const h = await response.json();
    Object.assign(snapshot, { ok: response.ok && h.ready === true, ...h });
    if (workerStartedAt && h.startedAt && h.startedAt !== workerStartedAt) stop('worker restarted');
    workerStartedAt = h.startedAt;
  } catch { snapshot.error = 'Health unavailable'; }
  health.push(snapshot);
  if (started && !snapshot.ok) stop('health');
  try {
    const [{ stdout }, pending, judging, disk] = await Promise.all([
      run('docker', ['stats', '--no-stream', '--format', '{{json .}}', 'online-judge-worker-1', 'online-judge-engine-1'], { timeout: 10000 }),
      admin.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      admin.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'JUDGING'),
      statfs(new URL('../../../', import.meta.url)),
    ]);
    if (pending.error || judging.error) throw new Error('Queue measurement failed');
    const containers = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const diskAvailableBytes = disk.bavail * disk.bsize;
    resources.push({ at: new Date().toISOString(), pending: pending.count, judging: judging.count, containers, diskAvailableBytes });
    if (containers.some(row => parseFloat(row.MemPerc) > 80)) stop('memory >80%');
    if (diskAvailableBytes < 2 * 1024 ** 3) stop('disk available <2GiB');
    if (started && pending.count > previousPending) growthSince ||= Date.now();
    else if (pending.count < previousPending || pending.count === 0) growthSince = 0;
    if (growthSince && Date.now() - growthSince >= 120000) stop('queue growth >=120s');
    previousPending = pending.count;
  } catch { resources.push({ at: new Date().toISOString(), error: 'Resource/queue measurement unavailable' }); }
  await writeFile(`${values.output}.progress.tmp`, JSON.stringify({ at: new Date().toISOString(), loadStartedAt,
    completed: results.length, failures: results.filter(row => !row.ok).length, stopped, stopReason,
    lastHealth: snapshot, lastResource: resources.at(-1) }), { mode: 0o600 });
  await rename(`${values.output}.progress.tmp`, `${values.output}.progress.json`);
}
try {
  await sample();
  if (!health[0].ok) throw new Error('Worker is not ready; load refused.');
  problem = must(await admin.from('problems').insert({ slug: 'load-' + suffix, title: 'Load fixture A+B',
    description: 'Disposable load fixture', is_public: true, time_limit_ms: 1000 }).select('id').single());
  const input = '20 22' + ' '.repeat(inputBytes - 5);
  const testcases = [];
  for (let i = 0; i < cases; i++) {
    const inputPath = `load-${suffix}/${i}.in`, outputPath = `load-${suffix}/${i}.out`;
    if (values.storage) {
      for (const [objectPath, content] of [[inputPath, input], [outputPath, '42']]) {
        must(await admin.storage.from('testcases').upload(objectPath, Buffer.from(content)));
        paths.push(objectPath);
      }
    }
    testcases.push({ problem_id: problem.id, input_path: values.storage ? inputPath : 'inline',
      output_path: values.storage ? outputPath : 'inline', input_content: values.storage ? null : input,
      output_content: values.storage ? null : '42', score: 1 });
  }
  must(await admin.from('testcases').insert(testcases));
  for (let i = 0; i < users; i++) {
    const email = `load-${suffix}-${i}@example.invalid`, password = randomBytes(24).toString('base64url');
    const { user } = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    accounts.push(user.id);
    const client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY || web.VITE_SUPABASE_ANON_KEY, options);
    clients.push(client);
    must(await client.auth.signInWithPassword({ email, password }));
  }
  started = performance.now(); loadStartedAt = new Date().toISOString();
  timer = setInterval(() => { if (!sampling) sampling = sample().catch(() => stop('measurement failed')).finally(() => { sampling = null; }); }, 5000);
  await Promise.all(clients.map(async (client, index) => {
    const starts = [];
    while (!stopped) {
      while (starts.length && performance.now() - starts[0] >= 61000) starts.shift();
      if (starts.length >= 9) { await sleep(Math.min(1000, 61000 - (performance.now() - starts[0]))); continue; }
      if (stopped || (duration ? performance.now() - started >= duration * 1000 : nextJob >= jobs)) break;
      const job = nextJob++;
      const language = languages[job % languages.length], expected = tleEvery && (job + 1) % tleEvery === 0 ? 'TIME_LIMIT_EXCEEDED' : 'ACCEPTED';
      const sent = performance.now(); starts.push(sent);
    const entry = { user: index, language, expected, ok: false };
      try {
        const { id } = must(await client.from('submissions').insert({ user_id: accounts[index], problem_id: problem.id,
          language, code: expected === 'ACCEPTED' ? code[language] : tleCode[language] }).select('id').single());
        for (;;) {
          const row = must(await client.from('submissions').select('status,score,created_at,judging_started_at').eq('id', id).single());
          if (!['PENDING', 'JUDGING'].includes(row.status)) {
            Object.assign(entry, { ok: row.status === expected && row.score === (expected === 'ACCEPTED' ? 100 : 0),
              status: row.status, finishMs: Math.round(performance.now() - sent),
              queueMs: row.judging_started_at ? Math.max(0, new Date(row.judging_started_at) - new Date(row.created_at)) : null });
            if (row.status === 'SYSTEM_ERROR') stop('SYSTEM_ERROR');
            break;
          }
          if (performance.now() - sent > jobTimeout * 1000) throw new Error('Judging timeout');
          await sleep(250);
        }
      } catch (error) { entry.error = error.message; stop('request/job failed'); }
      results.push(entry);
      await appendFile(`${values.output}.results.jsonl`, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 });
    }
  }));
  finished = performance.now();
} catch (error) { console.error(error.message); stopReason ||= 'setup failed'; process.exitCode = 1; }
finally {
  finished ||= started ? performance.now() : 0;
  clearInterval(timer);
  await sampling;
  // Do not delete a fixture or account while the judge may still be executing it.
  let canClean = true;
  if (problem) {
    const active = await admin.from('submissions').select('id', { count: 'exact', head: true }).eq('problem_id', problem.id).in('status', ['PENDING', 'JUDGING']);
    canClean = !active.error && active.count === 0;
  }
  for (const client of clients) await client.auth.signOut().catch(() => {});
  if (canClean) {
    if (paths.length) { const { error } = await admin.storage.from('testcases').remove(paths); if (error) cleanupFailed = true; }
    if (problem) { const { error } = await admin.from('problems').delete().eq('id', problem.id); if (error) cleanupFailed = true; }
    for (const id of accounts) { const { error } = await admin.auth.admin.deleteUser(id); if (error) cleanupFailed = true; }
  } else cleanupFailed = true;
  const elapsedSeconds = started ? (finished - started) / 1000 : 0;
  const percentile = (key, p, entries = results) => {
    const rows = entries.filter(row => Number.isFinite(row[key])).map(row => row[key]).sort((a, b) => a - b);
    return rows.length ? rows[Math.ceil(rows.length * p) - 1] : null;
  };
  const groups = [...new Set(results.map(row => `${row.language}:${row.expected}`))].map(key => {
    const entries = results.filter(row => `${row.language}:${row.expected}` === key);
    return { key, count: entries.length, failures: entries.filter(row => !row.ok).length,
      p50FinishMs: percentile('finishMs', .5, entries), p95FinishMs: percentile('finishMs', .95, entries), p99FinishMs: percentile('finishMs', .99, entries) };
  });
  const report = { at: new Date().toISOString(), loadStartedAt, users, completed: results.length, failures: results.filter(row => !row.ok).length,
    elapsedSeconds, p50QueueMs: percentile('queueMs', .5), p95QueueMs: percentile('queueMs', .95), p99QueueMs: percentile('queueMs', .99),
    p50FinishMs: percentile('finishMs', .5), p95FinishMs: percentile('finishMs', .95), p99FinishMs: percentile('finishMs', .99),
    throughputPerSecond: elapsedSeconds ? results.length / elapsedSeconds : 0, healthFailures: health.filter(row => !row.ok).length,
    cleanupFailed, stopped, stopReason, fixtureId: cleanupFailed ? problem?.id : undefined, groups,
    workload: { languages, cases, storage: values.storage, inputBytes, tleEvery, duration, jobTimeout, model: 'closed-loop; one outstanding job per user' },
    runtime: { node: process.version, platform: process.platform, arch: process.arch,
      cpu: cpus()[0]?.model, cpuCount: cpus().length, hostMemoryBytes: totalmem() }, results, health, resources };
  await writeFile(values.output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...report, results: undefined, health: undefined, resources: undefined }));
  if (cleanupFailed || stopped || !results.length || report.failures || report.healthFailures) process.exitCode = 1;
}
