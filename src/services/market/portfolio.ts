/**
 * Portfolio data service — fetches congressional trades, institutional holdings,
 * and manages user portfolio positions.
 */

import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';

const client = new MarketServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

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

export interface QuarterlyBreakdown {
  quarter: string;
  buys: number;
  sells: number;
  estimatedBuyValue: number;
  estimatedSellValue: number;
  netEstimatedValue: number;
  topTicker: string;
}

export interface EstimatedTickerHolding {
  ticker: string;
  name: string;
  estimatedValue: number;
  buyCount: number;
  sellCount: number;
  lastTradeDate: string;
  percentage: number;
}

export interface SectorAllocation {
  sector: string;
  count: number;
  value: number;
  percentage: number;
}

export interface LargestTradeDelta {
  key: string;
  label: string;
  type: 'buy' | 'sell' | 'position';
  estimatedValue: number;
  percentage: number;
  count: number;
  date?: string;
  detail?: string;
}

export interface UserPosition {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  addedAt: string;
}

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

export async function fetchPoliticianTrades(politicianName: string): Promise<CongressTrade[]> {
  const response = await fetchCongressTrades();
  const normalized = politicianName.trim().toLowerCase();
  return response.trades.filter((trade) => trade.politician.trim().toLowerCase() === normalized);
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
    // Average cost basis
    const old = positions[existing]!;
    const totalShares = old.shares + position.shares;
    const totalCost = (old.shares * old.avgCost) + (position.shares * position.avgCost);
    positions[existing] = { ...old, shares: totalShares, avgCost: totalCost / totalShares };
  } else {
    positions.push({ ...position, addedAt: new Date().toISOString() });
  }
  saveUserPositions(positions);
}

export function removeUserPosition(symbol: string): void {
  const positions = getUserPositions().filter(p => p.symbol !== symbol);
  saveUserPositions(positions);
}

// ─── Visualizer Functions ────────────────────────────────────────────────────

export async function fetchHistoricalPrices(symbols: string[], months = 24): Promise<PriceSeries[]> {
  if (symbols.length === 0) return [];
  try {
    const resp = await client.listHistoricalPrices({ symbols, months });
    return resp.series;
  } catch {
    return [];
  }
}

export function computePortfolioPerformance(
  positions: UserPosition[],
  series: PriceSeries[],
): PerformanceResult {
  if (positions.length === 0 || series.length === 0) {
    return { dates: [], values: [], costBasis: 0, totalReturn: 0, cagr: 0, maxDrawdown: 0, sharpe: 0 };
  }

  const priceMap = new Map<string, Map<string, number>>();
  for (const s of series) {
    const dateMap = new Map<string, number>();
    for (const p of s.prices) dateMap.set(p.date, p.close);
    priceMap.set(s.symbol, dateMap);
  }

  const posMap = new Map<string, UserPosition>();
  let costBasis = 0;
  for (const pos of positions) {
    posMap.set(pos.symbol, pos);
    costBasis += pos.shares * pos.avgCost;
  }

  const allDates = new Set<string>();
  for (const s of series) {
    for (const p of s.prices) allDates.add(p.date);
  }
  const dates = [...allDates].sort();

  const values: number[] = [];
  const dailyReturns: number[] = [];

  for (const date of dates) {
    let portfolioValue = 0;
    for (const pos of positions) {
      const datePrice = priceMap.get(pos.symbol)?.get(date);
      if (datePrice != null) {
        portfolioValue += pos.shares * datePrice;
      }
    }
    values.push(portfolioValue);
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i - 1]! > 0) {
      dailyReturns.push((values[i]! - values[i - 1]!) / values[i - 1]!);
    }
  }

  const lastValue = values.length > 0 ? values[values.length - 1]! : 0;
  const totalReturn = costBasis > 0 ? ((lastValue - costBasis) / costBasis) * 100 : 0;

  const years = dates.length / 252;
  const cagr = costBasis > 0 && years > 0 && lastValue > 0
    ? (Math.pow(lastValue / costBasis, 1 / years) - 1) * 100
    : 0;

  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const drawdown = peak > 0 ? ((v - peak) / peak) * 100 : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }

  const avgReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 0;
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return { dates, values, costBasis, totalReturn, cagr, maxDrawdown, sharpe };
}

export function computeCorrelationMatrix(
  positions: UserPosition[],
  series: PriceSeries[],
): CorrelationMatrix {
  const symbols = positions.map(p => p.symbol);
  if (symbols.length < 2 || series.length < 2) {
    return { symbols, matrix: [], average: 0, maxPair: ['', '', 0], minPair: ['', '', 0] };
  }

  const priceMap = new Map<string, DailyPrice[]>();
  for (const s of series) priceMap.set(s.symbol, s.prices);

  const dailyReturns = new Map<string, number[]>();
  for (const symbol of symbols) {
    const prices = priceMap.get(symbol) || [];
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1]!.close > 0) {
        returns.push((prices[i]!.close - prices[i - 1]!.close) / prices[i - 1]!.close);
      }
    }
    dailyReturns.set(symbol, returns);
  }

  const minLen = Math.min(...[...dailyReturns.values()].map(r => r.length));
  if (minLen < 2) {
    return { symbols, matrix: [], average: 0, maxPair: ['', '', 0], minPair: ['', '', 0] };
  }

  const n = symbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  function pearson(x: number[], y: number[], len: number): number {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < len; i++) {
      sumX += x[i]!;
      sumY += y[i]!;
      sumXY += x[i]! * y[i]!;
      sumX2 += x[i]! * x[i]!;
      sumY2 += y[i]! * y[i]!;
    }
    const denom = Math.sqrt((len * sumX2 - sumX * sumX) * (len * sumY2 - sumY * sumY));
    return denom === 0 ? 0 : (len * sumXY - sumX * sumY) / denom;
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i]![j] = 1;
      } else {
        const xi = dailyReturns.get(symbols[i]!) || [];
        const yj = dailyReturns.get(symbols[j]!) || [];
        matrix[i]![j] = pearson(xi, yj, minLen);
      }
    }
  }

  let sum = 0, count = 0;
  let maxCorr = -2, minCorr = 2;
  let maxPair: [string, string, number] = ['', '', 0];
  let minPair: [string, string, number] = ['', '', 0];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = matrix[i]![j]!;
      sum += v;
      count++;
      if (v > maxCorr) { maxCorr = v; maxPair = [symbols[i]!, symbols[j]!, v]; }
      if (v < minCorr) { minCorr = v; minPair = [symbols[i]!, symbols[j]!, v]; }
    }
  }

  return {
    symbols,
    matrix,
    average: count > 0 ? sum / count : 0,
    maxPair,
    minPair,
  };
}

export function groupTradesByQuarter(trades: CongressTrade[]): QuarterlyBreakdown[] {
  const grouped = new Map<string, {
    buys: number;
    sells: number;
    estimatedBuyValue: number;
    estimatedSellValue: number;
    tickerTotals: Map<string, number>;
  }>();

  for (const trade of trades) {
    const quarter = toQuarterKey(trade.transactionDate || trade.disclosureDate);
    if (!quarter) continue;
    const entry = grouped.get(quarter) ?? {
      buys: 0,
      sells: 0,
      estimatedBuyValue: 0,
      estimatedSellValue: 0,
      tickerTotals: new Map<string, number>(),
    };
    const estimatedValue = estimateTradeValueFromRange(trade.amount);
    const direction = tradeDirection(trade.transactionType);

    if (direction > 0) {
      entry.buys += 1;
      entry.estimatedBuyValue += estimatedValue;
    } else if (direction < 0) {
      entry.sells += 1;
      entry.estimatedSellValue += estimatedValue;
    }

    if (trade.ticker) {
      const prior = entry.tickerTotals.get(trade.ticker) ?? 0;
      entry.tickerTotals.set(trade.ticker, prior + (estimatedValue * direction));
    }

    grouped.set(quarter, entry);
  }

  return Array.from(grouped.entries())
    .map(([quarter, entry]) => {
      let topTicker = '—';
      let topValue = -Infinity;
      for (const [ticker, value] of entry.tickerTotals.entries()) {
        if (Math.abs(value) > topValue) {
          topTicker = ticker;
          topValue = Math.abs(value);
        }
      }
      return {
        quarter,
        buys: entry.buys,
        sells: entry.sells,
        estimatedBuyValue: entry.estimatedBuyValue,
        estimatedSellValue: entry.estimatedSellValue,
        netEstimatedValue: entry.estimatedBuyValue - entry.estimatedSellValue,
        topTicker,
      };
    })
    .sort((a, b) => b.quarter.localeCompare(a.quarter));
}

export function estimateHoldingsFromTrades(trades: CongressTrade[]): EstimatedTickerHolding[] {
  const positions = new Map<string, {
    ticker: string;
    name: string;
    estimatedValue: number;
    buyCount: number;
    sellCount: number;
    lastTradeDate: string;
  }>();

  for (const trade of trades) {
    if (!trade.ticker) continue;
    const existing = positions.get(trade.ticker) ?? {
      ticker: trade.ticker,
      name: trade.assetDescription || trade.ticker,
      estimatedValue: 0,
      buyCount: 0,
      sellCount: 0,
      lastTradeDate: '',
    };
    const estimatedValue = estimateTradeValueFromRange(trade.amount);
    const direction = tradeDirection(trade.transactionType);

    existing.estimatedValue += estimatedValue * direction;
    if (direction > 0) existing.buyCount += 1;
    if (direction < 0) existing.sellCount += 1;
    if ((trade.transactionDate || '') > existing.lastTradeDate) {
      existing.lastTradeDate = trade.transactionDate || existing.lastTradeDate;
    }

    positions.set(trade.ticker, existing);
  }

  const active = Array.from(positions.values())
    .filter((position) => position.estimatedValue > 0)
    .sort((a, b) => b.estimatedValue - a.estimatedValue);

  const total = active.reduce((sum, position) => sum + position.estimatedValue, 0);
  return active.map((position) => ({
    ...position,
    percentage: total > 0 ? (position.estimatedValue / total) * 100 : 0,
  }));
}

export function computeInstitutionStructure(holdings: InstitutionalHolding[]): SectorAllocation[] {
  const grouped = new Map<string, { count: number; value: number }>();
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);

  for (const holding of holdings) {
    const sector = inferInstitutionSector(holding);
    const bucket = grouped.get(sector) ?? { count: 0, value: 0 };
    bucket.count += 1;
    bucket.value += holding.value;
    grouped.set(sector, bucket);
  }

  return Array.from(grouped.entries())
    .map(([sector, bucket]) => ({
      sector,
      count: bucket.count,
      value: bucket.value,
      percentage: totalValue > 0 ? (bucket.value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function computeLargestTradeDeltas(items: CongressTrade[] | InstitutionalHolding[]): LargestTradeDelta[] {
  if (items.length === 0) return [];

  const first = items[0]!;
  if (isCongressTrade(first)) {
    const holdings = estimateHoldingsFromTrades(items as CongressTrade[]);
    return holdings.map((holding) => ({
      key: holding.ticker,
      label: holding.ticker,
      type: holding.buyCount >= holding.sellCount ? 'buy' : 'sell',
      estimatedValue: holding.estimatedValue,
      percentage: holding.percentage,
      count: holding.buyCount + holding.sellCount,
      date: holding.lastTradeDate,
      detail: holding.name,
    }));
  }

  const holdings = items as InstitutionalHolding[];
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  return holdings
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)
    .map((holding) => ({
      key: holding.cusip || holding.issuer,
      label: holding.issuer,
      type: 'position',
      estimatedValue: holding.value,
      percentage: totalValue > 0 ? (holding.value / totalValue) * 100 : 0,
      count: holding.shares,
      detail: holding.title,
    }));
}

export function buildPortfolioInsights(input: {
  kind: 'politician' | 'institution';
  trades?: CongressTrade[];
  estimatedHoldings?: EstimatedTickerHolding[];
  quarterly?: QuarterlyBreakdown[];
  holdings?: InstitutionalHolding[];
  structure?: SectorAllocation[];
  totalValue?: number;
}): string[] {
  if (input.kind === 'politician') {
    const holdings = input.estimatedHoldings ?? [];
    const quarters = input.quarterly ?? [];
    const trades = input.trades ?? [];
    const insights: string[] = [];

    if (holdings[0]) {
      insights.push(`${holdings[0].ticker} is the largest estimated current exposure at ${holdings[0].percentage.toFixed(1)}% of net tracked holdings.`);
    }
    if (holdings.length >= 3) {
      const topThree = holdings.slice(0, 3).reduce((sum, holding) => sum + holding.percentage, 0);
      insights.push(`The top three tickers account for ${topThree.toFixed(1)}% of estimated net exposure, implying a concentrated book.`);
    }
    if (quarters[0]) {
      const direction = quarters[0].netEstimatedValue >= 0 ? 'net buying' : 'net selling';
      insights.push(`${quarters[0].quarter} shows the strongest recent ${direction} activity with about ${formatCurrencyCompact(Math.abs(quarters[0].netEstimatedValue))} of estimated net flow.`);
    }
    if (trades.length > 0) {
      const buyCount = trades.filter((trade) => tradeDirection(trade.transactionType) > 0).length;
      const sellCount = trades.filter((trade) => tradeDirection(trade.transactionType) < 0).length;
      const dominantSide = buyCount === sellCount ? 'balanced' : buyCount > sellCount ? 'buy-heavy' : 'sell-heavy';
      insights.push(`Disclosure activity is ${dominantSide}, with ${buyCount} buys and ${sellCount} sells in the tracked history.`);
    }
    return insights;
  }

  const structure = input.structure ?? [];
  const holdings = input.holdings ?? [];
  const totalValue = input.totalValue ?? holdings.reduce((sum, holding) => sum + holding.value, 0);
  const insights: string[] = [];

  if (structure[0]) {
    insights.push(`${structure[0].sector} is the largest inferred sleeve at ${structure[0].percentage.toFixed(1)}% of reported 13F portfolio value.`);
  }
  if (holdings[0] && totalValue > 0) {
    insights.push(`${holdings[0].issuer} is the largest reported position at ${((holdings[0].value / totalValue) * 100).toFixed(1)}% of filing value.`);
  }
  if (holdings.length > 0) {
    const topFiveValue = holdings.slice(0, 5).reduce((sum, holding) => sum + holding.value, 0);
    insights.push(`The top five disclosed positions represent ${totalValue > 0 ? ((topFiveValue / totalValue) * 100).toFixed(1) : '0.0'}% of visible 13F value, suggesting ${topFiveValue / Math.max(totalValue, 1) > 0.45 ? 'high' : 'moderate'} concentration.`);
  }
  insights.push('Current institution analytics are based on the latest available 13F filing and should not be treated as full adviser AUM or real-time exposure.');
  return insights;
}

function isCongressTrade(item: CongressTrade | InstitutionalHolding): item is CongressTrade {
  return 'politician' in item;
}

function tradeDirection(transactionType: string): number {
  const normalized = transactionType.toLowerCase();
  if (normalized.includes('purchase') || normalized.includes('buy')) return 1;
  if (normalized.includes('sale') || normalized.includes('sell')) return -1;
  return 0;
}

export function estimateTradeValueFromRange(amount: string): number {
  const normalized = amount.replace(/\$/g, '').replace(/,/g, '').trim();
  const parts = normalized.split('-').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) {
    const low = Number(parts[0]);
    const high = Number(parts[1]);
    if (Number.isFinite(low) && Number.isFinite(high)) return (low + high) / 2;
  }
  const numeric = Number(parts[0] ?? normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toQuarterKey(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()} Q${quarter}`;
}

function inferInstitutionSector(holding: InstitutionalHolding): string {
  const text = `${holding.issuer} ${holding.title}`.toLowerCase();

  const keywordSectors: Array<[string, string]> = [
    ['bank', 'Financials'],
    ['capital', 'Financials'],
    ['financial', 'Financials'],
    ['insurance', 'Financials'],
    ['energy', 'Energy'],
    ['petroleum', 'Energy'],
    ['oil', 'Energy'],
    ['gas', 'Energy'],
    ['pharma', 'Health Care'],
    ['therapeutics', 'Health Care'],
    ['health', 'Health Care'],
    ['medical', 'Health Care'],
    ['software', 'Technology'],
    ['semiconductor', 'Technology'],
    ['tech', 'Technology'],
    ['internet', 'Technology'],
    ['communications', 'Communication Services'],
    ['media', 'Communication Services'],
    ['retail', 'Consumer'],
    ['consumer', 'Consumer'],
    ['food', 'Consumer'],
    ['industrial', 'Industrials'],
    ['aerospace', 'Industrials'],
    ['rail', 'Industrials'],
    ['utility', 'Utilities'],
    ['water', 'Utilities'],
    ['reit', 'Real Estate'],
    ['property', 'Real Estate'],
    ['materials', 'Materials'],
    ['mining', 'Materials'],
  ];

  for (const [keyword, sector] of keywordSectors) {
    if (text.includes(keyword)) return sector;
  }

  const prefix = holding.cusip.slice(0, 2).toUpperCase();
  if (['02', '17', '45'].includes(prefix)) return 'Technology';
  if (['06', '10', '12'].includes(prefix)) return 'Financials';
  if (['20', '29', '30'].includes(prefix)) return 'Health Care';
  if (['36', '46', '68'].includes(prefix)) return 'Industrials';
  return 'Other';
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}
