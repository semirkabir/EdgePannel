/**
 * FRED (Federal Reserve Economic Data) service.
 * Extracted from the unified economic/index.ts barrel.
 */

import {
  EconomicServiceClient,
  ApiError,
  type GetFredSeriesResponse,
  type GetFredSeriesBatchResponse,
} from '@/generated/client/worldmonitor/economic/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { isFeatureAvailable } from '../runtime-config';

// ---- Client + Circuit Breaker ----

const client = new EconomicServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

const emptyFredBatchFallback: GetFredSeriesBatchResponse = { results: {}, fetched: 0, requested: 0 };
const fredBatchBreaker = createCircuitBreaker<GetFredSeriesBatchResponse>({ name: 'FRED Batch', cacheTtlMs: 15 * 60 * 1000, persistCache: true });

// ---- Types & Config ----

export interface FredSeries {
  id: string;
  name: string;
  value: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  date: string;
  unit: string;
}

interface FredConfig {
  id: string;
  name: string;
  unit: string;
  precision: number;
}

export const FRED_SERIES: FredConfig[] = [
  { id: 'WALCL', name: 'Fed Total Assets', unit: '$B', precision: 0 },
  { id: 'FEDFUNDS', name: 'Fed Funds Rate', unit: '%', precision: 2 },
  { id: 'T10Y2Y', name: '10Y-2Y Spread', unit: '%', precision: 2 },
  { id: 'UNRATE', name: 'Unemployment', unit: '%', precision: 1 },
  { id: 'CPIAUCSL', name: 'CPI Index', unit: '', precision: 1 },
  { id: 'DGS10', name: '10Y Treasury', unit: '%', precision: 2 },
  { id: 'VIXCLS', name: 'VIX', unit: '', precision: 2 },
  // Expanded economic indicators
  { id: 'CPILFESL', name: 'Core CPI', unit: '', precision: 1 },
  { id: 'PCEPI', name: 'PCE Price Index', unit: '', precision: 1 },
  { id: 'PCEPILFE', name: 'Core PCE', unit: '', precision: 1 },
  { id: 'GDPC1', name: 'Real GDP', unit: '$B', precision: 0 },
  { id: 'PAYEMS', name: 'Nonfarm Payrolls', unit: 'K', precision: 0 },
  { id: 'JTSJOL', name: 'JOLTS Job Openings', unit: 'K', precision: 0 },
  { id: 'RSAFS', name: 'Retail Sales', unit: '$M', precision: 0 },
  { id: 'INDPRO', name: 'Industrial Production', unit: '', precision: 1 },
  { id: 'UMCSENT', name: 'Consumer Sentiment', unit: '', precision: 1 },
  { id: 'MORTGAGE30US', name: '30Y Mortgage', unit: '%', precision: 2 },
];

// ---- Functions ----

export async function fetchFredData(): Promise<FredSeries[]> {
  if (!isFeatureAvailable('economicFred')) return [];

  const resp = await fredBatchBreaker.execute(async () => {
    try {
      return await client.getFredSeriesBatch(
        { seriesIds: FRED_SERIES.map((c) => c.id), limit: 120 },
        { signal: AbortSignal.timeout(30_000) },
      );
    } catch (err: unknown) {
      // 404 deploy-skew fallback: batch endpoint not yet deployed, use per-item calls
      if (err instanceof ApiError && err.statusCode === 404) {
        const items = await Promise.all(FRED_SERIES.map((c) =>
          client.getFredSeries({ seriesId: c.id, limit: 120 }, { signal: AbortSignal.timeout(20_000) })
            .catch(() => ({ series: undefined }) as GetFredSeriesResponse),
        ));
        const fallbackResults: Record<string, NonNullable<GetFredSeriesResponse['series']>> = {};
        for (const item of items) {
          if (item.series) fallbackResults[item.series.seriesId] = item.series;
        }
        return { results: fallbackResults, fetched: Object.keys(fallbackResults).length, requested: FRED_SERIES.length };
      }
      throw err;
    }
  }, emptyFredBatchFallback);

  const out: FredSeries[] = [];
  for (const config of FRED_SERIES) {
    const series = resp.results[config.id];
    if (!series) continue;
    const obs = series.observations;
    if (!obs || obs.length === 0) continue;

    if (obs.length >= 2) {
      const latest = obs[obs.length - 1]!;
      const previous = obs[obs.length - 2]!;
      const change = latest.value - previous.value;
      const changePercent = (change / previous.value) * 100;
      let displayValue = latest.value;
      if (config.id === 'WALCL') displayValue = latest.value / 1000;

      out.push({
        id: config.id, name: config.name,
        value: Number(displayValue.toFixed(config.precision)),
        previousValue: Number(previous.value.toFixed(config.precision)),
        change: Number(change.toFixed(config.precision)),
        changePercent: Number(changePercent.toFixed(2)),
        date: latest.date, unit: config.unit,
      });
    } else {
      const latest = obs[0]!;
      let displayValue = latest.value;
      if (config.id === 'WALCL') displayValue = latest.value / 1000;
      out.push({
        id: config.id, name: config.name,
        value: Number(displayValue.toFixed(config.precision)),
        previousValue: null, change: null, changePercent: null,
        date: latest.date, unit: config.unit,
      });
    }
  }
  return out;
}

export function getFredStatus(): string {
  return fredBatchBreaker.getStatus();
}

export function getChangeClass(change: number | null): string {
  if (change === null) return '';
  if (change > 0) return 'positive';
  if (change < 0) return 'negative';
  return '';
}

export function formatChange(change: number | null, unit: string): string {
  if (change === null) return 'N/A';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change}${unit}`;
}
