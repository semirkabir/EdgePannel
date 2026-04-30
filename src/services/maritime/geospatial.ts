export type MaritimeGeospatialStatus = 'available' | 'degraded' | 'unavailable';
export type MaritimeObservationConfidence = 'low' | 'medium' | 'high';

export interface MaritimeSatelliteObservation {
  surface: 'satellite';
  id: string;
  name: string;
  lat: number;
  lon: number;
  observedAt: string;
  type: 'sar_contact' | 'visible_wake' | 'oil_slick' | 'port_activity';
  provider: string;
  confidence: MaritimeObservationConfidence;
  description: string;
  region?: string;
  sourceUrl?: string;
}

export interface OceanConditionPoint {
  surface: 'ocean';
  id: string;
  name: string;
  lat: number;
  lon: number;
  observedAt: string;
  metric: 'sea_state' | 'sst_anomaly' | 'wind' | 'current';
  value: number;
  unit: string;
  severity: 'normal' | 'watch' | 'advisory';
  description: string;
  region?: string;
}

export interface FishingActivityZone {
  surface: 'fishing';
  id: string;
  name: string;
  lat: number;
  lon: number;
  observedAt: string;
  radiusKm: number;
  activity: 'low' | 'moderate' | 'high';
  confidence: MaritimeObservationConfidence;
  vesselsEstimated?: number;
  description: string;
  region?: string;
}

export type MaritimeGeospatialFeature =
  | MaritimeSatelliteObservation
  | OceanConditionPoint
  | FishingActivityZone;

export interface MaritimeGeospatialSnapshot {
  status: MaritimeGeospatialStatus;
  generatedAt: string;
  source: 'configured-feed' | 'unconfigured';
  message?: string;
  satelliteObservations: MaritimeSatelliteObservation[];
  oceanConditions: OceanConditionPoint[];
  fishingActivity: FishingActivityZone[];
}

interface MaritimeGeospatialRawSnapshot {
  status?: MaritimeGeospatialStatus;
  generatedAt?: string;
  source?: 'configured-feed' | 'unconfigured';
  message?: string;
  satelliteObservations?: unknown[];
  oceanConditions?: unknown[];
  fishingActivity?: unknown[];
}

const DEFAULT_TIMEOUT_MS = 8000;
const CONFIGURED_URL = import.meta.env.VITE_MARITIME_GEOSPATIAL_URL || '';

const EMPTY_SNAPSHOT: MaritimeGeospatialSnapshot = {
  status: 'unavailable',
  generatedAt: new Date(0).toISOString(),
  source: 'unconfigured',
  message: 'No lightweight maritime geospatial feed is configured.',
  satelliteObservations: [],
  oceanConditions: [],
  fishingActivity: [],
};

function isFiniteCoordinate(lat: unknown, lon: unknown): lat is number {
  return typeof lat === 'number'
    && typeof lon === 'number'
    && Number.isFinite(lat)
    && Number.isFinite(lon)
    && lat >= -90
    && lat <= 90
    && lon >= -180
    && lon <= 180;
}

function asCoordinatePair(lat: unknown, lon: unknown): [number, number] | null {
  return isFiniteCoordinate(lat, lon) && typeof lon === 'number' ? [lat, lon] : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asConfidence(value: unknown): MaritimeObservationConfidence {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function parseSatelliteObservation(value: unknown): MaritimeSatelliteObservation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<MaritimeSatelliteObservation>;
  const coords = asCoordinatePair(raw.lat, raw.lon);
  if (!coords) return null;
  const [lat, lon] = coords;
  const type = raw.type === 'sar_contact'
    || raw.type === 'visible_wake'
    || raw.type === 'oil_slick'
    || raw.type === 'port_activity'
    ? raw.type
    : 'sar_contact';

  return {
    surface: 'satellite',
    id: asString(raw.id, `sat-${lat.toFixed(3)}-${lon.toFixed(3)}`),
    name: asString(raw.name, 'Satellite observation'),
    lat,
    lon,
    observedAt: asString(raw.observedAt, new Date().toISOString()),
    type,
    provider: asString(raw.provider, 'Unspecified provider'),
    confidence: asConfidence(raw.confidence),
    description: asString(raw.description, 'Lightweight satellite-derived maritime observation.'),
    ...(raw.region && { region: raw.region }),
    ...(raw.sourceUrl && { sourceUrl: raw.sourceUrl }),
  };
}

function parseOceanCondition(value: unknown): OceanConditionPoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<OceanConditionPoint>;
  const coords = asCoordinatePair(raw.lat, raw.lon);
  if (!coords) return null;
  const [lat, lon] = coords;
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null;
  const metric = raw.metric === 'sea_state'
    || raw.metric === 'sst_anomaly'
    || raw.metric === 'wind'
    || raw.metric === 'current'
    ? raw.metric
    : 'sea_state';
  const severity = raw.severity === 'advisory' || raw.severity === 'watch' || raw.severity === 'normal'
    ? raw.severity
    : 'normal';

  return {
    surface: 'ocean',
    id: asString(raw.id, `ocean-${lat.toFixed(3)}-${lon.toFixed(3)}`),
    name: asString(raw.name, 'Ocean condition'),
    lat,
    lon,
    observedAt: asString(raw.observedAt, new Date().toISOString()),
    metric,
    value: raw.value,
    unit: asString(raw.unit),
    severity,
    description: asString(raw.description, 'Lightweight ocean condition point.'),
    ...(raw.region && { region: raw.region }),
  };
}

function parseFishingActivity(value: unknown): FishingActivityZone | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<FishingActivityZone>;
  const coords = asCoordinatePair(raw.lat, raw.lon);
  if (!coords) return null;
  const [lat, lon] = coords;
  const radiusKm = typeof raw.radiusKm === 'number' && Number.isFinite(raw.radiusKm)
    ? Math.max(1, Math.min(raw.radiusKm, 250))
    : 25;
  const activity = raw.activity === 'high' || raw.activity === 'moderate' || raw.activity === 'low'
    ? raw.activity
    : 'low';

  return {
    surface: 'fishing',
    id: asString(raw.id, `fish-${lat.toFixed(3)}-${lon.toFixed(3)}`),
    name: asString(raw.name, 'Fishing activity'),
    lat,
    lon,
    observedAt: asString(raw.observedAt, new Date().toISOString()),
    radiusKm,
    activity,
    confidence: asConfidence(raw.confidence),
    ...(typeof raw.vesselsEstimated === 'number' && Number.isFinite(raw.vesselsEstimated) && {
      vesselsEstimated: Math.max(0, Math.round(raw.vesselsEstimated)),
    }),
    description: asString(raw.description, 'Lightweight fishing activity zone.'),
    ...(raw.region && { region: raw.region }),
  };
}

function normalizeSnapshot(raw: MaritimeGeospatialRawSnapshot): MaritimeGeospatialSnapshot {
  const satelliteObservations = (raw.satelliteObservations ?? [])
    .map(parseSatelliteObservation)
    .filter((item): item is MaritimeSatelliteObservation => item != null);
  const oceanConditions = (raw.oceanConditions ?? [])
    .map(parseOceanCondition)
    .filter((item): item is OceanConditionPoint => item != null);
  const fishingActivity = (raw.fishingActivity ?? [])
    .map(parseFishingActivity)
    .filter((item): item is FishingActivityZone => item != null);
  const count = satelliteObservations.length + oceanConditions.length + fishingActivity.length;
  const rawStatus = raw.status === 'available' || raw.status === 'degraded' || raw.status === 'unavailable'
    ? raw.status
    : undefined;

  return {
    status: rawStatus ?? (count > 0 ? 'available' : 'unavailable'),
    generatedAt: asString(raw.generatedAt, new Date().toISOString()),
    source: raw.source === 'configured-feed' ? 'configured-feed' : 'unconfigured',
    ...(raw.message && { message: raw.message }),
    satelliteObservations,
    oceanConditions,
    fishingActivity,
  };
}

export async function fetchMaritimeGeospatialSnapshot(signal?: AbortSignal): Promise<MaritimeGeospatialSnapshot> {
  if (!CONFIGURED_URL) {
    return { ...EMPTY_SNAPSHOT, generatedAt: new Date().toISOString() };
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const abortHandler = () => controller.abort();
  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    const response = await fetch(CONFIGURED_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ...EMPTY_SNAPSHOT,
        generatedAt: new Date().toISOString(),
        message: `Maritime geospatial feed returned HTTP ${response.status}.`,
      };
    }
    return normalizeSnapshot(await response.json() as MaritimeGeospatialRawSnapshot);
  } catch (error) {
    return {
      ...EMPTY_SNAPSHOT,
      generatedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Maritime geospatial feed unavailable.',
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortHandler);
  }
}

export function countMaritimeGeospatialFeatures(snapshot: MaritimeGeospatialSnapshot): number {
  return snapshot.satelliteObservations.length
    + snapshot.oceanConditions.length
    + snapshot.fishingActivity.length;
}
