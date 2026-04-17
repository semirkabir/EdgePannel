import { CHROME_UA, sleep, resolveProxy, curlFetch } from './_seed-utils.mjs';

const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_RETRY_AFTER_MS = 60_000;

export const _PROXY_DEFAULTS = Object.freeze({
  curlProxyResolver: resolveProxy,
  curlFetcher: curlFetch,
});

export function parseRetryAfterMs(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt)) {
    return Math.min(Math.max(retryAt - Date.now(), 1000), MAX_RETRY_AFTER_MS);
  }
  return null;
}

export async function fetchYahooJson(url, opts = {}) {
  const {
    label = 'unknown',
    timeoutMs = 10_000,
    maxRetries = 3,
    retryBaseMs = 5_000,
    _curlProxyResolver = _PROXY_DEFAULTS.curlProxyResolver,
    _proxyCurlFetcher = _PROXY_DEFAULTS.curlFetcher,
    _sleep = sleep,
  } = opts;

  let lastDirectError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let resp;
    try {
      resp = await fetch(url, {
        headers: { 'User-Agent': CHROME_UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastDirectError = err;
      if (attempt < maxRetries) {
        const retryMs = retryBaseMs * (attempt + 1);
        console.warn(`  [YAHOO] ${label} ${err?.message ?? err}; retrying in ${Math.round(retryMs / 1000)}s (${attempt + 1}/${maxRetries})`);
        await _sleep(retryMs);
        continue;
      }
      break;
    }

    if (resp.ok) return await resp.json();

    lastDirectError = new Error(`HTTP ${resp.status}`);

    if (RETRYABLE_STATUSES.has(resp.status) && attempt < maxRetries) {
      const retryAfter = parseRetryAfterMs(resp.headers.get('retry-after'));
      const retryMs = retryAfter ?? retryBaseMs * (attempt + 1);
      console.warn(`  [YAHOO] ${label} ${resp.status} - waiting ${Math.round(retryMs / 1000)}s (${attempt + 1}/${maxRetries})`);
      await _sleep(retryMs);
      continue;
    }

    break;
  }

  const curlProxyAuth = _curlProxyResolver();
  if (curlProxyAuth) {
    try {
      console.log(`  [YAHOO] direct exhausted on ${label} (${lastDirectError?.message ?? 'unknown'}); trying proxy (curl)`);
      const text = await Promise.resolve(_proxyCurlFetcher(url, curlProxyAuth, { 'User-Agent': CHROME_UA, Accept: 'application/json' }));
      const parsed = JSON.parse(text);
      console.log(`  [YAHOO] proxy (curl) succeeded for ${label}`);
      return parsed;
    } catch (curlErr) {
      throw new Error(
        `Yahoo retries exhausted for ${label} (last direct: ${lastDirectError?.message ?? 'unknown'}; last proxy: ${curlErr?.message ?? curlErr})`,
        { cause: lastDirectError ?? curlErr },
      );
    }
  }

  throw new Error(
    `Yahoo retries exhausted for ${label}${lastDirectError ? ` (last direct: ${lastDirectError.message})` : ''}`,
    lastDirectError ? { cause: lastDirectError } : undefined,
  );
}
