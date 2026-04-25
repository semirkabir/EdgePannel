import { strict as assert } from 'node:assert';
import test from 'node:test';
import handler from './checkout.js';

function makeRequest(query = '') {
  return new Request(`https://worldmonitor.app/api/checkout${query}`, {
    headers: { origin: 'https://worldmonitor.app' },
  });
}

test('rejects invalid subscription tiers', async () => {
  const response = await handler(makeRequest('?tier=unknown&uid=user_123'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid tier' });
});

test('requires a uid for self-serve tiers', async () => {
  const response = await handler(makeRequest('?tier=pro'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Missing uid parameter' });
});

test('redirects enterprise requests to contact sales', async () => {
  const response = await handler(makeRequest('?tier=enterprise&uid=user_123'));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'mailto:sales@worldmonitor.app?subject=Enterprise%20Inquiry');
});

test('returns 503 when Stripe is not configured', async () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;

  try {
    const response = await handler(makeRequest('?tier=pro&uid=user_123'));
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.error, 'Stripe is not configured');
  } finally {
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
  }
});

test('creates a Stripe checkout session and redirects to the hosted URL', async () => {
  const originalFetch = globalThis.fetch;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  const fetchCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.test/session' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await handler(makeRequest('?tier=pro&uid=user_123'));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://checkout.stripe.test/session');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(fetchCalls[0].init.headers.Authorization, 'Bearer sk_test_123');

    const body = String(fetchCalls[0].init.body);
    assert.match(body, /metadata%5BfirebaseUid%5D=user_123/);
    assert.match(body, /metadata%5Btier%5D=pro/);
    assert.match(body, /success_url=https%3A%2F%2Fworldmonitor\.app%2F%3Fcheckout%3Dsuccess%26tier%3Dpro/);
    assert.match(body, /cancel_url=https%3A%2F%2Fworldmonitor\.app%2F%3Fcheckout%3Dcanceled/);
  } finally {
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
    globalThis.fetch = originalFetch;
  }
});
