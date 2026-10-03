/**
 * Fetch interceptor that attaches the current user's Firebase ID token
 * to all outgoing /api/ requests.
 *
 * Runs in both browser and desktop (Tauri).  When the user is signed in
 * with Google, the server gateway can detect their tier (free/paid) and
 * apply per-tier rate limits + cache strategies.  Unsigned requests fall
 * into the anonymous tier automatically.
 *
 * Also detects 429 rate-limit responses and logs which endpoint is being
 * throttled, including Retry-After header if present.
 */

import { getIdToken, isFirebaseConfigured } from './firebase-auth';

/** Token cache — avoid calling getIdToken() on every single request while
 * the ID token hasn't expired (Firebase ID tokens last ~1 hour). */
let cachedToken: string | null = null;
let tokenExpiryMs = 0;
const firebaseConfigured = isFirebaseConfigured();

/**
 * Current user's Firebase ID token (cached), or null when signed out /
 * Firebase is unconfigured. Exported for callers that need to attach the
 * token explicitly (e.g. agent-gateway on web) rather than rely on the
 * implicit interceptor below.
 */
export async function getApiIdToken(): Promise<string | null> {
  if (!firebaseConfigured) return null;
  try {
    return await getIdTokenCached();
  } catch {
    return null;
  }
}

async function getIdTokenCached(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiryMs) return cachedToken;
  const token = await getIdToken();
  cachedToken = token;
  // Firebase ID tokens last ~3600s; cache for 50 min to be safe.
  tokenExpiryMs = Date.now() + 3_000_000;
  return token;
}

/** Per-endpoint rate-limit cooldown map — suppresses repeated 429 logs
 * for the same endpoint within a cooldown window. */
const rateLimitCooldowns = new Map<string, number>();
const RATE_LIMIT_COOLDOWN_MS = 60_000; // 1 min between logs per endpoint

function extractEndpoint(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input.split('?')[0] ?? input;
  if (input instanceof URL) return input.pathname;
  if (input instanceof Request) return input.url.split('?')[0] ?? input.url;
  return 'unknown';
}

function handleRateLimitResponse(response: Response, endpoint: string): void {
  if (response.status !== 429) return;

  const now = Date.now();
  const lastLog = rateLimitCooldowns.get(endpoint) ?? 0;
  if (now - lastLog < RATE_LIMIT_COOLDOWN_MS) return;
  rateLimitCooldowns.set(endpoint, now);

  const retryAfter = response.headers.get('Retry-After');
  const retryMsg = retryAfter ? ` — retry after ${retryAfter}s` : '';
  console.warn(`[RateLimit] 429 on ${endpoint}${retryMsg}`);
}

const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Determine target URL.
  let urlString = '';
  if (typeof input === 'string') {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.toString();
  } else if (input instanceof Request) {
    urlString = input.url;
  }

  // Only intercept /api/ requests — leave external fetch calls alone.
  const isApiCall = urlString.startsWith('/api/') || urlString.startsWith(window.location.origin + '/api/');

  if (!isApiCall || !firebaseConfigured) {
    return originalFetch(input, init);
  }

  try {
    const token = await getIdTokenCached();

    if (token) {
      const headers = new Headers(init?.headers || {});
      headers.set('x-edgepannel-token', token);
      const response = await originalFetch(input, { ...init, headers });
      handleRateLimitResponse(response, extractEndpoint(input));
      return response;
    }
  } catch {
    // Token fetch failed — proceed without token so the request still goes through.
  }

  const response = await originalFetch(input, init);
  handleRateLimitResponse(response, extractEndpoint(input));
  return response;
};
