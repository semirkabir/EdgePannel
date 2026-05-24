/**
 * ohlcv.ts
 *
 * OHLCV (Open/High/Low/Close/Volume) service.
 *
 * Priority chain:
 *   1. /api/market/v1/ohlcv endpoint (when available — future backend)
 *   2. /sample-ohlcv/<SYMBOL>.json  (bundled static JSON, always available)
 *
 * The bundled sample files cover the 30 demo/reference tickers used by
 * the Backtesting and Portfolio surfaces in v1.  Consumers outside those
 * 30 tickers will receive an empty array and should surface a clear
 * "data not available" state rather than crashing.
 */

export interface OHLCVBar {
  /** YYYY-MM-DD */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Adjusted close (split/dividend adjusted). Falls back to close if not provided. */
  adjClose?: number;
}

export interface OHLCVResult {
  symbol: string;
  bars: OHLCVBar[];
  source: 'api' | 'sample';
}

// ─── Bundled sample ticker list ───────────────────────────────────────────────

/** Tickers covered by public/sample-ohlcv/<SYMBOL>.json */
export const SAMPLE_OHLCV_TICKERS: readonly string[] = [
  // Demo portfolio (12)
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'JNJ', 'V', 'UNH', 'BRK.B',
  // Broad market reference (6)
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'GLD',
  // Additional reference tickers (12)
  'NFLX', 'AMD', 'INTC', 'CRM', 'ADBE', 'PYPL', 'SQ', 'SHOP', 'COIN', 'PLTR', 'HOOD', 'RBLX',
];

// ─── In-memory cache (avoids re-fetching the same file repeatedly) ────────────

const barCache = new Map<string, OHLCVBar[]>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a YYYY-MM-DD string range for filtering. */
function inRange(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

type RawBarRecord = {
  date?: string;
  t?: string;          // some providers use 't' for timestamp
  open?: number; o?: number;
  high?: number; h?: number;
  low?: number;  l?: number;
  close?: number; c?: number;
  volume?: number; v?: number;
  adjClose?: number; ac?: number;
};

function normalizeBar(raw: RawBarRecord): OHLCVBar | null {
  const date = raw.date ?? raw.t ?? '';
  const open  = raw.open  ?? raw.o;
  const high  = raw.high  ?? raw.h;
  const low   = raw.low   ?? raw.l;
  const close = raw.close ?? raw.c;
  const volume = raw.volume ?? raw.v ?? 0;
  if (!date || open == null || high == null || low == null || close == null) return null;
  return {
    date,
    open,
    high,
    low,
    close,
    volume,
    adjClose: raw.adjClose ?? raw.ac ?? close,
  };
}

/** Fetch and parse the bundled sample JSON for a symbol. */
async function fetchSampleBars(symbol: string): Promise<OHLCVBar[]> {
  const cached = barCache.get(symbol);
  if (cached) return cached;

  try {
    const resp = await fetch(`/sample-ohlcv/${encodeURIComponent(symbol)}.json`);
    if (!resp.ok) return [];
    const raw = await resp.json() as unknown;
    // Accept two shapes: raw array of bars, or { bars: [...] }
    const arr: RawBarRecord[] = Array.isArray(raw)
      ? (raw as RawBarRecord[])
      : ((raw as { bars?: RawBarRecord[] }).bars ?? []);
    const bars = arr.map(normalizeBar).filter((b): b is OHLCVBar => b !== null);
    barCache.set(symbol, bars);
    return bars;
  } catch {
    return [];
  }
}

/** Try the backend /api/market/v1/ohlcv endpoint first. */
async function fetchApiBars(
  symbol: string,
  from?: string,
  to?: string,
  resolution?: string,
): Promise<OHLCVBar[] | null> {
  try {
    const url = new URL('/api/market/v1/ohlcv', window.location.origin);
    url.searchParams.set('symbol', symbol);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    if (resolution) url.searchParams.set('resolution', resolution);

    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json() as unknown;
    const arr: RawBarRecord[] = Array.isArray(data)
      ? (data as RawBarRecord[])
      : ((data as { bars?: RawBarRecord[] }).bars ?? []);
    if (arr.length === 0) return null;
    return arr.map(normalizeBar).filter((b): b is OHLCVBar => b !== null);
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FetchOHLCVOptions {
  /** ISO date string YYYY-MM-DD — inclusive lower bound */
  from?: string;
  /** ISO date string YYYY-MM-DD — inclusive upper bound. Defaults to today. */
  to?: string;
  /**
   * Bar resolution passed to the API when available.
   * Not used for the bundled sample files (always daily).
   * Examples: 'D', 'W', '60', '15'
   */
  resolution?: string;
}

/**
 * Fetch daily OHLCV bars for a symbol.
 *
 * Always resolves — returns an empty array when data is unavailable
 * rather than rejecting, so callers can render a clean empty state.
 */
export async function fetchOHLCV(
  symbol: string,
  opts: FetchOHLCVOptions = {},
): Promise<OHLCVResult> {
  const { from, to, resolution } = opts;

  // 1. Try live API
  const apiBars = await fetchApiBars(symbol, from, to, resolution);
  if (apiBars && apiBars.length > 0) {
    return { symbol, bars: apiBars, source: 'api' };
  }

  // 2. Fall back to bundled sample
  const allBars = await fetchSampleBars(symbol);
  const filtered = from || to
    ? allBars.filter((b) => inRange(b.date, from, to))
    : allBars;

  return { symbol, bars: filtered, source: 'sample' };
}

/**
 * Fetch OHLCV for multiple symbols in parallel.
 * Returns a Map<symbol, OHLCVResult>.
 */
export async function fetchMultiOHLCV(
  symbols: string[],
  opts: FetchOHLCVOptions = {},
): Promise<Map<string, OHLCVResult>> {
  const results = await Promise.all(symbols.map((s) => fetchOHLCV(s, opts)));
  const map = new Map<string, OHLCVResult>();
  for (const result of results) {
    map.set(result.symbol, result);
  }
  return map;
}

/**
 * Returns true if bundled sample data is available for this symbol.
 * Use to gate UI elements that require historical data.
 */
export function hasSampleData(symbol: string): boolean {
  return SAMPLE_OHLCV_TICKERS.includes(symbol.toUpperCase());
}

/**
 * Invalidate the in-memory bar cache for a symbol (or all symbols).
 * Useful after a fresh API fetch lands new data.
 */
export function invalidateOHLCVCache(symbol?: string): void {
  if (symbol) {
    barCache.delete(symbol);
  } else {
    barCache.clear();
  }
}

// ─── Compatibility API (used by portfolio-service, workflow-executor, etc.) ───

/** Lowercase alias for `OHLCVBar` — matches the naming convention used by the
 *  service layer (backtesting-types, algo.worker, etc.). */
export type OhlcvBar = OHLCVBar;

/** Single-symbol fetch. Compatible with `listOhlcv({ symbol, limit?, preferApi? })` call pattern.
 *  `start`/`end` are accepted as aliases for `from`/`to`. */
export async function listOhlcv(opts: {
  symbol: string;
  limit?: number;
  /** When false, skip the API attempt and go straight to bundled sample. */
  preferApi?: boolean;
  from?: string;
  to?: string;
  /** Alias for `from` */
  start?: string;
  /** Alias for `to` */
  end?: string;
}): Promise<OHLCVResult> {
  const { symbol, limit, preferApi = true } = opts;
  const from = opts.from ?? opts.start;
  const to = opts.to ?? opts.end;
  if (!preferApi) {
    const bars = await fetchSampleBars(symbol);
    const filtered = (from || to) ? bars.filter((b) => inRange(b.date, from, to)) : bars;
    const sliced = limit ? filtered.slice(-limit) : filtered;
    return { symbol, bars: sliced, source: 'sample' };
  }
  const result = await fetchOHLCV(symbol, { from, to });
  return limit ? { ...result, bars: result.bars.slice(-limit) } : result;
}

/** Multi-symbol fetch returning a plain `Record<symbol, OHLCVResult>`. */
export async function listManyOhlcv(
  symbols: string[],
  opts: { limit?: number; preferApi?: boolean; from?: string; to?: string; start?: string; end?: string } = {},
): Promise<Record<string, OHLCVResult>> {
  const entries = await Promise.all(
    symbols.map(async (symbol) => [symbol, await listOhlcv({ symbol, ...opts })] as const),
  );
  return Object.fromEntries(entries);
}

// ─── Return calculation utilities ─────────────────────────────────────────────

/** Compute daily returns array (arithmetic) from a bar series. */
export function dailyReturns(bars: OHLCVBar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]!.adjClose ?? bars[i - 1]!.close;
    const curr = bars[i]!.adjClose ?? bars[i]!.close;
    out.push(prev !== 0 ? (curr - prev) / prev : 0);
  }
  return out;
}

/** Cumulative return from first to last bar. */
export function totalReturn(bars: OHLCVBar[]): number {
  if (bars.length < 2) return 0;
  const first = bars[0]!.adjClose ?? bars[0]!.close;
  const last  = bars[bars.length - 1]!.adjClose ?? bars[bars.length - 1]!.close;
  return first !== 0 ? (last - first) / first : 0;
}

/** Annualised volatility from daily returns (√252). */
export function annualisedVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252);
}
