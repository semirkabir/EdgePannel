import type { MapRegionId } from './map-regions';

/**
 * Missions: one-click briefings that set region, layers and time range, then
 * render a deterministic (no-AI) briefing. The same missions are exposed to
 * connected agents via run_mission / get_mission_briefing.
 *
 * Launch set is limited to regions whose feeds were verified to carry real
 * data (see .hermes/plans/2026-10-10_211500-briefing-connect-byoa.md, risk 1).
 * Taiwan Strait / South China Sea / Korea are held until checked against
 * production data.
 */
export type MissionTimeRange = '24h' | '48h' | '7d';

export interface MissionBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Mission {
  id: string;
  title: string;
  /** One-line "why look here" for the picker card. */
  summary: string;
  region: MapRegionId;
  /** Area used to count hotspots/vessels/flights for the briefing. */
  bbox: MissionBBox;
  /** Keys from LAYER_REGISTRY (map-layer-definitions.ts). */
  layers: string[];
  timeRange: MissionTimeRange;
  /** ISO2 codes whose CII scores feed the stats strip. */
  countries: string[];
  /** Chokepoint ids from get-chokepoint-status relevant to this mission. */
  chokepoints: string[];
  /** Lowercase regex fragments matched against headline text. */
  keywords: string[];
  /** Appended to the agent paste sentence: "...then <agentPrompt>". */
  agentPrompt: string;
}

export const MISSIONS: readonly Mission[] = [
  {
    id: 'ukraine-front',
    title: 'Ukraine front',
    summary: 'Front-line strikes, outages and instability across Ukraine and Russia.',
    region: 'ukraine',
    bbox: { west: 22, south: 44, east: 41, north: 53 },
    layers: ['conflicts', 'ucdpEvents', 'hotspots', 'outages', 'military', 'gpsJamming'],
    timeRange: '48h',
    countries: ['UA', 'RU'],
    chokepoints: [],
    keywords: ['ukrain', 'kyiv', 'zaporizh', 'kharkiv', 'donbas', 'donetsk', 'odesa', 'crimea'],
    agentPrompt: 'brief me on the Ukraine front',
  },
  {
    id: 'iran-gulf',
    title: 'Iran and the Gulf',
    summary: 'Hormuz shipping risk, Iran strikes and Gulf military posture.',
    region: 'middle_east',
    bbox: { west: 44, south: 22, east: 62, north: 38 },
    layers: ['iranAttacks', 'conflicts', 'hotspots', 'military', 'ais', 'waterways', 'nuclear'],
    timeRange: '48h',
    countries: ['IR', 'IL', 'SA'],
    chokepoints: ['hormuz'],
    keywords: ['iran', 'tehran', 'hormuz', 'irgc', 'gulf', 'israel'],
    agentPrompt: 'brief me on Iran and the Gulf',
  },
  {
    id: 'red-sea',
    title: 'Red Sea shipping',
    summary: 'Houthi threats, Bab el-Mandeb and Suez traffic, rerouted trade.',
    region: 'red_sea',
    bbox: { west: 32, south: 11, east: 45, north: 30 },
    layers: ['ais', 'tradeRoutes', 'waterways', 'navWarnings', 'conflicts', 'hotspots'],
    timeRange: '7d',
    countries: ['YE', 'SA'],
    chokepoints: ['bab_el_mandeb', 'suez'],
    keywords: ['red sea', 'houthi', 'yemen', 'bab el', 'suez', 'aden'],
    agentPrompt: 'brief me on Red Sea shipping',
  },
  {
    id: 'markets-open',
    title: 'Markets open',
    summary: 'Index moves, central banks and the geopolitical risk behind them.',
    region: 'global',
    bbox: { west: -180, south: -60, east: 180, north: 75 },
    layers: ['stockExchanges', 'financialCenters', 'centralBanks', 'marketPerf', 'economic'],
    timeRange: '24h',
    countries: ['US', 'CN', 'DE', 'GB'],
    chokepoints: [],
    keywords: ['stock', 's&p', 'nasdaq', 'dow', 'fed ', 'treasury', 'oil price', 'rate cut', 'inflation'],
    agentPrompt: 'give me the markets-open brief',
  },
];

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find(mission => mission.id === id);
}
