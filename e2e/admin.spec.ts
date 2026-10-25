import { test, expect } from './fixtures';

test('Admin: khách chỉ thấy đăng nhập', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /đăng nhập/i })).toBeVisible();
  await expect(page.getByText('Lối Tắt Thao Tác Nhanh')).toHaveCount(0);
});

test('Admin: deep link vẫn bị bảo vệ', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByText('Lối Tắt Thao Tác Nhanh')).toHaveCount(0);
});

test('Teacher: khách không truy cập workspace', async ({ page }) => {
  await page.goto('/teacher');
  await expect(page.getByRole('button', { name: /đăng nhập/i }).last()).toBeVisible();
  await expect(page.getByText('Quản lý lớp học', { exact: true })).toHaveCount(0);
});
