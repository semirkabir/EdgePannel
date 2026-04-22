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
  volume: number;
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
}

export interface LargestTradeDelta {
  ticker: string;
  delta: number;
  deltaPct: number;
  direction: 'buy' | 'sell';
  trade: CongressTrade | InstitutionalHolding;
}

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
  return resp.json();
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

  const totalReturn = values[values.length - 1] - costBasis;
  const cagr = 0; // Simplified - would need date range to compute properly
  let maxDrawdown = 0; let peak = values[0];
  for (const v of values) { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > maxDrawdown) maxDrawdown = dd; }

  return { dates, values, costBasis, totalReturn, cagr, maxDrawdown, sharpe: 0 };
}

export function computeCorrelationMatrix(symbols: string[], series: PriceSeries[]): CorrelationMatrix {
  const symbolsLength = symbols.length;
  const matrix: number[][] = [];
  const priceData: Map<string, number[]> = new Map();

  for (const sym of symbols) { const s = series.find(x => x.symbol === sym); if (s) priceData.set(sym, s.prices.map(p => p.close)); else priceData.set(sym, []); }

  for (let i = 0; i < symbolsLength; i++) { matrix[i] = []; for (let j = 0; j < symbolsLength; j++) { matrix[i][j] = i === j ? 1 : 0; } }

  let avg = 0; let maxPair: [string, string, number] = ['', '', -1]; let minPair: [string, string, number] = ['', '', 1];

  return { symbols, matrix, average: avg, maxPair, minPair };
}

export function groupTradesByQuarter(trades: CongressTrade[]): QuarterlyBreakdown[] {
  const quarterMap = new Map<string, CongressTrade[]>();
  for (const t of trades) { const q = t.transactionDate.slice(0, 7); if (!quarterMap.has(q)) quarterMap.set(q, []); quarterMap.get(q)!.push(t); }
  const result: QuarterlyBreakdown[] = [];
  for (const [quarter, qtrTrades] of quarterMap) { let totalBuys = 0, totalSells = 0; for (const t of qtrTrades) { if (t.transactionType.toLowerCase().includes('purchase')) totalBuys++; else if (t.transactionType.toLowerCase().includes('sale')) totalSells++; } result.push({ quarter, trades: qtrTrades, totalBuys, totalSells, netFlow: totalBuys - totalSells }); }
  return result.sort((a, b) => a.quarter.localeCompare(b.quarter));
}

export function estimateHoldingsFromTrades(trades: CongressTrade[]): EstimatedTickerHolding[] {
  const holdingMap = new Map<string, { shares: number; value: number; change: number }>();
  for (const t of trades) { const existing = holdingMap.get(t.ticker) || { shares: 0, value: 0, change: 0 }; if (t.transactionType.toLowerCase().includes('purchase')) { existing.shares += 1000; existing.change += 1; } else { existing.shares -= 1000; existing.change -= 1; } holdingMap.set(t.ticker, existing); }
  return Array.from(holdingMap.entries()).map(([ticker, h]) => ({ ticker, shares: Math.abs(h.shares), value: Math.abs(h.value), change: h.change, changePct: 0 })).sort((a, b) => b.value - a.value);
}

export function computeInstitutionStructure(holdings: InstitutionalHolding[]): SectorAllocation[] {
  const sectorMap = new Map<string, number>(); const total = holdings.reduce((s, h) => s + h.value, 0);
  for (const h of holdings) { const sector = getTickerSector(h.issuer); sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.value); }
  return Array.from(sectorMap.entries()).map(([sector, value]) => ({ sector, value, pct: total > 0 ? (value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);
}

export function computeLargestTradeDeltas(items: (CongressTrade | InstitutionalHolding)[]): LargestTradeDelta[] {
  return [];
}

export function buildPortfolioInsights(input: { kind: string; positions: UserPosition[]; performance: PerformanceResult }): string[] {
  return [];
}

export function estimateTradeValueFromRange(amount: string): number {
  const cleaned = amount.replace(/[$,\s]/g, '');
  if (cleaned.includes('Over')) { const parts = cleaned.split('Over'); return parseFloat(parts[1] || '0') * 1e6; }
  const m = cleaned.match(/([\d.]+)\s*-\s*([\d.]+)\s*(K|M|B)?/i);
  if (!m) return 0;
  const lo = parseFloat(m[1] ?? '0'); const hi = parseFloat(m[2] ?? '0'); const scale = /B/i.test(m[3] ?? '') ? 1e9 : /M/i.test(m[3] ?? '') ? 1e6 : /K/i.test(m[3] ?? '') ? 1e3 : 1;
  return ((lo + hi) / 2) * scale;
}