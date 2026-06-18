/**
 * Live ADS-B aircraft streaming service.
 *
 * Mirrors the AIS streaming architecture in `maritime/index.ts`:
 *  - `registerAircraftCallback` / `unregisterAircraftCallback` pub/sub
 *  - `startSmartPollLoop` hitting the `trackAircraft` RPC with the current viewport bbox
 *  - Dedup by `icao24`, batch-emit `PositionSample[]`
 *  - Freshness tracking via `getAircraftFreshness(icao24)` for UI stale/live indicators
 *  - Viewport bounds control via `setAircraftViewportBounds(bbox)`
 *
 * The display `PositionSample` type is owned by `./index`. Codex's Phase 2
 * enriches that type with provenance fields; this stream automatically benefits
 * because it reuses `fetchAircraftPositions` (which performs proto→display
 * normalisation).
 */

import { dataFreshness } from '../data-freshness';
import { isFeatureAvailable } from '../runtime-config';
import { startSmartPollLoop, type SmartPollLoopHandle } from '../runtime';
import { fetchAircraftPositions, filterRenderableAircraftPositions, type PositionSample } from './index';

// ---- Feature Gating ----

const isClientRuntime = typeof window !== 'undefined';
const liveConfigured = isClientRuntime && import.meta.env.VITE_ENABLE_AIRCRAFT_LIVE !== 'false';

export function isAircraftLiveConfigured(): boolean {
  return liveConfigured && isFeatureAvailable('openskyRelay');
}

// ---- Freshness ----

export type AircraftFreshnessStatus = 'live' | 'stale' | 'unknown';

export interface AircraftFreshness {
  lastContactMs: number;
  status: AircraftFreshnessStatus;
  isStale: boolean;
}

const FRESHNESS_LIVE_MS = 2 * 60 * 1000;
const FRESHNESS_STALE_MS = 10 * 60 * 1000;

// ---- Viewport Bounds ----

export interface AircraftViewportBounds {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}

// ---- Callback System ----

type AircraftCallback = (data: PositionSample[]) => void;
const positionCallbacks = new Set<AircraftCallback>();
const lastContactByIcao = new Map<string, number>();

// ---- Polling State ----

let pollLoop: SmartPollLoopHandle | null = null;
let inFlight = false;
let isPolling = false;
let lastPollAt = 0;
let latestStatus = { connected: false, aircraft: 0 };

let viewportBounds: AircraftViewportBounds | null = null;

// ---- Constants ----

const POLL_INTERVAL_MS = 60 * 1000;
const STALE_MS = 90 * 1000;
const CALLBACK_RETENTION_MS = 2 * 60 * 60 * 1000;
const MAX_TRACKED_AIRCRAFT = 10000;

// ---- Helpers ----

function shouldFetch(): boolean {
  return positionCallbacks.size > 0;
}

function pruneContactIndex(now: number): void {
  if (lastContactByIcao.size <= MAX_TRACKED_AIRCRAFT) return;

  const threshold = now - CALLBACK_RETENTION_MS;
  for (const [icao, ts] of lastContactByIcao) {
    if (ts < threshold) lastContactByIcao.delete(icao);
  }

  if (lastContactByIcao.size <= MAX_TRACKED_AIRCRAFT) return;

  const oldest = Array.from(lastContactByIcao.entries()).sort((a, b) => a[1] - b[1]);
  const toDelete = lastContactByIcao.size - MAX_TRACKED_AIRCRAFT;
  for (let i = 0; i < toDelete; i++) {
    const entry = oldest[i];
    if (!entry) break;
    lastContactByIcao.delete(entry[0]);
  }
}

function emitPositions(positions: PositionSample[]): void {
  if (positionCallbacks.size === 0 || positions.length === 0) return;
  const now = Date.now();

  for (const pos of positions) {
    if (!pos?.icao24) continue;
    const ts = pos.observedAt instanceof Date ? pos.observedAt.getTime() : now;
    lastContactByIcao.set(pos.icao24, ts);
  }

  for (const callback of positionCallbacks) {
    try {
      callback(positions);
    } catch {
      // Ignore callback errors
    }
  }

  pruneContactIndex(now);
}

// ---- Polling ----

async function pollPositions(force = false): Promise<void> {
  if (!isAircraftLiveConfigured()) return;
  if (inFlight && !force) return;

  inFlight = true;
  try {
    const bounds = viewportBounds;
    const positions = await fetchAircraftPositions({
      swLat: bounds?.swLat,
      swLon: bounds?.swLon,
      neLat: bounds?.neLat,
      neLon: bounds?.neLon,
    });

    const filtered = filterRenderableAircraftPositions(positions);
    lastPollAt = Date.now();
    latestStatus = { connected: true, aircraft: filtered.length };

    if (shouldFetch()) {
      emitPositions(filtered);
    }

    dataFreshness.recordUpdate('aircraft_live', filtered.length);
  } catch {
    latestStatus.connected = false;
    dataFreshness.recordError('aircraft_live', 'Live aircraft poll failed');
  } finally {
    inFlight = false;
  }
}

function startPolling(): void {
  if (isPolling || !isAircraftLiveConfigured()) return;
  isPolling = true;
  void pollPositions(true);
  pollLoop?.stop();
  pollLoop = startSmartPollLoop(() => pollPositions(false), {
    intervalMs: POLL_INTERVAL_MS,
    pauseWhenHidden: true,
    refreshOnVisible: true,
    runImmediately: false,
    shouldRun: shouldFetch,
  });
}

// ---- Exported Functions ----

export function registerAircraftCallback(callback: AircraftCallback): void {
  positionCallbacks.add(callback);
  if (isPolling && !inFlight) {
    void pollPositions(true);
  }
  startPolling();
}

export function unregisterAircraftCallback(callback: AircraftCallback): void {
  positionCallbacks.delete(callback);
  if (positionCallbacks.size === 0) {
    lastContactByIcao.clear();
  }
}

export function setAircraftViewportBounds(bounds: AircraftViewportBounds | null): void {
  viewportBounds = bounds;
  if (isPolling && !inFlight && shouldFetch()) {
    void pollPositions(true);
  }
}

export function getAircraftViewportBounds(): AircraftViewportBounds | null {
  return viewportBounds;
}

export function getAircraftFreshness(icao24: string): AircraftFreshness {
  const lastMs = lastContactByIcao.get(icao24);
  if (!lastMs) return { lastContactMs: 0, status: 'unknown', isStale: true };

  const age = Date.now() - lastMs;
  if (age <= FRESHNESS_LIVE_MS) return { lastContactMs: lastMs, status: 'live', isStale: false };
  if (age <= FRESHNESS_STALE_MS) return { lastContactMs: lastMs, status: 'stale', isStale: true };
  return { lastContactMs: lastMs, status: 'stale', isStale: true };
}

export function getAircraftLiveStatus(): { connected: boolean; aircraft: number } {
  const isFresh = Date.now() - lastPollAt <= STALE_MS;
  return {
    connected: latestStatus.connected && isFresh,
    aircraft: latestStatus.aircraft,
  };
}

export function getAircraftLiveCount(): number {
  return positionCallbacks.size > 0 ? latestStatus.aircraft : 0;
}

export function initAircraftLiveStream(): void {
  startPolling();
}

export function disconnectAircraftLiveStream(): void {
  pollLoop?.stop();
  pollLoop = null;
  isPolling = false;
  inFlight = false;
  latestStatus = { connected: false, aircraft: 0 };
}

/**
 * Convert a centre point + radius (km) to a bounding box.
 * Used by the AviationCommandBar `AREA` intent.
 */
export function radiusToBounds(lat: number, lon: number, radiusKm: number): AircraftViewportBounds {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return {
    swLat: lat - latDelta,
    neLat: lat + latDelta,
    swLon: lon - lonDelta,
    neLon: lon + lonDelta,
  };
}
