import { test, expect } from './fixtures';

test.describe('Trading Flow', () => {
  test('should display trading interface', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Trade')).toBeVisible();
  });

  test('should show order form when market is selected', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="market-card"]:first-child');
    await expect(page.locator('text=Buy')).toBeVisible();
    await expect(page.locator('text=Sell')).toBeVisible();
  });

  test('should validate order input', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="market-card"]:first-child');
    await page.fill('input[name="amount"]', '-100');
    await expect(page.locator('text=Invalid amount')).toBeVisible();
  });
});
