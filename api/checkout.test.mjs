import { strict as assert } from 'node:assert';
import test from 'node:test';
import handler from './checkout.js';

function makeRequest(query = '') {
  return new Request(`https://edgepannel.app/api/checkout${query}`, {
    headers: { origin: 'https://edgepannel.app' },
  });
}

function makeAuthedRequest(query = '') {
  return new Request(`https://edgepannel.app/api/checkout${query}`, {
    headers: { origin: 'https://edgepannel.app', 'x-edgepannel-token': 'id-token-user-123' },
  });
}

function makeTokenInfoResponse() {
  return new Response(JSON.stringify({ sub: 'user_123', email: 'user@example.test', email_verified: 'true', expires_in: 3600 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('rejects invalid subscription tiers', async () => {
  const response = await handler(makeRequest('?tier=unknown&uid=user_123'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid tier' });
});

test('requires a uid for self-serve tiers', async () => {
  const response = await handler(makeRequest('?tier=analyst'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Missing uid parameter' });
});

test('rejects the retired enterprise tier', async () => {
  const response = await handler(makeRequest('?tier=enterprise&uid=user_123'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid tier' });
});

test('returns 503 when Stripe is not configured', async () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  delete process.env.STRIPE_SECRET_KEY;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) return makeTokenInfoResponse();
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const response = await handler(makeAuthedRequest('?tier=analyst&uid=user_123'));
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.error, 'Stripe is not configured');
  } finally {
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
    globalThis.fetch = originalFetch;
  }
});

test('creates a Stripe checkout session and redirects to the hosted URL', async () => {
  const originalFetch = globalThis.fetch;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  const fetchCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) return makeTokenInfoResponse();
    return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.test/session' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await handler(makeAuthedRequest('?tier=analyst&uid=user_123'));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), 'https://checkout.stripe.test/session');
    const stripeCall = fetchCalls.find(call => call.url === 'https://api.stripe.com/v1/checkout/sessions');
    assert.ok(stripeCall);
    assert.equal(stripeCall.init.headers.Authorization, 'Bearer sk_test_123');

    const body = String(stripeCall.init.body);
    assert.match(body, /metadata%5BfirebaseUid%5D=user_123/);
    assert.match(body, /metadata%5Btier%5D=analyst/);
    assert.match(body, /success_url=https%3A%2F%2Fedgepannel\.app%2Fapp%3Fcheckout%3Dsuccess%26tier%3Danalyst/);
    assert.match(body, /cancel_url=https%3A%2F%2Fedgepannel\.app%2Fpricing%3Fcheckout%3Dcanceled/);
  } finally {
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
    globalThis.fetch = originalFetch;
  }
});
