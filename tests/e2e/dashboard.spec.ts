import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('should display dashboard when authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should navigate between dashboard sections', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Portfolio');
    await expect(page).toHaveURL('/dashboard/portfolio');
    await page.click('text=Settings');
    await expect(page).toHaveURL('/dashboard/settings');
  });
});
