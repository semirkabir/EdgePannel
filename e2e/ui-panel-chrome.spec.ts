import { expect, test } from '@playwright/test';

test.describe('Phase 3: panel chrome', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('worldmonitor-variant', 'full');
    });
  });

  test('selected time range uses accent, not green', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.time-btn.active').first();
    await btn.waitFor({ state: 'attached', timeout: 20000 });
    expect(await btn.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 122, 89)');
  });

  test('panel header is flat: no gradient, no blur, no accent bars', async ({ page }) => {
    await page.goto('/');
    const h = page.locator('.panel-header').first();
    await h.waitFor({ state: 'attached', timeout: 20000 });
    const s = await h.evaluate((e) => {
      const cs = getComputedStyle(e);
      return {
        bg: cs.backgroundImage,
        blur: cs.backdropFilter,
        before: getComputedStyle(e, '::before').content,
        after: getComputedStyle(e, '::after').content,
      };
    });
    expect(s.bg).toBe('none');
    expect(s.blur).toBe('none');
    expect(s.before).toBe('none');
    expect(s.after).toBe('none');
  });

  test('panel title is sentence case, action icons reveal on hover', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.panel', { has: page.locator('.panel-header-actions button') }).first();
    await panel.waitFor({ state: 'attached', timeout: 20000 });
    await panel.scrollIntoViewIfNeeded();
    const title = panel.locator('.panel-title').first();
    expect(await title.evaluate((e) => getComputedStyle(e).textTransform)).toBe('none');

    const btn = panel.locator('.panel-header-actions button').first();
    await page.mouse.move(0, 0);
    await expect.poll(() => btn.evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
    // Hover the header: some panels (live video) are covered by an iframe.
    await panel.locator('.panel-header').first().hover();
    await expect.poll(() => btn.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  });
});
