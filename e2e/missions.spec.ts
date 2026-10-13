import { expect, test, type Page } from '@playwright/test';

/**
 * Mission briefings: first-visit picker, running a mission moves the map and
 * turns its layers on, and ?mission= deep links open straight into a briefing.
 * Live feeds are not stubbed, so assertions stick to things the mission
 * itself controls (camera, layers, time range, panel structure).
 */
const RED_SEA = { lat: 19, zoom: 6 };

async function urlState(page: Page) {
  return page.evaluate(() => {
    const q = new URLSearchParams(location.search);
    return { lat: Number(q.get('lat')), lon: Number(q.get('lon')), zoom: Number(q.get('zoom')), timeRange: q.get('timeRange'), layers: (q.get('layers') ?? '').split(',') };
  });
}

test.describe('mission briefings', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('worldmonitor-variant', 'full');
      if (!sessionStorage.getItem('e2e-cleared')) {
        localStorage.removeItem('wm-ui-mission-picker-seen-v1');
        sessionStorage.setItem('e2e-cleared', '1');
      }
    });
  });

  test('first visit opens the picker once, with hint chips held back', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mission-panel')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.mission-card')).toHaveCount(4);
    await expect(page.locator('.ohint-chip')).toHaveCount(0);
    await page.locator('.mission-close').click();
    await expect(page.locator('.mission-overlay')).toBeHidden();

    await page.reload();
    await page.waitForSelector('.header-right', { timeout: 120000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('.mission-overlay')).toBeHidden();
  });

  test('running Red Sea moves the map and turns its layers on', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mission-panel')).toBeVisible({ timeout: 120000 });
    await page.locator('[data-mission="red-sea"]').click();
    await expect(page.locator('.mission-headline')).toContainText('Red Sea shipping', { timeout: 30000 });
    await expect(page.locator('.mission-locked')).toBeVisible();

    await expect.poll(async () => (await urlState(page)).zoom, { timeout: 15000 }).toBeCloseTo(RED_SEA.zoom, 1);
    const state = await urlState(page);
    expect(state.lat).toBeCloseTo(RED_SEA.lat, 0);
    // Camera is shifted east so the target sits left of the 440px panel.
    expect(state.lon).toBeGreaterThan(38.5);
    expect(state.timeRange).toBe('7d');
    for (const layer of ['ais', 'tradeRoutes', 'waterways', 'navWarnings']) {
      expect(state.layers, layer).toContain(layer);
    }

    await page.locator('.mission-back').click();
    await expect(page.locator('.mission-card')).toHaveCount(4);
  });

  test('map stays clickable while the panel is open (no invisible scrim)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mission-panel')).toBeVisible({ timeout: 120000 });
    const hit = await page.evaluate(() => {
      const map = document.querySelector('.maplibregl-canvas, #mapContainer') as HTMLElement | null;
      const r = map!.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + 80, r.top + r.height / 2);
      return { insideOverlay: !!el?.closest('.mission-overlay'), tag: el?.tagName };
    });
    expect(hit.insideOverlay, `click at map landed on ${hit.tag} inside mission overlay`).toBe(false);
  });

  test('?mission= deep link opens straight into the briefing', async ({ page }) => {
    const terrain = page.waitForResponse(r => r.url().endsWith('/data/terrain/znpp-viewshed.json'), { timeout: 120000 });
    await page.goto('/?mission=ukraine-front');
    await expect(page.locator('.mission-headline')).toContainText('Ukraine front', { timeout: 120000 });
    // Ukraine ships a precomputed RustGIS viewshed (Zaporizhzhia NPP).
    const asset = await (await terrain).json();
    expect(asset.overlay.features.length).toBeGreaterThan(0);
    expect(asset.summary.visibleAreaKm2).toBeGreaterThan(100);
    await expect.poll(async () => (await urlState(page)).timeRange, { timeout: 15000 }).toBe('48h');
  });

  test('unknown mission id falls back quietly', async ({ page }) => {
    await page.goto('/?mission=nope');
    await page.waitForSelector('.header-right', { timeout: 120000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('.mission-headline')).toHaveCount(0);
  });
});
