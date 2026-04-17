import { test, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

const URL = 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL';
const VALID_PAYLOAD = { chart: { result: [{ meta: { symbol: 'AAPL', regularMarketPrice: 150 } }] } };

const COMMON_OPTS = {
  label: 'AAPL',
  maxRetries: 1,
  retryBaseMs: 10,
  timeoutMs: 1000,
};

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('production defaults: curl leg uses resolveProxy and curlFetch', async () => {
  const { _PROXY_DEFAULTS } = await import('../scripts/_yahoo-fetch.mjs');
  const { resolveProxy, curlFetch } = await import('../scripts/_seed-utils.mjs');
  assert.equal(_PROXY_DEFAULTS.curlProxyResolver, resolveProxy);
  assert.equal(_PROXY_DEFAULTS.curlFetcher, curlFetch);
});

test('production defaults: no CONNECT leg', async () => {
  const { _PROXY_DEFAULTS } = await import('../scripts/_yahoo-fetch.mjs');
  assert.equal(_PROXY_DEFAULTS.connectProxyResolver, undefined);
  assert.equal(_PROXY_DEFAULTS.connectFetcher, undefined);
});

test('200 OK returns parsed JSON without proxy', async () => {
  const { fetchYahooJson } = await import('../scripts/_yahoo-fetch.mjs');
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => VALID_PAYLOAD,
  });

  let proxyCalls = 0;
  const result = await fetchYahooJson(URL, {
    ...COMMON_OPTS,
    _curlProxyResolver: () => 'unused',
    _proxyCurlFetcher: () => { proxyCalls += 1; throw new Error('not reached'); },
  });

  assert.deepEqual(result, VALID_PAYLOAD);
  assert.equal(proxyCalls, 0);
});

test('Retry-After is honored on 429', async () => {
  const { fetchYahooJson } = await import('../scripts/_yahoo-fetch.mjs');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: calls > 1,
      status: calls > 1 ? 200 : 429,
      headers: { get: (name) => name.toLowerCase() === 'retry-after' ? '7' : null },
      json: async () => VALID_PAYLOAD,
    };
  };

  const sleeps = [];
  const result = await fetchYahooJson(URL, {
    ...COMMON_OPTS,
    _curlProxyResolver: () => null,
    _sleep: async (ms) => { sleeps.push(ms); },
  });

  assert.deepEqual(result, VALID_PAYLOAD);
  assert.deepEqual(sleeps, [7000]);
});

test('thrown direct error still falls through to proxy', async () => {
  const { fetchYahooJson } = await import('../scripts/_yahoo-fetch.mjs');
  let directCalls = 0;
  globalThis.fetch = async () => {
    directCalls += 1;
    throw Object.assign(new Error('Connect Timeout Error'), { code: 'UND_ERR_CONNECT_TIMEOUT' });
  };

  let proxyCalls = 0;
  const result = await fetchYahooJson(URL, {
    ...COMMON_OPTS,
    _curlProxyResolver: () => 'user:pass@us.decodo.com:10001',
    _proxyCurlFetcher: () => { proxyCalls += 1; return JSON.stringify(VALID_PAYLOAD); },
  });

  assert.equal(directCalls, 2);
  assert.equal(proxyCalls, 1);
  assert.deepEqual(result, VALID_PAYLOAD);
});

test('malformed proxy JSON does not log success', async () => {
  const { fetchYahooJson } = await import('../scripts/_yahoo-fetch.mjs');
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    headers: { get: () => null },
    json: async () => ({}),
  });

  const logs = [];
  const originalLog = console.log;
  console.log = (msg) => { logs.push(String(msg)); };
  try {
    await assert.rejects(
      () => fetchYahooJson(URL, {
        ...COMMON_OPTS,
        _curlProxyResolver: () => 'user:pass@us.decodo.com:10001',
        _proxyCurlFetcher: () => 'not-valid-json',
      }),
      /Yahoo retries exhausted/,
    );
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.some((l) => l.includes('proxy (curl) succeeded')), false);
});
