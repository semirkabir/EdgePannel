import { fetchWithTimeout } from './_relay.js';
import { redisGet, redisSet } from './_redis.js';

const GN_URL_CACHE_TTL = 7 * 24 * 60 * 60;
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BATCH_URL = 'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je&source-path=%2Fsearch&hl=en-US&soc-app=139&soc-platform=1&soc-device=1&rt=c';

export function isGoogleNewsUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== 'news.google.com') return false;
    return /^\/(rss\/)?articles\//.test(u.pathname);
  } catch {
    return false;
  }
}

function extractArticleId(gnUrl) {
  const m = new URL(gnUrl).pathname.match(/\/articles\/([^/?#]+)/);
  return m ? m[1] : null;
}

function extractAttr(html, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

export async function resolveGoogleNewsUrl(rawUrl, { timeoutMs = 10_000, userAgent = CHROME_UA } = {}) {
  const articleId = extractArticleId(rawUrl);
  if (!articleId) throw new Error('Not a Google News article URL');

  const cacheKey = `gn:url:v1:${articleId}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) return cached;
  } catch { /* Redis unavailable */ }

  const wrapperResp = await fetchWithTimeout(rawUrl, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  }, timeoutMs);
  if (!wrapperResp.ok) throw new Error(`Wrapper fetch HTTP ${wrapperResp.status}`);
  const wrapperHtml = await wrapperResp.text();

  const dataId = extractAttr(wrapperHtml, 'data-n-a-id');
  const dataTs = extractAttr(wrapperHtml, 'data-n-a-ts');
  const dataSg = extractAttr(wrapperHtml, 'data-n-a-sg');
  if (!dataId || !dataTs || !dataSg) {
    throw new Error('Missing signature attributes in Google News wrapper');
  }

  const innerReq = JSON.stringify([
    'garturlreq',
    [
      ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
    ],
    dataId,
    Number(dataTs),
    dataSg,
  ]);
  const fReq = JSON.stringify([[['Fbv4je', innerReq, null, 'generic']]]);
  const body = new URLSearchParams({ 'f.req': fReq }).toString();

  const rpcResp = await fetchWithTimeout(BATCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept': '*/*',
    },
    body,
  }, timeoutMs);
  if (!rpcResp.ok) throw new Error(`Batchexecute HTTP ${rpcResp.status}`);
  const text = await rpcResp.text();

  let resolved = null;
  for (const line of text.split('\n')) {
    if (!line.startsWith('[[')) continue;
    let outer;
    try { outer = JSON.parse(line); } catch { continue; }
    if (!Array.isArray(outer)) continue;
    for (const env of outer) {
      if (!Array.isArray(env) || env[0] !== 'wrb.fr') continue;
      const innerStr = env[2];
      if (typeof innerStr !== 'string') continue;
      let inner;
      try { inner = JSON.parse(innerStr); } catch { continue; }
      const urlCandidate = Array.isArray(inner) ? inner[1] : null;
      if (typeof urlCandidate === 'string' && /^https?:\/\//i.test(urlCandidate)) {
        resolved = urlCandidate;
        break;
      }
    }
    if (resolved) break;
  }

  if (!resolved) throw new Error('No URL in batchexecute response');

  let resolvedUrl;
  try { resolvedUrl = new URL(resolved); } catch { throw new Error('Resolved URL is invalid'); }
  if (resolvedUrl.protocol !== 'https:' && resolvedUrl.protocol !== 'http:') {
    throw new Error('Resolved URL has unsupported protocol');
  }
  if (resolvedUrl.hostname === 'news.google.com') {
    throw new Error('Resolved URL still points to Google News');
  }

  try { await redisSet(cacheKey, resolved, GN_URL_CACHE_TTL); } catch { /* ignore */ }

  return resolved;
}
