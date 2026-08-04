/**
 * Motion model for the live ADS-B aircraft layer.
 *
 * ADS-B fixes reach the client every 60–120s and are already 5–60s old by the
 * time they land. Drawing them raw makes the icon teleport once a minute. The
 * previous model tweened from the old position to the new one and then
 * extrapolated for a capped 25s, so an aircraft glided for a third of the poll
 * interval and sat frozen for the rest.
 *
 * This model keeps every aircraft permanently dead-reckoned from its last fix,
 * anchored to the moment the fix was *observed* rather than the moment it
 * arrived, so the icon always moves at true ground speed and is never behind by
 * the report age. When a newer fix disagrees with where we were drawing, the
 * residual is folded in over a short window instead of being applied as a jump —
 * that correction-instead-of-teleport is what makes the motion read as a glide.
 *
 * Pure functions over explicit clocks (`nowMs` = `performance.now()`,
 * `nowEpochMs` = `Date.now()`) so the model is testable without a map.
 */
import type { PositionSample } from '@/services/aviation';
import {
  clampNumber,
  METERS_PER_DEGREE_LAT,
  normalizeLongitude,
  projectAircraftPosition,
  shortestLongitudeDelta,
  smoothstep,
} from './geo-math';

/**
 * How much observation backlog we are willing to project forward when a fix
 * arrives. Fixes older than this are drawn where they were reported — beyond a
 * couple of minutes dead reckoning is guesswork, not tracking.
 */
const MAX_REPORT_AGE_MS = 120_000;

/**
 * Residuals larger than this are treated as a different flight leg (aircraft
 * reacquired after a coverage gap) and snapped rather than blended.
 */
const SNAP_DISTANCE_M = 200_000;

const CORRECTION_MIN_MS = 400;
const CORRECTION_MAX_MS = 3500;
/** Milliseconds of blend per metre of residual. 1km off → 1.2s of correction. */
const CORRECTION_MS_PER_METER = 1.2;

export interface AircraftMotionState {
  /** Most recent fix, used as the dead-reckoning anchor. */
  anchor: PositionSample;
  /** `performance.now()` value that corresponds to `anchor.observedAt`. */
  anchorClockMs: number;
  /** Residual between where we were drawing and the new solution, decayed to zero. */
  offsetLat: number;
  offsetLon: number;
  offsetAltitudeFt: number;
  offsetTrackDeg: number;
  offsetStartMs: number;
  offsetDurationMs: number;
}

const ZERO_OFFSETS = {
  offsetLat: 0,
  offsetLon: 0,
  offsetAltitudeFt: 0,
  offsetTrackDeg: 0,
  offsetStartMs: 0,
  offsetDurationMs: 0,
} as const;

function observedAtEpochMs(sample: PositionSample): number {
  const observed = sample.observedAt instanceof Date ? sample.observedAt.getTime() : NaN;
  return Number.isFinite(observed) ? observed : NaN;
}

/**
 * Map a fix's observation time onto the animation clock. The returned value is
 * the `performance.now()` reading at which the aircraft was actually at
 * `sample.lat/lon`, so `nowMs - anchorClockMs` is the true projection horizon.
 */
function anchorClockFor(sample: PositionSample, nowMs: number, nowEpochMs: number): number {
  const observed = observedAtEpochMs(sample);
  if (!Number.isFinite(observed)) return nowMs;
  const ageMs = clampNumber(nowEpochMs - observed, 0, MAX_REPORT_AGE_MS);
  return nowMs - ageMs;
}

function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const latDeltaM = (bLat - aLat) * METERS_PER_DEGREE_LAT;
  const lonDeltaM = shortestLongitudeDelta(aLon, bLon)
    * METERS_PER_DEGREE_LAT
    * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  return Math.hypot(latDeltaM, lonDeltaM);
}

export function createMotionState(
  sample: PositionSample,
  nowMs: number,
  nowEpochMs: number,
): AircraftMotionState {
  return {
    anchor: sample,
    anchorClockMs: anchorClockFor(sample, nowMs, nowEpochMs),
    ...ZERO_OFFSETS,
  };
}

/**
 * Where the aircraft should be drawn right now: its anchor dead-reckoned to
 * `nowMs`, plus whatever is left of the pending correction.
 */
export function resolveMotionPosition(state: AircraftMotionState, nowMs: number): PositionSample {
  const base = projectAircraftPosition(state.anchor, nowMs - state.anchorClockMs);
  if (state.offsetDurationMs <= 0) return base;

  const elapsed = nowMs - state.offsetStartMs;
  if (elapsed >= state.offsetDurationMs) return base;

  // Residual decays to zero across the correction window.
  const remaining = 1 - smoothstep(0, 1, clampNumber(elapsed / state.offsetDurationMs, 0, 1));
  return {
    ...base,
    lat: clampNumber(base.lat + state.offsetLat * remaining, -90, 90),
    lon: normalizeLongitude(base.lon + state.offsetLon * remaining),
    altitudeFt: Math.max(0, base.altitudeFt + state.offsetAltitudeFt * remaining),
    trackDeg: ((base.trackDeg + state.offsetTrackDeg * remaining) % 360 + 360) % 360,
  };
}

/**
 * Fold a newly arrived fix into an existing track. The visible position is
 * preserved across the swap — only the residual changes — so a late or slightly
 * disagreeing fix never shows up as a jump.
 */
export function advanceMotionState(
  previous: AircraftMotionState,
  sample: PositionSample,
  nowMs: number,
  nowEpochMs: number,
): AircraftMotionState {
  const anchorClockMs = anchorClockFor(sample, nowMs, nowEpochMs);
  const next: AircraftMotionState = { anchor: sample, anchorClockMs, ...ZERO_OFFSETS };

  const previousObserved = observedAtEpochMs(previous.anchor);
  const nextObserved = observedAtEpochMs(sample);
  // Out-of-order fix (a stale cache entry landing after a fresher one) — keep
  // the better anchor rather than rewinding the aircraft.
  if (Number.isFinite(previousObserved) && Number.isFinite(nextObserved) && nextObserved < previousObserved) {
    return previous;
  }

  const drawn = resolveMotionPosition(previous, nowMs);
  const predicted = resolveMotionPosition(next, nowMs);

  const residualM = metersBetween(predicted.lat, predicted.lon, drawn.lat, drawn.lon);
  if (residualM > SNAP_DISTANCE_M) return next;
  if (residualM < 1) return next;

  next.offsetLat = drawn.lat - predicted.lat;
  next.offsetLon = shortestLongitudeDelta(predicted.lon, drawn.lon);
  next.offsetAltitudeFt = (drawn.altitudeFt ?? 0) - (predicted.altitudeFt ?? 0);
  next.offsetTrackDeg = shortestLongitudeDelta(predicted.trackDeg, drawn.trackDeg);
  next.offsetStartMs = nowMs;
  next.offsetDurationMs = clampNumber(
    residualM * CORRECTION_MS_PER_METER,
    CORRECTION_MIN_MS,
    CORRECTION_MAX_MS,
  );
  return next;
}
