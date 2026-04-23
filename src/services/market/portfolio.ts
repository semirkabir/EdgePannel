/**
 * Portfolio data service — fetches congressional trades, institutional holdings,
 * and manages user portfolio positions.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CongressTrade {
  politician: string;
  chamber: 'House' | 'Senate';
  ticker: string;
  assetDescription: string;
  transactionType: string;
  transactionDate: string;
  disclosureDate: string;
  amount: string;
  party: string;
  district: string;
  state: string;
}

export interface CongressTradesResponse {
  trades: CongressTrade[];
  updatedAt: string;
}

export interface InstitutionalHolding {
  issuer: string;
  title: string;
  cusip: string;
  value: number;
  shares: number;
}

export interface InstitutionalHoldingsResponse {
  name: string;
  cik: string;
  filingDate: string;
  holdings: InstitutionalHolding[];
  totalHoldings: number;
  totalValue: number;
}

export interface UserPosition {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  addedAt: string;
}

// ─── Ticker → Sector mapping ─────────────────────────────────────────────────

const TICKER_SECTOR: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  AMZN: 'Technology', META: 'Technology', NVDA: 'Technology', TSLA: 'Consumer',
  'BRK-B': 'Finance', 'BRK.B': 'Finance', JPM: 'Finance', V: 'Finance', MA: 'Finance',
  BAC: 'Finance', WFC: 'Finance', GS: 'Finance', MS: 'Finance', BLK: 'Finance',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SHEL: 'Energy', BP: 'Energy',
  JNJ: 'Healthcare', UNH: 'Healthcare', LLY: 'Healthcare', PFE: 'Healthcare',
  ABBV: 'Healthcare', MRK: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
  PG: 'Consumer', KO: 'Consumer', PEP: 'Consumer', COST: 'Consumer', WMT: 'Consumer',
  HD: 'Consumer', NKE: 'Consumer',
  LMT: 'Defense', RTX: 'Defense', NOC: 'Defense', BA: 'Defense', GD: 'Defense',
  INTC: 'Technology', AMD: 'Technology', AVGO: 'Technology', ORCL: 'Technology',
  CRM: 'Technology', ADBE: 'Technology', NFLX: 'Technology', DIS: 'Consumer',
  CMCSA: 'Technology', T: 'Technology', VZ: 'Technology',
  QCOM: 'Technology', TXN: 'Technology', MU: 'Technology',
  SPY: 'Index', QQQ: 'Index', IWM: 'Index', DIA: 'Index',
  XLK: 'Index', XLF: 'Index', XLE: 'Index', XLV: 'Index',
};

export function getTickerSector(ticker: string): string {
  return TICKER_SECTOR[ticker] || 'Other';
}

// ─── Sector Colors ────────────────────────────────────────────────────────────

export const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3b82f6',
  Finance: '#10b981',
  Healthcare: '#ef4444',
  Energy: '#f59e0b',
  Consumer: '#8b5cf6',
  Defense: '#6366f1',
  Materials: '#f97316',
  Index: '#64748b',
  Other: '#94a3b8',
};

// ─── Visualizer Types ────────────────────────────────────────────────────────

export interface DailyPrice {
  date: string;
  close: number;
  volume: string;
}

export interface PriceSeries {
  symbol: string;
  prices: DailyPrice[];
}

export interface PerformanceResult {
  dates: string[];
  values: number[];
  costBasis: number;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpe: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  average: number;
  maxPair: [string, string, number];
  minPair: [string, string, number];
}

// ─── Congress Additional Types ────────────────────────────────────────────────────────

export interface QuarterlyBreakdown {
  quarter: string;
  trades: CongressTrade[];
  totalBuys: number;
  totalSells: number;
  buys: number;
  sells: number;
  netFlow: number;
}

export interface EstimatedTickerHolding {
  ticker: string;
  name: string;
  shares: number;
  value: number;
  change: number;
  changePct: number;
  percentage: number;
  estimatedValue: number;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  pct: number;
  percentage: number;
}

export interface LargestTradeDelta {
  ticker: string;
  label: string;
  detail: string;
  delta: number;
  deltaPct: number;
  percentage: number;
  estimatedValue: number;
  direction: 'buy' | 'sell';
  trade: CongressTrade | InstitutionalHolding;
}

export type PortfolioInsightInput =
  | {
      kind: 'politician';
      trades: CongressTrade[];
      estimatedHoldings: EstimatedTickerHolding[];
      quarterly: QuarterlyBreakdown[];
    }
  | {
      kind: 'institution';
      holdings: InstitutionalHolding[];
      structure: SectorAllocation[];
      totalValue: number;
    }
  | {
      kind: 'user';
      positions: UserPosition[];
      performance: PerformanceResult;
    };

// ─── Notable institutional investors (13F filers) ─────────────────────────────

export interface NotableInvestor {
  name: string;
  cik: string;
  description: string;
}

export const NOTABLE_INVESTORS: NotableInvestor[] = [
  { name: 'Berkshire Hathaway', cik: '1067983', description: 'Warren Buffett' },
  { name: 'Bridgewater Associates', cik: '1350694', description: 'Ray Dalio' },
  { name: 'Citadel Advisors', cik: '1423053', description: 'Ken Griffin' },
  { name: 'Renaissance Technologies', cik: '1037389', description: 'Jim Simons' },
  { name: 'Soros Fund Management', cik: '1029160', description: 'George Soros' },
  { name: 'Pershing Square', cik: '1336528', description: 'Bill Ackman' },
  { name: 'Appaloosa Management', cik: '1656456', description: 'David Tepper' },
  { name: 'Tiger Global', cik: '1167483', description: 'Chase Coleman' },
  { name: 'Third Point', cik: '1040273', description: 'Dan Loeb' },
  { name: 'Elliott Management', cik: '1048445', description: 'Paul Singer' },
  { name: 'Two Sigma Investments', cik: '1179392', description: 'David Siegel' },
  { name: 'Millennium Management', cik: '1273087', description: 'Israel Englander' },
  { name: 'Point72 Asset Management', cik: '1603466', description: 'Steve Cohen' },
  { name: 'D.E. Shaw', cik: '1009207', description: 'David Shaw' },
  { name: 'ARK Investment Management', cik: '1579982', description: 'Cathie Wood' },
  { name: 'Icahn Capital', cik: '921669', description: 'Carl Icahn' },
];

// ─── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchCongressTrades(): Promise<CongressTradesResponse> {
  const url = new URL('/api/portfolio-data', window.location.origin);
  url.searchParams.set('source', 'congress-trades');
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function fetchInstitutionalHoldings(cik: string): Promise<InstitutionalHoldingsResponse> {
  const url = new URL('/api/portfolio-data', window.location.origin);
  url.searchParams.set('source', '13f-holdings');
  url.searchParams.set('cik', cik);
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json() as Omit<InstitutionalHoldingsResponse, 'totalValue'> & { totalValue?: number };
  const holdings = data.holdings ?? [];
  return {
    ...data,
    holdings,
    totalHoldings: data.totalHoldings ?? holdings.length,
    totalValue: data.totalValue ?? holdings.reduce((sum, holding) => sum + holding.value, 0),
  };
}

// ─── User Portfolio (localStorage) ────────────────────────────────────────────

const STORAGE_KEY = 'wm-portfolio-v1';

export function getUserPositions(): UserPosition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserPositions(positions: UserPosition[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  document.dispatchEvent(new CustomEvent('wm-portfolio-changed'));
}

export function addUserPosition(position: Omit<UserPosition, 'addedAt'>): void {
  const positions = getUserPositions();
  const existing = positions.findIndex(p => p.symbol === position.symbol);
  if (existing >= 0) {
    const old = positions[existing]!;
    const totalShares = old.shares + position.shares;
    const totalCost = (old.shares * old.avgCost) + (position.shares * position.avgCost);
    positions[existing] = { ...old, shares: totalShares, avgCost: totalCost / totalShares };
  } else {
    positions.push({ ...position, addedAt: new Date().toISOString() });
  }
  saveUserPositions(positions);
}

export function editUserPosition(symbol: string, updates: Partial<Pick<UserPosition, 'shares' | 'avgCost' | 'name'>>): void {
  const positions = getUserPositions();
  const idx = positions.findIndex(p => p.symbol === symbol);
  if (idx < 0) return;
  positions[idx] = { ...positions[idx]!, ...updates };
  saveUserPositions(positions);
}

export function removeUserPosition(symbol: string): void {
  const positions = getUserPositions().filter(p => p.symbol !== symbol);
  saveUserPositions(positions);
}

// ─── SVG Helpers ──────────────────────────────────────────────────────────────

export function sparklineSvg(data: number[], change: number | null, w = 80, h = 24): string {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const color = change != null && change >= 0 ? '#22c55e' : '#ef4444';
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="pf-sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function donutSvg(segments: { label: string; value: number; color: string }[], size = 120, thickness = 14): string {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return '';
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const paths: string[] = [];
  const labels: string[] = [];

  for (const seg of segments) {
    const pct = seg.value / total;
    const dashLen = pct * circumference;
    const gapLen = circumference - dashLen;
    paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${thickness}" stroke-dasharray="${dashLen.toFixed(2)} ${gapLen.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="round"/>`);
    offset += dashLen;
    if (pct >= 0.04) {
      const midAngle = (offset - dashLen / 2) / circumference * 2 * Math.PI - Math.PI / 2;
      const lx = cx + (r * 0.72) * Math.cos(midAngle);
      const ly = cy + (r * 0.72) * Math.sin(midAngle);
      labels.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="var(--text)" font-size="9" font-weight="600">${Math.round(pct * 100)}%</text>`);
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="pf-donut">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${thickness}" opacity="0.3"/>
    ${paths.join('\n')}
    ${labels.join('\n')}
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="var(--text)" font-size="14" font-weight="700">$${total >= 1e6 ? (total / 1e6).toFixed(1) + 'M' : total >= 1e3 ? (total / 1e3).toFixed(0) + 'K' : total.toFixed(0)}</text>
  </svg>`;
}

// ─── Congress Sort State ───────────────────────────────────────────────────────

export type CongressSortField = 'date' | 'politician' | 'ticker' | 'type' | 'amount';
export type SortDir = 'asc' | 'desc';

export function sortCongressTrades(trades: CongressTrade[], field: CongressSortField, dir: SortDir): CongressTrade[] {
  const sorted = [...trades];
  const mul = dir === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    switch (field) {
      case 'date': return mul * (a.transactionDate < b.transactionDate ? -1 : a.transactionDate > b.transactionDate ? 1 : 0);
      case 'politician': return mul * a.politician.localeCompare(b.politician);
      case 'ticker': return mul * a.ticker.localeCompare(b.ticker);
      case 'type': return mul * a.transactionType.localeCompare(b.transactionType);
      case 'amount': return mul * parseAmount(a.amount) - parseAmount(b.amount);
      default: return 0;
    }
  });
  return sorted;
}

function parseAmount(amount: string): number {
  const cleaned = amount.replace(/[$,\s]/g, '');
  if (cleaned.includes('Over')) {
    const parts = cleaned.split('Over');
    return parseFloat(parts[1] || '0') * 1e6;
  }
  const m = cleaned.match(/([\d.]+)\s*-\s*([\d.]+)\s*(K|M|B)?/i);
  if (!m) return 0;
  const lo = parseFloat(m[1] ?? '0');
  const hi = parseFloat(m[2] ?? '0');
  const scale = /B/i.test(m[3] ?? '') ? 1e9 : /M/i.test(m[3] ?? '') ? 1e6 : /K/i.test(m[3] ?? '') ? 1e3 : 1;
  return ((lo + hi) / 2) * scale;
}

// ─── Additional Fetchers / Visualizer Functions ─────────────────────────────────

export async function fetchPoliticianTrades(politicianName: string): Promise<CongressTrade[]> {
  const resp = await fetchCongressTrades();
  return resp.trades.filter(t => t.politician === politicianName);
}

import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
const grpcClient = new MarketServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

export async function fetchHistoricalPrices(symbols: string[], months = 24): Promise<PriceSeries[]> {
  if (symbols.length === 0) return [];
  try {
    const resp = await grpcClient.listHistoricalPrices({ symbols, months });
    return resp.series;
  } catch { return []; }
}

export function computePortfolioPerformance(positions: UserPosition[], series: PriceSeries[]): PerformanceResult {
  if (positions.length === 0 || series.length === 0) return { dates: [], values: [], costBasis: 0, totalReturn: 0, cagr: 0, maxDrawdown: 0, sharpe: 0 };

  const priceMap = new Map<string, Map<string, number>>();
  for (const s of series) { const dateMap = new Map<string, number>(); for (const p of s.prices) dateMap.set(p.date, p.close); priceMap.set(s.symbol, dateMap); }

  const posMap = new Map<string, UserPosition>(); let costBasis = 0;
  for (const pos of positions) { posMap.set(pos.symbol, pos); costBasis += pos.shares * pos.avgCost; }

  const allDates = new Set<string>();
  for (const s of series) { for (const p of s.prices) allDates.add(p.date); }
  const dates = [...allDates].sort();

  const values: number[] = [];
  for (const date of dates) { let portfolioValue = 0; for (const pos of positions) { const pm = priceMap.get(pos.symbol); if (pm) portfolioValue += (pm.get(date) || 0) * pos.shares; } values.push(portfolioValue); }

  if (values.length === 0) return { dates, values, costBasis, totalReturn: 0, cagr: 0, maxDrawdown: 0, sharpe: 0 };

  const totalReturn = (values[values.length - 1] ?? 0) - costBasis;
  const cagr = 0; // Simplified - would need date range to compute properly
  let maxDrawdown = 0; let peak = values[0] ?? 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return { dates, values, costBasis, totalReturn, cagr, maxDrawdown, sharpe: 0 };
}

export function computeCorrelationMatrix(symbols: string[], series: PriceSeries[]): CorrelationMatrix {
  const symbolsLength = symbols.length;
  const matrix: number[][] = [];
  const priceData: Map<string, number[]> = new Map();

  for (const sym of symbols) { const s = series.find(x => x.symbol === sym); if (s) priceData.set(sym, s.prices.map(p => p.close)); else priceData.set(sym, []); }

  for (let i = 0; i < symbolsLength; i++) {
    const row: number[] = [];
    for (let j = 0; j < symbolsLength; j++) row[j] = i === j ? 1 : 0;
    matrix[i] = row;
  }

  let avg = 0; let maxPair: [string, string, number] = ['', '', -1]; let minPair: [string, string, number] = ['', '', 1];

  return { symbols, matrix, average: avg, maxPair, minPair };
}

export function groupTradesByQuarter(trades: CongressTrade[]): QuarterlyBreakdown[] {
  const quarterMap = new Map<string, CongressTrade[]>();
  for (const t of trades) { const q = t.transactionDate.slice(0, 7); if (!quarterMap.has(q)) quarterMap.set(q, []); quarterMap.get(q)!.push(t); }
  const result: QuarterlyBreakdown[] = [];
  for (const [quarter, qtrTrades] of quarterMap) {
    let totalBuys = 0, totalSells = 0;
    for (const t of qtrTrades) {
      if (t.transactionType.toLowerCase().includes('purchase')) totalBuys++;
      else if (t.transactionType.toLowerCase().includes('sale')) totalSells++;
    }
    result.push({
      quarter,
      trades: qtrTrades,
      totalBuys,
      totalSells,
      buys: totalBuys,
      sells: totalSells,
      netFlow: totalBuys - totalSells,
    });
  }
  return result.sort((a, b) => a.quarter.localeCompare(b.quarter));
}

export function estimateHoldingsFromTrades(trades: CongressTrade[]): EstimatedTickerHolding[] {
  const holdingMap = new Map<string, { name: string; shares: number; grossValue: number; netValue: number; change: number }>();
  for (const t of trades) {
    if (!t.ticker) continue;
    const existing = holdingMap.get(t.ticker) || {
      name: t.assetDescription || t.ticker,
      shares: 0,
      grossValue: 0,
      netValue: 0,
      change: 0,
    };
    const estimatedValue = estimateTradeValueFromRange(t.amount);
    const isSale = t.transactionType.toLowerCase().includes('sale');
    const direction = isSale ? -1 : 1;
    existing.name = existing.name || t.assetDescription || t.ticker;
    existing.shares += direction * 1000;
    existing.grossValue += estimatedValue;
    existing.netValue += direction * estimatedValue;
    existing.change += direction;
    holdingMap.set(t.ticker, existing);
  }

  const rows = Array.from(holdingMap.entries()).map(([ticker, h]) => {
    const value = Math.abs(h.netValue) > 0 ? Math.abs(h.netValue) : h.grossValue;
    return {
      ticker,
      name: h.name,
      shares: Math.abs(h.shares),
      value,
      change: h.change,
      changePct: h.grossValue > 0 ? (h.netValue / h.grossValue) * 100 : 0,
      percentage: 0,
      estimatedValue: value,
    };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  for (const row of rows) row.percentage = totalValue > 0 ? (row.value / totalValue) * 100 : 0;
  return rows.sort((a, b) => b.value - a.value);
}

export function computeInstitutionStructure(holdings: InstitutionalHolding[]): SectorAllocation[] {
  const sectorMap = new Map<string, number>(); const total = holdings.reduce((s, h) => s + h.value, 0);
  for (const h of holdings) { const sector = getTickerSector(h.issuer); sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.value); }
  return Array.from(sectorMap.entries()).map(([sector, value]) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return { sector, value, pct: percentage, percentage };
  }).sort((a, b) => b.value - a.value);
}

export function computeLargestTradeDeltas(items: (CongressTrade | InstitutionalHolding)[]): LargestTradeDelta[] {
  const total = items.reduce((sum, item) => {
    if ('value' in item) return sum + item.value;
    return sum + estimateTradeValueFromRange(item.amount);
  }, 0);

  return items
    .map((item): LargestTradeDelta => {
      if ('value' in item) {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        return {
          ticker: item.cusip || item.issuer,
          label: item.issuer,
          detail: item.title,
          delta: item.value,
          deltaPct: percentage,
          percentage,
          estimatedValue: item.value,
          direction: 'buy',
          trade: item,
        };
      }

      const estimatedValue = estimateTradeValueFromRange(item.amount);
      const isSale = item.transactionType.toLowerCase().includes('sale');
      const percentage = total > 0 ? (estimatedValue / total) * 100 : 0;
      return {
        ticker: item.ticker,
        label: item.ticker || item.assetDescription,
        detail: `${item.transactionType} · ${item.politician}`,
        delta: isSale ? -estimatedValue : estimatedValue,
        deltaPct: percentage,
        percentage,
        estimatedValue,
        direction: isSale ? 'sell' : 'buy',
        trade: item,
      };
    })
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 10);
}

export function buildPortfolioInsights(input: PortfolioInsightInput): string[] {
  if (input.kind === 'politician') {
    const insights: string[] = [];
    const tradeCount = input.trades.length;
    const topHolding = input.estimatedHoldings[0];
    const activeQuarter = [...input.quarterly].sort((a, b) => b.trades.length - a.trades.length)[0];
    insights.push(`${tradeCount} disclosed transaction${tradeCount === 1 ? '' : 's'} are included in this estimate.`);
    if (topHolding) insights.push(`${topHolding.ticker} is the largest estimated exposure at ${topHolding.percentage.toFixed(1)}% of mapped activity.`);
    if (activeQuarter) insights.push(`${activeQuarter.quarter} was the most active period with ${activeQuarter.trades.length} trade${activeQuarter.trades.length === 1 ? '' : 's'}.`);
    return insights;
  }

  if (input.kind === 'institution') {
    const insights: string[] = [];
    const topSector = input.structure[0];
    const topHolding = input.holdings[0];
    insights.push(`${input.holdings.length} disclosed 13F position${input.holdings.length === 1 ? '' : 's'} total ${formatPortfolioCurrency(input.totalValue)}.`);
    if (topHolding && input.totalValue > 0) {
      insights.push(`${topHolding.issuer} is the largest disclosed position at ${((topHolding.value / input.totalValue) * 100).toFixed(1)}% of reported value.`);
    }
    if (topSector) insights.push(`${topSector.sector} is the largest inferred sector allocation at ${topSector.percentage.toFixed(1)}%.`);
    return insights;
  }

  const insights: string[] = [];
  insights.push(`${input.positions.length} saved position${input.positions.length === 1 ? '' : 's'} in the user portfolio.`);
  if (input.performance.values.length > 1) {
    insights.push(`Estimated total return is ${formatPortfolioCurrency(input.performance.totalReturn)} with ${(input.performance.maxDrawdown * 100).toFixed(1)}% max drawdown.`);
  }
  return insights;
}

export function estimateTradeValueFromRange(amount: string): number {
  const cleaned = amount.replace(/[$,\s]/g, '');
  if (cleaned.includes('Over')) { const parts = cleaned.split('Over'); return parseFloat(parts[1] || '0') * 1e6; }
  const m = cleaned.match(/([\d.]+)\s*-\s*([\d.]+)\s*(K|M|B)?/i);
  if (!m) return 0;
  const lo = parseFloat(m[1] ?? '0'); const hi = parseFloat(m[2] ?? '0'); const scale = /B/i.test(m[3] ?? '') ? 1e9 : /M/i.test(m[3] ?? '') ? 1e6 : /K/i.test(m[3] ?? '') ? 1e3 : 1;
  return ((lo + hi) / 2) * scale;
}

function formatPortfolioCurrency(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}
