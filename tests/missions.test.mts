import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MISSIONS, getMission } from '../src/config/missions';
import { MAP_REGION_ANCHORS } from '../src/config/map-regions';
import { buildBriefing, missionMapEvents, inBBox, type BriefingSnapshot } from '../src/services/mission-briefing';
import { applyAgentMapToolEvents } from '../src/services/map-agent-bridge';
import { shouldAutoOpenMissionPicker } from '../src/app/ui-preferences';
import { MAP_REGION_ANCHORS as SIDECAR_ANCHORS } from '../src-tauri/sidecar/agent-tool-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Layer keys regexed from the registry (importing it drags in runtime deps). */
function registryLayerKeys(): Set<string> {
  const src = readFileSync(resolve(__dirname, '..', 'src', 'config', 'map-layer-definitions.ts'), 'utf-8');
  return new Set([...src.matchAll(/def\('([a-zA-Z0-9]+)'/g)].map(m => m[1]!));
}

const redSea = getMission('red-sea')!;
const markets = getMission('markets-open')!;

const FULL_SNAPSHOT: BriefingSnapshot = {
  cii: [{ region: 'YE', combinedScore: 72 }, { region: 'SA', combinedScore: 20 }, { region: 'US', combinedScore: 2 }],
  chokepoints: [
    { id: 'bab_el_mandeb', name: 'Bab el-Mandeb', status: 'red', disruptionScore: 80, lat: 12.6, lon: 43.3 },
    { id: 'suez', name: 'Suez Canal', status: 'yellow', disruptionScore: 30, lat: 30.45, lon: 32.35 },
    { id: 'hormuz', name: 'Strait of Hormuz', status: 'red', disruptionScore: 70, lat: 26.5, lon: 56.3 },
  ],
  headlines: [
    { title: 'Houthi drone targets tanker in Red Sea', link: 'https://a', source: 'Reuters', publishedAt: 3 },
    { title: 'Suez traffic falls again', link: 'https://b', source: 'FT', publishedAt: 2 },
    { title: 'Yemen talks stall', link: 'https://c', source: 'AP', publishedAt: 1 },
    { title: 'Aden port reopens', link: 'https://d', source: 'BBC', publishedAt: 0 },
    { title: 'Fed holds rates steady', link: 'https://e', source: 'CNBC', publishedAt: 5 },
  ],
  hotspots: [
    { id: 'h1', label: 'Hodeidah', lat: 14.8, lon: 42.95, weight: 9 },
    { id: 'h2', label: 'Kyiv', lat: 50.45, lon: 30.5, weight: 10 },
  ],
  vessels: [{ lat: 20, lon: 38 }, { lat: 15, lon: 41 }, { lat: 51, lon: 1 }],
};

describe('mission config', () => {
  it('has unique ids', () => {
    const ids = MISSIONS.map(m => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('only references layers that exist in the layer registry', () => {
    const keys = registryLayerKeys();
    assert.ok(keys.size > 40, 'registry regex found layers');
    for (const mission of MISSIONS) {
      for (const layer of mission.layers) assert.ok(keys.has(layer), `${mission.id}: unknown layer ${layer}`);
    }
  });

  it('only references known regions with sane bboxes', () => {
    for (const mission of MISSIONS) {
      assert.ok(mission.region in MAP_REGION_ANCHORS, `${mission.id}: unknown region`);
      assert.ok(mission.bbox.west < mission.bbox.east && mission.bbox.south < mission.bbox.north, `${mission.id}: bad bbox`);
      const anchor = MAP_REGION_ANCHORS[mission.region];
      assert.ok(inBBox(anchor, mission.bbox), `${mission.id}: anchor outside bbox`);
      assert.ok(mission.keywords.every(k => k === k.toLowerCase()), `${mission.id}: keywords must be lowercase`);
    }
  });

  it('client region anchors stay identical to the sidecar copy', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(MAP_REGION_ANCHORS)), JSON.parse(JSON.stringify(SIDECAR_ANCHORS)));
  });
});

describe('buildBriefing', () => {
  it('builds an elevated briefing from a full snapshot', () => {
    const b = buildBriefing(redSea, FULL_SNAPSHOT);
    assert.match(b.headline, /^Red Sea shipping: elevated/);
    assert.match(b.headline, /Bab el-Mandeb disruption 80\/100/);
    assert.match(b.headline, /YE instability 72\/100/);
    assert.deepEqual(b.topStories.map(s => s.url), ['https://a', 'https://b', 'https://c']);
    assert.ok(!b.topStories.some(s => s.title.includes('Fed')), 'unrelated headline excluded');
    assert.deepEqual(b.stats.find(s => s.label === 'Vessels in area'), { label: 'Vessels in area', value: '2' });
    assert.deepEqual(b.stats.find(s => s.label === 'Related headlines'), { label: 'Related headlines', value: '4' });
    assert.deepEqual(b.hotspots.map(h => h.id), ['h1', 'chokepoint:bab_el_mandeb', 'chokepoint:suez']);
    assert.deepEqual(b.dataGaps, []);
  });

  it('reports gaps instead of zeros on an empty snapshot', () => {
    const b = buildBriefing(redSea, {});
    assert.equal(b.headline, 'Red Sea shipping: signals still loading');
    assert.deepEqual(b.stats, []);
    assert.deepEqual(b.hotspots, []);
    assert.deepEqual(b.dataGaps, [
      'Chokepoint status unavailable',
      'Instability scores unavailable',
      'Live vessel tracking unavailable',
      'News feeds still loading',
    ]);
  });

  it('calls a region quiet only when news loaded and nothing matched', () => {
    const b = buildBriefing(redSea, { headlines: [{ title: 'Fed holds rates steady' }] });
    assert.equal(b.headline, 'Red Sea shipping: quiet in the current window');
    assert.ok(b.dataGaps.includes('No matching headlines in the current window'));
    assert.ok(!b.dataGaps.includes('News feeds still loading'));
  });

  it('handles a partial snapshot (headlines only)', () => {
    const b = buildBriefing(redSea, { headlines: FULL_SNAPSHOT.headlines });
    assert.match(b.headline, /^Red Sea shipping: watch — 4 related headlines$/);
    assert.equal(b.topStories.length, 3);
    assert.ok(b.dataGaps.includes('Instability scores unavailable'));
  });

  it('skips area traffic and hotspots for global missions', () => {
    const b = buildBriefing(markets, FULL_SNAPSHOT);
    assert.ok(!b.stats.some(s => s.label === 'Vessels in area'));
    assert.ok(!b.dataGaps.includes('Live vessel tracking unavailable'));
    assert.deepEqual(b.hotspots, []);
    assert.deepEqual(b.topStories.map(s => s.url), ['https://e']);
  });
});

describe('missionMapEvents', () => {
  it('drives the map through the agent bridge', () => {
    let layers: Record<string, boolean> = { ais: false, tradeRoutes: false, conflicts: true, flights: true };
    const centers: Array<[number, number, number | undefined]> = [];
    const highlights: unknown[] = [];
    let range: string | undefined;
    const accessors = {
      getMap: () => ({ setCenter: (lat: number, lon: number, zoom?: number) => { centers.push([lat, lon, zoom]); } }),
      getCurrentLayers: () => layers,
      commitLayers: (next: Record<string, boolean>) => { layers = next; },
      highlightFeatures: (items: unknown[]) => { highlights.push(...items); },
      setTimeRange: (r: string) => { range = r; },
    };
    const briefing = buildBriefing(redSea, FULL_SNAPSHOT);
    const summary = applyAgentMapToolEvents(missionMapEvents(redSea, layers, briefing.hotspots), accessors);

    assert.deepEqual(centers, [[19, 38.5, 6]], 'highlight must not re-center the camera');
    assert.equal(summary.movedCamera, 1);
    assert.deepEqual(summary.toggledKeys.sort(), ['ais', 'tradeRoutes']);
    assert.equal(layers.flights, true, 'missions never switch off layers the user had on');
    assert.equal(range, '7d');
    assert.equal(summary.highlighted, 1);
    assert.equal(highlights.length, 3);
    assert.deepEqual(summary.rejected, []);
  });

  it('omits highlight when there are no hotspots and ignores unknown layers', () => {
    const events = missionMapEvents(redSea, { ais: false });
    assert.deepEqual(events.map(e => e.name), ['zoom_to_region', 'toggle_map_layers', 'set_time_range']);
    assert.deepEqual(events[1]!.clientAction, { enable: ['ais'], disable: [] });
  });
});

describe('shouldAutoOpenMissionPicker', () => {
  it('opens on a plain first desktop visit', () => {
    assert.equal(shouldAutoOpenMissionPicker('', 1440, false), true);
    assert.equal(shouldAutoOpenMissionPicker('?timeRange=24h', 1440, false), true);
  });
  it('stays closed once seen, on mobile, or on shared links', () => {
    assert.equal(shouldAutoOpenMissionPicker('', 1440, true), false);
    assert.equal(shouldAutoOpenMissionPicker('', 600, false), false);
    for (const q of ['?lat=1&lon=2', '?zoom=4', '?country=UA', '?layers=ais', '?mission=red-sea']) {
      assert.equal(shouldAutoOpenMissionPicker(q, 1440, false), false, q);
    }
  });
});
