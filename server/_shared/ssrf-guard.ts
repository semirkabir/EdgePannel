/**
 * SSRF protection for outbound requests to a user-supplied URL (e.g. an alert
 * rule's configured webhook). Ported from api/fetch-article.js's
 * isBlockedHostname()/parseFetchableArticleUrl() — same hostname blocklist,
 * same http(s)-only + no-embedded-credentials rule. That file fetches
 * ingested article URLs (GET); this one POSTs a JSON payload to a
 * user-configured destination, so redirects get a tighter cap and every hop
 * is re-validated rather than trusted.
 */

const MAX_WEBHOOK_REDIRECTS = 2;
const WEBHOOK_TIMEOUT_MS = 5_000;

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('169.254.')) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b, c, d] = ipv4.slice(1).map(Number) as [number, number, number, number];
    if ([a, b, c, d].some((part) => part > 255)) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true;
  return false;
}

/** Throws if `rawUrl` isn't a safe http(s) destination to send a server-side request to. */
export function assertSafeWebhookUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported webhook URL protocol');
  }
  if (url.username || url.password || isBlockedHostname(url.hostname)) {
    throw new Error('Blocked webhook host');
  }
  return url;
}

/**
 * POSTs `payload` to `rawUrl`, re-validating every redirect hop (redirect:
 * 'manual' — never trust fetch's automatic redirect following for a
 * user-supplied destination). Returns true only on a final 2xx response.
 */
export async function postToWebhookSafely(rawUrl: string, payload: unknown): Promise<boolean> {
  let current = assertSafeWebhookUrl(rawUrl);
  const body = JSON.stringify(payload);

  for (let redirects = 0; redirects <= MAX_WEBHOOK_REDIRECTS; redirects += 1) {
    const response = await fetch(current.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return false;
      current = assertSafeWebhookUrl(new URL(location, current).toString());
      continue;
    }

    // Only the status matters for a delivery confirmation — drain the body
    // so the connection can close cleanly, but discard its content.
    await response.body?.cancel().catch(() => {});
    return response.ok;
  }

  throw new Error('Too many webhook redirects');
}
