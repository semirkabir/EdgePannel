export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted_close?: number;
}

export interface ListOhlcvRequest {
  symbol: string;
  start?: string;
  end?: string;
  limit?: number;
  preferApi?: boolean;
}

export interface ListOhlcvResponse {
  symbol: string;
  source: 'api' | 'sample';
  bars: OhlcvBar[];
}

export const BUNDLED_OHLCV_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'AMZN', 'TSLA', 'JPM', 'JNJ', 'XOM', 'V',
  'UNH', 'PG', 'SPY', 'QQQ', 'META', 'AMD', 'NFLX', 'DIS', 'KO', 'PEP',
  'WMT', 'HD', 'COST', 'BAC', 'GS', 'CVX', 'PFE', 'MRK', 'LLY', 'AVGO',
] as const;

export type BundledOhlcvSymbol = typeof BUNDLED_OHLCV_SYMBOLS[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBar(value: unknown): OhlcvBar | null {
  if (!isRecord(value) || typeof value.date !== 'string') return null;

  const open = toNumber(value.open);
  const high = toNumber(value.high);
  const low = toNumber(value.low);
  const close = toNumber(value.close);
  const volume = toNumber(value.volume);
  if (open === null || high === null || low === null || close === null || volume === null) return null;

  const adjustedClose = toNumber(value.adjusted_close);
  return {
    date: value.date,
    open,
    high,
    low,
    close,
    volume,
    ...(adjustedClose === null ? {} : { adjusted_close: adjustedClose }),
  };
}

function normalizeBars(value: unknown): OhlcvBar[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeBar).filter((bar): bar is OhlcvBar => bar !== null);
}

function filterBars(bars: OhlcvBar[], request: ListOhlcvRequest): OhlcvBar[] {
  const start = request.start ?? '';
  const end = request.end ?? '9999-12-31';
  const filtered = bars.filter((bar) => bar.date >= start && bar.date <= end);
  return typeof request.limit === 'number' && request.limit > 0
    ? filtered.slice(-request.limit)
    : filtered;
}

async function fetchApiBars(request: ListOhlcvRequest): Promise<OhlcvBar[] | null> {
  try {
    const response = await fetch('/api/market/v1/list-ohlcv', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        symbol: request.symbol.toUpperCase(),
        start: request.start,
        end: request.end,
        limit: request.limit,
      }),
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (Array.isArray(payload)) return normalizeBars(payload);
    if (isRecord(payload)) return normalizeBars(payload.bars);
    return null;
  } catch {
    return null;
  }
}

async function fetchSampleBars(symbol: string): Promise<OhlcvBar[]> {
  const response = await fetch(`/sample-ohlcv/${encodeURIComponent(symbol.toUpperCase())}.json`);
  if (!response.ok) {
    throw new Error(`No bundled OHLCV sample for ${symbol.toUpperCase()}`);
  }

  const payload: unknown = await response.json();
  if (Array.isArray(payload)) return normalizeBars(payload);
  if (isRecord(payload)) return normalizeBars(payload.bars);
  return [];
}

export async function listOhlcv(request: ListOhlcvRequest): Promise<ListOhlcvResponse> {
  const symbol = request.symbol.toUpperCase();

  if (request.preferApi !== false) {
    const apiBars = await fetchApiBars({ ...request, symbol });
    if (apiBars && apiBars.length > 0) {
      return { symbol, source: 'api', bars: filterBars(apiBars, request) };
    }
  }

  const sampleBars = await fetchSampleBars(symbol);
  return { symbol, source: 'sample', bars: filterBars(sampleBars, request) };
}

export async function listManyOhlcv(
  symbols: string[],
  request: Omit<ListOhlcvRequest, 'symbol'> = {},
): Promise<Record<string, ListOhlcvResponse>> {
  const entries = await Promise.all(
    symbols.map(async (symbol) => [symbol.toUpperCase(), await listOhlcv({ ...request, symbol })] as const),
  );
  return Object.fromEntries(entries);
}
