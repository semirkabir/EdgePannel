import { test, expect } from '@playwright/test';

test('homepage has correct text', async ({ page }) => {
    await page.goto('/');

    // Expect text "PREDICTION MARKETS" to be visible
    await expect(page.getByText('PREDICTION MARKETS')).toBeVisible();
});
