import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke-test cho CodeJudge FE.
 *
 * Chạy (trên máy CÓ INTERNET + đã npm install):
 *   cd e2e && npm install && npx playwright install chromium
 *   npm run dev      # apps/web trên :3000 (đổi BASE_URL nếu khác)
 *   npx playwright test --reporter=list
 *
*/
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // WSL: dùng Edge của Windows qua interop (không cần cài Linux libs)
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {},
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm --prefix ../apps/web run build -- --outDir dist-e2e && npm --prefix ../apps/web run preview -- --outDir dist-e2e --host 127.0.0.1 --port 3101 --strictPort',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'local-e2e-placeholder' },
  },
  projects: [
    { name: 'classrooms', testMatch: /classrooms\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'frontend',
      testMatch: /frontend\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});