import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceMotionState,
  createMotionState,
  resolveMotionPosition,
} from '../src/components/deck-gl/aircraft-motion.ts';
import type { PositionSample } from '../src/services/aviation/index.ts';

/**
 * Regression guards for the live aircraft glide.
 *
 * Two bugs motivated this model and both are covered below:
 *
 * 1. Fixes were drawn where they were *reported*, so the icon trailed reality
 *    by the report age (5–60s — kilometres at cruise). See "report age".
 * 2. Extrapolation was capped at 25s while fixes arrive every 60–120s, so the
 *    icon glided for a third of the gap and then sat frozen. See "no freeze".
 */

const KNOTS_TO_MS = 0.514444;
const METERS_PER_DEGREE_LAT = 111_320;

function sample(overrides: Partial<PositionSample> = {}): PositionSample {
  return {
    icao24: 'abc123',
    callsign: 'BAW123',
    lat: 51.47,
    lon: -0.28,
    altitudeFt: 35_000,
    groundSpeedKts: 450,
    trackDeg: 90, // due east — keeps the assertions one-dimensional
    verticalRateMps: 0,
    onGround: false,
    source: 'opensky',
    provider: 'opensky',
    originCountry: 'United Kingdom',
    lastContactAt: new Date(0),
    positionSource: 'adsb',
    aircraftCategory: 3,
    freshness: 'live',
    stale: false,
    observedAt: new Date(0),
    ...overrides,
  } as PositionSample;
}

/** Signed east/west separation in metres between two positions. */
function eastMeters(from: PositionSample, to: PositionSample): number {
  return (to.lon - from.lon) * METERS_PER_DEGREE_LAT * Math.cos((from.lat * Math.PI) / 180);
}

const CLOCK = 100_000;
const EPOCH = 1_700_000_000_000;

describe('aircraft motion — report age', () => {
  it('draws a stale fix where the aircraft is now, not where it was reported', () => {
    const observedSecondsAgo = 30;
    const fix = sample({ observedAt: new Date(EPOCH - observedSecondsAgo * 1000) });
    const state = createMotionState(fix, CLOCK, EPOCH);

    const drawn = resolveMotionPosition(state, CLOCK);
    const expected = 450 * KNOTS_TO_MS * observedSecondsAgo;

    assert.ok(
      Math.abs(eastMeters(fix, drawn) - expected) < expected * 0.01,
      `expected ~${expected.toFixed(0)}m of catch-up, got ${eastMeters(fix, drawn).toFixed(0)}m`,
    );
  });

  it('does not project a fix that was observed just now', () => {
    const fix = sample({ observedAt: new Date(EPOCH) });
    const drawn = resolveMotionPosition(createMotionState(fix, CLOCK, EPOCH), CLOCK);
    assert.ok(Math.abs(eastMeters(fix, drawn)) < 1);
  });
});

describe('aircraft motion — no freeze between fixes', () => {
  it('keeps moving at ground speed across a full 120s poll gap', () => {
    const state = createMotionState(sample({ observedAt: new Date(EPOCH) }), CLOCK, EPOCH);
    const expectedPerSecond = 450 * KNOTS_TO_MS;

    let previous = resolveMotionPosition(state, CLOCK);
    for (let second = 1; second <= 120; second++) {
      const current = resolveMotionPosition(state, CLOCK + second * 1000);
      const travelled = eastMeters(previous, current);
      assert.ok(
        Math.abs(travelled - expectedPerSecond) < 1,
        `stalled at t=${second}s: moved ${travelled.toFixed(1)}m, expected ~${expectedPerSecond.toFixed(1)}m`,
      );
      previous = current;
    }
  });

  it('holds aircraft on the ground still', () => {
    const fix = sample({ onGround: true, groundSpeedKts: 0, observedAt: new Date(EPOCH) });
    const state = createMotionState(fix, CLOCK, EPOCH);
    assert.equal(eastMeters(fix, resolveMotionPosition(state, CLOCK + 60_000)), 0);
  });
});

describe('aircraft motion — absorbing a new fix', () => {
  it('never jumps when a disagreeing fix arrives', () => {
    let state = createMotionState(sample({ observedAt: new Date(EPOCH) }), CLOCK, EPOCH);

    const laterClock = CLOCK + 60_000;
    const laterEpoch = EPOCH + 60_000;
    const before = resolveMotionPosition(state, laterClock);

    // Aircraft is actually 2km behind where dead reckoning put it.
    const drift = 2000 / (METERS_PER_DEGREE_LAT * Math.cos((51.47 * Math.PI) / 180));
    const fix = sample({ lon: before.lon - drift, observedAt: new Date(laterEpoch - 20_000) });

    state = advanceMotionState(state, fix, laterClock, laterEpoch);
    const after = resolveMotionPosition(state, laterClock);

    assert.ok(
      Math.abs(eastMeters(before, after)) < 1,
      `swap jumped ${eastMeters(before, after).toFixed(1)}m`,
    );
  });

  it('converges onto the new solution once the correction window elapses', () => {
    let state = createMotionState(sample({ observedAt: new Date(EPOCH) }), CLOCK, EPOCH);

    const laterClock = CLOCK + 60_000;
    const laterEpoch = EPOCH + 60_000;
    const before = resolveMotionPosition(state, laterClock);
    const drift = 2000 / (METERS_PER_DEGREE_LAT * Math.cos((51.47 * Math.PI) / 180));
    const fix = sample({ lon: before.lon - drift, observedAt: new Date(laterEpoch - 20_000) });

    const corrected = advanceMotionState(state, fix, laterClock, laterEpoch);
    // Correction is capped at 3.5s; well past that the offset must be gone.
    const settled = resolveMotionPosition(corrected, laterClock + 10_000);
    const pure = resolveMotionPosition(
      createMotionState(fix, laterClock, laterEpoch),
      laterClock + 10_000,
    );

    assert.ok(
      Math.abs(eastMeters(pure, settled)) < 1,
      `still ${eastMeters(pure, settled).toFixed(1)}m off the new solution`,
    );
    state = corrected;
    assert.equal(state.anchor.observedAt.getTime(), fix.observedAt.getTime());
  });

  it('ignores an out-of-order fix rather than rewinding the track', () => {
    const first = sample({ observedAt: new Date(EPOCH) });
    const state = createMotionState(first, CLOCK, EPOCH);

    const older = sample({ lon: -1.0, observedAt: new Date(EPOCH - 200_000) });
    const next = advanceMotionState(state, older, CLOCK + 1000, EPOCH + 1000);

    assert.equal(next.anchor.observedAt.getTime(), first.observedAt.getTime());
  });

  it('snaps rather than blending when an aircraft is reacquired far away', () => {
    const state = createMotionState(sample({ observedAt: new Date(EPOCH) }), CLOCK, EPOCH);

    const laterClock = CLOCK + 60_000;
    const laterEpoch = EPOCH + 60_000;
    // ~700km away — a coverage gap, not a tracking error.
    const reacquired = sample({ lon: 8.5, observedAt: new Date(laterEpoch) });

    const next = advanceMotionState(state, reacquired, laterClock, laterEpoch);
    assert.equal(next.offsetDurationMs, 0);
    assert.ok(Math.abs(resolveMotionPosition(next, laterClock).lon - 8.5) < 0.001);
  });
});
