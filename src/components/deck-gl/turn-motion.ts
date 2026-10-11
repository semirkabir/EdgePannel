/**
 * Turn-aware dead-reckoning + low-speed course policy, shared by the live
 * aircraft and AIS vessel motion models.
 *
 * Straight-line dead reckoning cuts corners: an aircraft in a standard-rate
 * turn is projected along its last tangent, then yanked back onto the arc when
 * the next fix lands. Integrating a constant-rate turn instead keeps the icon
 * on the curve it is actually flying.
 *
 * At low speed the opposite problem appears: a hovering helicopter's reported
 * track is GPS-vector noise, so trusting it spins the icon. Below a hold floor
 * the displayed course is frozen; above it, slow movers get a gentler slew cap.
 *
 * Adapted from God's Eye View (https://github.com/bilawalsidhu/gods-eye-view,
 * MIT, © 2026 Bilawal Sidhu) src/data/motionModel.js, which in turn adapts the
 * turn-rate estimator and arc integration from skylight
 * (https://github.com/cpaczek/skylight, MIT) shared/src/aim.ts.
 */

import { METERS_PER_DEGREE_LAT, clampNumber, normalizeLongitude } from './geo-math';

const DEG = Math.PI / 180;
export const KNOTS_TO_MPS = 0.514444;

/** Below this ground speed the reported track means nothing (hover / GPS drift): hold the displayed course. ≈3 kt. */
export const COURSE_HOLD_SPEED_MPS = 1.5;
/** Below this speed, track deltas between fixes are noise, not a turn. ≈10 kt. */
export const TURN_MIN_SPEED_MPS = 5;
/** Turn rates under this are treated as straight flight. */
export const TURN_NOISE_FLOOR_DPS = 0.4;
/** Clamp for aircraft (standard-rate turn is 3°/s). */
export const AIRCRAFT_MAX_TURN_DPS = 4;
/** Ships turn far slower; anything above this between AIS fixes is a bad course report. */
export const VESSEL_MAX_TURN_DPS = 1.5;
/**
 * Integrate the turn for at most this long, then continue straight on the end
 * course. A constant 3°/s for a full 120s poll gap is a complete circle — real
 * turns end long before that, and an unbounded arc would orbit the icon.
 */
export const MAX_TURN_INTEGRATION_S = 30;
/** Fix pairs further apart than this (or closer than 2s) can't tell us a rate. */
const TURN_SAMPLE_MIN_DT_S = 2;
const TURN_SAMPLE_MAX_DT_S = 180;

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Normalise to (−180, 180]. */
export function norm180(deg: number): number {
  const n = norm360(deg);
  return n > 180 ? n - 360 : n;
}

/**
 * Signed turn rate (°/s, positive = clockwise) between two course reports.
 * Returns 0 when either endpoint is too slow to trust its course, the interval
 * is outside the usable window, or the rate is below the noise floor.
 */
export function estimateTurnRateDps(
  prev: { courseDeg: number; speedMps: number; epochMs: number },
  next: { courseDeg: number; speedMps: number; epochMs: number },
  maxDps: number,
): number {
  if (!Number.isFinite(prev.courseDeg) || !Number.isFinite(next.courseDeg)) return 0;
  if (!Number.isFinite(prev.epochMs) || !Number.isFinite(next.epochMs)) return 0;
  const dtSec = (next.epochMs - prev.epochMs) / 1000;
  if (dtSec < TURN_SAMPLE_MIN_DT_S || dtSec > TURN_SAMPLE_MAX_DT_S) return 0;
  if (Number.isFinite(prev.speedMps) && prev.speedMps < TURN_MIN_SPEED_MPS) return 0;
  if (Number.isFinite(next.speedMps) && next.speedMps < TURN_MIN_SPEED_MPS) return 0;
  const rate = norm180(next.courseDeg - prev.courseDeg) / dtSec;
  if (Math.abs(rate) < TURN_NOISE_FLOOR_DPS) return 0;
  return clampNumber(rate, -maxDps, maxDps);
}

/**
 * East/north displacement (m) after `dtSec` of a constant-rate turn, plus the
 * course at the end. A zero rate degenerates to a straight leg.
 */
export function arcOffsetEnu(
  speedMps: number,
  courseDeg: number,
  turnRateDps: number,
  dtSec: number,
): { east: number; north: number; endCourseDeg: number } {
  const tr = courseDeg * DEG;
  const w = (turnRateDps || 0) * DEG;
  if (Math.abs(w) < 1e-4) {
    return {
      east: speedMps * Math.sin(tr) * dtSec,
      north: speedMps * Math.cos(tr) * dtSec,
      endCourseDeg: norm360(courseDeg),
    };
  }
  return {
    east: (speedMps / w) * (Math.cos(tr) - Math.cos(tr + w * dtSec)),
    north: (speedMps / w) * (Math.sin(tr + w * dtSec) - Math.sin(tr)),
    endCourseDeg: norm360(courseDeg + turnRateDps * dtSec),
  };
}

/**
 * Dead-reckon a fix `dtSec` forward: arc for up to MAX_TURN_INTEGRATION_S,
 * straight on the end course after that.
 */
export function projectAlongArc(
  lat: number,
  lon: number,
  courseDeg: number,
  speedMps: number,
  turnRateDps: number,
  dtSec: number,
): { lat: number; lon: number; courseDeg: number } {
  if (!(dtSec > 0) || !(speedMps > 0) || !Number.isFinite(courseDeg)) {
    return { lat, lon, courseDeg };
  }
  const arcSec = turnRateDps ? Math.min(dtSec, MAX_TURN_INTEGRATION_S) : dtSec;
  const arc = arcOffsetEnu(speedMps, courseDeg, turnRateDps, arcSec);
  let east = arc.east;
  let north = arc.north;
  const straightSec = dtSec - arcSec;
  if (straightSec > 0) {
    const endRad = arc.endCourseDeg * DEG;
    east += speedMps * Math.sin(endRad) * straightSec;
    north += speedMps * Math.cos(endRad) * straightSec;
  }
  const nextLat = clampNumber(lat + north / METERS_PER_DEGREE_LAT, -90, 90);
  // Mean-latitude easting scale, matching projectAircraftPosition.
  const cosLat = Math.max(0.08, Math.cos((((lat + nextLat) / 2) * Math.PI) / 180));
  return {
    lat: nextLat,
    lon: normalizeLongitude(lon + east / (METERS_PER_DEGREE_LAT * cosLat)),
    courseDeg: arc.endCourseDeg,
  };
}

/**
 * Course to display for a new fix. Below the hold floor the reported course is
 * noise, so the previously drawn course wins.
 */
export function heldCourseDeg(reportedDeg: number, speedMps: number, drawnDeg: number): number {
  if (Number.isFinite(speedMps) && speedMps < COURSE_HOLD_SPEED_MPS && Number.isFinite(drawnDeg)) {
    return drawnDeg;
  }
  return Number.isFinite(reportedDeg) ? reportedDeg : drawnDeg;
}

/** Slowest course slew (°/s) — for movers at/below 30 kt. Faster movers may whip at up to 60°/s. */
export const COURSE_MIN_SLEW_DPS = 12;
const COURSE_MAX_SLEW_DPS = 60;
const SLOW_SPEED_MPS = 15.4; // ≈30 kt
const CRUISE_SPEED_MPS = 25.7; // ≈50 kt

/** Minimum time (ms) a course correction of `deltaDeg` should take at this speed. */
export function courseSlewDurationMs(deltaDeg: number, speedMps: number): number {
  const ramp = !Number.isFinite(speedMps)
    ? 1
    : clampNumber((speedMps - SLOW_SPEED_MPS) / (CRUISE_SPEED_MPS - SLOW_SPEED_MPS), 0, 1);
  const capDps = COURSE_MIN_SLEW_DPS + (COURSE_MAX_SLEW_DPS - COURSE_MIN_SLEW_DPS) * ramp;
  return (Math.abs(deltaDeg) / capDps) * 1000;
}
