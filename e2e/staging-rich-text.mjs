// Real browser -> Auth/REST/RPC -> student reader; disposable fixtures only.
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
const teacher = createClient(env.SUPABASE_URL, frontend.VITE_SUPABASE_ANON_KEY, options);
const student = createClient(env.SUPABASE_URL, frontend.VITE_SUPABASE_ANON_KEY, options);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const suffix = randomBytes(6).toString('hex');
const email = `rich-text-${suffix}@example.invalid`, password = randomBytes(24).toString('base64url');
const web = process.env.STAGING_WEB_URL || 'http://127.0.0.1:3000';
let userId, problemId, browser;
try {
  userId = must(await db.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  must(await db.from('profiles').update({ role: 'teacher' }).eq('id', userId));
  must(await teacher.auth.signInWithPassword({ email, password }));
  const slug = `rich-text-${suffix}`;
  problemId = must(await teacher.rpc('save_problem_bundle', {
    p_problem_id: null,
    p_problem: { slug, title: `Rich text ${suffix}`, description: 'Nội dung ban đầu.', difficulty: 'Easy', time_limit_ms: 1000,
      memory_limit_mb: 256, is_public: true, tags: [], samples: [], starter_codes: {} },
    p_testcases: [{ input_content: 'PRIVATE_INPUT', output_content: 'PRIVATE_OUTPUT', score: 100, is_sample: false }], p_editorial: 'PRIVATE_EDITORIAL',
  }));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(web + '/');
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  const login = page.getByRole('dialog');
  await login.locator('input[type=email]').fill(email);
  await login.locator('input[type=password]').fill(password);
  await login.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
  await login.waitFor({ state: 'hidden' });
  const openEditor = async () => {
    await page.goto(web + '/teacher');
    await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
    await page.getByPlaceholder('Tìm theo tên bài, slug hoặc thẻ chủ đề...').fill(slug);
    await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  };
  await openEditor();
  const frame = page.getByRole('region', { name: 'Nội dung đề bài', exact: true });
  await expect(frame.getByRole('toolbar')).toHaveCount(1);
  await expect(frame.getByRole('textbox')).toHaveCount(4);
  const description = page.getByRole('textbox', { name: 'Mô tả đề bài', exact: true });
  const toolbar = page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true });
  await description.fill('Đề trực quan');
  await description.press('Control+a');
  await toolbar.getByRole('button', { name: 'In đậm', exact: true }).click();
  await description.press('ArrowRight');
  await description.press('End');
  await description.press('Enter');
  await toolbar.getByRole('button', { name: 'Công thức', exact: true }).click();
  const math = page.getByRole('dialog', { name: 'Công thức toán' });
  await math.getByRole('button', { name: 'Phân số', exact: true }).click();
  await math.getByRole('checkbox', { name: 'Hiển thị riêng một dòng' }).check();
  await math.getByRole('button', { name: 'Chèn công thức', exact: true }).click();
  await page.getByRole('textbox', { name: 'Dữ liệu vào', exact: true }).fill('Nhập hai số nguyên.');
  await page.getByRole('textbox', { name: 'Ràng buộc', exact: true }).fill('Giới hạn dữ liệu.');
  await mkdir(new URL('test-results/', import.meta.url), { recursive: true });
  await description.scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL('test-results/staging-rich-text-editor.png', import.meta.url).pathname });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible({ timeout: 20000 });
  await openEditor();
  await expect(description.locator('strong')).toContainText('Đề trực quan');
  await expect(description.locator('.katex .mfrac')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ràng buộc', exact: true })).toHaveText('Giới hạn dữ liệu.');
  const read = must(await student.from('problems').select('description,input_format').eq('id', problemId).single());
  assert(read.description.includes('**Đề trực quan**'));
  assert(read.description.includes('\\frac{a}{b}'));
  assert.equal(read.input_format, 'Nhập hai số nguyên.');
  assert.deepEqual(must(await student.from('testcases').select('input_content,output_content').eq('problem_id', problemId)), []);
  const editorial = await student.rpc('get_problem_editorial', { p_problem_id: problemId });
  assert.equal(editorial.data, null);
  if (editorial.error) assert.equal(editorial.error.code, '42501');
  const reader = await browser.newPage();
  await reader.goto(`${web}/problems/${slug}`);
  await expect(reader.locator('.markdown-content strong')).toContainText('Đề trực quan');
  await expect(reader.locator('.markdown-content .katex .mfrac')).toBeVisible();
  await expect(reader.getByText('Giới hạn dữ liệu.', { exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS staging rich text: teacher browser edit -> real save RPC -> reopen -> anonymous student reader; bold/block fraction/constraints retained, hidden testcases/editorial remain private.');
} finally {
  await browser?.close();
  if (problemId) must(await db.from('problems').delete().eq('id', problemId));
  if (userId) must(await db.auth.admin.deleteUser(userId));
  await teacher.auth.signOut();
  console.log('Disposable rich-text problem/account cleaned.');
}
