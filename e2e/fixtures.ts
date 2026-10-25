import { test as base, expect } from '@playwright/test';

export const problem = {
  id: '10000000-0000-0000-0000-000000000001', slug: 'sum-of-digits', title: 'Tổng chữ số',
  description: 'Tính tổng các chữ số.', samples: [{ input: '12345', output: '15' }],
  input_format: 'Số nguyên n', output_format: 'Tổng chữ số', tags: ['số học'], difficulty: 'Easy',
  time_limit_ms: 1000, memory_limit_mb: 256, is_public: true, created_at: '2026-01-01T00:00:00Z',
};

export function problemPage(rows: any[], params: any = {}) {
  const filtered = rows.filter(row => (!params.p_keyword || `${row.title} ${row.slug}`.toLowerCase().includes(params.p_keyword.toLowerCase()))
    && (!params.p_difficulty || params.p_difficulty === 'ALL' || row.difficulty === params.p_difficulty)
    && (!params.p_tag || row.tags.includes(params.p_tag))
    && (!params.p_status || params.p_status === 'ALL' || (row.progress || 'TODO') === params.p_status));
  const size = params.p_page_size || 20, offset = (params.p_page || 0) * size;
  return { rows: filtered.slice(offset, offset + size).map(row => ({ ...row, progress: row.progress || 'TODO' })), total: filtered.length,
    counts: { ALL: rows.length, Low: rows.filter(row => row.difficulty === 'Easy').length,
      Mid: rows.filter(row => row.difficulty === 'Medium').length, High: rows.filter(row => row.difficulty === 'Hard').length },
    tags: [...new Set(rows.flatMap(row => row.tags))] };
}

// These UI tests deliberately intercept the backend. DB/worker integration is
// covered separately; no developer/staging account is touched by this suite.
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/rest/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const resource = url.pathname.split('/').pop();
      if (resource === 'get_problem_page') {
        await route.fulfill({ json: problemPage([problem], route.request().postDataJSON()) });
        return;
      }
      if (resource === 'judge_problem_code') {
        await route.fulfill({ status: 400, json: { message: 'Bạn cần đăng nhập để chạy thử' } });
        return;
      }
      const object = route.request().headers().accept?.includes('vnd.pgrst.object');
      const data = resource === 'problems' ? (object ? problem : [problem]) : resource?.startsWith('get_') ? [] : [];
      await route.fulfill({ json: data, headers: { 'content-range': '0-0/1', 'access-control-allow-origin': '*' } });
    });
    await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, json: { message: 'No test session' } }));
    await use(page);
    expect(errors, 'Uncaught browser errors').toEqual([]);
  },
});
export { expect };
