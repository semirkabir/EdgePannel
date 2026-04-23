/**
 * Checkout API endpoint — creates a Stripe Checkout session and redirects.
 *
 * GET /api/checkout?tier=pro&uid=firebase_uid
 */
import {
  buildSubscriptionResponseHeaders,
  createCheckoutSession,
  getCheckoutPlan,
} from './_subscription.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = buildSubscriptionResponseHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  const url = new URL(req.url);
  const tier = url.searchParams.get('tier');
  const uid = url.searchParams.get('uid');

  if (!tier || (!getCheckoutPlan(tier) && tier !== 'enterprise')) {
    return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  if (tier === 'enterprise') {
    return Response.redirect('mailto:sales@worldmonitor.app?subject=Enterprise%20Inquiry', 302);
  }

  if (!uid) {
    return new Response(JSON.stringify({ error: 'Missing uid parameter' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
  }

  const origin = url.origin;
  const successUrl = new URL('/', origin);
  successUrl.searchParams.set('checkout', 'success');
  successUrl.searchParams.set('tier', tier);
  const cancelUrl = new URL('/', origin);
  cancelUrl.searchParams.set('checkout', 'canceled');

  try {
    const session = await createCheckoutSession({
      tier,
      firebaseUid: uid,
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    if (!session?.url) {
      throw new Error('Stripe checkout URL missing');
    }

    return Response.redirect(session.url, 303);
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to create checkout session',
      tier,
      uid,
    }), { status: 503, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
