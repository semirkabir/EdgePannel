#!/usr/bin/env node
/**
 * Generates src/landing/source-catalog.ts — the truthful source list behind
 * /data-sources and the landing-page belt.
 *
 * Everything here is *derived*, never invented: RSS/API feed names come out of
 * src/config/feeds.ts (all six variant feed maps + INTEL_SOURCES) and live map
 * layers come out of src/config/map-layer-definitions.ts. Re-run after adding
 * feeds or layers:
 *
 *   node scripts/generate-source-catalog.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const feedsSrc = readFileSync(resolve(root, 'src/config/feeds.ts'), 'utf8');
const layersSrc = readFileSync(resolve(root, 'src/config/map-layer-definitions.ts'), 'utf8');

// ── Display groups ──────────────────────────────────────────────────────────
// Left column: the panel key used inside feeds.ts. Right: the public group.
const PANEL_GROUP = {
  politics: 'wire',
  us: 'wire',
  europe: 'regional',
  middleeast: 'regional',
  africa: 'regional',
  latam: 'regional',
  asia: 'regional',
  canada: 'regional',
  nordics: 'regional',
  centralasia: 'regional',
  balkans: 'regional',
  caucasus: 'regional',
  southasia: 'regional',
  pacific: 'regional',
  caribbean: 'regional',
  gccNews: 'regional',
  gov: 'official',
  sanctions: 'official',
  regulation: 'official',
  migration: 'official',
  humanrights: 'research',
  thinktanks: 'research',
  crisis: 'hazards',
  climateNews: 'hazards',
  waterSecurity: 'hazards',
  arctic: 'hazards',
  nature: 'hazards',
  defense: 'defense',
  markets: 'markets',
  finance: 'markets',
  forex: 'markets',
  bonds: 'markets',
  crypto: 'markets',
  centralbanks: 'markets',
  economic: 'markets',
  ipo: 'markets',
  derivatives: 'markets',
  fintech: 'markets',
  institutional: 'markets',
  secFilings: 'markets',
  analysis: 'markets',
  funding: 'markets',
  commodities: 'energy',
  energy: 'energy',
  tech: 'tech',
  ai: 'tech',
  startups: 'tech',
  vcblogs: 'tech',
  regionalStartups: 'tech',
  github: 'tech',
  producthunt: 'tech',
  hardware: 'tech',
  cloud: 'tech',
  dev: 'tech',
  unicorns: 'tech',
  accelerators: 'tech',
  podcasts: 'tech',
  layoffs: 'tech',
  policy: 'tech',
  security: 'cyber',
  outages: 'cyber',
  spaceNews: 'space',
  positive: 'positive',
  science: 'positive',
  health: 'positive',
  inspiring: 'positive',
  community: 'positive',
};

// INTEL_SOURCES carries its own `type` field.
const INTEL_GROUP = {
  defense: 'defense',
  intl: 'research',
  research: 'research',
  nuclear: 'defense',
  osint: 'research',
  cyber: 'cyber',
  economic: 'markets',
  investigative: 'research',
};

// Map-layer categories → the same public groups.
const LAYER_GROUP = {
  conflict: 'defense',
  military: 'defense',
  cyber: 'cyber',
  aviation: 'tracking',
  space: 'space',
  economy: 'markets',
  environment: 'hazards',
  governance: 'official',
  technology: 'tech',
  positive: 'positive',
  commodities: 'energy',
};

// ── Parse feeds.ts ──────────────────────────────────────────────────────────
/** @type {Map<string, string>} name → group */
const feeds = new Map();
const unmapped = new Set();

const feedMapRe = /^const [A-Z_]+_FEEDS: Record<string, Feed\[\]> = \{/gm;
const bounds = [...feedsSrc.matchAll(feedMapRe)].map((m) => m.index);
bounds.push(feedsSrc.indexOf('export const FEEDS'));

for (let i = 0; i < bounds.length - 1; i++) {
  const block = feedsSrc.slice(bounds[i], bounds[i + 1]);
  const panels = [...block.matchAll(/^ {2}([a-zA-Z0-9_]+): \[/gm)];
  panels.forEach((panel, k) => {
    const from = panel.index;
    const to = k + 1 < panels.length ? panels[k + 1].index : block.length;
    const group = PANEL_GROUP[panel[1]];
    if (!group) {
      unmapped.add(panel[1]);
      return;
    }
    for (const m of block.slice(from, to).matchAll(/name: '((?:[^'\\]|\\.)*)'/g)) {
      const name = m[1].replace(/\\'/g, "'");
      if (!feeds.has(name)) feeds.set(name, group);
    }
  });
}

const intelBlock = feedsSrc.slice(
  feedsSrc.indexOf('export const INTEL_SOURCES'),
  feedsSrc.indexOf('export const DEFAULT_ENABLED_SOURCES')
);
for (const m of intelBlock.matchAll(/name: '((?:[^'\\]|\\.)*)'[\s\S]*?type: '([a-z]+)'/g)) {
  const name = m[1].replace(/\\'/g, "'");
  const group = INTEL_GROUP[m[2]];
  if (!group) {
    unmapped.add(`intel:${m[2]}`);
    continue;
  }
  if (!feeds.has(name)) feeds.set(name, group);
}

// ── Parse map-layer-definitions.ts ──────────────────────────────────────────
/** @type {Map<string, string>} label → group */
const layers = new Map();
const layerRe = /def\('[^']+',\s*[^,]+,\s*'[^']+',\s*'([^']+)',\s*'([a-z]+)'/g;
for (const m of layersSrc.matchAll(layerRe)) {
  const group = LAYER_GROUP[m[2]];
  if (!group) {
    unmapped.add(`layer:${m[2]}`);
    continue;
  }
  if (!layers.has(m[1])) layers.set(m[1], group);
}

if (unmapped.size) {
  console.error(`[source-catalog] unmapped keys (add them to the tables): ${[...unmapped].join(', ')}`);
  process.exitCode = 1;
}
if (feeds.size < 400 || layers.size < 30) {
  console.error(`[source-catalog] suspiciously small parse: ${feeds.size} feeds / ${layers.size} layers`);
  process.exit(1);
}

// ── Emit ────────────────────────────────────────────────────────────────────
const entries = [
  ...[...feeds].map(([name, group]) => ({ name, group, kind: 'feed' })),
  ...[...layers].map(([name, group]) => ({ name, group, kind: 'layer' })),
].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const body = entries.map((e) => `  ['${esc(e.name)}', '${e.group}', '${e.kind}'],`).join('\n');

const out = `/**
 * GENERATED FILE — do not edit by hand.
 * Run \`node scripts/generate-source-catalog.mjs\` after changing
 * src/config/feeds.ts or src/config/map-layer-definitions.ts.
 *
 * Every entry below is a source the app actually reads: ${feeds.size} named
 * RSS/API feeds plus ${layers.size} live map layers.
 */

export type SourceGroup =
  | 'wire'
  | 'regional'
  | 'official'
  | 'defense'
  | 'research'
  | 'hazards'
  | 'markets'
  | 'energy'
  | 'tech'
  | 'cyber'
  | 'tracking'
  | 'space'
  | 'positive';

export type SourceKind = 'feed' | 'layer';

/** [name, group, kind] — tuples keep the generated bundle small. */
export type CatalogEntry = readonly [string, SourceGroup, SourceKind];

/** Display order and labels for the group filter. */
export const SOURCE_GROUPS: { id: SourceGroup; label: string; blurb: string }[] = [
  { id: 'wire', label: 'Wires & majors', blurb: 'Global wire services and flagship national outlets.' },
  { id: 'regional', label: 'Regional press', blurb: 'Local and language-native reporting from every region.' },
  { id: 'official', label: 'Government & institutions', blurb: 'Ministries, regulators, sanctions bodies and intl. organisations.' },
  { id: 'defense', label: 'Military & conflict', blurb: 'Defence reporting, conflict trackers and force-posture layers.' },
  { id: 'research', label: 'Research & investigations', blurb: 'Think tanks, OSINT collectives and investigative newsrooms.' },
  { id: 'hazards', label: 'Hazards & climate', blurb: 'Earthquakes, storms, fires, floods and climate monitoring.' },
  { id: 'markets', label: 'Markets & macro', blurb: 'Equities, FX, rates, filings, central banks and macro series.' },
  { id: 'energy', label: 'Energy & commodities', blurb: 'Oil, gas, metals, mining, agriculture and freight.' },
  { id: 'tech', label: 'Technology & AI', blurb: 'Product, research, funding and tech-policy sources.' },
  { id: 'cyber', label: 'Cyber & infrastructure', blurb: 'Advisories, outages, cables, grids and threat activity.' },
  { id: 'tracking', label: 'Aviation & maritime', blurb: 'Live vessel, aircraft and chokepoint tracking layers.' },
  { id: 'space', label: 'Space', blurb: 'Launches, satellites, spaceports and space weather.' },
  { id: 'positive', label: 'Science & positive signals', blurb: 'Research breakthroughs, conservation and human progress.' },
];

export const CATALOG: CatalogEntry[] = [
${body}
];

export const CATALOG_FEED_COUNT = ${feeds.size};
export const CATALOG_LAYER_COUNT = ${layers.size};
`;

writeFileSync(resolve(root, 'src/landing/source-catalog.ts'), out);
console.log(`[source-catalog] wrote ${entries.length} entries (${feeds.size} feeds, ${layers.size} layers)`);
