import { createCircuitBreaker, getCSSColor } from '@/utils';

export interface WeatherAlert {
  id: string;
  event: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  headline: string;
  description: string;
  areaDesc: string;
  onset: Date;
  expires: Date;
  coordinates: [number, number][];
  centroid?: [number, number];
}

interface NWSAlert {
  id: string;
  properties: {
    event: string;
    severity: string;
    headline: string;
    description: string;
    areaDesc: string;
    onset: string;
    expires: string;
  };
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][];
  };
}

interface NWSResponse {
  features: NWSAlert[];
}

const NWS_API = '/api/weather';

export function getWeatherAlertIconUrl(event: string): string | null {
  const lower = event.toLowerCase();
  if (lower.includes('flood')) return '/icons/flood-warning.png';
  return null;
}

const breaker = createCircuitBreaker<WeatherAlert[]>({ name: 'NWS Weather', cacheTtlMs: 30 * 60 * 1000, persistCache: true });

export async function fetchWeatherAlerts(): Promise<WeatherAlert[]> {
  return breaker.execute(async () => {
    const response = await fetch(NWS_API);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: NWSResponse = await response.json();

    return data.features
      .filter(alert => alert.properties.severity !== 'Unknown')
      .slice(0, 50)
      .map(alert => {
        const coords = extractCoordinates(alert.geometry);
        return {
          id: alert.id,
          event: alert.properties.event,
          severity: alert.properties.severity as WeatherAlert['severity'],
          headline: alert.properties.headline,
          description: alert.properties.description?.slice(0, 500) || '',
          areaDesc: alert.properties.areaDesc,
          onset: new Date(alert.properties.onset),
          expires: new Date(alert.properties.expires),
          coordinates: coords,
          centroid: calculateCentroid(coords),
        };
      });
  }, []);
}

export function getWeatherStatus(): string {
  return breaker.getStatus();
}

function extractCoordinates(geometry?: NWSAlert['geometry']): [number, number][] {
  if (!geometry) return [];

  try {
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates as unknown as number[][][];
      return coords[0]?.map(c => [c[0], c[1]] as [number, number]) || [];
    }
    if (geometry.type === 'MultiPolygon') {
      const coords = geometry.coordinates as unknown as number[][][][];
      return coords[0]?.[0]?.map(c => [c[0], c[1]] as [number, number]) || [];
    }
  } catch {
    return [];
  }
  return [];
}

function calculateCentroid(coords: [number, number][]): [number, number] | undefined {
  if (coords.length === 0) return undefined;

  const sum = coords.reduce(
    (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
    [0, 0]
  );

  return [sum[0] / coords.length, sum[1] / coords.length];
}

// ── GDACS Global Disaster Alert and Coordination System ─────────────────────

interface GDACSProperties {
  eventtype: string;
  alertlevel: string;
  country: string;
  name: string;
  fromdate: string;
  todate: string;
}

interface GDACSFeature {
  properties: GDACSProperties;
  geometry?: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
}

interface GDACSResponse {
  features: GDACSFeature[];
}

const GDACS_API = '/api/gdacs';

const gdacsBreaker = createCircuitBreaker<WeatherAlert[]>({ name: 'GDACS Global Alerts', cacheTtlMs: 10 * 60 * 1000, persistCache: true });

export async function fetchGDACSAlerts(): Promise<WeatherAlert[]> {
  return gdacsBreaker.execute(async () => {
    const response = await fetch(GDACS_API);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: GDACSResponse = await response.json();
    if (!Array.isArray(data.features)) return [];

    return data.features
      .filter(f => f.properties?.alertlevel && f.properties.alertlevel !== 'Green')
      .slice(0, 50)
      .map(f => {
        const p = f.properties;
        const severity: WeatherAlert['severity'] =
          p.alertlevel === 'Red' ? 'Extreme' :
          p.alertlevel === 'Orange' ? 'Severe' : 'Moderate';

        // Map GDACS event type to our WeatherCategory slug (used for layer routing)
        const eventLabel =
          p.eventtype === 'TC' ? 'Tropical Cyclone' :
          p.eventtype === 'FL' ? 'Flood' :
          p.eventtype === 'VO' ? 'Volcanic Activity' :
          p.eventtype === 'WF' ? 'Wildfire' :
          p.eventtype === 'DR' ? 'Drought' :
          p.name || 'Natural Disaster';

        const coords = extractGDACSCoordinates(f.geometry);
        return {
          id: `gdacs-${p.eventtype}-${p.fromdate}-${encodeURIComponent(p.country)}`,
          event: eventLabel,
          severity,
          headline: `${p.alertlevel} Alert — ${escapeGDACSText(p.name)}`,
          description: `${p.alertlevel} level ${eventLabel.toLowerCase()} alert issued for ${p.country}.`,
          areaDesc: `${p.country} — ${escapeGDACSText(p.name)}`,
          onset: new Date(p.fromdate),
          expires: new Date(p.todate),
          coordinates: coords,
          centroid: calculateCentroid(coords),
        } satisfies WeatherAlert;
      });
  }, []);
}

function extractGDACSCoordinates(geometry?: GDACSFeature['geometry']): [number, number][] {
  if (!geometry) return [];
  try {
    if (geometry.type === 'Point') {
      const c = geometry.coordinates as number[];
      return [[c[0]!, c[1]!]];
    }
    if (geometry.type === 'Polygon') {
      const c = geometry.coordinates as number[][][];
      return c[0]?.map(p => [p[0]!, p[1]!] as [number, number]) ?? [];
    }
    if (geometry.type === 'MultiPolygon') {
      const c = geometry.coordinates as unknown as number[][][][];
      return c[0]?.[0]?.map(p => [p[0]!, p[1]!] as [number, number]) ?? [];
    }
  } catch {
    return [];
  }
  return [];
}

function escapeGDACSText(s: string): string {
  return (s || '').replace(/[<>&"']/g, c =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&#39;');
}

/** Fetch NWS (US) + GDACS (global) alerts merged. */
export async function fetchAllWeatherAlerts(): Promise<WeatherAlert[]> {
  const [nws, gdacs] = await Promise.all([fetchWeatherAlerts(), fetchGDACSAlerts()]);
  return [...nws, ...gdacs];
}

// ── Weather category classification ──────────────────────────────────────────

export type WeatherCategory =
  'tornado' | 'flood' | 'thunderstorm' | 'snow' | 'heat' |
  'hurricane' | 'fire' | 'wind' | 'default';

export function getWeatherEventCategory(event: string): WeatherCategory {
  const e = event.toLowerCase();
  if (/tornado|waterspout/.test(e)) return 'tornado';
  if (/flood|surge/.test(e)) return 'flood';
  if (/thunderstorm|lightning/.test(e)) return 'thunderstorm';
  if (/snow|blizzard|ice storm|winter storm|winter weather|freezing/.test(e)) return 'snow';
  if (/excessive heat|heat wave/.test(e)) return 'heat';
  if (/hurricane|typhoon|tropical storm|cyclone/.test(e)) return 'hurricane';
  if (/fire|red flag/.test(e)) return 'fire';
  if (/\bwind\b|gale|dust storm/.test(e)) return 'wind';
  return 'default';
}

export function getSeverityColor(severity: WeatherAlert['severity']): string {
  switch (severity) {
    case 'Extreme': return getCSSColor('--semantic-critical');
    case 'Severe': return getCSSColor('--semantic-high');
    case 'Moderate': return getCSSColor('--semantic-elevated');
    case 'Minor': return getCSSColor('--semantic-elevated');
    default: return getCSSColor('--text-dim');
  }
}
