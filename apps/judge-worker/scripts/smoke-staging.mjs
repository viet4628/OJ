#!/usr/bin/env node
// Creates disposable staging fixtures; cleans them even when assertions fail.
// Uses .env + apps/web/.env.local, never prints keys/passwords or real user data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const config = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
const frontend = dotenv.parse(fs.readFileSync(path.join(root, 'apps/web/.env.local')));
const url = config.SUPABASE_URL;
const anonKey = config.SUPABASE_ANON_KEY || frontend.VITE_SUPABASE_ANON_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, config.SUPABASE_SERVICE_ROLE_KEY, options);
const anon = createClient(url, anonKey, options);
const student = createClient(url, anonKey, options);
const cleanup = [];
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}`;
try {
  must(await admin.from('profiles_public').select('id').limit(1));
  must(await admin.from('submissions').select('judging_started_at').limit(1));
  const servers = must(await admin.from('judge_servers').select('*'));
  assert(servers.some(s => s.ready && Date.now() - new Date(s.last_seen_at).getTime() < 30000), 'No current worker heartbeat: deploy the new worker before staging smoke');
  const hidden = must(await anon.from('testcases').select('id').limit(1));
  assert.deepEqual(hidden, []);
  console.log('PASS staging schema, heartbeat, anonymous hidden-testcase RLS');
  const email = `pilot-${suffix}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const { user } = must(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Pilot smoke fixture', role: 'admin' } }));
  cleanup.push(async () => { const { error } = await admin.auth.admin.deleteUser(user.id); if (error) throw error; });
  must(await student.auth.signInWithPassword({ email, password }));
  const storagePath = `pilot-${suffix}/private-probe.in`;
  must(await admin.storage.from('testcases').upload(storagePath, Buffer.from('disposable private probe'), { contentType: 'text/plain' }));
  cleanup.push(async () => { const { error } = await admin.storage.from('testcases').remove([storagePath]); if (error) throw error; });
  assert((await anon.storage.from('testcases').download(storagePath)).error, 'Anonymous Storage download allowed');
  assert((await student.storage.from('testcases').download(storagePath)).error, 'Student Storage download allowed');
  const { data: publicObject } = anon.storage.from('testcases').getPublicUrl(storagePath);
  assert(!(await fetch(publicObject.publicUrl, { signal: AbortSignal.timeout(10000) })).ok, 'Private object available via public URL');
  console.log('PASS staging private Storage object denied to anon/student/public URL');

  const profile = must(await admin.from('profiles').select('role').eq('id', user.id).single());
  assert.equal(profile.role, 'user', 'Signup metadata must not grant admin');
  const escalation = await student.from('profiles').update({ role: 'admin' }).eq('id', user.id);
  assert(escalation.error, 'Self role escalation succeeded');
  const claim = await student.rpc('claim_submission', { p_submission_id: '00000000-0000-0000-0000-000000000000' });
  assert(claim.error, 'Student can execute worker claim RPC');
  const problem = must(await admin.from('problems').insert({ slug: `pilot-${suffix}`, title: 'Pilot smoke A+B', description: 'Disposable staging test', is_public: true, time_limit_ms: 1000 }).select('id').single());
  cleanup.push(async () => { const { error } = await admin.from('problems').delete().eq('id', problem.id); if (error) throw error; });
  must(await admin.from('testcases').insert([
    { problem_id: problem.id, input_path: 'inline', output_path: 'inline', input_content: '3 4', output_content: '7', score: 20 },
    { problem_id: problem.id, input_path: 'inline', output_path: 'inline', input_content: '-2 10', output_content: '8', score: 80 },
  ]));
  const forged = await student.from('submissions').insert({ user_id: user.id, problem_id: problem.id, language: 'cpp', code: 'int main(){}', status: 'ACCEPTED', score: 100 });
  assert(forged.error, 'Forged submission accepted');
  console.log('PASS staging signup role, self-escalation guard, worker RPC restriction, forged verdict guard');
  const result = async id => {
    const end = Date.now() + 90000;
    while (Date.now() < end) {
      const row = must(await student.from('submissions').select('*').eq('id', id).single());
      if (!['PENDING', 'JUDGING'].includes(row.status)) return row;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Staging submission did not finish in 90s');
  };
  const ab = '#include <cstdio>\nint main(){long long a,b;scanf("%lld%lld",&a,&b);printf("%lld",a+b);}';
  for (const [name, code, expected, score] of [
    ['AC', ab, 'ACCEPTED', 100],
    ['weighted WA', '#include <cstdio>\nint main(){int a,b;scanf("%d%d",&a,&b);printf("%d",a<0?0:a+b);}', 'WRONG_ANSWER', 20],
    ['CE', 'not valid C++', 'COMPILE_ERROR', 0],
    ['TLE', 'int main(){for(;;){}}', 'TIME_LIMIT_EXCEEDED', 0],
  ]) {
    const { id } = must(await student.from('submissions').insert({ user_id: user.id, problem_id: problem.id, code, language: 'cpp' }).select('id').single());
    const row = await result(id);
    assert.equal(row.status, expected, name);
    assert.equal(row.score, score, name + ' score');
    console.log(`PASS staging ${name}: ${expected}, score=${score}`);
  }
  const [run] = must(await student.rpc('judge_problem_code', { p_problem_id: problem.id, p_language: 'cpp', p_code: ab, p_input: '20 22' }));
  const runResult = await result(run.id);
  assert.equal(runResult.details[0].output, '42');
  assert.equal(runResult.is_run, true);
  assert.equal(runResult.score, 0);
  console.log('PASS staging custom run and is_run');
  let receiveInsert;
  const inserted = new Promise(resolve => { receiveInsert = resolve; });
  const channel = student.channel(`pilot-${suffix}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions', filter: `user_id=eq.${user.id}` }, payload => receiveInsert(payload.new.id));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Realtime subscribe timeout')), 15000);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        if (status === 'CHANNEL_ERROR') { clearTimeout(timer); reject(new Error('Realtime subscription failed')); }
      });
    });
    const [realtimeRun] = must(await student.rpc('judge_problem_code', { p_problem_id: problem.id, p_language: 'cpp', p_code: ab, p_input: '1 2' }));
    let timeout;
    try {
      const eventId = await Promise.race([inserted, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Realtime INSERT delivery timeout')), 15000); })]);
      assert.equal(eventId, realtimeRun.id);
    } finally { clearTimeout(timeout); }
    await result(realtimeRun.id);
    console.log('PASS staging authenticated Realtime subscription and INSERT delivery');
  } finally { await student.removeChannel(channel); }
  must(await admin.from('profiles').update({ role: 'teacher' }).eq('id', user.id));
  const validationId = must(await student.rpc('validate_problem_solution', { p_problem_id: problem.id, p_language: 'cpp', p_code: ab }));
  const validationResult = await result(validationId);
  assert.equal(validationResult.status, 'ACCEPTED');
  assert.equal(validationResult.is_validation, true);
  assert.equal(validationResult.score, 0);
  console.log('PASS staging reference check: full hidden suite ACCEPTED, score=0');
  must(await admin.from('profiles').update({ role: 'user' }).eq('id', user.id));
  if (process.env.STAGING_WEB_URL) {
    const { chromium } = await import(pathToFileURL(path.join(root, 'e2e/node_modules/playwright/index.mjs')).href);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const web = process.env.STAGING_WEB_URL;
      await page.goto(web + '/');
      await page.getByRole('button', { name: /đăng nhập/i }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input[type=email]').fill(email);
      await dialog.locator('input[type=password]').fill(password);
      await dialog.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 30000 });
      await page.goto(web + '/admin');
      await page.waitForURL(web + '/', { timeout: 30000 });
      console.log('PASS staging browser login and student blocked from admin');
      must(await admin.from('profiles').update({ role: 'teacher' }).eq('id', user.id));
      await page.goto(web + '/teacher');
      await page.getByRole('heading', { name: 'Trung Tâm Giảng Dạy & Lớp Học' }).waitFor();
      await page.goto(web + '/admin');
      await page.waitForURL(web + '/', { timeout: 30000 });
      console.log('PASS staging browser teacher workspace and admin restriction');
      must(await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id));
      await page.goto(web + '/admin');
      await page.getByRole('heading', { name: 'Tổng quan', exact: true }).waitFor();
      await page.getByText(/Đang hoạt động/).first().waitFor();
      assert.deepEqual(errors, [], 'Browser exceptions');
      console.log('PASS staging browser admin console and actual heartbeat');
    } finally { await browser.close(); }
  }
  console.log('Staging smoke passed. Email delivery/reset and soak still require pilot acceptance.');
} finally {
  let cleanupFailed = false;
  for (const fn of cleanup.reverse()) { try { await fn(); } catch (error) { console.error('Fixture cleanup failed:', error.message); cleanupFailed = true; } }
  await student.auth.signOut();
  if (cleanupFailed) process.exitCode = 1;
}
