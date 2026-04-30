/**
 * T0.1 — Time-series client facade.
 *
 * All reads/writes go through this module so callers never need to know
 * whether data lives in Convex (intelligence/economic) or Redis Streams
 * (high-rate market data — future).
 *
 * Current backends:
 *   - Convex REST API  →  low-frequency series (CII, escalation, FRED, sentiment)
 *   - localStorage     →  offline fallback / last-seen cache
 *
 * Not in scope for T0.1 (deferred to T1.6 backtesting work):
 *   - Redis Streams for tick/OHLCV data
 *   - Bulk historical import
 */

const CONVEX_URL = (() => {
  try {
    // Vite injects VITE_CONVEX_URL at build time.
    // @ts-expect-error — Vite define
    return typeof VITE_CONVEX_URL !== 'undefined' ? VITE_CONVEX_URL : '';
  } catch {
    return '';
  }
})();

const ADMIN_TOKEN = (() => {
  try {
    // @ts-expect-error — Vite define
    return typeof VITE_CONVEX_ADMIN_TOKEN !== 'undefined' ? VITE_CONVEX_ADMIN_TOKEN : '';
  } catch {
    return '';
  }
})();

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  ts: number;
  value: number;
  meta?: string;
}

export interface TimeSeriesMeta {
  seriesId: string;
  domain: 'intelligence' | 'economic' | 'market' | 'sentiment' | 'risk';
  label: string;
  unit?: string;
  resolution: string;
}

// ── Convex transport helpers ───────────────────────────────────────────────────

async function convexQuery<T>(functionName: string, args: Record<string, unknown>): Promise<T | null> {
  if (!CONVEX_URL) return null;
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      },
      body: JSON.stringify({ path: functionName, args }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.value ?? data.result ?? null) as T;
  } catch {
    return null;
  }
}

async function convexMutation(functionName: string, args: Record<string, unknown>): Promise<boolean> {
  if (!CONVEX_URL) return false;
  try {
    const res = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      },
      body: JSON.stringify({ path: functionName, args }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── localStorage fallback cache ────────────────────────────────────────────────

const LS_PREFIX = 'wm-ts-';
const LS_MAX_POINTS = 500;

function lsKey(seriesId: string): string {
  return `${LS_PREFIX}${seriesId}`;
}

function lsRead(seriesId: string): TimeSeriesPoint[] {
  try {
    const raw = localStorage.getItem(lsKey(seriesId));
    return raw ? (JSON.parse(raw) as TimeSeriesPoint[]) : [];
  } catch {
    return [];
  }
}

function lsAppend(seriesId: string, points: TimeSeriesPoint[]): void {
  try {
    const existing = lsRead(seriesId);
    const merged = [...existing, ...points]
      .sort((a, b) => a.ts - b.ts)
      .slice(-LS_MAX_POINTS);
    localStorage.setItem(lsKey(seriesId), JSON.stringify(merged));
  } catch {
    // Quota exceeded — ignore.
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Register or update series metadata.
 * Call once on first ingest for a new series; idempotent.
 */
export async function ensureMeta(meta: TimeSeriesMeta): Promise<void> {
  await convexMutation('timeseries:upsertMeta', meta as unknown as Record<string, unknown>);
}

/**
 * Append a single point to a series.
 * Also persists to localStorage as a recent-data fallback.
 */
export async function appendPoint(seriesId: string, ts: number, value: number, metaBlob?: string): Promise<void> {
  const point: TimeSeriesPoint = { ts, value, ...(metaBlob ? { meta: metaBlob } : {}) };
  lsAppend(seriesId, [point]);
  await convexMutation('timeseries:appendPoint', { seriesId, ts, value, ...(metaBlob ? { meta: metaBlob } : {}) });
}

/**
 * Append multiple points for the same series.
 * Batches the Convex mutation for efficiency.
 */
export async function appendPoints(seriesId: string, points: TimeSeriesPoint[]): Promise<void> {
  if (points.length === 0) return;
  lsAppend(seriesId, points);
  // Convex mutations cap at ~8 MB body; split into 200-point batches.
  const BATCH = 200;
  for (let i = 0; i < points.length; i += BATCH) {
    await convexMutation('timeseries:appendPoints', {
      seriesId,
      points: points.slice(i, i + BATCH),
    });
  }
}

/**
 * Read a time range for a series.
 * Falls back to localStorage if Convex is unavailable.
 */
export async function readRange(
  seriesId: string,
  fromTs: number,
  toTs = Date.now(),
  limit = 1000,
): Promise<TimeSeriesPoint[]> {
  const remote = await convexQuery<TimeSeriesPoint[]>('timeseries:readRange', {
    seriesId,
    fromTs,
    toTs,
    limit,
  });
  if (remote && remote.length > 0) return remote;

  // Fallback: filter local cache.
  return lsRead(seriesId).filter((p) => p.ts >= fromTs && p.ts <= toTs).slice(-limit);
}

/**
 * Get the most-recent point for a series.
 */
export async function latestPoint(seriesId: string): Promise<TimeSeriesPoint | null> {
  const remote = await convexQuery<TimeSeriesPoint | null>('timeseries:latestPoint', { seriesId });
  if (remote) return remote;

  const local = lsRead(seriesId);
  return local.length > 0 ? local[local.length - 1] ?? null : null;
}

// ── Convenience helpers ────────────────────────────────────────────────────────

/**
 * Record a Country Instability Index score.
 * Automatically registers the meta on first call.
 */
export async function recordCiiScore(countryCode: string, score: number): Promise<void> {
  const seriesId = `cii:${countryCode.toLowerCase()}`;
  await appendPoint(seriesId, Date.now(), score);
}

/**
 * Record a hotspot escalation score.
 */
export async function recordEscalationScore(key: string, score: number): Promise<void> {
  const seriesId = `escalation:${key.toLowerCase()}`;
  await appendPoint(seriesId, Date.now(), score);
}

/**
 * Record a news sentiment score for an entity.
 * @param entityKey  e.g. "AAPL", "pakistan", "ukraine"
 * @param score      -1.0 to +1.0
 */
export async function recordSentimentScore(entityKey: string, score: number): Promise<void> {
  const seriesId = `sentiment:${entityKey.toLowerCase()}`;
  await appendPoint(seriesId, Date.now(), score);
}
