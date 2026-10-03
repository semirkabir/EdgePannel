/**
 * Web agent-gateway — thin Vercel adapter over the same handleAgentGateway
 * used by the Tauri local-api-server sidecar.
 *
 * Routes:
 *   GET|POST /api/agent-gateway/status
 *   POST     /api/agent-gateway/chat
 *   POST     /api/agent-gateway/test-connector
 *   GET|POST /api/agent-gateway/mcp
 *
 * chat, mcp and test-connector require a signed-in Firebase user and are
 * rate-limited per uid (see _agent-gateway-guard.js). status stays public.
 * The desktop sidecar does not use this adapter, so it is unaffected.
 *
 * Node runtime (not edge) so we can import the sidecar .mjs module and use
 * longer chat timeouts against user-configured OpenAI-compatible endpoints.
 */
export const config = { runtime: 'nodejs', maxDuration: 60 };

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { handleAgentGateway } from '../src-tauri/sidecar/agent-gateway.mjs';
import { guardAgentGatewayRequest } from './_agent-gateway-guard.js';

function withCors(response, corsHeaders) {
  if (!response) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function handler(req, deps) {
  // `deps` is a test seam (token verifier / clock); Vercel passes no second
  // argument for Web-style handlers, so production uses the real verifier.
  deps = deps && typeof deps === 'object' && typeof deps.verifyToken === 'function' ? deps : {};
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

  const url = new URL(req.url);
  const denied = await guardAgentGatewayRequest(req, url.pathname, deps);
  if (denied) return withCors(denied, corsHeaders);

  // Normalize pathname: Vercel may mount this file at /api/agent-gateway
  // with the rest in search/path segments via catch-all, or as discrete files.
  // Discrete files live under api/agent-gateway/*.js — their req.url already
  // includes the full /api/agent-gateway/<route> path.
  const response = await handleAgentGateway(url, req, {
    baseUrl: `${url.protocol}//${url.host}`,
    port: 0,
  });
  return withCors(response, corsHeaders);
}
