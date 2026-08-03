import { strict as assert } from 'node:assert';
import test from 'node:test';
import handler from './user-tier.js';

function makeRequest(headers = {}) {
  return new Request('https://worldmonitor.app/api/user-tier', {
    headers: {
      origin: 'https://worldmonitor.app',
      ...headers,
    },
  });
}

test('returns anonymous metadata without a token', async () => {
  const response = await handler(makeRequest());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.tier, 'anonymous');
  assert.equal(data.mcpEnabled, false);
});

test('accepts x-worldmonitor-token and migrates a legacy Redis-backed tier', async () => {
  const originalFetch = globalThis.fetch;
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.FIREBASE_PROJECT_ID = 'wm-test-app';
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis_token';

  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return new Response(JSON.stringify({
        aud: 'wm-test-app',
        sub: 'user_123',
        expires_in: '3600',
      }), { status: 200 });
    }

    if (String(url).includes('/get/user:user_123:tier')) {
      // Legacy stored value — must migrate up to the current ladder.
      return new Response(JSON.stringify({ result: JSON.stringify('business') }), { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await handler(makeRequest({ 'x-worldmonitor-token': 'firebase_token' }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.tier, 'strategist');
    assert.equal(data.mcpEnabled, true);
  } finally {
    process.env.FIREBASE_PROJECT_ID = originalProjectId;
    process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    globalThis.fetch = originalFetch;
  }
});

test('accepts Authorization bearer tokens for compatibility', async () => {
  const originalFetch = globalThis.fetch;
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.FIREBASE_PROJECT_ID = 'wm-test-app';
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis_token';

  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return new Response(JSON.stringify({
        aud: 'wm-test-app',
        sub: 'user_456',
        expires_in: '3600',
      }), { status: 200 });
    }

    if (String(url).includes('/get/user:user_456:tier')) {
      return new Response(JSON.stringify({ result: JSON.stringify('analyst') }), { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await handler(makeRequest({ authorization: 'Bearer firebase_token_auth_header' }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.tier, 'analyst');
  } finally {
    process.env.FIREBASE_PROJECT_ID = originalProjectId;
    process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    globalThis.fetch = originalFetch;
  }
});

test('returns 401 when token verification fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 401 });

  try {
    const response = await handler(makeRequest({ 'x-worldmonitor-token': 'bad_token' }));
    assert.equal(response.status, 401);
    const data = await response.json();
    assert.equal(data.tier, 'anonymous');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
