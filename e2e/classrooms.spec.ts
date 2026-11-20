import { test, expect } from '@playwright/test';
import { problem, problemPage } from './fixtures';

const teacherId = '00000000-0000-0000-0000-000000000002';
const user = { id: teacherId, email: 'teacher@test.local', role: 'authenticated', aud: 'authenticated', user_metadata: { full_name: 'Teacher' } };
const jwt = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: teacherId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;

async function teacherWorkspace(page: import('@playwright/test').Page, options: { conflict?: boolean; autoConflict?: boolean; listError?: boolean; pending?: Promise<void>; assigned?: boolean; registration?: boolean; tiedRanks?: boolean; admin?: boolean; blocked?: boolean; validated?: boolean } = {}) {
  const state = { posts: [] as Record<string, string>[], classroom: null as any, assignments: [] as any[], savedProblem: { ...problem, created_by: teacherId } as Record<string, any>, editorial: 'Lời giải đã lưu', starterCodes: {} as Record<string, string>, registration: 'PENDING', suspended: false };
  if (options.assigned) {
    state.classroom = { id: '20000000-0000-0000-0000-000000000001', name: 'Lớp có bài', code: 'LOP11A', teacher_id: teacherId, is_archived: false, teacher: { full_name: 'Teacher' } };
    state.assignments = [{ classroom_id: state.classroom.id, problem_id: problem.id, problem, deadline: null }];
  }
  await page.route('**/auth/v1/**', async route => {
    const token = route.request().url().includes('/token');
    await route.fulfill({ json: token ? { access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user } : user });
  });
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    const object = request.headers().accept?.includes('vnd.pgrst.object');
    let rows: any[] = [];
    if (table === 'profiles') rows = [{ id: teacherId, full_name: 'Teacher', role: 'teacher', is_suspended: options.blocked || false }];
    if (table === 'profiles' && options.admin) rows = [{ id: teacherId, email: 'admin@test.local', full_name: 'Admin', role: 'admin' },
      { id: '00000000-0000-0000-0000-000000000009', full_name: 'Học sinh thử', email: 'student@test.local', role: 'user', is_suspended: state.suspended, created_at: '2026-01-01T00:00:00Z' }];
    if (table === 'set_account_suspension') { state.suspended = request.postDataJSON().p_suspended; await route.fulfill({ json: { revoked_sessions: 1 } }); return; }
    if (table === 'admin_audit_log') rows = [{ id: 1, actor_id: teacherId, target_id: 'student', action: 'account.suspend', payload: { reason: 'Spam' }, created_at: '2026-01-01T00:00:00Z' }];
    if (table === 'user_permissions') rows = [{ codes: ['problems.manage', 'testcases.manage', 'contests.manage', 'submissions.view_all'] }];
    if (table === 'get_problem_page') { await route.fulfill({ json: problemPage([{ ...state.savedProblem, progress: options.assigned ? 'SOLVED' : 'TODO' }], request.postDataJSON()) }); return; }
    if (table === 'problems') rows = [{ ...state.savedProblem, starter_codes: state.starterCodes }];
    if (table === 'testcases') rows = [{ id: 'tc-1', problem_id: problem.id, input_content: '123', output_content: '6', score: 100, is_sample: false }];
    if (table === 'contests') rows = [{ id: '40000000-0000-0000-0000-000000000001', created_by: teacherId, title: 'Thi có duyệt', description: 'Thi thử', rule_type: 'ACM', registration_required: true, is_public: true, start_time: new Date(Date.now() - 3600000).toISOString(), end_time: new Date(Date.now() + 3600000).toISOString() }];
    if (table === 'register_contest') { await route.fulfill({ json: 'PENDING' }); return; }
    if (table === 'contest_registrations' && options.registration) rows = [{ user_id: teacherId, status: state.registration, profile: { full_name: 'Teacher' } }];
    if (table === 'review_contest_registration') { state.registration = request.postDataJSON().p_approved ? 'APPROVED' : 'REJECTED'; await route.fulfill({ json: null }); return; }
    if (table === 'can_manage_contest') { await route.fulfill({ json: true }); return; }
    if (table === 'rejudge_submission') { await route.fulfill({ json: null }); return; }
    if (table === 'get_contest_rank' && options.tiedRanks) rows = [
      { user_id: 'late', username: 'AC cuối muộn', accepted_number: 2, submission_number: 2, total_time_seconds: 600, total_score: 0,
        problem_info: { a: { is_ac: true, time_seconds: 100 }, b: { is_ac: true, time_seconds: 500 } } },
      { user_id: 'early', username: 'AC cuối sớm', accepted_number: 2, submission_number: 2, total_time_seconds: 600, total_score: 0,
        problem_info: { a: { is_ac: true, time_seconds: 250 }, b: { is_ac: true, time_seconds: 350 } } },
    ];
    if (table === 'get_problem_editorial') {
      await route.fulfill({ json: state.editorial });
      return;
    }
    if (table === 'validate_problem_solution') { await route.fulfill({ json: 'reference-job' }); return; }
    if (table === 'problem_validations') { await route.fulfill({ json: options.validated ? { submission_id: 'reference-job' } : null }); return; }
    if (table === 'submissions' && url.searchParams.get('id') === 'eq.reference-job') rows = [{ id: 'reference-job', status: options.validated ? 'ACCEPTED' : 'PENDING', is_run: true, is_validation: true, language: 'cpp', code: 'int main(){}' }];
    if (table === 'save_problem_bundle') {
      state.editorial = request.postDataJSON().p_editorial;
      state.savedProblem = { ...state.savedProblem, ...request.postDataJSON().p_problem };
      state.starterCodes = request.postDataJSON().p_problem.starter_codes || {};
      await route.fulfill({ json: problem.id });
      return;
    }
    if (table === 'classroom_members' && options.assigned) rows = [{ classroom_id: state.classroom.id, user_id: teacherId, role: 'student', profile: { id: teacherId, full_name: 'Teacher' } }];
    if (options.assigned && (table === 'submissions' || table === 'get_classroom_progress')) {
      rows = [{ id: 'practice-ac', user_id: teacherId, problem_id: problem.id, status: 'ACCEPTED', score: 100, time_used_ms: 1, created_at: '2026-01-01T00:00:00Z' }];
      if (table === 'get_classroom_progress') rows = [{ ...rows[0], status: 'WRONG_ANSWER', score: 20 }];
    }
    if (table === 'submissions' && request.method() === 'POST') {
      await route.fulfill({ json: { id: 'submission-in-class' } });
      return;
    }
    if (table === 'classrooms') {
      if (request.method() === 'POST') {
        const input = request.postDataJSON();
        state.posts.push(input);
        if ((options.conflict || options.autoConflict) && state.posts.length === 1) {
          await route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } });
          return;
        }
        if (options.pending) await options.pending;
        state.classroom = { ...input, id: '20000000-0000-0000-0000-000000000001', is_archived: false, created_at: new Date().toISOString(), teacher: { full_name: 'Teacher' } };
      } else if (options.listError) {
        await route.fulfill({ status: 500, json: { code: 'XX000', message: 'Không tải được lớp học' } });
        return;
      }
      if (state.classroom) rows = [state.classroom];
    }
    if (table === 'classroom_problems') {
      if (request.method() === 'POST') state.assignments.push({ ...request.postDataJSON(), problem });
      rows = state.assignments;
    }
    await route.fulfill({ json: object ? rows[0] : rows, headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /đăng nhập/i }).first().click();
  const login = page.getByRole('dialog');
  await login.locator('input[type=email]').fill(user.email);
  await login.locator('input[type=password]').fill('test-password');
  await login.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
  await login.waitFor({ state: 'hidden' });
  if (options.blocked) return state;
  await page.goto('/teacher');
  await page.getByRole('heading', { name: 'Quản Lý Lớp Học', exact: true }).waitFor();
  return state;
}

async function openCreate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Tạo Lớp Học Mới', exact: true }).click();
  return page.getByRole('dialog', { name: 'Tạo lớp học mới', exact: true });
}

test('Bài đã giải giữ biểu tượng trạng thái ở trang chủ và kho bài', async ({ page }) => {
  await teacherWorkspace(page, { assigned: true });
  for (const path of ['/', '/problems']) {
    await page.goto(path);
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: problem.title, exact: true }) });
    await expect(row.getByRole('img', { name: 'Đã giải', exact: true })).toBeVisible();
  }
});

test('Giáo viên lưu code khởi đầu công khai riêng với lời giải chuẩn', async ({ page }) => {
  const state = await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: problem.title, exact: true }).click();
  await page.getByRole('button', { name: 'Code khởi đầu', exact: true }).click();
  await page.getByLabel('Code khởi đầu C++').fill('// starter_public\nint main() {}');
  await page.screenshot({ path: 'test-results/starter-studio.png', fullPage: true });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  expect(state.starterCodes.cpp).toBe('// starter_public\nint main() {}');
  expect(state.editorial).toBe('Lời giải đã lưu');
  await page.goto(`/problems/${problem.slug}`);
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('starter_public');
  await expect(page.locator('.monaco-editor .view-lines')).not.toContainText('Lời giải đã lưu');
});

test('Soạn đề chung một khung với một toolbar, phân sẵn bốn phần và lưu riêng đúng nội dung', async ({ page }) => {
  const state = await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  const frame = page.getByRole('region', { name: 'Nội dung đề bài', exact: true });
  await expect(frame.getByRole('toolbar')).toHaveCount(1);
  for (const name of ['Mô tả đề bài', 'Dữ liệu vào', 'Dữ liệu ra', 'Ràng buộc']) {
    await expect(frame.getByRole('heading', { name, exact: true })).toBeVisible();
    const field = frame.getByRole('textbox', { name, exact: true });
    await field.fill(`Nội dung ${name}`);
    await field.press('Control+a');
    await frame.getByRole('toolbar').getByRole('button', { name: 'In đậm', exact: true }).click();
    await expect(field.locator('strong')).toHaveText(`Nội dung ${name}`);
    await expect(frame.getByRole('toolbar')).toHaveCount(1);
  }
  await page.screenshot({ path: 'test-results/statement-group-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  expect(state.savedProblem.input_format).toBe('**Nội dung Dữ liệu vào**');
  expect(state.savedProblem.output_format).toBe('**Nội dung Dữ liệu ra**');
  expect(state.savedProblem.description).toContain('**Nội dung Ràng buộc**');
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  for (const name of ['Mô tả đề bài', 'Dữ liệu vào', 'Dữ liệu ra', 'Ràng buộc']) {
    await expect(frame.getByRole('textbox', { name, exact: true }).locator('strong')).toHaveText(`Nội dung ${name}`);
  }
});

test('Soạn mô tả trực quan: chọn chữ in đậm, lưu và mở lại giữ định dạng', async ({ page }) => {
  const state = await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Mô tả đề bài', exact: true });
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  await editor.fill('Nội dung trực quan');
  await editor.press('Control+a');
  await page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true }).getByRole('button', { name: 'In đậm', exact: true }).click();
  await expect(editor.locator('strong')).toHaveText('Nội dung trực quan');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  expect(state.savedProblem.description).toContain('**Nội dung trực quan**');
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await expect(editor.locator('strong')).toHaveText('Nội dung trực quan');
});

test('Chỉ số trên và dưới định dạng chữ được chọn, lưu mở lại và đọc đề giữ nguyên', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Mô tả đề bài', exact: true });
  const toolbar = page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true });
  await editor.fill('');
  await editor.pressSequentially('x2 a1');
  await editor.locator('p').evaluate(element => {
    const text = element.firstChild!;
    window.getSelection()!.setBaseAndExtent(text, 1, text, 2);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await toolbar.getByRole('button', { name: 'Chỉ số trên', exact: true }).click();
  await expect(editor.locator('sup')).toHaveText('2');
  await editor.locator('p').evaluate(element => {
    const text = element.lastChild!;
    const end = text.textContent!.length;
    window.getSelection()!.setBaseAndExtent(text, end - 1, text, end);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await toolbar.getByRole('button', { name: 'Chỉ số dưới', exact: true }).click();
  await expect(editor.locator('sub')).toHaveText('1');
  await toolbar.getByRole('button', { name: 'Chỉ số trên', exact: true }).click();
  await expect(editor.locator('sub')).toHaveCount(0);
  await toolbar.getByRole('button', { name: 'Chỉ số dưới', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await expect(editor.locator('sup')).toHaveText('2');
  await expect(editor.locator('sub')).toHaveText('1');
  await page.goto(`/problems/${problem.slug}`);
  await expect(page.locator('.markdown-content sup')).toHaveText('2');
  await expect(page.locator('.markdown-content sub')).toHaveText('1');
});

test('Soạn công thức bằng thanh công cụ, sửa và lưu mở lại', async ({ page }) => {
  const state = await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Mô tả đề bài', exact: true });
  await editor.fill('Giới hạn: ');
  await editor.press('End');
  await page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true }).getByRole('button', { name: 'Công thức', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Công thức toán' });
  await dialog.getByRole('button', { name: 'Số mũ', exact: true }).click();
  await expect(dialog.locator('.katex')).toBeVisible();
  await dialog.getByRole('button', { name: 'Chèn công thức', exact: true }).click();
  await expect(editor.locator('.tiptap-mathematics-render')).toHaveCount(1);
  await editor.locator('.tiptap-mathematics-render').click();
  await dialog.getByLabel('Biểu thức toán', { exact: true }).fill('a_{i}');
  await dialog.getByRole('button', { name: 'Cập nhật công thức', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  expect(state.savedProblem.description).toContain('$a_{i}$');
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await expect(editor.locator('.tiptap-mathematics-render')).toHaveCount(1);
});

test('Đề cũ có danh sách, bảng và phân số được giữ khi sửa rồi hiển thị cho học sinh', async ({ page }) => {
  const state = await teacherWorkspace(page);
  state.savedProblem.description = String.raw`Hai bước:

1. Đọc **dữ liệu**
2. Tính kết quả

| Biến | Ý nghĩa |
| --- | --- |
| n | Độ dài |

Phân số $\frac{a}{b}$ và căn $\sqrt{n}$.`;
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Mô tả đề bài', exact: true });
  await expect(editor.locator('ol > li')).toHaveCount(2);
  await expect(editor.getByRole('cell', { name: 'Độ dài', exact: true })).toBeVisible();
  await editor.press('Control+End');
  await editor.press('Enter');
  await editor.pressSequentially('Ghi chú mới.');
  const input = page.getByRole('textbox', { name: 'Dữ liệu vào', exact: true });
  await input.fill('Nhập số nguyên.');
  await input.press('Control+a');
  await page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true }).getByRole('button', { name: 'In đậm', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  await page.goto(`/problems/${problem.slug}`);
  await expect(page.locator('ol > li')).toHaveCount(2);
  await expect(page.getByRole('cell', { name: 'Độ dài', exact: true })).toBeVisible();
  await expect(page.locator('.katex .mfrac')).toBeVisible();
  await expect(page.locator('.katex .sqrt')).toBeVisible();
  await expect(page.locator('strong').filter({ hasText: 'Nhập số nguyên.' })).toBeVisible();
});

test('Toolbar chèn bảng, thêm hàng, hoàn tác và lưu giữ dữ liệu trên điện thoại', async ({ page }) => {
  await teacherWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Mô tả đề bài', exact: true });
  const toolbar = page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true });
  await editor.fill('Bảng dữ liệu');
  await editor.press('End');
  await editor.press('Enter');
  await toolbar.getByRole('button', { name: 'Chèn bảng', exact: true }).click();
  await expect(editor.getByRole('row')).toHaveCount(3);
  await editor.getByRole('columnheader').first().click();
  await page.keyboard.type('Gia tri');
  await toolbar.getByRole('button', { name: 'Thêm hàng', exact: true }).click();
  await expect(editor.getByRole('row')).toHaveCount(4);
  await toolbar.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(editor.getByRole('row')).toHaveCount(3);
  await toolbar.getByRole('button', { name: 'Làm lại', exact: true }).click();
  await expect(editor.getByRole('row')).toHaveCount(4);
  await page.getByRole('textbox', { name: 'Ràng buộc', exact: true }).fill('Giới hạn dữ liệu.');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText(/Đã lưu cập nhật bài tập/)).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await expect(editor.getByRole('row')).toHaveCount(4);
  await expect(editor.getByRole('columnheader').first()).toHaveText('Gia tri');
  await expect(page.getByRole('textbox', { name: 'Ràng buộc', exact: true })).toHaveText('Giới hạn dữ liệu.');
  await toolbar.scrollIntoViewIfNeeded();
  const bounds = await toolbar.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/rich-text-mobile.png', fullPage: true });
});

test('Xem trước đề hiển thị định dạng dữ liệu vào và ràng buộc', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  for (const name of ['Dữ liệu vào', 'Ràng buộc']) {
    const field = page.getByRole('textbox', { name, exact: true });
    await field.fill(`Nội dung ${name}`);
    await field.press('Control+a');
    await page.getByRole('toolbar', { name: 'Định dạng đề bài', exact: true }).getByRole('button', { name: 'In đậm', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Xem trước đề', exact: true }).click();
  const preview = page.getByText('Preview Mode (Student view)', { exact: true }).locator('../../..');
  await expect(preview.locator('strong')).toHaveText(['Nội dung Dữ liệu vào', 'Nội dung Ràng buộc']);
});

test('Giáo viên chỉ quản lý contest do mình tạo, kể cả khi API trả contest công khai của người khác', async ({ page }) => {
  await teacherWorkspace(page);
  const base = { description: '', rule_type: 'ACM', registration_required: true, is_public: true, start_time: '2030-01-01T09:00:00Z', end_time: '2030-01-01T10:00:00Z' };
  let ownerFilter = '';
  await page.route('**/rest/v1/contests?**', route => {
    ownerFilter = new URL(route.request().url()).searchParams.get('created_by') || '';
    return route.fulfill({ json: [
      { ...base, id: 'my-contest', title: 'Contest của tôi', created_by: teacherId },
      { ...base, id: 'their-contest', title: 'Contest của giáo viên khác', created_by: 'other-teacher' },
      { ...base, id: 'legacy-contest', title: 'Contest cũ chưa có chủ', created_by: null },
    ] });
  });
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Contest của tôi' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Contest của giáo viên khác' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Contest cũ chưa có chủ' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true })).toHaveCount(1);
  expect(ownerFilter).toBe(`eq.${teacherId}`);
});

test('Giáo viên chỉ quản lý đề do mình tạo, kể cả khi API trả đề công khai của người khác', async ({ page }) => {
  await teacherWorkspace(page);
  let ownerFilter = '';
  await page.route('**/rest/v1/problems?**', route => {
    ownerFilter = new URL(route.request().url()).searchParams.get('created_by') || '';
    return route.fulfill({ json: [
      { ...problem, id: 'my-problem', slug: 'my-problem', title: 'Đề của tôi', created_by: teacherId },
      { ...problem, id: 'their-problem', slug: 'their-problem', title: 'Đề của giáo viên khác', created_by: 'other-teacher' },
      { ...problem, id: 'legacy-problem', slug: 'legacy-problem', title: 'Đề cũ chưa có chủ', created_by: null },
    ] });
  });
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đề của tôi', exact: true })).toBeVisible();
  await expect(page.getByText('Đề của giáo viên khác')).toHaveCount(0);
  await expect(page.getByText('Đề cũ chưa có chủ')).toHaveCount(0);
  expect(ownerFilter).toBe(`eq.${teacherId}`);
});

test('Admin quản lý được đề người khác và đề cũ chưa có chủ', async ({ page }) => {
  await teacherWorkspace(page, { admin: true });
  let ownerFilter: string | null = null;
  await page.route('**/rest/v1/problems?**', route => {
    ownerFilter = new URL(route.request().url()).searchParams.get('created_by');
    return route.fulfill({ json: [
      { ...problem, id: 'their-problem', slug: 'their-problem', title: 'Đề của giáo viên khác', created_by: 'other-teacher' },
      { ...problem, id: 'legacy-problem', slug: 'legacy-problem', title: 'Đề cũ chưa có chủ', created_by: null },
    ] });
  });
  await page.goto('/admin/problems');
  await expect(page.getByRole('button', { name: 'Đề của giáo viên khác', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đề cũ chưa có chủ', exact: true })).toBeVisible();
  expect(ownerFilter).toBeNull();
});

test('Admin quản lý được contest người khác và contest cũ chưa có chủ', async ({ page }) => {
  await teacherWorkspace(page, { admin: true });
  const base = { description: '', rule_type: 'ACM', is_public: false, start_time: '2030-01-01T09:00:00Z', end_time: '2030-01-01T10:00:00Z' };
  await page.route('**/rest/v1/contests?**', route => route.fulfill({ json: [
    { ...base, id: 'their-contest', title: 'Contest của giáo viên khác', created_by: 'other-teacher' },
    { ...base, id: 'legacy-contest', title: 'Contest cũ chưa có chủ', created_by: null },
  ] }));
  await page.goto('/admin/contests');
  await expect(page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true })).toHaveCount(2);
});

test('Không hiện chấm lại bài nộp trong contest giáo viên khác quản lý', async ({ page }) => {
  await teacherWorkspace(page);
  const submission = { id: 'foreign-contest-submission', user_id: teacherId, contest_id: 'foreign-contest', problem_id: problem.id,
    language: 'cpp', code: 'int main(){}', status: 'ACCEPTED', time_used_ms: 1, memory_used_mb: 1, score: 100, details: [],
    created_at: '2026-01-01T00:00:00Z', problems: { title: problem.title, slug: problem.slug } };
  await page.route('**/rest/v1/submissions?**', route => route.fulfill({
    json: new URL(route.request().url()).searchParams.has('id') ? submission : [submission], headers: { 'content-range': '0-0/1' },
  }));
  await page.route('**/rest/v1/rpc/can_manage_contest', route => route.fulfill({ json: false }));
  await page.goto('/submissions');
  await page.getByRole('button', { name: 'Xem mã nguồn & thông số' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết bài nộp' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Chấm lại', exact: true })).toHaveCount(0);
});

test('Workspace contest có chạy mẫu/tự nhập và nộp đúng kỳ thi, không có lời giải', async ({ page }) => {
  await teacherWorkspace(page);
  const contestId = '40000000-0000-0000-0000-000000000001';
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.route('**/rest/v1/contests?**', route => route.fulfill({ json: { id: contestId, title: 'Thi thử workspace', rule_type: 'ACM',
    start_time: new Date(now - 60000).toISOString(), end_time: new Date(now + 60000).toISOString() } }));
  await page.route('**/rest/v1/contest_problems?**', route => route.fulfill({ json: [{ contest_id: contestId, problem_id: problem.id, problems: problem, sort_order: 0, score: 100 }] }));
  const requests: any[] = [];
  await page.route('**/rest/v1/rpc/judge_problem_code', route => {
    requests.push({ run: route.request().postDataJSON() });
    return route.fulfill({ json: [{ id: 'trial-job' }] });
  });
  await page.route('**/rest/v1/rpc/create_contest_submission', route => {
    requests.push({ submit: route.request().postDataJSON() });
    return route.fulfill({ json: [{ id: 'contest-job' }] });
  });
  await page.route('**/rest/v1/submissions?**', route => {
    const id = new URL(route.request().url()).searchParams.get('id');
    return route.fulfill({ json: id ? {
      id: id.slice(3), problem_id: problem.id, user_id: teacherId, contest_id: id === 'eq.contest-job' ? contestId : null,
      status: 'ACCEPTED', is_run: id === 'eq.trial-job', language: 'cpp', code: '// own contest code', created_at: new Date().toISOString(),
      details: [{ status: 'ACCEPTED', output: '15', time_ms: 1, memory_mb: 1 }], time_used_ms: 1, memory_used_mb: 1, score: 100,
    } : [] });
  });
  const unexpected: string[] = [];
  page.on('request', request => {
    if (/get_problem_editorial|get_problem_rank/.test(request.url())) unexpected.push(request.url());
    if (request.url().includes('/submissions') && request.method() === 'POST') unexpected.push('practice submit');
  });
  await page.goto(`/contests/${contestId}/problems/${problem.id}`);
  await expect(page.getByRole('button', { name: 'Xem lời giải' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Lời giải', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].run).toMatchObject({ p_problem_id: problem.id, p_input: '12345', p_language: 'cpp' });
  await expect(page.getByRole('button', { name: 'Chạy thử', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tự tạo', exact: true }).click();
  await page.getByPlaceholder('Nhập input kiểm thử...').fill('999');
  await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].run.p_input).toBe('999');
  await expect(page.getByRole('button', { name: 'Nộp bài', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].submit).toMatchObject({ p_contest_id: contestId, p_problem_id: problem.id, p_language: 'cpp' });
  await page.getByRole('button', { name: 'Lịch sử nộp' }).click();
  await expect(page.getByRole('button', { name: 'Nạp Code', exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Xếp hạng' })).toHaveAttribute('href', `/contests/${contestId}?tab=rank`);
  expect(unexpected).toEqual([]);
  await page.screenshot({ path: 'test-results/contest-workspace.png' });
  await page.clock.fastForward(120000);
  await expect(page.getByText(/Kỳ thi đã kết thúc/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nộp bài', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Chạy thử', exact: true })).toBeEnabled();
  await page.keyboard.press('Control+Shift+Enter');
  expect(requests).toHaveLength(3);
});

test('Tạo lớp -> mã mời -> giao bài đầu tiên; chặn hạn nộp đã qua', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = await teacherWorkspace(page);
  const dialog = await openCreate(page);
  await expect(dialog.getByLabel('Tên lớp học')).toBeFocused();
  await dialog.getByLabel('Tên lớp học').fill('  Tin học 11A  ');
  await dialog.getByLabel('Mô tả lớp').fill('  Luyện thuật toán  ');
  await dialog.getByLabel('Mã mời', { exact: false }).fill('tin11a');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tin học 11A', exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0]).toMatchObject({ name: 'Tin học 11A', description: 'Luyện thuật toán', code: 'TIN11A', teacher_id: teacherId });
  await expect(page.getByText(/Mời học sinh vào mục Lớp học/)).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Sao chép mã lớp', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đã sao chép mã lớp', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('TIN11A');
  await page.getByRole('button', { name: 'Giao bài tập ngay', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Giao Bài Tập Cho Lớp Học' });
  await picker.getByRole('button', { name: /Tổng chữ số/ }).click();
  await picker.getByLabel('Hạn chót nộp bài').fill('2000-01-01T10:00');
  await picker.getByRole('button', { name: 'Xác Nhận Thêm' }).click();
  await expect(picker.getByRole('alert')).toHaveText(/Hạn nộp cần nằm trong tương lai/);
  expect(state.assignments).toHaveLength(0);
  await picker.getByLabel('Hạn chót nộp bài').fill('');
  await picker.getByRole('button', { name: 'Xác Nhận Thêm' }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('cell', { name: /Tổng chữ số/ })).toBeVisible();
  expect(state.assignments).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('Mở bài từ lớp và nộp bài giữ đúng ngữ cảnh lớp', async ({ page }) => {
  const state = await teacherWorkspace(page, { assigned: true });
  await page.goto(`/classes/${state.classroom.id}`);
  const solve = page.getByRole('link', { name: 'Làm bài', exact: true });
  await expect(solve).toHaveAttribute('href', `/problems/${problem.slug}?classroom=${state.classroom.id}`);
  await solve.click();
  await expect(page.getByRole('link', { name: 'Về lớp học' })).toHaveAttribute('href', `/classes/${state.classroom.id}`);
  const submitted = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/submissions'));
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({ problem_id: problem.id, classroom_id: state.classroom.id });
});

test('Điểm lớp không lấy AC từ luyện tập ngoài lớp', async ({ page }) => {
  const state = await teacherWorkspace(page, { assigned: true });
  await page.goto(`/classes/${state.classroom.id}`);
  await expect(page.getByText('20đ (Chưa AC)', { exact: true })).toBeVisible();
});

test('Giáo viên tải bảng điểm CSV đúng điểm của lớp', async ({ page }) => {
  await teacherWorkspace(page, { assigned: true });
  await page.getByRole('heading', { name: 'Lớp có bài', exact: true }).click();
  await page.getByRole('button', { name: 'Bảng Điểm & Tiến Độ' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất bảng điểm CSV' }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('Tổng chữ số');
  expect(csv).toContain('"20"');
  expect(csv).not.toContain('"100"');
});

test('Lời giải trong Studio tải lại được và lưu cùng đề/testcase', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: 'Lời giải & Ghi chú' }).click();
  const editorial = page.getByRole('textbox', { name: 'Lời giải', exact: true });
  await expect(editorial).toHaveText('Lời giải đã lưu');
  await editorial.fill('Giải bằng vòng lặp.');
  const saved = page.waitForRequest(request => request.url().endsWith('/rpc/save_problem_bundle'));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  expect((await saved).postDataJSON()).toMatchObject({ p_problem_id: problem.id, p_editorial: 'Giải bằng vòng lặp.' });
});

test('Người học mở lời giải từ trang làm bài', async ({ page }) => {
  await teacherWorkspace(page);
  await page.goto(`/problems/${problem.slug}`);
  await page.getByRole('button', { name: 'Xem lời giải', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Lời giải' });
  await expect(dialog).toContainText('Lời giải đã lưu');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('Thí sinh đăng ký thi và nhìn thấy trạng thái chờ duyệt', async ({ page }) => {
  await teacherWorkspace(page);
  await page.goto('/contests/40000000-0000-0000-0000-000000000001');
  await page.getByRole('button', { name: 'Đăng ký dự thi', exact: true }).click();
  await expect(page.getByText('Đăng ký đang chờ giáo viên duyệt.', { exact: true })).toBeVisible();
});

test('Giáo viên duyệt đăng ký thi từ workspace', async ({ page }) => {
  await teacherWorkspace(page, { registration: true });
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Duyệt đăng ký', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký dự thi' });
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(dialog.getByText('Đã duyệt', { exact: true })).toBeVisible();
});

test('Giáo viên cấu hình kỳ thi yêu cầu duyệt đăng ký', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  const required = page.getByLabel('Yêu cầu duyệt đăng ký');
  await expect(required).toBeChecked();
  await required.uncheck();
  const saved = page.waitForRequest(request => request.method() === 'PATCH' && new URL(request.url()).pathname.endsWith('/contests'));
  await page.getByRole('button', { name: 'Cập Nhật', exact: true }).click();
  expect((await saved).postDataJSON().registration_required).toBe(false);
});

test('Giáo viên lưu được mốc đóng băng bảng xếp hạng', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  await page.getByText('Tùy chọn bảng xếp hạng', { exact: true }).click();
  const freeze = page.getByLabel('Đóng băng bảng xếp hạng');
  await expect(freeze).toBeVisible();
  const value = await page.evaluate(() => {
    const d = new Date(Date.now() + 1800000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  await freeze.fill(value);
  const saved = page.waitForRequest(request => request.method() === 'PATCH' && new URL(request.url()).pathname.endsWith('/contests'));
  await page.getByRole('button', { name: 'Cập Nhật', exact: true }).click();
  expect((await saved).postDataJSON().freeze_at).toBeTruthy();
});

test('Giáo viên chấm lại bài nộp từ trang lịch sử', async ({ page }) => {
  await teacherWorkspace(page, { assigned: true });
  await page.goto('/submissions');
  await page.getByRole('button', { name: 'Xem mã nguồn & thông số' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết bài nộp' });
  const rejudge = dialog.getByRole('button', { name: 'Chấm lại', exact: true });
  await expect(rejudge).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await rejudge.click();
  await expect(page.getByText('Đã đưa bài nộp vào hàng đợi chấm lại.', { exact: true })).toBeVisible();
});

test('ACM đồng điểm và penalty ưu tiên thời điểm AC cuối sớm hơn', async ({ page }) => {
  await teacherWorkspace(page, { tiedRanks: true });
  await page.goto('/contests/40000000-0000-0000-0000-000000000001');
  await page.getByRole('button', { name: /Bảng Xếp Hạng/i }).click();
  await expect(page.getByRole('row').nth(1)).toContainText('AC cuối sớm');
});

test('Admin khóa tài khoản với lý do và có thể mở khóa lại', async ({ page }) => {
  await teacherWorkspace(page, { admin: true });
  await page.goto('/admin/users');
  const row = page.getByRole('row').filter({ hasText: 'Học sinh thử' });
  await expect(row.getByRole('button', { name: 'Khóa tài khoản', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('Lạm dụng hệ thống'));
  await row.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Mở khóa tài khoản', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('Đã xác minh'));
  await row.getByRole('button', { name: 'Mở khóa tài khoản', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Khóa tài khoản', exact: true })).toBeVisible();
});

test('Admin xem nhật ký thao tác kèm lý do', async ({ page }) => {
  await teacherWorkspace(page, { admin: true });
  await page.goto('/admin/users');
  const audit = page.getByRole('button', { name: 'Xem nhật ký quản trị', exact: true });
  await expect(audit).toBeVisible();
  await audit.click();
  await expect(page.getByRole('cell', { name: 'Khóa tài khoản', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Spam', exact: true })).toBeVisible();
});

test('Phiên cũ của tài khoản bị khóa không còn vào workspace', async ({ page }) => {
  await teacherWorkspace(page, { blocked: true });
  await expect(page.getByText('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /đăng nhập/i }).first()).toBeVisible();
});

test('Giáo viên chạy kiểm định lời giải chuẩn bằng bộ test đã lưu', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: 'Lời giải & Ghi chú' }).click();
  const source = page.getByLabel('Mã nguồn kiểm định');
  await expect(source).toBeVisible();
  await source.fill('int main(){}');
  const queued = page.waitForRequest(request => request.url().endsWith('/rpc/validate_problem_solution'));
  await page.getByRole('button', { name: 'Kiểm định lời giải', exact: true }).click();
  expect((await queued).postDataJSON()).toMatchObject({ p_problem_id: problem.id, p_language: 'cpp', p_code: 'int main(){}' });
});

test('ZIP thiếu cặp input/output bị từ chối, không nhập một phần', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: /Bộ testcase/ }).click();
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(new URL('./fixtures/orphan-testcase.zip', import.meta.url).pathname);
  await expect(page.getByRole('status').filter({ hasText: /Thiếu cặp input\/output/ })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
});

test('ZIP nén nhỏ nhưng testcase quá lớn bị từ chối trước khi nhập', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: /Bộ testcase/ }).click();
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(new URL('./fixtures/oversized-testcase.zip', import.meta.url).pathname);
  await expect(page.getByText(/vượt giới hạn 1 MiB/)).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
});

test('Mã trùng báo rõ, giữ bản nháp và cho sửa mã', async ({ page }) => {
  const state = await teacherWorkspace(page, { conflict: true });
  const dialog = await openCreate(page);
  await dialog.getByLabel('Tên lớp học').fill('Lớp kiểm thử');
  await dialog.getByLabel('Mã mời').fill('TRUNG1');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Mã mời này đã được sử dụng');
  await expect(dialog.getByLabel('Tên lớp học')).toHaveValue('Lớp kiểm thử');
  await dialog.getByLabel('Mã mời').fill('MOI11A');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lớp kiểm thử', exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(2);
});

test('Mã tự sinh bị trùng được thử lại, không đổi tên lớp', async ({ page }) => {
  const state = await teacherWorkspace(page, { autoConflict: true });
  const dialog = await openCreate(page);
  await dialog.getByLabel('Tên lớp học').fill('Lớp tự sinh');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lớp tự sinh', exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(2);
  expect(state.posts[0].code).toMatch(/^[A-Z0-9]{6}$/);
  expect(state.posts[1].code).toMatch(/^[A-Z0-9]{6}$/);
  expect(state.posts[0].code).not.toBe(state.posts[1].code);
});

test('Validate tên/mã và giữ nội dung khi hủy rồi mở lại', async ({ page }) => {
  const state = await teacherWorkspace(page);
  let dialog = await openCreate(page);
  await dialog.getByLabel('Tên lớp học').fill('   ');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Tên lớp cần có');
  await dialog.getByLabel('Tên lớp học').fill('Bản nháp');
  await dialog.getByLabel('Mã mời').fill('A!');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  expect(await dialog.getByLabel('Mã mời').evaluate((element: HTMLInputElement) => element.validity.patternMismatch)).toBe(true);
  expect(state.posts).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  dialog = await openCreate(page);
  await expect(dialog.getByLabel('Tên lớp học')).toHaveValue('Bản nháp');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Không đóng hoặc gửi lặp khi đang tạo lớp', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const state = await teacherWorkspace(page, { pending });
  const dialog = await openCreate(page);
  await dialog.getByLabel('Tên lớp học').fill('Lớp đang lưu');
  await dialog.getByRole('button', { name: 'Tạo lớp học', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Đang tạo lớp...' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Đóng tạo lớp' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Enter');
  expect(state.posts).toHaveLength(1);
  release();
  await expect(page.getByRole('heading', { name: 'Lớp đang lưu', exact: true })).toBeVisible();
});

test('Lỗi tải danh sách được báo, không giả thành lớp trống', async ({ page }) => {
  await teacherWorkspace(page, { listError: true });
  await expect(page.getByText('Không tải được lớp học', { exact: true })).toBeVisible();
  await expect(page.getByText('Bạn chưa có lớp học nào', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tải lại danh sách' })).toBeEnabled();
});


test('ZIP hỏng checksum bị từ chối trước khi thay bộ test', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: /Bộ testcase/ }).click();
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(new URL('./fixtures/corrupt-testcase.zip', import.meta.url).pathname);
  await expect(page.getByText(/ZIP không hợp lệ hoặc bị hỏng/)).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
});


test('Nhập ZIP giữ nguyên dữ liệu và không tự công khai testcase', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: /Bộ testcase/ }).click();
  const guide = page.getByRole('region', { name: 'Hướng dẫn chuẩn bị testcase', exact: true });
  await expect(guide).toContainText('01.in');
  await expect(guide).toContainText('01.out');
  await expect(guide).toContainText('01.ans');
  await expect(guide).toContainText('input00.txt');
  await expect(guide).toContainText('output00.txt');
  await expect(guide).toContainText('UTF-8');
  await expect(guide).toContainText('1 MiB');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await guide.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await guide.screenshot({ path: `test-results/testcase-guide-${width}.png` });
  }
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(new URL('./fixtures/exact-testcase.zip', import.meta.url).pathname);
  await expect(page.getByText(/Đã nhập thành công 1 testcases/)).toBeVisible();
  const saved = page.waitForRequest(request => request.url().endsWith('/rpc/save_problem_bundle'));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  expect((await saved).postDataJSON().p_testcases[1]).toMatchObject({ input_content: '  abc\n\n', output_content: '  xyz\n', is_sample: false });
});


test('ZIP trùng tên testcase giữa các thư mục không ghi đè âm thầm', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: /Bộ testcase/ }).click();
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(new URL('./fixtures/duplicate-testcase.zip', import.meta.url).pathname);
  await expect(page.getByText(/Trùng tên file testcase/)).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2);
});

test('Thêm testcase không có input cho bài chỉ in kết quả', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: /Bộ testcase/ }).click();
  await page.getByPlaceholder('Output mong đợi...').fill('Hello');
  await page.getByRole('button', { name: 'Thêm test', exact: true }).click();
  await expect(page.getByRole('row')).toHaveCount(3);
  const saved = page.waitForRequest(request => request.url().endsWith('/rpc/save_problem_bundle'));
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  expect((await saved).postDataJSON().p_testcases[1]).toMatchObject({ input_content: '', output_content: 'Hello' });
});


test('Sửa mã chuẩn sau AC không bị hiểu là mã mới đã qua kiểm định', async ({ page }) => {
  await teacherWorkspace(page, { validated: true });
  await page.getByRole('button', { name: 'Danh Sách Bài Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa bài tập', exact: true }).click();
  await page.getByRole('button', { name: 'Lời giải & Ghi chú' }).click();
  // The lazy editor shows its own role=status while loading; target the validation line.
  const validationStatus = page.getByRole('status').filter({ hasText: /kiểm định/i });
  await expect(validationStatus).toContainText('đạt toàn bộ testcase');
  await page.getByLabel('Mã nguồn kiểm định').fill('int main(){return 1;}');
  await expect(validationStatus).toContainText('Mã hiện tại chưa được kiểm định');
});

test('Quản trị chỉ có một thao tác tạo bài, không hiện nhãn kỹ thuật và lối tắt lặp', async ({ page }) => {
  await teacherWorkspace(page, { admin: true });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
  await expect(page.getByText('Lối Tắt Thao Tác Nhanh', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cấu Hình Hệ Thống', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/admin-clean.png', fullPage: true });
  await page.goto('/admin/problems');
  await expect(page.getByRole('button', { name: /Soạn bài mới|Tạo Bài Tập Mới|Soạn Đề Mới/ })).toHaveCount(1);
  await page.goto('/admin/users');
  await expect(page.getByText('RBAC Enabled', { exact: true })).toHaveCount(0);
});

test('Danh sách contest gọn; chỉ mở form khi tạo hoặc chỉnh sửa', async ({ page }) => {
  await teacherWorkspace(page);
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quản Lý Kỳ Thi', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm Kỳ Thi', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tạo kỳ thi', exact: true }).click();
  await expect(page.getByLabel('Tên kỳ thi', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mô tả', { exact: true })).toHaveJSProperty('tagName', 'TEXTAREA');
  await page.getByRole('button', { name: 'Quay lại danh sách kỳ thi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tạo kỳ thi', exact: true })).toBeVisible();
});

test('Soạn contest tìm bài, sắp thứ tự và đặt điểm OI ngay trong editor', async ({ page }) => {
  await teacherWorkspace(page);
  const second = { ...problem, id: '10000000-0000-0000-0000-000000000002', title: 'Bài thứ hai', slug: 'second' };
  await page.route('**/rest/v1/problems?**', route => route.fulfill({ json: [problem, second] }));
  await page.route('**/rest/v1/contest_problems?**', route => route.fulfill({ json: route.request().method() === 'GET' ? [{ problem_id: problem.id, sort_order: 0, score: 100 }] : [] }));
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  const section = page.getByRole('region', { name: 'Bài thi', exact: true });
  await expect(section).toBeVisible();
  await expect(section.getByRole('spinbutton')).toHaveCount(0);
  await page.getByLabel('Thể thức', { exact: true }).selectOption('OI');
  await section.getByPlaceholder('Tìm bài tập...').fill('thứ hai');
  await section.getByRole('checkbox', { name: 'Bài thứ hai', exact: true }).check();
  await section.getByRole('button', { name: 'Đưa Bài thứ hai lên', exact: true }).click();
  await section.getByLabel('Điểm Bài thứ hai', { exact: true }).fill('50');
  await section.getByLabel('Luyện tập Bài thứ hai', { exact: true }).uncheck();
  const saved = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/contest_problems'));
  await section.getByRole('button', { name: 'Lưu bài thi', exact: true }).click();
  expect((await saved).postDataJSON()).toEqual([
    expect.objectContaining({ problem_id: second.id, sort_order: 0, score: 50, practice_visible: false }),
    expect.objectContaining({ problem_id: problem.id, sort_order: 1, score: 100, practice_visible: true }),
  ]);
  await expect(section.getByRole('status')).toContainText('1 bài chỉ mở trong kỳ thi');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/contest-editor-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/contest-editor-mobile.png', fullPage: true });
});

test('Lỗi tải bài thi không biến thành danh sách rỗng có thể ghi đè', async ({ page }) => {
  await teacherWorkspace(page);
  await page.route('**/rest/v1/contest_problems?**', route => route.fulfill({ status: 500, json: { message: 'Temporary failure' } }));
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  const section = page.getByRole('region', { name: 'Bài thi', exact: true });
  await expect(section.getByRole('alert')).toContainText('Không tải được danh sách bài thi');
  await expect(section.getByRole('button', { name: 'Lưu bài thi', exact: true })).toBeDisabled();
  await expect(section.getByRole('button', { name: 'Thử lại', exact: true })).toBeEnabled();
});

test('Lỗi lưu bài thi giữ danh sách cũ sau khi mở lại editor', async ({ page }) => {
  await teacherWorkspace(page);
  let stored = [{ problem_id: problem.id, sort_order: 0, score: 100 }];
  await page.route('**/rest/v1/contest_problems?**', route => {
    const method = route.request().method();
    if (method === 'GET') return route.fulfill({ json: stored });
    if (method === 'DELETE') { stored = []; return route.fulfill({ json: [] }); }
    return route.fulfill({ status: 500, json: { message: 'Không ghi được bài thi' } });
  });
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  const section = page.getByRole('region', { name: 'Bài thi', exact: true });
  await expect(section.getByRole('button', { name: `Bỏ ${problem.title}`, exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Lưu bài thi', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('Không ghi được bài thi');
  await page.getByRole('button', { name: 'Quay lại danh sách kỳ thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  await expect(section.getByRole('button', { name: `Bỏ ${problem.title}`, exact: true })).toBeVisible();
});

test('Danh sách contest báo lỗi tải và cho thử lại', async ({ page }) => {
  await teacherWorkspace(page);
  let failed = true;
  await page.route('**/rest/v1/contests?**', route => route.fulfill(failed ? { status: 500, json: { message: 'Network error' } } : { json: [{ id: 'retry-contest', created_by: teacherId, title: 'Thi sau khi kết nối lại', rule_type: 'ACM', is_public: true, start_time: '2030-01-01T09:00:00Z', end_time: '2030-01-01T10:00:00Z' }] }));
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được kỳ thi');
  failed = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Thi sau khi kết nối lại/ })).toBeVisible();
});

test('Nhãn độ khó đọc rõ trên một dòng khi bảng bài tập thu hẹp', async ({ page }) => {
  await teacherWorkspace(page);
  const rows = ['Easy', 'Medium', 'Hard'].map((difficulty, i) => ({
    ...problem, id: `difficulty-${i}`, slug: `difficulty-${i}`, difficulty,
    title: `${1001 + i}. Valid Palindrome (Chuỗi Đối Xứng)`, tags: ['two-pointer', 'chuỗi'],
  }));
  await page.route('**/rest/v1/problems?**', route => route.fulfill({ json: rows }));
  await page.route('**/rest/v1/rpc/get_problem_page', route => route.fulfill({ json: problemPage(rows, route.request().postDataJSON()) }));
  for (const path of ['/', '/problems']) {
    for (const width of [1053, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: '1002. Valid Palindrome (Chuỗi Đối Xứng)', exact: true }) });
      const badge = row.getByText(/Trung [Bb]ình/, { exact: true });
      await expect(badge).toBeVisible();
      const lines = await badge.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size;
      });
      expect(lines).toBe(1);
      if (width !== 768) await page.screenshot({ path: `test-results/difficulty-${path === '/' ? 'home' : 'problems'}-${width}.png`, fullPage: true });
    }
  }
});

test('Thử thách hôm nay hiển thị công thức thay vì cú pháp nguồn', async ({ page }) => {
  await teacherWorkspace(page);
  const daily = {
    ...problem, title: '1001. A + B Problem',
    description: String.raw`Cho hai số nguyên $a$ và $b$ ($-10^9 \le a, b \le 10^9$). Hãy tính và in ra giá trị của $a + b$.

## Dữ liệu
Không đưa phần dữ liệu vào thẻ tóm tắt.`,
  };
  await page.route('**/rest/v1/problems?**', route => route.fulfill({ json: route.request().headers().accept?.includes('vnd.pgrst.object') ? daily : [daily] }));
  for (const width of [1053, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const solve = page.getByRole('link', { name: 'Giải ngay' });
    const card = solve.locator('../..');
    const summary = card.locator('p');
    await expect(summary).toContainText('≤');
    await expect(summary).not.toContainText('$');
    expect((await summary.locator('.katex-html').allTextContents()).join('')).not.toContain('\\le');
    await expect(summary).not.toContainText('Không đưa phần dữ liệu');
    await expect(summary.locator('math msup')).toHaveCount(2);
    await expect(solve).toHaveAttribute('href', '/problems/sum-of-digits');
    const bounds = await card.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await card.screenshot({ path: `test-results/daily-challenge-${width}.png` });
  }
});


test('Bài chấm quá 30 giây tiếp tục được theo dõi và ngừng poll khi rời trang', async ({ page }) => {
  await teacherWorkspace(page);
  let terminal = false, polls = 0;
  await page.route('**/rest/v1/submissions?**', route => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { id: 'slow-job' } });
    if (new URL(route.request().url()).searchParams.get('id') !== 'eq.slow-job') return route.fulfill({ json: [] });
    polls++;
    return route.fulfill({ json: { id: 'slow-job', problem_id: problem.id, user_id: teacherId, language: 'cpp',
      status: terminal ? 'ACCEPTED' : 'JUDGING', details: [], score: terminal ? 100 : 0, time_used_ms: 1, memory_used_mb: 1 } });
  });
  await page.goto(`/problems/${problem.slug}`);
  await expect(page.locator('.monaco-editor textarea').first()).toBeAttached();
  await page.clock.install();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await page.clock.fastForward(1000);
  await expect.poll(() => polls).toBeGreaterThan(0);
  await page.clock.fastForward(35000);
  await expect(page.getByRole('button', { name: 'Đang chấm bài...', exact: true })).toBeDisabled();
  terminal = true;
  await page.clock.fastForward(6000);
  await expect(page.getByRole('button', { name: 'Nộp bài', exact: true })).toBeEnabled();
  terminal = false;
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await page.clock.fastForward(1000);
  await page.getByRole('link', { name: /Bài tập/i }).first().click();
  await expect(page).toHaveURL('/problems');
  const stoppedAt = polls;
  await page.clock.fastForward(60000);
  expect(polls).toBe(stoppedAt);
});

test('Bài đang chờ hiện vị trí trong hàng đợi, rồi chuyển sang đang chấm', async ({ page }) => {
  await teacherWorkspace(page);
  let status = 'PENDING';
  await page.route('**/rest/v1/rpc/get_queue_position', route => route.fulfill({ json: 3 }));
  await page.route('**/rest/v1/submissions?**', route => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { id: 'queued-job' } });
    if (new URL(route.request().url()).searchParams.get('id') !== 'eq.queued-job') return route.fulfill({ json: [] });
    return route.fulfill({ json: { id: 'queued-job', problem_id: problem.id, user_id: teacherId, language: 'cpp',
      status, details: [], score: 0, time_used_ms: 0, memory_used_mb: 0 } });
  });
  await page.goto(`/problems/${problem.slug}`);
  await expect(page.locator('.monaco-editor textarea').first()).toBeAttached();
  await page.clock.install();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await page.clock.fastForward(1000);
  await expect(page.getByText('Đang xếp hàng (vị trí 3)')).toBeVisible();
  status = 'JUDGING';
  await page.clock.fastForward(6000);
  await expect(page.getByText('Đang xếp hàng (vị trí 3)')).toHaveCount(0);
});

test('Giáo viên tạo lộ trình: slug tự sinh, chọn bài theo thứ tự và lưu qua RPC', async ({ page }) => {
  await teacherWorkspace(page);
  let saved: any = null;
  await page.route('**/rest/v1/rpc/save_learning_track', route => { saved = route.request().postDataJSON(); return route.fulfill({ json: 'new-track' }); });
  await page.route('**/rest/v1/learning_tracks?**', route => route.fulfill({ json: [] }));
  await page.getByRole('button', { name: 'Lộ Trình Luyện Tập', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo lộ trình', exact: true }).click();
  await page.getByLabel('Tên lộ trình').fill('Nhập môn lập trình');
  await expect(page.getByLabel('Đường dẫn (slug)')).toHaveValue('nhap-mon-lap-trinh');
  await page.getByRole('checkbox', { name: problem.title }).check();
  await page.getByLabel('Công khai cho học sinh').check();
  await page.getByRole('button', { name: 'Lưu lộ trình', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu lộ trình' })).toContainText('"Nhập môn lập trình"');
  expect(saved).toEqual({ p_track_id: null, p_problem_ids: [problem.id],
    p_track: { slug: 'nhap-mon-lap-trinh', title: 'Nhập môn lập trình', description: '', sort_order: 0, is_public: true } });
});

const rewardCatalog = [
  { id: 'frame-gold', kind: 'frame', tier: 'gold', name: 'Khung Vàng', sort_order: 1 },
  { id: 'frame-silver', kind: 'frame', tier: 'silver', name: 'Khung Bạc', sort_order: 2 },
  { id: 'frame-participant', kind: 'frame', tier: 'participant', name: 'Khung Chiến binh', sort_order: 4 },
  { id: 'banner-gold', kind: 'banner', tier: 'gold', name: 'Nền Hoàng kim', sort_order: 5 },
];

test('Người tạo contest đặt phần thưởng theo hạng và trao giải sau khi kết thúc', async ({ page }) => {
  await teacherWorkspace(page);
  let rules: any = null, awarded = false;
  await page.route('**/rest/v1/rewards?**', route => route.fulfill({ json: rewardCatalog }));
  await page.route('**/rest/v1/contest_rewards?**', route => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/set_contest_rewards', route => { rules = route.request().postDataJSON(); return route.fulfill({ status: 204, body: '' }); });
  await page.route('**/rest/v1/rpc/award_contest_rewards', route => { awarded = true; return route.fulfill({ json: 3 }); });
  await page.route('**/rest/v1/contests?**', route => route.fulfill({ json: [{ id: 'ended-contest', created_by: teacherId, title: 'Thi đã xong', description: '', rule_type: 'ACM',
    registration_required: false, is_public: true, start_time: new Date(Date.now() - 7200000).toISOString(), end_time: new Date(Date.now() - 3600000).toISOString() }] }));
  await page.getByRole('button', { name: 'Danh Sách Kỳ Thi', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa kỳ thi', exact: true }).click();
  const section = page.getByRole('region', { name: 'Phần thưởng', exact: true });
  await section.getByRole('button', { name: 'Thêm phần thưởng', exact: true }).click();
  await section.getByRole('button', { name: 'Thêm phần thưởng', exact: true }).click();
  await section.getByLabel('Phần thưởng', { exact: true }).nth(1).selectOption('frame-silver');
  await section.getByLabel('Hạng từ 1 đến').nth(1).fill('3');
  await section.getByRole('button', { name: 'Thêm phần thưởng', exact: true }).click();
  await section.getByLabel('Phần thưởng', { exact: true }).nth(2).selectOption('frame-participant');
  await section.getByLabel('Mọi thí sinh').nth(2).check();
  await section.getByRole('button', { name: 'Lưu phần thưởng', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('Đã lưu phần thưởng');
  expect(rules).toEqual({ p_contest_id: 'ended-contest', p_rules: [
    { reward_id: 'frame-gold', max_rank: 1 }, { reward_id: 'frame-silver', max_rank: 3 }, { reward_id: 'frame-participant', max_rank: null }] });
  await section.getByRole('button', { name: 'Trao giải', exact: true }).click();
  expect(awarded).toBe(false);
  await section.getByRole('button', { name: 'Xác nhận trao giải', exact: true }).click();
  await expect(section.getByRole('status')).toContainText('Đã trao 3 phần thưởng');
  expect(awarded).toBe(true);
});

test('Học sinh xem phần thưởng contest, trang bị khung và hồ sơ hiển thị thành tích', async ({ page }) => {
  await teacherWorkspace(page);
  let equipped: any = null;
  const earned = [{ id: 1, reward_id: 'frame-gold', contest_id: 'c1', contest_title: 'Thi tháng 11', rank: 1, awarded_at: '2026-11-13T00:00:00Z' }];
  await page.route('**/rest/v1/rewards?**', route => route.fulfill({ json: rewardCatalog }));
  await page.route('**/rest/v1/user_rewards?**', route => route.fulfill({ json: earned }));
  await page.route('**/rest/v1/profiles_public?**', route => route.fulfill({ json: { id: teacherId, full_name: 'Teacher', avatar_url: null, role: 'user',
    created_at: '2026-01-01T00:00:00Z', equipped_frame: equipped?.p_reward_id ?? null, equipped_banner: null } }));
  await page.route('**/rest/v1/rpc/equip_reward', route => { equipped = route.request().postDataJSON(); return route.fulfill({ status: 204, body: '' }); });
  await page.goto('/settings');
  const collection = page.getByRole('region', { name: 'Bộ sưu tập phần thưởng' });
  await expect(collection).toContainText('Khung Vàng');
  await expect(collection).toContainText('Thi tháng 11 (hạng 1)');
  await collection.getByRole('button', { name: 'Trang bị', exact: true }).click();
  await expect(collection.getByRole('button', { name: 'Bỏ trang bị', exact: true })).toBeVisible();
  expect(equipped).toEqual({ p_kind: 'frame', p_reward_id: 'frame-gold' });
  await page.goto(`/users/${teacherId}`);
  const trophies = page.getByRole('region', { name: 'Thành tích kỳ thi' });
  await expect(trophies).toContainText('Khung Vàng');
  await expect(trophies).toContainText('Thi tháng 11 · hạng 1');
});
