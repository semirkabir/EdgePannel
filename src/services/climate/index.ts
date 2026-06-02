import {
  ClimateServiceClient,
  type ClimateAnomaly as ProtoClimateAnomaly,
  type AnomalySeverity as ProtoAnomalySeverity,
  type AnomalyType as ProtoAnomalyType,
  type ListClimateAnomaliesResponse,
} from '@/generated/client/worldmonitor/climate/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';

// Re-export consumer-friendly type matching legacy shape exactly.
// Consumers import this type from '@/services/climate' and see the same
// lat/lon/severity/type fields they always used. The proto -> legacy
// mapping happens internally in toDisplayAnomaly().
export interface ClimateAnomaly {
  zone: string;
  lat: number;
  lon: number;
  tempDelta: number;
  precipDelta: number;
  severity: 'normal' | 'moderate' | 'extreme';
  type: 'warm' | 'cold' | 'wet' | 'dry' | 'mixed';
  period: string;
}

export type ClimatePhysicalSignalSeverity = 'good' | 'moderate' | 'unhealthy' | 'hazardous' | 'unknown';

export interface ClimatePhysicalSignal {
  id: string;
  kind: 'air-quality';
  location: string;
  lat: number;
  lon: number;
  observedAt: string;
  source: 'Open-Meteo Air Quality';
  sourceUrl: string;
  europeanAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  severity: ClimatePhysicalSignalSeverity;
}

export interface ClimateSourceStatus {
  source: string;
  ok: boolean;
  mode: 'live' | 'cached' | 'unavailable';
  message?: string;
}

export interface ClimateFetchResult {
  ok: boolean;
  anomalies: ClimateAnomaly[];
  physicalSignals: ClimatePhysicalSignal[];
  sourceStatus: ClimateSourceStatus[];
}

const client = new ClimateServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker<ListClimateAnomaliesResponse>({ name: 'Climate Anomalies', cacheTtlMs: 20 * 60 * 1000, persistCache: true });
const physicalSignalBreaker = createCircuitBreaker<ClimatePhysicalSignal[]>({ name: 'Climate Physical Signals', cacheTtlMs: 30 * 60 * 1000, persistCache: true });

const emptyClimateFallback: ListClimateAnomaliesResponse = { anomalies: [] };
const emptyPhysicalSignalsFallback: ClimatePhysicalSignal[] = [];

const AIR_QUALITY_SOURCE_URL = 'https://open-meteo.com/en/docs/air-quality-api';
const AIR_QUALITY_SITES: Array<{ id: string; location: string; lat: number; lon: number }> = [
  { id: 'delhi', location: 'Delhi NCR', lat: 28.6139, lon: 77.2090 },
  { id: 'beijing', location: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { id: 'los-angeles', location: 'Los Angeles Basin', lat: 34.0522, lon: -118.2437 },
  { id: 'sao-paulo', location: 'Sao Paulo', lat: -23.5558, lon: -46.6396 },
  { id: 'lagos', location: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { id: 'london', location: 'London', lat: 51.5072, lon: -0.1276 },
];

export async function fetchClimateAnomalies(): Promise<ClimateFetchResult> {
  const sourceStatus: ClimateSourceStatus[] = [];
  const physicalSignalsPromise = fetchClimatePhysicalSignals();

  const hydrated = getHydratedData('climateAnomalies') as ListClimateAnomaliesResponse | undefined;
  if (hydrated && (hydrated.anomalies ?? []).length > 0) {
    const anomalies = hydrated.anomalies.map(toDisplayAnomaly).filter(a => a.severity !== 'normal');
    if (anomalies.length > 0) {
      const physicalSignals = await physicalSignalsPromise;
      sourceStatus.push({ source: 'Climate anomaly RPC', ok: true, mode: 'cached', message: 'bootstrap hydration' });
      sourceStatus.push(toSourceStatus('Open-Meteo Air Quality', physicalSignalBreaker.getDataState().mode, physicalSignals.length > 0));
      return { ok: true, anomalies, physicalSignals, sourceStatus };
    }
  }

  const response = await breaker.execute(async () => {
    return client.listClimateAnomalies({ minSeverity: 'ANOMALY_SEVERITY_UNSPECIFIED', pageSize: 0, cursor: '' });
  }, emptyClimateFallback);
  const anomalies = (response.anomalies ?? [])
    .map(toDisplayAnomaly)
    .filter(a => a.severity !== 'normal');
  const physicalSignals = await physicalSignalsPromise;
  sourceStatus.push(toSourceStatus('Climate anomaly RPC', breaker.getDataState().mode, anomalies.length > 0));
  sourceStatus.push(toSourceStatus('Open-Meteo Air Quality', physicalSignalBreaker.getDataState().mode, physicalSignals.length > 0));
  return { ok: true, anomalies, physicalSignals, sourceStatus };
}

// Presentation helpers (used by ClimateAnomalyPanel)
export function getSeverityIcon(anomaly: ClimateAnomaly): string {
  switch (anomaly.type) {
    case 'warm': return '\u{1F321}\u{FE0F}';   // thermometer
    case 'cold': return '\u{2744}\u{FE0F}';     // snowflake
    case 'wet': return '\u{1F327}\u{FE0F}';     // rain
    case 'dry': return '\u{2600}\u{FE0F}';      // sun
    case 'mixed': return '\u{26A1}';             // lightning
    default: return '\u{1F321}\u{FE0F}';         // thermometer
  }
}

export function formatDelta(value: number, unit: string): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}${unit}`;
}

// Internal: Map proto ClimateAnomaly -> consumer-friendly shape
function toDisplayAnomaly(proto: ProtoClimateAnomaly): ClimateAnomaly {
  return {
    zone: proto.zone,
    lat: proto.location?.latitude ?? 0,
    lon: proto.location?.longitude ?? 0,
    tempDelta: proto.tempDelta,
    precipDelta: proto.precipDelta,
    severity: mapSeverity(proto.severity),
    type: mapType(proto.type),
    period: proto.period,
  };
}

function mapSeverity(s: ProtoAnomalySeverity): ClimateAnomaly['severity'] {
  switch (s) {
    case 'ANOMALY_SEVERITY_EXTREME': return 'extreme';
    case 'ANOMALY_SEVERITY_MODERATE': return 'moderate';
    default: return 'normal';
  }
}

function mapType(t: ProtoAnomalyType): ClimateAnomaly['type'] {
  switch (t) {
    case 'ANOMALY_TYPE_WARM': return 'warm';
    case 'ANOMALY_TYPE_COLD': return 'cold';
    case 'ANOMALY_TYPE_WET': return 'wet';
    case 'ANOMALY_TYPE_DRY': return 'dry';
    case 'ANOMALY_TYPE_MIXED': return 'mixed';
    default: return 'warm';
  }
}

async function fetchClimatePhysicalSignals(): Promise<ClimatePhysicalSignal[]> {
  return physicalSignalBreaker.execute(async () => {
    const results = await Promise.allSettled(AIR_QUALITY_SITES.map(fetchAirQualitySignal));
    const signals = results
      .filter((result): result is PromiseFulfilledResult<ClimatePhysicalSignal | null> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter((signal): signal is ClimatePhysicalSignal => signal !== null)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
      .slice(0, 5);
    if (signals.length === 0) throw new Error('Open-Meteo air quality returned no usable observations');
    return signals;
  }, emptyPhysicalSignalsFallback);
}

async function fetchAirQualitySignal(site: typeof AIR_QUALITY_SITES[number]): Promise<ClimatePhysicalSignal | null> {
  const params = new URLSearchParams({
    latitude: String(site.lat),
    longitude: String(site.lon),
    current: 'european_aqi,pm2_5,pm10,ozone',
    timezone: 'UTC',
  });
  const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`, {
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo air quality ${response.status}`);

  const payload = await response.json() as {
    current?: {
      time?: string;
      european_aqi?: number;
      pm2_5?: number;
      pm10?: number;
      ozone?: number;
    };
  };
  const current = payload.current;
  if (!current?.time) return null;

  const europeanAqi = toFiniteNumber(current.european_aqi);
  return {
    id: `air-quality:${site.id}`,
    kind: 'air-quality',
    location: site.location,
    lat: site.lat,
    lon: site.lon,
    observedAt: current.time,
    source: 'Open-Meteo Air Quality',
    sourceUrl: AIR_QUALITY_SOURCE_URL,
    europeanAqi,
    pm25: toFiniteNumber(current.pm2_5),
    pm10: toFiniteNumber(current.pm10),
    ozone: toFiniteNumber(current.ozone),
    severity: classifyAqi(europeanAqi),
  };
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function classifyAqi(aqi: number | null): ClimatePhysicalSignalSeverity {
  if (aqi === null) return 'unknown';
  if (aqi >= 300) return 'hazardous';
  if (aqi >= 100) return 'unhealthy';
  if (aqi >= 50) return 'moderate';
  return 'good';
}

function severityRank(severity: ClimatePhysicalSignalSeverity): number {
  switch (severity) {
    case 'hazardous': return 4;
    case 'unhealthy': return 3;
    case 'moderate': return 2;
    case 'good': return 1;
    default: return 0;
  }
}

function toSourceStatus(source: string, mode: ClimateSourceStatus['mode'], hasData: boolean): ClimateSourceStatus {
  return {
    source,
    ok: mode !== 'unavailable' || hasData,
    mode,
    ...(mode === 'unavailable' && !hasData ? { message: 'source unavailable; retaining fallback/empty state' } : {}),
  };
}
