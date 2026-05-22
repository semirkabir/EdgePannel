/**
 * Native Keplerian Satellite Orbit Solver
 * Calculates dynamic satellite geodetic coordinates (latitude, longitude, altitude)
 * and traces orbital paths using Two-Line Element (TLE) standard parameters.
 */

interface OrbitParams {
  epochDays: number;
  inclination: number; // radians
  raan: number;        // radians
  eccentricity: number;
  argPerigee: number;   // radians
  meanAnomaly: number;  // radians
  meanMotion: number;   // radians/min
  semiMajorAxis: number; // km
}

export interface SatelliteOrbitInput {
  tle1?: string;
  tle2?: string;
  epoch?: string;
  meanMotion?: number;   // revolutions/day
  eccentricity?: number;
  inclination?: number;  // degrees
  raan?: number;         // degrees
  argPerigee?: number;   // degrees
  meanAnomaly?: number;  // degrees
}

/**
 * Parses raw TLE line 1 and line 2 into Keplerian orbital parameters.
 */
function parseTLE(line1: string, line2: string): OrbitParams {
  // Line 1 Parsing
  const epochYearVal = parseInt(line1.substring(18, 20).trim());
  const epochYear = epochYearVal < 57 ? 2000 + epochYearVal : 1900 + epochYearVal;
  const epochDays = parseFloat(line1.substring(20, 32).trim());

  // Line 2 Parsing
  const inclination = parseFloat(line2.substring(8, 16).trim()) * (Math.PI / 180);
  const raan = parseFloat(line2.substring(17, 25).trim()) * (Math.PI / 180);
  
  // Eccentricity (with implied leading decimal point)
  const eccStr = line2.substring(26, 33).trim();
  const eccentricity = parseFloat('0.' + eccStr);
  
  const argPerigee = parseFloat(line2.substring(34, 42).trim()) * (Math.PI / 180);
  const meanAnomaly = parseFloat(line2.substring(43, 51).trim()) * (Math.PI / 180);
  
  // Mean motion in revolutions per day
  const revsPerDay = parseFloat(line2.substring(52, 63).trim());
  const meanMotion = revsPerDay * (2 * Math.PI) / 1440; // radians per minute

  // Kepler's Third Law: a = (mu / n^2)^(1/3)
  // mu = 398600.4418 km^3/s^2. n in rad/sec = meanMotion / 60
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
    semiMajorAxis
  };
}

function parseOrbitInput(input: SatelliteOrbitInput): OrbitParams {
  if (input.tle1 && input.tle2) return parseTLE(input.tle1, input.tle2);

  const epoch = input.epoch ? new Date(input.epoch) : null;
  const revsPerDay = input.meanMotion;
  const eccentricity = input.eccentricity;
  const inclination = input.inclination;
  const raan = input.raan;
  const argPerigee = input.argPerigee;
  const meanAnomaly = input.meanAnomaly;

  if (
    !epoch ||
    Number.isNaN(epoch.getTime()) ||
    !Number.isFinite(revsPerDay) ||
    !Number.isFinite(eccentricity) ||
    !Number.isFinite(inclination) ||
    !Number.isFinite(raan) ||
    !Number.isFinite(argPerigee) ||
    !Number.isFinite(meanAnomaly)
  ) {
    throw new Error('Missing satellite orbital elements');
  }

  const meanMotion = (revsPerDay as number) * (2 * Math.PI) / 1440;
  const nSec = meanMotion / 60;
  const semiMajorAxis = Math.pow(398600.4418 / (nSec * nSec), 1 / 3);

  return {
    epochDays: getJulianDaysFromDate(epoch),
    inclination: (inclination as number) * (Math.PI / 180),
    raan: (raan as number) * (Math.PI / 180),
    eccentricity: eccentricity as number,
    argPerigee: (argPerigee as number) * (Math.PI / 180),
    meanAnomaly: (meanAnomaly as number) * (Math.PI / 180),
    meanMotion,
    semiMajorAxis
  };
}

/**
 * Helper to calculate Julian days since epoch for TLE days formatting
 */
function getJulianDays(year: number, days: number): number {
  // Standard Julian Day Formula for Jan 1 0h of year
  const y = year - 1;
  const jdJan1 = Math.floor(365.25 * y) - Math.floor(y / 100) + Math.floor(y / 400) + 1721424.5;
  return jdJan1 + days;
}

/**
 * Helper to convert standard JS Date to Julian Days
 */
function getJulianDaysFromDate(date: Date): number {
  const time = date.getTime();
  return (time / 86400000) + 2440587.5;
}

/**
 * Solves Kepler's Equation E - e * sin(E) = M using Newton-Raphson method.
 */
function solveKepler(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 5; i++) {
    const deltaE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= deltaE;
  }
  return E;
}

/**
 * Calculates geodetic latitude, longitude, and altitude from parsed orbital params at a given time.
 */
function calculatePosition(params: OrbitParams, date: Date): { lat: number; lon: number; alt: number } {
  const currentJD = getJulianDaysFromDate(date);
  const diffDays = currentJD - params.epochDays;
  const tMinutes = diffDays * 1440; // minutes since TLE epoch

  // 1. Mean Anomaly at time t
  const M = (params.meanAnomaly + params.meanMotion * tMinutes) % (2 * Math.PI);

  // 2. Solve Kepler's Equation for Eccentric Anomaly
  const E = solveKepler(M, params.eccentricity);

  // 3. True Anomaly nu
  const sinNu = (Math.sqrt(1 - params.eccentricity * params.eccentricity) * Math.sin(E)) / (1 - params.eccentricity * Math.cos(E));
  const cosNu = (Math.cos(E) - params.eccentricity) / (1 - params.eccentricity * Math.cos(E));
  const nu = Math.atan2(sinNu, cosNu);

  // 4. Distance r (km)
  const r = params.semiMajorAxis * (1 - params.eccentricity * Math.cos(E));

  // 5. Plane coordinates
  const u = params.argPerigee + nu;
  const xOrb = r * Math.cos(u);
  const yOrb = r * Math.sin(u);

  // 6. ECI (Earth-Centered Inertial) coordinates
  const cosRaan = Math.cos(params.raan);
  const sinRaan = Math.sin(params.raan);
  const cosInc = Math.cos(params.inclination);
  const sinInc = Math.sin(params.inclination);

  const xEci = xOrb * cosRaan - yOrb * sinRaan * cosInc;
  const yEci = xOrb * sinRaan + yOrb * cosRaan * cosInc;
  const zEci = yOrb * sinInc;

  // 7. Earth Rotation correction (to ECEF / Geodetic)
  // Earth angular speed: 360.9856 degrees/day = 0.004375269 rad/sec = 0.262516 rad/min
  const earthRotationRad = 0.262516186 * tMinutes;
  
  let lonRad = Math.atan2(yEci, xEci) - earthRotationRad;
  // Normalize longitude to -PI to PI
  lonRad = ((lonRad + Math.PI) % (2 * Math.PI));
  if (lonRad < 0) lonRad += 2 * Math.PI;
  lonRad -= Math.PI;

  const latRad = Math.atan2(zEci, Math.sqrt(xEci * xEci + yEci * yEci));

  // Earth radius ~6378.137 km
  const alt = r - 6378.137;

  return {
    lat: latRad * (180 / Math.PI),
    lon: lonRad * (180 / Math.PI),
    alt: alt > 0 ? alt : 0
  };
}

export function getSatellitePosition(tle1: string, tle2: string, timeMs: number): { lat: number; lon: number; alt: number };
export function getSatellitePosition(satellite: SatelliteOrbitInput, timeMs: number): { lat: number; lon: number; alt: number };
/**
 * Public API: Computes dynamic geodetic coordinates for a satellite.
 * Accepts either legacy TLE lines or CelesTrak GP/OMM-style orbital fields.
 */
export function getSatellitePosition(tleOrSatellite: string | SatelliteOrbitInput, tle2OrTimeMs: string | number, maybeTimeMs?: number): { lat: number; lon: number; alt: number } {
  try {
    const params = typeof tleOrSatellite === 'string'
      ? parseTLE(tleOrSatellite, String(tle2OrTimeMs))
      : parseOrbitInput(tleOrSatellite);
    const timeMs = typeof tleOrSatellite === 'string' ? maybeTimeMs : tle2OrTimeMs;
    return calculatePosition(params, new Date(Number(timeMs)));
  } catch (err) {
    // Graceful fallback coordinate center
    return { lat: 0, lon: 0, alt: 400 };
  }
}

/**
 * Public API: Traces a complete 100-point orbital path loop (Lon, Lat, Alt) for mapping layers.
 */
export function getOrbitalPath(tle1: string, tle2: string, timeMs: number): Array<[number, number, number]>;
export function getOrbitalPath(satellite: SatelliteOrbitInput, timeMs: number): Array<[number, number, number]>;
export function getOrbitalPath(tleOrSatellite: string | SatelliteOrbitInput, tle2OrTimeMs: string | number, maybeTimeMs?: number): Array<[number, number, number]> {
  const path: Array<[number, number, number]> = [];
  try {
    const params = typeof tleOrSatellite === 'string'
      ? parseTLE(tleOrSatellite, String(tle2OrTimeMs))
      : parseOrbitInput(tleOrSatellite);
    const timeMs = typeof tleOrSatellite === 'string' ? maybeTimeMs : tle2OrTimeMs;
    // Period in minutes = 2*PI / meanMotion
    const periodMin = (2 * Math.PI) / params.meanMotion;
    const baseDate = new Date(Number(timeMs));
    const steps = 100;

    for (let i = 0; i <= steps; i++) {
      const offsetMin = (periodMin / steps) * i;
      const date = new Date(baseDate.getTime() + offsetMin * 60000);
      const pos = calculatePosition(params, date);
      path.push([pos.lon, pos.lat, pos.alt]);
    }
  } catch (err) {
    // Return a dummy equator ring if failed
    for (let i = 0; i <= 360; i += 3.6) {
      path.push([i - 180, 0, 400]);
    }
  }
  return path;
}
