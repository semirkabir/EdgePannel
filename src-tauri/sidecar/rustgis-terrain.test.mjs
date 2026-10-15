/**
 * analyze_terrain: RustGIS-backed viewshed / line of sight, wired through the
 * real gateway and the real frontend bridge.
 *
 * The pure parts (tile naming, arg validation, raster -> GeoJSON) always run.
 * The live test runs only when RUSTGIS_CLI points at a rustgis-cli binary; it
 * downloads one Copernicus GLO-90 tile (~5 MB) into RUSTGIS_CACHE_DIR.
 *
 * Run: RUSTGIS_CLI=/path/rustgis-cli node --experimental-strip-types --test src-tauri/sidecar/rustgis-terrain.test.mjs
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import {
  analyzeTerrain,
  copernicusTileName,
  readGeoTiff,
  rustgisCliPath,
  validateTerrainArgs,
  visibilityRasterToGeoJson,
} from './rustgis-terrain.mjs';
import { MAP_ANALYSIS_TOOLS, isClientExecutedTool, isMapAnalysisTool } from './agent-tool-registry.mjs';
import { handleAgentGateway } from './agent-gateway.mjs';
import { applyAgentMapToolEvents } from '../../src/services/map-agent-bridge.ts';

test('copernicusTileName names the 1° tile by its SW corner', () => {
  assert.equal(copernicusTileName(47.5, 35.5), 'Copernicus_DSM_COG_30_N47_00_E035_00_DEM');
  assert.equal(copernicusTileName(-0.2, -78.5), 'Copernicus_DSM_COG_30_S01_00_W079_00_DEM');
  assert.equal(copernicusTileName(12.6, 43.3), 'Copernicus_DSM_COG_30_N12_00_E043_00_DEM');
});

test('validateTerrainArgs clamps and rejects', () => {
  assert.deepEqual(validateTerrainArgs({ lat: 47.5, lon: 35.5 }).args, { mode: 'viewshed', lat: 47.5, lon: 35.5, observerHeight: 10, radiusM: 20000 });
  assert.equal(validateTerrainArgs({ lat: 47.5, lon: 35.5, radiusM: 999999 }).args.radiusM, 50000);
  assert.equal(validateTerrainArgs({ lat: 95, lon: 0 }).ok, false);
  assert.equal(validateTerrainArgs({ mode: 'line_of_sight', lat: 47.5, lon: 35.5 }).ok, false);
  assert.match(validateTerrainArgs({ mode: 'line_of_sight', lat: 47.5, lon: 35.5, targetLat: 48.2, targetLon: 35.6 }).error, /same 1° elevation tile/);
  assert.equal(validateTerrainArgs({ mode: 'los', lat: 47.5, lon: 35.5, targetLat: 47.6, targetLon: 35.7 }).args.mode, 'line_of_sight');
  assert.equal(validateTerrainArgs({ mode: 'nope', lat: 1, lon: 1 }).ok, false);
});

/** Build a tiny little-endian, deflate-stripped float32 GeoTIFF. */
function tinyGeoTiff(width, height, values, { originLon, originLat, pixel }) {
  const strip = deflateSync(Buffer.from(new Float32Array(values).buffer));
  const entries = [
    [256, 4, 1, width], [257, 4, 1, height], [258, 3, 1, 32], [259, 3, 1, 8],
    [273, 4, 1, 0], [277, 3, 1, 1], [278, 4, 1, height], [279, 4, 1, strip.length],
    [339, 3, 1, 3], [33550, 12, 3, null], [33922, 12, 6, null],
  ];
  const ifdOffset = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  const scaleOffset = ifdOffset + ifdSize;
  const tieOffset = scaleOffset + 24;
  const stripOffset = tieOffset + 48;
  const buf = Buffer.alloc(stripOffset + strip.length);
  buf.write('II', 0, 'latin1');
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(ifdOffset, 4);
  buf.writeUInt16LE(entries.length, ifdOffset);
  entries.forEach(([tag, type, count, value], i) => {
    const at = ifdOffset + 2 + i * 12;
    buf.writeUInt16LE(tag, at);
    buf.writeUInt16LE(type, at + 2);
    buf.writeUInt32LE(count, at + 4);
    if (tag === 273) value = stripOffset;
    if (tag === 33550) value = scaleOffset;
    if (tag === 33922) value = tieOffset;
    if (type === 3) buf.writeUInt16LE(value, at + 8); else buf.writeUInt32LE(value, at + 8);
  });
  [pixel, pixel, 0].forEach((v, i) => buf.writeDoubleLE(v, scaleOffset + i * 8));
  [0, 0, 0, originLon, originLat, 0].forEach((v, i) => buf.writeDoubleLE(v, tieOffset + i * 8));
  strip.copy(buf, stripOffset);
  return buf;
}

test('readGeoTiff + visibilityRasterToGeoJson turn a 0/1 raster into georeferenced rectangles', () => {
  // 4x2 raster: row 0 = 1 1 0 1, row 1 = 0 0 0 0, nodata elsewhere ignored.
  const tif = tinyGeoTiff(4, 2, [1, 1, 0, 1, 0, 0, -3.4e38, 0], { originLon: 10, originLat: 50, pixel: 0.5 });
  const raster = readGeoTiff(tif);
  assert.equal(raster.width, 4);
  assert.equal(raster.originLon, 10);
  assert.equal(raster.originLat, 50);
  const { geojson, visibleCells, rectangles } = visibilityRasterToGeoJson(raster);
  assert.equal(visibleCells, 3);
  assert.equal(rectangles, 2); // run [0,2) and run [3,4) on row 0
  const polys = geojson.features[0].geometry.coordinates;
  assert.deepEqual(polys[0][0][0], [10, 50]);
  assert.deepEqual(polys[0][0][2], [11, 49.5]);
  assert.deepEqual(polys[1][0][0], [11.5, 50]);
});

test('analyze_terrain is a server-run analysis tool, not a client-only one', () => {
  assert.deepEqual(MAP_ANALYSIS_TOOLS.map(t => t.name), ['analyze_terrain']);
  assert.equal(isMapAnalysisTool('analyze_terrain'), true);
  assert.equal(isClientExecutedTool('analyze_terrain'), false);
});

function scriptedLlm(toolArgs) {
  const requests = [];
  const scripted = [
    { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
      { id: 't1', type: 'function', function: { name: 'analyze_terrain', arguments: JSON.stringify(toolArgs) } },
    ] } }] },
    { choices: [{ message: { role: 'assistant', content: 'Viewshed drawn.' } }] },
  ];
  const fetchStub = async (url, init) => {
    if (!String(url).startsWith('https://llm.test/v1')) return realFetch(url, init);
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify(scripted.shift()), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetchStub, requests };
}
const realFetch = globalThis.fetch;

async function chat(fetchStub, context = {}) {
  globalThis.fetch = fetchStub;
  try {
    const url = 'http://localhost/api/agent-gateway/chat';
    const response = await handleAgentGateway(new URL(url), new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        connectorId: 'demo',
        connectors: [{ id: 'demo', name: 'Demo', type: 'openai-compatible', endpoint: 'https://llm.test/v1', model: 'm', scopes: ['intelligence'], enabled: true }],
        messages: [{ role: 'user', content: 'What can a 30 m mast at Zaporizhzhia NPP see?' }],
      }),
    }), { baseUrl: 'http://localhost', port: 0, ...context });
    return response.json();
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('gateway: summary goes to the LLM, overlay goes to the map (stubbed engine)', async () => {
  const overlay = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'viewshed' }, geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] } }] };
  const { fetchStub, requests } = scriptedLlm({ lat: 47.51, lon: 34.58, observerHeight: 30 });
  const payload = await chat(fetchStub, {
    analyzeTerrain: async args => ({ summary: { mode: 'viewshed', visibleAreaKm2: 12.5, observer: args }, overlay }),
  });
  assert.ok(requests[0].tools.some(t => t.function.name === 'analyze_terrain'), 'tool offered when an engine is available');
  const toolMsg = JSON.parse(requests[1].messages.find(m => m.role === 'tool').content);
  assert.equal(toolMsg.visibleAreaKm2, 12.5);
  assert.equal(toolMsg.drawnOnMap, true);
  assert.equal(toolMsg.overlay, undefined, 'heavy GeoJSON never enters the LLM context');

  const drawn = [];
  const summary = applyAgentMapToolEvents(payload.toolEvents, {
    getMap: () => null, getCurrentLayers: () => ({}), commitLayers: () => {},
    showAnalysisOverlay: (id, fc) => drawn.push([id, fc]),
  });
  assert.deepEqual(summary.overlays, ['terrain']);
  assert.deepEqual(summary.rejected, []);
  assert.equal(drawn[0][0], 'terrain');
  assert.deepEqual(drawn[0][1], overlay);
});

test('gateway: tool is hidden when RustGIS is not installed', { skip: Boolean(rustgisCliPath()) }, async () => {
  const { fetchStub, requests } = scriptedLlm({ lat: 1, lon: 1 });
  await chat(fetchStub);
  assert.ok(!requests[0].tools.some(t => t.function.name === 'analyze_terrain'));
});

test('live: real RustGIS viewshed + line of sight over Copernicus DEM', { skip: !rustgisCliPath() && 'RUSTGIS_CLI not set' }, async () => {
  const vs = await analyzeTerrain({ lat: 47.5, lon: 35.5, observerHeight: 30, radiusM: 20000 });
  assert.equal(vs.summary.mode, 'viewshed');
  assert.ok(vs.summary.visibleCells > 1000, `visible cells ${vs.summary.visibleCells}`);
  assert.ok(vs.summary.visibleAreaKm2 > 10 && vs.summary.visibleAreaKm2 < Math.PI * 20 * 20);
  // Every overlay vertex stays within the 20 km radius box around the observer.
  for (const poly of vs.overlay.features[0].geometry.coordinates) {
    for (const [lon, lat] of poly[0]) {
      assert.ok(Math.abs(lat - 47.5) < 0.2 && Math.abs(lon - 35.5) < 0.3, `vertex ${lon},${lat} inside radius box`);
    }
  }
  const los = await analyzeTerrain({ mode: 'line_of_sight', lat: 47.5, lon: 35.5, targetLat: 47.6, targetLon: 35.7, observerHeight: 30 });
  assert.equal(los.summary.totalSegments, los.overlay.features.length);
  assert.equal(typeof los.summary.targetVisible, 'boolean');
  assert.deepEqual(los.overlay.features[0].geometry.coordinates[0], [35.5, 47.5]);
});
