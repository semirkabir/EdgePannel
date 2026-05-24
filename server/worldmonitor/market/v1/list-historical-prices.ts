/**
 * RPC: ListHistoricalPrices
 * Fetches historical daily OHLCV from Yahoo Finance for portfolio visualization.
 */
import type {
  ServerContext,
  ListHistoricalPricesRequest,
  ListHistoricalPricesResponse,
  PriceSeries,
  DailyPrice,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { UPSTREAM_TIMEOUT_MS, parseStringArray, getRelayBaseUrl, getRelayHeaders } from './_shared';
import { CHROME_UA, yahooGate } from '../../../_shared/constants';
import { cachedFetchJson } from '../../../_shared/redis';

const REDIS_CACHE_KEY = 'market:historical-prices:v1';
const REDIS_CACHE_TTL = 900; // 15 min — historical daily data, slow-moving

interface HistoricalChartResponse {
  chart: {
    result: Array<{
      meta: { regularMarketPrice: number };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
}

interface FinnhubCandleResponse {
  s: string; // 'ok' or 'no_data'
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  t?: number[];
  v?: number[];
}

const inMemoryCache = new Map<string, { data: ListHistoricalPricesResponse; timestamp: number }>();
const IN_MEMORY_CACHE_TTL = 900_000; // 15 minutes

async function fetchHistoricalChart(symbol: string, months: number): Promise<HistoricalChartResponse | null> {
  const range = months <= 1 ? '1mo' : months <= 3 ? '3mo' : months <= 6 ? '6mo' : months <= 12 ? '1y' : '2y';
  const path = `v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;

  // Try both Yahoo hosts — query1 and query2 have independent rate limits
  for (const host of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
    try {
      await yahooGate();
      const resp = await fetch(`${host}/${path}`, {
        headers: {
          'User-Agent': CHROME_UA,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (resp.ok) {
        return (await resp.json()) as HistoricalChartResponse;
      }
      if (resp.status !== 429 && resp.status !== 403) {
        console.warn(`[list-historical-prices] Yahoo ${host} HTTP ${resp.status} for ${symbol}`);
        break; // Non-rate-limit error, don't retry other host
      }
      console.warn(`[list-historical-prices] Yahoo ${host} HTTP ${resp.status} for ${symbol}, trying next host`);
    } catch (err) {
      console.warn(`[list-historical-prices] Yahoo ${host} error for ${symbol}:`, (err as Error).message);
    }
  }

  // Fallback: Railway relay (different IP, avoids rate-limiting)
  const relayBase = getRelayBaseUrl();
  if (relayBase) {
    try {
      const relayUrl = `${relayBase}/yahoo-chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1d`;
      const resp = await fetch(relayUrl, {
        headers: getRelayHeaders(),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (resp.ok) {
        return (await resp.json()) as HistoricalChartResponse;
      }
      console.warn(`[list-historical-prices] Yahoo relay HTTP ${resp.status} for ${symbol}`);
    } catch (err) {
      console.warn(`[list-historical-prices] Yahoo relay error for ${symbol}:`, (err as Error).message);
    }
  }

  return null;
}

async function fetchFinnhubCandles(symbol: string, months: number): Promise<PriceSeries | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.round(months * 30.44 * 86400);
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}`;

  try {
    const resp = await fetch(url, {
      headers: { 'X-Finnhub-Token': apiKey },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn(`[list-historical-prices] Finnhub candle HTTP ${resp.status} for ${symbol}`);
      return null;
    }
    const data = (await resp.json()) as FinnhubCandleResponse;
    if (data.s !== 'ok' || !data.t?.length || !data.c?.length) return null;

    const prices: DailyPrice[] = [];
    for (let i = 0; i < data.t.length; i++) {
      const close = data.c[i];
      const volume = data.v?.[i];
      if (close != null && Number.isFinite(close)) {
        prices.push({
          date: new Date(data.t[i]! * 1000).toISOString().slice(0, 10),
          close,
          volume: volume != null ? String(Math.round(volume)) : '0',
        });
      }
    }
    return prices.length >= 2 ? { symbol, prices } : null;
  } catch (err) {
    console.warn(`[list-historical-prices] Finnhub candle error for ${symbol}:`, (err as Error).message);
    return null;
  }
}

async function fetchStooqHistory(symbol: string, months: number): Promise<PriceSeries | null> {
  // Stooq provides free daily OHLCV; US equities use the ".us" suffix
  const stooqSymbol = `${symbol.toLowerCase()}.us`;
  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setMonth(fromDate.getMonth() - months);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&d1=${fmt(fromDate)}&d2=${fmt(toDate)}&i=d`;

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn(`[list-historical-prices] Stooq HTTP ${resp.status} for ${symbol}`);
      return null;
    }
    const text = await resp.text();
    const lines = text.trim().split('\n');
    console.log(`[list-historical-prices] Stooq ${symbol}: HTTP ${resp.status}, ${lines.length} lines, first: ${lines[0]?.slice(0, 80)}`);
    if (lines.length < 2) return null;

    // Header: Date,Open,High,Low,Close,Volume
    const prices: DailyPrice[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(',');
      if (parts.length < 5) continue;
      const date = parts[0]!.trim(); // YYYY-MM-DD
      const close = parseFloat(parts[4]!.trim());
      const volume = parts[5] ? parts[5].trim() : '0';
      if (date && Number.isFinite(close) && close > 0) {
        prices.push({ date, close, volume });
      }
    }
    return prices.length >= 2 ? { symbol, prices } : null;
  } catch (err) {
    console.warn(`[list-historical-prices] Stooq error for ${symbol}:`, (err as Error).message);
    return null;
  }
}

function parseHistoricalData(chart: HistoricalChartResponse, symbol: string): PriceSeries | null {
  try {
    const result = chart?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    if (timestamps.length === 0 || closes.length === 0) return null;

    const prices: DailyPrice[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      const volume = volumes[i];
      if (close != null) {
        const date = new Date(timestamps[i]! * 1000).toISOString().slice(0, 10);
        prices.push({
          date,
          close,
          volume: volume != null ? String(Math.round(volume)) : '0',
        });
      }
    }

    if (prices.length === 0) return null;

    return { symbol, prices };
  } catch {
    return null;
  }
}

export async function listHistoricalPrices(
  _ctx: ServerContext,
  req: ListHistoricalPricesRequest,
): Promise<ListHistoricalPricesResponse> {
  const symbols = parseStringArray(req.symbols).slice(0, 20);
  const months = Math.max(1, Math.min(60, req.months || 24));

  if (symbols.length === 0) {
    return { series: [] };
  }

  const now = Date.now();
  const cacheKey = `${symbols.sort().join(',')}:m${months}`;

  const memCached = inMemoryCache.get(cacheKey);
  if (memCached && now - memCached.timestamp < IN_MEMORY_CACHE_TTL) {
    return memCached.data;
  }

  const redisKey = `${REDIS_CACHE_KEY}:${cacheKey}`;

  try {
    const result = await cachedFetchJson<ListHistoricalPricesResponse>(redisKey, REDIS_CACHE_TTL, async () => {
      const series: PriceSeries[] = [];
      let consecutiveFails = 0;

      for (const symbol of symbols) {
        try {
          // Yahoo Finance first
          const chart = await fetchHistoricalChart(symbol, months);
          if (chart) {
            const parsed = parseHistoricalData(chart, symbol);
            if (parsed) {
              series.push(parsed);
              consecutiveFails = 0;
              continue;
            }
          }
          // Finnhub candles fallback
          const finnhub = await fetchFinnhubCandles(symbol, months);
          if (finnhub) {
            series.push(finnhub);
            consecutiveFails = 0;
            continue;
          }
          // Stooq free historical data fallback
          const stooq = await fetchStooqHistory(symbol, months);
          if (stooq) {
            series.push(stooq);
            consecutiveFails = 0;
            continue;
          }
          consecutiveFails++;
          if (consecutiveFails >= 5) break;
        } catch {
          consecutiveFails++;
          if (consecutiveFails >= 5) break;
        }
      }

      if (series.length === 0 && memCached) {
        return null;
      }

      return series.length > 0 ? { series } : null;
    });

    if (result?.series?.length) {
      inMemoryCache.set(cacheKey, { data: result, timestamp: now });
    }

    return result || memCached?.data || { series: [] };
  } catch {
    return memCached?.data || { series: [] };
  }
}
