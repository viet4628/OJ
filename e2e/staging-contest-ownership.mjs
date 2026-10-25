// Real RLS/RPC and teacher UI, using only disposable fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import dotenv from '../apps/judge-worker/node_modules/dotenv/lib/main.js';
import { createClient } from '../apps/judge-worker/node_modules/@supabase/supabase-js/dist/index.mjs';

const env = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
const frontend = dotenv.parse(fs.readFileSync(new URL('../apps/web/.env.local', import.meta.url)));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
must(await db.rpc('can_manage_contest', { p_contest_id: randomUUID() }));
const suffix = randomBytes(6).toString('hex'), accounts = [], contests = [];
const web = process.env.STAGING_WEB_URL || 'http://127.0.0.1:3000';
let problemId, browser;
try {
  for (const [index, role] of ['teacher', 'teacher', 'admin'].entries()) {
    const email = `contest-owner-${index}-${suffix}@example.invalid`, password = randomBytes(24).toString('base64url');
    const { user } = must(await db.auth.admin.createUser({ email, password, email_confirm: true }));
    const account = { id: user.id, email, password };
    accounts.push(account);
    must(await db.from('profiles').update({ role }).eq('id', user.id));
    account.client = createClient(env.SUPABASE_URL, frontend.VITE_SUPABASE_ANON_KEY, options);
    must(await account.client.auth.signInWithPassword({ email, password }));
  }
  const [a, b, admin] = accounts;
  const base = { description: 'Disposable ownership fixture', rule_type: 'ACM', is_public: true,
    start_time: new Date(Date.now() - 3600000).toISOString(), end_time: new Date(Date.now() + 3600000).toISOString() };
  async function create(client, input) {
    const contest = must(await client.from('contests').insert(input).select('*').single());
    contests.push(contest.id); return contest;
  }
  const ca = await create(a.client, { ...base, title: `Owner A ${suffix}` });
  const cb = await create(b.client, { ...base, title: `Owner B ${suffix}`, freeze_at: new Date(Date.now() - 60000).toISOString() });
  const privateB = await create(b.client, { ...base, title: `Private B ${suffix}`, is_public: false });
  const legacy = await create(db, { ...base, title: `Legacy ${suffix}`, is_public: false, created_by: null });
  assert.equal(ca.created_by, a.id); assert.equal(cb.created_by, b.id);
  assert.equal(must(await a.client.rpc('can_manage_contest', { p_contest_id: cb.id })), false);
  assert.deepEqual(must(await a.client.from('contests').update({ title: 'tampered' }).eq('id', cb.id).select('id')), []);
  assert.deepEqual(must(await a.client.from('contests').delete().eq('id', cb.id).select('id')), []);
  assert.deepEqual(must(await a.client.from('contests').update({ created_by: a.id }).eq('id', cb.id).select('id')), []);
  assert((await a.client.from('contests').insert({ ...base, title: 'spoofed owner', created_by: b.id })).error);
  assert((await a.client.from('contests').update({ created_by: b.id }).eq('id', ca.id)).error);
  assert.deepEqual(must(await a.client.from('contests').select('id').in('id', [privateB.id, legacy.id])), []);
  must(await a.client.from('contests').update({ description: 'Owner update' }).eq('id', ca.id).select('id').single());
  problemId = must(await db.from('problems').insert({ slug: `ownership-${suffix}`, title: `Ownership ${suffix}`, description: 'Disposable shared problem', is_public: true, created_by: a.id }).select('id').single()).id;
  must(await b.client.from('contest_problems').insert({ contest_id: cb.id, problem_id: problemId, score: 100 }));
  assert.deepEqual(must(await a.client.from('contest_problems').update({ score: 1 }).eq('contest_id', cb.id).select('problem_id')), []);
  assert.deepEqual(must(await a.client.from('contest_problems').delete().eq('contest_id', cb.id).select('problem_id')), []);
  assert((await a.client.rpc('delete_problem', { p_problem_id: problemId })).error);
  assert((await a.client.from('problems').delete().eq('id', problemId)).error);
  must(await b.client.rpc('review_contest_registration', { p_contest_id: cb.id, p_user_id: a.id, p_approved: true }));
  assert((await a.client.rpc('review_contest_registration', { p_contest_id: cb.id, p_user_id: admin.id, p_approved: true })).error);
  assert.deepEqual(must(await a.client.from('contest_registrations').select('user_id').eq('contest_id', cb.id).neq('user_id', a.id)), []);
  const finished = must(await db.from('submissions').insert({ user_id: a.id, problem_id: problemId, contest_id: cb.id, code: 'int main(){}', language: 'cpp', status: 'ACCEPTED', score: 100 }).select('id').single());
  assert((await a.client.rpc('rejudge_submission', { p_submission_id: finished.id })).error);
  assert.deepEqual(must(await a.client.rpc('get_contest_rank', { p_contest_id: cb.id })), []);
  assert.equal(must(await b.client.rpc('get_contest_rank', { p_contest_id: cb.id })).length, 1);
  must(await admin.client.from('contests').update({ description: 'Admin override' }).eq('id', cb.id).select('id').single());
  must(await admin.client.from('contests').update({ created_by: a.id }).eq('id', legacy.id).select('id').single());
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(web + '/');
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  const login = page.getByRole('dialog');
  await login.locator('input[type=email]').fill(a.email); await login.locator('input[type=password]').fill(a.password);
  await login.getByRole('button', { name: 'Đăng Nhập', exact: true }).click(); await login.waitFor({ state: 'hidden' });
  await page.goto(web + '/teacher');
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: ca.title })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: cb.title })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: privateB.title })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: legacy.title })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS staging ownership: two teachers + admin; creator/default/transfer rules, own UI, foreign writes/selection/delete cascade/approval/rejudge blocked, rank freeze scoped, admin override allowed.');
} finally {
  await browser?.close();
  for (const id of contests) must(await db.from('contests').delete().eq('id', id));
  if (problemId) must(await db.from('problems').delete().eq('id', problemId));
  for (const account of accounts) { await account.client?.auth.signOut(); must(await db.auth.admin.deleteUser(account.id)); }
  console.log('Disposable ownership accounts/contests/problem/submission cleaned.');
}
