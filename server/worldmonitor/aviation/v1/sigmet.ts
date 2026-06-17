import type { AirportDelayAlert } from '../../../../src/generated/server/worldmonitor/aviation/v1/service_server';
import { MONITORED_AIRPORTS } from '../../../../src/config/airports';
import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJson } from '../../../_shared/redis';
import { toProtoSeverity } from './_shared';

const SIGMET_URL = 'https://aviationweather.gov/api/data/airsigmet?format=json';
const SIGMET_CACHE_KEY = 'aviation:sigmet:v1';
const SIGMET_CACHE_TTL = 900;

const HAZARD_LABELS: Record<string, string> = {
  CONVECTIVE: 'Convective',
  TURB: 'Turbulence',
  ICE: 'Icing',
  IFR: 'IFR',
  MTW: 'Mountain wave',
  VOLCANIC: 'Volcanic ash',
  TROPICAL: 'Tropical cyclone',
};

interface SigmetCoord {
  lat: number;
  lon: number;
}

interface RawSigmet {
  hazard?: string;
  coords?: SigmetCoord[];
  severity?: number;
  seriesId?: string;
  alphaChar?: string;
  validTimeFrom?: number;
  airSigmetType?: string;
}

export interface ParsedSigmet {
  id: string;
  hazard: string;
  hazardLabel: string;
  severity: number;
  coords: SigmetCoord[];
  center: SigmetCoord | null;
}

function centroid(coords: SigmetCoord[]): SigmetCoord | null {
  if (coords.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const c of coords) {
    lat += c.lat;
    lon += c.lon;
  }
  return { lat: lat / coords.length, lon: lon / coords.length };
}

function pointInPolygon(lat: number, lon: number, polygon: SigmetCoord[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat;
    const xi = polygon[i].lon;
    const yj = polygon[j].lat;
    const xj = polygon[j].lon;
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseSigmet(raw: RawSigmet): ParsedSigmet | null {
  const coords = (raw.coords ?? [])
    .map((c) => ({ lat: Number(c.lat), lon: Number(c.lon) }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  if (coords.length < 3) return null;

  const hazard = String(raw.hazard || '').toUpperCase();
  const seriesId = String(raw.seriesId || raw.alphaChar || '').trim();
  return {
    id: `sigmet:${seriesId || hazard}:${raw.validTimeFrom || coords.length}`,
    hazard,
    hazardLabel: HAZARD_LABELS[hazard] || hazard || 'Aviation hazard',
    severity: Number(raw.severity) || 0,
    coords,
    center: centroid(coords),
  };
}

function airportAffected(lat: number, lon: number, sigmet: ParsedSigmet): boolean {
  if (pointInPolygon(lat, lon, sigmet.coords)) return true;
  if (!sigmet.center) return false;
  return haversineKm(lat, lon, sigmet.center.lat, sigmet.center.lon) <= 250;
}

function sigmetSeverityRank(hazard: string, apiSeverity: number): 'minor' | 'moderate' | 'major' {
  if (hazard === 'CONVECTIVE' || hazard === 'VOLCANIC' || hazard === 'TROPICAL' || apiSeverity >= 5) {
    return 'major';
  }
  if (hazard === 'TURB' || hazard === 'ICE' || hazard === 'MTW' || apiSeverity >= 4) {
    return 'moderate';
  }
  return 'minor';
}

export async function fetchActiveSigmets(): Promise<ParsedSigmet[]> {
  try {
    const result = await cachedFetchJson<{ sigmets: ParsedSigmet[] }>(
      SIGMET_CACHE_KEY,
      SIGMET_CACHE_TTL,
      async () => {
        const response = await fetch(SIGMET_URL, {
          headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`SIGMET HTTP ${response.status}`);
        const raw = await response.json() as RawSigmet[];
        const sigmets = (Array.isArray(raw) ? raw : [])
          .map(parseSigmet)
          .filter((s): s is ParsedSigmet => s !== null)
          .sort((a, b) => b.severity - a.severity)
          .slice(0, 30);
        return { sigmets };
      },
    );
    return result?.sigmets ?? [];
  } catch (err) {
    console.warn(`[Aviation] SIGMET fetch failed: ${err instanceof Error ? err.message : 'unknown'}`);
    return [];
  }
}

export function enrichAlertsWithSigmets(
  alerts: AirportDelayAlert[],
  sigmets: ParsedSigmet[],
): AirportDelayAlert[] {
  if (sigmets.length === 0) return alerts;

  const airportByIata = new Map(MONITORED_AIRPORTS.map((a) => [a.iata, a]));
  const severityRank = { normal: 0, minor: 1, moderate: 2, major: 3, severe: 4 };

  return alerts.map((alert) => {
    const airport = airportByIata.get(alert.iata);
    if (!airport) return alert;

    const hits = sigmets.filter((s) => airportAffected(airport.lat, airport.lon, s));
    if (hits.length === 0) return alert;

    const primary = hits[0];
    const hazardText = hits.map((h) => h.hazardLabel).slice(0, 2).join(', ');
    const sigmetNote = `SIGMET: ${hazardText}`;
    const reason = alert.reason?.includes('SIGMET:')
      ? alert.reason
      : alert.reason && alert.reason !== 'Normal operations'
        ? `${alert.reason}; ${sigmetNote}`
        : sigmetNote;

    const currentSeverity = String(alert.severity).replace('FLIGHT_DELAY_SEVERITY_', '').toLowerCase();
    const sigmetRank = sigmetSeverityRank(primary.hazard, primary.severity);
    const bumped =
      (severityRank[currentSeverity as keyof typeof severityRank] ?? 0) < (severityRank[sigmetRank] ?? 0)
        ? toProtoSeverity(sigmetRank)
        : alert.severity;

    return {
      ...alert,
      reason,
      severity: bumped,
      updatedAt: Date.now(),
    };
  });
}