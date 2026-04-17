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

export async function fetchGdeltJson(url, opts = {}) {
  const {
    label = 'unknown',
    timeoutMs = 15_000,
    maxRetries = 3,
    retryBaseMs = 10_000,
    proxyMaxAttempts = 5,
    proxyRetryBaseMs = 5_000,
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
        console.warn(`  [GDELT] ${label} ${err?.message ?? err}; retrying in ${Math.round(retryMs / 1000)}s (${attempt + 1}/${maxRetries})`);
        await _sleep(retryMs);
        continue;
      }
      break;
    }

    if (resp.ok) {
      try {
        return await resp.json();
      } catch (parseErr) {
        lastDirectError = parseErr;
        break;
      }
    }

    lastDirectError = new Error(`HTTP ${resp.status}`);

    if (RETRYABLE_STATUSES.has(resp.status) && attempt < maxRetries) {
      const retryAfter = parseRetryAfterMs(resp.headers.get('retry-after'));
      const retryMs = retryAfter ?? retryBaseMs * (attempt + 1);
      console.warn(`  [GDELT] ${label} ${resp.status} - waiting ${Math.round(retryMs / 1000)}s (${attempt + 1}/${maxRetries})`);
      await _sleep(retryMs);
      continue;
    }

    break;
  }

  const curlProxyAuth = _curlProxyResolver();
  let lastProxyError = null;
  let proxyAttemptsRun = 0;

  if (curlProxyAuth && proxyMaxAttempts > 0) {
    console.log(`  [GDELT] direct exhausted on ${label} (${lastDirectError?.message ?? 'unknown'}); trying proxy (curl) up to ${proxyMaxAttempts}x (Decodo session-rotates per call)`);
    for (let attempt = 1; attempt <= proxyMaxAttempts; attempt++) {
      proxyAttemptsRun = attempt;
      try {
        const text = await Promise.resolve(_proxyCurlFetcher(url, curlProxyAuth, { 'User-Agent': CHROME_UA, Accept: 'application/json' }));
        const parsed = JSON.parse(text);
        console.log(`  [GDELT] proxy (curl) succeeded for ${label} on attempt ${attempt}/${proxyMaxAttempts}`);
        return parsed;
      } catch (curlErr) {
        lastProxyError = curlErr;
        const status = curlErr?.status;
        const isParseFailure = curlErr instanceof SyntaxError;
        let isRetryable;
        if (typeof status === 'number') {
          isRetryable = RETRYABLE_STATUSES.has(status);
        } else if (isParseFailure) {
          isRetryable = false;
        } else {
          isRetryable = true;
        }
        if (attempt < proxyMaxAttempts && isRetryable) {
          const retryMs = proxyRetryBaseMs;
          console.warn(`  [GDELT] proxy (curl) attempt ${attempt}/${proxyMaxAttempts} failed: ${curlErr?.message ?? curlErr}; retrying in ${Math.round(retryMs / 1000)}s`);
          await _sleep(retryMs);
          continue;
        }
        console.warn(`  [GDELT] proxy (curl) attempt ${attempt}/${proxyMaxAttempts} failed${isRetryable ? ' (last attempt)' : ' (non-retryable)'}: ${curlErr?.message ?? curlErr}`);
        break;
      }
    }
  }

  throw new Error(
    `GDELT retries exhausted for ${label}` +
    (lastDirectError ? ` (last direct: ${lastDirectError.message})` : '') +
    (lastProxyError ? ` (last proxy: ${lastProxyError.message} after ${proxyAttemptsRun}/${proxyMaxAttempts} attempts)` : ''),
    lastDirectError ? { cause: lastDirectError } : (lastProxyError ? { cause: lastProxyError } : undefined),
  );
}
