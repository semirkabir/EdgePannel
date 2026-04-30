/**
 * T0.2 — Reference data / entity resolver.
 *
 * Unified facade for looking up any financial entity by any identifier.
 * Resolution order: Convex cache → live API → static fallback.
 *
 * Cache TTL in Convex is 30 days (driven by `updatedAt`).
 * In-session memoisation: Map<key, EntityRef> for the life of the page.
 */

import { resolveTicker } from './tickers.js';
import { lookupLei } from './lei.js';
import { resolveIsin, resolveTickerToFigi } from './isin.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EntityRef {
  /** Best-known ticker symbol (uppercase). */
  ticker?: string;
  cusip?: string;
  isin?: string;
  lei?: string;
  figi?: string;
  name: string;
  country?: string;
  sector?: string;
  exchange?: string;
  entityType?: string;
}

// ── In-memory session cache ───────────────────────────────────────────────────

const SESSION_CACHE = new Map<string, EntityRef>();

function cacheKey(type: string, value: string): string {
  return `${type}:${value.toUpperCase()}`;
}

function cacheGet(type: string, value: string): EntityRef | undefined {
  return SESSION_CACHE.get(cacheKey(type, value));
}

function cacheSet(type: string, value: string, ref: EntityRef): void {
  SESSION_CACHE.set(cacheKey(type, value), ref);
}

// ── Convex helpers ────────────────────────────────────────────────────────────

const CONVEX_URL = (() => {
  try {
    // @ts-expect-error — Vite define
    return typeof VITE_CONVEX_URL !== 'undefined' ? VITE_CONVEX_URL : '';
  } catch { return ''; }
})();

async function convexLookup(functionName: string, args: Record<string, string>): Promise<EntityRef | null> {
  if (!CONVEX_URL) return null;
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionName, args }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.value ?? data.result ?? null) as EntityRef | null;
  } catch {
    return null;
  }
}

async function convexUpsert(ref: EntityRef): Promise<void> {
  if (!CONVEX_URL) return;
  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'reference:upsertEntityXref', args: ref }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Best-effort; don't block the caller.
  }
}

// ── Public resolver API ───────────────────────────────────────────────────────

/**
 * Resolve a ticker → full EntityRef.
 *
 * Resolution order:
 * 1. Session cache
 * 2. Convex entity_xref (30-day TTL)
 * 3. Finnhub profile API + OpenFIGI FIGI lookup
 * 4. Static TICKER_SECTOR fallback
 */
export async function resolveByTicker(ticker: string): Promise<EntityRef> {
  const upper = ticker.toUpperCase();
  const cached = cacheGet('ticker', upper);
  if (cached) return cached;

  // Convex cache.
  const remote = await convexLookup('reference:lookupByTicker', { ticker: upper });
  if (remote) {
    cacheSet('ticker', upper, remote);
    return remote;
  }

  // Live: Finnhub + OpenFIGI in parallel.
  const [tickerInfo, figiRecord] = await Promise.all([
    resolveTicker(upper),
    resolveTickerToFigi(upper),
  ]);

  const ref: EntityRef = {
    ticker: upper,
    name: tickerInfo?.name ?? upper,
    sector: tickerInfo?.sector,
    exchange: tickerInfo?.exchange ?? figiRecord?.exchCode,
    country: tickerInfo?.country,
    entityType: tickerInfo?.entityType ?? figiRecord?.securityType?.toLowerCase(),
    figi: figiRecord?.figi,
  };

  cacheSet('ticker', upper, ref);
  convexUpsert(ref); // fire-and-forget persistence.
  return ref;
}

/**
 * Resolve an ISIN → EntityRef.
 */
export async function resolveByIsin(isin: string): Promise<EntityRef | null> {
  const upper = isin.toUpperCase();
  const cached = cacheGet('isin', upper);
  if (cached) return cached;

  const remote = await convexLookup('reference:lookupByIsin', { isin: upper });
  if (remote) {
    cacheSet('isin', upper, remote);
    return remote;
  }

  const figiRecords = await resolveIsin(upper);
  const primary = figiRecords[0];
  if (!primary) return null;

  const ref: EntityRef = {
    isin: upper,
    ticker: primary.ticker,
    figi: primary.figi,
    name: primary.name ?? upper,
    exchange: primary.exchCode,
    entityType: primary.securityType?.toLowerCase(),
  };

  cacheSet('isin', upper, ref);
  convexUpsert(ref);
  return ref;
}

/**
 * Resolve a LEI → EntityRef.
 */
export async function resolveByLei(lei: string): Promise<EntityRef | null> {
  const upper = lei.toUpperCase();
  const cached = cacheGet('lei', upper);
  if (cached) return cached;

  const remote = await convexLookup('reference:lookupByLei', { lei: upper });
  if (remote) {
    cacheSet('lei', upper, remote);
    return remote;
  }

  const leiRecord = await lookupLei(upper);
  if (!leiRecord) return null;

  const ref: EntityRef = {
    lei: upper,
    name: leiRecord.name,
    country: leiRecord.country,
    entityType: 'company',
  };

  cacheSet('lei', upper, ref);
  convexUpsert(ref);
  return ref;
}

/**
 * Best-effort resolve with any identifier. Detects format automatically.
 *  - 20-char alphanumeric → LEI
 *  - 12-char alphanumeric → ISIN
 *  - Everything else → ticker
 */
export async function resolve(id: string): Promise<EntityRef | null> {
  const upper = id.toUpperCase().trim();
  if (!upper) return null;

  if (/^[A-Z0-9]{20}$/.test(upper)) return resolveByLei(upper);
  if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(upper)) return resolveByIsin(upper);
  return resolveByTicker(upper);
}

/** Clear session cache (useful in tests or after logout). */
export function clearSessionCache(): void {
  SESSION_CACHE.clear();
}
