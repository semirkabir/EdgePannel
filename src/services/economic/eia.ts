/**
 * EIA/Energy analytics service.
 * Extracted from the unified economic/index.ts barrel.
 */

import {
  EconomicServiceClient,
  type GetEnergyPricesResponse,
  type EnergyPrice as ProtoEnergyPrice,
  type GetEnergyCapacityResponse,
} from '@/generated/client/worldmonitor/economic/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getCSSColor } from '@/utils';
import { isFeatureAvailable } from '../runtime-config';
import { dataFreshness } from '../data-freshness';

// ---- Client + Circuit Breakers ----

const client = new EconomicServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

const eiaBreaker = createCircuitBreaker<GetEnergyPricesResponse>({ name: 'EIA Energy', cacheTtlMs: 15 * 60 * 1000, persistCache: true });
const capacityBreaker = createCircuitBreaker<GetEnergyCapacityResponse>({ name: 'EIA Capacity', cacheTtlMs: 30 * 60 * 1000, persistCache: true });

const emptyEiaFallback: GetEnergyPricesResponse = { prices: [] };
const emptyCapacityFallback: GetEnergyCapacityResponse = { series: [] };

// ---- Runtime cache (for popup enrichment without async) ----
let _cachedOilAnalytics: OilAnalytics | null = null;

export function getCachedOilAnalytics(): OilAnalytics | null {
  return _cachedOilAnalytics;
}

// ---- Types ----

export interface OilDataPoint {
  date: string;
  value: number;
  unit: string;
}

export interface OilMetric {
  id: string;
  name: string;
  description: string;
  current: number;
  previous: number;
  changePct: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

export interface OilAnalytics {
  wtiPrice: OilMetric | null;
  brentPrice: OilMetric | null;
  usProduction: OilMetric | null;
  usInventory: OilMetric | null;
  fetchedAt: Date;
}

// ---- Helpers ----

function protoEnergyToOilMetric(proto: ProtoEnergyPrice): OilMetric {
  const change = proto.change;
  return {
    id: proto.commodity,
    name: proto.name,
    description: `${proto.name} price/volume`,
    current: proto.price,
    previous: change !== 0 ? proto.price / (1 + change / 100) : proto.price,
    changePct: Math.round(change * 10) / 10,
    unit: proto.unit,
    trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable',
    lastUpdated: proto.priceAt ? new Date(proto.priceAt).toISOString() : new Date().toISOString(),
  };
}

// ---- Functions ----

export async function checkEiaStatus(): Promise<boolean> {
  if (!isFeatureAvailable('energyEia')) return false;
  try {
    const resp = await eiaBreaker.execute(async () => {
      return client.getEnergyPrices({ commodities: ['wti'] }, { signal: AbortSignal.timeout(20_000) });
    }, emptyEiaFallback);
    return resp.prices.length > 0;
  } catch {
    return false;
  }
}

export async function fetchOilAnalytics(): Promise<OilAnalytics> {
  const empty: OilAnalytics = {
    wtiPrice: null, brentPrice: null, usProduction: null, usInventory: null, fetchedAt: new Date(),
  };

  if (!isFeatureAvailable('energyEia')) return empty;

  try {
    const resp = await eiaBreaker.execute(async () => {
      return client.getEnergyPrices({ commodities: [] }, { signal: AbortSignal.timeout(20_000) }); // all commodities
    }, emptyEiaFallback);

    const byId = new Map<string, ProtoEnergyPrice>();
    for (const p of resp.prices) byId.set(p.commodity, p);

    const result: OilAnalytics = {
      wtiPrice: byId.has('wti') ? protoEnergyToOilMetric(byId.get('wti')!) : null,
      brentPrice: byId.has('brent') ? protoEnergyToOilMetric(byId.get('brent')!) : null,
      usProduction: byId.has('production') ? protoEnergyToOilMetric(byId.get('production')!) : null,
      usInventory: byId.has('inventory') ? protoEnergyToOilMetric(byId.get('inventory')!) : null,
      fetchedAt: new Date(),
    };

    const metricCount = [result.wtiPrice, result.brentPrice, result.usProduction, result.usInventory]
      .filter(Boolean).length;
    if (metricCount > 0) {
      dataFreshness.recordUpdate('oil', metricCount);
    }

    _cachedOilAnalytics = result;
    return result;
  } catch {
    dataFreshness.recordError('oil', 'Fetch failed');
    return empty;
  }
}

export function formatOilValue(value: number, unit: string): string {
  const v = Number(value);
  if (!Number.isFinite(v)) return '—';
  if (unit.includes('$')) return `$${v.toFixed(2)}`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(1);
}

export function getTrendIndicator(trend: OilMetric['trend']): string {
  switch (trend) {
    case 'up': return '\u25B2';
    case 'down': return '\u25BC';
    default: return '\u25CF';
  }
}

export function getTrendColor(trend: OilMetric['trend'], inverse = false): string {
  const upColor = inverse ? getCSSColor('--semantic-normal') : getCSSColor('--semantic-critical');
  const downColor = inverse ? getCSSColor('--semantic-critical') : getCSSColor('--semantic-normal');
  switch (trend) {
    case 'up': return upColor;
    case 'down': return downColor;
    default: return getCSSColor('--text-dim');
  }
}

export async function fetchEnergyCapacityRpc(
  energySources?: string[],
  years?: number,
): Promise<GetEnergyCapacityResponse> {
  if (!isFeatureAvailable('energyEia')) return emptyCapacityFallback;
  try {
    return await capacityBreaker.execute(async () => {
      return client.getEnergyCapacity({
        energySources: energySources ?? [],
        years: years ?? 0,
      }, { signal: AbortSignal.timeout(20_000) });
    }, emptyCapacityFallback);
  } catch {
    return emptyCapacityFallback;
  }
}
