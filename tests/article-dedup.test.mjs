/**
 * Tests for article content deduplication and image stripping logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleHtml } from '../api/fetch-article.js';

function doc(body) {
  return `<!DOCTYPE html><html><head><title>Test Article</title></head><body>${body}</body></html>`;
}

describe('stripDuplicateLeadImage', () => {
  const baseUrl = 'https://www.npr.org/2026/04/21/story';
  const heroUrl = 'https://media.npr.org/assets/img/2026/04/21/hero-image.jpg';

  it('removes a single duplicate lead image before the first paragraph', () => {
    const html = doc(`
      <article>
        <img src="${heroUrl}" width="800" height="600" />
        <p>This is the lead paragraph with enough text to count as meaningful content for the article body.</p>
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    `);
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(!article.content.includes(heroUrl), 'hero image should be stripped from content');
    assert(article.content.includes('lead paragraph'), 'text content should remain');
  });

  it('removes ALL responsive variants of the same hero image (NPR-like picture wrappers)', () => {
    const variant1 = 'https://media.npr.org/assets/img/2026/04/21/hero-image.jpg?width=1000';
    const variant2 = 'https://media.npr.org/assets/img/2026/04/21/hero-image.jpg?width=500';
    const html = doc(`
      <article>
        <picture>
          <source srcset="${variant1}">
          <img src="${variant2}" width="800" height="600" />
        </picture>
        <p>This is the lead paragraph with enough text to count as meaningful content here and there.</p>
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    `);
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(!article.content.includes('hero-image.jpg'), 'all hero variants should be stripped');
    assert(article.content.includes('lead paragraph'), 'text content should remain');
  });

  it('removes figure-wrapped duplicate hero images', () => {
    const html = doc(`
      <article>
        <figure>
          <img src="${heroUrl}" width="800" height="600" />
          <figcaption>Caption for the hero image</figcaption>
        </figure>
        <p>This is the lead paragraph with enough text to count as meaningful content for the article body.</p>
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    `);
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(!article.content.includes(heroUrl), 'hero image inside figure should be stripped');
    assert(!article.content.includes('Caption for the hero'), 'caption should also be removed');
  });

  it('strips CDN resize suffixes when matching (e.g. -w800, _640x360)', () => {
    const resized = 'https://media.npr.org/assets/img/2026/04/21/hero-image-w800.jpg';
    const html = doc(`
      <article>
        <img src="${resized}" width="800" height="600" />
        <p>This is the lead paragraph with enough text to count as meaningful content for the article body.</p>
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    `);
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(!article.content.includes('hero-image'), 'resized variant should be stripped');
  });

  it('does NOT remove images that appear AFTER the first meaningful paragraph', () => {
    const bodyImage = 'https://media.npr.org/assets/img/2026/04/21/body-image.jpg';
    const html = doc(`
      <article>
        <p>This is the lead paragraph with enough text to count as meaningful content for the article body.</p>
        <img src="${bodyImage}" width="800" height="600" />
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    `);
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(article.content.includes(bodyImage), 'body image after first paragraph should remain');
  });

  it('does NOT remove images that do not match the hero URL', () => {
    const otherImage = 'https://media.npr.org/assets/img/2026/04/21/different-photo.jpg';
    const heroMeta = 'https://media.npr.org/assets/img/2026/04/21/hero-image.jpg';
    const html = `<!DOCTYPE html><html><head><title>Test Article</title><meta property="og:image" content="${heroMeta}"></head><body>
      <article>
        <img src="${otherImage}" width="800" height="600" />
        <p>This is the lead paragraph with enough text to count as meaningful content for the article body.</p>
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    </body></html>`;
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(article.content.includes(otherImage), 'non-matching image should remain');
    assert(!article.content.includes(heroMeta), 'hero image should not appear in content');
  });

  it('cleans up empty picture wrappers after removing the img', () => {
    const html = doc(`
      <article>
        <picture>
          <source srcset="${heroUrl}?width=800" type="image/webp">
          <img src="${heroUrl}?width=400" width="800" height="600" />
        </picture>
        <p>This is the lead paragraph with enough text to count as meaningful content for the article body.</p>
        <p>Second paragraph with additional text here to ensure we meet the minimum content length threshold.</p>
      </article>
    `);
    const article = parseArticleHtml(html, baseUrl);
    assert(article, 'should parse successfully');
    assert(!article.content.includes('<picture'), 'empty picture wrapper should be removed');
  });
});
