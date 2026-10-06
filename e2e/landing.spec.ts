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
    await expect(page.locator('.lp-h1')).toContainText('The whole world, live on one map.');
    await expect(page.locator('.lp-hero-ctas a[href="/app"]')).toBeVisible();
    await expect(page.locator('.lp-hero-stats div')).toHaveCount(3);
  });

  test('renders hero live-proof strip and product card', async ({ page }) => {
    await expect(page.locator('.lp-hero-product img')).toBeVisible();
    // The strip either resolves to real numbers or hides itself entirely —
    // it never stays stuck on placeholders.
    const strip = page.locator('#hero-proof');
    await expect
      .poll(async () => {
        if (await strip.isHidden()) return 'hidden';
        const score = await page
          .locator('[data-widget="hero-pulse"] [data-slot="score"]')
          .innerText();
        return score !== '–' ? 'resolved' : 'pending';
      }, { timeout: 20000 })
      .not.toBe('pending');
  });

  test('renders workflows section with four jobs', async ({ page }) => {
    await expect(page.locator('#workflows')).toBeAttached();
    await expect(page.locator('.lp-flow')).toHaveCount(4);
    await expect(page.locator('.lp-flow').first()).toContainText('See the world move');
  });

  test('renders all six sections and footer', async ({ page }) => {
    for (const id of ['hero', 'live', 'product', 'who', 'faq', 'launch']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator('.lp-footer')).toBeVisible();
    for (const href of ['/roadmap', '/feature-request', '/terms']) {
      await expect(page.locator(`.lp-footer a[href="${href}"]`)).toBeVisible();
    }
  });

  test('public resource pages render their own content', async ({ page }) => {
    for (const resource of [
      { path: '/roadmap.html', heading: 'Build the signal.' },
      { path: '/feature-request.html', heading: 'Start with the problem.' },
      { path: '/terms.html', heading: 'The terms,' },
      { path: '/data-sources.html', heading: 'Every source,' },
      { path: '/downloads.html', heading: 'Run the map' },
    ]) {
      await page.goto(resource.path);
      await expect(page.locator('h1')).toContainText(resource.heading);
      await expect(page.locator('.lp-footer a[href="/app"]')).toBeVisible();
    }
  });


  test('live widgets resolve to live or sample rows', async ({ page }) => {
    await page.locator('#live').scrollIntoViewIfNeeded();
    // Every widget must leave its "Connecting…" state one way or another.
    for (const widget of ['markets', 'quakes', 'signals', 'fx']) {
      const rows = page.locator(`[data-widget="${widget}"] [data-slot="rows"] li`);
      await expect(rows.first()).not.toContainText('Connecting', { timeout: 30000 });
    }
  });

  test('source belt renders counter-moving rows', async ({ page }) => {
    await page.locator('#live').scrollIntoViewIfNeeded();
    const rows = page.locator('.lp-belt-row');
    await expect(rows).toHaveCount(5);
    // Odd rows are flagged to run the opposite way; both directions must exist.
    await expect(page.locator('.lp-belt-row[data-dir="ltr"]').first()).toBeAttached();
    await expect(page.locator('.lp-belt-row[data-dir="rtl"]').first()).toBeAttached();
    await expect(page.locator('.lp-tick').first()).toBeVisible();
    await expect(page.locator('.lp-belt a[href="/data-sources"]')).toBeVisible();
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

test.describe('data sources catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/data-sources.html');
  });

  test('renders the generated catalog with counts and category groups', async ({ page }) => {
    await expect(page.locator('[data-stat="total"]')).not.toHaveText('—');
    const total = Number(await page.locator('[data-stat="total"]').innerText());
    expect(total).toBeGreaterThan(400);
    await expect(page.locator('.lp-src')).toHaveCount(total);
    await expect(page.locator('.lp-src-group').first()).toBeVisible();
  });

  test('search and category chips narrow the list', async ({ page }) => {
    await page.locator('[data-slot="search"]').fill('reuters');
    await expect(page.locator('.lp-src')).not.toHaveCount(0);
    await expect(page.locator('.lp-src-name').first()).toContainText(/reuters/i);

    await page.locator('[data-slot="search"]').fill('');
    await page.locator('.lp-chip[data-group="hazards"]').click();
    await expect(page.locator('.lp-src-group')).toHaveCount(1);
    await expect(page.locator('.lp-src-group')).toHaveAttribute('data-cat', 'hazards');

    await page.locator('[data-slot="search"]').fill('zzzzzz-no-such-source');
    await expect(page.locator('[data-slot="empty"]')).toBeVisible();
  });
});

test.describe('downloads page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/downloads.html');
  });

  test('offers every desktop build through the release redirect', async ({ page }) => {
    // Apple silicon only — there is no Intel macOS build.
    for (const platform of [
      'macos-arm64',
      'windows-exe',
      'windows-msi',
      'linux-appimage',
      'linux-appimage-arm64',
    ]) {
      await expect(page.locator(`.lp-dl-grid a[data-platform="${platform}"]`)).toHaveAttribute(
        'href',
        `/api/download?platform=${platform}&variant=full`
      );
    }
    await expect(page.locator('.lp-dl-grid a[data-platform="macos-x64"]')).toHaveCount(0);
  });

  test('edition switch repoints every download link', async ({ page }) => {
    await page.locator('[data-edition="tech"]').click();
    await expect(page.locator('.lp-dl-grid a[data-platform="macos-arm64"]')).toHaveAttribute(
      'href',
      '/api/download?platform=macos-arm64&variant=tech'
    );
    await expect(page.locator('.lp-dl-grid a[data-platform="linux-appimage"]')).toHaveAttribute(
      'href',
      '/api/download?platform=linux-appimage&variant=tech'
    );

    await page.locator('[data-edition="conflicts"]').click();
    await expect(page.locator('.lp-dl-grid a[data-platform="windows-msi"]')).toHaveAttribute(
      'href',
      '/api/download?platform=windows-msi&variant=conflicts'
    );
  });

  test('mobile section promises no store link it cannot honour', async ({ page }) => {
    await expect(page.locator('#mobile .lp-status').first()).toContainText('In development');
    await expect(page.locator('a[href*="apps.apple.com"]')).toHaveCount(0);
    await expect(page.locator('a[href*="play.google.com"]')).toHaveCount(0);
  });
});
