import { expect, test } from '@playwright/test';

test.describe('map HUD', () => {
  test.setTimeout(180000);
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('worldmonitor-variant', 'full'));
  });

  test('map controls live in one HUD rail; legend collapsed by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.deckgl-controls', { timeout: 120000 });
    const rail = page.locator('.map-hud-rail');
    await expect(rail).toBeVisible();
    for (const label of ['Zoom In', 'Zoom Out', 'Map Style', 'Reset View']) {
      await expect(rail.locator(`[title="${label}"], [aria-label="${label}"]`)).toHaveCount(1);
    }
    await expect(rail.locator('.map-draw-btn')).toHaveCount(1);
    await expect(rail.locator('.map-orbit-btn')).toHaveCount(1);
    await expect(page.locator('.map-legend')).toHaveClass(/collapsed/);
  });

  test('rail sits top-right and is a single column', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.map-hud-rail', { timeout: 120000 });
    const m = await page.evaluate(() => {
      const rail = document.querySelector('.map-hud-rail') as HTMLElement;
      const host = rail.offsetParent as HTMLElement;
      const r = rail.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      const xs = Array.from(rail.querySelectorAll('.map-btn')).map((b) => Math.round(b.getBoundingClientRect().left));
      return { right: h.right - r.right, top: r.top - h.top, xs, pos: getComputedStyle(rail).position };
    });
    expect(m.pos).toBe('absolute');
    expect(m.right).toBeLessThan(20);
    expect(m.top).toBeLessThan(20);
    expect(new Set(m.xs).size).toBe(1);
  });

  test('map style menu opens to the left of the rail, unclipped', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.map-hud-rail', { timeout: 120000 });
    await page.locator('.map-hud-rail .map-theme-picker-btn').click();
    const panel = page.locator('.map-hud-rail .map-theme-picker-panel');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const p = document.querySelector('.map-hud-rail .map-theme-picker-panel') as HTMLElement;
      const r = (document.querySelector('.map-hud-rail') as HTMLElement).getBoundingClientRect();
      const b = p.getBoundingClientRect();
      return { panelRight: b.right, railLeft: r.left, left: b.left, top: b.top, bottom: b.bottom, vw: innerWidth, vh: innerHeight, w: b.width };
    });
    expect(m.panelRight).toBeLessThanOrEqual(m.railLeft);
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.bottom).toBeLessThanOrEqual(m.vh);
    expect(m.w).toBeGreaterThan(100);
  });

  test('legend is bottom-left with 11px text', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.map-legend', { timeout: 120000 });
    const m = await page.evaluate(() => {
      const l = document.querySelector('.map-legend') as HTMLElement;
      const host = l.offsetParent as HTMLElement;
      const r = l.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      return { left: r.left - h.left, bottom: h.bottom - r.bottom, fs: getComputedStyle(l).fontSize, w: r.width };
    });
    expect(m.left).toBeLessThan(20);
    expect(m.bottom).toBeLessThan(20);
    expect(m.fs).toBe('11px');
    expect(m.w).toBeLessThanOrEqual(181);
  });

  test('legend expands on header click', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.map-legend', { timeout: 120000 });
    await page.locator('.map-legend .map-tray-header').click();
    await expect(page.locator('.map-legend')).not.toHaveClass(/collapsed/);
  });
});
