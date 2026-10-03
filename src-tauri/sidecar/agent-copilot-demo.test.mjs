/**
 * Launch-clip proof: "Show me the Red Sea and highlight this week's attacks."
 *
 * Drives the real gateway (handleAgentGateway -> handleChat ->
 * executeOpenAiToolCall) with a stubbed OpenAI-compatible LLM that returns the
 * scripted tool calls, then feeds the returned toolEvents through the real
 * frontend bridge (applyAgentMapToolEvents) against a mock map, and asserts
 * the final map state. No network, no browser.
 *
 * Run: node --experimental-strip-types --test src-tauri/sidecar/agent-copilot-demo.test.mjs
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { handleAgentGateway } from './agent-gateway.mjs';
import { MAP_REGION_ANCHORS } from './agent-tool-registry.mjs';
import { applyAgentMapToolEvents } from '../../src/services/map-agent-bridge.ts';

const LLM_ENDPOINT = 'https://llm.demo.test/v1';
const USER_PROMPT = "Show me the Red Sea and highlight this week's attacks.";
const ATTACKS = [
  { lat: 14.8, lon: 42.2, label: 'Hodeidah approach — vessel struck' },
  { lat: 12.6, lon: 43.3, label: 'Bab el-Mandeb — drone intercept' },
];

function scriptedLlm() {
  const requests = [];
  const scripted = [
    {
      model: 'demo-model',
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'zoom_to_region', arguments: JSON.stringify({ region: 'Red Sea' }) } },
            // "this week" as a raw lookback — the gateway must snap to an existing TimeRange.
            { id: 'c2', type: 'function', function: { name: 'set_time_range', arguments: JSON.stringify({ hours: 168 }) } },
            { id: 'c3', type: 'function', function: { name: 'toggle_map_layers', arguments: JSON.stringify({ enable: 'conflicts' }) } },
            { id: 'c4', type: 'function', function: { name: 'highlight_features', arguments: JSON.stringify({ items: JSON.stringify(ATTACKS), durationMs: 6000 }) } },
          ],
        },
      }],
    },
    {
      model: 'demo-model',
      choices: [{ message: { role: 'assistant', content: 'Centered on the Red Sea for the last 7 days with conflict events on; the two attack sites are highlighted.' } }],
    },
  ];
  const fetchStub = async (url, init) => {
    const href = String(url);
    if (!href.startsWith(LLM_ENDPOINT)) throw new Error(`Unexpected fetch in demo: ${href}`);
    requests.push(JSON.parse(init.body));
    const next = scripted.shift();
    if (!next) throw new Error('LLM called more times than scripted');
    return new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetchStub, requests };
}

function mockMap(initialLayers) {
  const state = {
    center: { lat: 25, lon: 10 },
    zoom: 2,
    layers: { ...initialLayers },
    timeRange: '24h',
    highlights: [],
    cameraMoves: [],
  };
  const accessors = {
    getMap: () => ({
      setCenter(lat, lon, zoom) {
        state.center = { lat, lon };
        if (zoom !== undefined) state.zoom = zoom;
        state.cameraMoves.push([lat, lon, zoom]);
      },
    }),
    getCurrentLayers: () => ({ ...state.layers }),
    commitLayers: layers => { state.layers = { ...layers }; },
    setTimeRange: range => { state.timeRange = range; },
    highlightFeatures: (items, durationMs) => { state.highlights.push({ items, durationMs }); },
  };
  return { state, accessors };
}

test('demo: "show me the Red Sea and highlight this week\'s attacks" drives the map end to end', async () => {
  const { fetchStub, requests } = scriptedLlm();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  let payload;
  try {
    const url = 'https://edgepannel.com/api/agent-gateway/chat';
    const response = await handleAgentGateway(new URL(url), new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        connectorId: 'demo',
        connectors: [{
          id: 'demo', name: 'Demo LLM', type: 'openai-compatible', endpoint: LLM_ENDPOINT,
          model: 'demo-model', scopes: ['intelligence', 'news'], enabled: true,
        }],
        messages: [{ role: 'user', content: USER_PROMPT }],
        mapViewport: { center: { lat: 25, lon: 10 }, zoom: 2, mode: 'flat' },
      }),
    }), { baseUrl: 'https://edgepannel.com', port: 0 });
    assert.equal(response.status, 200);
    payload = await response.json();
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Gateway side: two LLM turns, all four map tools offered, prompt mentions set_time_range.
  assert.equal(requests.length, 2);
  const offered = requests[0].tools.map(t => t.function.name);
  for (const name of ['zoom_to_region', 'set_time_range', 'toggle_map_layers', 'highlight_features']) {
    assert.ok(offered.includes(name), `${name} offered to the LLM`);
  }
  assert.match(requests[0].messages[0].content, /set_time_range/);
  // The second turn carries four tool results, each acknowledged for the frontend.
  const toolMsgs = requests[1].messages.filter(m => m.role === 'tool');
  assert.equal(toolMsgs.length, 4);
  for (const msg of toolMsgs) assert.equal(JSON.parse(msg.content).appliedByFrontend, true);

  assert.match(payload.content, /Red Sea/);
  assert.deepEqual(payload.toolEvents.map(e => e.name), ['zoom_to_region', 'set_time_range', 'toggle_map_layers', 'highlight_features']);
  assert.ok(payload.toolEvents.every(e => !e.error && e.clientAction), 'every map tool accepted with a clientAction');
  // 168h is exactly 7d, so no clamp — but the original lookback is echoed back.
  assert.deepEqual(payload.toolEvents[1].clientAction, { range: '7d', requested: '168h' });

  // Frontend side: real bridge against a mock map.
  const { state, accessors } = mockMap({ conflicts: false, cables: true, flights: false });
  const summary = applyAgentMapToolEvents(payload.toolEvents, accessors);

  assert.deepEqual(summary, {
    movedCamera: 1,
    toggledKeys: ['conflicts'],
    highlighted: 1,
    rejected: [],
    timeRange: '7d',
  });
  // Camera: flew to the Red Sea anchor, then nudged to the first attack pin at Red Sea zoom.
  assert.deepEqual(state.cameraMoves[0], [MAP_REGION_ANCHORS.red_sea.lat, MAP_REGION_ANCHORS.red_sea.lon, MAP_REGION_ANCHORS.red_sea.zoom]);
  assert.deepEqual(state.center, { lat: ATTACKS[0].lat, lon: ATTACKS[0].lon });
  assert.equal(state.zoom, MAP_REGION_ANCHORS.red_sea.zoom);
  // Pins are inside a Red Sea bounding box.
  for (const { lat, lon } of ATTACKS) assert.ok(lat > 11 && lat < 30 && lon > 32 && lon < 45);
  assert.equal(state.timeRange, '7d');
  assert.deepEqual(state.layers, { conflicts: true, cables: true, flights: false });
  assert.equal(state.highlights.length, 1);
  assert.equal(state.highlights[0].durationMs, 6000);
  assert.deepEqual(state.highlights[0].items, ATTACKS);
});
