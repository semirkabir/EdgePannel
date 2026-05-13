/**
 * T0.2 — Reference entity resolution endpoint.
 *
 * GET /api/reference/resolve?ticker=AAPL
 * GET /api/reference/resolve?isin=US0378331005
 * GET /api/reference/resolve?lei=HWUPKR0MPOU8FGXBT394
 * GET /api/reference/resolve?q=AAPL          (auto-detect type)
 *
 * Resolution order: Convex cache → live APIs → static fallback.
 * Results are written back to Convex for future cache hits.
 * Responses cached by Vercel CDN for 24 h.
 */

import { getCorsHeaders, isDisallowedOrigin } from '../_cors.js';
import { checkRateLimit } from '../_rate-limit.js';

export const config = { runtime: 'edge' };

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const OPENFIGI_KEY = process.env.OPENFIGI_API_KEY || '';
const GLEIF_BASE = 'https://api.gleif.org/api/v1';

function getConvex() {
  const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  const token = process.env.CONVEX_ADMIN_TOKEN;
  return url && token ? { url, token } : null;
}

async function convexQuery(path, args) {
  const c = getConvex();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({ path, args }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? data.result ?? null;
  } catch { return null; }
}

async function convexUpsert(args) {
  const c = getConvex();
  if (!c) return;
  try {
    await fetch(`${c.url}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({ path: 'reference:upsertEntityXref', args }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch { /* best-effort */ }
}

// ── Source fetchers ───────────────────────────────────────────────────────────

async function fetchFinnhub(ticker) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.name) return null;
    return {
      ticker: ticker.toUpperCase(),
      name: d.name,
      sector: d.finnhubIndustry,
      exchange: d.exchange,
      country: d.country,
      entityType: d.type === 'ETP' ? 'etf' : 'company',
    };
  } catch { return null; }
}

async function fetchOpenFigi(idType, idValue) {
  try {
    const headers = { 'Content-Type': 'text/json' };
    if (OPENFIGI_KEY) headers['X-OPENFIGI-APIKEY'] = OPENFIGI_KEY;
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ idType, idValue }]),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.data?.[0] ?? null;
  } catch { return null; }
}

async function fetchGleif(lei) {
  try {
    const res = await fetch(`${GLEIF_BASE}/lei-records/${encodeURIComponent(lei)}`, {
      headers: { Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data?.data?.attributes;
    if (!attrs) return null;
    const entity = attrs.entity;
    return {
      lei: lei.toUpperCase(),
      name: entity?.legalName?.name ?? '',
      country: entity?.legalAddress?.country,
      entityType: 'company',
    };
  } catch { return null; }
}

// ── Resolution logic ──────────────────────────────────────────────────────────

async function resolveTicker(ticker) {
  const upper = ticker.toUpperCase();
  const cached = await convexQuery('reference:lookupByTicker', { ticker: upper });
  if (cached) return cached;

  const [profile, figi] = await Promise.all([
    fetchFinnhub(upper),
    fetchOpenFigi('TICKER', upper),
  ]);

  if (!profile && !figi) return { ticker: upper, name: upper };

  const ref = {
    ticker: upper,
    name: profile?.name ?? upper,
    sector: profile?.sector,
    exchange: profile?.exchange ?? figi?.exchCode,
    country: profile?.country,
    entityType: profile?.entityType ?? figi?.securityType?.toLowerCase(),
    figi: figi?.figi,
  };
  convexUpsert(ref);
  return ref;
}

async function resolveIsin(isin) {
  const upper = isin.toUpperCase();
  const cached = await convexQuery('reference:lookupByIsin', { isin: upper });
  if (cached) return cached;

  const figi = await fetchOpenFigi('ID_ISIN', upper);
  if (!figi) return null;

  const ref = { isin: upper, ticker: figi.ticker, figi: figi.figi, name: figi.name ?? upper, exchange: figi.exchCode };
  convexUpsert(ref);
  return ref;
}

async function resolveLei(lei) {
  const upper = lei.toUpperCase();
  const cached = await convexQuery('reference:lookupByLei', { lei: upper });
  if (cached) return cached;

  const gleif = await fetchGleif(upper);
  if (!gleif) return null;

  convexUpsert(gleif);
  return gleif;
}

function detectType(q) {
  const upper = q.toUpperCase().trim();
  if (/^[A-Z0-9]{20}$/.test(upper)) return 'lei';
  if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(upper)) return 'isin';
  return 'ticker';
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req) {
  const cors = getCorsHeaders(req, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (isDisallowedOrigin(req)) return new Response('Forbidden', { status: 403, headers: cors });

  const rateLimited = await checkRateLimit(req, cors);
  if (rateLimited) return rateLimited;

  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker')?.trim();
  const isin = url.searchParams.get('isin')?.trim();
  const lei = url.searchParams.get('lei')?.trim();
  const q = url.searchParams.get('q')?.trim();

  let result = null;
  let type = null;

  if (ticker) { type = 'ticker'; result = await resolveTicker(ticker); }
  else if (isin) { type = 'isin'; result = await resolveIsin(isin); }
  else if (lei) { type = 'lei'; result = await resolveLei(lei); }
  else if (q) {
    type = detectType(q);
    if (type === 'ticker') result = await resolveTicker(q);
    else if (type === 'isin') result = await resolveIsin(q);
    else result = await resolveLei(q);
  } else {
    return new Response(
      JSON.stringify({ error: 'Provide ?ticker=, ?isin=, ?lei=, or ?q= parameter' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  if (!result) {
    return new Response(JSON.stringify({ error: 'Entity not found' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ type, ...result, resolvedAt: new Date().toISOString() }), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
