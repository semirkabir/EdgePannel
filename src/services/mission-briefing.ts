import type { Mission, MissionBBox } from '../config/missions';
import { MAP_REGION_ANCHORS } from '../config/map-regions';
import type { AgentMapToolEvent, AgentHighlightItem } from './map-agent-bridge';

/**
 * Deterministic, no-AI mission briefing. Pure functions over a plain data
 * snapshot so the free tier, the agent path and tests all see the same facts.
 * Never invents numbers: anything missing goes into `dataGaps`.
 */

export interface BriefingSnapshot {
  /** CII scores keyed by ISO2. */
  cii?: Array<{ region: string; combinedScore: number; trend?: string }>;
  chokepoints?: Array<{ id: string; name: string; status: string; disruptionScore: number; lat?: number; lon?: number }>;
  headlines?: Array<{ title: string; link?: string; source?: string; publishedAt?: number }>;
  hotspots?: Array<{ id: string; label: string; lat: number; lon: number; weight?: number }>;
  vessels?: Array<{ lat: number; lon: number }>;
  flights?: Array<{ lat: number; lon: number }>;
}

export interface BriefingStat {
  label: string;
  value: string;
  tone?: 'calm' | 'watch' | 'alert';
}

export interface BriefingStory {
  title: string;
  url?: string;
  source?: string;
}

export interface Briefing {
  missionId: string;
  headline: string;
  stats: BriefingStat[];
  hotspots: AgentHighlightItem[];
  topStories: BriefingStory[];
  dataGaps: string[];
}

const MAX_STORIES = 3;
const MAX_HOTSPOTS = 5;

export function inBBox(point: { lat: number; lon: number }, bbox: MissionBBox): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && point.lat >= bbox.south && point.lat <= bbox.north
    && point.lon >= bbox.west && point.lon <= bbox.east;
}

export function matchesMission(text: string, mission: Mission): boolean {
  const lower = text.toLowerCase();
  return mission.keywords.some(keyword => lower.includes(keyword));
}

function chokepointTone(status: string): BriefingStat['tone'] {
  if (status === 'red') return 'alert';
  if (status === 'yellow') return 'watch';
  return 'calm';
}

function ciiTone(score: number): BriefingStat['tone'] {
  if (score >= 60) return 'alert';
  if (score >= 35) return 'watch';
  return 'calm';
}

export function buildBriefing(mission: Mission, snapshot: BriefingSnapshot): Briefing {
  const stats: BriefingStat[] = [];
  const dataGaps: string[] = [];
  const alertSignals: string[] = [];

  // Chokepoints
  if (mission.chokepoints.length > 0) {
    const points = (snapshot.chokepoints ?? []).filter(cp => mission.chokepoints.includes(cp.id));
    if (points.length === 0) dataGaps.push('Chokepoint status unavailable');
    for (const cp of points) {
      const tone = chokepointTone(cp.status);
      stats.push({ label: cp.name, value: `${cp.disruptionScore}/100 disruption`, tone });
      if (tone === 'alert') alertSignals.push(`${cp.name} disruption ${cp.disruptionScore}/100`);
    }
  }

  // Country instability
  const cii = (snapshot.cii ?? []).filter(entry => mission.countries.includes(entry.region));
  if (cii.length === 0) {
    dataGaps.push('Instability scores unavailable');
  } else {
    const top = [...cii].sort((a, b) => b.combinedScore - a.combinedScore)[0]!;
    const tone = ciiTone(top.combinedScore);
    stats.push({ label: `${top.region} instability`, value: `${top.combinedScore}/100`, tone });
    if (tone === 'alert') alertSignals.push(`${top.region} instability ${top.combinedScore}/100`);
  }

  // Traffic in area (skipped for global missions where counts are meaningless)
  const isGlobal = mission.region === 'global';
  if (!isGlobal) {
    if (snapshot.vessels === undefined || snapshot.vessels.length === 0) {
      if (mission.layers.includes('ais')) dataGaps.push('Live vessel tracking unavailable');
    } else {
      stats.push({ label: 'Vessels in area', value: String(snapshot.vessels.filter(v => inBBox(v, mission.bbox)).length) });
    }
    if (snapshot.flights && snapshot.flights.length > 0) {
      stats.push({ label: 'Aircraft in area', value: String(snapshot.flights.filter(f => inBBox(f, mission.bbox)).length) });
    }
  }

  // Headlines
  const stories = (snapshot.headlines ?? [])
    .filter(item => item.title && matchesMission(item.title, mission))
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  if (stories.length === 0) dataGaps.push('No matching headlines in the current window');
  else stats.push({ label: 'Related headlines', value: String(stories.length) });

  // Hotspots: explicit hotspots in bbox, plus non-calm chokepoints with coords
  const hotspots: AgentHighlightItem[] = [];
  if (!isGlobal) {
    for (const spot of [...(snapshot.hotspots ?? [])]
      .filter(s => inBBox(s, mission.bbox))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))) {
      hotspots.push({ id: spot.id, label: spot.label, lat: spot.lat, lon: spot.lon });
    }
  }
  for (const cp of snapshot.chokepoints ?? []) {
    if (mission.chokepoints.includes(cp.id) && cp.status !== 'green'
      && Number.isFinite(cp.lat) && Number.isFinite(cp.lon)) {
      hotspots.push({ id: `chokepoint:${cp.id}`, label: cp.name, lat: cp.lat, lon: cp.lon, type: 'chokepoint' });
    }
  }

  return {
    missionId: mission.id,
    headline: buildHeadline(mission, alertSignals, stories.length),
    stats,
    hotspots: hotspots.slice(0, MAX_HOTSPOTS),
    topStories: stories.slice(0, MAX_STORIES).map(s => ({ title: s.title, url: s.link, source: s.source })),
    dataGaps,
  };
}

function buildHeadline(mission: Mission, alertSignals: string[], storyCount: number): string {
  if (alertSignals.length > 0) return `${mission.title}: elevated — ${alertSignals.join('; ')}`;
  if (storyCount >= 5) return `${mission.title}: active — ${storyCount} related headlines`;
  if (storyCount > 0) return `${mission.title}: watch — ${storyCount} related headline${storyCount === 1 ? '' : 's'}`;
  return `${mission.title}: quiet in the current window`;
}

/**
 * Map events that apply a mission. Same shape as the gateway's accepted
 * client-executed tool events, so applyAgentMapToolEvents is the single path
 * for both the free mission button and connected agents.
 */
export function missionMapEvents(
  mission: Mission,
  currentLayers: Record<string, boolean>,
  hotspots: AgentHighlightItem[] = [],
): AgentMapToolEvent[] {
  const anchor = MAP_REGION_ANCHORS[mission.region];
  const enable = mission.layers.filter(key => key in currentLayers);
  const events: AgentMapToolEvent[] = [
    { name: 'zoom_to_region', clientAction: { region: mission.region, lat: anchor.lat, lon: anchor.lon, zoom: anchor.zoom } },
    { name: 'toggle_map_layers', clientAction: { enable, disable: [] } },
    { name: 'set_time_range', clientAction: { range: mission.timeRange } },
  ];
  if (hotspots.length > 0) {
    events.push({ name: 'highlight_features', clientAction: { items: hotspots, durationMs: 6000 } });
  }
  return events;
}
