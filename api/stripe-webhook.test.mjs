import { strict as assert } from 'node:assert';
import test from 'node:test';
import handler from './stripe-webhook.js';

async function computeSignature(secret, payload, timestamp) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

async function makeSignedRequest(body, signature) {
  return new Request('https://worldmonitor.app/api/stripe-webhook', {
    method: 'POST',
    headers: {
      origin: 'https://worldmonitor.app',
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });
}

test('rejects invalid Stripe signatures', async () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  try {
    const response = await handler(await makeSignedRequest(JSON.stringify({ type: 'checkout.session.completed' }), 't=1,v1=bad'));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid Stripe signature' });
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  }
});

test('ignores unrelated Stripe events', async () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  const payload = JSON.stringify({ type: 'customer.created', data: { object: {} } });
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = await computeSignature('whsec_test', payload, timestamp);

  try {
    const response = await handler(await makeSignedRequest(payload, signature));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true, ignored: true });
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  }
});

test('processes checkout.session.completed by updating Redis and Convex', async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalConvexUrl = process.env.CONVEX_URL;
  const originalConvexToken = process.env.CONVEX_ADMIN_TOKEN;

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis_token';
  process.env.CONVEX_URL = 'https://convex.test';
  process.env.CONVEX_ADMIN_TOKEN = 'convex_token';

  const fetchCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    if (String(url).startsWith('https://redis.test/set/user:user_123:tier/')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (String(url) === 'https://convex.test/api/mutation') {
      return new Response(JSON.stringify({ status: 'upgraded' }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const payload = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: 'user_123',
        metadata: { firebaseUid: 'user_123', tier: 'pro' },
      },
    },
  });
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = await computeSignature('whsec_test', payload, timestamp);

  try {
    const response = await handler(await makeSignedRequest(payload, signature));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.processed, true);
    assert.equal(data.firebaseUid, 'user_123');
    assert.equal(data.tier, 'pro');
    assert.equal(fetchCalls.length, 2);
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    process.env.CONVEX_URL = originalConvexUrl;
    process.env.CONVEX_ADMIN_TOKEN = originalConvexToken;
    globalThis.fetch = originalFetch;
  }
});

test('treats duplicate successful webhook deliveries as safe replays', async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis_token';
  delete process.env.CONVEX_URL;
  delete process.env.CONVEX_ADMIN_TOKEN;

  let redisWrites = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://redis.test/set/user:user_789:tier/')) {
      redisWrites += 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const payload = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        metadata: { firebaseUid: 'user_789', tier: 'business' },
      },
    },
  });
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = await computeSignature('whsec_test', payload, timestamp);

  try {
    const first = await handler(await makeSignedRequest(payload, signature));
    const second = await handler(await makeSignedRequest(payload, signature));
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(redisWrites, 2);
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
    globalThis.fetch = originalFetch;
  }
});
