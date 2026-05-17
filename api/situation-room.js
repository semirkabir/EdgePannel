export const config = { runtime: 'edge' };

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { recordAuditEvent } from './_audit.js';
import { parseIdToken, verifyFirebaseToken } from './_subscription.js';

const ROOMS = new Set(['world', 'tech', 'finance', 'supply-chain', 'good-news', 'conflicts']);
const MAX_MESSAGE_LENGTH = 600;
const MAX_LABEL_LENGTH = 80;
const MAX_URL_LENGTH = 500;
const MAX_VIEW_LABEL_LENGTH = 160;

function getConvex() {
  const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  const token = process.env.CONVEX_ADMIN_TOKEN;
  return url && token ? { url, token } : null;
}

async function convexRequest(kind, path, args) {
  const convex = getConvex();
  if (!convex) return null;
  const response = await fetch(`${convex.url}/api/${kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${convex.token}`,
    },
    body: JSON.stringify({ path, args }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.value ?? data.result ?? null;
}

function asRoom(value) {
  return ROOMS.has(value) ? value : 'world';
}

function sanitizeText(value, maxLength) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
    : '';
}

function sanitizeAttachment(value) {
  if (!value || typeof value !== 'object') return null;
  const url = sanitizeText(value.url, MAX_URL_LENGTH);
  const label = sanitizeText(value.label, MAX_VIEW_LABEL_LENGTH);
  if (!url || !label || !url.startsWith('/')) return null;
  return { viewUrl: url, viewLabel: label };
}

function normalizeMessage(message) {
  if (!message) return null;
  return {
    id: String(message._id ?? message.id ?? ''),
    room: message.room,
    firebaseUid: message.firebaseUid,
    userLabel: message.userLabel,
    avatarUrl: message.avatarUrl,
    content: message.content,
    createdAt: message.createdAt,
    viewUrl: message.viewUrl,
    viewLabel: message.viewLabel,
  };
}

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
  if (!getConvex()) {
    return new Response(JSON.stringify({ error: 'Situation Room backend not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const room = asRoom(url.searchParams.get('room'));
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '80', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 80;
    const messages = await convexRequest('query', 'chat:listMessages', { room, limit });
    return new Response(JSON.stringify({
      messages: Array.isArray(messages) ? messages.map(normalizeMessage).filter(Boolean) : [],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  if (req.method === 'POST') {
    const token = parseIdToken(req);
    const verified = await verifyFirebaseToken(token);
    if (!verified) {
      return new Response(JSON.stringify({ error: 'Sign in required to post' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const room = asRoom(body.room);
    const content = sanitizeText(body.content, MAX_MESSAGE_LENGTH);
    if (!content) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userLabel = sanitizeText(body.displayName, MAX_LABEL_LENGTH)
      || sanitizeText(verified.email?.split('@')[0], MAX_LABEL_LENGTH)
      || 'User';
    const avatarUrl = sanitizeText(body.avatarUrl, MAX_URL_LENGTH) || undefined;
    const attachment = sanitizeAttachment(body.attachment);
    const message = await convexRequest('mutation', 'chat:postMessage', {
      room,
      firebaseUid: verified.uid,
      userLabel,
      avatarUrl,
      content,
      ...(attachment ?? {}),
    });
    const normalized = normalizeMessage(message);
    if (!normalized) {
      return new Response(JSON.stringify({ error: 'Failed to post message' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    void recordAuditEvent(req, {
      firebaseUid: verified.uid,
      action: 'situation_room:post',
      entityId: room,
      entityType: 'situation_room',
      meta: { hasViewAttachment: Boolean(attachment) },
    });

    return new Response(JSON.stringify({ message: normalized }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
