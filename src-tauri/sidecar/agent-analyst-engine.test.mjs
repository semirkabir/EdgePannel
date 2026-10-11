import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  ANALYST_LAYER_KEYS,
  ANALYST_MAX_LIMIT,
  haversineKm,
  resolveScope,
  runAnalystQuery,
  validateAnalystArgs,
} from './agent-analyst-engine.mjs';
import { MAP_REGION_ANCHORS, MAP_CONTEXT_TOOLS, toOpenAiTool } from './agent-tool-registry.mjs';
import { handleAgentGateway } from './agent-gateway.mjs';

const NOW = 1_800_000_000_000;
const ctx = { regionAnchors: MAP_REGION_ANCHORS, nowMs: NOW };

const flight = (id, lat, lon, alt, extra = {}) => ({ id, callsign: id.toUpperCase(), lat, lon, altitude_ft: alt, speed_kts: 400, on_ground: false, ...extra });

function snapshot(layers, extra = {}) {
  return { capturedAt: NOW, viewportFirst: false, layers, ...extra };
}

const flightsLayer = (records, extra = {}) => ({ records, total: records.length, newestMs: NOW - 60_000, ...extra });

// ---------------------------------------------------------------------------
test('haversine: LAX to JFK is ~3,970 km', () => {
  const km = haversineKm(33.9416, -118.4085, 40.6413, -73.7781);
  assert.ok(Math.abs(km - 3974) < 25, String(km));
});

test('tool definition is exposed to the model without leaking required flags', () => {
  const tool = MAP_CONTEXT_TOOLS.find(t => t.name === 'query_live_map');
  assert.ok(tool);
  assert.ok(tool.scopes.includes('intelligence'));
  const openAi = toOpenAiTool(tool);
  assert.equal(openAi.function.name, 'query_live_map');
  assert.deepEqual(openAi.function.parameters.required, ['layer']);
  assert.equal(openAi.function.parameters.properties.layer.required, undefined);
  for (const key of ANALYST_LAYER_KEYS) assert.match(tool.description, new RegExp(key));
});

// ---------------------------------------------------------------------------
test('counts and ranks within a bbox', () => {
  const snap = snapshot({
    flights: flightsLayer([
      flight('a', 31, 35, 30000), flight('b', 32, 34, 38000), flight('c', 50, 5, 41000),
    ]),
  });
  const out = runAnalystQuery({ layer: 'flights', scope: { bbox: [30, 30, 40, 35] } }, snap, ctx);
  assert.equal(out.ok, true);
  assert.equal(out.result.matched, 2);
  assert.deepEqual(out.result.records.map(r => r.id), ['b', 'a']); // altitude desc by default
});

test('bbox crossing the antimeridian matches both sides', () => {
  const snap = snapshot({ flights: flightsLayer([flight('e', 0, 179), flight('w', 0, -179), flight('x', 0, 0)]) });
  const out = runAnalystQuery({ layer: 'flights', count_only: true, scope: { bbox: [170, -10, -170, 10] } }, snap, ctx);
  assert.equal(out.result.matched, 2);
  assert.equal(out.result.records, undefined);
});

test('radius scope uses great-circle distance', () => {
  const snap = snapshot({ flights: flightsLayer([flight('near', 34.0, -118.2), flight('far', 40.7, -74.0)]) });
  const out = runAnalystQuery({ layer: 'flights', scope: { lat: 34.05, lon: -118.25, radius_km: 100 } }, snap, ctx);
  assert.deepEqual(out.result.records.map(r => r.id), ['near']);
});

test('named region scope resolves through the shared anchors', () => {
  const snap = snapshot({ flights: flightsLayer([flight('bs', 49, 32), flight('ny', 40.7, -74)]) });
  const out = runAnalystQuery({ layer: 'flights', scope: { region: 'Ukraine' } }, snap, ctx);
  assert.deepEqual(out.result.records.map(r => r.id), ['bs']);
  const bad = runAnalystQuery({ layer: 'flights', scope: { region: 'atlantis' } }, snap, ctx);
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Unknown region/);
});

test('viewport scope needs bounds and says so when absent', () => {
  const snap = snapshot({ flights: flightsLayer([flight('a', 10, 10)]) });
  const none = runAnalystQuery({ layer: 'flights', scope: { viewport: true } }, snap, ctx);
  assert.equal(none.ok, false);
  assert.match(none.error, /viewport bounds/i);
  const ok = runAnalystQuery({ layer: 'flights', scope: { viewport: true } }, snap, {
    ...ctx, mapViewport: { bounds: { west: 0, south: 0, east: 20, north: 20 } },
  });
  assert.equal(ok.result.matched, 1);
});

test('scope must pick exactly one mode', () => {
  assert.equal(resolveScope({ bbox: [0, 0, 1, 1], region: 'europe' }, null, MAP_REGION_ANCHORS).ok, false);
  assert.equal(resolveScope({ bbox: [0, 0, 1] }, null, MAP_REGION_ANCHORS).ok, false);
  assert.equal(resolveScope({ bbox: [0, 50, 1, 40] }, null, MAP_REGION_ANCHORS).ok, false);
  assert.equal(resolveScope({ lat: 95, lon: 0 }, null, MAP_REGION_ANCHORS).ok, false);
  assert.equal(resolveScope({ lat: 0, lon: 0, radius_km: -1 }, null, MAP_REGION_ANCHORS).ok, false);
});

// ---------------------------------------------------------------------------
test('where filters: numeric, string, boolean, in', () => {
  const snap = snapshot({
    military_flights: flightsLayer([
      { id: '1', callsign: 'RCH123', type: 'transport', operator: 'usaf', lat: 1, lon: 1, altitude_ft: 25000, speed_kts: 420, on_ground: false },
      { id: '2', callsign: 'FORTE12', type: 'drone', operator: 'usaf', lat: 1, lon: 1, altitude_ft: 55000, speed_kts: 300, on_ground: false },
      { id: '3', callsign: 'NATO01', type: 'awacs', operator: 'nato', lat: 1, lon: 1, altitude_ft: 0, speed_kts: 0, on_ground: true },
    ]),
  });
  const q = (where) => runAnalystQuery({ layer: 'military_flights', where }, snap, ctx);
  assert.equal(q([{ field: 'altitude_ft', op: 'gt', value: 30000 }]).result.matched, 1);
  assert.equal(q([{ field: 'operator', op: 'eq', value: 'USAF' }]).result.matched, 2); // case-insensitive
  assert.equal(q([{ field: 'callsign', op: 'contains', value: 'forte' }]).result.matched, 1);
  assert.equal(q([{ field: 'on_ground', op: 'eq', value: true }]).result.matched, 1);
  assert.equal(q([{ field: 'type', op: 'in', value: ['drone', 'awacs'] }]).result.matched, 2);
  assert.equal(q([{ field: 'operator', op: 'eq', value: 'usaf' }, { field: 'speed_kts', op: 'lt', value: 400 }]).result.matched, 1);
});

test('a missing field never satisfies a numeric constraint (unknown is not zero)', () => {
  const snap = snapshot({
    ships: { records: [{ id: 's1', lat: 1, lon: 1, speed_kts: null }, { id: 's2', lat: 1, lon: 1, speed_kts: 3 }], total: 2 },
  });
  const slow = runAnalystQuery({ layer: 'ships', where: [{ field: 'speed_kts', op: 'lt', value: 5 }] }, snap, ctx);
  assert.deepEqual(slow.result.records.map(r => r.id), ['s2']);
});

test('invalid queries return model-readable errors', () => {
  const snap = snapshot({ flights: flightsLayer([flight('a', 1, 1, 1)]) });
  const cases = [
    [{ layer: 'tanks' }, /Unknown layer/],
    [{ layer: 'flights', where: [{ field: 'colour', op: 'eq', value: 'x' }] }, /Unknown field/],
    [{ layer: 'flights', where: [{ field: 'altitude_ft', op: 'near', value: 1 }] }, /Unknown op/],
    [{ layer: 'flights', where: [{ field: 'altitude_ft', op: 'gt', value: 'high' }] }, /numeric/],
    [{ layer: 'flights', where: [{ field: 'callsign', op: 'gt', value: 'A' }] }, /does not support/],
    [{ layer: 'flights', where: [{ field: 'on_ground', op: 'gt', value: true }] }, /eq\/ne/],
    [{ layer: 'flights', group_by: 'lat' }, /not useful/],
    [{ layer: 'flights', sort_by: 'nope' }, /Unknown sort_by/],
    [{ layer: 'flights', order: 'sideways' }, /order must be/],
    [{ layer: 'flights', limit: -1 }, /limit/],
    [{ layer: 'flights', where: 'altitude>3' }, /array/],
    [null, /Unknown layer/],
  ];
  for (const [args, pattern] of cases) {
    const out = runAnalystQuery(args, snap, ctx);
    assert.equal(out.ok, false, JSON.stringify(args));
    assert.match(out.error, pattern, JSON.stringify(args));
  }
  assert.equal(validateAnalystArgs({ layer: 'flights', where: new Array(9).fill({ field: 'lat', op: 'gt', value: 0 }) }).ok, false);
});

// ---------------------------------------------------------------------------
test('group_by returns sorted buckets, with unknowns labelled', () => {
  const snap = snapshot({
    earthquakes: { records: [
      { id: '1', lat: 1, lon: 1, magnitude: 5.1, place: 'Japan' },
      { id: '2', lat: 1, lon: 1, magnitude: 4.0, place: 'Japan' },
      { id: '3', lat: 1, lon: 1, magnitude: 6.2, place: 'Chile' },
      { id: '4', lat: 1, lon: 1, magnitude: 4.5, place: null },
    ], total: 4 },
  });
  const out = runAnalystQuery({ layer: 'earthquakes', group_by: 'place' }, snap, ctx);
  assert.deepEqual(out.result.groups, [
    { place: 'Japan', count: 2 }, { place: '(unknown)', count: 1 }, { place: 'Chile', count: 1 },
  ].sort((a, b) => b.count - a.count || a.place.localeCompare(b.place)));
  assert.equal(out.result.records, undefined);
});

test('sort order, missing-last, and the hard limit cap', () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, lat: 1, lon: 1, magnitude: i % 7 === 0 ? null : i / 10 }));
  const snap = snapshot({ earthquakes: { records: rows, total: 60 } });
  const top = runAnalystQuery({ layer: 'earthquakes', limit: 500 }, snap, ctx);
  assert.equal(top.result.records.length, ANALYST_MAX_LIMIT);
  assert.equal(top.result.records_omitted, 60 - ANALYST_MAX_LIMIT);
  assert.equal(top.result.records[0].id, 'q59'); // highest magnitude first
  const asc = runAnalystQuery({ layer: 'earthquakes', order: 'asc', limit: 3 }, snap, ctx);
  assert.ok(asc.result.records.every(r => r.magnitude != null), 'missing magnitudes must sort last even ascending');
  assert.equal(runAnalystQuery({ layer: 'earthquakes', limit: 0 }, snap, ctx).result.records, undefined);
});

// ---------------------------------------------------------------------------
test('honesty notes: partial snapshot, stale feed, stale-flagged records, old snapshot', () => {
  const records = [flight('a', 1, 1, 1)];
  const snap = snapshot({
    flights: { records, total: 9874, newestMs: NOW - 45 * 60_000, staleCount: 716, source: 'opensky-anonymous' },
  }, { capturedAt: NOW - 300_000, viewportFirst: true });
  const out = runAnalystQuery({ layer: 'flights' }, snap, ctx);
  const notes = out.result.notes.join(' | ');
  assert.match(notes, /1 of 9874/);
  assert.match(notes, /lower bounds/);
  assert.match(notes, /current view/);
  assert.match(notes, /45 min old/);
  assert.match(notes, /716 tracked aircraft/);
  assert.match(notes, /opensky-anonymous/);
  assert.match(notes, /300s ago/);
  assert.equal(out.result.total_on_map, 9874);
});

test('fresh, complete data carries no staleness or partial warnings', () => {
  const snap = snapshot({ flights: flightsLayer([flight('a', 1, 1, 1)]) });
  const out = runAnalystQuery({ layer: 'flights' }, snap, ctx);
  assert.equal(out.result.notes, undefined);
});

test('layer that is off or not loaded says how to fix it', () => {
  const snap = snapshot({ flights: flightsLayer([flight('a', 1, 1, 1)]) });
  const out = runAnalystQuery({ layer: 'ships' }, snap, ctx);
  assert.equal(out.ok, false);
  assert.match(out.error, /off or still loading/);
  assert.match(out.error, /toggle_map_layers/);
  assert.match(out.error, /Loaded: flights/);
  assert.equal(runAnalystQuery({ layer: 'flights' }, null, ctx).ok, false);
  assert.equal(runAnalystQuery({ layer: 'flights' }, { layers: null }, ctx).ok, false);
});

test('records outside valid coordinates are never matched by a geographic scope', () => {
  const snap = snapshot({ flights: { records: [{ id: 'bad', lat: null, lon: 5 }, flight('ok', 1, 5, 1)], total: 2 } });
  const out = runAnalystQuery({ layer: 'flights', scope: { bbox: [0, 0, 10, 10] } }, snap, ctx);
  assert.deepEqual(out.result.records.map(r => r.id), ['ok']);
});

// ---------------------------------------------------------------------------
// End to end: real handleChat loop with a mocked model, snapshot in request body.
// ---------------------------------------------------------------------------
test('gateway chat: model calls query_live_map and receives the live answer', async () => {
  const realFetch = globalThis.fetch;
  const seenToolMessages = [];
  let call = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    call += 1;
    if (call === 1) {
      assert.ok(body.tools.some(t => t.function.name === 'query_live_map'), 'tool must be offered to the model');
      return new Response(JSON.stringify({
        model: 'mock',
        choices: [{ message: { role: 'assistant', content: null, tool_calls: [{
          id: 'tc1', type: 'function',
          function: { name: 'query_live_map', arguments: JSON.stringify({
            layer: 'military_flights', scope: { region: 'ukraine' }, where: [{ field: 'altitude_ft', op: 'gt', value: 30000 }], count_only: true,
          }) },
        }] } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    for (const m of body.messages) if (m.role === 'tool') seenToolMessages.push(JSON.parse(m.content));
    return new Response(JSON.stringify({ model: 'mock', choices: [{ message: { role: 'assistant', content: 'Two high-flying military aircraft.' } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const response = await handleAgentGateway(
      new URL('http://localhost/api/agent-gateway/chat'),
      new Request('http://localhost/api/agent-gateway/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          connectorId: 'c1',
          connectors: [{ id: 'c1', name: 'Mock', type: 'openai-compatible', endpoint: 'https://api.openai.com/v1', model: 'm', apiKey: 'sk-test', scopes: ['intelligence'], enabled: true }],
          messages: [{ role: 'user', content: 'how many mil flights above FL300 over Ukraine?' }],
          mapSnapshot: snapshot({
            military_flights: flightsLayer([
              flight('m1', 49, 32, 35000), flight('m2', 50, 30, 41000), flight('m3', 49, 32, 12000), flight('m4', 40, -74, 38000),
            ]),
          }, { capturedAt: Date.now() }),
        }),
      }),
      { baseUrl: 'http://127.0.0.1:1', port: 1 },
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.content, 'Two high-flying military aircraft.');
    const event = payload.toolEvents.find(e => e.name === 'query_live_map');
    assert.ok(event && !event.error, JSON.stringify(payload.toolEvents));
    assert.equal(event.result.matched, 2);
    assert.equal(seenToolMessages[0].matched, 2, 'model must receive the computed count');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('gateway chat: missing snapshot yields a tool error the model can read, not a crash', async () => {
  const realFetch = globalThis.fetch;
  let call = 0;
  const toolReplies = [];
  globalThis.fetch = async (_url, init) => {
    call += 1;
    const body = JSON.parse(init.body);
    if (call === 1) {
      return new Response(JSON.stringify({ model: 'mock', choices: [{ message: { role: 'assistant', content: null, tool_calls: [{
        id: 'tc1', type: 'function', function: { name: 'query_live_map', arguments: JSON.stringify({ layer: 'flights' }) },
      }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    for (const m of body.messages) if (m.role === 'tool') toolReplies.push(m.content);
    return new Response(JSON.stringify({ model: 'mock', choices: [{ message: { role: 'assistant', content: 'No data.' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await handleAgentGateway(
      new URL('http://localhost/api/agent-gateway/chat'),
      new Request('http://localhost/api/agent-gateway/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          connectorId: 'c1',
          connectors: [{ id: 'c1', name: 'Mock', type: 'openai-compatible', endpoint: 'https://api.openai.com/v1', model: 'm', apiKey: 'sk-test', scopes: ['intelligence'], enabled: true }],
          messages: [{ role: 'user', content: 'flights?' }],
        }),
      }),
      { baseUrl: 'http://127.0.0.1:1', port: 1 },
    );
    assert.equal(response.status, 200);
    assert.match(toolReplies.join(' '), /No live map snapshot/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
