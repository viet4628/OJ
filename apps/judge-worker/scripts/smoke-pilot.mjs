#!/usr/bin/env node
// Disposable real PostgreSQL -> PostgREST -> worker -> sandbox/engine regression.
// Supabase Auth/Realtime/Storage integrations still require a staging run.
import { execFileSync, spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { checkPlatform } from './platform-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const name = `oj-pilot-${process.pid}`;
const secret = 'disposable-pilot-test-secret-at-least-32-characters';
const resources = [];
const children = [];
let logs = '';
const dir = await mkdtemp(path.join(tmpdir(), 'oj-pilot-'));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const token = (role, sub) => {
  const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, sub, exp: Math.floor(Date.now()/1000)+3600 })}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
};
const service = token('service_role');
async function port() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
function child(command, args, env = {}) {
  const proc = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', data => { logs = (logs + data).slice(-20000); });
  proc.stderr.on('data', data => { logs = (logs + data).slice(-20000); });
  proc.on('error', error => { logs += `Spawn failed: ${error.message}\n`; });
  children.push(proc);
  return proc;
}
async function stop(proc) {
  if (!proc.pid || proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise(resolve => proc.once('exit', resolve));
  proc.kill('SIGTERM');
  const timer = setTimeout(() => proc.kill('SIGKILL'), 15000);
  await exited;
  clearTimeout(timer);
}
async function until(check, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const result = await check(); if (result) return result; } catch { /* startup */ }
    await sleep(200);
  }
  throw new Error('Timed out waiting for service/result');
}
let base;
async function request(resource, jwt = service, method = 'GET', body) {
  const response = await fetch(`${base}/rest/v1/${resource}`, {
    method, headers: { Authorization: `Bearer ${jwt}`, apikey: jwt, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const data = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${data}`);
  return data ? JSON.parse(data) : null;
}
try {
  docker('network', 'create', name);
  resources.push(['network', 'rm', name]);
  docker('run', '-d', '--name', `${name}-db`, '--network', name, '--network-alias', 'db', '-e', 'POSTGRES_PASSWORD=local-test-only', 'postgres:15-alpine');
  resources.push(['rm', '-f', `${name}-db`]);
  await until(() => { docker('exec', `${name}-db`, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); return true; });
  for (const file of ['supabase/tests/bootstrap.sql', 'supabase/schema.sql']) {
    execFileSync('docker', ['exec', '-i', `${name}-db`, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: await readFile(path.join(root, file)), stdio: ['pipe', 'pipe', 'pipe'] });
  }
  execFileSync('docker', ['exec', '-i', `${name}-db`, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: `
    INSERT INTO auth.users(id,email) VALUES ('00000000-0000-0000-0000-000000000001','local@test.local'),('00000000-0000-0000-0000-000000000002','engine@test.local'),('00000000-0000-0000-0000-000000000003','teacher@test.local'),('00000000-0000-0000-0000-000000000004','admin@test.local');
    UPDATE profiles SET role='teacher' WHERE id='00000000-0000-0000-0000-000000000003';
    UPDATE profiles SET role='admin' WHERE id='00000000-0000-0000-0000-000000000004';
    INSERT INTO problems(id,slug,title,description,time_limit_ms) VALUES ('10000000-0000-0000-0000-000000000001','pilot-ab','A+B','Add two integers',400);
    INSERT INTO testcases(problem_id,input_path,output_path,input_content,output_content,score) VALUES
      ('10000000-0000-0000-0000-000000000001','inline','inline','3 4','7',20),
      ('10000000-0000-0000-0000-000000000001','inline','inline','-2 10','8',80);
    INSERT INTO classrooms(id,name,code,teacher_id) VALUES ('30000000-0000-0000-0000-000000000001','Pilot class','PILOT1','00000000-0000-0000-0000-000000000001');
    INSERT INTO contests(id,title,description,start_time,end_time) VALUES ('20000000-0000-0000-0000-000000000001','Pilot contest','test',now()-interval '1 hour',now()+interval '1 hour');
    INSERT INTO contest_problems(contest_id,problem_id) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
  `, stdio: ['pipe', 'pipe', 'pipe'] });
  const restPort = await port();
  docker('run', '-d', '--name', `${name}-rest`, '--network', name, '-p', `127.0.0.1:${restPort}:3000`,
    '-e', 'PGRST_DB_URI=postgres://postgres:local-test-only@db:5432/postgres', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_JWT_SECRET='+secret,
    'postgrest/postgrest:v12.2.3');
  resources.push(['rm', '-f', `${name}-rest`]);
  // The worker expects the Supabase /rest/v1 prefix. A local proxy adds only that
  // prefix; all DB authorization and RPC execution run through real PostgREST.
  const { createServer: httpServer } = await import('node:http');
  const proxy = httpServer(async (req, res) => {
    if (!req.url.startsWith('/rest/v1')) { res.writeHead(404).end(); return; }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const upstream = await fetch(`http://127.0.0.1:${restPort}${req.url.slice(8) || '/'}`, {
        method: req.method, headers: { ...req.headers, host: `127.0.0.1:${restPort}` },
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      res.writeHead(upstream.status, Object.fromEntries([...upstream.headers].filter(([key]) => !['content-encoding','transfer-encoding'].includes(key))));
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { res.writeHead(502).end(); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${proxy.address().port}`;
  try {
    await until(async () => (await fetch(`${base}/rest/v1/problems`)).ok);
    const problem = '10000000-0000-0000-0000-000000000001';
    await checkPlatform(request, token);
    for (const [index, mode] of (process.env.PLATFORM_ONLY ? [] : ['local', 'engine']).entries()) {
      const userId = `00000000-0000-0000-0000-00000000000${index+1}`;
      const student = token('authenticated', userId);
      const healthPort = await port();
      const providerPort = await port();
      let engine;
      let endpoint = '';
      if (mode === 'engine') {
        const grpcPort = await port();
        await writeFile(path.join(dir, 'services.toml'), `[grpc]\nlisten = ["127.0.0.1:${grpcPort}"]\n`);
        for (const config of ['executors.toml', 'seccomp.toml']) await writeFile(path.join(dir, config), await readFile(path.join(root, 'apps/judge-worker/engine-config', config)));
        engine = child(process.env.RSJUDGE_BINARY || path.join(root, 'engine/rsjudge/target/debug/rsjudge'), ['--config-dir', dir, '--cases-endpoint', `http://127.0.0.1:${providerPort}`]);
        endpoint = `127.0.0.1:${grpcPort}`;
      }
      const worker = child(process.execPath, ['apps/judge-worker/dist/worker.js'], {
        SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: service, RSJUDGE_ENDPOINT: endpoint,
        RSJUDGE_PROVIDER_BIND: `127.0.0.1:${providerPort}`, WORKER_HEALTH_BIND: '127.0.0.1',
        WORKER_HEALTH_PORT: String(healthPort), WORKER_POLL_INTERVAL_MS: '100', WORKER_ID: name,
      });
      await until(async () => (await fetch(`http://127.0.0.1:${healthPort}/health`)).ok);
      const create = async (code, language = 'cpp') => (await request('submissions', student, 'POST', { user_id: userId, problem_id: problem, code, language }))[0].id;
      const result = async (id, jwt = student) => until(async () => {
        const [row] = await request(`submissions?id=eq.${id}`, jwt);
        return ['PENDING', 'JUDGING'].includes(row.status) ? null : row;
      }, 90000);
      const ab = '#include <cstdio>\nint main(){long long a,b;scanf("%lld%lld",&a,&b);printf("%lld",a+b);}';
      const cases = [
        ['AC', ab, 'ACCEPTED', 100],
        ['weighted WA', '#include <cstdio>\nint main(){int a,b;scanf("%d%d",&a,&b);printf("%d",a<0?0:a+b);}', 'WRONG_ANSWER', 20],
        ['CE', 'not valid C++', 'COMPILE_ERROR', 0],
        ['TLE', 'int main(){for(;;){}}', 'TIME_LIMIT_EXCEEDED', 0],
        ['hidden stderr', '#include <cstdio>\nint main(){int c;while((c=getchar())!=EOF)fputc(c,stderr);return 1;}', 'RUNTIME_ERROR', 0],
      ];
      for (const [label, code, status, score] of cases) {
        const row = await result(await create(code));
        assert.equal(row.status, status, `${mode} ${label}: ${JSON.stringify(row)}`);
        assert.equal(row.score, score, `${mode} ${label} score`);
        assert(!JSON.stringify(row.details).includes('-2 10'), 'hidden input leaked');
        console.log(`PASS ${mode}: ${label} -> ${status} (${score})`);
      }
      const [run] = await request('rpc/judge_problem_code', student, 'POST', { p_problem_id: problem, p_language: 'cpp', p_code: ab, p_input: '20 22' });
      const runResult = await result(run.id);
      assert.equal(runResult.details[0].output, '42');
      assert.equal(runResult.score, 0);
      assert.equal(runResult.is_run, true);
      console.log(`PASS ${mode}: custom run -> 42, excluded from ranking`);
      const referenceTeacher = token('authenticated', '00000000-0000-0000-0000-000000000003');
      const referenceId = await request('rpc/validate_problem_solution', referenceTeacher, 'POST', { p_problem_id: problem, p_language: 'cpp', p_code: ab });
      const referenceResult = await result(referenceId, referenceTeacher);
      assert.equal(referenceResult.status, 'ACCEPTED', 'reference solution must execute the stored suite');
      assert.equal(referenceResult.score, 0, 'reference checks must not carry competitive credit');
      console.log(`PASS ${mode}: reference solution -> ACCEPTED, score0, excluded from history/ranks`);
      const [oversized] = await request('rpc/judge_problem_code', student, 'POST', { p_problem_id: problem, p_language: 'python', p_code: 'print("x" * (2 * 1024 * 1024))', p_input: '' });
      assert.equal((await result(oversized.id)).status, 'RUNTIME_ERROR', 'custom-run output cap must not produce AC');
      console.log(`PASS ${mode}: custom-run output cap -> RUNTIME_ERROR`);

      const [contest] = await request('rpc/create_contest_submission', student, 'POST', { p_contest_id: '20000000-0000-0000-0000-000000000001', p_problem_id: problem, p_language: 'cpp', p_code: ab });
      assert.equal((await result(contest.id)).status, 'ACCEPTED');
      const ranks = await request('rpc/get_contest_rank', student, 'POST', { p_contest_id: '20000000-0000-0000-0000-000000000001' });
      assert.equal(ranks.find(row => row.user_id === userId).accepted_number, 1);
      const publicRanks = await request('user_rank');
      assert.equal(Number(publicRanks.find(row => row.user_id === userId).accepted_number), 1, 'repeat AC must count one solved problem');
      if (mode === 'local') {
        const classes = await request('classrooms?select=*,teacher:profiles_public!classrooms_teacher_id_fkey(full_name,avatar_url)', student);
        assert(classes[0].teacher.full_name, 'Classroom FK hint to profile view');
      }
      const members = await request('submissions?select=id,profiles:profiles_public(full_name,email)', student);
      assert(members[0].profiles.full_name, 'PostgREST view relationship');
      assert.deepEqual(await request('testcases', student), []);
      const outsider = await request(`profiles_public?id=neq.${userId}`, student);
      assert(outsider.every(row => row.email === ''), 'public view exposed email');
      console.log(`PASS ${mode}: contest rank, unique solved count, view embedding and hidden testcase RLS`);
      await stop(worker);
      if (engine) await stop(engine);
      const [heartbeat] = await request(`judge_servers?id=eq.${name}`);
      assert.equal(heartbeat.ready, false, 'shutdown heartbeat');
      console.log(`PASS ${mode}: graceful shutdown`);
    }
  } finally { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
  console.log('Pilot integration smoke passed (isolated local DB, real REST/worker/engine).');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  for (const proc of children.reverse()) await stop(proc);
  for (const args of resources.reverse()) { try { docker(...args); } catch { /* cleanup */ } }
  await rm(dir, { recursive: true, force: true });
}
