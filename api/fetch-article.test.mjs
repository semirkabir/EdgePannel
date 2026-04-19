import assert from 'node:assert/strict';
import test from 'node:test';
import handler, { parseArticleHtml } from './fetch-article.js';

const CLEAN_ARTICLE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Readable Test Story</title>
      <meta property="og:title" content="Readable Test Story" />
      <meta property="og:site_name" content="Example News" />
      <meta property="article:published_time" content="2026-04-18T08:30:00Z" />
      <meta name="author" content="Jane Reporter" />
      <meta property="og:image" content="/images/lead.jpg" />
    </head>
    <body>
      <header>Global header</header>
      <main>
        <article>
          <h1>Readable Test Story</h1>
          <p>This is the lead paragraph with enough substance to look like a proper article and not a navigation label.</p>
          <p>The second paragraph includes <a href="/reporting">linked reporting</a> and a meaningful inline image.</p>
          <figure>
            <img src="/images/body.jpg" width="1200" height="700" />
            <figcaption>Field reporting.</figcaption>
          </figure>
          <div class="related">Related stories that should be removed.</div>
        </article>
        <aside class="sidebar">Sidebar junk that must not appear.</aside>
      </main>
      <footer>Footer noise.</footer>
    </body>
  </html>
`;

const FALLBACK_ARTICLE_HTML = `
  <!doctype html>
  <html>
    <head>
      <title>Fallback Story</title>
      <meta property="og:title" content="Fallback Story" />
      <meta property="og:site_name" content="Fallback Wire" />
      <meta name="author" content="Fallback Author" />
      <meta property="article:published_time" content="2026-04-18T09:45:00Z" />
      <meta property="og:image" content="/images/fallback.jpg" />
    </head>
    <body>
      <div class="newsletter">Subscribe now</div>
      <div>
        <p>Fallback paragraph one keeps enough detail to render a useful in-panel story even when Readability cannot isolate a formal article node.</p>
        <p>Fallback paragraph two adds another block of text so the conservative paragraph mode still feels like a readable article.</p>
      </div>
      <script>window.bad = true;</script>
    </body>
  </html>
`;

const BBC_DUPLICATE_LEAD_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>BBC-style Story</title>
      <meta property="og:title" content="BBC-style Story" />
      <meta property="og:site_name" content="BBC News" />
      <meta property="og:image" content="https://example.com/images/asset-1234567890.jpg" />
    </head>
    <body>
      <main>
        <article>
          <div data-component="image-block">
            <figure>
              <div>
                <p>
                  <img src="https://static.files.bbci.co.uk/grey-placeholder.png" aria-label="image unavailable" />
                  <img src="/images/asset-1234567890.jpg.webp" width="1200" height="700" alt="Lead image" />
                  <span>BBC News</span>
                </p>
              </div>
            </figure>
          </div>
          <div data-component="text-block">
            <p>The lead paragraph has enough content to count as article body text and should remain after cleanup.</p>
          </div>
          <div data-component="text-block">
            <p>A second paragraph ensures Readability keeps the article instead of collapsing it into a stub.</p>
          </div>
          <figure>
            <img src="/images/body.jpg" width="1200" height="700" alt="Body image" />
            <figcaption>Later image stays in the story.</figcaption>
          </figure>
        </article>
      </main>
    </body>
  </html>
`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRequest(articleUrl) {
  return new Request(`https://worldmonitor.app/api/fetch-article?url=${encodeURIComponent(articleUrl)}`, {
    headers: { Origin: 'https://worldmonitor.app' },
  });
}

function makeRedisFetchStub({ articleBodies = {}, articleStatuses = {} } = {}) {
  const store = new Map();
  const counts = new Map();

  return {
    counts,
    store,
    fetch: async (input, init = {}) => {
      const url = String(input);

      if (url === 'https://redis.test/pipeline') {
        return jsonResponse({ result: ['1', 1] });
      }

      if (url.startsWith('https://redis.test/get/')) {
        const key = decodeURIComponent(url.slice('https://redis.test/get/'.length));
        return jsonResponse({ result: store.get(key) ?? null });
      }

      if (url.startsWith('https://redis.test/set/')) {
        const match = url.match(/^https:\/\/redis\.test\/set\/([^/]+)\/([^/]+)/);
        assert.ok(match, `Unexpected Redis SET URL: ${url}`);
        const [, encodedKey, encodedValue] = match;
        const key = decodeURIComponent(encodedKey);
        const value = decodeURIComponent(encodedValue);
        store.set(key, value);
        return jsonResponse({ result: 'OK' });
      }

      counts.set(url, (counts.get(url) || 0) + 1);
      if (url in articleStatuses && articleStatuses[url] !== 200) {
        return new Response('upstream error', { status: articleStatuses[url] });
      }
      if (url in articleBodies) {
        return new Response(articleBodies[url], {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      throw new Error(`Unexpected fetch: ${url} ${init.method || 'GET'}`);
    },
  };
}

test('parseArticleHtml extracts readable content and normalizes URLs', () => {
  const article = parseArticleHtml(CLEAN_ARTICLE_HTML, 'https://example.com/world/story');

  assert.ok(article);
  assert.equal(article.title, 'Readable Test Story');
  assert.equal(article.byline, 'Jane Reporter');
  assert.equal(article.siteName, 'Example News');
  assert.equal(article.publishedTime, '2026-04-18T08:30:00Z');
  assert.equal(article.imageUrl, 'https://example.com/images/lead.jpg');
  assert.match(article.content, /https:\/\/example\.com\/images\/body\.jpg/);
  assert.match(article.content, /https:\/\/example\.com\/reporting/);
  assert.doesNotMatch(article.content, /Sidebar junk/);
  assert.doesNotMatch(article.content, /Related stories/);
});

test('parseArticleHtml falls back to paragraph mode when Readability cannot isolate an article', () => {
  const article = parseArticleHtml(FALLBACK_ARTICLE_HTML, 'https://example.com/fallback/story');

  assert.ok(article);
  assert.equal(article.title, 'Fallback Story');
  assert.equal(article.byline, 'Fallback Author');
  assert.equal(article.siteName, 'Fallback Wire');
  assert.equal(article.imageUrl, 'https://example.com/images/fallback.jpg');
  assert.match(article.content, /Fallback paragraph one keeps enough detail/);
  assert.match(article.content, /Fallback paragraph two adds another block/);
  assert.doesNotMatch(article.content, /Subscribe now/);
  assert.doesNotMatch(article.content, /<script/i);
});

test('parseArticleHtml removes BBC-style placeholder images and duplicated lead media from content', () => {
  const article = parseArticleHtml(BBC_DUPLICATE_LEAD_HTML, 'https://example.com/world/story');

  assert.ok(article);
  assert.equal(article.imageUrl, 'https://example.com/images/asset-1234567890.jpg');
  assert.doesNotMatch(article.content, /grey-placeholder\.png/);
  assert.doesNotMatch(article.content, /Lead image/);
  assert.match(article.content, /The lead paragraph has enough content/);
  assert.match(article.content, /https:\/\/example\.com\/images\/body\.jpg/);
  assert.match(article.content, /Later image stays in the story/);
});

test('handler stores successful article extraction in shared cache and serves cache hits', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const { fetch, counts } = makeRedisFetchStub({
    articleBodies: {
      'https://example.com/story': CLEAN_ARTICLE_HTML,
    },
  });

  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  globalThis.fetch = fetch;

  try {
    const first = await handler(makeRequest('https://example.com/story'));
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstBody.cached, false);
    assert.equal(firstBody.siteName, 'Example News');
    assert.equal(firstBody.publishedTime, '2026-04-18T08:30:00Z');

    const second = await handler(makeRequest('https://example.com/story'));
    const secondBody = await second.json();
    assert.equal(second.status, 200);
    assert.equal(secondBody.cached, true);
    assert.equal(counts.get('https://example.com/story'), 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

test('handler negative-caches upstream failures to avoid repeated article fetches', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const { fetch, counts } = makeRedisFetchStub({
    articleStatuses: {
      'https://example.com/bad-story': 500,
    },
  });

  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  globalThis.fetch = fetch;

  try {
    const first = await handler(makeRequest('https://example.com/bad-story'));
    assert.equal(first.status, 500);

    const second = await handler(makeRequest('https://example.com/bad-story'));
    const secondBody = await second.json();
    assert.equal(second.status, 502);
    assert.equal(secondBody.cached, true);
    assert.equal(counts.get('https://example.com/bad-story'), 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});
