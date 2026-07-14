/**
 * Strait of Hormuz ship-transit tracker.
 *
 * The app has LIVE AIS vessel positions but no persisted transit history, so
 * this module accumulates its own: on every AIS batch it counts distinct moving
 * vessels inside the Hormuz shipping corridor, buckets them by hour, and
 * persists the hourly counts to localStorage (rolling 7 days). Consumers get a
 * live count, a windowed total with a delta vs the prior window, and bar-chart
 * series for 6h / 24h / 7d timeframes.
 *
 * "Transit" is approximated as a distinct vessel (by MMSI) seen moving
 * (speed >= MIN_TRANSIT_SPEED_KN) inside the corridor bbox during an hour —
 * this excludes anchored/loitering ships and roughly tracks throughput.
 */
import {
  registerAisCallback,
  unregisterAisCallback,
  isAisConfigured,
  type AisPositionData,
} from '@/services/maritime';
import { log } from '@/utils/logger';

// Tight bbox around the Strait of Hormuz transit corridor.
const HORMUZ_BBOX = { minLat: 25.6, maxLat: 27.0, minLon: 55.7, maxLon: 57.0 };
const MIN_TRANSIT_SPEED_KN = 2; // exclude anchored / drifting vessels
const VESSEL_STALE_MS = 2 * 60 * 60 * 1000; // drop positions older than 2h
const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 7 * 24 * HOUR_MS; // keep 7 days of hourly buckets
const STORAGE_KEY = 'wm-hormuz-transits-v1';
const PERSIST_THROTTLE_MS = 15 * 1000;

export type HormuzTimeframe = '6h' | '24h' | '7d';

export interface TransitBar {
  /** Short axis label, e.g. "14:00" or "Mon". */
  label: string;
  /** Distinct transiting vessels in this bucket. */
  value: number;
  /** ISO timestamp of the bucket start (for tooltips). */
  iso: string;
}

export interface TransitStats {
  /** Vessels moving through the corridor right now. */
  live: number;
  /** Sum of transits across the selected timeframe. */
  windowTotal: number;
  /** Percent change vs the immediately-preceding equal window (null if no baseline). */
  deltaPct: number | null;
  bars: TransitBar[];
  /** Whether the AIS relay is configured at all. */
  configured: boolean;
  /** How many hourly buckets we have collected (for the "accruing" hint). */
  bucketsCollected: number;
  /** Whether any live vessel data has been received this session. */
  hasLiveData: boolean;
}

type Subscriber = () => void;

// ---- Module state ----
const vessels = new Map<string, { lat: number; lon: number; ts: number }>();
const counts = new Map<number, number>(); // hourStartMs -> distinct transiting vessels
const sessionSets = new Map<number, Set<string>>(); // hourStartMs -> mmsi seen this session
const subscribers = new Set<Subscriber>();
let live = 0;
let hasLiveData = false;
let started = false;
let lastPersistAt = 0;
let callback: ((batch: AisPositionData[]) => void) | null = null;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function hourStart(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

function inCorridor(v: AisPositionData): boolean {
  return (
    v.lat >= HORMUZ_BBOX.minLat &&
    v.lat <= HORMUZ_BBOX.maxLat &&
    v.lon >= HORMUZ_BBOX.minLon &&
    v.lon <= HORMUZ_BBOX.maxLon
  );
}

function loadPersisted(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { v?: number; counts?: [number, number][] };
    if (!parsed?.counts) return;
    const cutoff = Date.now() - RETENTION_MS;
    for (const [hs, c] of parsed.counts) {
      if (typeof hs === 'number' && typeof c === 'number' && hs >= cutoff) {
        counts.set(hs, c);
      }
    }
  } catch {
    /* corrupt or unavailable storage — start fresh */
  }
}

function persist(force = false): void {
  const now = Date.now();
  if (!force && now - lastPersistAt < PERSIST_THROTTLE_MS) return;
  lastPersistAt = now;
  try {
    const payload = { v: 1, counts: Array.from(counts.entries()) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

function prune(now: number): void {
  const cutoff = now - RETENTION_MS;
  for (const hs of counts.keys()) if (hs < cutoff) counts.delete(hs);
  for (const hs of sessionSets.keys()) if (hs < cutoff) sessionSets.delete(hs);
  for (const [mmsi, v] of vessels) if (v.ts < now - VESSEL_STALE_MS) vessels.delete(mmsi);
}

function onBatch(batch: AisPositionData[]): void {
  const now = Date.now();
  for (const v of batch) {
    if (!v.mmsi || !Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
    if (!inCorridor(v)) {
      vessels.delete(v.mmsi); // left the corridor
      continue;
    }
    // Only moving vessels count as transiting.
    if (typeof v.speed === 'number' && v.speed < MIN_TRANSIT_SPEED_KN) {
      vessels.delete(v.mmsi);
      continue;
    }
    vessels.set(v.mmsi, { lat: v.lat, lon: v.lon, ts: now });
  }

  prune(now);
  hasLiveData = true;

  // Live = fresh, in-corridor, moving vessels right now.
  live = vessels.size;

  // Accumulate distinct MMSIs seen this hour.
  const hs = hourStart(now);
  let set = sessionSets.get(hs);
  if (!set) {
    set = new Set<string>();
    sessionSets.set(hs, set);
  }
  for (const mmsi of vessels.keys()) set.add(mmsi);
  // Never shrink a count already persisted from an earlier session this hour.
  counts.set(hs, Math.max(counts.get(hs) ?? 0, set.size));

  persist();
  notify();
}

function notify(): void {
  for (const cb of subscribers) {
    try {
      cb();
    } catch (e) {
      log.debug('[hormuz-transits] subscriber error', e);
    }
  }
}

/** Begin tracking (idempotent). Registering the callback also starts AIS polling. */
export function startHormuzTransits(): void {
  if (started) return;
  started = true;
  loadPersisted();
  callback = onBatch;
  registerAisCallback(callback);
  log.debug('[hormuz-transits] started');
}

/** Stop tracking and release the AIS callback. */
export function stopHormuzTransits(): void {
  if (!started) return;
  started = false;
  if (callback) {
    unregisterAisCallback(callback);
    callback = null;
  }
  persist(true);
}

export function subscribeHormuzTransits(cb: Subscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** Build bar-chart + headline stats for the requested timeframe. */
export function getTransitStats(timeframe: HormuzTimeframe): TransitStats {
  const now = Date.now();
  const bars: TransitBar[] = [];

  const bucketValue = (hs: number): number => counts.get(hs) ?? 0;

  let windowTotal = 0;
  let priorTotal = 0;

  if (timeframe === '7d') {
    // Aggregate hourly counts into the last 7 local days.
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const dayMs = 24 * HOUR_MS;
    const dayTotal = (dayStart: number): number => {
      let sum = 0;
      for (let h = 0; h < 24; h++) sum += bucketValue(dayStart + h * HOUR_MS);
      return sum;
    };
    for (let d = 6; d >= 0; d--) {
      const dayStart = startOfToday.getTime() - d * dayMs;
      const value = dayTotal(dayStart);
      windowTotal += value;
      bars.push({
        label: new Date(dayStart).toLocaleDateString(undefined, { weekday: 'short' }),
        value,
        iso: new Date(dayStart).toISOString(),
      });
    }
    for (let d = 13; d >= 7; d--) priorTotal += dayTotal(startOfToday.getTime() - d * dayMs);
  } else {
    const hours = timeframe === '6h' ? 6 : 24;
    const nowHour = hourStart(now);
    for (let h = hours - 1; h >= 0; h--) {
      const hs = nowHour - h * HOUR_MS;
      const value = bucketValue(hs);
      windowTotal += value;
      bars.push({
        label: `${pad(new Date(hs).getHours())}:00`,
        value,
        iso: new Date(hs).toISOString(),
      });
    }
    for (let h = 2 * hours - 1; h >= hours; h--) priorTotal += bucketValue(nowHour - h * HOUR_MS);
  }

  const deltaPct = priorTotal > 0 ? ((windowTotal - priorTotal) / priorTotal) * 100 : null;

  return {
    live,
    windowTotal,
    deltaPct,
    bars,
    configured: isAisConfigured(),
    bucketsCollected: counts.size,
    hasLiveData,
  };
}
