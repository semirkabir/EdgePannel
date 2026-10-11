import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceMotionState,
  createMotionState,
  resolveMotionPosition,
} from '../src/components/deck-gl/aircraft-motion.ts';
import {
  arcOffsetEnu,
  estimateTurnRateDps,
  MAX_TURN_INTEGRATION_S,
  projectAlongArc,
} from '../src/components/deck-gl/turn-motion.ts';
import {
  advanceVesselMotionState,
  createVesselMotionState,
  resolveVesselPosition,
} from '../src/components/deck-gl/vessel-motion.ts';
import type { PositionSample } from '../src/services/aviation/index.ts';
import type { AisPositionData } from '../src/services/maritime/index.ts';

const KTS = 0.514444;
const M_PER_DEG = 111_320;
const CLOCK = 100_000;
const EPOCH = 1_700_000_000_000;

function plane(overrides: Partial<PositionSample> = {}): PositionSample {
  return {
    icao24: 'abc123', callsign: 'TEST1', lat: 40, lon: -100, altitudeFt: 10_000,
    groundSpeedKts: 250, trackDeg: 0, verticalRateMps: 0, onGround: false,
    source: 'opensky', provider: 'opensky', originCountry: 'US', lastContactAt: new Date(EPOCH),
    positionSource: 'adsb', aircraftCategory: 3, freshness: 'live', stale: false,
    observedAt: new Date(EPOCH), ...overrides,
  } as PositionSample;
}

function ship(overrides: Partial<AisPositionData> = {}): AisPositionData {
  return { mmsi: '366000001', name: 'TEST', lat: 33.7, lon: -118.2, speed: 12, course: 90, heading: 90, observedAt: EPOCH, ...overrides };
}

function eastM(lat: number, lon0: number, lon1: number): number {
  return (lon1 - lon0) * M_PER_DEG * Math.cos((lat * Math.PI) / 180);
}

describe('turn-motion math', () => {
  it('arc with zero rate is a straight leg', () => {
    const r = arcOffsetEnu(100, 90, 0, 10);
    assert.ok(Math.abs(r.east - 1000) < 1e-6);
    assert.ok(Math.abs(r.north) < 1e-6);
  });

  it('a 90° right turn at 3°/s from north ends heading east, offset by one radius each way', () => {
    const r = arcOffsetEnu(100, 0, 3, 30);
    const radius = 100 / (3 * Math.PI / 180);
    assert.ok(Math.abs(r.endCourseDeg - 90) < 1e-6);
    assert.ok(Math.abs(r.east - radius) < 1, `east ${r.east} vs ${radius}`);
    assert.ok(Math.abs(r.north - radius) < 1, `north ${r.north} vs ${radius}`);
  });

  it('turn rate ignores slow movers (hover jitter is not a turn)', () => {
    const rate = estimateTurnRateDps(
      { courseDeg: 0, speedMps: 2, epochMs: 0 },
      { courseDeg: 90, speedMps: 2, epochMs: 10_000 },
      4,
    );
    assert.equal(rate, 0);
  });

  it('turn rate unwraps across north and clamps', () => {
    const rate = estimateTurnRateDps(
      { courseDeg: 350, speedMps: 100, epochMs: 0 },
      { courseDeg: 10, speedMps: 100, epochMs: 10_000 },
      4,
    );
    assert.ok(Math.abs(rate - 2) < 1e-9);
    const clamped = estimateTurnRateDps(
      { courseDeg: 0, speedMps: 100, epochMs: 0 },
      { courseDeg: 170, speedMps: 100, epochMs: 5_000 },
      4,
    );
    assert.equal(clamped, 4);
  });

  it('arc integration is bounded so a long gap never orbits the icon', () => {
    const p = projectAlongArc(0, 0, 0, 100, 3, 120);
    assert.ok(Math.abs(p.courseDeg - (3 * MAX_TURN_INTEGRATION_S)) < 1e-6);
  });
});

describe('aircraft motion — turns', () => {
  it('follows the turn instead of the stale tangent', () => {
    const first = plane({ trackDeg: 0, observedAt: new Date(EPOCH) });
    const second = plane({ trackDeg: 30, lat: 40.01, observedAt: new Date(EPOCH + 10_000) });
    let state = createMotionState(first, CLOCK, EPOCH);
    state = advanceMotionState(state, second, CLOCK + 10_000, EPOCH + 10_000);
    assert.ok(state.turnRateDps > 2.9 && state.turnRateDps <= 3, `rate ${state.turnRateDps}`);

    // 20s on, the turn has continued: displayed track ≈ 30 + 3*20 = 90 (± correction residue).
    const drawn = resolveMotionPosition(state, CLOCK + 30_000);
    assert.ok(Math.abs(drawn.trackDeg - 90) < 2, `track ${drawn.trackDeg}`);
  });

  it('holds the drawn course when a hovering helicopter reports a random track', () => {
    const first = plane({ groundSpeedKts: 40, trackDeg: 45 });
    const hover = plane({ groundSpeedKts: 1, trackDeg: 270, observedAt: new Date(EPOCH + 10_000) });
    let state = createMotionState(first, CLOCK, EPOCH);
    state = advanceMotionState(state, hover, CLOCK + 10_000, EPOCH + 10_000);
    const drawn = resolveMotionPosition(state, CLOCK + 20_000);
    assert.ok(Math.abs(drawn.trackDeg - 45) < 1e-6, `track ${drawn.trackDeg}`);
  });

  it('slews a slow aircraft’s nose gently instead of snapping', () => {
    const first = plane({ groundSpeedKts: 28, trackDeg: 0 });
    const second = plane({ groundSpeedKts: 28, trackDeg: 120, observedAt: new Date(EPOCH + 60_000) });
    let state = createMotionState(first, CLOCK, EPOCH);
    state = advanceMotionState(state, second, CLOCK + 60_000, EPOCH + 60_000);
    // 120° at ≤12°/s takes ≥10s to resolve — after 1s the nose must still be far from 120.
    const drawn = resolveMotionPosition(state, CLOCK + 61_000);
    assert.ok(state.offsetDurationMs >= 9_000, `duration ${state.offsetDurationMs}`);
    assert.ok(Math.abs(((drawn.trackDeg - 120 + 540) % 360) - 180) > 60, `track ${drawn.trackDeg}`);
  });
});

describe('vessel motion', () => {
  it('dead-reckons a moving ship between relay polls', () => {
    const v = ship();
    const state = createVesselMotionState(v, CLOCK, EPOCH);
    const drawn = resolveVesselPosition(state, CLOCK + 60_000);
    const expected = 12 * KTS * 60;
    assert.ok(Math.abs(eastM(v.lat, v.lon, drawn.lon) - expected) < expected * 0.01);
    assert.equal(drawn.displayDeg, 90);
  });

  it('catches up the report age on first sight', () => {
    const v = ship({ observedAt: EPOCH - 30_000 });
    const drawn = resolveVesselPosition(createVesselMotionState(v, CLOCK, EPOCH), CLOCK);
    const expected = 12 * KTS * 30;
    assert.ok(Math.abs(eastM(v.lat, v.lon, drawn.lon) - expected) < expected * 0.01);
  });

  it('holds moored vessels and the 102.3 kn "not available" sentinel', () => {
    for (const speed of [0.1, 102.3]) {
      const v = ship({ speed });
      const drawn = resolveVesselPosition(createVesselMotionState(v, CLOCK, EPOCH), CLOCK + 60_000);
      assert.equal(drawn.lat, v.lat);
      assert.equal(drawn.lon, v.lon);
    }
  });

  it('does not move a ship whose course is "not available" (360)', () => {
    const v = ship({ course: 360 });
    const drawn = resolveVesselPosition(createVesselMotionState(v, CLOCK, EPOCH), CLOCK + 60_000);
    assert.equal(drawn.lon, v.lon);
  });

  it('falls back to course when heading is 511 (not available)', () => {
    const v = ship({ heading: 511, course: 45 });
    assert.equal(resolveVesselPosition(createVesselMotionState(v, CLOCK, EPOCH), CLOCK).displayDeg, 45);
  });

  it('never jumps when the next fix disagrees', () => {
    const first = ship();
    let state = createVesselMotionState(first, CLOCK, EPOCH);
    const before = resolveVesselPosition(state, CLOCK + 60_000);
    // New fix 300m north of where we predicted.
    const second = ship({ lat: before.lat + 300 / M_PER_DEG, lon: before.lon, observedAt: EPOCH + 60_000 });
    state = advanceVesselMotionState(state, second, CLOCK + 60_000, EPOCH + 60_000);
    const after = resolveVesselPosition(state, CLOCK + 60_000);
    assert.ok(Math.abs(after.lat - before.lat) * M_PER_DEG < 1);
    assert.ok(Math.abs(eastM(before.lat, before.lon, after.lon)) < 1);
  });

  it('ignores an out-of-order fix', () => {
    const state = createVesselMotionState(ship({ observedAt: EPOCH }), CLOCK, EPOCH);
    const next = advanceVesselMotionState(state, ship({ observedAt: EPOCH - 5_000, lat: 0 }), CLOCK + 1, EPOCH + 1);
    assert.equal(next, state);
  });

  it('holds the hull direction of a drifting ship', () => {
    let state = createVesselMotionState(ship({ heading: 200, course: 200 }), CLOCK, EPOCH);
    state = advanceVesselMotionState(state, ship({ speed: 0.2, heading: 511, course: 17, observedAt: EPOCH + 60_000 }), CLOCK + 60_000, EPOCH + 60_000);
    const drawn = resolveVesselPosition(state, CLOCK + 70_000);
    assert.ok(Math.abs(drawn.displayDeg - 200) < 1e-6, `deg ${drawn.displayDeg}`);
  });
});
