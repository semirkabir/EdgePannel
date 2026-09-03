import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  CLIENT_EXECUTED_TOOLS,
  MAP_REGION_ANCHORS,
  isClientExecutedTool,
  validateClientToolArguments,
} from './agent-tool-registry.mjs';
import { applyAgentMapToolEvents } from '../../src/services/map-agent-bridge.ts';

// ---------------------------------------------------------------------------
// Registry: client-executed map tools
// ---------------------------------------------------------------------------

test('client-executed tools are declared with intelligence scope and non-server risk', () => {
  const names = CLIENT_EXECUTED_TOOLS.map(tool => tool.name);
  assert.deepEqual(names.sort(), ['set_map_view', 'toggle_map_layers', 'zoom_to_region']);
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
  assert.equal(isClientExecutedTool('search_news'), false);
  assert.equal(isClientExecutedTool('mcp__foo__bar'), false);
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

// ---------------------------------------------------------------------------
// Frontend bridge: applyAgentMapToolEvents
// ---------------------------------------------------------------------------

function makeHarness(initialLayers) {
  const calls = { setCenter: [], committed: [] };
  const accessors = {
    getMap: () => ({ setCenter: (lat, lon, zoom) => calls.setCenter.push([lat, lon, zoom]) }),
    getCurrentLayers: () => ({ ...currentLayers }),
    commitLayers: layers => {
      currentLayers = { ...layers };
      calls.committed.push({ ...layers });
    },
  };
  let currentLayers = { ...initialLayers };
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

test('bridge is a no-op without events or without accessors wired to a map', () => {
  const empty = applyAgentMapToolEvents(undefined, makeHarness({}).accessors);
  assert.deepEqual(empty, { movedCamera: 0, toggledKeys: [], rejected: [] });

  const noMap = applyAgentMapToolEvents([
    { name: 'set_map_view', clientAction: { lat: 1, lon: 2, zoom: 3 } },
  ], { getMap: () => null, getCurrentLayers: () => ({}), commitLayers: () => {} });
  assert.equal(noMap.movedCamera, 1);
});
