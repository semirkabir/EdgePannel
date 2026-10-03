/**
 * Web-only gate for /api/agent-gateway/{chat,mcp,test-connector}.
 *
 * The web gateway can reach connectors configured via WM_AGENT_CONNECTORS on
 * the server, i.e. the site owner's LLM key. Anonymous callers must never be
 * able to spend it, so these routes require a verified Firebase ID token and
 * are rate-limited per uid. /status stays public (read-only metadata).
 * The desktop sidecar (local-api-server.mjs) calls handleAgentGateway
 * directly and never goes through this module.
 *
 * Auth: reuses parseIdToken/verifyFirebaseToken from _subscription.js (the
 * same check /api/user-tier uses). Accepts `Authorization: Bearer <idToken>`
 * or `x-edgepannel-token` (what api-auth-fetch.ts attaches on web).
 *
 * Rate limit (per uid, two windows, both must pass):
 *   AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE  default 20
 *   AGENT_GATEWAY_RATE_LIMIT_PER_DAY     default 200
 * Primary store: Upstash sliding window via checkIdentifierRateLimit
 * (shared across all serverless instances). When Upstash is unconfigured or
 * errors we do NOT fail open: we fall back to an in-memory fixed-window
 * counter. That fallback is PER INSTANCE — each warm serverless instance
 * keeps its own counters and a cold start resets them — so it bounds abuse
 * per instance, not globally. Configure Upstash in production.
 */
import { parseIdToken, verifyFirebaseToken } from './_subscription.js';
import { checkIdentifierRateLimit } from './_rate-limit.js';

export const GATED_AGENT_ROUTES = new Set([
  '/api/agent-gateway/chat',
  '/api/agent-gateway/mcp',
  '/api/agent-gateway/test-connector',
]);

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MAX_LOCAL_BUCKETS = 5_000;

function positiveIntEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

export function getAgentRateLimits() {
  return {
    perMinute: positiveIntEnv('AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE', 20),
    perDay: positiveIntEnv('AGENT_GATEWAY_RATE_LIMIT_PER_DAY', 200),
  };
}

// --- in-memory fallback (per instance) -------------------------------------
const localBuckets = new Map(); // `${window}:${uid}` -> { count, resetAt }

function localHit(key, limit, windowMs, now) {
  let bucket = localBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    localBuckets.set(key, bucket);
  }
  if (bucket.count >= limit) return { success: false, limit, remaining: 0, reset: bucket.resetAt };
  bucket.count++;
  return { success: true, limit, remaining: limit - bucket.count, reset: bucket.resetAt };
}

function pruneLocalBuckets(now) {
  if (localBuckets.size <= MAX_LOCAL_BUCKETS) return;
  for (const [key, bucket] of localBuckets) {
    if (now >= bucket.resetAt) localBuckets.delete(key);
  }
}

/** Test hook: reset the per-instance fallback counters. */
export function resetAgentRateLimitState() {
  localBuckets.clear();
}

async function hitWindow(scope, uid, limit, windowMs, upstashWindow, now) {
  const remote = await checkIdentifierRateLimit(`agent-gw-${scope}`, uid, limit, upstashWindow);
  if (remote) return remote;
  return localHit(`${scope}:${uid}`, limit, windowMs, now);
}

function json(payload, status, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/**
 * Returns null when the request may proceed, or a 401/429 Response.
 * `deps` lets tests inject a token verifier and clock.
 */
export async function guardAgentGatewayRequest(req, pathname, deps = {}) {
  if (!GATED_AGENT_ROUTES.has(pathname)) return null;
  if (req.method === 'OPTIONS') return null;

  const verify = deps.verifyToken ?? verifyFirebaseToken;
  const now = (deps.now ?? Date.now)();

  const idToken = parseIdToken(req);
  const verified = idToken ? await verify(idToken) : null;
  if (!verified?.uid) {
    return json({
      error: 'Sign in to use the copilot.',
      code: idToken ? 'auth_invalid' : 'auth_required',
    }, 401, { 'WWW-Authenticate': 'Bearer realm="agent-gateway"' });
  }

  pruneLocalBuckets(now);
  const { perMinute, perDay } = getAgentRateLimits();
  const windows = [
    ['minute', perMinute, MINUTE_MS, '60 s'],
    ['day', perDay, DAY_MS, '1 d'],
  ];
  for (const [scope, limit, windowMs, upstashWindow] of windows) {
    const verdict = await hitWindow(scope, verified.uid, limit, windowMs, upstashWindow, now);
    if (!verdict.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((verdict.reset - now) / 1000));
      return json({
        error: scope === 'minute'
          ? `Copilot rate limit reached (${limit} requests/minute). Try again in ${retryAfterSeconds}s.`
          : `Daily copilot limit reached (${limit} requests/day). Try again tomorrow.`,
        code: 'rate_limited',
        scope,
        retryAfterSeconds,
      }, 429, {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(verdict.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(verdict.reset),
      });
    }
  }
  return null;
}
