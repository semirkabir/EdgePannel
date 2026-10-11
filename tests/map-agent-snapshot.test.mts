import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentMapSnapshot } from '../src/services/map-agent-snapshot.ts';
import { runAnalystQuery } from '../src-tauri/sidecar/agent-analyst-engine.mjs';
import { MAP_REGION_ANCHORS } from '../src-tauri/sidecar/agent-tool-registry.mjs';

const NOW = 1_800_000_000_000;

function plane(i: number, overrides: Record<string, unknown> = {}) {
  return {
    icao24: `ac${i}`, callsign: ` UAL${i} `, lat: 40 + (i % 10) * 0.1, lon: -100 + (i % 10) * 0.1,
    altitudeFt: 30_000 + i, groundSpeedKts: 450, trackDeg: 90, verticalRateMps: 0, onGround: false,
    source: 'opensky', provider: 'opensky-anonymous', originCountry: 'United States',
    lastContactAt: new Date(NOW), positionSource: 'adsb', aircraftCategory: 3,
    freshness: 'live', stale: false, observedAt: new Date(NOW - 20_000), ...overrides,
  } as never;
}

describe('buildAgentMapSnapshot', () => {
  it('only includes layers that are toggled on', () => {
    const snap = buildAgentMapSnapshot(
      { flights: [plane(1)], earthquakes: [{ id: 'q', place: 'X', magnitude: 5, depthKm: 10, location: { latitude: 1, longitude: 1 }, occurredAt: NOW, sourceUrl: '' }] },
      { enabledLayers: { flights: true, earthquakes: false }, nowMs: NOW },
    );
    assert.deepEqual(Object.keys(snap.layers), ['flights']);
  });

  it('maps internal field names to the engine’s canonical ones and trims callsigns', () => {
    const snap = buildAgentMapSnapshot({ flights: [plane(7)] }, { nowMs: NOW });
    const rec = snap.layers.flights.records[0];
    assert.equal(rec.callsign, 'UAL7');
    assert.equal(rec.altitude_ft, 30_007);
    assert.equal(rec.speed_kts, 450);
    assert.equal(rec.on_ground, false);
    assert.equal(snap.layers.flights.source, 'opensky-anonymous');
  });

  it('drops records with invalid coordinates instead of placing them at 0,0', () => {
    const snap = buildAgentMapSnapshot(
      { flights: [plane(1), plane(2, { lat: NaN }), plane(3, { lon: 999 }), plane(4, { lat: undefined })] },
      { nowMs: NOW },
    );
    assert.equal(snap.layers.flights.total, 1);
    assert.equal(snap.layers.flights.records.length, 1);
  });

  it('caps records but keeps the true total, and keeps in-view records first', () => {
    const planes = Array.from({ length: 50 }, (_, i) => plane(i, { lat: i < 40 ? 0 : 45, lon: i < 40 ? 0 : 10 }));
    const snap = buildAgentMapSnapshot({ flights: planes }, {
      nowMs: NOW, maxPerLayer: 10, viewport: { west: 5, south: 40, east: 15, north: 50 },
    });
    const layer = snap.layers.flights;
    assert.equal(layer.total, 50);
    assert.equal(layer.records.length, 10);
    assert.equal(snap.viewportFirst, true);
    // all 10 in-view planes (i >= 40) must be present
    assert.ok(layer.records.every((r) => r.lat === 45));
  });

  it('does not claim viewportFirst when nothing was capped', () => {
    const snap = buildAgentMapSnapshot({ flights: [plane(1)] }, { nowMs: NOW, viewport: { west: -180, south: -90, east: 180, north: 90 } });
    assert.equal(snap.viewportFirst, false);
  });

  it('nulls AIS "not available" sentinels instead of reporting them as real values', () => {
    const snap = buildAgentMapSnapshot({
      ships: [
        { mmsi: '1', name: 'A', lat: 1, lon: 1, speed: 102.3, heading: 511 },
        { mmsi: '2', name: 'B', lat: 1, lon: 1, speed: 12.4, heading: 270 },
      ],
    }, { nowMs: NOW });
    const [a, b] = snap.layers.ships.records;
    assert.equal(a.speed_kts, null);
    assert.equal(a.heading, null);
    assert.equal(b.speed_kts, 12.4);
    assert.equal(b.heading, 270);
  });

  it('computes quake age in hours and newest timestamp', () => {
    const snap = buildAgentMapSnapshot({
      earthquakes: [
        { id: 'q', place: 'Chile', magnitude: 6.1, depthKm: 33, location: { latitude: -30, longitude: -70 }, occurredAt: NOW - 5 * 3_600_000, sourceUrl: '' },
        { id: 'nolocation', place: 'Nowhere', magnitude: 9, depthKm: 1, occurredAt: NOW, sourceUrl: '' },
      ],
    }, { nowMs: NOW });
    assert.equal(snap.layers.earthquakes.total, 1, 'a quake with no location must be dropped, not placed at 0,0');
    assert.equal(snap.layers.earthquakes.records[0].lat, -30);
    assert.equal(snap.layers.earthquakes.records[0].depth_km, 33);
    assert.equal(snap.layers.earthquakes.records[0].age_hours, 5);
    assert.equal(snap.layers.earthquakes.newestMs, NOW - 5 * 3_600_000);
  });

  it('counts stale-flagged aircraft over the whole set, not just the kept records', () => {
    const planes = [plane(1), plane(2, { freshness: 'stale' }), plane(3, { freshness: 'stale' }), plane(4)];
    const snap = buildAgentMapSnapshot({ flights: planes }, { nowMs: NOW, maxPerLayer: 2 });
    assert.equal(snap.layers.flights.staleCount, 2);
  });

  it('omits empty layers entirely', () => {
    const snap = buildAgentMapSnapshot({ flights: [], fires: [] }, { nowMs: NOW });
    assert.deepEqual(snap.layers, {});
  });
});

describe('snapshot → analyst engine, end to end', () => {
  it('answers a real question from raw map arrays', () => {
    const snap = buildAgentMapSnapshot({
      flights: [plane(1, { lat: 49, lon: 32 }), plane(2, { lat: 49.5, lon: 31, altitudeFt: 12_000 }), plane(3, { lat: 40, lon: -74 })],
    }, { nowMs: NOW });
    const out = runAnalystQuery(
      { layer: 'flights', scope: { region: 'ukraine' }, where: [{ field: 'altitude_ft', op: 'gt', value: 20_000 }] },
      snap, { regionAnchors: MAP_REGION_ANCHORS, nowMs: NOW },
    );
    assert.equal(out.ok, true);
    assert.equal(out.result.matched, 1);
    assert.equal(out.result.records[0].id, 'ac1');
  });

  it('survives a JSON round trip (this is what actually crosses the wire)', () => {
    const snap = buildAgentMapSnapshot({ flights: [plane(1)] }, { nowMs: NOW });
    const wire = JSON.parse(JSON.stringify(snap));
    const out = runAnalystQuery({ layer: 'flights', count_only: true }, wire, { regionAnchors: MAP_REGION_ANCHORS, nowMs: NOW });
    assert.equal(out.ok, true);
    assert.equal(out.result.matched, 1);
  });

  it('a full 1500-record flights snapshot stays a sane request size', () => {
    const planes = Array.from({ length: 12_000 }, (_, i) => plane(i));
    const snap = buildAgentMapSnapshot({ flights: planes }, { nowMs: NOW });
    const bytes = JSON.stringify(snap).length;
    assert.equal(snap.layers.flights.records.length, 1500);
    assert.ok(bytes < 400_000, `snapshot is ${bytes} bytes`);
  });
});
