import { createCircuitBreaker } from '@/utils';

export type MarketRiskStatus = 'ok' | 'partial' | 'unavailable';
export type MarketRiskLevel = 'low' | 'moderate' | 'elevated' | 'stressed' | 'unavailable';
export type MarketRiskBias = 'risk-on' | 'risk-off' | 'mixed' | 'neutral';

export interface VixSnapshot {
  symbol: 'VIX';
  source: 'CBOE';
  date: string;
  close: number;
  previousClose: number | null;
  change1d: number | null;
  changePct1d: number | null;
  average20d: number | null;
  level: Exclude<MarketRiskLevel, 'unavailable'>;
}

export interface CotPositioning {
  market: 'S&P 500' | 'Nasdaq 100' | 'Russell 2000' | 'VIX Futures';
  source: 'CFTC COT';
  reportDate: string;
  openInterest: number;
  dealerNet: number | null;
  assetManagerNet: number | null;
  leveragedMoneyNet: number | null;
  nonReportableNet: number | null;
  assetManagerNetPctOi: number | null;
  leveragedMoneyNetPctOi: number | null;
  bias: MarketRiskBias;
}

export interface CotSnapshot {
  source: 'CFTC COT';
  reportDate: string;
  markets: CotPositioning[];
  bias: MarketRiskBias;
}

export interface MarketRiskScore {
  value: number;
  level: Exclude<MarketRiskLevel, 'unavailable'>;
  label: string;
  drivers: string[];
}

export interface MarketRiskOverlaySnapshot {
  status: MarketRiskStatus;
  generatedAt: string;
  vix: VixSnapshot | null;
  cot: CotSnapshot | null;
  score: MarketRiskScore | null;
  sourceNotes: string[];
}

// External sources are CORS-blocked in browsers — route through the server-side proxy.
const CBOE_VIX_HISTORY_URL = '/api/market-risk?type=vix';
const CFTC_FINANCIAL_COT_URL = '/api/market-risk?type=cot';
const VIX_TIMEOUT_MS = 10_000;
// COT is weekly data; fail fast so it doesn't delay the panel on government-site slowness.
const COT_TIMEOUT_MS = 5_000;

const unavailableSnapshot = (): MarketRiskOverlaySnapshot => ({
  status: 'unavailable',
  generatedAt: new Date().toISOString(),
  vix: null,
  cot: null,
  score: null,
  sourceNotes: ['Market-risk sources unavailable.'],
});

const breaker = createCircuitBreaker<MarketRiskOverlaySnapshot>({
  name: 'Market Risk Overlays',
  cacheTtlMs: 15 * 60 * 1000,
  persistCache: true,
});

function finiteNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function fetchText(url: string, signal?: AbortSignal, timeoutMs = VIX_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/csv,text/plain,*/*' },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function parseVixDate(value: string): string {
  const [month, day, year] = value.split('/').map((part) => Number(part));
  if (!month || !day || !year) return value;
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function levelFromVix(close: number): Exclude<MarketRiskLevel, 'unavailable'> {
  if (close >= 30) return 'stressed';
  if (close >= 22) return 'elevated';
  if (close >= 15) return 'moderate';
  return 'low';
}

function levelFromScore(score: number): Exclude<MarketRiskLevel, 'unavailable'> {
  if (score >= 70) return 'stressed';
  if (score >= 50) return 'elevated';
  if (score >= 30) return 'moderate';
  return 'low';
}

function scoreLabel(level: Exclude<MarketRiskLevel, 'unavailable'>): string {
  switch (level) {
    case 'low': return 'Calm';
    case 'moderate': return 'Watch';
    case 'elevated': return 'Elevated';
    case 'stressed': return 'Stressed';
  }
}

async function fetchVixSnapshot(signal?: AbortSignal): Promise<VixSnapshot> {
  const text = await fetchText(CBOE_VIX_HISTORY_URL, signal);
  const rows = text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(','))
    .filter((cells) => cells.length >= 5);

  const parsed = rows
    .map((cells) => ({
      date: cells[0],
      close: finiteNumber(cells[4]),
    }))
    .filter((row): row is { date: string; close: number } => row.close != null);

  const latestIndex = parsed.length - 1;
  const latest = parsed[latestIndex];
  if (!latest) {
    throw new Error('CBOE VIX history contained no parseable closes');
  }

  const previous = latestIndex > 0 ? parsed[latestIndex - 1] ?? null : null;
  const trailing = parsed.slice(-20).map((row) => row.close);
  const average20d = trailing.length > 0
    ? trailing.reduce((sum, value) => sum + value, 0) / trailing.length
    : null;
  const change1d = previous ? latest.close - previous.close : null;

  return {
    symbol: 'VIX',
    source: 'CBOE',
    date: parseVixDate(latest.date),
    close: latest.close,
    previousClose: previous?.close ?? null,
    change1d,
    changePct1d: previous && previous.close !== 0 ? (change1d! / previous.close) * 100 : null,
    average20d,
    level: levelFromVix(latest.close),
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function classifyCotBias(market: CotPositioning['market'], leveragedPct: number | null): MarketRiskBias {
  if (leveragedPct == null) return 'neutral';
  const isVolMarket = market === 'VIX Futures';
  if (leveragedPct >= 10) return isVolMarket ? 'risk-off' : 'risk-on';
  if (leveragedPct <= -10) return isVolMarket ? 'risk-on' : 'risk-off';
  return 'neutral';
}

function combineBias(markets: CotPositioning[]): MarketRiskBias {
  const riskOn = markets.filter((market) => market.bias === 'risk-on').length;
  const riskOff = markets.filter((market) => market.bias === 'risk-off').length;
  if (riskOn > 0 && riskOff > 0) return 'mixed';
  if (riskOff > riskOn) return 'risk-off';
  if (riskOn > riskOff) return 'risk-on';
  return 'neutral';
}

function friendlyCotMarket(name: string): CotPositioning['market'] | null {
  if (name.includes('VIX FUTURES')) return 'VIX Futures';
  if (name.includes('E-MINI S&P 500')) return 'S&P 500';
  if (name.includes('NASDAQ MINI')) return 'Nasdaq 100';
  if (name.includes('RUSSELL E-MINI')) return 'Russell 2000';
  return null;
}

async function fetchCotSnapshot(signal?: AbortSignal): Promise<CotSnapshot> {
  const text = await fetchText(CFTC_FINANCIAL_COT_URL, signal, COT_TIMEOUT_MS);
  const seen = new Set<CotPositioning['market']>();
  const markets: CotPositioning[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const market = friendlyCotMarket(cells[0]?.toUpperCase() || '');
    if (!market || seen.has(market)) continue;

    const openInterest = finiteNumber(cells[7]) ?? 0;
    const dealerLong = finiteNumber(cells[8]);
    const dealerShort = finiteNumber(cells[9]);
    const assetLong = finiteNumber(cells[11]);
    const assetShort = finiteNumber(cells[12]);
    const leveragedLong = finiteNumber(cells[14]);
    const leveragedShort = finiteNumber(cells[15]);
    const nonReportableLong = finiteNumber(cells[22]);
    const nonReportableShort = finiteNumber(cells[23]);

    const dealerNet = dealerLong != null && dealerShort != null ? dealerLong - dealerShort : null;
    const assetManagerNet = assetLong != null && assetShort != null ? assetLong - assetShort : null;
    const leveragedMoneyNet = leveragedLong != null && leveragedShort != null ? leveragedLong - leveragedShort : null;
    const nonReportableNet = nonReportableLong != null && nonReportableShort != null
      ? nonReportableLong - nonReportableShort
      : null;
    const leveragedMoneyNetPctOi = pct(leveragedMoneyNet, openInterest);

    markets.push({
      market,
      source: 'CFTC COT',
      reportDate: cells[2] || '',
      openInterest,
      dealerNet,
      assetManagerNet,
      leveragedMoneyNet,
      nonReportableNet,
      assetManagerNetPctOi: pct(assetManagerNet, openInterest),
      leveragedMoneyNetPctOi,
      bias: classifyCotBias(market, leveragedMoneyNetPctOi),
    });
    seen.add(market);
  }

  const firstMarket = markets[0];
  if (!firstMarket) {
    throw new Error('CFTC COT report contained no target market rows');
  }

  return {
    source: 'CFTC COT',
    reportDate: firstMarket.reportDate,
    markets,
    bias: combineBias(markets),
  };
}

function buildScore(vix: VixSnapshot | null, cot: CotSnapshot | null): MarketRiskScore | null {
  if (!vix) return null;

  const drivers: string[] = [`VIX ${vix.close.toFixed(1)} (${vix.level})`];
  const vixScore = clamp(((vix.close - 12) / 28) * 100, 0, 100);
  let cotAdjustment = 0;

  if (cot) {
    if (cot.bias === 'risk-off') {
      cotAdjustment = 8;
      drivers.push('COT positioning risk-off');
    } else if (cot.bias === 'risk-on') {
      cotAdjustment = -6;
      drivers.push('COT positioning risk-on');
    } else if (cot.bias === 'mixed') {
      cotAdjustment = 3;
      drivers.push('COT positioning mixed');
    } else {
      drivers.push('COT positioning neutral');
    }
  }

  const value = Math.round(clamp(vixScore + cotAdjustment, 0, 100));
  const level = levelFromScore(value);
  return {
    value,
    level,
    label: scoreLabel(level),
    drivers,
  };
}

async function loadMarketRiskOverlay(signal?: AbortSignal): Promise<MarketRiskOverlaySnapshot> {
  const [vixResult, cotResult] = await Promise.allSettled([
    fetchVixSnapshot(signal),
    fetchCotSnapshot(signal),
  ]);

  const vix = vixResult.status === 'fulfilled' ? vixResult.value : null;
  const cot = cotResult.status === 'fulfilled' ? cotResult.value : null;
  // Source availability is already shown in the rendered source line ("· CFTC unavailable").
  // Only surface driver notes that add context beyond what the source line shows.
  const sourceNotes: string[] = [];

  if (!vix && !cot) {
    const reasons = [
      vixResult.status === 'rejected' ? `VIX: ${String(vixResult.reason)}` : '',
      cotResult.status === 'rejected' ? `COT: ${String(cotResult.reason)}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(reasons || 'Market-risk sources unavailable');
  }

  return {
    status: vix && cot ? 'ok' : 'partial',
    generatedAt: new Date().toISOString(),
    vix,
    cot,
    score: buildScore(vix, cot),
    sourceNotes,
  };
}

export async function fetchMarketRiskOverlay(signal?: AbortSignal): Promise<MarketRiskOverlaySnapshot> {
  return breaker.execute(() => loadMarketRiskOverlay(signal), unavailableSnapshot());
}
