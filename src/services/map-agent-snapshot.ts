/**
 * Compact snapshot of what is on the analyst's map right now, attached to each
 * agent chat request so the `query_live_map` tool can count / filter / rank it
 * server-side (src-tauri/sidecar/agent-analyst-engine.mjs).
 *
 * Pure and dependency-free (type-only imports) so it runs under node tests.
 * Records use the engine's canonical field names, not the app's internal ones.
 */
import type { MilitaryFlight, MilitaryVessel, NaturalEvent } from '@/types';
import type { Earthquake } from '@/services/earthquakes';
import type { PositionSample } from '@/services/aviation';
import type { AisPositionData } from '@/services/maritime';

export interface FireDetection {
  lat: number;
  lon: number;
  brightness: number;
  frp: number;
  confidence: number;
  region: string;
  acq_date: string;
  daynight: string;
}

/** Raw arrays as the map holds them. Any member may be absent (layer off / not loaded). */
export interface AgentMapSources {
  flights?: readonly PositionSample[];
  militaryFlights?: readonly MilitaryFlight[];
  ships?: readonly (AisPositionData & { observedAt?: number })[];
  militaryVessels?: readonly MilitaryVessel[];
  earthquakes?: readonly Earthquake[];
  naturalEvents?: readonly NaturalEvent[];
  fires?: readonly FireDetection[];
}

export interface AgentSnapshotLayer {
  records: Array<Record<string, string | number | boolean | null>>;
  /** Records on the map before capping. */
  total: number;
  source?: string;
  /** Epoch ms of the freshest record, when the feed carries timestamps. */
  newestMs?: number;
  staleCount?: number;
}

export interface AgentMapSnapshot {
  capturedAt: number;
  /** True when records inside the viewport were kept ahead of the rest on capping. */
  viewportFirst: boolean;
  layers: Record<string, AgentSnapshotLayer>;
}

export interface SnapshotOptions {
  /** Layer keys currently toggled on (MapLayers). Layers that are off are omitted. */
  enabledLayers?: Readonly<Record<string, boolean>>;
  viewport?: { west: number; south: number; east: number; north: number } | null;
  /** Per-layer cap. Aircraft can number 10k+; the request body must stay small. */
  maxPerLayer?: number;
  nowMs?: number;
}

export const SNAPSHOT_MAX_PER_LAYER = 1500;

const MS_PER_HOUR = 3_600_000;

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value: number | null, places = 4): number | null {
  if (value === null) return null;
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

function dateMs(value: unknown): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const n = num(value);
  return n;
}

function inView(lat: number, lon: number, v: NonNullable<SnapshotOptions['viewport']>): boolean {
  if (lat < v.south || lat > v.north) return false;
  return v.west <= v.east ? lon >= v.west && lon <= v.east : lon >= v.west || lon <= v.east;
}

/** Keep every in-view record first, then fill with the rest, up to the cap. */
function capRecords<T extends { lat: number; lon: number }>(
  items: readonly T[],
  max: number,
  viewport: SnapshotOptions['viewport'],
): { kept: T[]; viewportApplied: boolean } {
  if (items.length <= max) return { kept: items.slice(), viewportApplied: false };
  if (!viewport) return { kept: items.slice(0, max), viewportApplied: false };
  const inside: T[] = [];
  const outside: T[] = [];
  for (const item of items) (inView(item.lat, item.lon, viewport) ? inside : outside).push(item);
  return { kept: inside.concat(outside).slice(0, max), viewportApplied: true };
}

function validPoint(item: { lat?: unknown; lon?: unknown }): boolean {
  const lat = num(item.lat);
  const lon = num(item.lon);
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function buildAgentMapSnapshot(sources: AgentMapSources, options: SnapshotOptions = {}): AgentMapSnapshot {
  const nowMs = options.nowMs ?? Date.now();
  const max = Math.max(1, options.maxPerLayer ?? SNAPSHOT_MAX_PER_LAYER);
  const viewport = options.viewport ?? null;
  const enabled = options.enabledLayers;
  const isOn = (layerKey: string): boolean => (enabled ? enabled[layerKey] === true : true);

  const layers: AgentMapSnapshot['layers'] = {};
  let viewportFirst = false;

  const add = <T extends { lat: number; lon: number }>(
    key: string,
    items: readonly T[] | undefined,
    shape: (item: T) => AgentSnapshotLayer['records'][number],
    extra: (kept: readonly T[]) => Partial<AgentSnapshotLayer> = () => ({}),
  ): void => {
    if (!items || items.length === 0) return;
    const valid = items.filter(validPoint);
    if (valid.length === 0) return;
    const { kept, viewportApplied } = capRecords(valid, max, viewport);
    if (viewportApplied) viewportFirst = true;
    layers[key] = { records: kept.map(shape), total: valid.length, ...extra(valid) };
  };

  if (isOn('flights')) {
    add(
      'flights',
      sources.flights,
      (p) => ({
        id: p.icao24,
        callsign: (p.callsign || '').trim() || null,
        country: p.originCountry || null,
        freshness: p.freshness ?? null,
        lat: round(num(p.lat)),
        lon: round(num(p.lon)),
        altitude_ft: round(num(p.altitudeFt), 0),
        speed_kts: round(num(p.groundSpeedKts), 0),
        heading: round(num(p.trackDeg), 0),
        on_ground: Boolean(p.onGround),
      }),
      (all) => {
        const times = all.map((p) => dateMs(p.observedAt)).filter((t): t is number => t !== null);
        return {
          source: all.find((p) => p.provider)?.provider || all[0]?.source,
          ...(times.length ? { newestMs: Math.max(...times) } : {}),
          staleCount: all.filter((p) => p.freshness === 'stale').length,
        };
      },
    );
  }

  if (isOn('military')) {
    add(
      'military_flights',
      sources.militaryFlights,
      (f) => ({
        id: f.hexCode || f.id,
        callsign: (f.callsign || '').trim() || null,
        type: f.aircraftType ?? null,
        model: f.aircraftModel ?? null,
        operator: f.operator ?? null,
        country: f.operatorCountry ?? null,
        origin: f.origin ?? null,
        destination: f.destination ?? null,
        lat: round(num(f.lat)),
        lon: round(num(f.lon)),
        altitude_ft: round(num(f.altitude), 0),
        speed_kts: round(num(f.speed), 0),
        heading: round(num(f.heading), 0),
        on_ground: Boolean(f.onGround),
      }),
      (all) => {
        const times = all.map((f) => dateMs(f.lastSeen)).filter((t): t is number => t !== null);
        return times.length ? { newestMs: Math.max(...times) } : {};
      },
    );
    add(
      'military_vessels',
      sources.militaryVessels,
      (v) => ({
        id: v.mmsi || v.id,
        name: v.name || null,
        type: v.vesselType ?? null,
        operator: v.operator ?? null,
        country: v.operatorCountry ?? null,
        destination: v.destination ?? null,
        lat: round(num(v.lat)),
        lon: round(num(v.lon)),
        speed_kts: round(num(v.speed), 1),
        heading: round(num(v.heading), 0),
        ais_gap_min: round(num(v.aisGapMinutes), 0),
      }),
      (all) => {
        const times = all.map((v) => dateMs(v.lastAisUpdate)).filter((t): t is number => t !== null);
        return times.length ? { newestMs: Math.max(...times) } : {};
      },
    );
  }

  if (isOn('ais')) {
    add(
      'ships',
      sources.ships,
      (s) => {
        // AIS sentinels: heading 511, course 360, SOG 102.3 mean "not available".
        const speed = num(s.speed);
        const heading = num(s.heading);
        return {
          id: s.mmsi,
          name: s.name || null,
          lat: round(num(s.lat)),
          lon: round(num(s.lon)),
          speed_kts: speed !== null && speed < 102.3 ? round(speed, 1) : null,
          heading: heading !== null && heading >= 0 && heading < 360 ? round(heading, 0) : null,
          ship_type: round(num(s.shipType), 0),
        };
      },
      (all) => {
        const times = all.map((s) => dateMs(s.observedAt)).filter((t): t is number => t !== null);
        return { source: 'AISStream relay', ...(times.length ? { newestMs: Math.max(...times) } : {}) };
      },
    );
  }

  if (isOn('earthquakes')) {
    // The proto Earthquake nests its position under `location`; flatten it so
    // the shared cap/validate path can read lat/lon like every other layer.
    const flat = (sources.earthquakes ?? []).map((q) => ({
      q,
      lat: q.location?.latitude as number,
      lon: q.location?.longitude as number,
    }));
    add(
      'earthquakes',
      flat,
      ({ q, lat, lon }) => {
        const t = dateMs(q.occurredAt);
        return {
          id: q.id,
          place: q.place || null,
          lat: round(num(lat)),
          lon: round(num(lon)),
          magnitude: round(num(q.magnitude), 1),
          depth_km: round(num(q.depthKm), 1),
          age_hours: t === null ? null : round(Math.max(0, (nowMs - t) / MS_PER_HOUR), 1),
        };
      },
      (all) => {
        const times = all.map(({ q }) => dateMs(q.occurredAt)).filter((t): t is number => t !== null);
        return { source: 'USGS', ...(times.length ? { newestMs: Math.max(...times) } : {}) };
      },
    );
  }

  if (isOn('natural')) {
    add(
      'natural_events',
      sources.naturalEvents,
      (e) => {
        const t = dateMs(e.date);
        return {
          id: e.id,
          title: e.title,
          category: e.category ?? null,
          lat: round(num(e.lat)),
          lon: round(num(e.lon)),
          magnitude: round(num(e.magnitude), 1),
          age_hours: t === null ? null : round(Math.max(0, (nowMs - t) / MS_PER_HOUR), 1),
          closed: Boolean(e.closed),
        };
      },
      (all) => {
        const times = all.map((e) => dateMs(e.date)).filter((t): t is number => t !== null);
        return { source: 'EONET', ...(times.length ? { newestMs: Math.max(...times) } : {}) };
      },
    );
  }

  if (isOn('fires')) {
    add(
      'fires',
      sources.fires,
      (f) => ({
        region: f.region || null,
        daynight: f.daynight || null,
        lat: round(num(f.lat)),
        lon: round(num(f.lon)),
        frp: round(num(f.frp), 1),
        brightness: round(num(f.brightness), 1),
        confidence: round(num(f.confidence), 0),
      }),
      () => ({ source: 'NASA FIRMS' }),
    );
  }

  return { capturedAt: nowMs, viewportFirst, layers };
}
