import { isDesktopRuntime, toRuntimeUrl } from '../services/runtime';
import { getPersistentCache, setPersistentCache, cacheAgeMs } from '../services/persistent-cache';

const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? {};
const isDev = Boolean(viteEnv.DEV);
const RESPONSE_CACHE_PREFIX = 'api-response:';

// RSS proxy: route directly to Railway relay via Cloudflare CDN when enabled.
// Feature flag controls rollout; default off for safe staged deployment.
const RSS_DIRECT_TO_RELAY = viteEnv.VITE_RSS_DIRECT_TO_RELAY === 'true';
const RSS_PROXY_BASE = isDev
  ? '' // Dev uses Vite's rssProxyPlugin
  : RSS_DIRECT_TO_RELAY
    ? 'https://proxy.edgepannel.com'
    : '';

export function rssProxyUrl(feedUrl: string): string {
  if (isDesktopRuntime()) return proxyUrl(feedUrl);
  if (RSS_PROXY_BASE) {
    return `${RSS_PROXY_BASE}/rss?url=${encodeURIComponent(feedUrl)}`;
  }
  return `/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`;
}

type CachedResponsePayload = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
};

// In production browser deployments, routes are handled by Vercel serverless functions.
// In local dev, Vite proxy handles these routes.
// In Tauri desktop mode, route requests need an absolute remote host.
export function proxyUrl(localPath: string): string {
  if (isDesktopRuntime()) {
    return toRuntimeUrl(localPath);
  }

  if (isDev) {
    return localPath;
  }

  return localPath;
}

function shouldPersistResponse(url: string): boolean {
  return url.startsWith('/api/');
}

function buildResponseCacheKey(url: string): string {
  return `${RESPONSE_CACHE_PREFIX}${url}`;
}

function toCachedPayload(url: string, response: Response, body: string): CachedResponsePayload {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    url,
    status: response.status,
    statusText: response.statusText,
    headers,
    body,
  };
}

function toResponse(payload: CachedResponsePayload): Response {
  return new Response(payload.body, {
    status: payload.status,
    statusText: payload.statusText,
    headers: payload.headers,
  });
}

async function fetchAndPersist(url: string): Promise<Response> {
  const response = await fetch(proxyUrl(url));
  if (response.ok && shouldPersistResponse(url)) {
    try {
      const body = await response.clone().text();
      void setPersistentCache(buildResponseCacheKey(url), toCachedPayload(url, response, body));
    } catch (error) {
      console.warn('[proxy] Failed to persist API response cache', error);
    }
  }
  return response;
}

const DEFAULT_MAX_CACHE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function fetchWithProxy(url: string, maxAgeMs = DEFAULT_MAX_CACHE_AGE_MS): Promise<Response> {
  if (!shouldPersistResponse(url)) {
    return fetch(proxyUrl(url));
  }

  const cacheKey = buildResponseCacheKey(url);
  const cached = await getPersistentCache<CachedResponsePayload>(cacheKey);

  if (cached?.data) {
    const isStale = cacheAgeMs(cached.updatedAt) >= maxAgeMs;
    if (isStale) {
      // Cache is too old — try a foreground fetch, fall back to stale data if offline/failed
      try {
        return await fetchAndPersist(url);
      } catch {
        return toResponse(cached.data);
      }
    }
    // Fresh enough — return immediately and refresh in background
    void fetchAndPersist(url).catch((error) => {
      console.warn('[proxy] Background refresh failed for cached API response', error);
    });
    return toResponse(cached.data);
  }

  return fetchAndPersist(url);
}
