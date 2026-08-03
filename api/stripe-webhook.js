import {
  applyTierUpgrade,
  buildSubscriptionResponseHeaders,
  isSubscriptionOriginDisallowed,
  verifyStripeWebhookSignature,
} from './_subscription.js';

export const config = { runtime: 'edge' };

const PAID_TIERS = new Set(['enthusiast', 'analyst', 'strategist', 'maximalist']);

function getSessionMetadata(session) {
  const metadata = session?.metadata ?? {};
  return {
    firebaseUid: metadata.firebaseUid || session?.client_reference_id || '',
    tier: metadata.tier || '',
  };
}

export default async function handler(req) {
  if (isSubscriptionOriginDisallowed(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cors = buildSubscriptionResponseHeaders(req, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const payload = await req.text();
  const signatureHeader = req.headers.get('stripe-signature') || '';
  const signatureValid = await verifyStripeWebhookSignature(payload, signatureHeader);
  if (!signatureValid) {
    return new Response(JSON.stringify({ error: 'Invalid Stripe signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (event?.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const session = event?.data?.object ?? {};
  const { firebaseUid, tier } = getSessionMetadata(session);

  if (!firebaseUid || !PAID_TIERS.has(tier)) {
    return new Response(JSON.stringify({ error: 'Missing checkout metadata' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const upgrade = await applyTierUpgrade(firebaseUid, tier);
  return new Response(JSON.stringify({
    received: true,
    processed: true,
    firebaseUid,
    tier,
    upgrade,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
