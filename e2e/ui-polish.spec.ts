import { expect, test } from '@playwright/test';

test.describe('UI polish guardrails', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('worldmonitor-variant', 'full');
      localStorage.removeItem('wm-settings-open');
    });
  });

  test('desktop header keeps secondary actions in an accessible overflow menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.header-right', { timeout: 20000 });

    await expect(page.locator('.header-live-actions')).toBeVisible();
    await expect(page.locator('#searchBtn')).toBeVisible();
    await expect(page.locator('#headerOverflowMenu')).toBeVisible();
    // 'More dashboard actions' labels the menu panel, which is a closed <details>
    // body (hidden by design) until the summary ('More actions') is clicked.
    await expect(page.locator('#headerOverflowMenu summary')).toBeVisible();
    await expect(page.getByLabel('More dashboard actions')).toBeHidden();

    await page.locator('#headerOverflowMenu summary').click();
    await expect(page.locator('#headerOverflowPanel')).toBeVisible();
    await expect(page.getByLabel('More dashboard actions')).toBeVisible();
    // Scope to the menu: the (hidden) settings modal also carries a SETTINGS label.
    await expect(page.locator('#headerOverflowPanel').getByLabel(/settings/i)).toBeVisible();
  });

  test('mobile critical controls avoid horizontal page overflow and keep touch-sized targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('.hamburger-btn', { timeout: 20000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);

    const targetMetrics = await page.evaluate(() => {
      const selectors = ['.hamburger-btn', '.map-btn', '.time-btn', '.layers-toggle-btn'];
      return selectors.flatMap((selector) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return style.display !== 'none' && rect.width > 0 && rect.height > 0 && rect.top < innerHeight;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { selector, width: rect.width, height: rect.height, label: element.getAttribute('aria-label') || element.textContent?.trim() || '' };
          }),
      );
    });

    expect(targetMetrics.length).toBeGreaterThan(0);
    for (const target of targetMetrics) {
      expect(Math.min(target.width, target.height), `${target.selector} ${target.label}`).toBeGreaterThanOrEqual(32);
    }
  });

  test('layer tray exposes named controls for keyboard and screen-reader users', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#layersToggleBtn', { timeout: 20000 });
    if ((await page.locator('#layersToggleBtn').getAttribute('aria-expanded')) !== 'true') {
      await page.locator('#layersToggleBtn').click();
    }

    await expect(page.locator('#layersPanel[role="region"]')).toBeVisible();
    await expect(page.getByLabel('Search layers')).toBeVisible();

    const unnamedInputs = await page.locator('#layersPanel input:not([aria-label])').count();
    expect(unnamedInputs).toBe(0);
  });
});
