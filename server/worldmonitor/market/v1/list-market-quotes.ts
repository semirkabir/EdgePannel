/**
 * RPC: ListMarketQuotes
 * Fetches stock/index quotes from Finnhub (stocks) and Yahoo Finance (indices/futures).
 */
import type {
  ServerContext,
  ListMarketQuotesRequest,
  ListMarketQuotesResponse,
  MarketQuote,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { YAHOO_ONLY_SYMBOLS, fetchFinnhubQuote, fetchYahooQuotesBatch, parseStringArray } from './_shared';
import { cachedFetchJson, getCachedJson } from '../../../_shared/redis';

const REDIS_CACHE_KEY = 'market:quotes:v1';
const REDIS_CACHE_TTL = 480; // 8 min — shared across all Vercel instances

const quotesCache = new Map<string, { data: ListMarketQuotesResponse; timestamp: number }>();
const QUOTES_CACHE_TTL = 480_000; // 8 minutes (in-memory fallback)
const FINNHUB_MIN_GAP_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cacheKey(symbols: string[]): string {
  return [...symbols].sort().join(',');
}

function redisCacheKey(symbols: string[]): string {
  return `${REDIS_CACHE_KEY}:${[...symbols].sort().join(',')}`;
}

export function filterBootstrapQuotesForSymbols(
  bootstrap: Pick<ListMarketQuotesResponse, 'quotes'> | null | undefined,
  symbols: string[],
): { quotes: MarketQuote[]; fullyCovered: boolean } {
  if (!bootstrap?.quotes?.length || symbols.length === 0) {
    return { quotes: [], fullyCovered: false };
  }

  const symbolSet = new Set(symbols);
  const quotes = bootstrap.quotes.filter((q: MarketQuote) => symbolSet.has(q.symbol));
  const coveredSymbols = new Set(quotes.map((q) => q.symbol));
  return {
    quotes,
    fullyCovered: symbols.every((symbol) => coveredSymbols.has(symbol)),
  };
}

export function mergeMarketQuotesForSymbols(
  symbols: string[],
  fallbackQuotes: MarketQuote[],
  freshQuotes: MarketQuote[],
): MarketQuote[] {
  const bySymbol = new Map<string, MarketQuote>();
  for (const quote of fallbackQuotes) bySymbol.set(quote.symbol, quote);
  for (const quote of freshQuotes) bySymbol.set(quote.symbol, quote);
  return symbols
    .map((symbol) => bySymbol.get(symbol))
    .filter((quote): quote is MarketQuote => !!quote);
}

export async function listMarketQuotes(
  _ctx: ServerContext,
  req: ListMarketQuotesRequest,
): Promise<ListMarketQuotesResponse> {
  const now = Date.now();
  const parsedSymbols = parseStringArray(req.symbols);
  const key = cacheKey(parsedSymbols);
  let bootstrapFallback: ListMarketQuotesResponse | null = null;

  // Layer 0: bootstrap/seed data (written by Railway ais-relay)
  try {
    const bootstrap = await getCachedJson('market:stocks-bootstrap:v1', true) as ListMarketQuotesResponse | null;
    const filtered = filterBootstrapQuotesForSymbols(bootstrap, parsedSymbols);
    if (filtered.quotes.length > 0) {
      const resp: ListMarketQuotesResponse = { quotes: filtered.quotes, finnhubSkipped: false, skipReason: '', rateLimited: false };
      if (filtered.fullyCovered) {
        quotesCache.set(key, { data: resp, timestamp: now });
        return resp;
      }
      bootstrapFallback = resp;
    }
  } catch {
    bootstrapFallback = null;
  }

  // Layer 1: in-memory cache (same instance)
  const memCached = quotesCache.get(key);
  if (memCached && now - memCached.timestamp < QUOTES_CACHE_TTL) {
    return memCached.data;
  }

  const redisKey = redisCacheKey(parsedSymbols);

  try {
  const result = await cachedFetchJson<ListMarketQuotesResponse>(redisKey, REDIS_CACHE_TTL, async () => {
    const apiKey = process.env.FINNHUB_API_KEY;
    const symbols = parsedSymbols;
    if (!symbols.length) return { quotes: [], finnhubSkipped: !apiKey, skipReason: !apiKey ? 'FINNHUB_API_KEY not configured' : '', rateLimited: false };

    const finnhubSymbols = symbols.filter((s) => !YAHOO_ONLY_SYMBOLS.has(s));
    const yahooSymbols = symbols.filter((s) => YAHOO_ONLY_SYMBOLS.has(s));

    const quotes: MarketQuote[] = [];

    // Fetch Finnhub quotes (only if API key is set)
    if (finnhubSymbols.length > 0 && apiKey) {
      const results: Array<Awaited<ReturnType<typeof fetchFinnhubQuote>>> = [];
      for (let i = 0; i < finnhubSymbols.length; i++) {
        if (i > 0) await sleep(FINNHUB_MIN_GAP_MS);
        results.push(await fetchFinnhubQuote(finnhubSymbols[i]!, apiKey));
      }
      for (const r of results) {
        if (r) {
          quotes.push({
            symbol: r.symbol,
            name: r.symbol,
            display: r.symbol,
            price: r.price,
            change: r.changePercent,
            sparkline: [],
          });
        }
      }
    }

    // Fallback: route Finnhub symbols through Yahoo when key is missing
    const missedFinnhub = apiKey
      ? finnhubSymbols.filter((s) => !quotes.some((q) => q.symbol === s))
      : finnhubSymbols;
    const allYahoo = [...yahooSymbols, ...missedFinnhub];

    // Fetch Yahoo Finance quotes (staggered to avoid 429)
    if (allYahoo.length > 0) {
      const batch = await fetchYahooQuotesBatch(allYahoo);
      for (const s of allYahoo) {
        if (quotes.some((q) => q.symbol === s)) continue;
        const yahoo = batch.results.get(s);
        if (yahoo) {
          quotes.push({
            symbol: s,
            name: s,
            display: s,
            price: yahoo.price,
            change: yahoo.change,
            sparkline: yahoo.sparkline,
          });
        }
      }
    }

    // If Yahoo rate-limited and no fresh data, return null — outer handler serves stale
    if (quotes.length === 0 && memCached) {
      return null;
    }

    if (quotes.length === 0) {
      return null; // negative cache (120s) — never cache empty results at full TTL
    }

    // Only report skipped if Finnhub key missing AND Yahoo fallback didn't cover the gap
    const coveredByYahoo = finnhubSymbols.every((s) => quotes.some((q) => q.symbol === s));
    const skipped = !apiKey && !coveredByYahoo;
    return { quotes, finnhubSkipped: skipped, skipReason: skipped ? 'FINNHUB_API_KEY not configured' : '', rateLimited: false };
  });

  const mergedResult = result?.quotes?.length && bootstrapFallback?.quotes?.length
    ? {
        ...result,
        quotes: mergeMarketQuotesForSymbols(parsedSymbols, bootstrapFallback.quotes, result.quotes),
      }
    : result;

  if (mergedResult?.quotes?.length) {
    quotesCache.set(key, { data: mergedResult, timestamp: now });
  }

  return mergedResult || memCached?.data || bootstrapFallback || { quotes: [], finnhubSkipped: false, skipReason: '', rateLimited: false };
  } catch {
    return memCached?.data || bootstrapFallback || { quotes: [], finnhubSkipped: false, skipReason: '', rateLimited: false };
  }
}
