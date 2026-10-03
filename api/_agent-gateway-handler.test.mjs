import { strict as assert } from 'node:assert';
import test, { beforeEach, afterEach } from 'node:test';
import handler from './_agent-gateway-handler.js';
import { resetAgentRateLimitState, getAgentRateLimits } from './_agent-gateway-guard.js';

const ORIGIN = 'https://edgepannel.com';
const LLM_ENDPOINT = 'https://llm.gate.test/v1';
const ENV_KEYS = [
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'FIREBASE_PROJECT_ID',
  'AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE', 'AGENT_GATEWAY_RATE_LIMIT_PER_DAY',
];
let savedEnv;
let savedFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  // Force the in-memory fallback limiter (no Upstash in tests).
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE;
  delete process.env.AGENT_GATEWAY_RATE_LIMIT_PER_DAY;
  savedFetch = globalThis.fetch;
  resetAgentRateLimitState();
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  globalThis.fetch = savedFetch;
});

const fakeVerify = async token => (token.startsWith('good-') ? { uid: token.slice(5) } : null);

function chatRequest(headers = {}) {
  return new Request(`${ORIGIN}/api/agent-gateway/chat`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      connectorId: 'web-llm',
      connectors: [{ id: 'web-llm', name: 'Web', type: 'openai-compatible', endpoint: LLM_ENDPOINT, model: 'm', scopes: ['intelligence'], enabled: true }],
      messages: [{ role: 'user', content: 'hello' }],
    }),
  });
}

function stubLlm() {
  let calls = 0;
  globalThis.fetch = async (url) => {
    if (!String(url).startsWith(LLM_ENDPOINT)) throw new Error(`Unexpected fetch: ${url}`);
    calls++;
    return new Response(JSON.stringify({ model: 'm', choices: [{ message: { role: 'assistant', content: 'hi there' } }] }), { status: 200 });
  };
  return () => calls;
}

test('chat without a token is 401 with a sign-in code and never reaches the LLM', async () => {
  const calls = stubLlm();
  const res = await handler(chatRequest(), { verifyToken: fakeVerify });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'auth_required');
  assert.match(body.error, /Sign in/);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(calls(), 0);
});

test('chat with an invalid token is 401 auth_invalid', async () => {
  const calls = stubLlm();
  const res = await handler(chatRequest({ authorization: 'Bearer bad-token' }), { verifyToken: fakeVerify });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'auth_invalid');
  assert.equal(calls(), 0);
});

test('mcp and test-connector are gated; status stays public', async () => {
  const mcp = await handler(new Request(`${ORIGIN}/api/agent-gateway/mcp`, {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  }), { verifyToken: fakeVerify });
  assert.equal(mcp.status, 401);

  const mcpGet = await handler(new Request(`${ORIGIN}/api/agent-gateway/mcp`, { headers: { origin: ORIGIN } }), { verifyToken: fakeVerify });
  assert.equal(mcpGet.status, 401);

  const tc = await handler(new Request(`${ORIGIN}/api/agent-gateway/test-connector`, {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{}',
  }), { verifyToken: fakeVerify });
  assert.equal(tc.status, 401);

  const status = await handler(new Request(`${ORIGIN}/api/agent-gateway/status`, { headers: { origin: ORIGIN } }), { verifyToken: fakeVerify });
  assert.equal(status.status, 200);

  const mcpAuthed = await handler(new Request(`${ORIGIN}/api/agent-gateway/mcp`, {
    method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-edgepannel-token': 'good-u9' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  }), { verifyToken: fakeVerify });
  assert.equal(mcpAuthed.status, 200);
  assert.ok(Array.isArray((await mcpAuthed.json()).result.tools));
});

test('chat with a valid token (Bearer or x-edgepannel-token) returns 200', async () => {
  const calls = stubLlm();
  const res = await handler(chatRequest({ authorization: 'Bearer good-alice' }), { verifyToken: fakeVerify });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).content, 'hi there');
  const res2 = await handler(chatRequest({ 'x-edgepannel-token': 'good-alice' }), { verifyToken: fakeVerify });
  assert.equal(res2.status, 200);
  assert.equal(calls(), 2);
});

test('default verifier is the shared Firebase tokeninfo check from _subscription.js', async () => {
  process.env.FIREBASE_PROJECT_ID = 'ep-test';
  let tokeninfoCalls = 0;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      tokeninfoCalls++;
      return new Response(JSON.stringify({ aud: 'ep-test', sub: 'firebase-uid-1', expires_in: '3600' }), { status: 200 });
    }
    if (href.startsWith(LLM_ENDPOINT)) {
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };
  const res = await handler(chatRequest({ authorization: 'Bearer real-looking-token-for-default-verifier' }));
  assert.equal(res.status, 200);
  assert.equal(tokeninfoCalls, 1);
});

test('per-user minute limit returns 429 with Retry-After; other users unaffected', async () => {
  process.env.AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE = '3';
  stubLlm();
  let t = 1_000_000;
  const deps = { verifyToken: fakeVerify, now: () => t };
  for (let i = 0; i < 3; i++) {
    const ok = await handler(chatRequest({ authorization: 'Bearer good-bob' }), deps);
    assert.equal(ok.status, 200, `request ${i + 1}`);
  }
  const limited = await handler(chatRequest({ authorization: 'Bearer good-bob' }), deps);
  assert.equal(limited.status, 429);
  const body = await limited.json();
  assert.equal(body.code, 'rate_limited');
  assert.equal(body.scope, 'minute');
  assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  assert.equal(limited.headers.get('access-control-allow-origin'), ORIGIN);

  const carol = await handler(chatRequest({ authorization: 'Bearer good-carol' }), deps);
  assert.equal(carol.status, 200);

  t += 61_000; // next minute window
  const again = await handler(chatRequest({ authorization: 'Bearer good-bob' }), deps);
  assert.equal(again.status, 200);
});

test('per-user daily cap applies across minute windows', async () => {
  process.env.AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE = '100';
  process.env.AGENT_GATEWAY_RATE_LIMIT_PER_DAY = '2';
  stubLlm();
  let t = 5_000_000;
  const deps = { verifyToken: fakeVerify, now: () => t };
  assert.equal((await handler(chatRequest({ authorization: 'Bearer good-dan' }), deps)).status, 200);
  t += 120_000;
  assert.equal((await handler(chatRequest({ authorization: 'Bearer good-dan' }), deps)).status, 200);
  t += 120_000;
  const res = await handler(chatRequest({ authorization: 'Bearer good-dan' }), deps);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).scope, 'day');
});

test('rate-limit env config falls back to defaults on bad values', () => {
  process.env.AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE = 'nope';
  process.env.AGENT_GATEWAY_RATE_LIMIT_PER_DAY = '0';
  assert.deepEqual(getAgentRateLimits(), { perMinute: 20, perDay: 200 });
});
