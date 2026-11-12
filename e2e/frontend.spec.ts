import { test, expect, problem } from './fixtures';

test('Mẫu C++ hệ thống chỉ có khung chương trình và nhập xuất nhanh', async ({ page }) => {
  await page.goto(`/problems/${problem.slug}`);
  const code = page.locator('.monaco-editor .view-lines');
  await expect(code).toContainText('ios_base::sync_with_stdio(false);');
  await expect(code).toContainText('cin.tie(nullptr);');
  await expect(code).toContainText('// TODO: code here');
  await expect(code).not.toContainText('cout << a + b');
});

test('Đề luyện tập và bài thi hiển thị công thức trong mô tả và dữ liệu vào ra', async ({ page }) => {
  const statement = {
    ...problem,
    description: String.raw`Cho dãy $a_1$ gồm các số không vượt quá $10^9$.`,
    input_format: String.raw`Nhập $n$ với $1 \le n \le 10^9$.`,
    output_format: String.raw`In $a_1 + a_2$.`,
  };
  await page.route('**/rest/v1/problems?**', route => route.fulfill({ json: statement }));
  await page.route('**/rest/v1/contests?**', route => route.fulfill({ json: {
    id: 'math-contest', title: 'Thi thử', rule_type: 'ACM',
    start_time: '2026-01-01T00:00:00Z', end_time: '2030-01-01T00:00:00Z',
  } }));
  await page.route('**/rest/v1/contest_problems?**', route => route.fulfill({ json: [{
    contest_id: 'math-contest', problem_id: problem.id, sort_order: 0, score: 100, problems: statement,
  }] }));
  for (const path of [`/problems/${problem.slug}`, `/contests/math-contest/problems/${problem.id}`]) {
    await page.goto(path);
    const description = page.getByText(/^Cho dãy/);
    const input = page.locator('p').filter({ hasText: /^Nhập/ });
    const output = page.locator('p').filter({ hasText: /^In/ });
    await expect(description.locator('math msup > :last-child')).toHaveText('9');
    await expect(input).toContainText('≤');
    await expect(input.locator('math msup > :last-child')).toHaveText('9');
    await expect(output.locator('math msub mn')).toHaveText(['1', '2']);
    if (path.startsWith('/problems/')) {
      await page.getByRole('button', { name: 'Phóng to cỡ chữ' }).click();
      await expect(page.getByText('17px', { exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/statement-${path.startsWith('/problems/') ? 'practice' : 'contest'}.png` });
  }
});

test('Editor giữ bản nháp khi đổi ngôn ngữ, tải lại và mẫu giáo viên thay đổi', async ({ page }) => {
  let template = '// starter_original\nint main() {}';
  const data = () => ({ ...problem, starter_codes: { cpp: template, python: '' } });
  await page.route('**/rest/v1/problems?**', route => route.fulfill({ json: data() }));
  await page.route('**/rest/v1/contests?**', route => route.fulfill({ json: {
    id: 'draft-contest', title: 'Thi thử', rule_type: 'ACM', start_time: '2026-01-01T00:00:00Z', end_time: '2030-01-01T00:00:00Z',
  } }));
  await page.route('**/rest/v1/contest_problems?**', route => route.fulfill({ json: [{
    contest_id: 'draft-contest', problem_id: problem.id, sort_order: 0, score: 100, problems: data(),
  }] }));
  for (const path of [`/problems/${problem.slug}`, `/contests/draft-contest/problems/${problem.id}`]) {
    template = '// starter_original\nint main() {}';
    await page.goto(path);
    const editor = page.locator('.monaco-editor .view-lines');
    const language = page.locator('select').filter({ has: page.locator('option[value="python"]') });
    await expect(editor).toContainText('starter_original');
    await editor.click({ position: { x: 40, y: 10 } });
    await page.keyboard.press('Control+a');
    await page.keyboard.type('// student_draft');
    await expect(editor).toContainText('student_draft');
    await language.selectOption('python');
    await expect(editor).toContainText('def solve');
    await language.selectOption('cpp');
    await expect(editor).toContainText('student_draft');
    template = '// starter_updated\nint main() {}';
    await page.reload();
    await expect(editor).toContainText('student_draft');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Đặt lại mẫu', exact: true }).click();
    await expect(editor).toContainText('student_draft');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Đặt lại mẫu', exact: true }).click();
    await expect(editor).toContainText('starter_updated');
  }
});

test('Hướng dẫn mô tả đúng chấm điểm theo trọng số testcase', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByText(/Điểm dựa trên trọng số testcase/)).toBeVisible();
  await expect(page.getByText('OI Subtask Rule:', { exact: true })).toHaveCount(0);
});

test('Trang chủ và điều hướng bài tập', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CodeJudge|Online Judge/i);
  await page.getByRole('link', { name: /bài tập/i }).first().click();
  await expect(page).toHaveURL(/problems/);
  await expect(page.getByRole('link', { name: /Tổng chữ số/ })).toBeVisible();
});

test('Lọc bài tập và mở đề', async ({ page }) => {
  await page.goto('/problems');
  await page.getByPlaceholder('Lọc bài tập...').fill('không tồn tại');
  await expect(page.getByRole('link', { name: /Tổng chữ số/ })).toHaveCount(0);
  await page.getByPlaceholder('Lọc bài tập...').fill('Tổng');
  await page.getByRole('link', { name: /Tổng chữ số/ }).click();
  await expect(page).toHaveURL(/problems\/sum-of-digits/);
  await expect(page.getByRole('button', { name: 'Nộp bài', exact: true })).toBeVisible();
});

test('Khách không được chạy thử hoặc nộp bài', async ({ page }) => {
  await page.goto('/problems/sum-of-digits');
  await page.getByRole('button', { name: /chạy thử/i }).click();
  await expect(page.getByText(/cần đăng nhập|chưa đăng nhập/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await expect(page.getByText(/cần đăng nhập|chưa đăng nhập/i).first()).toBeVisible();
});

test('Input tự tạo và bộ chọn ngôn ngữ', async ({ page }) => {
  await page.goto('/problems/sum-of-digits');
  await page.getByRole('button', { name: 'Tự tạo', exact: true }).click();
  await page.getByPlaceholder('Nhập input kiểm thử...').fill('12345');
  await expect(page.getByPlaceholder('Nhập input kiểm thử...')).toHaveValue('12345');
  const language = page.locator('select').filter({ has: page.locator('option[value="python"]') });
  await language.selectOption('python');
  await expect(language).toHaveValue('python');
  await expect(language.locator('option[value="java"]')).toHaveCount(0);
});

test('Học sinh mở lộ trình theo chủ đề từ ngân hàng bài và chọn bài luyện', async ({ page }) => {
  await page.goto('/problems');
  await page.getByRole('link', { name: 'Luyện theo chủ đề', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Luyện theo chủ đề' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'số học', exact: true })).toBeVisible();
  await expect(page.getByText('0/1 bài đã giải', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/learning.png', fullPage: true });
  await page.getByRole('link', { name: /Tổng chữ số/ }).click();
  await expect(page).toHaveURL(/problems\/sum-of-digits/);
});

test('Trình soạn thảo vẫn dùng được khi CDN bên ngoài bị chặn', async ({ page }) => {
  const external: string[] = [];
  await page.route(/https:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com)\//, route => { external.push(route.request().url()); return route.abort(); });
  await page.goto('/problems/sum-of-digits');
  await expect(page.locator('.monaco-editor textarea').first()).toBeAttached();
  await page.screenshot({ path: 'test-results/editor-local.png' });
  expect(external).toEqual([]);
});


test('Nội dung đề không thực thi HTML, link hoặc công thức chứa mã độc', async ({ page }) => {
  await page.route('**/rest/v1/problems?**', route => route.fulfill({ json: { ...problem,
    description: ['<img src=x onerror="window.xssTriggered=true">', '',
      '<sup><img src=x onerror="window.xssTriggered=true"></sup>', '',
      '<sub onclick="window.xssTriggered=true">2</sub>', '',
      '[Không an toàn](javascript:alert(1))', '', String.raw`$\href{javascript:alert(1)}{link}$`, '',
      '```cpp', 'int main() { return 0; }', '```'].join('\n'),
  } }));
  await page.goto(`/problems/${problem.slug}`);
  const statement = page.locator('.markdown-content').first();
  await expect(statement.getByText('Không an toàn', { exact: true })).not.toHaveAttribute('href');
  await expect(statement.locator('img, script, iframe, a[href^="javascript:"]')).toHaveCount(0);
  await expect(statement.locator('pre code')).toContainText('int main()');
  expect(await page.evaluate(() => (window as any).xssTriggered)).toBeUndefined();
});

test('Quên mật khẩu nằm dưới ô mật khẩu và mở luồng gửi email trên desktop/mobile', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/auth/v1/recover**', route => {
    requests.push(route.request().postDataJSON().email);
    return route.fulfill({ json: {} });
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /đăng nhập/i }).first().click();
    const login = page.getByRole('dialog', { name: 'Đăng nhập', exact: true });
    await login.locator('input[type=email]').fill('student@example.test');
    const password = await login.locator('input[type=password]').boundingBox();
    const forgot = login.getByRole('button', { name: 'Quên mật khẩu?', exact: true });
    const bounds = await forgot.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(password!.y + password!.height);
    expect(Math.abs(bounds!.x + bounds!.width - password!.x - password!.width)).toBeLessThan(2);
    await login.screenshot({ path: `test-results/login-${width}.png` });
    await forgot.click();
    const reset = page.getByRole('dialog', { name: 'Đặt lại mật khẩu', exact: true });
    await expect(reset.locator('input[type=email]')).toHaveValue('student@example.test');
    await reset.getByRole('button', { name: 'Gửi Email Đặt Lại', exact: true }).click();
    await expect(reset.getByRole('status')).toContainText('Đã gửi email hướng dẫn đặt lại mật khẩu');
  }
  expect(requests).toEqual(['student@example.test', 'student@example.test']);
});

test('Danh sách bài gửi bộ lọc và phân trang tới DB, bỏ response cũ', async ({ page }) => {
  const requests: any[] = [];
  await page.route('**/rest/v1/rpc/get_problem_page', async route => {
    const params = route.request().postDataJSON(); requests.push(params);
    await route.fulfill({ json: { rows: [{ ...problem, title: `Bài trang ${params.p_page + 1}`, slug: `page-${params.p_page}`, progress: 'TODO' }],
      total: params.p_keyword ? 1 : 41, counts: { ALL: 41, Low: 41, Mid: 0, High: 0 }, tags: ['số học'] } });
  });
  await page.goto('/problems');
  await expect(page.getByRole('link', { name: 'Bài trang 1', exact: true })).toBeVisible();
  await page.getByTitle('Trang sau', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Bài trang 2', exact: true })).toBeVisible();
  expect(requests.at(-1)).toMatchObject({ p_page: 1, p_page_size: 20 });
  await page.getByPlaceholder('Lọc bài tập...').fill('hai');
  await expect.poll(() => requests.at(-1)).toMatchObject({ p_page: 0, p_keyword: 'hai' });
  await expect(page.getByRole('link', { name: 'Bài trang 1', exact: true })).toBeVisible();
});

test('Ranklist sắp xếp và phân trang tại DB thay vì tải cả danh sách', async ({ page }) => {
  const queries: URLSearchParams[] = [];
  await page.route('**/rest/v1/user_rank?**', route => {
    const query = new URL(route.request().url()).searchParams; queries.push(query);
    const offset = Number(query.get('offset') || 0);
    return route.fulfill({ json: Array.from({ length: offset ? 1 : 50 }, (_, i) => ({ user_id: `u-${offset + i}`, username: `User ${offset + i}`,
      role: 'user', accepted_number: 100 - offset - i, submission_number: 100, total_score: 1000 - offset - i })) });
  });
  await page.goto('/ranklist');
  await expect(page.getByRole('cell', { name: 'U User 0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'U User 50', exact: true })).toBeVisible();
  expect(queries.at(-1)?.get('offset')).toBe('50');
  expect(queries.at(-1)?.get('limit')).toBe('50');
  await page.getByRole('button', { name: 'OI Subtask', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('order')).toBe('total_score.desc,user_id.asc');
  await expect(page.getByRole('cell', { name: 'U User 0', exact: true })).toBeVisible();
});

test('Trang đầu tải độc lập với editor và portal, ghi số đo trình duyệt', async ({ page }) => {
  const { writeFile } = await import('node:fs/promises');
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 100000 });
  await page.addInitScript(() => {
    (window as any).startupMetrics = { lcpMs: null, interactionEventMaxMs: 0 };
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      (window as any).startupMetrics.lcpMs = entries.at(-1)?.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if ((entry as any).interactionId) {
        (window as any).startupMetrics.interactionEventMaxMs = Math.max((window as any).startupMetrics.interactionEventMaxMs, entry.duration);
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nền tảng luyện tập lập trình thi đấu trực tuyến.', exact: true })).toBeVisible();
  const assets = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  expect(assets.some(name => /LocalCodeEditor|RichTextEditor|TeacherPortal|ProblemDetail/.test(name))).toBe(false);
  await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  const metrics = await page.evaluate(() => (window as any).startupMetrics);
  expect(metrics.lcpMs).toBeGreaterThan(0);
  await writeFile(new URL('../docs/reports/frontend-browser-performance-20261025.json', import.meta.url), JSON.stringify({
    at: new Date().toISOString(), environment: 'Playwright Chromium, production preview, API fixture, external fonts blocked; preview transport may differ from hosting',
    cpuThrottle: 4, network: { latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 100000 },
    ...metrics, note: 'Short synthetic interaction sample, not field INP or a before/after LCP comparison.',
  }, null, 2));
});

test('Học sinh theo lộ trình: thẻ tiến độ, trang lộ trình và bài tiếp theo', async ({ page }) => {
  const track = { id: 'track-1', slug: 'nhap-mon-lap-trinh', title: 'Nhập môn lập trình', description: 'Bắt đầu từ đây',
    sort_order: 1, is_public: true, created_by: null,
    learning_track_problems: [{ sort_order: 0, problems: { id: problem.id, slug: problem.slug, title: problem.title, difficulty: problem.difficulty } },
      { sort_order: 1, problems: null }] };
  await page.route('**/rest/v1/learning_tracks?**', route => {
    const object = route.request().headers().accept?.includes('vnd.pgrst.object');
    return route.fulfill({ json: object ? track : [track] });
  });
  await page.goto('/learn');
  await expect(page.getByRole('heading', { name: 'Lộ trình', exact: true })).toBeVisible();
  const card = page.getByRole('link', { name: /Nhập môn lập trình/ });
  await expect(card).toContainText('0/1 bài');
  await expect(card).toContainText(`Tiếp theo: ${problem.title}`);
  await card.click();
  await expect(page).toHaveURL('/learn/nhap-mon-lap-trinh');
  await expect(page.getByRole('heading', { name: 'Nhập môn lập trình' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Tiến độ Nhập môn lập trình' })).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('link', { name: `Làm bài tiếp theo: ${problem.title}` }).click();
  await expect(page).toHaveURL(`/problems/${problem.slug}`);
});
