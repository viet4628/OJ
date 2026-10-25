// Real browser -> Auth/REST/RPC -> worker/engine. Only disposable fixtures.
import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import dotenv from '../apps/judge-worker/node_modules/dotenv/lib/main.js';
import { createClient } from '../apps/judge-worker/node_modules/@supabase/supabase-js/dist/index.mjs';

const env = dotenv.parse(fs.readFileSync(new URL('../.env', import.meta.url)));
const frontend = dotenv.parse(fs.readFileSync(new URL('../apps/web/.env.local', import.meta.url)));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const student = createClient(env.SUPABASE_URL, frontend.VITE_SUPABASE_ANON_KEY, options);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const suffix = randomBytes(6).toString('hex');
const email = `contest-workspace-${suffix}@example.invalid`, password = randomBytes(24).toString('base64url');
const web = process.env.STAGING_WEB_URL || 'http://127.0.0.1:3000';
let userId, problemId, contestId, browser;
try {
  userId = must(await db.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  must(await student.auth.signInWithPassword({ email, password }));
  problemId = must(await db.from('problems').insert({ slug: `workspace-${suffix}`, title: `Workspace ${suffix}`, description: 'Đọc số nguyên n và in n + 1.',
    is_public: false, samples: [{ input: '4', output: '5' }], starter_codes: { python: 'print(int(input()) + 1)' }, created_by: userId }).select('id').single()).id;
  must(await db.from('testcases').insert({ problem_id: problemId, input_path: 'inline', output_path: 'inline', input_content: '11', output_content: '12', score: 100, is_sample: false }));
  contestId = must(await db.from('contests').insert({ title: `Workspace ${suffix}`, description: 'Disposable contest workspace test', rule_type: 'ACM', is_public: true,
    start_time: new Date(Date.now() - 3600000).toISOString(), end_time: new Date(Date.now() + 3600000).toISOString() }).select('id').single()).id;
  must(await db.from('contest_problems').insert({ contest_id: contestId, problem_id: problemId, sort_order: 0, score: 100 }));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [], forbiddenRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/get_problem_editorial|get_problem_rank/.test(request.url())) forbiddenRequests.push(request.url()); });
  await page.goto(web + '/');
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  const login = page.getByRole('dialog');
  await login.locator('input[type=email]').fill(email);
  await login.locator('input[type=password]').fill(password);
  await login.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
  await login.waitFor({ state: 'hidden' });
  const url = `${web}/contests/${contestId}/problems/${problemId}`;
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Xem lời giải' })).toHaveCount(0);
  const language = page.locator('select').filter({ has: page.locator('option[value="python"]') });
  await language.selectOption('python');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('print');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect(page.getByText('KHỚP ĐÁP ÁN', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Tự tạo', exact: true }).click();
  await page.getByPlaceholder('Nhập input kiểm thử...').fill('7');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  const output = page.getByText('Đầu ra thực tế (Output):', { exact: true }).locator('../..').locator('pre');
  await expect(output).toHaveText('8', { timeout: 45000 });
  assert.deepEqual(must(await student.rpc('get_contest_rank', { p_contest_id: contestId })), [], 'trial polluted contest rank');
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await expect(page.getByText('Kết quả: ACCEPTED', { exact: true })).toBeVisible({ timeout: 45000 });
  const jobs = must(await student.from('submissions').select('is_run,contest_id').eq('problem_id', problemId));
  assert.equal(jobs.filter(job => job.is_run).length, 2);
  assert.equal(jobs.filter(job => !job.is_run && job.contest_id === contestId).length, 1);
  const rank = must(await student.rpc('get_contest_rank', { p_contest_id: contestId }));
  assert.equal(rank.length, 1); assert.equal(Number(rank[0].accepted_number), 1);
  await page.getByRole('button', { name: 'Lịch sử nộp' }).click();
  await expect(page.getByRole('button', { name: 'Nạp Code', exact: true })).toHaveCount(1);
  await mkdir(new URL('test-results/', import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL('test-results/staging-contest-workspace.png', import.meta.url).pathname });
  must(await db.from('contests').update({ end_time: new Date(Date.now() - 1000).toISOString() }).eq('id', contestId));
  await page.reload();
  await expect(page.getByText(/Kỳ thi đã kết thúc/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nộp bài', exact: true })).toBeDisabled();
  assert.deepEqual(errors, []); assert.deepEqual(forbiddenRequests, []);
  console.log('PASS staging contest workspace: private problem -> sample/custom runs (rank unchanged) -> AC contest submission -> own scoped history/rank -> ended contest disabled; no editorial/global rank requests.');
} finally {
  await browser?.close();
  if (contestId) must(await db.from('contests').delete().eq('id', contestId));
  if (problemId) must(await db.from('problems').delete().eq('id', problemId));
  if (userId) must(await db.auth.admin.deleteUser(userId));
  await student.auth.signOut();
  console.log('Disposable workspace contest/problem/account/submissions cleaned.');
}
