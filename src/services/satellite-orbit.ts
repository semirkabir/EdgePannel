/**
 * Satellite orbit propagation.
 * Uses satellite.js SGP4/SDP4 for CelesTrak TLE and OMM-style GP records.
 */
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  twoline2satrec,
} from 'satellite.js';

type SatRec = ReturnType<typeof twoline2satrec>;
type OmmJson = Parameters<typeof json2satrec>[0];

interface OrbitParams {
  epochDays: number;
  inclination: number;
  raan: number;
  eccentricity: number;
  argPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
  semiMajorAxis: number;
}

export interface SatelliteOrbitInput {
  id?: string;
  noradId?: number;
  name?: string;
  objectId?: string;
  tle1?: string;
  tle2?: string;
  epoch?: string;
  meanMotion?: number;
  eccentricity?: number;
  inclination?: number;
  raan?: number;
  argPerigee?: number;
  meanAnomaly?: number;
  elementSetNo?: number;
  bstar?: number;
  meanMotionDot?: number;
  meanMotionDdot?: number;
}

const fallbackPosition = { lat: 0, lon: 0, alt: 400 };
const objectSatrecCache = new WeakMap<SatelliteOrbitInput, SatRec | null>();
const tleSatrecCache = new Map<string, SatRec | null>();

function numberOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback;
}

function validPosition(position: { lat: number; lon: number; alt: number }): boolean {
  return Number.isFinite(position.lat) && Number.isFinite(position.lon) && Number.isFinite(position.alt);
}

function parseTLEFallback(line1: string, line2: string): OrbitParams {
  const epochYearVal = parseInt(line1.substring(18, 20).trim(), 10);
  const epochYear = epochYearVal < 57 ? 2000 + epochYearVal : 1900 + epochYearVal;
  const epochDays = parseFloat(line1.substring(20, 32).trim());
  const inclination = parseFloat(line2.substring(8, 16).trim()) * (Math.PI / 180);
  const raan = parseFloat(line2.substring(17, 25).trim()) * (Math.PI / 180);
  const eccentricity = parseFloat(`0.${line2.substring(26, 33).trim()}`);
  const argPerigee = parseFloat(line2.substring(34, 42).trim()) * (Math.PI / 180);
  const meanAnomaly = parseFloat(line2.substring(43, 51).trim()) * (Math.PI / 180);
  const meanMotion = parseFloat(line2.substring(52, 63).trim()) * (2 * Math.PI) / 1440;
  const nSec = meanMotion / 60;
  const semiMajorAxis = Math.pow(398600.4418 / (nSec * nSec), 1 / 3);

  return {
    epochDays: getJulianDays(epochYear, epochDays),
    inclination,
    raan,
    eccentricity,
    argPerigee,
    meanAnomaly,
    meanMotion,
    semiMajorAxis,
  };
}

function parseOrbitInputFallback(input: SatelliteOrbitInput): OrbitParams {
  if (input.tle1 && input.tle2) return parseTLEFallback(input.tle1, input.tle2);

  const epoch = input.epoch ? new Date(input.epoch) : null;
  if (
    !epoch ||
    Number.isNaN(epoch.getTime()) ||
    !Number.isFinite(input.meanMotion) ||
    !Number.isFinite(input.eccentricity) ||
    !Number.isFinite(input.inclination) ||
    !Number.isFinite(input.raan) ||
    !Number.isFinite(input.argPerigee) ||
    !Number.isFinite(input.meanAnomaly)
  ) {
    throw new Error('Missing satellite orbital elements');
  }

  const meanMotion = (input.meanMotion as number) * (2 * Math.PI) / 1440;
  const nSec = meanMotion / 60;
  const semiMajorAxis = Math.pow(398600.4418 / (nSec * nSec), 1 / 3);

  return {
    epochDays: getJulianDaysFromDate(epoch),
    inclination: (input.inclination as number) * (Math.PI / 180),
    raan: (input.raan as number) * (Math.PI / 180),
    eccentricity: input.eccentricity as number,
    argPerigee: (input.argPerigee as number) * (Math.PI / 180),
    meanAnomaly: (input.meanAnomaly as number) * (Math.PI / 180),
    meanMotion,
    semiMajorAxis,
  };
}

function getJulianDays(year: number, days: number): number {
  const y = year - 1;
  const jdJan1 = Math.floor(365.25 * y) - Math.floor(y / 100) + Math.floor(y / 400) + 1721424.5;
  return jdJan1 + days;
}

function getJulianDaysFromDate(date: Date): number {
  return (date.getTime() / 86400000) + 2440587.5;
}

function solveKepler(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 5; i += 1) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

function calculateFallbackPosition(params: OrbitParams, date: Date): { lat: number; lon: number; alt: number } {
  const diffDays = getJulianDaysFromDate(date) - params.epochDays;
  const tMinutes = diffDays * 1440;
  const M = (params.meanAnomaly + params.meanMotion * tMinutes) % (2 * Math.PI);
  const E = solveKepler(M, params.eccentricity);
  const sinNu = (Math.sqrt(1 - params.eccentricity * params.eccentricity) * Math.sin(E)) / (1 - params.eccentricity * Math.cos(E));
  const cosNu = (Math.cos(E) - params.eccentricity) / (1 - params.eccentricity * Math.cos(E));
  const nu = Math.atan2(sinNu, cosNu);
  const r = params.semiMajorAxis * (1 - params.eccentricity * Math.cos(E));
  const u = params.argPerigee + nu;
  const xOrb = r * Math.cos(u);
  const yOrb = r * Math.sin(u);
  const xEci = xOrb * Math.cos(params.raan) - yOrb * Math.sin(params.raan) * Math.cos(params.inclination);
  const yEci = xOrb * Math.sin(params.raan) + yOrb * Math.cos(params.raan) * Math.cos(params.inclination);
  const zEci = yOrb * Math.sin(params.inclination);
  let lonRad = Math.atan2(yEci, xEci) - 0.262516186 * tMinutes;
  lonRad = ((lonRad + Math.PI) % (2 * Math.PI));
  if (lonRad < 0) lonRad += 2 * Math.PI;
  lonRad -= Math.PI;

  return {
    lat: Math.atan2(zEci, Math.sqrt(xEci * xEci + yEci * yEci)) * (180 / Math.PI),
    lon: lonRad * (180 / Math.PI),
    alt: Math.max(0, r - 6378.137),
  };
}

function buildOmm(input: SatelliteOrbitInput): OmmJson {
  return {
    OBJECT_NAME: input.name || input.id || `NORAD ${input.noradId ?? 'UNKNOWN'}`,
    OBJECT_ID: input.objectId || String(input.noradId ?? input.id ?? 'UNKNOWN'),
    EPOCH: input.epoch as string,
    MEAN_MOTION: input.meanMotion as number,
    ECCENTRICITY: input.eccentricity as number,
    INCLINATION: input.inclination as number,
    RA_OF_ASC_NODE: input.raan as number,
    ARG_OF_PERICENTER: input.argPerigee as number,
    MEAN_ANOMALY: input.meanAnomaly as number,
    NORAD_CAT_ID: input.noradId ?? 0,
    ELEMENT_SET_NO: numberOr(input.elementSetNo, 999),
    BSTAR: numberOr(input.bstar, 0),
    MEAN_MOTION_DOT: numberOr(input.meanMotionDot, 0),
    MEAN_MOTION_DDOT: numberOr(input.meanMotionDdot, 0),
    MEAN_ELEMENT_THEORY: 'SGP4',
  };
}

function hasOmmFields(input: SatelliteOrbitInput): boolean {
  return Boolean(
    input.epoch &&
    Number.isFinite(input.meanMotion) &&
    Number.isFinite(input.eccentricity) &&
    Number.isFinite(input.inclination) &&
    Number.isFinite(input.raan) &&
    Number.isFinite(input.argPerigee) &&
    Number.isFinite(input.meanAnomaly),
  );
}

function satrecFromInput(input: SatelliteOrbitInput): SatRec | null {
  const cached = objectSatrecCache.get(input);
  if (cached !== undefined) return cached;

  let satrec: SatRec | null = null;
  try {
    if (input.tle1 && input.tle2) {
      satrec = twoline2satrec(input.tle1, input.tle2);
    } else if (hasOmmFields(input)) {
      satrec = json2satrec(buildOmm(input));
    }
  } catch {
    satrec = null;
  }

  objectSatrecCache.set(input, satrec);
  return satrec;
}

function satrecFromTle(tle1: string, tle2: string): SatRec | null {
  const key = `${tle1}\n${tle2}`;
  if (tleSatrecCache.has(key)) return tleSatrecCache.get(key) ?? null;
  let satrec: SatRec | null = null;
  try {
    satrec = twoline2satrec(tle1, tle2);
  } catch {
    satrec = null;
  }
  tleSatrecCache.set(key, satrec);
  return satrec;
}

function propagateSatrec(satrec: SatRec | null, date: Date): { lat: number; lon: number; alt: number } | null {
  if (!satrec) return null;
  const pv = propagate(satrec, date);
  if (!pv?.position) return null;
  const geodetic = eciToGeodetic(pv.position, gstime(date));
  const position = {
    lat: degreesLat(geodetic.latitude),
    lon: degreesLong(geodetic.longitude),
    alt: Math.max(0, geodetic.height),
  };
  return validPosition(position) ? position : null;
}

function fallbackFromInput(input: SatelliteOrbitInput, date: Date): { lat: number; lon: number; alt: number } {
  try {
    const position = calculateFallbackPosition(parseOrbitInputFallback(input), date);
    return validPosition(position) ? position : fallbackPosition;
  } catch {
    return fallbackPosition;
  }
}

function fallbackFromTle(tle1: string, tle2: string, date: Date): { lat: number; lon: number; alt: number } {
  try {
    const position = calculateFallbackPosition(parseTLEFallback(tle1, tle2), date);
    return validPosition(position) ? position : fallbackPosition;
  } catch {
    return fallbackPosition;
  }
}

export function getSatellitePosition(tle1: string, tle2: string, timeMs: number): { lat: number; lon: number; alt: number };
export function getSatellitePosition(satellite: SatelliteOrbitInput, timeMs: number): { lat: number; lon: number; alt: number };
export function getSatellitePosition(tleOrSatellite: string | SatelliteOrbitInput, tle2OrTimeMs: string | number, maybeTimeMs?: number): { lat: number; lon: number; alt: number } {
  const timeMs = typeof tleOrSatellite === 'string' ? maybeTimeMs : tle2OrTimeMs;
  const date = new Date(Number(timeMs));
  if (Number.isNaN(date.getTime())) return fallbackPosition;

  if (typeof tleOrSatellite === 'string') {
    return propagateSatrec(satrecFromTle(tleOrSatellite, String(tle2OrTimeMs)), date)
      ?? fallbackFromTle(tleOrSatellite, String(tle2OrTimeMs), date);
  }

  return propagateSatrec(satrecFromInput(tleOrSatellite), date)
    ?? fallbackFromInput(tleOrSatellite, date);
}

function periodMinutes(input: SatelliteOrbitInput): number {
  const meanMotion = Number(input.meanMotion);
  if (Number.isFinite(meanMotion) && meanMotion > 0) return 1440 / meanMotion;
  return 96;
}

function periodMinutesFromTle(line2: string): number {
  const meanMotion = parseFloat(line2.substring(52, 63).trim());
  return Number.isFinite(meanMotion) && meanMotion > 0 ? 1440 / meanMotion : 96;
}

export function getOrbitalPath(tle1: string, tle2: string, timeMs: number): Array<[number, number, number]>;
export function getOrbitalPath(satellite: SatelliteOrbitInput, timeMs: number): Array<[number, number, number]>;
export function getOrbitalPath(tleOrSatellite: string | SatelliteOrbitInput, tle2OrTimeMs: string | number, maybeTimeMs?: number): Array<[number, number, number]> {
  const path: Array<[number, number, number]> = [];
  const timeMs = typeof tleOrSatellite === 'string' ? maybeTimeMs : tle2OrTimeMs;
  const baseDate = new Date(Number(timeMs));
  if (Number.isNaN(baseDate.getTime())) return path;

  const steps = 100;
  const orbitMinutes = typeof tleOrSatellite === 'string'
    ? periodMinutesFromTle(String(tle2OrTimeMs))
    : periodMinutes(tleOrSatellite);

  for (let i = 0; i <= steps; i += 1) {
    const dateMs = baseDate.getTime() + (orbitMinutes / steps) * i * 60000;
    const pos = typeof tleOrSatellite === 'string'
      ? getSatellitePosition(tleOrSatellite, String(tle2OrTimeMs), dateMs)
      : getSatellitePosition(tleOrSatellite, dateMs);
    path.push([pos.lon, pos.lat, pos.alt]);
  }

  return path.length ? path : [[-180, 0, 400], [180, 0, 400]];
}
