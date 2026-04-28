/**
 * Renewable energy data service -- displays World Bank renewable electricity
 * indicator (EG.ELC.RNEW.ZS) for global + regional breakdown.
 *
 * Data is pre-seeded by seed-wb-indicators.mjs on Railway and read
 * from bootstrap/Redis. Never calls WB API from the frontend.
 *
 * EIA installed capacity (solar, wind, coal) still uses the RPC
 * endpoint since it's a different data source (not World Bank).
 */

import { fetchEnergyCapacityRpc } from '@/services/economic';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';

// ---- Types ----

export interface RegionRenewableData {
  code: string;       // World Bank region code (e.g., "1W", "EAS")
  name: string;       // Human-readable name (e.g., "World", "East Asia & Pacific")
  percentage: number;  // Latest renewable electricity % value
  year: number;       // Year of latest data point
}

export interface RenewableEnergyData {
  globalPercentage: number;          // Latest global renewable electricity %
  globalYear: number;                // Year of latest global data
  historicalData: Array<{ year: number; value: number }>;  // Global time-series
  regions: RegionRenewableData[];    // Regional breakdown
  gridCarbon?: GridCarbonSnapshot;    // Optional public grid-carbon context
}

export interface GridCarbonSnapshot {
  source: 'GB Carbon Intensity API';
  sourceUrl: string;
  location: string;
  status: 'live' | 'cached' | 'unavailable';
  carbonIntensityGco2Kwh: number | null;
  index: 'very low' | 'low' | 'moderate' | 'high' | 'very high' | 'unknown';
  observedFrom: string | null;
  observedTo: string | null;
  updatedAt: string;
  message?: string;
}

// ---- Default / Empty ----

// Static fallback when seed data is unavailable and no cache exists.
// Source: https://data.worldbank.org/indicator/EG.ELC.RNEW.ZS — last verified Feb 2026
const FALLBACK_DATA: RenewableEnergyData = {
  globalPercentage: 29.6,
  globalYear: 2022,
  historicalData: [
    { year: 1990, value: 19.8 }, { year: 1995, value: 19.2 }, { year: 2000, value: 18.6 },
    { year: 2005, value: 18.0 }, { year: 2010, value: 20.3 }, { year: 2012, value: 21.6 },
    { year: 2014, value: 22.6 }, { year: 2016, value: 24.0 }, { year: 2018, value: 25.7 },
    { year: 2020, value: 28.2 }, { year: 2021, value: 28.7 }, { year: 2022, value: 29.6 },
  ],
  regions: [
    { code: 'LCN', name: 'Latin America & Caribbean', percentage: 58.1, year: 2022 },
    { code: 'SSF', name: 'Sub-Saharan Africa', percentage: 47.2, year: 2022 },
    { code: 'ECS', name: 'Europe & Central Asia', percentage: 35.8, year: 2022 },
    { code: 'SAS', name: 'South Asia', percentage: 22.1, year: 2022 },
    { code: 'EAS', name: 'East Asia & Pacific', percentage: 21.9, year: 2022 },
    { code: 'NAC', name: 'North America', percentage: 21.5, year: 2022 },
    { code: 'MEA', name: 'Middle East & N. Africa', percentage: 5.3, year: 2022 },
  ],
};

// ---- Circuit Breaker (persistent cache for instant reload) ----

const renewableBreaker = createCircuitBreaker<RenewableEnergyData>({
  name: 'Renewable Energy',
  cacheTtlMs: 60 * 60 * 1000, // 1h — World Bank data changes yearly
  persistCache: true,
});

const capacityBreaker = createCircuitBreaker<CapacitySeries[]>({
  name: 'Energy Capacity',
  cacheTtlMs: 60 * 60 * 1000,
  persistCache: true,
});

const gridCarbonBreaker = createCircuitBreaker<GridCarbonSnapshot>({
  name: 'Grid Carbon Snapshot',
  cacheTtlMs: 15 * 60 * 1000,
  persistCache: true,
});

const GRID_CARBON_SOURCE_URL = 'https://carbonintensity.org.uk/';

function unavailableGridCarbonSnapshot(message = 'Public grid-carbon source unavailable'): GridCarbonSnapshot {
  return {
    source: 'GB Carbon Intensity API',
    sourceUrl: GRID_CARBON_SOURCE_URL,
    location: 'Great Britain',
    status: 'unavailable',
    carbonIntensityGco2Kwh: null,
    index: 'unknown',
    observedFrom: null,
    observedTo: null,
    updatedAt: new Date().toISOString(),
    message,
  };
}

// ---- Data Fetching (from Railway seed via bootstrap) ----

async function fetchRenewableEnergyDataFresh(): Promise<RenewableEnergyData> {
  // 1. Try bootstrap hydration cache (first page load)
  const hydrated = getHydratedData('renewableEnergy') as RenewableEnergyData | undefined;
  if (hydrated?.historicalData?.length) return hydrated;

  // 2. Fallback: fetch from bootstrap endpoint directly
  try {
    const resp = await fetch('/api/bootstrap?keys=renewableEnergy', {
      signal: AbortSignal.timeout(5_000),
    });
    if (resp.ok) {
      const { data } = (await resp.json()) as { data: { renewableEnergy?: RenewableEnergyData } };
      if (data.renewableEnergy?.historicalData?.length) return data.renewableEnergy;
    }
  } catch { /* fall through */ }

  // 3. Static fallback
  return FALLBACK_DATA;
}

/**
 * Fetch renewable energy data with persistent caching.
 * Returns instantly from IndexedDB cache on subsequent loads.
 */
export async function fetchRenewableEnergyData(): Promise<RenewableEnergyData> {
  const [data, gridCarbon] = await Promise.all([
    renewableBreaker.execute(() => fetchRenewableEnergyDataFresh(), FALLBACK_DATA),
    fetchGridCarbonSnapshot(),
  ]);
  return { ...data, gridCarbon };
}

export async function fetchGridCarbonSnapshot(): Promise<GridCarbonSnapshot> {
  const snapshot = await gridCarbonBreaker.execute(async (): Promise<GridCarbonSnapshot> => {
    const resp = await fetch('https://api.carbonintensity.org.uk/intensity', {
      signal: AbortSignal.timeout(4_000),
    });
    if (!resp.ok) throw new Error(`GB Carbon Intensity API ${resp.status}`);

    const payload = await resp.json() as {
      data?: Array<{
        from?: string;
        to?: string;
        intensity?: {
          forecast?: number;
          actual?: number | null;
          index?: string;
        };
      }>;
    };
    const latest = payload.data?.[0];
    if (!latest?.intensity) throw new Error('GB Carbon Intensity API returned no intensity data');

    const actual = latest.intensity.actual;
    const forecast = latest.intensity.forecast;
    const carbonIntensity = typeof actual === 'number' && Number.isFinite(actual)
      ? actual
      : (typeof forecast === 'number' && Number.isFinite(forecast) ? forecast : null);

    return {
      source: 'GB Carbon Intensity API',
      sourceUrl: GRID_CARBON_SOURCE_URL,
      location: 'Great Britain',
      status: 'live',
      carbonIntensityGco2Kwh: carbonIntensity,
      index: normalizeGridCarbonIndex(latest.intensity.index),
      observedFrom: latest.from ?? null,
      observedTo: latest.to ?? null,
      updatedAt: new Date().toISOString(),
    };
  }, unavailableGridCarbonSnapshot());

  const state = gridCarbonBreaker.getDataState();
  if (state.mode === 'cached' && snapshot.status !== 'unavailable') {
    return { ...snapshot, status: 'cached' };
  }
  if (state.mode === 'unavailable') {
    return { ...snapshot, status: 'unavailable' };
  }
  return snapshot;
}

function normalizeGridCarbonIndex(value: unknown): GridCarbonSnapshot['index'] {
  switch (String(value ?? '').toLowerCase()) {
    case 'very low':
    case 'low':
    case 'moderate':
    case 'high':
    case 'very high':
      return String(value).toLowerCase() as GridCarbonSnapshot['index'];
    default:
      return 'unknown';
  }
}

// ========================================================================
// EIA Installed Capacity (solar, wind, coal)
// ========================================================================

export interface CapacityDataPoint {
  year: number;
  capacityMw: number;
}

export interface CapacitySeries {
  source: string;   // 'SUN', 'WND', 'COL'
  name: string;     // 'Solar', 'Wind', 'Coal'
  data: CapacityDataPoint[];
}

/**
 * Fetch installed generation capacity for solar, wind, and coal from EIA.
 * Returns typed CapacitySeries[] ready for panel rendering.
 * Gracefully degrades: on failure returns empty array.
 */
export async function fetchEnergyCapacity(): Promise<CapacitySeries[]> {
  return capacityBreaker.execute(async () => {
    const resp = await fetchEnergyCapacityRpc(['SUN', 'WND', 'COL'], 25);
    return resp.series.map(s => ({
      source: s.energySource,
      name: s.name,
      data: s.data.map(d => ({ year: d.year, capacityMw: d.capacityMw ?? 0 })),
    }));
  }, []);
}
