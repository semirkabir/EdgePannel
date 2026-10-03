import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit = null;

function getRatelimit() {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(600, '60 s'),
    prefix: 'rl',
    analytics: false,
  });

  return ratelimit;
}

// Per-endpoint limiters, cached by key so each endpoint gets its own bucket
// instead of sharing the global IP limit above.
const keyedRatelimiters = new Map();

function getKeyedRatelimit(key, limit, window) {
  const cached = keyedRatelimiters.get(key);
  if (cached) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const rl = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `rl:${key}`,
    analytics: false,
  });

  keyedRatelimiters.set(key, rl);
  return rl;
}

function getClientIp(request) {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

export async function checkRateLimit(request, corsHeaders) {
  const rl = getRatelimit();
  if (!rl) return null;

  const ip = getClientIp(request);
  try {
    const { success, limit, reset } = await rl.limit(ip);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          ...corsHeaders,
        },
      });
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Per-endpoint rate limit with its own key, limit, and window (independent
 * of the shared global IP limiter above). Use for endpoints that need a
 * tighter or looser bucket than the default 600/60s.
 */
export async function checkKeyedRateLimit(request, key, limit, window, corsHeaders) {
  const rl = getKeyedRatelimit(key, limit, window);
  if (!rl) return null;

  const ip = getClientIp(request);
  try {
    const { success, limit: max, reset } = await rl.limit(`${key}:${ip}`);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          ...corsHeaders,
        },
      });
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Keyed limit on an arbitrary identifier (e.g. a Firebase uid) rather than
 * the client IP. Returns the raw verdict so callers can build their own
 * response body, or null when Upstash is not configured / errored — callers
 * that must not fail open (e.g. LLM-billing endpoints) should fall back to a
 * local limiter on null.
 *
 * @returns {Promise<{ success: boolean, limit: number, remaining: number, reset: number } | null>}
 */
export async function checkIdentifierRateLimit(key, identifier, limit, window) {
  const rl = getKeyedRatelimit(key, limit, window);
  if (!rl) return null;
  try {
    const { success, limit: max, remaining, reset } = await rl.limit(`${key}:${identifier}`);
    return { success, limit: max, remaining, reset };
  } catch {
    return null;
  }
}
