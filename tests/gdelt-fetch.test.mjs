import { test, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

const URL = 'https://api.gdeltproject.org/api/v2/doc/doc?query=climate&mode=ArtList&format=json';
const VALID_PAYLOAD = { articles: [{ url: 'https://example.com/x', title: 'foo' }] };

const COMMON_OPTS = {
  label: 'climate',
  maxRetries: 1,
  retryBaseMs: 10,
  timeoutMs: 1000,
  proxyMaxAttempts: 3,
  proxyRetryBaseMs: 10,
};

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('production defaults: curl leg uses resolveProxy and curlFetch', async () => {
  const { _PROXY_DEFAULTS } = await import('../scripts/_gdelt-fetch.mjs');
  const { resolveProxy, curlFetch } = await import('../scripts/_seed-utils.mjs');
  assert.equal(_PROXY_DEFAULTS.curlProxyResolver, resolveProxy);
  assert.equal(_PROXY_DEFAULTS.curlFetcher, curlFetch);
});

test('direct parse failure falls through to proxy', async () => {
  const { fetchGdeltJson } = await import('../scripts/_gdelt-fetch.mjs');
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
  });

  let proxyCalls = 0;
  const result = await fetchGdeltJson(URL, {
    ...COMMON_OPTS,
    maxRetries: 0,
    _curlProxyResolver: () => 'user:pass@us.decodo.com:10001',
    _proxyCurlFetcher: () => { proxyCalls += 1; return JSON.stringify(VALID_PAYLOAD); },
  });

  assert.equal(proxyCalls, 1);
  assert.deepEqual(result, VALID_PAYLOAD);
});

test('proxy timeout retries and succeeds', async () => {
  const { fetchGdeltJson } = await import('../scripts/_gdelt-fetch.mjs');
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: () => null },
    json: async () => ({}),
  });

  let proxyCalls = 0;
  const result = await fetchGdeltJson(URL, {
    ...COMMON_OPTS,
    _curlProxyResolver: () => 'user:pass@us.decodo.com:10001',
    _proxyCurlFetcher: () => {
      proxyCalls += 1;
      if (proxyCalls === 1) throw Object.assign(new Error('curl timeout'), { code: 'ETIMEDOUT' });
      return JSON.stringify(VALID_PAYLOAD);
    },
  });

  assert.equal(proxyCalls, 2);
  assert.deepEqual(result, VALID_PAYLOAD);
});

test('non-retryable proxy parse failure bails immediately', async () => {
  const { fetchGdeltJson } = await import('../scripts/_gdelt-fetch.mjs');
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: () => null },
    json: async () => ({}),
  });

  let proxyCalls = 0;
  await assert.rejects(
    () => fetchGdeltJson(URL, {
      ...COMMON_OPTS,
      proxyMaxAttempts: 5,
      _curlProxyResolver: () => 'user:pass@us.decodo.com:10001',
      _proxyCurlFetcher: () => {
        proxyCalls += 1;
        return 'not-valid-json';
      },
    }),
    /GDELT retries exhausted/,
  );

  assert.equal(proxyCalls, 1);
});
