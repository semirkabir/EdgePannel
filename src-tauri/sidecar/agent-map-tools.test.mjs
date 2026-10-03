import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  CLIENT_EXECUTED_TOOLS,
  MAP_CONTEXT_TOOLS,
  MAP_REGION_ANCHORS,
  AGENT_TIME_RANGE_VALUES,
  isClientExecutedTool,
  isMapContextTool,
  normalizeMapViewport,
  validateClientToolArguments,
} from './agent-tool-registry.mjs';
import { applyAgentMapToolEvents } from '../../src/services/map-agent-bridge.ts';
import { handleAgentGateway } from './agent-gateway.mjs';

// ---------------------------------------------------------------------------
// Registry: client-executed map tools
// ---------------------------------------------------------------------------

test('client-executed tools are declared with intelligence scope and non-server risk', () => {
  const names = CLIENT_EXECUTED_TOOLS.map(tool => tool.name);
  assert.deepEqual(names.sort(), ['highlight_features', 'set_map_view', 'set_time_range', 'toggle_map_layers', 'zoom_to_region']);
  for (const tool of CLIENT_EXECUTED_TOOLS) {
    assert.ok(tool.scopes.includes('intelligence'), `${tool.name} must require the intelligence scope`);
    assert.equal(tool.risk, 'client-map');
    // Client tools never execute server-side, so they must not carry an endpoint.
    assert.equal(tool.endpoint, undefined);
  }
});

test('isClientExecutedTool matches only map-control tool names', () => {
  assert.equal(isClientExecutedTool('set_map_view'), true);
  assert.equal(isClientExecutedTool('toggle_map_layers'), true);
  assert.equal(isClientExecutedTool('zoom_to_region'), true);
  assert.equal(isClientExecutedTool('highlight_features'), true);
  assert.equal(isClientExecutedTool('set_time_range'), true);
  assert.equal(isClientExecutedTool('get_visible_region'), false);
  assert.equal(isClientExecutedTool('search_news'), false);
  assert.equal(isClientExecutedTool('mcp__foo__bar'), false);
});

test('map context tools include get_visible_region only', () => {
  assert.deepEqual(MAP_CONTEXT_TOOLS.map(t => t.name), ['get_visible_region']);
  assert.equal(isMapContextTool('get_visible_region'), true);
  assert.equal(isMapContextTool('set_map_view'), false);
});

test('set_map_view validation clamps zoom and rejects out-of-range coordinates', () => {
  const ok = validateClientToolArguments('set_map_view', { lat: 50.45, lon: '30.52' });
  assert.deepEqual(ok.args, { lat: 50.45, lon: 30.52, zoom: 7 });

  const clamped = validateClientToolArguments('set_map_view', { lat: 10, lon: 20, zoom: 99 });
  assert.equal(clamped.args.zoom, 16);

  const badLat = validateClientToolArguments('set_map_view', { lat: 999, lon: 0 });
  assert.equal(badLat.ok, false);

  const badLon = validateClientToolArguments('set_map_view', { lat: 0, lon: NaN });
  assert.equal(badLon.ok, false);
});

test('zoom_to_region resolves known regions and normalizes naming variants', () => {
  const ok = validateClientToolArguments('zoom_to_region', { region: 'Red-Sea' });
  assert.equal(ok.ok, true);
  assert.equal(ok.args.region, 'red_sea');
  assert.deepEqual(
    [ok.args.lat, ok.args.lon, ok.args.zoom],
    [MAP_REGION_ANCHORS.red_sea.lat, MAP_REGION_ANCHORS.red_sea.lon, MAP_REGION_ANCHORS.red_sea.zoom],
  );

  const unknown = validateClientToolArguments('zoom_to_region', { region: 'atlantis' });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /Supported:/);
});

test('toggle_map_layers filters to the known catalog and reports rejected keys', () => {
  const ok = validateClientToolArguments('toggle_map_layers', { enable: 'cables, bogus_layer', disable: '' });
  assert.deepEqual(ok.args.enable, ['cables']);
  assert.deepEqual(ok.args.disable, []);
  assert.deepEqual(ok.args.rejected, ['bogus_layer']);

  const both = validateClientToolArguments('toggle_map_layers', { enable: 'flights', disable: 'fires,outages' });
  assert.deepEqual(both.args.enable, ['flights']);
  assert.deepEqual(both.args.disable, ['fires', 'outages']);

  const empty = validateClientToolArguments('toggle_map_layers', {});
  assert.equal(empty.ok, false);

  const onlyUnknown = validateClientToolArguments('toggle_map_layers', { enable: 'nope' });
  assert.equal(onlyUnknown.ok, false);
});

test('highlight_features accepts asset id+type and lat/lon pins', () => {
  const assets = validateClientToolArguments('highlight_features', {
    items: JSON.stringify([
      { id: 'SEA-ME-WE-5', type: 'cable' },
      { lat: 1.3, lon: 103.8, label: 'Singapore' },
    ]),
  });
  assert.equal(assets.ok, true);
  assert.equal(assets.args.items.length, 2);
  assert.equal(assets.args.items[0].type, 'cable');
  assert.equal(assets.args.items[1].lat, 1.3);
  assert.equal(assets.args.durationMs, 3000);

  const plural = validateClientToolArguments('highlight_features', {
    items: [{ id: 'x', type: 'cables' }],
  });
  assert.equal(plural.ok, true);
  assert.equal(plural.args.items[0].type, 'cable');

  const bad = validateClientToolArguments('highlight_features', {
    items: [{ id: 'only-id' }],
  });
  assert.equal(bad.ok, false);
});

test('normalizeMapViewport accepts center/bounds aliases', () => {
  const vp = normalizeMapViewport({
    center: { latitude: 40.7, longitude: -74 },
    zoom: 8.4,
    bounds: { west: -75, south: 40, east: -73, north: 41 },
    mode: 'globe',
  });
  assert.deepEqual(vp.center, { lat: 40.7, lon: -74 });
  assert.equal(vp.zoom, 8.5);
  assert.equal(vp.mode, 'globe');
  assert.ok(vp.bounds);
  assert.equal(normalizeMapViewport(null), null);
  assert.equal(normalizeMapViewport({ lat: 999, lon: 0 }), null);
});

// ---------------------------------------------------------------------------
// Gateway contract shape: intercepted events are recognizable by clientAction
// ---------------------------------------------------------------------------

test('accepted client-tool executions surface a clientAction payload for the frontend', () => {
  // Mirrors executeOpenAiToolCall's interception branch in agent-gateway.mjs:
  // validate -> ack result + clientAction. Kept in sync via this contract test.
  const validation = validateClientToolArguments('zoom_to_region', { region: 'taiwan strait' });
  assert.equal(validation.ok, true);
  const event = {
    name: 'zoom_to_region',
    args: validation.args,
    result: { accepted: true, appliedByFrontend: true, action: validation.args },
    clientAction: validation.args,
  };
  assert.equal(event.clientAction.lat, MAP_REGION_ANCHORS.taiwan_strait.lat);
  assert.equal(event.result.accepted, true);

  const failed = validateClientToolArguments('set_map_view', { lat: 1234, lon: 0 });
  assert.equal(failed.ok, false);
});

test('status endpoint lists map tools and accepts body connectors', async () => {
  const response = await handleAgentGateway(
    new URL('http://localhost/api/agent-gateway/status'),
    new Request('http://localhost/api/agent-gateway/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        connectors: [{
          id: 'web-1',
          name: 'Web LLM',
          type: 'openai-compatible',
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          apiKey: 'sk-test',
          scopes: ['intelligence', 'news'],
          enabled: true,
        }],
      }),
    }),
    { baseUrl: 'https://edgepannel.com', port: 0 },
  );
  assert.ok(response);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.ok(payload.connectors.some(c => c.id === 'web-1'));
  assert.ok(!payload.connectors.some(c => c.apiKey));
  const names = payload.tools.map(t => t.name);
  assert.ok(names.includes('highlight_features'));
  assert.ok(names.includes('get_visible_region'));
  assert.ok(names.includes('set_map_view'));
});

// ---------------------------------------------------------------------------
// Frontend bridge: applyAgentMapToolEvents
// ---------------------------------------------------------------------------

function makeHarness(initialLayers) {
  const calls = { setCenter: [], committed: [], highlights: [] };
  let currentLayers = { ...initialLayers };
  const accessors = {
    getMap: () => ({ setCenter: (lat, lon, zoom) => calls.setCenter.push([lat, lon, zoom]) }),
    getCurrentLayers: () => ({ ...currentLayers }),
    commitLayers: layers => {
      currentLayers = { ...layers };
      calls.committed.push({ ...layers });
    },
    highlightFeatures: (items, durationMs) => {
      calls.highlights.push({ items, durationMs });
    },
  };
  return { accessors, calls };
}

test('bridge applies camera moves from set_map_view and zoom_to_region events', () => {
  const { accessors, calls } = makeHarness({ cables: false });
  const summary = applyAgentMapToolEvents([
    { name: 'set_map_view', clientAction: { lat: 24.5, lon: 119.5, zoom: 7 } },
    { name: 'zoom_to_region', clientAction: { region: 'red_sea', lat: 19, lon: 38.5, zoom: 6 } },
    { name: 'search_news', args: { query: 'x' }, result: {} },
    { name: 'set_map_view', error: 'lat must be a number between -90 and 90.' },
  ], accessors);
  assert.equal(summary.movedCamera, 2);
  assert.deepEqual(calls.setCenter[0], [24.5, 119.5, 7]);
  assert.deepEqual(calls.setCenter[1], [19, 38.5, 6]);
});

test('bridge flips only existing layer keys and commits once per toggle event', () => {
  const initial = { cables: false, flights: true, fires: false };
  const { accessors, calls } = makeHarness(initial);
  const summary = applyAgentMapToolEvents([
    { name: 'toggle_map_layers', clientAction: { enable: ['cables', 'notALayer'], disable: ['flights'] } },
  ], accessors);
  assert.deepEqual(summary.toggledKeys.sort(), ['cables', 'flights']);
  assert.equal(calls.committed.length, 1);
  assert.deepEqual(calls.committed[0], { cables: true, flights: false, fires: false });
  // Original state object untouched.
  assert.deepEqual(initial, { cables: false, flights: true, fires: false });
});

test('bridge applies highlight_features via accessor and camera pin', () => {
  const { accessors, calls } = makeHarness({});
  const summary = applyAgentMapToolEvents([
    {
      name: 'highlight_features',
      clientAction: {
        items: [{ id: 'c1', type: 'cable' }, { lat: 12, lon: 45, label: 'pin' }],
        durationMs: 2500,
      },
    },
  ], accessors);
  assert.equal(summary.highlighted, 1);
  assert.equal(calls.highlights.length, 1);
  assert.equal(calls.highlights[0].durationMs, 2500);
  assert.deepEqual(calls.setCenter[0], [12, 45, undefined]);
});

test('bridge is a no-op without events or without accessors wired to a map', () => {
  const empty = applyAgentMapToolEvents(undefined, makeHarness({}).accessors);
  assert.deepEqual(empty, { movedCamera: 0, toggledKeys: [], highlighted: 0, rejected: [] });

  const noMap = applyAgentMapToolEvents([
    { name: 'set_map_view', clientAction: { lat: 1, lon: 2, zoom: 3 } },
  ], { getMap: () => null, getCurrentLayers: () => ({}), commitLayers: () => {} });
  assert.equal(noMap.movedCamera, 1);
});

// ---------------------------------------------------------------------------
// set_time_range: registry validation + bridge
// ---------------------------------------------------------------------------

test('set_time_range only emits existing TimeRange values (minus custom)', async () => {
  // Parse the source-of-truth union from src/utils/time-range.ts so the agent
  // list cannot drift from the app's TimeRange type.
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../src/utils/time-range.ts', import.meta.url), 'utf8');
  const union = src.match(/export type TimeRange = ([^;]+);/)[1];
  const appRanges = [...union.matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual([...AGENT_TIME_RANGE_VALUES].sort(), appRanges.filter(r => r !== 'custom').sort());
});

test('set_time_range accepts exact ranges and aliases without clamping', () => {
  for (const range of ['1h', '6h', '24h', '48h', '7d', 'all']) {
    assert.deepEqual(validateClientToolArguments('set_time_range', { range }), { ok: true, args: { range } });
  }
  assert.equal(validateClientToolArguments('set_time_range', { range: 'week' }).args.range, '7d');
  assert.equal(validateClientToolArguments('set_time_range', { range: 'this week' }).args.range, '7d');
  assert.equal(validateClientToolArguments('set_time_range', { range: 'today' }).args.range, '24h');
  assert.equal(validateClientToolArguments('set_time_range', { range: '24' }).args.range, '24h');
});

test('set_time_range snaps lookbacks up to the smallest covering window and clamps past 7d', () => {
  const cases = [
    [{ range: '72h' }, '7d'],
    [{ hours: 72 }, '7d'],
    [{ range: '3d' }, '7d'],
    [{ range: '30m' }, '1h'],
    [{ hours: 12 }, '24h'],
    [{ range: '2 days' }, '48h'],
    [{ hours: 36 }, '48h'],
    [{ range: '30d' }, '7d'],
    [{ hours: 10_000 }, '7d'],
  ];
  for (const [args, expected] of cases) {
    const result = validateClientToolArguments('set_time_range', args);
    assert.equal(result.ok, true, JSON.stringify(args));
    assert.equal(result.args.range, expected, JSON.stringify(args));
  }
  const snapped = validateClientToolArguments('set_time_range', { hours: 72 });
  assert.equal(snapped.args.clamped, true);
  assert.equal(snapped.args.requested, '72h');
  // Exact 48 hours does not report clamping.
  assert.equal(validateClientToolArguments('set_time_range', { hours: 48 }).args.clamped, undefined);
});

test('set_time_range rejects missing, zero, negative, and garbage input', () => {
  for (const args of [{}, { range: '' }, { hours: 0 }, { hours: -5 }, { hours: 'abc' }, { range: 'forever-ish' }, { range: 'custom' }, null]) {
    assert.equal(validateClientToolArguments('set_time_range', args).ok, false, JSON.stringify(args));
  }
});

test('bridge applies set_time_range via accessor and rejects unknown ranges', () => {
  const applied = [];
  const accessors = {
    getMap: () => null,
    getCurrentLayers: () => ({}),
    commitLayers: () => {},
    setTimeRange: range => applied.push(range),
  };
  const summary = applyAgentMapToolEvents([
    { name: 'set_time_range', clientAction: { range: '48h' } },
    { name: 'set_time_range', clientAction: { range: '7d', clamped: true, requested: '72h' } },
    { name: 'set_time_range', clientAction: { range: '90d' } },
    { name: 'set_time_range', clientAction: { range: 'custom' } },
  ], accessors);
  assert.deepEqual(applied, ['48h', '7d']);
  assert.equal(summary.timeRange, '7d');
  assert.deepEqual(summary.rejected, ['set_time_range', 'set_time_range']);

  const noSetter = applyAgentMapToolEvents([
    { name: 'set_time_range', clientAction: { range: '24h' } },
  ], { getMap: () => null, getCurrentLayers: () => ({}), commitLayers: () => {} });
  assert.deepEqual(noSetter.rejected, ['set_time_range']);
  assert.equal(noSetter.timeRange, undefined);
});

test('gateway system prompt advertises set_time_range', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./agent-gateway.mjs', import.meta.url), 'utf8');
  assert.match(src, /Use set_time_range \(1h, 6h, 24h, 48h, 7d, all\)/);
});

// ---------------------------------------------------------------------------
// Connector endpoint SSRF guard
// ---------------------------------------------------------------------------

test('validateConnectorEndpoint blocks private, CGNAT, mapped and IPv6-local hosts', async () => {
  const { validateConnectorEndpoint } = await import('./agent-gateway.mjs');
  for (const endpoint of [
    'https://10.0.0.5/v1', 'https://192.168.1.1/v1', 'https://172.20.0.1/v1', 'https://169.254.169.254/latest',
    'https://100.100.1.1/v1', 'https://0.0.0.0/v1', 'https://127.0.0.2/v1', 'https://[::ffff:7f00:1]/v1',
    'https://[fd00::1]/v1', 'https://[fe80::1]/v1', 'http://example.com/v1', 'ftp://example.com',
  ]) {
    assert.equal(validateConnectorEndpoint(endpoint).ok, false, endpoint);
  }
  for (const endpoint of ['https://api.openai.com/v1', 'https://100.20.0.1/v1', 'http://localhost:11434/v1']) {
    assert.equal(validateConnectorEndpoint(endpoint).ok, true, endpoint);
  }
});

test('validateConnectorEndpoint refuses localhost on the hosted (Vercel) gateway', async () => {
  const { validateConnectorEndpoint } = await import('./agent-gateway.mjs');
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    assert.equal(validateConnectorEndpoint('http://localhost:11434/v1').ok, false);
    assert.equal(validateConnectorEndpoint('http://127.0.0.1:8080/v1').ok, false);
    assert.equal(validateConnectorEndpoint('https://api.openai.com/v1').ok, true);
  } finally {
    if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
  }
});
