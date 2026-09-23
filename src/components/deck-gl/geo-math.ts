/**
 * Pure geo / aircraft-motion math helpers extracted from DeckGLMap.
 *
 * These are stateless, side-effect-free numeric utilities: aircraft position
 * extrapolation, longitude/heading interpolation across the antimeridian, and
 * Web-Mercator projection. Kept in a dedicated module to shrink DeckGLMap.ts
 * and make the math independently testable. Moving them here is behaviour-
 * neutral — every function is called identically from the map.
 */
import type { PositionSample } from '@/services/aviation';

export const METERS_PER_DEGREE_LAT = 111_320;
const KNOTS_TO_METERS_PER_SECOND = 0.514444;
/**
 * Dead-reckoning horizon. Must comfortably exceed the aircraft poll interval
 * (60s live stream / 120s viewport refresh) or the icon freezes between fixes —
 * at 25s it glided for a third of the gap and then sat still.
 */
export const AIRCRAFT_EXTRAPOLATION_MAX_MS = 180_000;

export function formatAircraftAge(observedAt: Date): string {
  const ageSec = Math.max(0, Math.round((Date.now() - observedAt.getTime()) / 1000));
  if (!Number.isFinite(ageSec)) return 'age unknown';
  if (ageSec < 60) return `${ageSec}s old`;
  return `${Math.round(ageSec / 60)}m old`;
}

export function formatAircraftSourceLabel(position: PositionSample): string {
  const provider = position.provider || position.source || 'unknown';
  const tech = position.positionSource && position.positionSource !== 'unknown'
    ? `/${position.positionSource.toUpperCase()}`
    : '';
  return `${provider}${tech}`;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stableUnitInterval(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function shortestLongitudeDelta(from: number, to: number): number {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function normalizeLongitude(lon: number): number {
  if (lon > 180) return lon - 360;
  if (lon < -180) return lon + 360;
  return lon;
}

export function interpolateLongitude(from: number, to: number, t: number): number {
  const delta = shortestLongitudeDelta(from, to);
  return normalizeLongitude(from + delta * t);
}

export function interpolateDegrees(from: number, to: number, t: number): number {
  if (!Number.isFinite(from)) return to;
  if (!Number.isFinite(to)) return from;
  const delta = shortestLongitudeDelta(from, to);
  return (from + delta * t + 360) % 360;
}

export function roughDistanceMeters(a: PositionSample, b: PositionSample): number {
  const latDeltaM = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const lonDelta = shortestLongitudeDelta(a.lon, b.lon);
  const lonDeltaM = lonDelta * METERS_PER_DEGREE_LAT * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(latDeltaM, lonDeltaM);
}

export function projectAircraftPosition(position: PositionSample, elapsedMs: number): PositionSample {
  if (position.onGround || position.freshness === 'stale') return position;
  if (!Number.isFinite(position.groundSpeedKts) || position.groundSpeedKts < 25 || position.groundSpeedKts > 750) return position;
  if (!Number.isFinite(position.trackDeg)) return position;

  const seconds = clampNumber(elapsedMs, 0, AIRCRAFT_EXTRAPOLATION_MAX_MS) / 1000;
  if (seconds <= 0) return position;

  const meters = position.groundSpeedKts * KNOTS_TO_METERS_PER_SECOND * seconds;
  const headingRad = (position.trackDeg * Math.PI) / 180;
  const northMeters = Math.cos(headingRad) * meters;
  const eastMeters = Math.sin(headingRad) * meters;
  const lat = clampNumber(position.lat + northMeters / METERS_PER_DEGREE_LAT, -90, 90);
  // Scale easting by the mean latitude of the leg — over the longer horizons
  // used between fixes, anchoring on the start latitude visibly skews the track
  // at high latitudes.
  const cosLat = Math.max(0.08, Math.cos((((position.lat + lat) / 2) * Math.PI) / 180));
  const lon = normalizeLongitude(position.lon + eastMeters / (METERS_PER_DEGREE_LAT * cosLat));
  const climbFt = Number.isFinite(position.verticalRateMps) ? position.verticalRateMps * seconds * 3.28084 : 0;

  return {
    ...position,
    lat,
    lon,
    altitudeFt: Math.max(0, position.altitudeFt + climbFt),
  };
}

const EARTH_RADIUS_M = 6_371_008.8;

let angularStepCache: { meters: number; sin: number; cos: number } | null = null;
function angularStepTrig(distanceMeters: number): { sin: number; cos: number } {
  if (angularStepCache?.meters !== distanceMeters) {
    const angular = distanceMeters / EARTH_RADIUS_M;
    angularStepCache = { meters: distanceMeters, sin: Math.sin(angular), cos: Math.cos(angular) };
  }
  return angularStepCache;
}

/**
 * Point `distanceMeters` from (lat, lon) along `bearingDeg`, on a sphere.
 *
 * Longitude is deliberately NOT normalised: callers feed both endpoints into
 * mercator space to take a delta, and wrapping one side of an
 * antimeridian-crossing pair across the seam would swing that delta by a full
 * world width.
 */
export function offsetLatLonByBearing(lat: number, lon: number, bearingDeg: number, distanceMeters: number): { lat: number; lon: number } {
  // Called once per aircraft per frame, so the leg-length trig — constant for a
  // fixed probe distance — is memoised rather than recomputed thousands of
  // times a frame.
  const { sin: sinAngular, cos: cosAngular } = angularStepTrig(distanceMeters);
  const bearing = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);

  const nextLat = Math.asin(sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearing));
  const deltaLon = Math.atan2(
    Math.sin(bearing) * sinAngular * cosLat,
    cosAngular - sinLat * Math.sin(nextLat),
  );

  return { lat: (nextLat * 180) / Math.PI, lon: lon + (deltaLon * 180) / Math.PI };
}

export function lngLatToMercatorUnit(lon: number, lat: number): [number, number] {
  const safeLat = clampNumber(lat, -85.05112878, 85.05112878);
  const x = (lon + 180) / 360;
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return [x, y];
}
