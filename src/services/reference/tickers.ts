/**
 * Ticker resolver — maps ticker symbols to full entity metadata.
 *
 * Primary source: Finnhub symbol search (free tier).
 * Fallback: static TICKER_SECTOR mapping from portfolio service.
 */

import { getTickerSector } from '../market/portfolio.js';

const FINNHUB_KEY = (() => {
  try {
    // @ts-expect-error — Vite define
    return typeof VITE_FINNHUB_API_KEY !== 'undefined' ? VITE_FINNHUB_API_KEY : '';
  } catch {
    return '';
  }
})();

export interface TickerInfo {
  ticker: string;
  name: string;
  sector?: string;
  exchange?: string;
  country?: string;
  currency?: string;
  entityType?: string;
}

/** Search Finnhub for a ticker and return structured metadata. */
export async function resolveTicker(ticker: string): Promise<TickerInfo | null> {
  const upper = ticker.toUpperCase();

  // Fast path: local static mapping covers ~150 major tickers.
  const staticSector = getTickerSector(upper);
  const staticResult: TickerInfo = { ticker: upper, name: upper, sector: staticSector };

  if (!FINNHUB_KEY) return staticResult;

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(upper)}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return staticResult;
    const data = await res.json();
    if (!data?.name) return staticResult;

    return {
      ticker: upper,
      name: data.name,
      sector: data.finnhubIndustry || staticSector,
      exchange: data.exchange,
      country: data.country,
      currency: data.currency,
      entityType: data.type === 'ETP' ? 'etf' : 'company',
    };
  } catch {
    return staticResult;
  }
}

/** Batch lookup — calls resolveTicker in parallel with concurrency limit. */
export async function resolveTickerBatch(tickers: string[], concurrency = 5): Promise<Map<string, TickerInfo>> {
  const result = new Map<string, TickerInfo>();
  const chunks: string[][] = [];
  for (let i = 0; i < tickers.length; i += concurrency) {
    chunks.push(tickers.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    const resolved = await Promise.all(chunk.map((t) => resolveTicker(t)));
    chunk.forEach((t, i) => {
      const info = resolved[i];
      if (info) result.set(t.toUpperCase(), info);
    });
  }
  return result;
}
