import { expect, test } from '@playwright/test';

test('right-panel article reader renders clean title, credits, images, and sanitized content', async ({ page }) => {
  await page.route('**/api/fetch-article?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'Readable Test Story',
        byline: 'Jane Reporter',
        siteName: 'Example News',
        publishedTime: '2026-04-18T08:30:00Z',
        imageUrl: 'https://example.com/images/lead.jpg',
        url: 'https://example.com/story',
        cached: false,
        content: `
          <div>
            <p>Lead paragraph for the article reader.</p>
            <aside>Sidebar junk that must be removed.</aside>
            <p>Second paragraph with <a href="https://example.com/reporting">source reporting</a>.</p>
            <img src="https://example.com/images/body.jpg" width="1200" height="700" />
          </div>
        `,
      }),
    });
  });

  await page.goto('/tests/runtime-harness.html');

  await page.evaluate(async () => {
    const { EntityDetailPanel } = await import('/src/components/EntityDetailPanel.ts');
    const { ArticleRenderer } = await import('/src/components/entity-detail/renderers/article.ts');

    const panel = new EntityDetailPanel({ article: new ArticleRenderer() });
    panel.show('article', {
      url: 'https://example.com/story',
      title: 'Clicked Title',
      source: 'Example News',
      publishedAt: '2026-04-18T08:30:00Z',
    });

    (window as Window & { __articlePanel?: unknown }).__articlePanel = panel;
  });

  await expect(page.locator('.edp-article-title')).toHaveText('Readable Test Story');
  await expect(page.locator('.edp-article-source')).toHaveText('Example News');
  await expect(page.locator('.edp-article-header-credit')).toHaveText('Jane Reporter');
  await expect(page.locator('.edp-article-header-date')).toContainText('Apr');
  await expect(page.locator('.edp-article-hero-img')).toHaveAttribute('src', 'https://example.com/images/lead.jpg');
  await expect(page.locator('.edp-article-content')).toContainText('Lead paragraph for the article reader.');
  await expect(page.locator('.edp-article-content')).toContainText('Second paragraph with source reporting.');
  await expect(page.locator('.edp-article-content')).not.toContainText('Sidebar junk that must be removed.');
  await expect(page.locator('.edp-article-content a')).toHaveAttribute('href', 'https://example.com/reporting');
  await expect(page.locator('.edp-article-content img')).toHaveAttribute('src', 'https://example.com/images/body.jpg');
  await expect(page.locator('.edp-article-header .edp-article-open-original')).toHaveAttribute('href', 'https://example.com/story');
});
