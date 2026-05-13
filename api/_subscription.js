import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const SUBSCRIPTION_TIERS = ['pro', 'business', 'enterprise'];
export const SELF_SERVE_TIERS = ['pro', 'business'];
export const TIER_ORDER = {
  anonymous: 0,
  free: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
};

const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;
const tokenCache = new Map();

const TIER_PRICES = {
  pro: {
    amount: 900,
    label: 'Pro',
    description: 'EdgePannel Pro monthly subscription',
    envPriceId: 'STRIPE_PRICE_ID_PRO',
  },
  business: {
    amount: 2900,
    label: 'Business',
    description: 'EdgePannel Business monthly subscription',
    envPriceId: 'STRIPE_PRICE_ID_BUSINESS',
  },
};

function normalizeTier(value) {
  return SUBSCRIPTION_TIERS.includes(value) ? value : 'free';
}

function getFirebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_WEB_APP_ID || '';
}

export function parseIdToken(req) {
  const auth = req.headers.get('authorization') || '';
  // x-worldmonitor-token: legacy alias kept for clients not yet updated after the rename.
  // TODO: remove x-worldmonitor-token fallback once all clients send x-edgepannel-token (target: 2026-Q3).
  const explicitToken = req.headers.get('x-edgepannel-token') || req.headers.get('x-worldmonitor-token') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return explicitToken.trim();
}

export async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;

  const cached = tokenCache.get(idToken);
  if (cached && Date.now() < cached.expiry) return cached.verified;

  try {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!resp.ok) return null;

    const info = await resp.json();
    const projectId = getFirebaseProjectId();
    if (projectId && info.aud !== projectId) return null;

    const verified = {
      uid: info.sub ?? info.user_id ?? '',
      email: info.email ?? undefined,
      emailVerified: info.email_verified === 'true',
    };
    if (!verified.uid) return null;

    const tokenTtlMs = Math.max(0, (Number(info.expires_in || 0) - 300) * 1_000);
    tokenCache.set(idToken, {
      verified,
      expiry: Date.now() + (tokenTtlMs || TOKEN_CACHE_TTL_MS),
    });

    if (tokenCache.size > 500) {
      const now = Date.now();
      for (const [key, entry] of tokenCache.entries()) {
        if (now >= entry.expiry) tokenCache.delete(key);
      }
    }

    return verified;
  } catch {
    return null;
  }
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export async function getUserTierFromRedis(uid) {
  const redis = getRedisConfig();
  if (!redis || !uid) return 'free';

  try {
    const resp = await fetch(`${redis.url}/get/user:${uid}:tier`, {
      headers: { Authorization: `Bearer ${redis.token}` },
      signal: AbortSignal.timeout(1_500),
    });
    if (!resp.ok) return 'free';

    const data = await resp.json();
    return normalizeTier(data.result ? JSON.parse(data.result) : null);
  } catch {
    return 'free';
  }
}

export async function setUserTierInRedis(uid, tier) {
  const redis = getRedisConfig();
  if (!redis || !uid) return { status: 'redis_unconfigured' };

  try {
    await fetch(
      `${redis.url}/set/user:${uid}:tier/${encodeURIComponent(JSON.stringify(tier))}/EX/2592000`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${redis.token}` },
        signal: AbortSignal.timeout(1_500),
      },
    );
    return { status: 'ok' };
  } catch {
    return { status: 'redis_error' };
  }
}

async function convexMutation(path, args) {
  const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  const token = process.env.CONVEX_ADMIN_TOKEN;
  if (!url || !token) return null;

  try {
    const resp = await fetch(`${url}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ path, args }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function mirrorTierToConvex(firebaseUid, tier) {
  if (!firebaseUid || !SUBSCRIPTION_TIERS.includes(tier)) {
    return { status: 'skipped' };
  }

  const result = await convexMutation('dataset-service:upgradeTier', { firebaseUid, tier });
  return result ?? { status: 'skipped' };
}

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
}

async function stripeRequest(path, params) {
  const stripeKey = getStripeSecretKey();
  if (!stripeKey) {
    throw new Error('Stripe is not configured');
  }

  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    const message = body?.error?.message || `Stripe API error (${resp.status})`;
    throw new Error(message);
  }

  return body;
}

export function getCheckoutPlan(tier) {
  return TIER_PRICES[tier] ?? null;
}

export async function createCheckoutSession({ tier, firebaseUid, successUrl, cancelUrl }) {
  const plan = getCheckoutPlan(tier);
  if (!plan) {
    throw new Error('Invalid tier');
  }

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', firebaseUid);
  params.set('metadata[firebaseUid]', firebaseUid);
  params.set('metadata[tier]', tier);
  params.set('subscription_data[metadata][firebaseUid]', firebaseUid);
  params.set('subscription_data[metadata][tier]', tier);
  params.set('line_items[0][quantity]', '1');

  const envPriceId = process.env[plan.envPriceId];
  if (envPriceId) {
    params.set('line_items[0][price]', envPriceId);
  } else {
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(plan.amount));
    params.set('line_items[0][price_data][recurring][interval]', 'month');
    params.set('line_items[0][price_data][product_data][name]', `EdgePannel ${plan.label}`);
    params.set('line_items[0][price_data][product_data][description]', plan.description);
  }

  return stripeRequest('/checkout/sessions', params);
}

function decodeStripeSignatureHeader(signatureHeader) {
  const parts = signatureHeader.split(',');
  const decoded = { timestamp: '', signatures: [] };

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') decoded.timestamp = value || '';
    if (key === 'v1' && value) decoded.signatures.push(value);
  }

  return decoded;
}

async function computeStripeSignature(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyStripeWebhookSignature(payload, signatureHeader) {
  const secret = getStripeWebhookSecret();
  if (!secret || !signatureHeader) return false;

  const { timestamp, signatures } = decodeStripeSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() - Number(timestamp) * 1_000) / 1_000;
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = await computeStripeSignature(secret, `${timestamp}.${payload}`);
  return signatures.includes(expected);
}

export async function applyTierUpgrade(firebaseUid, tier) {
  const redis = await setUserTierInRedis(firebaseUid, tier);
  const convex = await mirrorTierToConvex(firebaseUid, tier);
  return { redis, convex };
}

export function buildSubscriptionResponseHeaders(req, methods = 'GET, OPTIONS') {
  return getCorsHeaders(req, methods);
}

export function isSubscriptionOriginDisallowed(req) {
  return isDisallowedOrigin(req);
}
