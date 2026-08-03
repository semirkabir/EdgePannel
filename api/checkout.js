/**
 * Checkout API endpoint — creates a Stripe Checkout session and redirects.
 *
 * GET /api/checkout?tier=analyst&uid=firebase_uid&interval=month
 */
import {
  buildSubscriptionResponseHeaders,
  createCheckoutSession,
  getCheckoutPlan,
  parseIdToken,
  verifyFirebaseToken,
} from './_subscription.js';
import { recordAuditEvent } from './_audit.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = buildSubscriptionResponseHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  const url = new URL(req.url);
  const tier = url.searchParams.get('tier');
  const uid = url.searchParams.get('uid');
  const interval = url.searchParams.get('interval') === 'year' ? 'year' : 'month';

  if (!tier || !getCheckoutPlan(tier)) {
    return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  if (!uid) {
    return new Response(JSON.stringify({ error: 'Missing uid parameter' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  const verified = await verifyFirebaseToken(parseIdToken(req));
  if (!verified || verified.uid !== uid) {
    return new Response(JSON.stringify({ error: 'Authentication required for checkout owner' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  const origin = url.origin;
  const successUrl = new URL('/app', origin);
  successUrl.searchParams.set('checkout', 'success');
  successUrl.searchParams.set('tier', tier);
  const cancelUrl = new URL('/pricing', origin);
  cancelUrl.searchParams.set('checkout', 'canceled');

  try {
    const session = await createCheckoutSession({
      tier,
      firebaseUid: uid,
      interval,
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    if (!session?.url) {
      throw new Error('Stripe checkout URL missing');
    }

    // Fire-and-forget: do not block the redirect on audit I/O.
    recordAuditEvent(req, {
      firebaseUid: uid,
      action: 'checkout:create',
      entityId: tier,
      entityType: 'subscription_tier',
      tier,
      meta: { sessionId: session.id ?? undefined },
    });
    return Response.redirect(session.url, 303);
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to create checkout session',
      tier,
      uid,
    }), { status: 503, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
