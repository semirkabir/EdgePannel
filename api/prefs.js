/**
 * Cloud preferences endpoint — GET/POST a user's persisted settings blob.
 *
 * Auth: Firebase ID token via `x-worldmonitor-token` header (attached
 * automatically by src/services/api-auth-fetch.ts for all /api/ calls).
 *
 * Storage: Upstash Redis key `user-prefs:{uid}` (no env prefix → persists
 * across preview/production deployments).
 *
 * GET  /api/prefs  → { prefs: {...} | null }
 * POST /api/prefs  → { ok: true }  (body: { prefs: {...} })
 */

export const config = { runtime: 'edge' };

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? '';
const MAX_PREFS_BYTES = 256 * 1024; // 256 KB

// --- Firebase JWT verification -------------------------------------------

/** In-memory token cache to avoid hitting Google on every request. */
const tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000; // 50 min

async function verifyToken(token) {
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.exp) return cached.uid;

  try {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!resp.ok) return null;
    const info = await resp.json();

    // Validate audience when project ID is configured
    if (FIREBASE_PROJECT_ID && info.aud !== FIREBASE_PROJECT_ID) return null;

    const uid = info.sub ?? info.user_id ?? null;
    if (!uid) return null;

    tokenCache.set(token, { uid, exp: Date.now() + TOKEN_CACHE_TTL_MS });

    // Trim stale entries
    if (tokenCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of tokenCache) if (now >= v.exp) tokenCache.delete(k);
    }

    return uid;
  } catch {
    return null;
  }
}

// --- Redis helpers (raw keys, no env prefix) ------------------------------

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    const resp = await fetch(`${r.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${r.token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function redisSet(key, value) {
  const r = getRedis();
  if (!r) throw new Error('Redis not configured');
  const resp = await fetch(
    `${r.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${r.token}` },
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!resp.ok) throw new Error(`Redis SET HTTP ${resp.status}`);
}

// --- Handler --------------------------------------------------------------

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, POST, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth
  const token = req.headers.get('x-worldmonitor-token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const uid = await verifyToken(token);
  if (!uid) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const redisKey = `user-prefs:${uid}`;

  // GET — return saved prefs
  if (req.method === 'GET') {
    try {
      const raw = await redisGet(redisKey);
      const prefs = raw ? JSON.parse(raw) : null;
      return new Response(JSON.stringify({ prefs }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return new Response(JSON.stringify({ prefs: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
  }

  // POST — save prefs blob
  if (req.method === 'POST') {
    try {
      const bodyText = await req.text();
      if (bodyText.length > MAX_PREFS_BYTES) {
        return new Response(JSON.stringify({ error: 'Payload too large' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { prefs } = JSON.parse(bodyText);
      if (!prefs || typeof prefs !== 'object') {
        return new Response(JSON.stringify({ error: 'Invalid body: expected { prefs: {...} }' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await redisSet(redisKey, JSON.stringify(prefs));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[prefs] POST failed:', err);
      return new Response(JSON.stringify({ error: 'Failed to save preferences' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
