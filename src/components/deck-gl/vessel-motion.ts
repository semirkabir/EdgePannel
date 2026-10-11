/**
 * Motion model for live AIS vessels.
 *
 * AIS reaches the client as a 60s relay snapshot, so ships used to sit still
 * for a minute and then teleport. This mirrors the aircraft model: each vessel
 * is dead-reckoned from its last fix (anchored to when it was observed, not
 * when it arrived), along its estimated turn, and a disagreeing new fix is
 * folded in as a decaying residual rather than a jump.
 *
 * AIS sentinels: COG 360 = not available, true heading 511 = not available,
 * SOG 102.3 = not available. Moored/anchored vessels report ~0 kn and are held.
 */
import type { AisPositionData } from '@/services/maritime';
import { clampNumber, METERS_PER_DEGREE_LAT, normalizeLongitude, shortestLongitudeDelta, smoothstep } from './geo-math';
import {
  courseSlewDurationMs,
  estimateTurnRateDps,
  heldCourseDeg,
  KNOTS_TO_MPS,
  projectAlongArc,
  VESSEL_MAX_TURN_DPS,
} from './turn-motion';

/** Don't project further than this — past it, the report is history, not tracking. */
export const VESSEL_EXTRAPOLATION_MAX_MS = 600_000;
/** Report-age backlog we're willing to catch up when a fix arrives. */
const MAX_REPORT_AGE_MS = 600_000;
/** Below this SOG the vessel is moored/drifting — draw it where reported. */
const MIN_MOVING_KTS = 0.5;
/** Above this SOG the report is garbage (or the 102.3 "not available" sentinel). */
const MAX_PLAUSIBLE_KTS = 60;
/** A residual this large means a bad fix or reacquired vessel — snap. */
const SNAP_DISTANCE_M = 20_000;
const CORRECTION_MIN_MS = 600;
const CORRECTION_MAX_MS = 5000;
/** Ships are slow: 100m of residual → 1.5s of correction. */
const CORRECTION_MS_PER_METER = 15;

export interface VesselRenderPosition {
  lat: number;
  lon: number;
  /** Icon rotation source: true heading when reported, else course. Degrees from north, or NaN. */
  displayDeg: number;
}

export interface VesselMotionState {
  anchor: AisPositionData;
  anchorClockMs: number;
  /** Course over ground used for motion (NaN when not available). */
  courseDeg: number;
  /** Rotation shown on the icon (heading preferred). */
  displayDeg: number;
  speedMps: number;
  turnRateDps: number;
  offsetLat: number;
  offsetLon: number;
  offsetDisplayDeg: number;
  offsetStartMs: number;
  offsetDurationMs: number;
}

function validCourse(deg: number | undefined): number {
  return deg != null && Number.isFinite(deg) && deg >= 0 && deg < 360 ? deg : NaN;
}

function validHeading(deg: number | undefined): number {
  return deg != null && Number.isFinite(deg) && deg >= 0 && deg < 360 ? deg : NaN;
}

function movingSpeedMps(vessel: AisPositionData): number {
  const kts = vessel.speed;
  if (kts == null || !Number.isFinite(kts) || kts < MIN_MOVING_KTS || kts > MAX_PLAUSIBLE_KTS) return 0;
  return kts * KNOTS_TO_MPS;
}

function anchorClockFor(vessel: AisPositionData, nowMs: number, nowEpochMs: number): number {
  const observed = vessel.observedAt;
  if (observed == null || !Number.isFinite(observed)) return nowMs;
  return nowMs - clampNumber(nowEpochMs - observed, 0, MAX_REPORT_AGE_MS);
}

function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const latDeltaM = (bLat - aLat) * METERS_PER_DEGREE_LAT;
  const lonDeltaM = shortestLongitudeDelta(aLon, bLon) * METERS_PER_DEGREE_LAT * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  return Math.hypot(latDeltaM, lonDeltaM);
}

function baseState(vessel: AisPositionData, nowMs: number, nowEpochMs: number): VesselMotionState {
  const courseDeg = validCourse(vessel.course);
  const headingDeg = validHeading(vessel.heading);
  return {
    anchor: vessel,
    anchorClockMs: anchorClockFor(vessel, nowMs, nowEpochMs),
    courseDeg,
    displayDeg: Number.isFinite(headingDeg) ? headingDeg : courseDeg,
    speedMps: Number.isFinite(courseDeg) ? movingSpeedMps(vessel) : 0,
    turnRateDps: 0,
    offsetLat: 0,
    offsetLon: 0,
    offsetDisplayDeg: 0,
    offsetStartMs: 0,
    offsetDurationMs: 0,
  };
}

export function createVesselMotionState(vessel: AisPositionData, nowMs: number, nowEpochMs: number): VesselMotionState {
  return baseState(vessel, nowMs, nowEpochMs);
}

export function resolveVesselPosition(state: VesselMotionState, nowMs: number): VesselRenderPosition {
  const { anchor } = state;
  let lat = anchor.lat;
  let lon = anchor.lon;
  let displayDeg = state.displayDeg;

  const elapsedSec = clampNumber(nowMs - state.anchorClockMs, 0, VESSEL_EXTRAPOLATION_MAX_MS) / 1000;
  if (state.speedMps > 0 && elapsedSec > 0) {
    const moved = projectAlongArc(lat, lon, state.courseDeg, state.speedMps, state.turnRateDps, elapsedSec);
    lat = moved.lat;
    lon = moved.lon;
    // Rotate the hull with the turn too; heading-vs-course offset (crab/drift) is preserved.
    if (state.turnRateDps && Number.isFinite(displayDeg)) {
      displayDeg = displayDeg + shortestLongitudeDelta(state.courseDeg, moved.courseDeg);
    }
  }

  if (state.offsetDurationMs > 0) {
    const elapsed = nowMs - state.offsetStartMs;
    if (elapsed < state.offsetDurationMs) {
      const remaining = 1 - smoothstep(0, 1, clampNumber(elapsed / state.offsetDurationMs, 0, 1));
      lat = clampNumber(lat + state.offsetLat * remaining, -90, 90);
      lon = lon + state.offsetLon * remaining;
      if (Number.isFinite(displayDeg)) displayDeg += state.offsetDisplayDeg * remaining;
    }
  }

  return {
    lat,
    lon: normalizeLongitude(lon),
    displayDeg: Number.isFinite(displayDeg) ? ((displayDeg % 360) + 360) % 360 : NaN,
  };
}

export function advanceVesselMotionState(
  previous: VesselMotionState,
  vessel: AisPositionData,
  nowMs: number,
  nowEpochMs: number,
): VesselMotionState {
  const prevObserved = previous.anchor.observedAt;
  const nextObserved = vessel.observedAt;
  if (prevObserved != null && nextObserved != null && nextObserved < prevObserved) return previous;

  const drawn = resolveVesselPosition(previous, nowMs);
  const next = baseState(vessel, nowMs, nowEpochMs);

  // Drifting/moored vessels report noise for course and heading — keep the hull where it points.
  const reportedSpeedMps = (vessel.speed ?? NaN) * KNOTS_TO_MPS;
  next.displayDeg = heldCourseDeg(next.displayDeg, reportedSpeedMps, drawn.displayDeg);

  if (next.speedMps > 0 && previous.speedMps > 0 && prevObserved != null && nextObserved != null) {
    next.turnRateDps = estimateTurnRateDps(
      { courseDeg: previous.courseDeg, speedMps: previous.speedMps, epochMs: prevObserved },
      { courseDeg: next.courseDeg, speedMps: next.speedMps, epochMs: nextObserved },
      VESSEL_MAX_TURN_DPS,
    );
  }

  const predicted = resolveVesselPosition(next, nowMs);
  const residualM = metersBetween(predicted.lat, predicted.lon, drawn.lat, drawn.lon);
  if (residualM > SNAP_DISTANCE_M) return next;
  const displayResidual = Number.isFinite(predicted.displayDeg) && Number.isFinite(drawn.displayDeg)
    ? shortestLongitudeDelta(predicted.displayDeg, drawn.displayDeg)
    : 0;
  if (residualM < 1 && Math.abs(displayResidual) < 0.5) return next;

  next.offsetLat = drawn.lat - predicted.lat;
  next.offsetLon = shortestLongitudeDelta(predicted.lon, drawn.lon);
  next.offsetDisplayDeg = displayResidual;
  next.offsetStartMs = nowMs;
  next.offsetDurationMs = Math.max(
    clampNumber(residualM * CORRECTION_MS_PER_METER, CORRECTION_MIN_MS, CORRECTION_MAX_MS),
    Math.min(courseSlewDurationMs(displayResidual, next.speedMps), CORRECTION_MAX_MS * 3),
  );
  return next;
}
