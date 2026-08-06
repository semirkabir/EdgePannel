import { test, expect } from '@playwright/test';

// The dev server used by e2e runs with VITE_E2E=1, which disables the
// '/' → landing rewrite (app tests target '/'), so the landing page is
// addressed directly by its entry file here. In production, middleware.ts
// rewrites the main-domain root to this page.
test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing.html');
  });

  test('renders hero with headline, CTAs and stats', async ({ page }) => {
    await expect(page.locator('.lp-h1')).toContainText('Headlines run hours late.');
    await expect(page.locator('.lp-hero-ctas a[href="/app"]')).toBeVisible();
    await expect(page.locator('.lp-hero-stats div')).toHaveCount(4);
  });

  test('renders all six sections and footer', async ({ page }) => {
    for (const id of ['hero', 'live', 'product', 'who', 'lenses', 'faq', 'launch']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator('.lp-footer')).toBeVisible();
  });

  test('lens cards link to the variant subdomains', async ({ page }) => {
    const lensGrid = page.locator('.lp-lens-grid');
    await lensGrid.scrollIntoViewIfNeeded();
    await expect(page.locator('.lp-lens')).toHaveCount(6);
    await expect(page.locator('.lp-lens[data-lens="tech"]')).toHaveAttribute(
      'href',
      'https://tech.edgepannel.com'
    );
  });

  test('live widgets resolve to live or sample rows', async ({ page }) => {
    await page.locator('#live').scrollIntoViewIfNeeded();
    // Every widget must leave its "Connecting…" state one way or another.
    for (const widget of ['markets', 'quakes', 'signals', 'fx']) {
      const rows = page.locator(`[data-widget="${widget}"] [data-slot="rows"] li`);
      await expect(rows.first()).not.toContainText('Connecting', { timeout: 30000 });
    }
  });

  test('globe hero canvas initializes', async ({ page }) => {
    const canvas = page.locator('#globe-canvas');
    await expect(canvas).toBeVisible();
    // The lazy globe module sizes the canvas backing store after load.
    await expect
      .poll(async () => canvas.evaluate((el: HTMLCanvasElement) => el.width))
      .toBeGreaterThan(0);
  });

  test('has no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });
});
