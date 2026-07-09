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
const AIRCRAFT_EXTRAPOLATION_MAX_MS = 25_000;

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
  const cosLat = Math.max(0.08, Math.cos((position.lat * Math.PI) / 180));
  const lon = normalizeLongitude(position.lon + eastMeters / (METERS_PER_DEGREE_LAT * cosLat));
  const climbFt = Number.isFinite(position.verticalRateMps) ? position.verticalRateMps * seconds * 3.28084 : 0;

  return {
    ...position,
    lat,
    lon,
    altitudeFt: Math.max(0, position.altitudeFt + climbFt),
  };
}

export function lngLatToMercatorUnit(lon: number, lat: number): [number, number] {
  const safeLat = clampNumber(lat, -85.05112878, 85.05112878);
  const x = (lon + 180) / 360;
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return [x, y];
}
