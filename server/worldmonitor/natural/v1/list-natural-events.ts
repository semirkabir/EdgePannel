import type {
  NaturalServiceHandler,
  ServerContext,
  ListNaturalEventsRequest,
  ListNaturalEventsResponse,
  NaturalEvent,
} from '../../../../src/generated/server/worldmonitor/natural/v1/service_server';

import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJson, getCachedJson } from '../../../_shared/redis';

const REDIS_CACHE_KEY = 'natural:events:v1';
const REDIS_CACHE_TTL = 1800; // 30 min
const SEED_FRESHNESS_MS = 45 * 60 * 1000; // 45 minutes

const EONET_API_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const GDACS_API = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP';
const OPEN_METEO_FLOOD_API = 'https://flood-api.open-meteo.com/v1/flood';
const FLOOD_DEDUPE_RADIUS_KM = 50;
const FLOOD_DISCHARGE_RATIO_THRESHOLD = 2.5;
const FLOOD_MIN_DISCHARGE_M3S = 50;

const FLOOD_MONITOR_POINTS: Array<{ id: string; name: string; lat: number; lon: number }> = [
  { id: 'ganges-delta', name: 'Ganges Delta', lat: 23.25, lon: 90.41 },
  { id: 'brahmaputra', name: 'Brahmaputra', lat: 26.2, lon: 89.95 },
  { id: 'mekong-delta', name: 'Mekong Delta', lat: 10.45, lon: 106.35 },
  { id: 'yangtze', name: 'Yangtze', lat: 30.5, lon: 112.2 },
  { id: 'mississippi', name: 'Mississippi', lat: 29.95, lon: -90.08 },
  { id: 'amazon', name: 'Amazon', lat: -3.12, lon: -60.02 },
  { id: 'congo', name: 'Congo', lat: -4.32, lon: 15.31 },
  { id: 'niger', name: 'Niger', lat: 13.45, lon: 2.12 },
  { id: 'nile', name: 'Nile', lat: 30.05, lon: 31.25 },
  { id: 'danube', name: 'Danube', lat: 45.25, lon: 19.85 },
  { id: 'rhine', name: 'Rhine', lat: 51.85, lon: 6.75 },
  { id: 'po', name: 'Po River', lat: 45.07, lon: 12.25 },
  { id: 'indus', name: 'Indus', lat: 24.85, lon: 67.0 },
  { id: 'volga', name: 'Volga', lat: 48.7, lon: 44.5 },
  { id: 'parana', name: 'Paraná', lat: -32.95, lon: -60.65 },
  { id: 'murray', name: 'Murray-Darling', lat: -34.2, lon: 142.1 },
  { id: 'mekong-laos', name: 'Mekong (Laos)', lat: 18.25, lon: 102.5 },
  { id: 'red-river', name: 'Red River', lat: 21.03, lon: 105.85 },
  { id: 'saint-lawrence', name: 'St. Lawrence', lat: 46.8, lon: -71.2 },
  { id: 'rhone', name: 'Rhône', lat: 45.75, lon: 4.85 },
];

const DAYS = 30;
const WILDFIRE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const GDACS_TO_CATEGORY: Record<string, string> = {
  EQ: 'earthquakes',
  FL: 'floods',
  TC: 'severeStorms',
  VO: 'volcanoes',
  WF: 'wildfires',
  DR: 'drought',
};

const NATURAL_EVENT_CATEGORIES = new Set([
  'severeStorms',
  'wildfires',
  'volcanoes',
  'earthquakes',
  'floods',
  'landslides',
  'drought',
  'dustHaze',
  'snow',
  'tempExtremes',
  'seaLakeIce',
  'waterColor',
  'manmade',
]);

const EVENT_TYPE_NAMES: Record<string, string> = {
  EQ: 'Earthquake',
  FL: 'Flood',
  TC: 'Tropical Cyclone',
  VO: 'Volcano',
  WF: 'Wildfire',
  DR: 'Drought',
};

function normalizeNaturalCategory(value: unknown): string {
  const category = String(value || '').trim();
  return NATURAL_EVENT_CATEGORIES.has(category) ? category : 'manmade';
}

async function fetchEonet(days: number): Promise<NaturalEvent[]> {
  const url = `${EONET_API_URL}?status=open&days=${days}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`EONET ${res.status}`);

  const data: any = await res.json();
  const events: NaturalEvent[] = [];
  const now = Date.now();

  for (const event of data.events || []) {
    const category = event.categories?.[0];
    if (!category) continue;
    const normalizedCategory = normalizeNaturalCategory(category.id);
    if (normalizedCategory === 'earthquakes') continue;

    const latestGeo = event.geometry?.[event.geometry.length - 1];
    if (!latestGeo || latestGeo.type !== 'Point') continue;

    const eventDate = new Date(latestGeo.date);
    const [lon, lat] = latestGeo.coordinates;

    if (normalizedCategory === 'wildfires' && now - eventDate.getTime() > WILDFIRE_MAX_AGE_MS) continue;

    const source = event.sources?.[0];
    events.push({
      id: event.id || '',
      title: event.title || '',
      description: event.description || '',
      category: normalizedCategory,
      categoryTitle: category.title || '',
      lat,
      lon,
      date: eventDate.getTime(),
      magnitude: latestGeo.magnitudeValue ?? 0,
      magnitudeUnit: latestGeo.magnitudeUnit || '',
      sourceUrl: source?.url || '',
      sourceName: source?.id || '',
      closed: event.closed !== null,
    });
  }

  return events;
}

async function fetchGdacs(): Promise<NaturalEvent[]> {
  const res = await fetch(GDACS_API, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GDACS ${res.status}`);

  const data: any = await res.json();
  const features: any[] = data.features || [];
  const seen = new Set<string>();
  const events: NaturalEvent[] = [];

  for (const f of features) {
    if (!f.geometry || f.geometry.type !== 'Point') continue;
    const props = f.properties;
    const key = `${props.eventtype}-${props.eventid}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (props.alertlevel === 'Green') continue;

    const category = normalizeNaturalCategory(GDACS_TO_CATEGORY[props.eventtype] || 'manmade');
    const alertPrefix = props.alertlevel === 'Red' ? '🔴 ' : props.alertlevel === 'Orange' ? '🟠 ' : '';
    const description = props.description || EVENT_TYPE_NAMES[props.eventtype] || props.eventtype;
    const severity = props.severitydata?.severitytext || '';

    events.push({
      id: `gdacs-${props.eventtype}-${props.eventid}`,
      title: `${alertPrefix}${props.name || ''}`,
      description: `${description}${severity ? ` - ${severity}` : ''}`,
      category,
      categoryTitle: description,
      lat: f.geometry.coordinates[1] ?? 0,
      lon: f.geometry.coordinates[0] ?? 0,
      date: new Date(props.fromdate || 0).getTime(),
      magnitude: 0,
      magnitudeUnit: '',
      sourceUrl: props.url?.report || '',
      sourceName: 'GDACS',
      closed: false,
    });
  }

  return events.slice(0, 100);
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isNearExistingFlood(lat: number, lon: number, existing: NaturalEvent[]): boolean {
  return existing.some((event) => {
    if (event.category !== 'floods') return false;
    return haversineKm(lat, lon, event.lat, event.lon) <= FLOOD_DEDUPE_RADIUS_KM;
  });
}

type OpenMeteoFloodEntry = {
  latitude: number;
  longitude: number;
  location_id?: number;
  daily?: {
    time?: string[];
    river_discharge?: number[];
    river_discharge_mean?: number[];
  };
};

async function fetchOpenMeteoFloods(): Promise<NaturalEvent[]> {
  const latitudes = FLOOD_MONITOR_POINTS.map((p) => p.lat).join(',');
  const longitudes = FLOOD_MONITOR_POINTS.map((p) => p.lon).join(',');
  const url = `${OPEN_METEO_FLOOD_API}?latitude=${latitudes}&longitude=${longitudes}&daily=river_discharge,river_discharge_mean&forecast_days=2&past_days=2`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Open-Meteo Flood ${res.status}`);

  const payload: OpenMeteoFloodEntry | OpenMeteoFloodEntry[] = await res.json();
  const entries = Array.isArray(payload) ? payload : [payload];
  const events: NaturalEvent[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const point = FLOOD_MONITOR_POINTS[entry.location_id ?? i];
    if (!point) continue;

    const times = entry.daily?.time ?? [];
    const discharge = entry.daily?.river_discharge ?? [];
    const dischargeMean = entry.daily?.river_discharge_mean ?? [];
    if (times.length < 2 || discharge.length < 2) continue;

    const latestIdx = discharge.length - 1;
    const latest = discharge[latestIdx] ?? 0;
    const baselineValues = discharge.slice(0, latestIdx).filter((v) => v > 0);
    const baseline = baselineValues.length
      ? baselineValues.reduce((sum, v) => sum + v, 0) / baselineValues.length
      : (dischargeMean[latestIdx] ?? dischargeMean[0] ?? latest);
    if (baseline <= 0) continue;

    const ratio = latest / baseline;
    if (ratio < FLOOD_DISCHARGE_RATIO_THRESHOLD || latest < FLOOD_MIN_DISCHARGE_M3S) continue;

    const eventDate = new Date(times[latestIdx] ?? Date.now()).getTime();
    const pctAbove = Math.round((ratio - 1) * 100);

    events.push({
      id: `openmeteo-flood-${point.id}-${times[latestIdx] ?? 'latest'}`,
      title: `Elevated discharge: ${point.name}`,
      description: `GloFAS river discharge ${latest.toFixed(0)} m³/s (${pctAbove}% above recent baseline ${baseline.toFixed(0)} m³/s).`,
      category: 'floods',
      categoryTitle: 'River Flood Risk',
      lat: entry.latitude ?? point.lat,
      lon: entry.longitude ?? point.lon,
      date: eventDate,
      magnitude: latest,
      magnitudeUnit: 'm³/s',
      sourceUrl: `https://open-meteo.com/en/docs/flood-api?latitude=${point.lat}&longitude=${point.lon}`,
      sourceName: 'Open-Meteo GloFAS',
      closed: false,
    });
  }

  return events;
}

type NaturalEventsCache = { events: ListNaturalEventsResponse['events'] };

async function trySeededData(): Promise<NaturalEventsCache | null> {
  try {
    const [seedData, seedMeta] = await Promise.all([
      getCachedJson(REDIS_CACHE_KEY, true) as Promise<NaturalEventsCache | null>,
      getCachedJson('seed-meta:natural:events', true) as Promise<{ fetchedAt?: number } | null>,
    ]);

    if (!seedData?.events?.length) return null;

    const fetchedAt = seedMeta?.fetchedAt ?? 0;
    const isFresh = Date.now() - fetchedAt < SEED_FRESHNESS_MS;

    if (isFresh) return seedData;

    if (!process.env.SEED_FALLBACK_NATURAL) return seedData;

    return null;
  } catch {
    return null;
  }
}

export const listNaturalEvents: NaturalServiceHandler['listNaturalEvents'] = async (
  _ctx: ServerContext,
  _req: ListNaturalEventsRequest,
): Promise<ListNaturalEventsResponse> => {

  try {
    const seeded = await trySeededData();
    if (seeded) {
      return { events: seeded.events };
    }

    const result = await cachedFetchJson<ListNaturalEventsResponse>(
      REDIS_CACHE_KEY,
      REDIS_CACHE_TTL,
      async () => {
        const [eonetResult, gdacsResult, floodResult] = await Promise.allSettled([
          fetchEonet(DAYS),
          fetchGdacs(),
          fetchOpenMeteoFloods(),
        ]);

        const eonetEvents = eonetResult.status === 'fulfilled' ? eonetResult.value : [];
        const gdacsEvents = gdacsResult.status === 'fulfilled' ? gdacsResult.value : [];
        const floodEvents = floodResult.status === 'fulfilled' ? floodResult.value : [];

        if (eonetResult.status === 'rejected') console.error('[EONET]', eonetResult.reason?.message);
        if (gdacsResult.status === 'rejected') console.error('[GDACS]', gdacsResult.reason?.message);
        if (floodResult.status === 'rejected') console.error('[Open-Meteo Flood]', floodResult.reason?.message);

        const seenLocations = new Set<string>();
        const merged: NaturalEvent[] = [];

        for (const event of gdacsEvents) {
          const k = `${event.lat.toFixed(1)}-${event.lon.toFixed(1)}-${event.category}`;
          if (!seenLocations.has(k)) {
            seenLocations.add(k);
            merged.push(event);
          }
        }
        for (const event of eonetEvents) {
          const k = `${event.lat.toFixed(1)}-${event.lon.toFixed(1)}-${event.category}`;
          if (!seenLocations.has(k)) {
            seenLocations.add(k);
            merged.push(event);
          }
        }
        for (const event of floodEvents) {
          if (isNearExistingFlood(event.lat, event.lon, merged)) continue;
          const k = `${event.lat.toFixed(1)}-${event.lon.toFixed(1)}-${event.category}`;
          if (!seenLocations.has(k)) {
            seenLocations.add(k);
            merged.push(event);
          }
        }

        return merged.length > 0 ? { events: merged } : null;
      },
    );
    return result || { events: [] };
  } catch {
    return { events: [] };
  }
};
