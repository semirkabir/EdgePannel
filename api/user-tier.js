/**
 * User Tier API — resolves subscription tier from Redis.
 *
 * GET /api/user-tier
 * Returns { tier, mcpEnabled, requestsPerHour, cacheStaleness }
 *
 * Auth: accepts either `Authorization: Bearer ...` or `x-edgepannel-token`.
 * Anonymous / no token → tier: 'anonymous'
 */
import {
  buildSubscriptionResponseHeaders,
  getUserTierFromRedis,
  parseIdToken,
  verifyFirebaseToken,
} from './_subscription.js';

export const config = { runtime: 'edge' };

const TIER_META = {
  anonymous: { requestsPerHour: 30, cacheStaleness: 'aggressive', mcpEnabled: false },
  free: { requestsPerHour: 120, cacheStaleness: 'moderate', mcpEnabled: false },
  enthusiast: { requestsPerHour: 400, cacheStaleness: 'minimal', mcpEnabled: false },
  analyst: { requestsPerHour: 900, cacheStaleness: 'minimal', mcpEnabled: true },
  strategist: { requestsPerHour: 3_000, cacheStaleness: 'minimal', mcpEnabled: true },
  maximalist: { requestsPerHour: 10_000, cacheStaleness: 'none', mcpEnabled: true },
};

export default async function handler(req) {
  const cors = buildSubscriptionResponseHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  const idToken = parseIdToken(req);

  if (!idToken) {
    return new Response(JSON.stringify({ tier: 'anonymous', ...TIER_META.anonymous }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'public, s-maxage=60' },
    });
  }

  const verified = await verifyFirebaseToken(idToken);
  if (!verified) {
    return new Response(JSON.stringify({ tier: 'anonymous', ...TIER_META.anonymous }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const tier = await getUserTierFromRedis(verified.uid);
  return new Response(JSON.stringify({ tier, ...TIER_META[tier] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors, 'Cache-Control': 'no-cache' },
  });
}
