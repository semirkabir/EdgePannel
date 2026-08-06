const DESKTOP_ORIGIN_PATTERNS = [
  /^https?:\/\/tauri\.localhost(:\d+)?$/,
  /^https?:\/\/[a-z0-9-]+\.tauri\.localhost(:\d+)?$/i,
  /^tauri:\/\/localhost$/,
  /^asset:\/\/localhost$/,
];

const BROWSER_ORIGIN_PATTERNS = [
  /^https:\/\/(.*\.)?edgepannel\.com$/,
  // Vercel preview hostnames derive from the Vercel project name, not the
  // domain, and the project has not been renamed. Accept both prefixes.
  /^https:\/\/(edgepannel|worldmonitor)-[a-z0-9-]+-elie-habib-projects\.vercel\.app$/,
  ...(process.env.NODE_ENV === 'production' ? [] : [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  ]),
];

function isDesktopOrigin(origin) {
  return Boolean(origin) && DESKTOP_ORIGIN_PATTERNS.some(p => p.test(origin));
}

function isTrustedBrowserOrigin(origin) {
  return Boolean(origin) && BROWSER_ORIGIN_PATTERNS.some(p => p.test(origin));
}

// Sec-Fetch-Site is on the Forbidden Header list — set ONLY by the browser at
// request time, never by client JS or non-browser HTTP clients (curl, Node fetch,
// Python requests). 'same-origin' = strict same-origin browser fetch.
//
// Replaces an earlier Referer-origin fallback (issue #3541) which trusted a
// client-controlled header: `curl -H "Referer: https://edgepannel.com/"` with
// no Origin was classified as a trusted browser, bypassing the API-key gate.
// Sec-Fetch-Site is unforgeable; Referer is not.
function isSameOriginBrowserRequest(req) {
  return req.headers.get('Sec-Fetch-Site') === 'same-origin';
}

function isValidKey(key) {
  if (!key) return false;
  const validKeys = (process.env.EDGEPANNEL_VALID_KEYS || '').split(',').filter(Boolean);
  return validKeys.includes(key);
}

/**
 * API key validation used for:
 *  1. Desktop app — requires valid X-EdgePannel-Key.
 *  2. Trusted browser origins (edgepannel.com, Vercel previews, localhost) — no
 *     key needed. Same-origin requests with no Origin use Sec-Fetch-Site to confirm.
 *  3. Unknown origins — require a valid X-EdgePannel-Key header.
 *
 * Per-tier rate limiting is handled by the gateway via auth-tier.ts.
 */
export function validateApiKey(req) {
  const key = req.headers.get('X-EdgePannel-Key');
  const origin = req.headers.get('Origin') || '';

  // Desktop app — always require API key
  if (isDesktopOrigin(origin)) {
    if (!key) return { valid: false, required: true, error: 'API key required for desktop access' };
    if (!isValidKey(key)) return { valid: false, required: true, error: 'Invalid API key' };
    return { valid: true, required: true };
  }

  // Browser request from a trusted origin — either explicit Origin matches our
  // hosts, or Origin is absent AND the unforgeable Sec-Fetch-Site confirms same-origin.
  const isTrustedBrowser = isTrustedBrowserOrigin(origin)
    || (!origin && isSameOriginBrowserRequest(req));

  if (isTrustedBrowser) {
    if (key && !isValidKey(key)) return { valid: false, required: true, error: 'Invalid API key' };
    return { valid: true, required: false };
  }

  // Explicit key provided from unknown origin — validate it
  if (key) {
    if (!isValidKey(key)) return { valid: false, required: true, error: 'Invalid API key' };
    return { valid: true, required: true };
  }

  // No origin, no key — require API key (blocks unauthenticated curl/scripts)
  return { valid: false, required: true, error: 'API key required' };
}
