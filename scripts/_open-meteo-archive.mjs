import { CHROME_UA, sleep, resolveProxy, resolveProxyForConnect, httpsProxyFetchRaw, curlFetch } from './_seed-utils.mjs';

export const _PROXY_DEFAULTS = Object.freeze({
  connectProxyResolver: resolveProxyForConnect,
  curlProxyResolver: resolveProxy,
  connectFetcher: httpsProxyFetchRaw,
  curlFetcher: curlFetch,
});

const MAX_RETRY_AFTER_MS = 60_000;
const RETRYABLE_STATUSES = new Set([429, 503]);

export function chunkItems(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function normalizeArchiveBatchResponse(payload) {
  return Array.isArray(payload) ? payload : [payload];
}

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

export async function fetchOpenMeteoArchiveBatch(zones, opts) {
  const {
    startDate,
    endDate,
    daily,
    timezone = 'UTC',
    timeoutMs = 30_000,
    maxRetries = 3,
    retryBaseMs = 2_000,
    label = zones.map((zone) => zone.name).join(', '),
    _connectProxyResolver = _PROXY_DEFAULTS.connectProxyResolver,
    _curlProxyResolver = _PROXY_DEFAULTS.curlProxyResolver,
    _proxyFetcher = _PROXY_DEFAULTS.connectFetcher,
    _proxyCurlFetcher = _PROXY_DEFAULTS.curlFetcher,
  } = opts;

  const params = new URLSearchParams({
    latitude: zones.map((zone) => String(zone.lat)).join(','),
    longitude: zones.map((zone) => String(zone.lon)).join(','),
    start_date: startDate,
    end_date: endDate,
    daily: daily.join(','),
    timezone,
  });
  const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;

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
        const retryMs = retryBaseMs * 2 ** attempt;
        console.log(`  [OPEN_METEO] ${err?.message ?? err} for ${label}; retrying batch in ${Math.round(retryMs / 1000)}s`);
        await sleep(retryMs);
        continue;
      }
      break;
    }

    if (resp.ok) {
      const data = normalizeArchiveBatchResponse(await resp.json());
      if (data.length !== zones.length) {
        throw new Error(`Open-Meteo batch size mismatch for ${label}: expected ${zones.length}, got ${data.length}`);
      }
      return data;
    }

    lastDirectError = new Error(`HTTP ${resp.status}`);

    if (RETRYABLE_STATUSES.has(resp.status) && attempt < maxRetries) {
      const retryMs = parseRetryAfterMs(resp.headers.get('retry-after')) ?? (retryBaseMs * 2 ** attempt);
      console.log(`  [OPEN_METEO] ${resp.status} for ${label}; retrying batch in ${Math.round(retryMs / 1000)}s`);
      await sleep(retryMs);
      continue;
    }

    break;
  }

  const connectProxyAuth = _connectProxyResolver();
  const curlProxyAuth = _curlProxyResolver();
  let lastProxyError = null;

  if (connectProxyAuth) {
    try {
      console.log(`  [OPEN_METEO] direct exhausted on ${label} (${lastDirectError?.message ?? 'unknown'}); trying proxy (CONNECT)`);
      const { buffer } = await _proxyFetcher(url, connectProxyAuth, {
        accept: 'application/json',
        timeoutMs,
      });
      const data = normalizeArchiveBatchResponse(JSON.parse(buffer.toString('utf8')));
      if (data.length !== zones.length) {
        throw new Error(`Open-Meteo proxy batch size mismatch for ${label}: expected ${zones.length}, got ${data.length}`);
      }
      console.log(`  [OPEN_METEO] proxy (CONNECT) succeeded for ${label}`);
      return data;
    } catch (proxyErr) {
      lastProxyError = proxyErr;
      console.warn(`  [OPEN_METEO] proxy (CONNECT) failed for ${label}: ${proxyErr?.message ?? proxyErr}${curlProxyAuth ? '; trying proxy (curl)' : ''}`);
    }
  }

  if (curlProxyAuth) {
    try {
      const text = await Promise.resolve(_proxyCurlFetcher(url, curlProxyAuth, { 'User-Agent': CHROME_UA, Accept: 'application/json' }));
      const data = normalizeArchiveBatchResponse(JSON.parse(text));
      if (data.length !== zones.length) {
        throw new Error(`Open-Meteo proxy (curl) batch size mismatch for ${label}: expected ${zones.length}, got ${data.length}`);
      }
      console.log(`  [OPEN_METEO] proxy (curl) succeeded for ${label}`);
      return data;
    } catch (curlErr) {
      lastProxyError = curlErr;
      console.warn(`  [OPEN_METEO] proxy (curl) failed for ${label}: ${curlErr?.message ?? curlErr}`);
    }
  }

  throw new Error(
    `Open-Meteo retries exhausted for ${label}${lastDirectError ? ` (last direct: ${lastDirectError.message})` : ''}${lastProxyError ? ` (last proxy: ${lastProxyError.message})` : ''}`,
    lastDirectError ? { cause: lastDirectError } : undefined,
  );
}
