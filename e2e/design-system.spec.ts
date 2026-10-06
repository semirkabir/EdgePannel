import { expect, test } from '@playwright/test';

test.describe('design system', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('worldmonitor-variant', 'full'));
  });

  test('dark tokens come from design-system.css', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.header-right', { timeout: 20000 });
    const t = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg: s.getPropertyValue('--bg').trim(),
        accent: s.getPropertyValue('--accent').trim(),
        body: getComputedStyle(document.body).fontFamily,
      };
    });
    expect(t.bg).toBe('#08090c');
    expect(t.accent).toBe('#ff7a59');
    expect(t.body).toContain('Inter');
  });
});
