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
import { UPSTREAM_TIMEOUT_MS, parseStringArray } from './_shared';
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

const inMemoryCache = new Map<string, { data: ListHistoricalPricesResponse; timestamp: number }>();
const IN_MEMORY_CACHE_TTL = 900_000; // 15 minutes

function fetchHistoricalChart(symbol: string, months: number): Promise<HistoricalChartResponse | null> {
  const range = months <= 1 ? '1mo' : months <= 3 ? '3mo' : months <= 6 ? '6mo' : months <= 12 ? '1y' : '2y';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;

  return yahooGate().then(() =>
    fetch(url, {
      headers: { 'User-Agent': CHROME_UA },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }).then(async (resp) => {
      if (!resp.ok) return null;
      return (await resp.json()) as HistoricalChartResponse;
    }).catch(() => null)
  );
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
          const chart = await fetchHistoricalChart(symbol, months);
          if (chart) {
            const parsed = parseHistoricalData(chart, symbol);
            if (parsed) {
              series.push(parsed);
              consecutiveFails = 0;
              continue;
            }
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
