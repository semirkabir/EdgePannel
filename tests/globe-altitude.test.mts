/**
 * Guards the 3D globe altitude model.
 *
 * These numbers are what "accurate heights" means in practice: real aircraft
 * altitudes rather than a cruise band every plane is forced into, and real
 * satellite altitudes through LEO with an explicit, ordered curve above it.
 * A silent change to either would look plausible on screen while being wrong,
 * so the shape of both is pinned here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEET_TO_METERS,
  GLOBE_AIRCRAFT_ASSUMED_CRUISE_M,
  GLOBE_AIRCRAFT_MAX_ALTITUDE_M,
  GLOBE_SAT_DISPLAY_CEILING_M,
  GLOBE_SAT_TRUE_SCALE_CEILING_M,
  aircraftDisplayAltitudeMeters,
  satelliteDisplayAltitudeMeters,
} from '../src/components/deck-gl/globe-altitude.ts';

const feetToMeters = (ft: number): number => ft * FEET_TO_METERS;

describe('aircraft globe altitude', () => {
  it('puts aircraft on the ground on the ground', () => {
    assert.equal(aircraftDisplayAltitudeMeters(0, true), 0);
    // onGround wins even when the frame still carries a stale altitude.
    assert.equal(aircraftDisplayAltitudeMeters(1200, true), 0);
  });

  it('renders reported altitude 1:1, not snapped to a cruise band', () => {
    for (const ft of [500, 1500, 4000, 10_000, 24_000, 35_000, 41_000]) {
      assert.equal(
        aircraftDisplayAltitudeMeters(ft, false),
        feetToMeters(ft),
        `${ft} ft should render at its true altitude`,
      );
    }
  });

  it('keeps low-altitude traffic well below cruise traffic', () => {
    const onApproach = aircraftDisplayAltitudeMeters(1500, false);
    const atCruise = aircraftDisplayAltitudeMeters(35_000, false);
    assert.ok(onApproach < atCruise / 20, 'approach traffic must not sit at cruise height');
  });

  it('clamps corrupt frames instead of flinging them into orbit', () => {
    assert.equal(aircraftDisplayAltitudeMeters(120_000, false), GLOBE_AIRCRAFT_MAX_ALTITUDE_M);
    assert.equal(aircraftDisplayAltitudeMeters(Number.POSITIVE_INFINITY, false), GLOBE_AIRCRAFT_ASSUMED_CRUISE_M);
  });

  it('falls back to one honest cruise default when altitude is missing', () => {
    assert.equal(aircraftDisplayAltitudeMeters(undefined, false), GLOBE_AIRCRAFT_ASSUMED_CRUISE_M);
    assert.equal(aircraftDisplayAltitudeMeters(0, false), GLOBE_AIRCRAFT_ASSUMED_CRUISE_M);
    // Negative barometric readings below sea level are not a spread to preserve.
    assert.equal(aircraftDisplayAltitudeMeters(-500, false), GLOBE_AIRCRAFT_ASSUMED_CRUISE_M);
  });
});

describe('satellite globe altitude', () => {
  it('is exact 1:1 through the whole of LEO', () => {
    for (const km of [160, 408 /* ISS */, 550 /* Starlink */, 1200, 2000]) {
      assert.equal(
        satelliteDisplayAltitudeMeters(km),
        km * 1000,
        `${km} km is inside the true-scale band and must not be distorted`,
      );
    }
  });

  it('separates MEO and GEO instead of collapsing them onto one shell', () => {
    const gps = satelliteDisplayAltitudeMeters(20_200);
    const galileo = satelliteDisplayAltitudeMeters(23_222);
    const geo = satelliteDisplayAltitudeMeters(35_786);
    const molniya = satelliteDisplayAltitudeMeters(40_000);

    // Strictly ordered — the whole point of the curve.
    assert.ok(gps < galileo, 'GPS must sit below Galileo');
    assert.ok(galileo < geo, 'Galileo must sit below GEO');
    assert.ok(geo < molniya, 'GEO must sit below Molniya apogee');

    // And separated enough to actually read apart on screen (>100 km of shell).
    assert.ok(galileo - gps > 100_000, 'GPS and Galileo shells must be distinguishable');
    assert.ok(geo - galileo > 100_000, 'Galileo and GEO shells must be distinguishable');
  });

  it('keeps every orbit inside the frustum budget', () => {
    for (const km of [2001, 20_200, 35_786, 40_000, 250_000]) {
      assert.ok(
        satelliteDisplayAltitudeMeters(km) <= GLOBE_SAT_DISPLAY_CEILING_M,
        `${km} km must not escape the display ceiling`,
      );
    }
  });

  it('is continuous and monotonic across the knee', () => {
    assert.equal(satelliteDisplayAltitudeMeters(2000), GLOBE_SAT_TRUE_SCALE_CEILING_M);
    const justAbove = satelliteDisplayAltitudeMeters(2000.001);
    assert.ok(justAbove >= GLOBE_SAT_TRUE_SCALE_CEILING_M, 'no step down at the knee');
    assert.ok(justAbove - GLOBE_SAT_TRUE_SCALE_CEILING_M < 1000, 'no jump up at the knee');

    let previous = -1;
    for (let km = 100; km <= 45_000; km += 100) {
      const current = satelliteDisplayAltitudeMeters(km);
      assert.ok(current > previous, `altitude must increase monotonically (broke at ${km} km)`);
      previous = current;
    }
  });

  it('handles a missing or unusable altitude without producing NaN', () => {
    assert.ok(Number.isFinite(satelliteDisplayAltitudeMeters(Number.NaN)));
    assert.ok(Number.isFinite(satelliteDisplayAltitudeMeters(Number.POSITIVE_INFINITY)));
    // A decaying object reported below the datum still renders on the surface.
    assert.equal(satelliteDisplayAltitudeMeters(-10), 0);
  });
});
