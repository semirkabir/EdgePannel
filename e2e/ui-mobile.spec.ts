import { expect, test } from '@playwright/test';

test.describe('mobile UI (390px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('.hamburger-btn', { timeout: 20000 });
    await page.waitForTimeout(800);
  });

  test('help sheet does not auto-open but stays reachable from the menu', async ({ page }) => {
    await expect(page.locator('#mobileHelpOverlay')).not.toHaveClass(/open/);
    await expect(page.locator('#mobileHelpOverlay')).toBeHidden();

    // The hamburger exists before its handler is bound; retry until the menu opens.
    await expect(async () => {
      await page.locator('.hamburger-btn').click();
      await expect(page.locator('#mobileMenu')).toHaveClass(/open/, { timeout: 1500 });
    }).toPass({ timeout: 30000 });
    await page.locator('#mobileMenuHelp').click();
    await expect(page.locator('#mobileHelpOverlay')).toHaveClass(/open/);
    await expect(page.locator('#mobileHelpSheet')).toContainText('search icon in the header');
    await expect(page.locator('#mobileHelpSheet')).not.toContainText('floating search button');
  });

  test('time range scrolls instead of clipping the last option', async ({ page }) => {
    const m = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('.deckgl-time-slider');
      const opts = bar?.querySelector<HTMLElement>('.time-options');
      if (!bar || !opts) return null;
      const scroller = [opts, bar].find((el) => el.scrollWidth > el.clientWidth + 1) ?? null;
      const overflowing = [opts, bar].some((el) => el.scrollWidth > el.clientWidth + 1);
      const scrollable = [opts, bar].some((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1);
      const barRect = bar.getBoundingClientRect();
      return { overflowing, scrollable, hasScroller: !!scroller, right: barRect.right, vw: innerWidth };
    });
    expect(m).not.toBeNull();
    expect(m!.right).toBeLessThanOrEqual(m!.vw);
    // If the options overflow, some ancestor in the bar must scroll (not clip).
    if (m!.overflowing) expect(m!.scrollable).toBe(true);

    // The last time button ('All') can be scrolled into view.
    const allBtn = page.locator('.deckgl-time-slider .time-btn[data-range="all"]');
    if (await allBtn.count()) {
      await allBtn.scrollIntoViewIfNeeded();
      const box = await allBtn.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1);
    }
  });

  test('no horizontal page overflow; map controls and layers toggle are 44px targets', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);

    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.deckgl-controls .map-btn, .layers-toggle-btn'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0 && r.top < innerHeight;
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { cls: el.className, w: r.width, h: r.height };
        }),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) {
      expect(Math.min(s.w, s.h), s.cls).toBeGreaterThanOrEqual(44);
    }
  });

  test('map canvas occupies a meaningful share of the first viewport', async ({ page }) => {
    const share = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#deckgl-basemap, .deckgl-map-wrapper, .map-section, #mapContainer');
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const visibleH = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      return (visibleH * Math.min(r.width, innerWidth)) / (innerHeight * innerWidth);
    });
    expect(share).toBeGreaterThan(0.3);
  });
});
