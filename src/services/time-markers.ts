/**
 * Registry of "something notable happened here" points that the time scrubber
 * plots along its axis.
 *
 * Producers (news pipeline, map data setters, market movers) publish under a
 * stable source key; republishing replaces that source's set, so a refresh
 * never duplicates markers. Consumers subscribe once and re-read the merged,
 * time-sorted list.
 */

export type TimeMarkerCategory =
  | 'conflict'
  | 'market'
  | 'disaster'
  | 'cyber'
  | 'unrest'
  | 'news';

export type TimeMarkerSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface TimeMarker {
  id: string;
  /** Epoch ms. */
  time: number;
  category: TimeMarkerCategory;
  severity: TimeMarkerSeverity;
  title: string;
  detail?: string;
  source?: string;
  url?: string;
}

type Listener = (markers: TimeMarker[]) => void;

/** Per-source cap — one noisy feed shouldn't crowd out every other marker. */
const MAX_MARKERS_PER_SOURCE = 120;
/** Global cap after merging, keeping the most severe/recent. */
const MAX_MARKERS_TOTAL = 400;

const SEVERITY_RANK: Record<TimeMarkerSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const bySource = new Map<string, TimeMarker[]>();
const listeners = new Set<Listener>();
let merged: TimeMarker[] | null = null;

function normalize(marker: TimeMarker): TimeMarker | null {
  const time = Number(marker.time);
  if (!Number.isFinite(time)) return null;
  const title = (marker.title ?? '').trim();
  if (!title) return null;
  return { ...marker, time, title };
}

function recompute(): TimeMarker[] {
  const all: TimeMarker[] = [];
  for (const markers of bySource.values()) all.push(...markers);

  if (all.length > MAX_MARKERS_TOTAL) {
    // Trim by severity first, then recency, so a burst of low-severity items
    // can't push out the handful of critical ones.
    all.sort((a, b) => (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b.time - a.time));
    all.length = MAX_MARKERS_TOTAL;
  }

  all.sort((a, b) => a.time - b.time);
  return all;
}

export function getTimeMarkers(): TimeMarker[] {
  if (merged === null) merged = recompute();
  return merged;
}

/** Markers inside `[start, end]`, in ascending time order. */
export function getTimeMarkersInRange(start: number, end: number): TimeMarker[] {
  return getTimeMarkers().filter((marker) => marker.time >= start && marker.time <= end);
}

export function publishTimeMarkers(source: string, markers: readonly TimeMarker[]): void {
  const normalized: TimeMarker[] = [];
  for (const marker of markers) {
    const clean = normalize(marker);
    if (clean) normalized.push(clean);
  }

  if (normalized.length > MAX_MARKERS_PER_SOURCE) {
    normalized.sort((a, b) => (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b.time - a.time));
    normalized.length = MAX_MARKERS_PER_SOURCE;
  }

  if (normalized.length === 0) {
    if (!bySource.has(source)) return;
    bySource.delete(source);
  } else {
    bySource.set(source, normalized);
  }

  merged = null;
  notify();
}

export function clearTimeMarkers(source?: string): void {
  if (source === undefined) bySource.clear();
  else if (!bySource.delete(source)) return;
  merged = null;
  notify();
}

export function subscribeTimeMarkers(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  const markers = getTimeMarkers();
  for (const listener of listeners) {
    try {
      listener(markers);
    } catch (err) {
      console.error('[TimeMarkers] listener failed', err);
    }
  }
}
