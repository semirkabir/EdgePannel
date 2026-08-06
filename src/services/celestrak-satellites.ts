import type { SatelliteData } from '@/types';

const CELESTRAK_GP_URL = 'https://celestrak.org/NORAD/elements/gp.php';
const CELESTRAK_PROXY_URL = '/api/celestrak';
const CACHE_KEY = 'wm:celestrak:satellites:v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

type SatelliteCategory = SatelliteData['category'];

type CelesTrakGpRecord = {
  OBJECT_NAME?: string;
  OBJECT_ID?: string;
  EPOCH?: string;
  MEAN_MOTION?: number;
  ECCENTRICITY?: number;
  INCLINATION?: number;
  RA_OF_ASC_NODE?: number;
  ARG_OF_PERICENTER?: number;
  MEAN_ANOMALY?: number;
  NORAD_CAT_ID?: number;
  ELEMENT_SET_NO?: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
};

type CachedSatellites = {
  fetchedAt: number;
  satellites: SatelliteData[];
};

const CELESTRAK_GROUPS = [
  'stations',
  'visual',
  'weather',
  'goes',
  'resource',
  'sarsat',
  'dmc',
  'tdrss',
  'argos',
  'planet',
  'spire',
  'geo',
  'intelsat',
  'ses',
  'eutelsat',
  'starlink',
  'oneweb',
  'qianfan',
  'kuiper',
  'iridium-NEXT',
  'orbcomm',
  'globalstar',
  'amateur',
  'satnogs',
  'x-comm',
  'other-comm',
  'gnss',
  'gps-ops',
  'glo-ops',
  'galileo',
  'beidou',
  'sbas',
  'science',
  'geodetic',
  'engineering',
  'education',
  'military',
  'radar',
  'cubesat',
] as const;

function endpointFor(params: Record<string, string>): string {
  const useProxy = typeof window !== 'undefined';
  const url = new URL(useProxy ? CELESTRAK_PROXY_URL : CELESTRAK_GP_URL, useProxy ? window.location.origin : undefined);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function directEndpointFor(params: Record<string, string>): string {
  const url = new URL(CELESTRAK_GP_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function categoryForGroup(group: string): SatelliteCategory {
  if (['weather', 'noaa', 'goes', 'resource', 'planet', 'spire', 'dmc'].includes(group)) return 'imaging';
  if (['military', 'radar'].includes(group)) return 'military';
  if (['stations', 'science', 'geodetic', 'engineering', 'education'].includes(group)) return 'scientific';
  return 'other';
}

function normalizeCelesTrakRecord(record: CelesTrakGpRecord, sourceGroup: string): SatelliteData | null {
  const noradId = Number(record.NORAD_CAT_ID);
  const meanMotion = Number(record.MEAN_MOTION);
  const eccentricity = Number(record.ECCENTRICITY);
  const inclination = Number(record.INCLINATION);
  const raan = Number(record.RA_OF_ASC_NODE);
  const argPerigee = Number(record.ARG_OF_PERICENTER);
  const meanAnomaly = Number(record.MEAN_ANOMALY);
  const name = String(record.OBJECT_NAME ?? '').trim();

  if (
    !Number.isFinite(noradId) ||
    !name ||
    !record.EPOCH ||
    !Number.isFinite(meanMotion) ||
    !Number.isFinite(eccentricity) ||
    !Number.isFinite(inclination) ||
    !Number.isFinite(raan) ||
    !Number.isFinite(argPerigee) ||
    !Number.isFinite(meanAnomaly)
  ) {
    return null;
  }

  return {
    id: `sat-${noradId}`,
    noradId,
    name,
    operator: `CelesTrak ${sourceGroup}`,
    category: categoryForGroup(sourceGroup),
    source: 'celestrak',
    sourceGroup,
    objectId: typeof record.OBJECT_ID === 'string' ? record.OBJECT_ID : undefined,
    epoch: record.EPOCH,
    meanMotion,
    eccentricity,
    inclination,
    raan,
    argPerigee,
    meanAnomaly,
    elementSetNo: Number.isFinite(Number(record.ELEMENT_SET_NO)) ? Number(record.ELEMENT_SET_NO) : undefined,
    bstar: Number.isFinite(Number(record.BSTAR)) ? Number(record.BSTAR) : undefined,
    meanMotionDot: Number.isFinite(Number(record.MEAN_MOTION_DOT)) ? Number(record.MEAN_MOTION_DOT) : undefined,
    meanMotionDdot: Number.isFinite(Number(record.MEAN_MOTION_DDOT)) ? Number(record.MEAN_MOTION_DDOT) : undefined,
  };
}

async function fetchJson<T>(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (typeof window === 'undefined') {
      headers['User-Agent'] = 'Mozilla/5.0 (compatible; EdgePannel/1.0; +https://edgepannel.com)';
    }
    const resp = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`CelesTrak returned ${resp.status} for ${url}: ${text.slice(0, 120)}`);
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(`CelesTrak returned non-JSON for ${url}: ${text.slice(0, 120)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGroup(group: string): Promise<SatelliteData[]> {
  let records: CelesTrakGpRecord[];
  try {
    records = await fetchJson<CelesTrakGpRecord[]>(endpointFor({ GROUP: group, FORMAT: 'json' }));
  } catch (err) {
    if (typeof window === 'undefined') throw err;
    records = await fetchJson<CelesTrakGpRecord[]>(directEndpointFor({ GROUP: group, FORMAT: 'json' }));
  }
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => normalizeCelesTrakRecord(record, group))
    .filter((satellite): satellite is SatelliteData => satellite != null);
}

async function fetchGroupedCatalog(): Promise<SatelliteData[]> {
  const byNoradId = new Map<number, SatelliteData>();
  const concurrency = 4;
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < CELESTRAK_GROUPS.length) {
      const group = CELESTRAK_GROUPS[cursor++]!;
      try {
        const satellites = await fetchGroup(group);
        for (const satellite of satellites) {
          if (!byNoradId.has(satellite.noradId)) byNoradId.set(satellite.noradId, satellite);
        }
      } catch (err) {
        console.warn(`[CelesTrak] Failed to load group ${group}:`, err);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return [...byNoradId.values()].sort((a, b) => a.noradId - b.noradId);
}

async function fetchActiveCatalog(): Promise<SatelliteData[]> {
  let records: CelesTrakGpRecord[];
  try {
    records = await fetchJson<CelesTrakGpRecord[]>(endpointFor({ GROUP: 'active', FORMAT: 'json' }), 20_000);
  } catch (err) {
    if (typeof window === 'undefined') throw err;
    records = await fetchJson<CelesTrakGpRecord[]>(directEndpointFor({ GROUP: 'active', FORMAT: 'json' }), 20_000);
  }
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => normalizeCelesTrakRecord(record, 'active'))
    .filter((satellite): satellite is SatelliteData => satellite != null)
    .sort((a, b) => a.noradId - b.noradId);
}

function readCachedSatellites(): SatelliteData[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSatellites;
    if (!Array.isArray(cached.satellites) || Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached.satellites;
  } catch {
    return null;
  }
}

function writeCachedSatellites(satellites: SatelliteData[]): void {
  try {
    const cached: CachedSatellites = { fetchedAt: Date.now(), satellites };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage may be unavailable in hardened browser contexts.
  }
}

const CURATED_URL = '/data/satellite.generated.json';

/**
 * Loads the curated set of notable satellites bundled with the app. This is a
 * small, hand-picked catalog (ISS, Tiangong, key imaging/military sats) served
 * as a static file — reliable in dev and prod, and sized for icon rendering
 * rather than the full ~10k-entry CelesTrak catalog.
 */
export async function fetchCuratedSatellites(): Promise<SatelliteData[]> {
  const resp = await fetch(CURATED_URL);
  if (!resp.ok) throw new Error(`satellite.generated.json returned ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error('satellite.generated.json is not an array');
  return data as SatelliteData[];
}

export async function fetchCelesTrakSatellites(): Promise<SatelliteData[]> {
  const cached = readCachedSatellites();
  if (cached?.length) return cached;

  let satellites: SatelliteData[] = [];
  try {
    satellites = await fetchActiveCatalog();
  } catch (err) {
    console.warn('[CelesTrak] GROUP=active unavailable; falling back to grouped GP feeds.', err);
  }

  if (satellites.length === 0) satellites = await fetchGroupedCatalog();
  if (satellites.length === 0) throw new Error('CelesTrak returned zero satellites');

  writeCachedSatellites(satellites);
  return satellites;
}
