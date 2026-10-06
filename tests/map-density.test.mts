import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DENSITY_CAP_MAX_ZOOM,
  densityCellDegrees,
  flightIconScale,
  flightMinPixels,
  sampleForZoom,
} from '../src/components/map-density.ts';

/** Deterministic pseudo-random in [0,1). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** 3000 aircraft packed into a ~10x6 degree box (a busy corridor). */
function denseCluster() {
  const r = rng(1);
  return Array.from({ length: 3000 }, (_, i) => ({ icao24: `d${i}`, lon: -90 + r() * 10, lat: 35 + r() * 6 }));
}

/**
 * 245 aircraft over the southern oceans, 10 degrees apart: wider than one
 * density cell at world zoom (~8 degrees at z1.5), so none should overlap.
 */
function sparseOcean() {
  return Array.from({ length: 245 }, (_, i) => ({
    icao24: `s${i}`,
    lon: -175 + (i % 35) * 10 + 0.5,
    lat: -70 + Math.floor(i / 35) * 10 + 0.5,
  }));
}

test('icon scale grows with zoom', () => {
  assert.ok(flightIconScale(2) < flightIconScale(5));
  assert.equal(flightIconScale(8), 1);
});

test('icon pixel floor shrinks at world zoom so the scale actually applies', () => {
  assert.ok(flightMinPixels(1.5) < flightMinPixels(5));
  assert.equal(flightMinPixels(8), 10);
  assert.ok(24 * flightIconScale(1.5) > flightMinPixels(1.5));
});

test('no-op when zoomed in or when there are few points', () => {
  const pts = [...denseCluster(), ...sparseOcean()];
  assert.equal(sampleForZoom(pts, DENSITY_CAP_MAX_ZOOM).length, pts.length);
  assert.equal(sampleForZoom(pts.slice(0, 200), 1.5).length, 200);
});

test('caps dense corridors hard but keeps sparse ocean traffic', () => {
  const dense = denseCluster();
  const sparse = sparseOcean();
  const out = sampleForZoom([...dense, ...sparse], 1.5);
  const keptDense = out.filter((p) => p.icao24.startsWith('d')).length;
  const keptSparse = out.filter((p) => p.icao24.startsWith('s')).length;
  // dense box spans ~10/cellDeg x ~6/cellDeg cells, at most 3 per cell
  const cellDeg = densityCellDegrees(1.5);
  const maxDense = 3 * (Math.ceil(10 / cellDeg) + 1) * (Math.ceil(6 / cellDeg) + 1);
  assert.ok(keptDense <= maxDense, `dense kept ${keptDense} > ${maxDense}`);
  assert.ok(keptDense < dense.length * 0.1, `dense kept ${keptDense} of ${dense.length}`);
  assert.ok(keptSparse > sparse.length * 0.9, `sparse kept ${keptSparse} of ${sparse.length}`);
});

test('thins less as you zoom in', () => {
  const pts = [...denseCluster(), ...sparseOcean()];
  assert.ok(sampleForZoom(pts, 1.5).length < sampleForZoom(pts, 3.5).length);
});

test('is deterministic and preserves order', () => {
  const pts = [...denseCluster(), ...sparseOcean()];
  const a = sampleForZoom(pts, 1.5);
  assert.deepEqual(a, sampleForZoom(pts, 1.5));
  const idx = a.map((p) => pts.indexOf(p));
  assert.deepEqual(idx, [...idx].sort((x, y) => x - y));
});

test('always keeps the selected/followed aircraft', () => {
  const pts = [...denseCluster(), ...sparseOcean()];
  const dropped = pts.filter((p) => !sampleForZoom(pts, 1.5).includes(p));
  assert.ok(dropped.length > 1);
  const a = dropped[0]!.icao24;
  const b = dropped[1]!.icao24;
  assert.ok(sampleForZoom(pts, 1.5, a).some((p) => p.icao24 === a));
  const out = sampleForZoom(pts, 1.5, [null, a, b]);
  assert.ok(out.some((p) => p.icao24 === a) && out.some((p) => p.icao24 === b));
});
