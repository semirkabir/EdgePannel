import { expect, test } from '@playwright/test';

test.describe('ui chrome noise', () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('worldmonitor-variant', 'full');
      localStorage.removeItem('wm-ui-power-hints-dismissed-v1');
    });
  });

  test('no full-width banners above the map on first load', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForSelector('.header-right', { timeout: 60000 });
    await expect(page.locator('#localDevApiNotice')).toHaveCount(0);
    const stripVisible = await page.locator('#shellGuidanceStrip').isVisible().catch(() => false);
    expect(stripVisible).toBe(false);
  });

  test('header search label carries the shortcut hint', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.header-right', { timeout: 60000 });
    await expect(page.locator('#searchBtn .search-ticker-text')).toHaveText('Search or jump…');
    await expect(page.locator('#searchBtn kbd')).toHaveText(/^(⌘K|Ctrl\+K)$/);
  });

  test('drag-to-reorder onboarding chip does not cover header search or settings', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForSelector('.header-right', { timeout: 60000 });
    const chip = page.locator('.ohint-chip[data-hint-id="panel-drag"]');
    await chip.waitFor({ state: 'visible', timeout: 45000 });
    await page.waitForTimeout(600);
    const chipBox = await chip.boundingBox();
    expect(chipBox).not.toBeNull();
    for (const sel of ['#searchBtn', '#headerOverflowMenu']) {
      const b = await page.locator(sel).boundingBox();
      if (!b || !chipBox) continue;
      const overlaps = chipBox.x < b.x + b.width && chipBox.x + chipBox.width > b.x
        && chipBox.y < b.y + b.height && chipBox.y + chipBox.height > b.y;
      expect(overlaps, `${sel} covered by onboarding chip`).toBe(false);
    }
  });
});
