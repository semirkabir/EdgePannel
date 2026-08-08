import type { MapLayers } from '@/types';
import type { WeatherCategory } from '@/services/weather';
import type { DataSourceId } from '@/services/data-freshness';
import { isDesktopRuntime } from '@/services/runtime';

export type MapRenderer = 'flat' | 'globe' | 'svg';
export type MapVariant = 'full' | 'tech' | 'finance' | 'happy' | 'commodity' | 'conflicts';

const _desktop = isDesktopRuntime();

// ── Layer categories (grouping for the layer picker) ─────────────────────────

export type LayerCategory =
  | 'conflict'
  | 'military'
  | 'cyber'
  | 'aviation'
  | 'space'
  | 'economy'
  | 'environment'
  | 'governance'
  | 'technology'
  | 'urban'
  | 'positive'
  | 'commodities';

/** Display order of categories in the layer picker. */
export const LAYER_CATEGORY_ORDER: LayerCategory[] = [
  'conflict',
  'military',
  'cyber',
  'aviation',
  'space',
  'economy',
  'environment',
  'governance',
  'technology',
  'urban',
  'positive',
  'commodities',
];

/** Section header labels shown above each group in the layer picker. */
export const LAYER_CATEGORY_LABELS: Record<LayerCategory, string> = {
  conflict:     'Conflict & Security',
  military:     'Military & Defense',
  cyber:        'Cyber & Infrastructure',
  aviation:     'Aviation & Maritime',
  space:        'Space',
  economy:      'Economy & Markets',
  environment:  'Environment & Climate',
  governance:   'Governance & Society',
  technology:   'Technology',
  urban:        'Urban & Infrastructure',
  positive:     'Positive Signals',
  commodities:  'Commodities',
};

export interface LayerCategoryGroup {
  category: LayerCategory;
  label: string;
  layers: LayerDefinition[];
}

/**
 * Everything one map layer needs to register itself, in one place. Category,
 * accent color, variant membership, data-freshness sources, and zoom gating
 * used to be five separate `Record<keyof MapLayers, ...>` tables that could
 * (and did — see `gdeltEvents`) silently drift out of sync with each other and
 * with this registry. Now a new layer is one entry here.
 */
export interface LayerDefinition {
  key: keyof MapLayers;
  icon: string;
  i18nSuffix: string;
  fallbackLabel: string;
  renderers: MapRenderer[];
  category: LayerCategory;
  /** Accent color driving the toggle icon, map markers, and legend swatch. */
  color: { light: string; dark: string };
  /** Variants whose layer picker this layer appears in. Every layer is in 'full'. */
  variants: MapVariant[];
  /** Data-freshness sources to enable/disable in step with this layer's toggle. */
  sources?: DataSourceId[];
  /** Below this zoom the layer is hidden entirely (deck.gl values are canonical). */
  minZoom?: number;
  /** Below this zoom, points render but text labels are suppressed. */
  labelZoom?: number;
  premium?: 'locked' | 'enhanced';
}

const svgIcon = (...content: string[]): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${content.join('')}</svg>`;

const ICONS = {
  target: svgIcon('<circle cx="12" cy="12" r="4.5"/>', '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  flags: svgIcon('<path d="M7 4v16"/>', '<path d="M17 4v16"/>', '<path d="M7 6c2 0 3 2 5 2s3-2 5-2"/>', '<path d="M7 14c2 0 3-2 5-2s3 2 5 2"/>'),
  fort: '<img src="/icons/military-base.png" width="16" height="16" style="display:block;object-fit:contain" />',
  atom: '<img src="/icons/nuclear.png" width="16" height="16" style="display:block;object-fit:contain" />',
  hazard: '<img src="/icons/radiation.png" width="16" height="16" style="display:block;object-fit:contain" />',
  rocket: '<img src="https://cdn-icons-png.flaticon.com/512/1086/1086091.png" width="16" height="16" style="display:block;object-fit:contain" />',
  cable: svgIcon('<path d="M8 7v4a4 4 0 0 0 4 4h4"/>', '<path d="M6 5h4v4H6z"/>', '<path d="M14 13h4v4h-4z"/>', '<path d="M7 3v2M9 3v2M15 17v2M17 17v2"/>'),
  pipe: svgIcon('<path d="M4 9h7v6H4z"/>', '<path d="M11 12h5a4 4 0 0 0 4-4V5"/>', '<path d="M16 3v4"/>'),
  server: svgIcon('<rect x="4" y="5" width="16" height="5" rx="1.5"/>', '<rect x="4" y="14" width="16" height="5" rx="1.5"/>', '<path d="M7 7.5h.01M7 16.5h.01"/>'),
  shield: svgIcon('<circle cx="12" cy="8" r="3.5"/>', '<path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>', '<path d="M17.5 3.5C19 4.2 20 5.8 20 7.5c0 1.2-.4 2.3-1.1 3.1"/>', '<path d="M16 2.2C16.6 2.1 17.3 2 18 2c2.2 0 4 1.8 4 4s-1.8 4-4 4"/>', '<line x1="2" y1="2" x2="22" y2="22"/>'),
  ship: svgIcon('<path d="M4 14h16"/>', '<path d="M7 14V9h10v5"/>', '<path d="M3 17c1.2 1 2.4 1.5 3.5 1.5S8.8 18 10 17c1.2 1 2.4 1.5 3.5 1.5S15.8 18 17 17c1.2 1 2.4 1.5 3.5 1.5"/>', '<path d="M12 5v4"/>'),
  route: svgIcon('<circle cx="6" cy="17" r="1.5"/>', '<circle cx="18" cy="7" r="1.5"/>', '<path d="M7.5 15.5c2-2 3.5-3 5.5-4"/>', '<path d="m13 8 4 0-2-2"/>'),
  plane: '<img src="/icons/airport.png" width="16" height="16" style="display:block;object-fit:contain" />',
  megaphone: '<img src="/icons/protest.png" width="16" height="16" style="display:block;object-fit:contain" />',
  usersArrow: svgIcon('<circle cx="8" cy="9" r="2"/>', '<circle cx="12.5" cy="9.5" r="1.5"/>', '<path d="M5 17c.6-2 2-3 4-3s3.4 1 4 3"/>', '<path d="M16 8h4"/>', '<path d="m18 6 2 2-2 2"/>'),
  cloud: svgIcon('<path d="M8 18h8a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 6 11a3.5 3.5 0 0 0 2 7Z"/>'),
  wifiOff: svgIcon('<path d="M4 9a12 12 0 0 1 16 0"/>', '<path d="M7 12a8 8 0 0 1 10 0"/>', '<path d="M10 15a4 4 0 0 1 4 0"/>', '<path d="M3 3 21 21"/>'),
  flame: svgIcon('<path d="M12 3c1 3-1 4.5-1 6.5 0 1.5 1 2.3 1 2.3s3-1.3 3-4.8c2 1.5 4 4 4 7.2A6.5 6.5 0 0 1 12.5 21 6.5 6.5 0 0 1 6 14.5C6 10.5 8.4 7.7 12 3Z"/>'),
  waves: svgIcon('<path d="M3 10c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2"/>', '<path d="M3 16c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2"/>'),
  chart: svgIcon('<path d="M4 20h16"/>', '<path d="M7 16v-4"/>', '<path d="M12 16V8"/>', '<path d="M17 16v-6"/>'),
  gem: '<img src="/icons/minerals.png" width="16" height="16" style="display:block;object-fit:contain" />',
  satellite: svgIcon('<path d="M15 9 9 15"/>', '<path d="M8 8 4 4"/>', '<path d="M16 16l4 4"/>', '<rect x="9" y="9" width="6" height="6" rx="1"/>', '<path d="M16 8c2-.5 3.5-2 4-4"/>', '<path d="M8 16c-.5 2-2 3.5-4 4"/>'),
  globe: svgIcon('<circle cx="12" cy="12" r="9"/>', '<path d="M3 12h18"/>', '<path d="M12 3a14 14 0 0 1 0 18"/>', '<path d="M12 3a14 14 0 0 0 0 18"/>'),
  sunMoon: svgIcon('<path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', '<circle cx="12" cy="12" r="3.5"/>', '<path d="M16.5 6.5a4.5 4.5 0 1 0 0 9"/>'),
  ban: svgIcon('<circle cx="12" cy="12" r="9"/>', '<path d="M6 18 18 6"/>'),
  building: svgIcon('<path d="M5 20h14"/>', '<path d="M7 20V6h10v14"/>', '<path d="M10 9h1M13 9h1M10 12h1M13 12h1"/>'),
  calendar: svgIcon('<rect x="4" y="6" width="16" height="14" rx="2"/>', '<path d="M8 4v4M16 4v4M4 10h16"/>'),
  coins: svgIcon('<ellipse cx="12" cy="7" rx="5" ry="2.5"/>', '<path d="M7 7v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/>', '<path d="M9 17c.8.6 1.9 1 3 1 2.8 0 5-1.1 5-2.5v-2"/>'),
  star: svgIcon('<path d="m12 3 2.4 5 5.6.8-4 3.9.9 5.5L12 15.8 7.1 18.2 8 12.7 4 8.8l5.6-.8L12 3Z"/>'),
  heart: svgIcon('<path d="M12 20s-7-4.2-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.8 12 20 12 20Z"/>'),
  smile: svgIcon('<circle cx="12" cy="12" r="9"/>', '<path d="M9 10h.01M15 10h.01"/>', '<path d="M8.5 14c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2"/>'),
  sprout: svgIcon('<path d="M12 20v-7"/>', '<path d="M12 13c-3 0-5-2-5-5 3 0 5 2 5 5Z"/>', '<path d="M12 11c0-3 2-5 5-5 0 3-2 5-5 5Z"/>'),
  spark: svgIcon('<path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z"/>', '<path d="M19 4v2M20 5h-2M5 16v2M6 17H4"/>'),
  bug: svgIcon('<circle cx="12" cy="12" r="6"/>', '<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', '<path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>'),
  bolt: svgIcon('<path d="m13 2-7 10h5l-1 10 8-12h-5l1-8Z"/>'),
  candlestick: svgIcon('<path d="M6 5v14"/>', '<path d="M10 3v18"/>', '<path d="M14 7v12"/>', '<path d="M18 4v16"/>', '<rect x="5" y="8" width="2" height="4" rx="1"/>', '<rect x="9" y="6" width="2" height="6" rx="1"/>', '<rect x="13" y="11" width="2" height="4" rx="1"/>', '<rect x="17" y="8" width="2" height="5" rx="1"/>'),
  bank: svgIcon('<path d="M4 9h16"/>', '<path d="M6 9v8M10 9v8M14 9v8M18 9v8"/>', '<path d="M3 20h18"/>', '<path d="m12 4 8 3H4l8-3Z"/>'),
  warehouse: svgIcon('<path d="M4 20V8l8-4 8 4v12"/>', '<path d="M4 10h16"/>', '<path d="M9 20v-5h6v5"/>'),
  boltLeaf: svgIcon('<path d="m13 3-6 8h4l-1 10 7-10h-4l1-8Z"/>', '<path d="M6 18c1.5-1.5 3.5-2.5 6-3"/>'),
  ballot: svgIcon('<rect x="4" y="4" width="16" height="16" rx="2"/>', '<path d="M4 9h16"/>', '<path d="M8 13h.01M12 13h.01M16 13h.01"/>', '<path d="M9 1v3M15 1v3"/>'),
  pickaxe: '<img src="/icons/minerals.png" width="16" height="16" style="display:block;object-fit:contain" />',
  factory: svgIcon('<path d="M3 20h18"/>', '<path d="M5 20V9l5 3V9l5 3V7l4 2v11"/>', '<path d="M8 15h2M13 15h2"/>'),
  anchor: svgIcon('<path d="M12 4v10"/>', '<circle cx="12" cy="4" r="1.5"/>', '<path d="M7 12a5 5 0 0 0 10 0"/>', '<path d="M5 14a7 7 0 0 0 14 0"/>'),
  warship: '<img src="https://cdn-icons-png.flaticon.com/512/6175/6175141.png" width="16" height="16" style="display:block;object-fit:contain" />',
  tornado:   svgIcon('<path d="M18 5H6a1 1 0 0 0 0 2h8.5"/>', '<path d="M16 10H8a1 1 0 0 0 0 2h6"/>', '<path d="M14 15h-4a1 1 0 0 0 0 2h2"/>', '<path d="M13 19h-1a1 1 0 0 0 0 2h.5"/>'),
  snowflake: svgIcon('<path d="M12 2v20M4.9 5.4l4.2 4.2M14.9 14.4l4.2 4.2M2 12h20M5.4 19.1l4.2-4.2M14.4 9.1l4.2-4.2"/>', '<circle cx="12" cy="12" r="1.5"/>'),
  sunHeat:   svgIcon('<circle cx="12" cy="12" r="4"/>', '<path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'),
  hurricane: svgIcon('<path d="M5 12a7 7 0 1 0 14 0 7 7 0 0 0-14 0"/>', '<path d="M12 9a3 3 0 1 0 0 6"/>', '<path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>'),
  windLines: svgIcon('<path d="M5 8h10a3 3 0 0 0 0-6 3 3 0 0 0-2.8 2"/>', '<path d="M5 12h12a3 3 0 0 1 0 6 3 3 0 0 1-2.8-2"/>', '<path d="M5 16h7"/>'),
} as const;

interface DefOptions {
  renderers?: MapRenderer[];
  premium?: 'locked' | 'enhanced';
  sources?: DataSourceId[];
  minZoom?: number;
  labelZoom?: number;
}

const def = (
  key: keyof MapLayers,
  icon: string,
  i18nSuffix: string,
  fallbackLabel: string,
  category: LayerCategory,
  color: { light: string; dark: string },
  variants: MapVariant[],
  opts: DefOptions = {},
): LayerDefinition => ({
  key, icon, i18nSuffix, fallbackLabel, category, color, variants,
  renderers: opts.renderers ?? ['flat', 'globe'],
  ...(opts.premium !== undefined && { premium: opts.premium }),
  ...(opts.sources !== undefined && { sources: opts.sources }),
  ...(opts.minZoom !== undefined && { minZoom: opts.minZoom }),
  ...(opts.labelZoom !== undefined && { labelZoom: opts.labelZoom }),
});

// Every layer belongs to 'full' — the unrestricted variant — plus whichever
// themed variants list it in VARIANT_LAYER_ORDER below. That membership is
// intentionally still expressed there too for now (see VARIANT_LAYER_ORDER's
// docstring); this array exists so a guard test and future tooling have one
// place to read "which variants show this layer" without needing to touch
// the ordering table.
const FULL_ONLY: MapVariant[] = ['full'];

export const LAYER_REGISTRY = {
  // Conflict & Security
  iranAttacks: def('iranAttacks', ICONS.target, 'iranAttacks', 'Iran Attacks', 'conflict',
    { light: '#b91c1c', dark: '#fb7185' }, FULL_ONLY, { premium: _desktop ? 'locked' : undefined }),
  hotspots: def('hotspots', '<img src="/icons/spy-icon.png" width="16" height="16" style="display:block;object-fit:contain" />', 'intelHotspots', 'Intel Hotspots', 'conflict',
    { light: '#7c3aed', dark: '#c4b5fd' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),
  conflicts: def('conflicts', ICONS.flags, 'conflictZones', 'Conflict Zones', 'conflict',
    { light: '#b91c1c', dark: '#f87171' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], minZoom: 1, labelZoom: 3 }),
  ucdpEvents: def('ucdpEvents', ICONS.flags, 'ucdpEvents', 'Armed Conflict Events', 'conflict',
    { light: '#b91c1c', dark: '#f87171' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], sources: ['ucdp_events'] }),
  protests: def('protests', ICONS.megaphone, 'protests', 'Protests', 'conflict',
    { light: '#b45309', dark: '#fbbf24' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], sources: ['acled', 'gdelt_doc'] }),
  displacement: def('displacement', ICONS.usersArrow, 'displacementFlows', 'Displacement Flows', 'conflict',
    { light: '#0f766e', dark: '#5eead4' }, ['full', 'conflicts'], { sources: ['unhcr'] }),
  sanctions: def('sanctions', ICONS.ban, 'sanctions', 'Sanctions', 'conflict',
    { light: '#dc2626', dark: '#fca5a5' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], sources: ['sanctions'] }),
  gdeltEvents: def('gdeltEvents', ICONS.target, 'gdeltEvents', 'GDELT Events', 'conflict',
    { light: '#9a3412', dark: '#fdba74' }, ['full', 'conflicts'], { renderers: ['flat', 'globe'], sources: ['gdelt_events'] }),

  // Military & Defense
  bases: def('bases', ICONS.fort, 'militaryBases', 'Military Bases', 'military',
    { light: '#1d4ed8', dark: '#93c5fd' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], minZoom: 1, labelZoom: 5 }),
  nuclear: def('nuclear', ICONS.atom, 'nuclearSites', 'Nuclear Sites', 'military',
    { light: '#a16207', dark: '#fde68a' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),
  irradiators: def('irradiators', ICONS.hazard, 'gammaIrradiators', 'Gamma Irradiators', 'military',
    { light: '#a16207', dark: '#fde68a' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),
  military: def('military', ICONS.warship, 'militaryActivity', 'Military Activity', 'military',
    { light: '#1d4ed8', dark: '#93c5fd' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], sources: ['opensky', 'wingbits'] }),

  // Cyber & Infrastructure
  cables: def('cables', ICONS.cable, 'underseaCables', 'Undersea Cables', 'cyber',
    { light: '#0369a1', dark: '#38bdf8' }, ['full', 'tech', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),
  pipelines: def('pipelines', ICONS.pipe, 'pipelines', 'Pipelines', 'cyber',
    { light: '#c2410c', dark: '#fdba74' }, ['full', 'commodity', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),
  datacenters: def('datacenters', ICONS.server, 'aiDataCenters', 'AI Data Centers', 'cyber',
    { light: '#0f766e', dark: '#22d3ee' }, ['full', 'tech'], { renderers: ['flat', 'globe', 'svg'] }),
  outages: def('outages', ICONS.wifiOff, 'internetOutages', 'Internet Outages', 'cyber',
    { light: '#b91c1c', dark: '#fb7185' }, ['full', 'tech', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], sources: ['outages'] }),
  cyberThreats: def('cyberThreats', ICONS.bug, 'cyberThreats', 'Cyber Threats', 'cyber',
    { light: '#991b1b', dark: '#f87171' }, ['full', 'tech', 'conflicts'], { sources: ['cyber_threats'] }),
  aptGroups: def('aptGroups', ICONS.shield, 'aptGroups', 'APT Groups', 'cyber',
    { light: '#991b1b', dark: '#f87171' }, ['full', 'conflicts']),
  gpsJamming: def('gpsJamming', ICONS.satellite, 'gpsJamming', 'GPS Jamming', 'cyber',
    { light: '#b45309', dark: '#fbbf24' }, ['full', 'conflicts'], { renderers: ['flat', 'globe'], premium: _desktop ? 'locked' : undefined }),

  // Aviation & Maritime
  ais: def('ais', ICONS.ship, 'shipTraffic', 'Ship Traffic', 'aviation',
    { light: '#0284c7', dark: '#7dd3fc' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'], sources: ['ais'] }),
  flights: def('flights', ICONS.plane, 'flightDelays', 'Flight Delays', 'aviation',
    { light: '#ea580c', dark: '#fdba74' }, ['full', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),
  tradeRoutes: def('tradeRoutes', ICONS.route, 'tradeRoutes', 'Trade Routes', 'aviation',
    { light: '#a16207', dark: '#fde68a' }, ['full', 'finance', 'commodity']),
  waterways: def('waterways', ICONS.waves, 'strategicWaterways', 'Strategic Waterways', 'aviation',
    { light: '#0369a1', dark: '#60a5fa' }, ['full', 'commodity'], { renderers: ['flat', 'globe', 'svg'] }),
  navWarnings: def('navWarnings', ICONS.waves, 'navWarnings', 'Nav Warnings', 'aviation',
    { light: '#0369a1', dark: '#38bdf8' }, ['full', 'conflicts']),

  // Space
  spaceports: def('spaceports', ICONS.rocket, 'spaceports', 'Spaceports', 'space',
    { light: '#4338ca', dark: '#a5b4fc' }, FULL_ONLY, { renderers: ['flat', 'globe', 'svg'] }),
  satellite: def('satellite', ICONS.satellite, 'satellite', 'Satellites', 'space',
    { light: '#06b6d4', dark: '#22d3ee' }, FULL_ONLY, { renderers: ['flat', 'globe'] }),

  // Economy & Markets
  economic: def('economic', ICONS.chart, 'economicCenters', 'Economic Centers', 'economy',
    { light: '#475569', dark: '#cbd5e1' }, ['full', 'finance'], { renderers: ['flat', 'globe', 'svg'] }),
  marketPerf: def('marketPerf', ICONS.chart, 'marketPerf', 'Market Performance', 'economy',
    { light: '#15803d', dark: '#4ade80' }, ['full', 'finance'], { renderers: ['flat', 'globe'] }),
  polymarketMarkets: def('polymarketMarkets', ICONS.chart, 'polymarketMarkets', 'Prediction Markets', 'economy',
    { light: '#15803d', dark: '#86efac' }, FULL_ONLY, { renderers: ['flat', 'globe', 'svg'] }),
  stockExchanges: def('stockExchanges', ICONS.candlestick, 'stockExchanges', 'Stock Exchanges', 'economy',
    { light: '#92400e', dark: '#fbbf24' }, ['full', 'finance'], { renderers: ['flat', 'globe', 'svg'] }),
  financialCenters: def('financialCenters', ICONS.coins, 'financialCenters', 'Financial Centers', 'economy',
    { light: '#047857', dark: '#34d399' }, ['full', 'finance'], { renderers: ['flat', 'globe', 'svg'] }),
  centralBanks: def('centralBanks', ICONS.bank, 'centralBanks', 'Central Banks', 'economy',
    { light: '#92400e', dark: '#fde68a' }, ['full', 'finance'], { renderers: ['flat', 'globe', 'svg'] }),
  commodityHubs: def('commodityHubs', ICONS.warehouse, 'commodityHubs', 'Commodity Hubs', 'economy',
    { light: '#9a3412', dark: '#fdba74' }, ['full', 'finance', 'commodity'], { renderers: ['flat', 'globe', 'svg'] }),
  gulfInvestments: def('gulfInvestments', ICONS.coins, 'gulfInvestments', 'GCC Investments', 'economy',
    { light: '#0f766e', dark: '#5eead4' }, ['full', 'finance'], { renderers: ['flat', 'globe', 'svg'], minZoom: 1, labelZoom: 5 }),
  tariffBarriers: def('tariffBarriers', ICONS.ban, 'tariffBarriers', 'Tariff Barriers', 'economy',
    { light: '#b45309', dark: '#fbbf24' }, ['full', 'finance', 'commodity', 'conflicts'], { renderers: ['flat', 'globe'] }),
  minerals: def('minerals', ICONS.gem, 'criticalMinerals', 'Critical Minerals', 'economy',
    { light: '#7c3aed', dark: '#c4b5fd' }, ['full', 'commodity', 'conflicts'], { renderers: ['flat', 'globe', 'svg'] }),

  // Environment & Climate
  climate: def('climate', ICONS.globe, 'climateAnomalies', 'Climate Anomalies', 'environment',
    { light: '#0f766e', dark: '#5eead4' }, FULL_ONLY, { sources: ['climate'] }),
  weather: def('weather', ICONS.cloud, 'weatherAlerts', 'Weather Alerts', 'environment',
    { light: '#2563eb', dark: '#93c5fd' }, ['full', 'commodity'], { renderers: ['flat', 'globe', 'svg'], sources: ['weather'] }),
  natural: def('natural', ICONS.globe, 'naturalEvents', 'Natural Events', 'environment',
    { light: '#dc2626', dark: '#fca5a5' }, ['full', 'commodity'], { renderers: ['flat', 'globe', 'svg'], sources: ['usgs'], minZoom: 1, labelZoom: 2 }),
  earthquakes: def('earthquakes', ICONS.globe, 'earthquakes', 'Earthquakes', 'environment',
    { light: '#c2410c', dark: '#fb923c' }, ['full', 'commodity']),
  fires: def('fires', ICONS.flame, 'fires', 'Fires', 'environment',
    { light: '#c2410c', dark: '#fb923c' }, FULL_ONLY, { renderers: ['flat', 'globe', 'svg'] }),
  gemRisk: def('gemRisk', ICONS.globe, 'gemRisk', 'Seismic Risk', 'environment',
    { light: '#c2410c', dark: '#fb923c' }, FULL_ONLY, { renderers: ['flat', 'globe'] }),
  dayNight: def('dayNight', ICONS.sunMoon, 'dayNight', 'Day/Night', 'environment',
    { light: '#334155', dark: '#94a3b8' }, FULL_ONLY, { renderers: ['flat'] }),

  // Governance & Society
  ciiChoropleth: def('ciiChoropleth', ICONS.globe, 'ciiChoropleth', 'CII Instability', 'governance',
    { light: '#b91c1c', dark: '#fca5a5' }, ['full', 'conflicts'], { renderers: ['flat', 'globe'], premium: _desktop ? 'enhanced' : undefined }),
  governanceChoropleth: def('governanceChoropleth', ICONS.shield, 'governanceChoropleth', 'Governance Quality', 'governance',
    { light: '#4338ca', dark: '#a5b4fc' }, ['full', 'finance', 'conflicts'], { renderers: ['flat', 'globe'] }),
  democracy: def('democracy', ICONS.building, 'democracy', 'Democracy Index', 'governance',
    { light: '#1d4ed8', dark: '#93c5fd' }, FULL_ONLY, { renderers: ['flat', 'globe'] }),
  elections: def('elections', ICONS.ballot, 'elections', 'Elections', 'governance',
    { light: '#7c3aed', dark: '#c4b5fd' }, ['full', 'conflicts'], { renderers: ['flat', 'globe'] }),

  // Technology
  startupHubs: def('startupHubs', ICONS.spark, 'startupHubs', 'Startup Hubs', 'technology',
    { light: '#15803d', dark: '#4ade80' }, ['full', 'tech'], { renderers: ['flat', 'globe', 'svg'] }),
  techHQs: def('techHQs', ICONS.building, 'techHQs', 'Tech HQs', 'technology',
    { light: '#0f766e', dark: '#67e8f9' }, ['full', 'tech'], { renderers: ['flat', 'globe', 'svg'] }),
  accelerators: def('accelerators', ICONS.bolt, 'accelerators', 'Accelerators', 'technology',
    { light: '#b45309', dark: '#fbbf24' }, ['full', 'tech'], { renderers: ['flat', 'globe', 'svg'] }),
  cloudRegions: def('cloudRegions', ICONS.cloud, 'cloudRegions', 'Cloud Regions', 'technology',
    { light: '#6d28d9', dark: '#a78bfa' }, ['full', 'tech'], { renderers: ['flat', 'globe', 'svg'] }),
  techEvents: def('techEvents', ICONS.calendar, 'techEvents', 'Tech Events', 'technology',
    { light: '#be185d', dark: '#f9a8d4' }, ['full', 'tech'], { renderers: ['flat', 'globe', 'svg'] }),

  // Positive Signals
  positiveEvents: def('positiveEvents', ICONS.star, 'positiveEvents', 'Positive Events', 'positive',
    { light: '#16a34a', dark: '#86efac' }, ['full', 'happy']),
  kindness: def('kindness', ICONS.heart, 'kindness', 'Acts of Kindness', 'positive',
    { light: '#db2777', dark: '#f9a8d4' }, ['full', 'happy']),
  happiness: def('happiness', ICONS.smile, 'happiness', 'World Happiness', 'positive',
    { light: '#ca8a04', dark: '#fde047' }, ['full', 'happy']),
  speciesRecovery: def('speciesRecovery', ICONS.sprout, 'speciesRecovery', 'Species Recovery', 'positive',
    { light: '#15803d', dark: '#86efac' }, ['full', 'happy']),
  renewableInstallations: def('renewableInstallations', ICONS.boltLeaf, 'renewableInstallations', 'Clean Energy', 'positive',
    { light: '#65a30d', dark: '#bef264' }, ['full', 'happy']),

  // Commodities
  miningSites: def('miningSites', ICONS.pickaxe, 'miningSites', 'Mining Sites', 'commodities',
    { light: '#92400e', dark: '#fdba74' }, ['full', 'commodity'], { renderers: ['flat', 'globe', 'svg'] }),
  processingPlants: def('processingPlants', ICONS.factory, 'processingPlants', 'Processing Plants', 'commodities',
    { light: '#525252', dark: '#d4d4d8' }, ['full', 'commodity'], { renderers: ['flat', 'globe', 'svg'] }),
  commodityPorts: def('commodityPorts', ICONS.anchor, 'commodityPorts', 'Commodity Ports', 'commodities',
    { light: '#0f766e', dark: '#5eead4' }, ['full', 'commodity'], { renderers: ['flat', 'globe', 'svg'] }),

  // Urban & Infrastructure
  buildings: def('buildings', ICONS.building, 'buildings3d', '3D Buildings', 'urban',
    { light: '#64748b', dark: '#94a3b8' }, ['full', 'tech', 'finance', 'commodity', 'conflicts', 'happy'],
    { renderers: ['flat'], minZoom: 13 }),
} satisfies Record<keyof MapLayers, LayerDefinition>;

export function getLayerCategory(key: keyof MapLayers): LayerCategory {
  return LAYER_REGISTRY[key]?.category ?? 'conflict';
}

/** Data-freshness source ids to enable/disable in step with this layer's toggle. */
export function getLayerSources(key: keyof MapLayers): DataSourceId[] {
  return LAYER_REGISTRY[key]?.sources ?? [];
}

/** `[layerKey, sourceIds]` pairs for every layer that has data-freshness sources. */
export function getLayerSourceEntries(): Array<[keyof MapLayers, DataSourceId[]]> {
  return (Object.keys(LAYER_REGISTRY) as Array<keyof MapLayers>)
    .filter(key => (LAYER_REGISTRY[key].sources?.length ?? 0) > 0)
    .map(key => [key, LAYER_REGISTRY[key].sources!]);
}

/** Zoom gating for a layer, or undefined if it has none (always visible). */
export function getLayerZoomThreshold(key: keyof MapLayers): { minZoom: number; labelZoom?: number } | undefined {
  const minZoom = LAYER_REGISTRY[key]?.minZoom;
  if (minZoom === undefined) return undefined;
  const labelZoom = LAYER_REGISTRY[key].labelZoom;
  return labelZoom !== undefined ? { minZoom, labelZoom } : { minZoom };
}

/** Every layer key that has a zoom threshold defined. */
export function getLayerKeysWithZoomThreshold(): Array<keyof MapLayers> {
  return (Object.keys(LAYER_REGISTRY) as Array<keyof MapLayers>)
    .filter(key => LAYER_REGISTRY[key].minZoom !== undefined);
}

// ── Weather category icon/color/label maps ───────────────────────────────────

export const WEATHER_CATEGORY_ICONS: Record<WeatherCategory, string> = {
  tornado:      ICONS.tornado,
  flood:        ICONS.waves,
  thunderstorm: ICONS.bolt,
  snow:         ICONS.snowflake,
  heat:         ICONS.sunHeat,
  hurricane:    ICONS.hurricane,
  fire:         ICONS.flame,
  wind:         ICONS.windLines,
  default:      ICONS.cloud,
};

export const WEATHER_CATEGORY_COLORS: Record<WeatherCategory, { light: string; dark: string }> = {
  tornado:      { light: '#dc2626', dark: '#f87171' },
  flood:        { light: '#2563eb', dark: '#60a5fa' },
  thunderstorm: { light: '#d97706', dark: '#fbbf24' },
  snow:         { light: '#0891b2', dark: '#67e8f9' },
  heat:         { light: '#ea580c', dark: '#fb923c' },
  hurricane:    { light: '#7c3aed', dark: '#a78bfa' },
  fire:         { light: '#c2410c', dark: '#fb923c' },
  wind:         { light: '#64748b', dark: '#94a3b8' },
  default:      { light: '#2563eb', dark: '#93c5fd' },
};

export const WEATHER_CATEGORY_LABELS: Record<WeatherCategory, string> = {
  tornado:      'Tornado',
  flood:        'Flood',
  thunderstorm: 'Thunderstorm',
  snow:         'Winter Storm',
  heat:         'Heat',
  hurricane:    'Hurricane / Tropical',
  fire:         'Fire Weather',
  wind:         'High Wind',
  default:      'Weather Alert',
};

export function resolveLayerAccentColor(key: keyof MapLayers, theme: 'light' | 'dark' = 'dark'): string {
  const color = LAYER_REGISTRY[key]?.color;
  if (!color) return theme === 'light' ? '#475569' : '#a1a1aa';
  return theme === 'light' ? color.light : color.dark;
}

export function resolveLayerIcon(key: keyof MapLayers): string {
  return LAYER_REGISTRY[key].icon;
}

/**
 * Per-variant layer membership AND ordering. Membership here is intentionally
 * still the single behavioral source of truth (this is what `getLayersForVariant`
 * actually reads) — `LayerDefinition.variants` above is a provably-redundant
 * mirror of it, generated from this table, so a guard test can assert every
 * registry key belongs to at least one variant without needing to export this
 * private table. Consolidating the two into one (dropping this table in favor
 * of category-ordered variant lists) is a deliberately separate, larger change
 * — see the Phase 1b note in the map-layers plan — because it would also
 * reorder layers within their category, which this table currently controls
 * and category-order alone does not.
 */
const VARIANT_LAYER_ORDER: Record<MapVariant, Array<keyof MapLayers>> = {
  full: [
    'hotspots', 'conflicts',
    'bases', 'nuclear', 'irradiators', 'spaceports',
    'cables', 'pipelines', 'datacenters', 'military',
    'ais', 'tradeRoutes', 'flights', 'protests',
    'ucdpEvents', 'gdeltEvents', 'displacement', 'climate', 'weather',
    'outages', 'cyberThreats', 'aptGroups', 'natural', 'earthquakes', 'fires',
    'waterways', 'navWarnings', 'economic', 'marketPerf', 'polymarketMarkets', 'minerals', 'gpsJamming', 'satellite',
    'ciiChoropleth', 'governanceChoropleth', 'dayNight',
    'startupHubs', 'techHQs', 'accelerators', 'cloudRegions', 'techEvents',
    'stockExchanges', 'financialCenters', 'centralBanks', 'commodityHubs', 'gulfInvestments',
    'positiveEvents', 'kindness', 'happiness', 'speciesRecovery', 'renewableInstallations',
    'miningSites', 'processingPlants', 'commodityPorts',
    'iranAttacks', 'sanctions', 'tariffBarriers', 'democracy', 'gemRisk', 'elections',
    'buildings',
  ],
  tech: [
    'startupHubs', 'techHQs', 'accelerators', 'cloudRegions',
    'datacenters', 'cables', 'outages', 'cyberThreats',
    'techEvents',
    'buildings',
  ],
  finance: [
    'stockExchanges', 'financialCenters', 'centralBanks', 'commodityHubs',
    'gulfInvestments', 'tradeRoutes', 'economic', 'marketPerf', 'tariffBarriers', 'governanceChoropleth',
    'buildings',
  ],
  happy: [
    'positiveEvents', 'kindness', 'happiness',
    'speciesRecovery', 'renewableInstallations',
    'buildings',
  ],
  commodity: [
    'miningSites', 'processingPlants', 'commodityPorts', 'commodityHubs',
    'minerals', 'pipelines', 'waterways', 'tradeRoutes',
    'natural', 'earthquakes', 'tariffBarriers', 'weather',
    'buildings',
  ],
  conflicts: [
    'hotspots', 'conflicts',
    'bases', 'nuclear', 'irradiators', 'gpsJamming',
    'military', 'ais', 'navWarnings', 'flights', 'protests',
    'ucdpEvents', 'gdeltEvents', 'displacement', 'ciiChoropleth', 'governanceChoropleth',
    'cables', 'pipelines',
    'cyberThreats', 'aptGroups', 'outages', 'minerals', 'sanctions', 'tariffBarriers', 'elections',
    'buildings',
  ],
};

const I18N_PREFIX = 'components.deckgl.layers.';

export function getLayersForVariant(variant: MapVariant, renderer: MapRenderer): LayerDefinition[] {
  const keys = VARIANT_LAYER_ORDER[variant] ?? VARIANT_LAYER_ORDER.full;
  return keys
    .map(k => LAYER_REGISTRY[k])
    .filter(d => d.renderers.includes(renderer));
}

/**
 * Same layers as {@link getLayersForVariant}, grouped by category. Both the
 * layer order within each group and the order of the groups themselves follow
 * the variant's curated {@link VARIANT_LAYER_ORDER} — the picker leads with the
 * category the variant lists first (e.g. commodity → Commodities, tech →
 * Technology). Categories with no layers in this variant/renderer are omitted.
 */
export function getCategorizedLayersForVariant(variant: MapVariant, renderer: MapRenderer): LayerCategoryGroup[] {
  const defs = getLayersForVariant(variant, renderer);
  const byCategory = new Map<LayerCategory, LayerDefinition[]>();
  for (const def of defs) {
    const cat = getLayerCategory(def.key);
    const group = byCategory.get(cat);
    if (group) group.push(def);
    else byCategory.set(cat, [def]); // first-appearance insertion order = variant-curated priority
  }
  return Array.from(byCategory.entries()).map(([category, layers]) => ({
    category,
    label: LAYER_CATEGORY_LABELS[category],
    layers,
  }));
}

/** Returns the set of layer keys permitted in a given variant's toggle panel. */
export function getVariantAllowedLayerKeys(variant: MapVariant): Set<keyof MapLayers> {
  return new Set(VARIANT_LAYER_ORDER[variant] ?? VARIANT_LAYER_ORDER.full);
}

export function resolveLayerLabel(def: LayerDefinition, tFn?: (key: string) => string): string {
  if (tFn) {
    const translated = tFn(I18N_PREFIX + def.i18nSuffix);
    if (translated && translated !== I18N_PREFIX + def.i18nSuffix) return translated;
  }
  return def.fallbackLabel;
}
