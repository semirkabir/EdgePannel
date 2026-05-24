import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import type { MarketQuote, PriceSeries, SecFiling } from '@/generated/client/worldmonitor/market/v1/service_client';
import { ColorType, createChart, type AreaData, type CandlestickData, type Time, type UTCTimestamp } from 'lightweight-charts';
import { row } from '../types';
import type { EntityRenderer, EntityRenderContext } from '../types';
import { sanitizeUrl } from '@/utils/sanitize';
import { applyArticleLinkDataset } from '@/services/article-open';
import {
  fetchCompanyProfile,
  fetchCompanyMetrics,
  fetchCompanyPeers,
  fetchCompanyNews,
  fetchPriceTarget,
  fetchRecommendationTrends,
  fetchInsiderTransactions,
  fetchOptionChain,
  fetchEarningsSurprises,
  fetchFinancialsReported,
  fetchEpsEstimates,
  fetchRevenueEstimates,
  fetchStockDividends,
  fetchRevenueBreakdown,
  fetchUpgradeDowngrade,
  fetchStockQuote,
  fetchYahooQuote,
  fetchStockSplits,
  fetchUpcomingEarnings,
  type StockQuote,
  type CompanyProfile,
  type CompanyMetrics,
  type CompanyNewsItem,
  type PriceTarget,
  type RecommendationTrend,
  type InsiderTransaction,
  type OptionChainExpiry,
  type EarningsSurprise,
  type EstimateSeries,
  type StockDividend,
  type StockSplit,
  type RevenueBreakdown,
  type UpgradeDowngradeAction,
  type FinancialReport,
  type EarningsEvent,
} from '@/services/market/finnhub-extra';
import {
  fetchCompanyInstitutionHolders13F,
  type CompanyInstitutionHolder,
} from '@/services/market/normalized-13f';
import { fetchFundOwnership, type InstitutionalHolder } from '@/services/market/finnhub-extra';
import {
  buildFinancialRows,
  getLatestFinancialValue,
  normalizeFinancialReports,
  ratio,
  type FinancialDisplayRow,
  type FinancialFormatType,
  type FinancialFrequency,
  type FinancialMetricKey,
  type FinancialStatementKind,
  type NormalizedFinancialPeriod,
} from '@/services/market/company-financials';
import {
  fetchEarningsCallTranscripts,
  fetchEarningsCallTranscriptDetail,
  type EarningsCallTranscript,
} from '@/services/market/earnings-transcripts';
import {
  fetchSecCompanyFacts,
  type SecCompanyFacts,
  type SecCompanyFactMetric,
  type SecCompanyFactSignal,
} from '@/services/market/sec-company-facts';

interface CompanyData {
  ticker: string;
  name: string;
}

interface CompanyEnriched {
  ticker: string;
  name: string;
  quote: MarketQuote | null;
  historicalPrices: PriceSeries | null;
  filings: SecFiling[];
  companyName: string;
  profile: CompanyProfile | null;
  metrics: CompanyMetrics | null;
  peers: string[];
  news: CompanyNewsItem[];
  priceTarget: PriceTarget | null;
  recommendations: RecommendationTrend[];
  insiderTxns: InsiderTransaction[];
  optionChain: OptionChainExpiry[];
  ownership: CompanyInstitutionHolder[];
  etfHoldings: InstitutionalHolder[];
  earningsSurprises: EarningsSurprise[];
  financialsAnnual: NormalizedFinancialPeriod[];
  financialsQuarterly: NormalizedFinancialPeriod[];
  epsEstimates: EstimateSeries;
  revenueEstimates: EstimateSeries;
  dividends: StockDividend[];
  revenueBreakdown: RevenueBreakdown | null;
  ratingActions: UpgradeDowngradeAction[];
  earningsCalls: EarningsCallTranscript[];
  secFacts: SecCompanyFacts | null;
  finnhubQuote: StockQuote | null;
  yahooQuote: StockQuote | null;
  stockSplits: StockSplit[];
  upcomingEarnings: EarningsEvent | null;
  epsEstimatesAnnual: EstimateSeries;
  revenueEstimatesAnnual: EstimateSeries;
}

type EvKind = EarningsCallTranscript['kind'] | 'dividend' | 'split' | 'upcoming';

interface EvCard {
  key: string;
  kind: EvKind;
  title: string;
  quarter: string;
  date: string;
  year: number;
  isAnnual: boolean;
  epsActual: number | null;
  epsEstimate: number | null;
  epsSurprisePct: number | null;
  transcriptRef?: EarningsCallTranscript;
  indexUrl: string;
  amount?: number;
  splitRatio?: string;
  isUpcoming?: boolean;
  hour?: string;
}

const client = new MarketServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

const TABS = ['overview', 'financials', 'valuation', 'estimates', 'forecasts', 'news', 'events', 'options', 'insiders', 'holders', 'filings'] as const;
type TabId = typeof TABS[number];

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  financials: 'Financials',
  valuation: 'Valuation',
  estimates: 'Estimates',
  forecasts: 'Forecasts',
  news: 'News',
  events: 'Events',
  options: 'Options',
  insiders: 'Insiders',
  holders: 'Holders',
  filings: 'Filings',
};

const FILING_TYPE_CLASS: Record<string, string> = {
  '10-K': 'edp-sec-type-badge edp-sec-type-annual',
  '10-Q': 'edp-sec-type-badge edp-sec-type-quarterly',
  '8-K': 'edp-sec-type-badge edp-sec-type-current',
};

const CHART_RANGES = [
  { id: '1H', bars: 48 },
  { id: '1D', bars: 60 },
  { id: '1W', bars: 52 },
  { id: '1M', bars: 24 },
] as const;
type ChartRange = typeof CHART_RANGES[number]['id'];
type ChartKind = 'area' | 'candles';
type HistoricalClose = { date: string; close: number };

function fmtChange(change: number): string {
  return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
}

function fmtPrice(price: number): string {
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}

function fmtLargeNumber(value: number): string {
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

function fmtFinancialValue(value: number | null | undefined, currency = '$'): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}${currency}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${currency}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${currency}${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fmtPlainNumber(value: number | null | undefined, suffix = ''): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 }) + suffix;
}

function fmtFinnhubMarketCap(value: number): string {
  return fmtLargeNumber(value * 1_000_000);
}

function fmtShares(value: number): string {
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return value.toFixed(0);
}

function fmtMetric(value: number | undefined, suffix = ''): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return value.toFixed(2) + suffix;
}

function fmtPercent(value: number | undefined): string {
  return fmtMetric(value, '%');
}

function rangePointCount(range: ChartRange): number {
  const option = CHART_RANGES.find(item => item.id === range);
  return option?.bars ?? 60;
}

function isoDateNDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function unixTimeMinutesAgo(minutesAgo: number): UTCTimestamp {
  return Math.floor((Date.now() - minutesAgo * 60 * 1000) / 1000) as UTCTimestamp;
}

function isoDateNMonthsAgo(monthsAgo: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo, 1);
  return date.toISOString().slice(0, 10);
}

function rangeTimeForIndex(range: ChartRange, total: number, index: number): Time {
  const remaining = total - 1 - index;
  if (range === '1H') return unixTimeMinutesAgo(remaining * 60);
  if (range === '1D') return isoDateNDaysAgo(remaining);
  if (range === '1W') return isoDateNDaysAgo(remaining * 7);
  return isoDateNMonthsAgo(remaining);
}

function getHistoricalCloses(data: CompanyEnriched): HistoricalClose[] {
  return [...(data.historicalPrices?.prices ?? [])]
    .filter(price => Number.isFinite(price.close))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(price => ({ date: price.date, close: price.close }));
}

function addSyntheticWicks(candle: CandlestickData): CandlestickData {
  const spread = Math.max(Math.abs(candle.close - candle.open), candle.close * 0.0025);
  return {
    ...candle,
    high: Math.max(candle.high, candle.open, candle.close) + spread * 0.35,
    low: Math.min(candle.low, candle.open, candle.close) - spread * 0.35,
  };
}

function candlesFromClosePoints(points: Array<{ time: Time; value: number }>): CandlestickData[] {
  return points.map((point, index) => {
    const previousClose = index > 0 ? points[index - 1]!.value : point.value;
    return addSyntheticWicks({
      time: point.time,
      open: previousClose,
      high: Math.max(previousClose, point.value),
      low: Math.min(previousClose, point.value),
      close: point.value,
    });
  });
}

function weekStartIso(dateText: string): string {
  const date = new Date(`${dateText}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function aggregateHistoricalCandles(closes: HistoricalClose[], range: ChartRange): CandlestickData[] {
  if (range === '1H' || closes.length < 2) return [];
  if (range === '1D') {
    return candlesFromClosePoints(closes.slice(-rangePointCount(range)).map(point => ({
      time: point.date,
      value: point.close,
    })));
  }

  const grouped = new Map<string, HistoricalClose[]>();
  for (const point of closes) {
    const key = range === '1W' ? weekStartIso(point.date) : `${point.date.slice(0, 7)}-01`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(point);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([time, bucket]) => {
    const ordered = bucket.sort((a, b) => a.date.localeCompare(b.date));
    const values = ordered.map(point => point.close);
    return addSyntheticWicks({
      time,
      open: values[0]!,
      high: Math.max(...values),
      low: Math.min(...values),
      close: values[values.length - 1]!,
    });
  }).slice(-rangePointCount(range));
}

function fallbackCandles(data: CompanyEnriched, range: ChartRange): CandlestickData[] {
  const sparkline = data.quote?.sparkline ?? [];
  if (range === '1H' && sparkline.length >= 2) {
    const selected = sparkline.slice(-Math.min(sparkline.length, Math.max(2, rangePointCount(range))));
    return candlesFromClosePoints(selected.map((value, index) => ({
      time: rangeTimeForIndex(range, selected.length, index),
      value,
    })));
  }
  return [];
}

function getSnapshotCandlestickData(data: CompanyEnriched, range: ChartRange): CandlestickData[] {
  const historical = aggregateHistoricalCandles(getHistoricalCloses(data), range);
  return historical.length >= 2 ? historical : fallbackCandles(data, range);
}

function getSnapshotChartData(data: CompanyEnriched, range: ChartRange): AreaData[] {
  return getSnapshotCandlestickData(data, range).map(candle => ({
    time: candle.time,
    value: candle.close,
  }));
}

function percentChange(start: number | undefined, end: number | undefined): number | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !start) return null;
  return ((end! - start) / start) * 100;
}

function getRangeChangePercent(data: CompanyEnriched, range: ChartRange): number | null {
  const quotePrice = Number.isFinite(data.quote?.price) ? data.quote!.price : undefined;

  if (range === '1H') {
    const sparkline = data.quote?.sparkline ?? [];
    if (sparkline.length >= 2) {
      return percentChange(sparkline[0], sparkline[sparkline.length - 1]);
    }
    return null;
  }

  if (range === '1D' && Number.isFinite(data.quote?.change)) {
    return data.quote!.change;
  }

  // Finnhub quote dp = day change percent (pre-computed)
  if (range === '1D' && Number.isFinite(data.finnhubQuote?.dp)) {
    return data.finnhubQuote!.dp;
  }

  // Yahoo Finance day change percent
  if (range === '1D' && Number.isFinite(data.yahooQuote?.dp)) {
    return data.yahooQuote!.dp;
  }

  const closes = getHistoricalCloses(data);
  if (closes.length < 2) return null;

  const latest = quotePrice ?? closes[closes.length - 1]!.close;
  const sessionsBack = range === '1D' ? 1 : range === '1W' ? 5 : 21;
  const startIndex = Math.max(0, closes.length - 1 - sessionsBack);
  return percentChange(closes[startIndex]?.close, latest);
}

function getSnapshotPrice(data: CompanyEnriched): { price: number | null; source: 'quote' | 'close' | null } {
  // Proto RPC quote (requires backend)
  if (Number.isFinite(data.quote?.price)) {
    return { price: data.quote!.price, source: 'quote' };
  }

  // Direct Finnhub quote — current price field 'c'
  if (Number.isFinite(data.finnhubQuote?.c) && (data.finnhubQuote?.c ?? 0) > 0) {
    return { price: data.finnhubQuote!.c, source: 'quote' };
  }

  // Yahoo Finance fallback — no API key required
  if (Number.isFinite(data.yahooQuote?.c) && (data.yahooQuote?.c ?? 0) > 0) {
    return { price: data.yahooQuote!.c, source: 'quote' };
  }

  // Fall back to last historical close
  const closes = getHistoricalCloses(data);
  const latestClose = closes[closes.length - 1]?.close;
  return Number.isFinite(latestClose)
    ? { price: latestClose!, source: 'close' }
    : { price: null, source: null };
}

function chartEmptyMessage(data: CompanyEnriched, range: ChartRange): string {
  const hasDailyHistory = getHistoricalCloses(data).length >= 2;
  if (range === '1H' && hasDailyHistory) {
    return 'Intraday series unavailable';
  }
  return 'Historical chart data unavailable';
}

function chartKindIconMarkup(kind: ChartKind): string {
  if (kind === 'candles') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3v18M17 3v18M5 8h4v7H5zM15 5h4v6h-4z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17l6-6 4 4 8-9"/></svg>';
}

function makeChartRangeControls(): HTMLElement {
  const controls = document.createElement('div');
  controls.className = 'edp-tv-chart-controls';
  const ranges = document.createElement('div');
  ranges.className = 'edp-tv-chart-ranges';
  for (const option of CHART_RANGES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `edp-tv-range-btn${option.id === '1D' ? ' is-active' : ''}`;
    button.dataset.range = option.id;
    button.textContent = option.id;
    ranges.append(button);
  }

  const types = document.createElement('div');
  types.className = 'edp-tv-chart-types';
  for (const [kind, label] of [['area', 'Area'], ['candles', 'Candles']] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `edp-tv-kind-btn${kind === 'area' ? ' is-active' : ''}`;
    button.dataset.kind = kind;
    button.setAttribute('aria-label', label);
    button.title = label;
    const icon = document.createElement('span');
    icon.className = `edp-tv-kind-icon edp-tv-kind-icon-${kind}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = chartKindIconMarkup(kind);
    button.append(icon);
    types.append(button);
  }

  controls.append(types, ranges);
  return controls;
}

function appendLightweightChart(
  parent: HTMLElement,
  data: CompanyEnriched,
  positive: boolean,
  onRangeChange?: (range: ChartRange) => void,
): void {
  const controls = makeChartRangeControls();
  const chartWrap = document.createElement('div');
  chartWrap.className = 'edp-tv-chart-wrap';
  const chartEl = document.createElement('div');
  chartEl.className = 'edp-tv-lightweight-chart';
  const emptyEl = document.createElement('div');
  emptyEl.className = 'edp-tv-chart-empty';
  emptyEl.hidden = true;
  chartWrap.append(chartEl, emptyEl);
  parent.append(controls, chartWrap);

  requestAnimationFrame(() => {
    if (!chartEl.isConnected) return;

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text-dim').trim() || '#8b949e';
    const lineColor = positive ? '#22c55e' : '#ef4444';
    let activeRange: ChartRange = '1D';
    let activeKind: ChartKind = 'area';

    const chart = createChart(chartEl, {
      width: chartEl.clientWidth || 240,
      height: chartEl.clientHeight || 180,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.08)' },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        visible: true,
        borderVisible: false,
        timeVisible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });
    let activeSeries: ReturnType<typeof chart.addAreaSeries> | ReturnType<typeof chart.addCandlestickSeries> | null = null;

    const renderChart = (range: ChartRange, kind: ChartKind) => {
      activeRange = range;
      activeKind = kind;
      controls.querySelectorAll<HTMLButtonElement>('.edp-tv-range-btn').forEach(button => {
        button.classList.toggle('is-active', button.dataset.range === range);
      });
      controls.querySelectorAll<HTMLButtonElement>('.edp-tv-kind-btn').forEach(button => {
        button.classList.toggle('is-active', button.dataset.kind === kind);
      });

      if (activeSeries) chart.removeSeries(activeSeries);
      if (kind === 'candles') {
        const seriesData = getSnapshotCandlestickData(data, range);
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        candleSeries.setData(seriesData);
        activeSeries = candleSeries;
        emptyEl.hidden = seriesData.length >= 2;
      } else {
        const seriesData = getSnapshotChartData(data, range);
        const areaSeries = chart.addAreaSeries({
          lineColor,
          topColor: positive ? 'rgba(34, 197, 94, 0.34)' : 'rgba(239, 68, 68, 0.34)',
          bottomColor: 'rgba(255,255,255,0)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        areaSeries.setData(seriesData);
        activeSeries = areaSeries;
        emptyEl.hidden = seriesData.length >= 2;
      }
      emptyEl.textContent = chartEmptyMessage(data, range);
      chart.timeScale().fitContent();
      onRangeChange?.(range);
    };
    renderChart(activeRange, activeKind);

    controls.addEventListener('click', (event) => {
      const rangeButton = (event.target as HTMLElement).closest<HTMLButtonElement>('.edp-tv-range-btn');
      const kindButton = (event.target as HTMLElement).closest<HTMLButtonElement>('.edp-tv-kind-btn');
      const range = rangeButton?.dataset.range as ChartRange | undefined;
      const kind = kindButton?.dataset.kind as ChartKind | undefined;
      if (range) renderChart(range, activeKind);
      if (kind) renderChart(activeRange, kind);
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      chart.applyOptions({
        width: Math.max(120, Math.floor(entry.contentRect.width)),
        height: Math.max(120, Math.floor(entry.contentRect.height)),
      });
      chart.timeScale().fitContent();
    });
    resizeObserver.observe(chartEl);
  });
}

function renderLocalMarketSnapshot(wrap: Element, data: CompanyEnriched): void {
  wrap.classList.add('edp-tradingview-fallback-active');
  const snapshotPrice = getSnapshotPrice(data);
  const price = snapshotPrice.price != null ? fmtPrice(snapshotPrice.price) : 'Quote unavailable';
  const initialChange = getRangeChangePercent(data, '1D');
  const marketCap = data.profile?.marketCapitalization
    ? `MCAP ${fmtFinnhubMarketCap(data.profile.marketCapitalization)}`
    : '';
  const exchange = data.profile?.exchange || 'Market snapshot';
  const priceSource = snapshotPrice.source === 'close' ? 'Last close' : '';

  wrap.textContent = '';
  const card = document.createElement('div');
  card.className = 'edp-tv-fallback-card';
  const quoteCol = document.createElement('div');
  quoteCol.className = 'edp-tv-fallback-quote';

  const priceEl = document.createElement('div');
  priceEl.className = 'edp-tv-fallback-price';
  priceEl.textContent = price;
  quoteCol.append(priceEl);

  const changeEl = document.createElement('div');
  changeEl.className = 'edp-tv-fallback-change cp-trend-pill';
  quoteCol.append(changeEl);

  const updateRangeChange = (range: ChartRange): void => {
    const rangeChange = getRangeChangePercent(data, range);
    changeEl.classList.remove('edp-positive', 'edp-negative', 'cp-change-up', 'cp-change-down');
    
    // Add interactive flash effect
    changeEl.classList.add('cp-change-flash');
    setTimeout(() => changeEl.classList.remove('cp-change-flash'), 400);

    if (rangeChange == null) {
      changeEl.textContent = '—';
      return;
    }
    
    const isPos = rangeChange >= 0;
    changeEl.classList.add(isPos ? 'edp-positive' : 'edp-negative');
    changeEl.classList.add(isPos ? 'cp-change-up' : 'cp-change-down');
    changeEl.innerHTML = `${isPos ? '▲' : '▼'}&nbsp;${fmtChange(Math.abs(rangeChange))} <span class="cp-range-label-sub">${range}</span>`;
  };

  const metaEl = document.createElement('div');
  metaEl.className = 'edp-tv-fallback-meta';
  
  // High-fidelity active dot indicator
  const liveIndicator = document.createElement('span');
  liveIndicator.className = 'cp-live-indicator-dot';
  metaEl.append(liveIndicator);

  const metaText = document.createTextNode(' ' + [priceSource, marketCap, exchange].filter(Boolean).join(' - '));
  metaEl.append(metaText);
  quoteCol.append(metaEl);

  card.append(quoteCol);
  appendLightweightChart(card, data, (initialChange ?? 0) >= 0, updateRangeChange);
  wrap.append(card);
  updateRangeChange('1D');
}

function renderMarketSnapshot(container: HTMLElement, data: CompanyEnriched): void {
  const wrap = container.querySelector('.edp-tradingview-widget');
  if (!wrap) return;
  renderLocalMarketSnapshot(wrap, data);
}




async function settleInBatches<T>(
  tasks: Array<() => Promise<T>>,
  batchSize = 6,
  timeoutMs = 8_000,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    results.push(...await Promise.allSettled(batch.map(task => {
      return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Company enrichment request timed out')), timeoutMs);
        task()
          .then(resolve, reject)
          .finally(() => window.clearTimeout(timer));
      });
    })));
  }
  return results;
}

function settledValue<T>(result: PromiseSettledResult<unknown> | undefined, fallback: T): T {
  return result?.status === 'fulfilled' ? result.value as T : fallback;
}

export class CompanyRenderer implements EntityRenderer {
  private activeTab: TabId = 'overview';
  private activeOptionExpiry = 0;
  private newsCategory = 'all';
  private activeFinancialFrequency: FinancialFrequency = 'quarterly';
  private activeFinancialStatement: FinancialStatementKind = 'income';
  private financialSearch = '';
  /** Index of the first period in the 4-bar chart window. -1 = default (latest 4). */
  private chartWindowStart = -1;
  /** Parent row keys that are collapsed. Empty = all expanded. */
  private collapsedFinancialParents = new Set<FinancialMetricKey>();
  private eventsFilter: 'all' | 'earnings' | 'dividends' | 'splits' = 'all';
  private forecastFreq: 'annual' | 'quarterly' = 'annual';

  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const { ticker, name } = data as CompanyData;
    const container = ctx.el('div', 'edp-generic edp-company-profile');

    // Header
    const header = ctx.el('div', 'edp-header');
    header.append(ctx.el('h2', 'edp-title', name || ticker));
    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge('$' + ticker, 'edp-badge edp-badge-ticker'));
    header.append(badgeRow);
    container.append(header);

    // TradingView widget placeholder
    const tvWrap = ctx.el('div', 'edp-tradingview-widget');
    container.append(tvWrap);

    // Tabs
    const tabBar = ctx.el('div', 'cp-tab-bar');
    for (const tab of TABS) {
      const btn = ctx.el('button', `cp-tab${tab === 'overview' ? ' cp-tab-active' : ''}`);
      btn.textContent = TAB_LABELS[tab];
      btn.dataset.tab = tab;
      tabBar.append(btn);
    }
    container.append(tabBar);

    // Tab content area
    const tabContent = ctx.el('div', 'cp-tab-content');
    tabContent.dataset.slot = 'tab-content';
    tabContent.append(ctx.makeLoading('Loading company data…'));
    container.append(tabContent);

    return container;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<CompanyEnriched> {
    const { ticker, name } = data as CompanyData;

    const [quotesResp, filingsResp, historicalResp] = await Promise.allSettled([
      client.listMarketQuotes({ symbols: [ticker] }, { signal }),
      client.listSecFilings({ ticker, filingTypes: [], limit: 30 }, { signal }),
      client.listHistoricalPrices({ symbols: [ticker], months: 24 }, { signal }),
    ]);

    const [
      profile, metrics, peers, news,
      priceTarget, recommendations, insiderTxns, optionChain, ownership, etfHoldings, earningsSurprises,
      financialsAnnual, financialsQuarterly, epsEstimates, revenueEstimates, dividends,
      revenueBreakdown, ratingActions, earningsCalls, secFacts, finnhubQuote, yahooQuote,
      epsEstimatesAnnual, revenueEstimatesAnnual, stockSplits, upcomingEarnings,
    ] = await settleInBatches<unknown>([
      () => fetchCompanyProfile(ticker),
      () => fetchCompanyMetrics(ticker),
      () => fetchCompanyPeers(ticker),
      () => fetchCompanyNews(ticker),
      () => fetchPriceTarget(ticker),
      () => fetchRecommendationTrends(ticker),
      () => fetchInsiderTransactions(ticker),
      () => fetchOptionChain(ticker),
      () => fetchCompanyInstitutionHolders13F(ticker),
      () => fetchFundOwnership(ticker),
      () => fetchEarningsSurprises(ticker),
      () => fetchFinancialsReported(ticker, 'annual'),
      () => fetchFinancialsReported(ticker, 'quarterly'),
      () => fetchEpsEstimates(ticker, 'quarterly'),
      () => fetchRevenueEstimates(ticker, 'quarterly'),
      () => fetchStockDividends(ticker),
      () => fetchRevenueBreakdown(ticker),
      () => fetchUpgradeDowngrade(ticker),
      () => fetchEarningsCallTranscripts(ticker),
      () => fetchSecCompanyFacts(ticker),
      () => fetchStockQuote(ticker),
      () => fetchYahooQuote(ticker),
      () => fetchEpsEstimates(ticker, 'annual'),
      () => fetchRevenueEstimates(ticker, 'annual'),
      () => fetchStockSplits(ticker),
      () => fetchUpcomingEarnings(ticker),
    ]);

    const quote = quotesResp.status === 'fulfilled'
      ? (quotesResp.value.quotes.find(q => q.symbol === ticker) ?? quotesResp.value.quotes[0] ?? null)
      : null;
    const filings = filingsResp.status === 'fulfilled' ? filingsResp.value.filings : [];
    const historicalPrices = historicalResp.status === 'fulfilled'
      ? (historicalResp.value.series.find(s => s.symbol === ticker) ?? historicalResp.value.series[0] ?? null)
      : null;
    const companyName = filingsResp.status === 'fulfilled' ? (filingsResp.value.companyName ?? name) : name;

    return {
      ticker,
      name,
      quote,
      historicalPrices,
      filings,
      companyName,
      profile: settledValue<CompanyProfile | null>(profile, null),
      metrics: settledValue<CompanyMetrics | null>(metrics, null),
      peers: settledValue<string[]>(peers, []),
      news: settledValue<CompanyNewsItem[]>(news, []),
      priceTarget: settledValue<PriceTarget | null>(priceTarget, null),
      recommendations: settledValue<RecommendationTrend[]>(recommendations, []),
      insiderTxns: settledValue<InsiderTransaction[]>(insiderTxns, []),
      optionChain: settledValue<OptionChainExpiry[]>(optionChain, []),
      ownership: settledValue<CompanyInstitutionHolder[]>(ownership, []),
      etfHoldings: settledValue<InstitutionalHolder[]>(etfHoldings, []),
      earningsSurprises: settledValue<EarningsSurprise[]>(earningsSurprises, []),
      financialsAnnual: normalizeFinancialReports(settledValue<FinancialReport[]>(financialsAnnual, []), 'annual'),
      financialsQuarterly: normalizeFinancialReports(settledValue<FinancialReport[]>(financialsQuarterly, []), 'quarterly'),
      epsEstimates: settledValue<EstimateSeries>(epsEstimates, { symbol: ticker, freq: 'quarterly', data: [] }),
      revenueEstimates: settledValue<EstimateSeries>(revenueEstimates, { symbol: ticker, freq: 'quarterly', data: [] }),
      dividends: settledValue<StockDividend[]>(dividends, []),
      revenueBreakdown: settledValue<RevenueBreakdown | null>(revenueBreakdown, null),
      ratingActions: settledValue<UpgradeDowngradeAction[]>(ratingActions, []),
      earningsCalls: settledValue<EarningsCallTranscript[]>(earningsCalls, []),
      secFacts: settledValue<SecCompanyFacts | null>(secFacts, null),
      finnhubQuote: settledValue<StockQuote | null>(finnhubQuote, null),
      yahooQuote: settledValue<StockQuote | null>(yahooQuote, null),
      stockSplits: settledValue<StockSplit[]>(stockSplits, []),
      upcomingEarnings: settledValue<EarningsEvent | null>(upcomingEarnings, null),
      epsEstimatesAnnual: settledValue<EstimateSeries>(epsEstimatesAnnual, { symbol: ticker, freq: 'annual', data: [] }),
      revenueEstimatesAnnual: settledValue<EstimateSeries>(revenueEstimatesAnnual, { symbol: ticker, freq: 'annual', data: [] }),
    };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const data = enrichedData as CompanyEnriched;

    renderMarketSnapshot(container, data);

    const displayName = data.profile?.name || data.companyName || data.name;
    const header = container.querySelector('.edp-header') as HTMLElement;
    
    if (header) {
      // Clear header and rebuild as a horizontal Brand Profile Card
      header.replaceChildren();

      // Subtle dynamic brand backing glow inside the card
      if (data.profile?.logo) {
        const blurLogo = ctx.el('img', 'cp-header-blur-logo') as HTMLImageElement;
        blurLogo.src = sanitizeUrl(data.profile.logo);
        blurLogo.alt = '';
        blurLogo.onerror = () => blurLogo.remove();
        header.append(blurLogo);
      }

      // Grid wrapper
      const brandGrid = ctx.el('div', 'cp-brand-header-grid');

      // Left: Logo Badge Squircle
      if (data.profile?.logo) {
        const badge = ctx.el('div', 'cp-brand-badge');
        const logo = ctx.el('img', 'cp-brand-badge-img') as HTMLImageElement;
        logo.src = sanitizeUrl(data.profile.logo);
        logo.alt = displayName;
        logo.onerror = () => badge.remove();
        badge.append(logo);
        brandGrid.append(badge);
      }

      // Right: Text info and badges
      const brandInfo = ctx.el('div', 'cp-brand-info');
      
      const titleEl = ctx.el('h2', 'edp-title', displayName);
      brandInfo.append(titleEl);

      const badgeRow = ctx.el('div', 'edp-badge-row');
      badgeRow.append(ctx.badge('$' + data.ticker, 'edp-badge edp-badge-ticker'));
      const sector = data.profile?.gicsSector || data.profile?.finnhubIndustry;
      if (sector) {
        const sectorBadge = ctx.badge(sector, 'edp-badge edp-badge-sector cp-clickable-sector-badge');
        
        // Helper to map dynamic sector industry strings to registered ETF symbols
        const getSectorSymbol = (name: string): string => {
          const norm = name.toLowerCase();
          if (norm.includes('semiconductor') || norm.includes('chip')) return 'SMH';
          if (norm.includes('tech') || norm.includes('software') || norm.includes('hardware') || norm.includes('it ')) return 'XLK';
          if (norm.includes('financial') || norm.includes('bank') || norm.includes('insurance') || norm.includes('finance')) return 'XLF';
          if (norm.includes('energy') || norm.includes('oil') || norm.includes('gas') || norm.includes('coal')) return 'XLE';
          if (norm.includes('health') || norm.includes('pharma') || norm.includes('medical') || norm.includes('clinical')) return 'XLV';
          return 'XLK'; // Fallback to general technology
        };
        
        const industry = data.profile?.finnhubIndustry;
        const gics = data.profile?.gicsSector;
        const symbol = (industry && getSectorSymbol(industry)) || (gics && getSectorSymbol(gics)) || 'XLK';
        
        sectorBadge.style.cursor = 'pointer';
        sectorBadge.title = `Open ${sector} sector`;
        sectorBadge.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: {
              type: 'sector',
              data: {
                symbol,
                name: sector,
                change: null
              }
            }
          }));
        });
        badgeRow.append(sectorBadge);
      }
      brandInfo.append(badgeRow);

      brandGrid.append(brandInfo);
      header.append(brandGrid);
    }

    // Render initial tab
    this.activeTab = 'overview';
    this.activeOptionExpiry = 0;
    this.newsCategory = 'all';
    this.activeFinancialFrequency = 'quarterly';
    this.activeFinancialStatement = 'income';
    this.financialSearch = '';
    this.eventsFilter = 'all';
    this.renderTabContent(container, data, ctx);

    // Tab click handlers
    const tabBar = container.querySelector('.cp-tab-bar');
    tabBar?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.cp-tab') as HTMLElement | null;
      if (!btn || !btn.dataset.tab) return;
      this.activeTab = btn.dataset.tab as TabId;
      tabBar.querySelectorAll('.cp-tab').forEach(t => t.classList.remove('cp-tab-active'));
      btn.classList.add('cp-tab-active');
      this.renderTabContent(container, data, ctx);
    });
  }

  private renderTabContent(container: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const content = container.querySelector('[data-slot="tab-content"]') as HTMLElement | null;
    if (!content) return;
    content.replaceChildren();

    switch (this.activeTab) {
      case 'overview':   this.renderOverviewTab(content, data, ctx); break;
      case 'financials': this.renderFinancialsTab(content, data, ctx); break;
      case 'valuation':  this.renderValuationTab(content, data, ctx); break;
      case 'estimates':  this.renderEstimatesTab(content, data, ctx); break;
      case 'forecasts':  this.renderForecastsTab(content, data, ctx); break;
      case 'news':       this.renderNewsTab(content, data, ctx); break;
      case 'events':     this.renderEventsTab(content, data, ctx); break;
      case 'options':    this.renderOptionsTab(content, data, ctx); break;
      case 'insiders':   this.renderInsidersTab(content, data, ctx); break;
      case 'holders':    this.renderHoldersTab(content, data, ctx); break;
      case 'filings':    this.renderFilingsTab(content, data, ctx); break;
    }
  }

  // ─── Overview Tab ────────────────────────────────────────────────────────

  private renderOverviewTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const periods = data.financialsQuarterly.length > 0 ? data.financialsQuarterly : data.financialsAnnual;
    const latestRevenue = getLatestFinancialValue(periods, 'revenue');
    const latestNetIncome = getLatestFinancialValue(periods, 'netIncome');
    const latestDebt = getLatestFinancialValue(periods, 'debt');
    const latestCash = getLatestFinancialValue(periods, 'cash');
    const marketCap = data.profile?.marketCapitalization
      ? data.profile.marketCapitalization * 1_000_000
      : data.metrics?.marketCapitalization;

    // Derive the latest reporting period to stamp the card
    const latestPeriod = data.financialsQuarterly[0] ?? data.financialsAnnual[0] ?? null;

    const [factsCard, factsBody] = ctx.sectionCard('Key Facts');

    // Filing period badge — show which 10-Q/10-K these fundamentals come from
    if (latestPeriod) {
      const isQuarterly = latestPeriod.quarter > 0;
      const periodLabel = isQuarterly
        ? `Q${latestPeriod.quarter} ${latestPeriod.year}`
        : `FY${latestPeriod.year}`;
      const formLabel = latestPeriod.form || (isQuarterly ? '10-Q' : '10-K');
      const filedLabel = latestPeriod.filedDate ? ` · ${formLabel} filed ${fmtDate(latestPeriod.filedDate)}` : ` · ${formLabel}`;
      const asof = ctx.el('div', 'cp-key-facts-asof', `as of ${periodLabel}${filedLabel}`);
      factsBody.append(asof);
    }

    const facts = ctx.el('div', 'cp-key-facts-grid');
    const addFact = (label: string, value: string | HTMLElement): void => {
      const item = ctx.el('div', 'cp-key-fact');
      item.append(ctx.el('span', 'cp-key-fact-label', label));
      if (typeof value === 'string') {
        item.append(ctx.el('span', 'cp-key-fact-value', value));
      } else {
        item.append(value);
      }
      facts.append(item);
    };

    addFact('Market capitalization', marketCap ? fmtFinancialValue(marketCap) : '-');
    addFact('Dividend yield', fmtPercent(data.metrics?.dividendYieldIndicatedAnnual));
    addFact('P/E Ratio (TTM)', fmtMetric(data.metrics?.peBasicExclExtraTTM || data.metrics?.peAnnual, 'x'));
    addFact('Basic EPS', fmtMetric(data.metrics?.epsAnnual));
    addFact('Employees', data.profile?.employeeTotal ? fmtShares(data.profile.employeeTotal) : '-');
    addFact('CEO', data.profile?.ceo || '-');
    if (data.profile?.weburl) {
      const link = ctx.el('a', 'cp-link cp-key-fact-value') as HTMLAnchorElement;
      link.href = sanitizeUrl(data.profile.weburl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = data.profile.weburl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      addFact('Website', link);
    } else {
      addFact('Website', '-');
    }
    addFact('IPO date', data.profile?.ipo ? fmtDate(data.profile.ipo) : '-');
    addFact('Shares out', data.profile?.shareOutstanding ? `${data.profile.shareOutstanding.toFixed(2)}M` : '-');
    addFact('Currency', data.profile?.currency || '-');
    factsBody.append(facts);
    content.append(factsCard);

    if (data.secFacts && hasSecFactsData(data.secFacts)) {
      content.append(buildSecCompanyFactsCard(ctx, data.secFacts));
    }

    if (data.profile?.description) {
      const [card, body] = ctx.sectionCard('About');
      card.classList.add('edp-card--wide');
      body.append(ctx.el('p', 'cp-about-text', data.profile.description));
      content.append(card);
    }

    if (data.profile) {
      const [card, body] = ctx.sectionCard('Company Info');
      if (data.profile.finnhubIndustry) body.append(row(ctx, 'Industry', data.profile.finnhubIndustry));
      if (data.profile.gicsSector)      body.append(row(ctx, 'Sector', data.profile.gicsSector));
      if (data.profile.gicsIndustry)    body.append(row(ctx, 'GICS Industry', data.profile.gicsIndustry));
      if (data.profile.country)         body.append(row(ctx, 'Country', data.profile.country));
      if (data.profile.exchange)        body.append(row(ctx, 'Exchange', data.profile.exchange));
      content.append(card);
    }

    if (data.metrics) {
      const [card, body] = ctx.sectionCard('Key Metrics');
      const m = data.metrics;
      const grid = ctx.el('div', 'cp-metrics-grid');

      // Omit 52W High and 52W Low from grid as they are visually rendered in the premium range progress slider
      const metrics: [string, string][] = [
        ['P/E',        fmtMetric(m.peBasicExclExtraTTM || m.peAnnual, 'x')],
        ['P/B',        fmtMetric(m.pbAnnual, 'x')],
        ['P/S',        fmtMetric(m.psAnnual, 'x')],
        ['EPS',        fmtMetric(m.epsAnnual)],
        ['ROE',        fmtPercent(m.roeRfy)],
        ['ROA',        fmtPercent(m.roaRfy)],
        ['Div Yield',  fmtPercent(m.dividendYieldIndicatedAnnual)],
        ['Beta',       fmtMetric(m.beta)],
        ['D/E',        fmtMetric(m.totalDebtToEquityAnnual)],
        ['Current R.', fmtMetric(m.currentRatioAnnual)],
      ];

      for (const [label, value] of metrics) {
        const cell = ctx.el('div', 'cp-metric-cell');
        cell.append(ctx.el('span', 'cp-metric-label', label));
        cell.append(ctx.el('span', 'cp-metric-value', value));
        grid.append(cell);
      }

      body.append(grid);
      content.append(card);
    }

    // 52-Week Range Premium Progress Slider Card
    if (data.metrics?.['52WeekLow'] && data.metrics?.['52WeekHigh']) {
      const low = data.metrics['52WeekLow'];
      const high = data.metrics['52WeekHigh'];
      const current = getSnapshotPrice(data).price;
      
      if (current != null && high > low) {
        const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
        const [card, body] = ctx.sectionCard('52-Week Range');
        card.classList.add('cp-52w-slider-card');
        
        const sliderTrack = ctx.el('div', 'cp-52w-slider-track-wrap');
        const lowLabel = ctx.el('span', 'cp-52w-slider-low', fmtPrice(low));
        
        const track = ctx.el('div', 'cp-52w-slider-track');
        const fill = ctx.el('div', 'cp-52w-slider-fill');
        fill.style.setProperty('--target-width', `${pct}%`);
        fill.classList.add('cp-margin-bar'); // Reuse grow transition trigger
        
        const pin = ctx.el('div', 'cp-52w-slider-pin');
        pin.style.left = `${pct}%`;
        pin.title = `Current: ${fmtPrice(current)}`;
        track.append(fill, pin);
        
        const highLabel = ctx.el('span', 'cp-52w-slider-high', fmtPrice(high));
        sliderTrack.append(lowLabel, track, highLabel);
        body.append(sliderTrack);
        
        const sliderMeta = ctx.el('div', 'cp-52w-slider-meta');
        sliderMeta.textContent = `Current price is ${pct.toFixed(0)}% from 52-Week Low`;
        body.append(sliderMeta);
        
        content.append(card);
      }
    }

    if (marketCap || latestDebt || latestCash) {
      const [card, body] = ctx.sectionCard('Capital Structure');
      const enterpriseValue = marketCap !== undefined ? marketCap + (latestDebt ?? 0) - (latestCash ?? 0) : undefined;
      body.append(buildCapitalStructure(ctx, [
        ['Market cap', marketCap, '#2dd4bf'],
        ['Debt', latestDebt, '#f59e0b'],
        ['Cash & equivalents', latestCash, '#22d3ee'],
        ['Enterprise value', enterpriseValue, '#3b82f6'],
      ]));
      content.append(card);
    }

    if (data.ownership.length > 0) {
      const [card, body] = ctx.sectionCard('Ownership');
      const top = data.ownership.slice(0, 5);
      const totalHeld = top.reduce((sum, holder) => sum + (holder.percent || 0), 0);
      body.append(buildOwnershipSnapshot(ctx, top, totalHeld));
      content.append(card);
    }

    if (latestRevenue !== undefined || latestNetIncome !== undefined) {
      const [card, body] = ctx.sectionCard('Recent Performance');
      const grid = ctx.el('div', 'cp-mini-kpi-grid');
      for (const [label, value] of [
        ['Revenue', latestRevenue],
        ['Net income', latestNetIncome],
        ['Net margin', ratio(latestNetIncome, latestRevenue) !== undefined ? ratio(latestNetIncome, latestRevenue)! * 100 : undefined],
      ] as const) {
        const item = ctx.el('div', 'cp-mini-kpi');
        item.append(ctx.el('span', 'cp-mini-kpi-label', label));
        item.append(ctx.el('span', 'cp-mini-kpi-value', label === 'Net margin' ? fmtPercent(value) : fmtFinancialValue(value)));
        grid.append(item);
      }
      body.append(grid);
      content.append(card);
    }

    if (data.metrics) {
      const m = data.metrics;
      const hasMargins = m.grossMarginAnnual || m.operatingMarginAnnual || m.netProfitMarginAnnual;
      if (hasMargins) {
        const [card, body] = ctx.sectionCard('Margins & Growth');
        const items: [string, number | undefined][] = [
          ['Gross Margin',        m.grossMarginAnnual],
          ['Operating Margin',    m.operatingMarginAnnual],
          ['Net Margin',          m.netProfitMarginAnnual],
          ['Revenue Growth (YoY)', m.revenueGrowthTTMYoy],
          ['EPS Growth (YoY)',     m.epsGrowthTTMYoy],
        ];
        for (const [label, val] of items) {
          if (val === undefined || val === null) continue;
          const barRow = ctx.el('div', 'cp-margin-row');
          barRow.append(ctx.el('span', 'cp-margin-label', label));
          const barWrap = ctx.el('div', 'cp-margin-bar-wrap');
          const bar = ctx.el('div', val >= 0 ? 'cp-margin-bar cp-positive' : 'cp-margin-bar cp-negative');
          
          // Set target width using CSS variable to trigger grow transition on mount
          bar.style.setProperty('--target-width', `${Math.min(Math.abs(val), 100)}%`);
          
          barWrap.append(bar);
          barRow.append(barWrap);
          barRow.append(ctx.el('span', 'cp-margin-value', fmtPercent(val)));
          body.append(barRow);
        }
        content.append(card);
      }
    }

    if (data.peers.length > 0) {
      const [card, body] = ctx.sectionCard('Peers');
      const peersWrap = ctx.el('div', 'cp-peers');
      const peerSymbols = data.peers.slice(0, 12);
      
      for (const peer of peerSymbols) {
        const chip = ctx.el('button', 'cp-peer-chip');
        
        const peerLabel = ctx.el('span', 'cp-peer-name', peer);
        chip.append(peerLabel);
        
        // Skeleton percentage tag until lazy quote loading resolves
        const skeleton = ctx.el('span', 'cp-peer-change-skeleton', '...');
        chip.append(skeleton);
        
        chip.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: { type: 'company', data: { ticker: peer, name: peer } },
          }));
        });
        peersWrap.append(chip);
      }
      body.append(peersWrap);
      content.append(card);

      // Lazily resolve peer stock quotes asynchronously to overlay glowing green/red arrow change pills
      if (peerSymbols.length > 0) {
        client.listMarketQuotes({ symbols: peerSymbols })
          .then((quotesResp) => {
            const quoteMap = new Map(quotesResp.quotes.map(q => [q.symbol, q]));
            peersWrap.querySelectorAll('.cp-peer-chip').forEach((chipEl) => {
              const chip = chipEl as HTMLElement;
              const nameEl = chip.querySelector('.cp-peer-name') as HTMLElement;
              if (!nameEl) return;
              const symbol = nameEl.textContent;
              if (!symbol) return;
              const q = quoteMap.get(symbol);
              
              const skel = chip.querySelector('.cp-peer-change-skeleton');
              if (skel) skel.remove();
              
              if (q && q.change != null) {
                const isPos = q.change >= 0;
                const changePill = ctx.el('span', `cp-peer-change-pill ${isPos ? 'cp-change-up' : 'cp-change-down'}`);
                changePill.innerHTML = `${isPos ? '▲' : '▼'}&nbsp;${fmtChange(Math.abs(q.change))}`;
                chip.append(changePill);
              }
            });
          })
          .catch((err) => console.warn('Failed to resolve lazy peer quotes:', err));
      }
    }
  }

  // ─── Financials Tab ──────────────────────────────────────────────────────

  private renderFinancialsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const allPeriods = this.activeFinancialFrequency === 'annual' ? data.financialsAnnual : data.financialsQuarterly;

    // 4-bar sliding window ─────────────────────────────────────────────────
    const WINDOW = 4;
    const total = allPeriods.length;
    const defaultStart = Math.max(0, total - WINDOW);
    // Normalise chartWindowStart: -1 means "default" (latest 4)
    if (this.chartWindowStart < 0 || this.chartWindowStart > defaultStart) {
      this.chartWindowStart = defaultStart;
    }
    const winStart = this.chartWindowStart;
    const periods = allPeriods.slice(winStart, winStart + WINDOW);
    const canPrev = winStart > 0;
    const canNext = winStart < defaultStart;
    // ──────────────────────────────────────────────────────────────────────

    const hasFinancials = periods.length > 0;
    if (!hasFinancials && !data.metrics) {
      content.append(ctx.makeEmpty('Financial data unavailable'));
      return;
    }

    if (hasFinancials) {
      const [statementCard, statementBody] = ctx.sectionCard('Statements');
      statementCard.classList.add('edp-card--wide');
      statementBody.append(this.buildFinancialControls(ctx, content, data));

      // Chart wrapped with nav arrows
      const chartSection = ctx.el('div', 'cp-fin-chart-section');
      const prevBtn = ctx.el('button', `cp-fin-nav-btn cp-fin-nav-prev${canPrev ? '' : ' is-disabled'}`) as HTMLButtonElement;
      prevBtn.type = 'button';
      prevBtn.setAttribute('aria-label', 'Earlier periods');
      prevBtn.textContent = '←';
      prevBtn.disabled = !canPrev;
      const nextBtn = ctx.el('button', `cp-fin-nav-btn cp-fin-nav-next${canNext ? '' : ' is-disabled'}`) as HTMLButtonElement;
      nextBtn.type = 'button';
      nextBtn.setAttribute('aria-label', 'Later periods');
      nextBtn.textContent = '→';
      nextBtn.disabled = !canNext;

      prevBtn.addEventListener('click', () => {
        this.chartWindowStart = Math.max(0, winStart - WINDOW);
        content.replaceChildren();
        this.renderFinancialsTab(content, data, ctx);
      });
      nextBtn.addEventListener('click', () => {
        this.chartWindowStart = Math.min(defaultStart, winStart + WINDOW);
        content.replaceChildren();
        this.renderFinancialsTab(content, data, ctx);
      });

      const chartEl = buildFinancialChart(ctx, periods, this.activeFinancialStatement);
      chartSection.append(prevBtn, chartEl, nextBtn);

      const toggleParent = (key: FinancialMetricKey): void => {
        if (this.collapsedFinancialParents.has(key)) {
          this.collapsedFinancialParents.delete(key);
        } else {
          this.collapsedFinancialParents.add(key);
        }
        content.replaceChildren();
        this.renderFinancialsTab(content, data, ctx);
      };

      const rows = buildFinancialRows(periods, this.activeFinancialStatement, {
        collapsedParents: this.collapsedFinancialParents,
        searchTerm: this.financialSearch,
      });
      const tableWrap = buildFinancialTable(
        ctx, periods, rows, allPeriods, this.activeFinancialFrequency,
        data.profile?.currency || 'USD', this.collapsedFinancialParents, toggleParent,
      );
      statementBody.append(chartSection, tableWrap);
      wireFinancialChartSelection(chartEl, tableWrap, periods, allPeriods, rows, this.activeFinancialFrequency);
      content.append(statementCard);
    }

    const [statsCard, statsBody] = ctx.sectionCard('Statistics');
    statsBody.append(buildStatisticsGrid(ctx, data, periods));
    content.append(statsCard);

    if (data.revenueBreakdown) {
      const [revCard, revBody] = ctx.sectionCard('Revenue Breakdown');
      const breakdown = buildRevenueBreakdown(ctx, data.revenueBreakdown);
      revBody.append(breakdown ?? ctx.makeEmpty('Revenue segment data unavailable'));
      content.append(revCard);
    }

    const [divCard, divBody] = ctx.sectionCard('Dividends');
    if (data.dividends.length > 0 || data.metrics?.dividendYieldIndicatedAnnual) {
      divBody.append(row(ctx, 'Dividend Yield', fmtPercent(data.metrics?.dividendYieldIndicatedAnnual)));
      if (data.dividends.length > 0) divBody.append(buildDividendTable(ctx, data.dividends.slice(0, 8)));
    } else {
      divBody.append(ctx.makeEmpty('No dividend history from the current data source'));
    }
    content.append(divCard);
    return;
  }


  private buildFinancialControls(
    ctx: EntityRenderContext,
    content: HTMLElement,
    data: CompanyEnriched,
  ): HTMLElement {
    const wrap = ctx.el('div', 'cp-financial-controls');

    const statementGroup = ctx.el('div', 'cp-control-group cp-statement-control');
    for (const [kind, label] of [
      ['income', 'Income statement'],
      ['balance', 'Balance sheet'],
      ['cash', 'Cash flow'],
    ] as const) {
      const button = ctx.el('button', `cp-control-btn${this.activeFinancialStatement === kind ? ' is-active' : ''}`);
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => {
        this.activeFinancialStatement = kind;
        content.replaceChildren();
        this.renderFinancialsTab(content, data, ctx);
      });
      statementGroup.append(button);
    }

    const freqGroup = ctx.el('div', 'cp-control-group');
    for (const freq of ['annual', 'quarterly'] as const) {
      const button = ctx.el('button', `cp-control-btn${this.activeFinancialFrequency === freq ? ' is-active' : ''}`);
      button.type = 'button';
      button.textContent = freq === 'annual' ? 'Annual' : 'Quarterly';
      button.addEventListener('click', () => {
        this.activeFinancialFrequency = freq;
        this.chartWindowStart = -1; // reset to latest 4 for the new frequency
        content.replaceChildren();
        this.renderFinancialsTab(content, data, ctx);
      });
      freqGroup.append(button);
    }

    const search = ctx.el('input', 'cp-financial-search') as HTMLInputElement;
    search.type = 'search';
    search.placeholder = 'Search rows';
    search.value = this.financialSearch;
    search.addEventListener('input', () => {
      this.financialSearch = search.value.trim();
      content.replaceChildren();
      this.renderFinancialsTab(content, data, ctx);
    });

    wrap.append(statementGroup, freqGroup, search);
    return wrap;
  }

  private renderForecastsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const epsData = this.forecastFreq === 'annual' ? data.epsEstimatesAnnual : data.epsEstimates;
    const revData = this.forecastFreq === 'annual' ? data.revenueEstimatesAnnual : data.revenueEstimates;

    // ── Annual / Quarterly toggle ─────────────────────────────────────────
    const toggleWrap = ctx.el('div', 'cp-freq-toggle-wrap');
    for (const [freq, label] of [['annual', 'Annual'], ['quarterly', 'Quarterly']] as const) {
      const btn = ctx.el('button', `cp-freq-toggle${this.forecastFreq === freq ? ' cp-freq-toggle-active' : ''}`) as HTMLButtonElement;
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.forecastFreq = freq;
        content.replaceChildren();
        this.renderForecastsTab(content, data, ctx);
      });
      toggleWrap.append(btn);
    }
    content.append(toggleWrap);

    // ── Price target cone ─────────────────────────────────────────────────
    if (data.priceTarget && data.quote?.price) {
      const [card, body] = ctx.sectionCard('Price Target');
      const pt = data.priceTarget;
      const currentPrice = data.quote.price;
      const upside = ((pt.targetMean - currentPrice) / currentPrice) * 100;
      const analystCount = pt.numberAnalysts
        ?? (data.recommendations[0]
          ? data.recommendations[0].strongBuy + data.recommendations[0].buy + data.recommendations[0].hold + data.recommendations[0].sell + data.recommendations[0].strongSell
          : null);

      const targetHeader = ctx.el('div', 'cp-forecast-target-header');
      targetHeader.append(ctx.el('div', `cp-forecast-target-price ${upside >= 0 ? 'cp-positive' : 'cp-negative'}`, fmtPrice(pt.targetMean)));
      const narrative = ctx.el('div', 'cp-forecast-target-narrative');
      narrative.textContent = `${Math.abs(upside).toFixed(1)}% ${upside >= 0 ? 'upside' : 'downside'} from current${analystCount ? ` · ${analystCount} analysts` : ''}`;
      targetHeader.append(narrative);
      body.append(targetHeader);

      const closesRaw = getHistoricalCloses(data);
      if (closesRaw.length >= 2) {
        body.append(buildForecastConeChart(ctx, closesRaw, pt, currentPrice));
      } else {
        body.append(buildPriceTargetGauge(ctx, currentPrice, pt.targetLow, pt.targetMean, pt.targetHigh));
      }

      const statsRow = ctx.el('div', 'cp-forecast-stats');
      for (const [lbl, val, cls] of [
        ['Low', fmtPrice(pt.targetLow), 'cp-negative'],
        ['Mean', fmtPrice(pt.targetMean), ''],
        ['Median', fmtPrice(pt.targetMedian), ''],
        ['High', fmtPrice(pt.targetHigh), 'cp-positive'],
      ] as [string, string, string][]) {
        const item = ctx.el('div', 'cp-forecast-stat-item');
        item.append(ctx.el('span', 'cp-forecast-stat-label', lbl));
        item.append(ctx.el('span', `cp-forecast-stat-value ${cls}`.trim(), val));
        statsRow.append(item);
      }
      body.append(statsRow);
      if (pt.lastUpdated) body.append(ctx.el('div', 'cp-forecast-updated', 'Updated ' + fmtDate(pt.lastUpdated)));
      content.append(card);
    } else if (data.priceTarget) {
      const [card, body] = ctx.sectionCard('Price Target');
      body.append(row(ctx, 'Mean Target', fmtPrice(data.priceTarget.targetMean)));
      body.append(row(ctx, 'High', fmtPrice(data.priceTarget.targetHigh)));
      body.append(row(ctx, 'Low', fmtPrice(data.priceTarget.targetLow)));
      content.append(card);
    }

    // ── Analyst consensus + gauge ─────────────────────────────────────────
    if (data.recommendations.length > 0) {
      const [card, body] = ctx.sectionCard('Analyst Consensus');
      card.classList.add('cp-card-with-action', 'edp-card--wide');
      const detailButton = ctx.el('button', 'cp-card-action-btn', 'Open details') as HTMLButtonElement;
      detailButton.type = 'button';
      detailButton.addEventListener('click', () => ctx.navigate(buildAnalystDetailsView(ctx, data)));
      card.append(detailButton);
      const latest = data.recommendations[0]!;
      const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;

      if (total > 0) {
        body.append(buildAnalystGaugeSvg(ctx, latest));

        const buys = latest.strongBuy + latest.buy;
        const sells = latest.sell + latest.strongSell;
        const summaryRow = ctx.el('div', 'cp-consensus-summary');
        summaryRow.append(buildConsensusCount(ctx, buys, 'Buy', 'cp-positive'));
        summaryRow.append(buildConsensusCount(ctx, latest.hold, 'Hold', 'cp-neutral'));
        summaryRow.append(buildConsensusCount(ctx, sells, 'Sell', 'cp-negative'));
        body.append(summaryRow);

        const ratingBar = ctx.el('div', 'cp-rating-bar');
        for (const [count, color, label] of [
          [latest.strongBuy,  '#16a34a', 'Strong Buy'],
          [latest.buy,        '#22c55e', 'Buy'],
          [latest.hold,       '#eab308', 'Hold'],
          [latest.sell,       '#f97316', 'Sell'],
          [latest.strongSell, '#ef4444', 'Strong Sell'],
        ] as [number, string, string][]) {
          if (count === 0) continue;
          const seg = ctx.el('div', 'cp-rating-segment');
          seg.style.width = ((count / total) * 100) + '%';
          seg.style.backgroundColor = color;
          seg.title = `${label}: ${count}`;
          seg.textContent = String(count);
          ratingBar.append(seg);
        }
        body.append(ratingBar);

        const legend = ctx.el('div', 'cp-rating-legend');
        for (const [label, count, color] of [
          ['Strong Buy',  latest.strongBuy,  '#16a34a'],
          ['Buy',         latest.buy,         '#22c55e'],
          ['Hold',        latest.hold,        '#eab308'],
          ['Sell',        latest.sell,        '#f97316'],
          ['Strong Sell', latest.strongSell,  '#ef4444'],
        ] as [string, number, string][]) {
          const item = ctx.el('div', 'cp-rating-legend-item');
          const dot = ctx.el('span', 'cp-rating-dot');
          dot.style.backgroundColor = color;
          item.append(dot, ctx.el('span', '', `${label} (${count})`));
          legend.append(item);
        }
        body.append(legend);
      }

      if (data.recommendations.length > 1) {
        body.append(ctx.el('div', 'cp-trend-title', 'Historical Consensus'));
        for (const rec of data.recommendations.slice(0, 6)) {
          const tTotal = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
          if (tTotal === 0) continue;
          const tRow = ctx.el('div', 'cp-trend-row');
          tRow.append(ctx.el('span', 'cp-trend-period', rec.period));
          const miniBar = ctx.el('div', 'cp-rating-bar cp-rating-bar-mini');
          for (const [c, col] of [
            [rec.strongBuy, '#16a34a'], [rec.buy, '#22c55e'], [rec.hold, '#eab308'],
            [rec.sell, '#f97316'], [rec.strongSell, '#ef4444'],
          ] as [number, string][]) {
            if (c === 0) continue;
            const s = ctx.el('div', 'cp-rating-segment');
            s.style.width = ((c / tTotal) * 100) + '%';
            s.style.backgroundColor = col;
            miniBar.append(s);
          }
          tRow.append(miniBar);
          body.append(tRow);
        }
      }
      content.append(card);
    }

    // ── EPS section ───────────────────────────────────────────────────────
    if (epsData.data.length > 0 || data.earningsSurprises.length > 0) {
      const [card, body] = ctx.sectionCard('EPS Estimates');
      card.classList.add('edp-card--wide');
      if (epsData.data.length > 0) {
        body.append(buildEstimateComparisonChart(ctx, epsData, false));
        body.append(buildEstimateMetricsTable(ctx, epsData, false));
      }
      if (data.earningsSurprises.length > 0) {
        body.append(ctx.el('div', 'cp-trend-title', 'Historical EPS Surprise'));
        body.append(buildEarningsTable(ctx, data.earningsSurprises.slice(0, 8)));
      }
      content.append(card);
    }

    // ── Revenue section ───────────────────────────────────────────────────
    if (revData.data.length > 0) {
      const [card, body] = ctx.sectionCard('Revenue Estimates');
      card.classList.add('edp-card--wide');
      body.append(buildEstimateComparisonChart(ctx, revData, true));
      body.append(buildEstimateMetricsTable(ctx, revData, true));
      content.append(card);
    }

    // ── Insider activity ──────────────────────────────────────────────────
    if (data.insiderTxns.length > 0) {
      const [card, body] = ctx.sectionCard('Recent Insider Activity');
      for (const tx of data.insiderTxns.slice(0, 8)) {
        const txRow = ctx.el('div', 'cp-insider-row');
        const isPurchase = tx.transactionCode === 'P';
        const isSale = tx.transactionCode === 'S';
        txRow.append(ctx.el('div', 'cp-insider-name', tx.name));
        const details = ctx.el('div', 'cp-insider-details');
        const typeLabel = isPurchase ? 'Buy' : isSale ? 'Sale' : tx.transactionCode;
        details.append(ctx.el('span',
          isPurchase ? 'cp-insider-badge cp-positive' : isSale ? 'cp-insider-badge cp-negative' : 'cp-insider-badge',
          typeLabel));
        if (tx.transactionValue) details.append(ctx.el('span', 'cp-insider-val', fmtLargeNumber(Math.abs(tx.transactionValue))));
        details.append(ctx.el('span', 'cp-insider-date', tx.transactionDate));
        txRow.append(details);
        body.append(txRow);
      }
      content.append(card);
    }

    if (
      !data.priceTarget
      && data.recommendations.length === 0
      && data.insiderTxns.length === 0
      && epsData.data.length === 0
      && revData.data.length === 0
      && data.earningsSurprises.length === 0
    ) {
      content.append(ctx.makeEmpty('No forecast data available'));
      return;
    }

    content.append(ctx.el('div', 'cp-forecast-disclaimer', 'Estimates are analyst consensus, not investment advice.'));
  }

  // ─── News Tab ────────────────────────────────────────────────────────────

  private renderNewsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    if (data.news.length === 0) {
      content.append(ctx.makeEmpty('No recent news'));
      return;
    }

    // Collect unique categories
    const categories = ['all', ...Array.from(new Set(data.news.map(n => n.category).filter(Boolean)))];

    // Category filter bar
    const filterBar = ctx.el('div', 'cp-news-cats');
    for (const cat of categories.slice(0, 8)) {
      const chip = ctx.el('button', `cp-news-cat-chip${cat === this.newsCategory ? ' cp-news-cat-active' : ''}`);
      chip.textContent = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
      chip.dataset.cat = cat;
      filterBar.append(chip);
    }
    content.append(filterBar);

    // News list container
    const listWrap = ctx.el('div', '');
    listWrap.dataset.slot = 'news-list';
    content.append(listWrap);

    const renderList = (category: string) => {
      listWrap.replaceChildren();
      const filtered = category === 'all' ? data.news : data.news.filter(n => n.category === category);
      if (filtered.length === 0) {
        listWrap.append(ctx.makeEmpty('No news in this category'));
        return;
      }
      const [card, body] = ctx.sectionCard('');
      card.classList.add('edp-card--wide');
      (card.querySelector('.edp-section-card-title') as HTMLElement | null)?.remove();
      for (const item of filtered.slice(0, 25)) {
        const newsRow = ctx.el('div', 'cp-news-row');
        if (item.image) {
          const img = ctx.el('img', 'cp-news-img') as HTMLImageElement;
          img.src = sanitizeUrl(item.image);
          img.alt = '';
          img.loading = 'lazy';
          img.onerror = () => img.remove();
          newsRow.append(img);
        }
        const info = ctx.el('div', 'cp-news-info');
        const headline = ctx.el('a', 'cp-news-headline') as HTMLAnchorElement;
        headline.textContent = item.headline;
        if (item.url) {
          headline.href = sanitizeUrl(item.url);
          headline.target = '_blank';
          headline.rel = 'noopener noreferrer';
          applyArticleLinkDataset(headline, {
            url: item.url,
            title: item.headline,
            source: item.source,
            publishedAt: new Date(item.datetime * 1000),
          });
        }
        info.append(headline);
        const meta = ctx.el('div', 'cp-news-meta');
        meta.append(ctx.el('span', 'cp-news-source', item.source));
        meta.append(ctx.el('span', 'cp-news-date', fmtDate(new Date(item.datetime * 1000).toISOString())));
        info.append(meta);
        if (item.summary) {
          info.append(ctx.el('p', 'cp-news-summary', item.summary.slice(0, 150) + (item.summary.length > 150 ? '…' : '')));
        }
        newsRow.append(info);
        body.append(newsRow);
      }
      listWrap.append(card);
    };

    renderList(this.newsCategory);

    filterBar.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest('.cp-news-cat-chip') as HTMLElement | null;
      if (!chip || !chip.dataset.cat) return;
      this.newsCategory = chip.dataset.cat;
      filterBar.querySelectorAll('.cp-news-cat-chip').forEach(c => c.classList.remove('cp-news-cat-active'));
      chip.classList.add('cp-news-cat-active');
      renderList(this.newsCategory);
    });
  }

  // ─── Options Tab ─────────────────────────────────────────────────────────

  private renderOptionsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    if (data.optionChain.length === 0) {
      content.append(ctx.makeEmpty('Options data unavailable'));
      return;
    }

    const currentPrice = data.quote?.price ?? 0;

    // Expiry selector
    const expiryBar = ctx.el('div', 'cp-options-expiry-bar');
    for (let i = 0; i < Math.min(data.optionChain.length, 8); i++) {
      const expiry = data.optionChain[i]!;
      const btn = ctx.el('button', `cp-options-expiry-btn${i === this.activeOptionExpiry ? ' cp-options-expiry-active' : ''}`);
      btn.textContent = formatExpiry(expiry.expirationDate);
      btn.dataset.idx = String(i);
      expiryBar.append(btn);
    }
    content.append(expiryBar);

    // Chain container
    const chainWrap = ctx.el('div', '');
    chainWrap.dataset.slot = 'options-chain';
    content.append(chainWrap);

    const renderChain = (idx: number) => {
      chainWrap.replaceChildren();
      const expiry = data.optionChain[idx];
      if (!expiry) return;

      // Build strike map: merge calls and puts by strike
      const strikeMap = new Map<number, { call?: typeof expiry.calls[0]; put?: typeof expiry.puts[0] }>();
      for (const c of expiry.calls) {
        strikeMap.set(c.strike, { call: c });
      }
      for (const p of expiry.puts) {
        const existing = strikeMap.get(p.strike) ?? {};
        strikeMap.set(p.strike, { ...existing, put: p });
      }

      // Sort strikes, filter to 10 nearest the current price
      const allStrikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);
      const nearStrikes = currentPrice > 0
        ? allStrikes.sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice)).slice(0, 16).sort((a, b) => a - b)
        : allStrikes.slice(0, 16);

      const table = ctx.el('div', 'cp-options-table');

      // Header
      const hdr = ctx.el('div', 'cp-options-row cp-options-hdr');
      for (const h of ['Bid', 'Ask', 'IV%', 'OI', 'Vol', 'CALLS']) hdr.append(ctx.el('span', 'cp-options-hdr-call', h));
      hdr.append(ctx.el('span', 'cp-options-strike-hdr', 'Strike'));
      for (const h of ['PUTS', 'Bid', 'Ask', 'IV%', 'OI', 'Vol']) hdr.append(ctx.el('span', 'cp-options-hdr-put', h));
      table.append(hdr);

      for (const strike of nearStrikes) {
        const entry = strikeMap.get(strike)!;
        const isAtm = currentPrice > 0 && Math.abs(strike - currentPrice) / currentPrice < 0.02;
        const r2 = ctx.el('div', `cp-options-row${isAtm ? ' cp-options-atm' : ''}`);

        // Call side
        if (entry.call) {
          r2.append(ctx.el('span', 'cp-options-cell cp-options-call', fmtMetric(entry.call.bid)));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-call', fmtMetric(entry.call.ask)));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-call', fmtPercent(entry.call.impliedVolatility * 100)));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-call cp-options-oi', entry.call.openInterest ? String(entry.call.openInterest) : '-'));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-call cp-options-vol', entry.call.volume ? String(entry.call.volume) : '—'));
        } else {
          for (let j = 0; j < 4; j++) r2.append(ctx.el('span', 'cp-options-cell cp-options-call', '—'));
        }

        // Strike
        const strikeEl = ctx.el('span', 'cp-options-strike', fmtPrice(strike));
        if (entry.call?.inTheMoney) strikeEl.classList.add('cp-options-itm-call');
        if (entry.put?.inTheMoney) strikeEl.classList.add('cp-options-itm-put');
        r2.append(strikeEl);

        // Put side
        if (entry.put) {
          r2.append(ctx.el('span', 'cp-options-cell cp-options-put', fmtMetric(entry.put.bid)));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-put', fmtMetric(entry.put.ask)));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-put', fmtPercent(entry.put.impliedVolatility * 100)));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-put cp-options-oi', entry.put.openInterest ? String(entry.put.openInterest) : '-'));
          r2.append(ctx.el('span', 'cp-options-cell cp-options-put cp-options-vol', entry.put.volume ? String(entry.put.volume) : '—'));
        } else {
          for (let j = 0; j < 4; j++) r2.append(ctx.el('span', 'cp-options-cell cp-options-put', '—'));
        }

        table.append(r2);
      }

      chainWrap.append(table);
    };

    renderChain(this.activeOptionExpiry);

    expiryBar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.cp-options-expiry-btn') as HTMLElement | null;
      if (!btn || !btn.dataset.idx) return;
      this.activeOptionExpiry = parseInt(btn.dataset.idx, 10);
      expiryBar.querySelectorAll('.cp-options-expiry-btn').forEach(b => b.classList.remove('cp-options-expiry-active'));
      btn.classList.add('cp-options-expiry-active');
      renderChain(this.activeOptionExpiry);
    });
  }

  // ─── Holders Tab ─────────────────────────────────────────────────────────

  private renderHoldersTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const hasInstitutional = data.ownership.length > 0;
    const hasEtfs = data.etfHoldings.length > 0;

    if (!hasInstitutional && !hasEtfs) {
      content.append(ctx.makeEmpty('Holder data unavailable'));
      return;
    }

    // ── Institutional holders ────────────────────────────────────────────────
    if (hasInstitutional) {
      const [card, body] = ctx.sectionCard('Top Institutional Holders');
      card.classList.add('edp-card--wide');

      const hdr = ctx.el('div', 'cp-holders-row cp-holders-hdr');
      hdr.append(ctx.el('span', 'cp-holders-name', 'Institution'));
      hdr.append(ctx.el('span', 'cp-holders-shares', 'Shares'));
      hdr.append(ctx.el('span', 'cp-holders-pct', '%'));
      hdr.append(ctx.el('span', 'cp-holders-change', 'Change'));
      hdr.append(ctx.el('span', 'cp-holders-open-cell', 'Open'));
      body.append(hdr);

      const maxShares = Math.max(...data.ownership.map(h => h.shares));

      for (const holder of data.ownership) {
        const r2 = ctx.el('div', 'cp-holders-row');
        const nameWrap = ctx.el('div', 'cp-holders-name-wrap');
        nameWrap.append(ctx.el('div', 'cp-holders-name', holder.institutionName));
        const metaText = [holder.latestFilingType || '13F-HR', holder.filingDate ? fmtDate(holder.filingDate) : '']
          .filter(Boolean).join(' · ');
        if (metaText) nameWrap.append(ctx.el('div', 'cp-holders-meta', metaText));
        const barWrap = ctx.el('div', 'cp-holders-bar-wrap');
        const bar = ctx.el('div', 'cp-holders-bar');
        bar.style.width = maxShares > 0 ? ((holder.shares / maxShares) * 100) + '%' : '0%';
        barWrap.append(bar);
        nameWrap.append(barWrap);
        r2.append(nameWrap);
        r2.append(ctx.el('span', 'cp-holders-shares', fmtShares(holder.shares)));
        r2.append(ctx.el('span', 'cp-holders-pct', fmtMetric(holder.percent, '%')));
        const changeClass = holder.change >= 0 ? 'cp-holders-change cp-positive' : 'cp-holders-change cp-negative';
        r2.append(ctx.el('span', changeClass, (holder.change >= 0 ? '+' : '') + fmtShares(Math.abs(holder.change))));
        r2.append(buildOpenInstitutionButton(ctx, holder));
        body.append(r2);
      }

      const dateNote = data.ownership[0]?.filingDate
        ? ctx.el('div', 'cp-holders-note', 'Based on 13F filings as of ' + fmtDate(data.ownership[0].filingDate))
        : null;
      if (dateNote) body.append(dateNote);

      content.append(card);
    }

    // ── ETF & Fund holders ───────────────────────────────────────────────────
    if (hasEtfs) {
      const [etfCard, etfBody] = ctx.sectionCard('ETFs & Funds');
      etfCard.classList.add('edp-card--wide');

      const etfHdr = ctx.el('div', 'cp-holders-row cp-holders-hdr cp-holders-etf-row');
      etfHdr.append(ctx.el('span', 'cp-holders-name', 'Fund / ETF'));
      etfHdr.append(ctx.el('span', 'cp-holders-shares', 'Shares'));
      etfHdr.append(ctx.el('span', 'cp-holders-pct', '%'));
      etfHdr.append(ctx.el('span', 'cp-holders-change', 'Change'));
      etfBody.append(etfHdr);

      const maxEtfShares = Math.max(...data.etfHoldings.map(h => h.share));

      for (const fund of data.etfHoldings) {
        const r = ctx.el('div', 'cp-holders-row cp-holders-etf-row');

        const nameWrap = ctx.el('div', 'cp-holders-name-wrap');

        // Badge: ETF or Fund
        const isEtf = /\betf\b|trust\b|spdr|ishares|vanguard|invesco|xtrackers|wisdomtree|direxion|proshares/i.test(fund.name);
        const badge = ctx.el('span', isEtf ? 'cp-fund-badge cp-fund-badge-etf' : 'cp-fund-badge cp-fund-badge-fund', isEtf ? 'ETF' : 'FUND');
        const nameLine = ctx.el('div', 'cp-holders-name');
        nameLine.append(badge, document.createTextNode(' ' + fund.name));

        nameWrap.append(nameLine);
        if (fund.filingDate) nameWrap.append(ctx.el('div', 'cp-holders-meta', fmtDate(fund.filingDate)));

        // Mini bar
        const barWrap = ctx.el('div', 'cp-holders-bar-wrap');
        const bar = ctx.el('div', 'cp-holders-bar cp-holders-bar-etf');
        bar.style.width = maxEtfShares > 0 ? ((fund.share / maxEtfShares) * 100) + '%' : '0%';
        barWrap.append(bar);
        nameWrap.append(barWrap);

        r.append(nameWrap);
        r.append(ctx.el('span', 'cp-holders-shares', fmtShares(fund.share)));
        r.append(ctx.el('span', 'cp-holders-pct', fmtMetric(fund.percent, '%')));

        const changeClass = fund.change >= 0 ? 'cp-holders-change cp-positive' : 'cp-holders-change cp-negative';
        r.append(ctx.el('span', changeClass, (fund.change >= 0 ? '+' : '') + fmtShares(Math.abs(fund.change))));

        etfBody.append(r);
      }

      const etfNote = data.etfHoldings[0]?.filingDate
        ? ctx.el('div', 'cp-holders-note', 'Based on fund filings as of ' + fmtDate(data.etfHoldings[0].filingDate))
        : null;
      if (etfNote) etfBody.append(etfNote);

      content.append(etfCard);
    }
  }

  // ─── Valuation Tab ───────────────────────────────────────────────────────

  private renderValuationTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const m = data.metrics;
    const periods = data.financialsQuarterly.length > 0 ? data.financialsQuarterly : data.financialsAnnual;
    const latestRevenue = getLatestFinancialValue(periods, 'revenue');
    const latestNetIncome = getLatestFinancialValue(periods, 'netIncome');
    const latestDebt = getLatestFinancialValue(periods, 'debt');
    const latestCash = getLatestFinancialValue(periods, 'cash');
    const latestAssets = getLatestFinancialValue(periods, 'assets');
    const latestEquity = getLatestFinancialValue(periods, 'equity');
    const latestOcf = getLatestFinancialValue(periods, 'operatingCashFlow');
    const latestEbitda = getLatestFinancialValue(periods, 'ebitda');
    const latestEbit = getLatestFinancialValue(periods, 'ebit');
    const marketCap = data.profile?.marketCapitalization
      ? data.profile.marketCapitalization * 1_000_000
      : m?.marketCapitalization;
    const ev = marketCap !== undefined ? marketCap + (latestDebt ?? 0) - (latestCash ?? 0) : undefined;

    if (!m && !marketCap) {
      content.append(ctx.makeEmpty('Valuation data unavailable'));
      return;
    }

    const [multCard, multBody] = ctx.sectionCard('Trading Multiples');
    const multGrid = ctx.el('div', 'cp-metrics-grid');
    const multiples: [string, string][] = [
      ['P/E (TTM)',    fmtMetric(m?.peBasicExclExtraTTM || m?.peAnnual, 'x')],
      ['P/B',         fmtMetric(m?.pbAnnual, 'x')],
      ['P/S',         fmtMetric(m?.psAnnual, 'x')],
      ['P/FCF',       fmtMetric(m?.freeCashFlowPerShareAnnual && m?.revenuePerShareAnnual
        ? (data.quote?.price ?? 0) / m.freeCashFlowPerShareAnnual
        : undefined, 'x')],
      ['EV',          fmtFinancialValue(ev)],
      ['EV/Revenue',  fmtMetric(ev && latestRevenue ? ev / latestRevenue : undefined, 'x')],
      ['EV/EBITDA',   fmtMetric(ev !== undefined && latestEbitda ? ev / latestEbitda : undefined, 'x')],
      ['EV/EBIT',     fmtMetric(ev !== undefined && latestEbit ? ev / latestEbit : undefined, 'x')],
      ['PEG',         fmtMetric(
        (m?.peBasicExclExtraTTM || m?.peAnnual) && m?.epsGrowthTTMYoy && m.epsGrowthTTMYoy > 0
          ? ((m.peBasicExclExtraTTM ?? m.peAnnual)!) / (m.epsGrowthTTMYoy * 100)
          : undefined, 'x')],
      ['FCF Yield',   fmtMetric(
        m?.freeCashFlowPerShareAnnual && (data.quote?.price ?? 0) > 0
          ? (m.freeCashFlowPerShareAnnual / (data.quote?.price ?? 1)) * 100
          : undefined, '%')],
      ['Beta',        fmtMetric(m?.beta)],
    ];
    for (const [label, value] of multiples) {
      const cell = ctx.el('div', 'cp-metric-cell');
      cell.append(ctx.el('span', 'cp-metric-label', label));
      cell.append(ctx.el('span', 'cp-metric-value', value));
      multGrid.append(cell);
    }
    multBody.append(multGrid);
    content.append(multCard);

    if (m) {
      const [qualCard, qualBody] = ctx.sectionCard('Quality & Returns');
      const qualGrid = ctx.el('div', 'cp-metrics-grid');
      const quality: [string, string][] = [
        ['ROE',          fmtPercent(m.roeRfy)],
        ['ROA',          fmtPercent(m.roaRfy)],
        ['ROI',          fmtPercent(m.roiAnnual)],
        ['Gross Margin', fmtPercent(m.grossMarginAnnual)],
        ['Op. Margin',   fmtPercent(m.operatingMarginAnnual)],
        ['Net Margin',   fmtPercent(m.netProfitMarginAnnual)],
        ['D/E',          fmtMetric(m.totalDebtToEquityAnnual)],
        ['Current R.',   fmtMetric(m.currentRatioAnnual)],
      ];
      for (const [label, value] of quality) {
        const cell = ctx.el('div', 'cp-metric-cell');
        cell.append(ctx.el('span', 'cp-metric-label', label));
        cell.append(ctx.el('span', 'cp-metric-value', value));
        qualGrid.append(cell);
      }
      qualBody.append(qualGrid);
      content.append(qualCard);
    }

    if (marketCap !== undefined || latestDebt !== undefined) {
      const [structCard, structBody] = ctx.sectionCard('Capital Structure');
      structBody.append(buildCapitalStructure(ctx, [
        ['Market cap',       marketCap,    '#2dd4bf'],
        ['Total debt',       latestDebt,   '#f59e0b'],
        ['Cash & equiv.',    latestCash,   '#22d3ee'],
        ['Enterprise value', ev,           '#3b82f6'],
      ]));
      content.append(structCard);
    }

    if (latestRevenue !== undefined || latestNetIncome !== undefined || latestOcf !== undefined) {
      const [growCard, growBody] = ctx.sectionCard('Growth & Cash Generation');
      const growItems: [string, string][] = [
        ['Revenue (LTM)',    fmtFinancialValue(latestRevenue)],
        ['Net income (LTM)', fmtFinancialValue(latestNetIncome)],
        ['Op. cash flow',    fmtFinancialValue(latestOcf)],
        ['Total assets',     fmtFinancialValue(latestAssets)],
        ['Equity',           fmtFinancialValue(latestEquity)],
        ['Rev. growth YoY',  fmtPercent(m?.revenueGrowthTTMYoy)],
        ['EPS growth YoY',   fmtPercent(m?.epsGrowthTTMYoy)],
      ];
      for (const [label, value] of growItems) {
        growBody.append(row(ctx, label, value));
      }
      content.append(growCard);
    }

    if (data.peers.length > 0) {
      const [peersCard, peersBody] = ctx.sectionCard('Peer Comparison');
      const note = ctx.el('p', 'edp-description', 'Click a peer to open its detail and compare manually.');
      peersBody.append(note);
      const peersWrap = ctx.el('div', 'cp-peers');
      for (const peer of data.peers.slice(0, 12)) {
        const chip = ctx.el('button', 'cp-peer-chip');
        chip.textContent = peer;
        chip.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: { type: 'company', data: { ticker: peer, name: peer } },
          }));
        });
        peersWrap.append(chip);
      }
      peersBody.append(peersWrap);
      content.append(peersCard);
    }
  }

  // ─── Estimates Tab ───────────────────────────────────────────────────────

  private renderEstimatesTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const hasData = data.epsEstimates.data.length > 0
      || data.revenueEstimates.data.length > 0
      || data.earningsSurprises.length > 0
      || data.recommendations.length > 0
      || data.priceTarget !== null
      || data.ratingActions.length > 0;

    if (!hasData) {
      content.append(ctx.makeEmpty('Estimates & analyst data unavailable'));
      return;
    }

    if (data.priceTarget) {
      const [card, body] = ctx.sectionCard('Price Target Consensus');
      const pt = data.priceTarget;
      if (data.quote?.price) {
        body.append(buildPriceTargetGauge(ctx, data.quote.price, pt.targetLow, pt.targetMean, pt.targetHigh));
        const statsRow = ctx.el('div', 'cp-forecast-stats');
        for (const [label, value, cls] of [
          ['Low',    fmtPrice(pt.targetLow),    'cp-negative'],
          ['Mean',   fmtPrice(pt.targetMean),   ''],
          ['Median', fmtPrice(pt.targetMedian), ''],
          ['High',   fmtPrice(pt.targetHigh),   'cp-positive'],
        ] as const) {
          const item = ctx.el('div', 'cp-forecast-stat-item');
          item.append(ctx.el('span', 'cp-forecast-stat-label', label));
          item.append(ctx.el('span', `cp-forecast-stat-value ${cls}`.trim(), value));
          statsRow.append(item);
        }
        body.append(statsRow);
        const upside = ((pt.targetMean - data.quote.price) / data.quote.price) * 100;
        body.append(row(ctx, 'Implied upside (mean)', fmtChange(upside)));
      } else {
        body.append(row(ctx, 'Mean', fmtPrice(pt.targetMean)));
        body.append(row(ctx, 'High', fmtPrice(pt.targetHigh)));
        body.append(row(ctx, 'Low', fmtPrice(pt.targetLow)));
      }
      if (pt.lastUpdated) body.append(ctx.el('div', 'cp-forecast-updated', 'Updated ' + fmtDate(pt.lastUpdated)));
      content.append(card);
    }

    if (data.recommendations.length > 0) {
      const [card, body] = ctx.sectionCard('Analyst Consensus');
      card.classList.add('cp-card-with-action', 'edp-card--wide');
      const detailButton = ctx.el('button', 'cp-card-action-btn', 'Open details') as HTMLButtonElement;
      detailButton.type = 'button';
      detailButton.addEventListener('click', () => ctx.navigate(buildAnalystDetailsView(ctx, data)));
      card.append(detailButton);
      const latest = data.recommendations[0]!;
      const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
      if (total > 0) {
        const buys = latest.strongBuy + latest.buy;
        const sells = latest.sell + latest.strongSell;
        const summaryRow = ctx.el('div', 'cp-consensus-summary');
        summaryRow.append(buildConsensusCount(ctx, buys, 'Buy', 'cp-positive'));
        summaryRow.append(buildConsensusCount(ctx, latest.hold, 'Hold', 'cp-neutral'));
        summaryRow.append(buildConsensusCount(ctx, sells, 'Sell', 'cp-negative'));
        body.append(summaryRow);
        const ratingBar = ctx.el('div', 'cp-rating-bar');
        for (const [count, color, label] of [
          [latest.strongBuy,  '#16a34a', 'Strong Buy'],
          [latest.buy,        '#22c55e', 'Buy'],
          [latest.hold,       '#eab308', 'Hold'],
          [latest.sell,       '#f97316', 'Sell'],
          [latest.strongSell, '#ef4444', 'Strong Sell'],
        ] as const) {
          if (count === 0) continue;
          const seg = ctx.el('div', 'cp-rating-segment');
          seg.style.width = ((count / total) * 100) + '%';
          seg.style.backgroundColor = color;
          seg.title = `${label}: ${count}`;
          seg.textContent = String(count);
          ratingBar.append(seg);
        }
        body.append(ratingBar);
      }
      content.append(card);
    }

    if (data.epsEstimates.data.length > 0 || data.revenueEstimates.data.length > 0) {
      const [card, body] = ctx.sectionCard('Forward Estimates');
      card.classList.add('edp-card--wide');
      if (data.epsEstimates.data.length > 0) body.append(buildEstimateStrip(ctx, 'EPS Estimates', data.epsEstimates, false));
      if (data.revenueEstimates.data.length > 0) body.append(buildEstimateStrip(ctx, 'Revenue Estimates', data.revenueEstimates, true));
      content.append(card);
    }

    if (data.earningsSurprises.length > 0) {
      const [card, body] = ctx.sectionCard('Earnings Surprises');
      card.classList.add('edp-card--wide');
      body.append(buildEarningsTable(ctx, data.earningsSurprises.slice(0, 10)));
      content.append(card);
    }

    if (data.ratingActions.length > 0) {
      const [card, body] = ctx.sectionCard('Firm Rating Actions');
      card.classList.add('edp-card--wide');
      const table = ctx.el('div', 'cp-analyst-action-table');
      table.append(simpleTableRow(ctx, ['Date', 'Firm', 'Action', 'From', 'To'], true));
      for (const action of data.ratingActions.slice(0, 20)) {
        table.append(simpleTableRow(ctx, [
          action.gradeTime ? fmtDate(action.gradeTime) : '-',
          action.firm || '-',
          action.action || '-',
          action.fromGrade || '-',
          action.toGrade || '-',
        ]));
      }
      body.append(table);
      content.append(card);
    }
  }

  // ─── Insiders Tab ────────────────────────────────────────────────────────

  private renderInsidersTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    if (data.insiderTxns.length === 0) {
      content.append(ctx.makeEmpty('No insider transaction data available'));
      return;
    }

    // Summary counts
    const buys = data.insiderTxns.filter(tx => tx.transactionCode === 'P');
    const sales = data.insiderTxns.filter(tx => tx.transactionCode === 'S');
    const buyValue = buys.reduce((sum, tx) => sum + Math.abs(tx.transactionValue ?? 0), 0);
    const sellValue = sales.reduce((sum, tx) => sum + Math.abs(tx.transactionValue ?? 0), 0);

    const [summCard, summBody] = ctx.sectionCard('Insider Activity Summary');
    const summGrid = ctx.el('div', 'cp-metrics-grid');
    for (const [label, value] of [
      ['Buy txns',    String(buys.length)],
      ['Sell txns',   String(sales.length)],
      ['Buy value',   fmtLargeNumber(buyValue)],
      ['Sell value',  fmtLargeNumber(sellValue)],
    ] as [string, string][]) {
      const cell = ctx.el('div', 'cp-metric-cell');
      cell.append(ctx.el('span', 'cp-metric-label', label));
      cell.append(ctx.el('span', 'cp-metric-value', value));
      summGrid.append(cell);
    }
    summBody.append(summGrid);
    content.append(summCard);

    const [txnCard, txnBody] = ctx.sectionCard('Transaction History');
    txnCard.classList.add('edp-card--wide');
    const hdr = ctx.el('div', 'cp-holders-row cp-holders-hdr');
    hdr.append(ctx.el('span', 'cp-holders-name', 'Insider'));
    hdr.append(ctx.el('span', 'cp-holders-shares', 'Shares'));
    hdr.append(ctx.el('span', 'cp-holders-pct', 'Type'));
    hdr.append(ctx.el('span', 'cp-holders-change', 'Value'));
    hdr.append(ctx.el('span', 'cp-holders-change', 'Date'));
    txnBody.append(hdr);

    for (const tx of data.insiderTxns.slice(0, 30)) {
      const isPurchase = tx.transactionCode === 'P';
      const isSale = tx.transactionCode === 'S';
      const r2 = ctx.el('div', 'cp-holders-row');
      r2.append(ctx.el('span', 'cp-holders-name', tx.name));
      r2.append(ctx.el('span', 'cp-holders-shares', tx.change ? fmtShares(Math.abs(tx.change)) : '-'));
      const badge = ctx.el('span',
        isPurchase ? 'cp-insider-badge cp-positive' : isSale ? 'cp-insider-badge cp-negative' : 'cp-insider-badge',
        isPurchase ? 'Buy' : isSale ? 'Sale' : tx.transactionCode || '-');
      r2.append(badge);
      r2.append(ctx.el('span', 'cp-holders-change', tx.transactionValue ? fmtLargeNumber(Math.abs(tx.transactionValue)) : '-'));
      r2.append(ctx.el('span', 'cp-holders-change', tx.transactionDate || '-'));
      txnBody.append(r2);
    }
    content.append(txnCard);
  }

  // ─── Events Tab ──────────────────────────────────────────────────────────

  private renderEventsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const hasAnyData = data.earningsCalls.length > 0
      || data.earningsSurprises.length > 0
      || data.dividends.length > 0
      || data.stockSplits.length > 0
      || data.upcomingEarnings !== null;

    if (!hasAnyData) {
      content.append(ctx.makeEmpty('No events data available'));
      return;
    }

    // ── Build unified event list ──────────────────────────────────────────
    const eventMap = new Map<string, EvCard>();

    const getSurprise = (reportDate: string, quarter: string): EarningsSurprise | undefined => {
      let s = data.earningsSurprises.find((x) => x.period === reportDate);
      if (!s && quarter) {
        const qm = quarter.match(/Q(\d)/);
        const ym = quarter.match(/(\d{4})/);
        if (qm && ym) {
          s = data.earningsSurprises.find(
            (x) => x.quarter === parseInt(qm[1]!) && x.year === parseInt(ym[1]!),
          );
        }
      }
      return s;
    };

    for (const call of data.earningsCalls) {
      const dateKey = call.filingDate || call.reportDate || '';
      const mapKey = call.quarter || dateKey;
      if (!mapKey) continue;
      const existing = eventMap.get(mapKey);
      const surprise = getSurprise(call.reportDate, call.quarter);
      const kindPriority = (k: EarningsCallTranscript['kind']) =>
        k === 'earnings' ? 0 : k === 'transcript' ? 1 : k === 'press-release' ? 2 : 3;
      if (existing) {
        const ek = existing.kind as EarningsCallTranscript['kind'];
        if (kindPriority(call.kind) < kindPriority(ek)) existing.kind = call.kind;
        if (call.transcriptId && !existing.transcriptRef) existing.transcriptRef = call;
        if (call.indexUrl && !existing.indexUrl) existing.indexUrl = call.indexUrl;
      } else {
        const isQ4 = call.quarter?.startsWith('Q4');
        eventMap.set(mapKey, {
          key: mapKey, kind: call.kind, title: buildEventTitle(call),
          quarter: call.quarter, date: dateKey,
          year: parseInt(dateKey.slice(0, 4) || '0') || 0,
          isAnnual: isQ4 || false,
          epsActual: surprise?.actual ?? null, epsEstimate: surprise?.estimate ?? null,
          epsSurprisePct: surprise?.surprisePercent ?? null,
          transcriptRef: call.transcriptId ? call : undefined, indexUrl: call.indexUrl || '',
        });
      }
    }

    // Merge dividends
    for (const div of data.dividends) {
      const dateStr = div.exDate || div.date;
      if (!dateStr) continue;
      const key = `dividend-${dateStr}`;
      const year = parseInt(dateStr.slice(0, 4) || '0') || 0;
      eventMap.set(key, {
        key, kind: 'dividend', title: 'Dividend', quarter: '', date: dateStr, year,
        isAnnual: false, epsActual: null, epsEstimate: null, epsSurprisePct: null,
        amount: div.amount, indexUrl: '',
      });
    }

    // Merge splits
    for (const split of data.stockSplits) {
      if (!split.date) continue;
      const key = `split-${split.date}`;
      const year = parseInt(split.date.slice(0, 4) || '0') || 0;
      eventMap.set(key, {
        key, kind: 'split', title: 'Stock Split', quarter: '', date: split.date, year,
        isAnnual: false, epsActual: null, epsEstimate: null, epsSurprisePct: null,
        splitRatio: `${split.toFactor}:${split.fromFactor}`, indexUrl: '',
      });
    }

    const allEvents = [...eventMap.values()].sort((a, b) => b.date.localeCompare(a.date));

    // ── Filter chips ──────────────────────────────────────────────────────
    const filterBar = ctx.el('div', 'cp-ev-filter-bar');
    const filters: Array<[typeof this.eventsFilter, string]> = [
      ['all', 'All'],
      ['earnings', 'Earnings'],
      ['dividends', 'Dividends'],
      ['splits', 'Splits'],
    ];
    for (const [val, label] of filters) {
      const chip = ctx.el('button', `cp-ev-chip${this.eventsFilter === val ? ' is-active' : ''}`) as HTMLButtonElement;
      chip.type = 'button';
      chip.textContent = label;
      chip.addEventListener('click', () => {
        this.eventsFilter = val;
        content.replaceChildren();
        this.renderEventsTab(content, data, ctx);
      });
      filterBar.append(chip);
    }
    content.append(filterBar);

    // ── Upcoming earnings (above year groups) ─────────────────────────────
    if (data.upcomingEarnings && (this.eventsFilter === 'all' || this.eventsFilter === 'earnings')) {
      const ue = data.upcomingEarnings;
      content.append(ctx.el('div', 'cp-ev-year', 'Upcoming'));
      const upcomingGrid = ctx.el('div', 'cp-ev-grid cp-ev-upcoming');
      upcomingGrid.append(buildEvCard(ctx, {
        key: 'upcoming', kind: 'upcoming', title: 'Next Earnings',
        quarter: ue.quarter ? `Q${ue.quarter} ${ue.year}` : String(ue.year),
        date: ue.date, year: ue.year,
        isAnnual: false, isUpcoming: true,
        epsActual: null, epsEstimate: ue.epsEstimate ?? null, epsSurprisePct: null,
        hour: ue.hour, indexUrl: '',
      }));
      content.append(upcomingGrid);
    }

    // ── Apply filter ──────────────────────────────────────────────────────
    const filtered = allEvents.filter((ev) => {
      if (this.eventsFilter === 'earnings')  return ev.kind === 'earnings' || ev.kind === 'transcript' || ev.kind === 'press-release' || ev.kind === 'filing';
      if (this.eventsFilter === 'dividends') return ev.kind === 'dividend';
      if (this.eventsFilter === 'splits')    return ev.kind === 'split';
      return true;
    });

    if (filtered.length === 0 && !(data.upcomingEarnings && (this.eventsFilter === 'all' || this.eventsFilter === 'earnings'))) {
      content.append(ctx.makeEmpty('No events in this category'));
      return;
    }

    // ── Group by year ─────────────────────────────────────────────────────
    const byYear = new Map<number, EvCard[]>();
    for (const ev of filtered) {
      if (!byYear.has(ev.year)) byYear.set(ev.year, []);
      byYear.get(ev.year)!.push(ev);
    }

    for (const [year, yearCards] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
      content.append(ctx.el('div', 'cp-ev-year', String(year || '—')));
      const grid = ctx.el('div', 'cp-ev-grid');
      for (const ev of yearCards) grid.append(buildEvCard(ctx, ev));
      content.append(grid);
    }
  }

  // ─── Filings Tab ─────────────────────────────────────────────────────────

  private renderFilingsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    if (data.ownership.length > 0) {
      const [ownersCard, ownersBody] = ctx.sectionCard('13F Ownership Snapshot');
      ownersCard.classList.add('edp-card--wide');
      const note = ctx.el('p', 'edp-description');
      note.textContent = `Latest institutional ownership disclosures tied to ${data.ticker} via 13F reporting.`;
      ownersBody.append(note);

      for (const holder of data.ownership.slice(0, 10)) {
        const rowEl = ctx.el('div', 'edp-disclosure-row');
        rowEl.append(ctx.el('span', 'edp-disclosure-badge', holder.latestFilingType || '13F-HR'));
        const info = ctx.el('div', 'edp-disclosure-info');
        info.append(ctx.el('span', 'edp-disclosure-name', holder.institutionName));
        const detailBits = [
          holder.change ? `QoQ ${holder.change >= 0 ? '+' : '-'}${fmtShares(Math.abs(holder.change))} shares` : '',
          holder.percent ? `${holder.percent.toFixed(2)}% of shares` : '',
        ].filter(Boolean);
        info.append(ctx.el('span', 'edp-disclosure-detail', detailBits.join(' · ') || 'Recent institutional holder disclosure'));
        rowEl.append(info);
        rowEl.append(buildOpenInstitutionButton(ctx, holder, holder.filingDate ? fmtDate(holder.filingDate) : 'Open'));
        ownersBody.append(rowEl);
      }

      content.append(ownersCard);
    }

    if (data.filings.length === 0) {
      if (data.ownership.length === 0) {
        content.append(ctx.makeEmpty('No filings found'));
      }
      return;
    }

    // Group filings by year
    const byYear = new Map<string, SecFiling[]>();
    for (const filing of data.filings) {
      const year = filing.filedAt ? filing.filedAt.slice(0, 4) : 'Unknown';
      const arr = byYear.get(year) ?? [];
      arr.push(filing);
      byYear.set(year, arr);
    }

    // Sort years descending
    const years = Array.from(byYear.keys()).sort((a, b) => b.localeCompare(a));

    for (const year of years) {
      const [card, body] = ctx.sectionCard(`Issuer SEC Filings · ${year}`);
      card.classList.add('edp-card--wide');
      for (const filing of byYear.get(year)!) {
        body.append(buildFilingRow(ctx, filing));
      }
      content.append(card);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCapitalStructure(
  ctx: EntityRenderContext,
  items: Array<[string, number | undefined, string]>,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-capital-structure');
  const max = Math.max(...items.map(([, value]) => Math.abs(value ?? 0)), 1);
  for (const [label, value, color] of items) {
    const rowEl = ctx.el('div', 'cp-capital-row');
    rowEl.append(ctx.el('span', 'cp-capital-label', label));
    const track = ctx.el('div', 'cp-capital-track');
    const bar = ctx.el('div', 'cp-capital-bar');
    bar.style.width = `${Math.max(3, (Math.abs(value ?? 0) / max) * 100)}%`;
    bar.style.backgroundColor = color;
    track.append(bar);
    rowEl.append(track);
    rowEl.append(ctx.el('span', 'cp-capital-value', fmtFinancialValue(value)));
    wrap.append(rowEl);
  }
  return wrap;
}

function buildOwnershipSnapshot(
  ctx: EntityRenderContext,
  holders: CompanyInstitutionHolder[],
  totalHeld: number,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-ownership-snapshot');
  const ring = ctx.el('div', 'cp-ownership-ring');
  ring.style.setProperty('--ownership-pct', String(Math.min(Math.max(totalHeld, 0), 100)));
  ring.append(ctx.el('span', 'cp-ownership-ring-value', `${totalHeld.toFixed(1)}%`));
  wrap.append(ring);
  const list = ctx.el('div', 'cp-ownership-list');
  for (const holder of holders) {
    const rowEl = ctx.el('div', 'cp-ownership-row');
    rowEl.append(ctx.el('span', 'cp-ownership-name', holder.institutionName));
    rowEl.append(ctx.el('span', 'cp-ownership-value', holder.percent ? `${holder.percent.toFixed(2)}%` : fmtShares(holder.shares)));
    list.append(rowEl);
  }
  wrap.append(list);
  return wrap;
}

function buildFinancialChart(
  ctx: EntityRenderContext,
  periods: NormalizedFinancialPeriod[],
  statement: FinancialStatementKind,
): HTMLElement {
  const metric: [keyof NormalizedFinancialPeriod['values'], string] = statement === 'balance'
    ? ['assets', '#3b82f6']
    : statement === 'cash'
      ? ['operatingCashFlow', '#22d3ee']
      : ['revenue', '#3b82f6'];
  const values = periods.map((period) => period.values[metric[0]] ?? 0);
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const chart = ctx.el('div', 'cp-financial-chart');
  periods.forEach((period, index) => {
    const value = values[index] ?? 0;
    const barWrap = ctx.el('div', 'cp-financial-chart-bar-wrap');
    const bar = ctx.el('div', value >= 0 ? 'cp-financial-chart-bar' : 'cp-financial-chart-bar is-negative');
    bar.style.height = `${Math.max(4, (Math.abs(value) / max) * 100)}%`;
    bar.style.backgroundColor = metric[1];
    bar.title = `${period.label}: ${fmtFinancialValue(value)}`;
    barWrap.append(bar, ctx.el('span', 'cp-financial-chart-label', period.label));
    chart.append(barWrap);
  });
  return chart;
}

function fmtCellValue(value: number | null, format?: FinancialFormatType): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (format === 'perShare') return '$' + value.toFixed(2);
  if (format === 'shares') return fmtShares(value);
  return fmtFinancialValue(value);
}

function buildFinancialTable(
  ctx: EntityRenderContext,
  periods: NormalizedFinancialPeriod[],
  rows: FinancialDisplayRow[],
  allPeriods: NormalizedFinancialPeriod[],
  frequency: FinancialFrequency,
  currency: string,
  collapsedParents: Set<FinancialMetricKey>,
  onToggleParent: (key: FinancialMetricKey) => void,
): HTMLElement {
  if (rows.length === 0) return ctx.makeEmpty('No matching financial rows');

  const wrap = ctx.el('div', 'cp-financial-table-wrap');
  const table = ctx.el('div', 'cp-financial-table');
  table.style.setProperty('--period-count', String(periods.length));

  // ── Header row ──────────────────────────────────────────────────────────
  const header = ctx.el('div', 'cp-financial-table-row cp-financial-table-header');
  header.append(ctx.el('span', 'cp-financial-row-label', `Metrics · Currency: ${currency}`));
  for (const period of periods) header.append(ctx.el('span', 'cp-financial-cell', period.label));
  table.append(header);

  // ── Data rows ────────────────────────────────────────────────────────────
  for (const rowItem of rows) {
    const isCollapsed = rowItem.isParent && collapsedParents.has(rowItem.key);

    // Row class list
    let rowClass = 'cp-financial-table-row';
    if (rowItem.highlight) rowClass += ' cp-fin-row-highlight';
    if (rowItem.indent > 0) rowClass += ` cp-fin-row-indent-${rowItem.indent}`;
    if (rowItem.isParent) rowClass += ' cp-fin-row-parent';
    if (isCollapsed) rowClass += ' cp-fin-row-collapsed';

    const rowEl = ctx.el('div', rowClass);

    // Label cell — parent rows get a chevron toggle
    const labelEl = ctx.el('span', 'cp-financial-row-label');
    if (rowItem.isParent) {
      const chevron = ctx.el('span', `cp-fin-chevron${isCollapsed ? ' is-collapsed' : ''}`);
      chevron.textContent = isCollapsed ? '▶' : '▼';
      labelEl.append(chevron, document.createTextNode(' ' + rowItem.label));
      labelEl.classList.add('cp-fin-label-clickable');
      labelEl.addEventListener('click', () => onToggleParent(rowItem.key));
    } else {
      labelEl.textContent = rowItem.label;
    }
    rowEl.append(labelEl);

    // Value cells with inline YoY
    for (let colIdx = 0; colIdx < rowItem.values.length; colIdx++) {
      const value = rowItem.values[colIdx] ?? null;
      const cell = ctx.el('span', 'cp-financial-cell');
      cell.append(document.createTextNode(fmtCellValue(value, rowItem.format)));

      // Always compute + show YoY for every column
      const period = periods[colIdx];
      if (period && value !== null) {
        const prior = findPriorPeriod(period, allPeriods, frequency);
        const priorVal = prior?.values[rowItem.key] ?? null;
        const yoy = fmtYoy(value, priorVal);
        if (yoy) {
          const badge = document.createElement('span');
          const isPos = yoy.startsWith('+');
          badge.className = `cp-fin-yoy ${isPos ? 'cp-fin-yoy-pos' : 'cp-fin-yoy-neg'}`;
          badge.textContent = yoy;
          cell.append(badge);
        }
      }

      rowEl.append(cell);
    }

    table.append(rowEl);
  }

  wrap.append(table);
  return wrap;
}

/**
 * Finds the prior-year counterpart of a period within the full period array.
 * Quarterly: same quarter number, year − 1.
 * Annual: year − 1.
 */
function findPriorPeriod(
  period: NormalizedFinancialPeriod,
  allPeriods: NormalizedFinancialPeriod[],
  frequency: FinancialFrequency,
): NormalizedFinancialPeriod | undefined {
  if (frequency === 'annual') {
    return allPeriods.find((p) => p.year === period.year - 1);
  }
  return allPeriods.find((p) => p.quarter === period.quarter && p.year === period.year - 1);
}

function fmtYoy(current: number | null, prior: number | null | undefined): string | null {
  if (current === null || prior === null || prior === undefined || prior === 0) return null;
  const pct = (current - prior) / Math.abs(prior) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

/**
 * Wires bar-chart clicks to the table: clicking a bar highlights that period's
 * column in the table and dims the others. Clicking the same bar again clears
 * the selection. When a column is selected, YoY % badges appear in each cell.
 */
function wireFinancialChartSelection(
  chart: HTMLElement,
  tableWrap: HTMLElement,
  displayPeriods: NormalizedFinancialPeriod[],
  allPeriods: NormalizedFinancialPeriod[],
  rows: FinancialDisplayRow[],
  frequency: FinancialFrequency,
): void {
  const barWraps = [...chart.querySelectorAll<HTMLElement>('.cp-financial-chart-bar-wrap')];
  if (barWraps.length === 0) return;

  let activeIdx: number | null = null;

  const applySelection = (idx: number | null): void => {
    activeIdx = idx;

    // Bar states
    chart.classList.toggle('cp-fin-has-selection', idx !== null);
    barWraps.forEach((bw, i) => bw.classList.toggle('cp-fin-bar-active', i === idx));

    // Remove stale bar-level YoY badges
    chart.querySelectorAll<HTMLElement>('.cp-fin-bar-yoy').forEach((el) => el.remove());

    // Table column highlight/dim
    const tableRows = [...tableWrap.querySelectorAll<HTMLElement>('.cp-financial-table-row')];
    tableRows.forEach((row) => {
      const cells = [...row.querySelectorAll<HTMLElement>('.cp-financial-cell')];
      cells.forEach((cell, i) => {
        if (idx === null) {
          cell.classList.remove('cp-fin-col-active', 'cp-fin-col-dimmed');
        } else {
          cell.classList.toggle('cp-fin-col-active', i === idx);
          cell.classList.toggle('cp-fin-col-dimmed', i !== idx);
        }
      });
    });

    // Add bar-level YoY badge on the selected chart bar
    if (idx !== null) {
      const period = displayPeriods[idx];
      const barWrap = barWraps[idx];
      const primaryRow = rows[0];
      if (period && barWrap && primaryRow) {
        const prior = findPriorPeriod(period, allPeriods, frequency);
        if (prior) {
          const yoyBar = fmtYoy(primaryRow.values[idx] ?? null, prior.values[primaryRow.key] ?? null);
          if (yoyBar) {
            const barBadge = document.createElement('span');
            barBadge.className = `cp-fin-bar-yoy ${yoyBar.startsWith('+') ? 'cp-fin-yoy-pos' : 'cp-fin-yoy-neg'}`;
            barBadge.textContent = `${yoyBar} YoY`;
            barWrap.append(barBadge);
          }
        }
      }
    }
  };

  barWraps.forEach((bw, i) => {
    bw.style.cursor = 'pointer';
    bw.addEventListener('click', () => applySelection(activeIdx === i ? null : i));
  });
}

function percentFromRatio(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value * 100;
}

function buildStatisticsGrid(
  ctx: EntityRenderContext,
  data: CompanyEnriched,
  periods: NormalizedFinancialPeriod[],
): HTMLElement {
  const latestRevenue = getLatestFinancialValue(periods, 'revenue');
  const latestNetIncome = getLatestFinancialValue(periods, 'netIncome');
  const latestAssets = getLatestFinancialValue(periods, 'assets');
  const latestEquity = getLatestFinancialValue(periods, 'equity');
  const latestDebt = getLatestFinancialValue(periods, 'debt');
  const latestLiabilities = getLatestFinancialValue(periods, 'liabilities');
  const marketCap = data.profile?.marketCapitalization ? data.profile.marketCapitalization * 1_000_000 : data.metrics?.marketCapitalization;
  const enterpriseValue = marketCap !== undefined ? marketCap + (latestDebt ?? 0) - (getLatestFinancialValue(periods, 'cash') ?? 0) : undefined;
  const grid = ctx.el('div', 'cp-statistics-grid');
  const rows: Array<[string, string]> = [
    ['P/E ratio', fmtMetric(data.metrics?.peBasicExclExtraTTM || data.metrics?.peAnnual, 'x')],
    ['P/S ratio', fmtMetric(data.metrics?.psAnnual, 'x')],
    ['P/B ratio', fmtMetric(data.metrics?.pbAnnual, 'x')],
    ['Enterprise value', fmtFinancialValue(enterpriseValue)],
    ['Return on assets', fmtPercent(percentFromRatio(ratio(latestNetIncome, latestAssets)) ?? data.metrics?.roaRfy)],
    ['Return on equity', fmtPercent(percentFromRatio(ratio(latestNetIncome, latestEquity)) ?? data.metrics?.roeRfy)],
    ['Gross margin', fmtPercent(data.metrics?.grossMarginAnnual)],
    ['Operating margin', fmtPercent(data.metrics?.operatingMarginAnnual)],
    ['Net margin', fmtPercent(percentFromRatio(ratio(latestNetIncome, latestRevenue)) ?? data.metrics?.netProfitMarginAnnual)],
    ['Current ratio', fmtMetric(data.metrics?.currentRatioAnnual)],
    ['Debt/assets', fmtMetric(ratio(latestDebt, latestAssets), 'x')],
    ['Debt/equity', fmtMetric(ratio(latestDebt, latestEquity) ?? data.metrics?.totalDebtToEquityAnnual, 'x')],
    ['Liabilities/assets', fmtMetric(ratio(latestLiabilities, latestAssets), 'x')],
  ];
  for (const [label, value] of rows) {
    const item = ctx.el('div', 'cp-statistics-item');
    item.append(ctx.el('span', 'cp-statistics-label', label));
    item.append(ctx.el('span', 'cp-statistics-value', value));
    grid.append(item);
  }
  return grid;
}

function numericBreakdownEntries(input: unknown): Array<[string, number]> {
  if (!input || typeof input !== 'object') return [];
  return Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => [key, value as number]);
}

function buildRevenueBreakdown(ctx: EntityRenderContext, breakdown: RevenueBreakdown): HTMLElement | null {
  const entries = [breakdown.breakdown, breakdown.data, breakdown.series, breakdown]
    .flatMap(numericBreakdownEntries)
    .slice(0, 12);
  if (entries.length === 0) return null;
  const wrap = ctx.el('div', 'cp-revenue-breakdown');
  const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1);
  for (const [key, value] of entries) {
    const rowEl = ctx.el('div', 'cp-revenue-row');
    rowEl.append(ctx.el('span', 'cp-revenue-label', key.replace(/[_-]+/g, ' ')));
    const track = ctx.el('div', 'cp-revenue-track');
    const bar = ctx.el('div', 'cp-revenue-bar');
    bar.style.width = `${Math.max(4, (Math.abs(value) / max) * 100)}%`;
    track.append(bar);
    rowEl.append(track);
    rowEl.append(ctx.el('span', 'cp-revenue-value', fmtFinancialValue(value)));
    wrap.append(rowEl);
  }
  return wrap;
}

function simpleTableRow(ctx: EntityRenderContext, cells: string[], header = false): HTMLElement {
  const rowEl = ctx.el('div', header ? 'cp-simple-table-row cp-simple-table-header' : 'cp-simple-table-row');
  for (const cell of cells) rowEl.append(ctx.el('span', '', cell));
  return rowEl;
}

function hasSecFactsData(facts: SecCompanyFacts): boolean {
  return facts.signals.length > 0 || facts.metrics.some((metric) => metric.quarterly || metric.annual);
}

function secMetricPeriodLabel(metric: SecCompanyFactMetric): string {
  const period = metric.quarterly ?? metric.annual;
  if (!period) return '-';
  const fiscal = [period.fp, period.fy ? String(period.fy) : ''].filter(Boolean).join(' ');
  const filed = period.filed ? `filed ${fmtDate(period.filed)}` : '';
  return [fiscal || period.form, filed].filter(Boolean).join(' · ');
}

function secMetricValue(metric: SecCompanyFactMetric): string {
  const period = metric.quarterly ?? metric.annual;
  if (!period) return '-';
  if (metric.unit === 'shares') return fmtShares(period.value);
  return fmtFinancialValue(period.value);
}

function formatSecSignalValue(signal: SecCompanyFactSignal): string {
  if (signal.format === 'percent') return fmtPercent(signal.value * 100);
  if (signal.format === 'multiple') return fmtMetric(signal.value, 'x');
  return fmtPlainNumber(signal.value);
}

function secSignalClass(signal: SecCompanyFactSignal): string {
  if (signal.kind === 'positive') return 'cp-mini-kpi-value cp-positive';
  if (signal.kind === 'negative') return 'cp-mini-kpi-value cp-negative';
  return 'cp-mini-kpi-value';
}

function buildSecCompanyFactsCard(ctx: EntityRenderContext, facts: SecCompanyFacts): HTMLElement {
  const [card, body] = ctx.sectionCard('SEC Company Facts');
  card.classList.add('edp-card--wide');

  const note = ctx.el('p', 'edp-description');
  note.textContent = facts.cik
    ? `Official SEC XBRL facts for ${facts.entityName || facts.ticker} · CIK ${facts.cik.replace(/^0+/, '') || facts.cik}`
    : `Official SEC XBRL facts for ${facts.entityName || facts.ticker}`;
  body.append(note);

  if (facts.signals.length > 0) {
    const grid = ctx.el('div', 'cp-mini-kpi-grid');
    for (const signal of facts.signals.slice(0, 6)) {
      const item = ctx.el('div', 'cp-mini-kpi');
      item.append(ctx.el('span', 'cp-mini-kpi-label', signal.label));
      item.append(ctx.el('span', secSignalClass(signal), formatSecSignalValue(signal)));
      grid.append(item);
    }
    body.append(grid);
  }

  const selected = ['revenue', 'netIncome', 'cash', 'debt', 'rAndD', 'sharesDiluted']
    .map((id) => facts.metrics.find((metric) => metric.id === id))
    .filter((metric): metric is SecCompanyFactMetric => Boolean(metric?.concept && (metric.quarterly || metric.annual)));

  if (selected.length > 0) {
    const table = ctx.el('div', 'cp-simple-table');
    table.append(simpleTableRow(ctx, ['Metric', 'Latest', 'Period', 'YoY'], true));
    for (const metric of selected) {
      const yoy = metric.quarterlyYoY ?? metric.annualYoY;
      table.append(simpleTableRow(ctx, [
        metric.label,
        secMetricValue(metric),
        secMetricPeriodLabel(metric),
        yoy === null || yoy === undefined ? '-' : fmtPercent(yoy * 100),
      ]));
    }
    body.append(table);
  }

  if (facts.sourceUrl) {
    const link = ctx.el('a', 'cp-link') as HTMLAnchorElement;
    link.href = sanitizeUrl(facts.sourceUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'SEC companyfacts JSON';
    body.append(link);
  }

  return card;
}

function openEarningsTranscript(ctx: EntityRenderContext, call: EarningsCallTranscript): void {
  if (!call.transcriptId) return;

  const view = ctx.el('div', 'cp-transcript-detail-view');
  const header = ctx.el('div', 'edp-header');
  header.append(ctx.el('h2', 'edp-title', call.label));
  header.append(ctx.el('div', 'edp-subtitle', [call.quarter, call.filingDate].filter(Boolean).join(' · ')));
  view.append(header);

  const [card, body] = ctx.sectionCard('Transcript');
  body.append(ctx.makeLoading('Loading earnings call transcript…'));
  view.append(card);
  ctx.navigate(view);

  void fetchEarningsCallTranscriptDetail(call.transcriptId)
    .then((detail) => {
      if (ctx.signal.aborted) return;
      body.replaceChildren();

      if (!detail || detail.transcript.length === 0) {
        body.append(ctx.makeEmpty('Transcript text unavailable'));
        return;
      }

      if (detail.audioUrl) {
        const audioLink = ctx.el('a', 'edp-btn-sm') as HTMLAnchorElement;
        audioLink.href = sanitizeUrl(detail.audioUrl);
        audioLink.target = '_blank';
        audioLink.rel = 'noopener noreferrer';
        audioLink.textContent = 'Audio ↗';
        body.append(audioLink);
      }

      for (const entry of detail.transcript.slice(0, 80)) {
        const block = ctx.el('div', 'edp-disclosure-info');
        const speaker = ctx.el('span', 'edp-disclosure-name', entry.name);
        block.append(speaker);
        if (entry.session) block.append(ctx.el('span', 'edp-disclosure-detail', entry.session));
        for (const speech of entry.speech) {
          if (!speech.trim()) continue;
          block.append(ctx.el('p', 'edp-description', speech));
        }
        body.append(block);
      }
    })
    .catch((error) => {
      if (ctx.signal.aborted) return;
      body.replaceChildren(ctx.makeEmpty(`Transcript unavailable: ${error instanceof Error ? error.message : String(error)}`));
    });
}

function buildDividendTable(ctx: EntityRenderContext, dividends: StockDividend[]): HTMLElement {
  const table = ctx.el('div', 'cp-simple-table');
  table.append(simpleTableRow(ctx, ['Date', 'Amount', 'Pay date'], true));
  for (const dividend of dividends) {
    table.append(simpleTableRow(ctx, [
      dividend.exDate || dividend.date,
      fmtFinancialValue(dividend.amount),
      dividend.payDate || '-',
    ]));
  }
  return table;
}

function buildForecastConeChart(
  ctx: EntityRenderContext,
  closes: HistoricalClose[],
  pt: PriceTarget,
  currentPrice: number,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-forecast-cone');
  const W = 600, H = 150;
  const hist = closes.slice(-24);
  const histCount = hist.length;
  if (histCount < 2) return wrap;

  const allValues = [
    ...hist.map(h => h.close),
    pt.targetLow, pt.targetMean, pt.targetHigh, currentPrice,
  ];
  const yMin = Math.min(...allValues) * 0.97;
  const yMax = Math.max(...allValues) * 1.03;
  const ySpan = yMax - yMin || 1;
  const totalPoints = histCount + 4;

  const toX = (i: number) => (i / (totalPoints - 1)) * W;
  const toY = (v: number) => H - ((v - yMin) / ySpan * H);

  const histXEnd = toX(histCount - 1);
  const fwdEndX = W;
  const fwdStartY = toY(currentPrice).toFixed(1);
  const fwdEndLowY = toY(pt.targetLow).toFixed(1);
  const fwdEndMeanY = toY(pt.targetMean).toFixed(1);
  const fwdEndHighY = toY(pt.targetHigh).toFixed(1);
  const histPts = hist.map((h, i) => `${toX(i).toFixed(1)},${toY(h.close).toFixed(1)}`).join(' ');
  const divX = histXEnd.toFixed(1);

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:${H}px;display:block">
    <defs>
      <linearGradient id="coneGrad${W}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--accent,#6366f1)" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="var(--accent,#6366f1)" stop-opacity="0.04"/>
      </linearGradient>
    </defs>
    <line x1="${divX}" y1="0" x2="${divX}" y2="${H}" stroke="var(--border,#444)" stroke-width="1" stroke-dasharray="3,3"/>
    <polygon points="${divX},${fwdStartY} ${fwdEndX},${fwdEndHighY} ${fwdEndX},${fwdEndLowY}" fill="url(#coneGrad${W})"/>
    <line x1="${divX}" y1="${fwdStartY}" x2="${fwdEndX}" y2="${fwdEndHighY}" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>
    <line x1="${divX}" y1="${fwdStartY}" x2="${fwdEndX}" y2="${fwdEndLowY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>
    <line x1="${divX}" y1="${fwdStartY}" x2="${fwdEndX}" y2="${fwdEndMeanY}" stroke="var(--accent,#6366f1)" stroke-width="2"/>
    <polyline points="${histPts}" fill="none" stroke="var(--text-primary,#e5e7eb)" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${divX}" cy="${fwdStartY}" r="4" fill="var(--accent,#6366f1)"/>
    <text x="${fwdEndX - 4}" y="${Math.max(12, parseFloat(fwdEndHighY) - 4)}" text-anchor="end" fill="#22c55e" font-size="9">Hi ${fmtPrice(pt.targetHigh)}</text>
    <text x="${fwdEndX - 4}" y="${Math.max(12, parseFloat(fwdEndMeanY) - 4)}" text-anchor="end" fill="var(--accent,#818cf8)" font-size="9">Avg ${fmtPrice(pt.targetMean)}</text>
    <text x="${fwdEndX - 4}" y="${Math.min(H - 2, parseFloat(fwdEndLowY) + 11)}" text-anchor="end" fill="#ef4444" font-size="9">Lo ${fmtPrice(pt.targetLow)}</text>
    <text x="4" y="11" fill="var(--text-dim,#777)" font-size="9">24mo History</text>
    <text x="${(parseFloat(divX) + 4).toFixed(0)}" y="11" fill="var(--text-dim,#777)" font-size="9">+1Y Target</text>
  </svg>`;
  return wrap;
}

function buildAnalystGaugeSvg(ctx: EntityRenderContext, rec: RecommendationTrend): HTMLElement {
  const wrap = ctx.el('div', 'cp-analyst-gauge');
  const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
  if (total === 0) return wrap;

  const score = (rec.strongBuy * 5 + rec.buy * 4 + rec.hold * 3 + rec.sell * 2 + rec.strongSell * 1) / total;
  const t = (score - 1) / 4;
  const cx = 100, cy = 85, R = 65;

  const arcPt = (deg: number, r = R): [string, string] => [
    (cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(1),
    (cy + r * Math.sin((deg * Math.PI) / 180)).toFixed(1),
  ];

  // 5 sectors: Strong Sell (180°→216°), Sell (216°→252°), Hold (252°→288°), Buy (288°→324°), Strong Buy (324°→360°)
  // sweep-flag=1 (clockwise in SVG) draws the upper arc going left→top→right
  const sectorColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  const sectors = sectorColors.map((color, i) => {
    const [sx, sy] = arcPt(180 + i * 36);
    const [ex, ey] = arcPt(180 + (i + 1) * 36);
    return `<path d="M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="butt"/>`;
  }).join('\n    ');

  // Needle: angle 180°=Strong Sell → 360°=Strong Buy
  const needleAngleDeg = 180 + t * 180;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const nl = R * 0.7;
  const nx = (cx + nl * Math.cos(needleRad)).toFixed(1);
  const ny = (cy + nl * Math.sin(needleRad)).toFixed(1);

  const label = score >= 4.5 ? 'Strong Buy' : score >= 3.5 ? 'Buy' : score >= 2.5 ? 'Hold' : score >= 1.5 ? 'Sell' : 'Strong Sell';
  const lc = score >= 3.5 ? '#22c55e' : score >= 2.5 ? '#eab308' : '#ef4444';

  wrap.innerHTML = `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" style="width:200px;height:100px;display:block;margin:0 auto">
    ${sectors}
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="var(--text-primary,#e5e7eb)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="var(--text-primary,#e5e7eb)"/>
    <text x="${cx}" y="98" text-anchor="middle" fill="${lc}" font-size="10" font-weight="700">${label}</text>
    <text x="16" y="92" fill="#ef4444" font-size="8" text-anchor="middle">SS</text>
    <text x="184" y="92" fill="#16a34a" font-size="8" text-anchor="middle">SB</text>
  </svg>`;
  return wrap;
}

function buildEstimateComparisonChart(
  ctx: EntityRenderContext,
  series: EstimateSeries,
  isCurrency: boolean,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-estimate-compare-chart');
  const points = series.data.slice(-8);
  if (points.length === 0) return wrap;

  const vals = points.flatMap(p => {
    const a = isCurrency ? (p.revenue ?? p.actual) : p.actual;
    const e = p.estimate;
    return ([a, e] as (number | undefined)[]).filter((v): v is number => v !== undefined && Number.isFinite(v));
  });
  const maxAbs = Math.max(...vals.map(Math.abs), 1);

  const barsWrap = ctx.el('div', 'cp-estimate-bars-wrap');
  for (const point of points) {
    const actual = isCurrency ? (point.revenue ?? point.actual) : point.actual;
    const estimate = point.estimate;
    const hasActual = actual !== undefined && actual !== null && Number.isFinite(actual);
    const isForecasted = !hasActual;

    const col = ctx.el('div', `cp-estimate-col${isForecasted ? ' cp-estimate-col-forecast' : ''}`);
    const barGroup = ctx.el('div', 'cp-estimate-bar-group');

    const fmtV = (v: number | null | undefined) => isCurrency ? fmtFinancialValue(v) : fmtMetric(v ?? undefined);

    if (hasActual) {
      const h = Math.max(4, (Math.abs(actual!) / maxAbs) * 80);
      const bar = ctx.el('div', `cp-estimate-bar cp-estimate-bar-reported${actual! < 0 ? ' cp-negative' : ''}`);
      bar.style.height = `${h}px`;
      bar.title = `Reported: ${fmtV(actual)}`;
      barGroup.append(bar);
    }

    if (estimate !== undefined && estimate !== null && Number.isFinite(estimate)) {
      const h = Math.max(4, (Math.abs(estimate) / maxAbs) * 80);
      const bar = ctx.el('div', `cp-estimate-bar ${isForecasted ? 'cp-estimate-bar-estimate cp-forecast-region' : 'cp-estimate-bar-estimate'}`);
      bar.style.height = `${h}px`;
      bar.title = `Estimate: ${fmtV(estimate)}`;
      barGroup.append(bar);
    }

    col.append(barGroup);
    col.append(ctx.el('span', 'cp-estimate-period-label', point.period));
    barsWrap.append(col);
  }

  const legend = ctx.el('div', 'cp-estimate-legend');
  const dotR = ctx.el('span', 'cp-estimate-legend-dot cp-estimate-bar-reported');
  const dotE = ctx.el('span', 'cp-estimate-legend-dot cp-estimate-bar-estimate');
  legend.append(dotR, ctx.el('span', 'cp-estimate-legend-text', 'Reported'));
  legend.append(dotE, ctx.el('span', 'cp-estimate-legend-text', 'Estimate'));
  wrap.append(barsWrap, legend);
  return wrap;
}

function buildEstimateMetricsTable(
  ctx: EntityRenderContext,
  series: EstimateSeries,
  isCurrency: boolean,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-estimate-metrics-table');
  const points = series.data.slice(-8);
  if (points.length === 0) return wrap;
  wrap.style.setProperty('--period-count', String(points.length));

  const fmtV = (v: number | null | undefined) => isCurrency ? fmtFinancialValue(v) : fmtMetric(v ?? undefined);

  const headerRow = ctx.el('div', 'cp-est-table-row cp-est-table-header');
  headerRow.append(ctx.el('span', 'cp-est-table-cell cp-est-table-label', ''));
  for (const p of points) headerRow.append(ctx.el('span', 'cp-est-table-cell', p.period));
  wrap.append(headerRow);

  const reportedRow = ctx.el('div', 'cp-est-table-row');
  reportedRow.append(ctx.el('span', 'cp-est-table-cell cp-est-table-label', 'Reported'));
  for (const p of points) {
    const v = isCurrency ? (p.revenue ?? p.actual) : p.actual;
    const ok = v !== undefined && v !== null && Number.isFinite(v);
    reportedRow.append(ctx.el('span', `cp-est-table-cell${ok ? '' : ' cp-text-dim'}`, ok ? fmtV(v) : '—'));
  }
  wrap.append(reportedRow);

  const estimateRow = ctx.el('div', 'cp-est-table-row');
  estimateRow.append(ctx.el('span', 'cp-est-table-cell cp-est-table-label', 'Estimate'));
  for (const p of points) {
    const ok = p.estimate !== undefined && p.estimate !== null && Number.isFinite(p.estimate);
    estimateRow.append(ctx.el('span', `cp-est-table-cell${ok ? '' : ' cp-text-dim'}`, ok ? fmtV(p.estimate) : '—'));
  }
  wrap.append(estimateRow);

  const surpriseRow = ctx.el('div', 'cp-est-table-row');
  surpriseRow.append(ctx.el('span', 'cp-est-table-cell cp-est-table-label', 'Surprise'));
  for (const p of points) {
    const actual = isCurrency ? (p.revenue ?? p.actual) : p.actual;
    const est = p.estimate;
    const hasA = actual !== undefined && actual !== null && Number.isFinite(actual);
    const hasE = est !== undefined && est !== null && Number.isFinite(est) && est !== 0;
    if (hasA && hasE) {
      const pct = ((actual! - est!) / Math.abs(est!)) * 100;
      surpriseRow.append(ctx.el('span', `cp-est-table-cell ${pct >= 0 ? 'cp-positive' : 'cp-negative'}`,
        (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'));
    } else {
      surpriseRow.append(ctx.el('span', 'cp-est-table-cell cp-text-dim', '—'));
    }
  }
  wrap.append(surpriseRow);

  return wrap;
}

function buildEstimateStrip(
  ctx: EntityRenderContext,
  title: string,
  series: EstimateSeries,
  isCurrency: boolean,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-estimate-strip');
  wrap.append(ctx.el('div', 'cp-trend-title', title));
  const points = series.data.slice(-6);
  const max = Math.max(...points.map((point) => Math.abs(point.estimate ?? point.revenue ?? point.actual ?? 0)), 1);
  const chart = ctx.el('div', 'cp-estimate-chart');
  for (const point of points) {
    const value = point.estimate ?? point.revenue ?? point.actual ?? 0;
    const item = ctx.el('div', 'cp-estimate-point');
    const dot = ctx.el('div', 'cp-estimate-dot');
    dot.style.height = `${Math.max(6, (Math.abs(value) / max) * 100)}%`;
    dot.title = `${point.period}: ${isCurrency ? fmtFinancialValue(value) : fmtPlainNumber(value)}`;
    item.append(dot, ctx.el('span', 'cp-estimate-label', point.period));
    chart.append(item);
  }
  wrap.append(chart);
  return wrap;
}

function buildEarningsTable(ctx: EntityRenderContext, earnings: EarningsSurprise[]): HTMLElement {
  const table = ctx.el('div', 'cp-earnings-table');
  table.append(simpleTableRow(ctx, ['Period', 'Actual', 'Estimate', 'Surprise'], true));
  for (const item of earnings) {
    table.append(simpleTableRow(ctx, [
      item.period,
      fmtMetric(item.actual),
      fmtMetric(item.estimate),
      fmtChange(item.surprisePercent ?? 0),
    ]));
  }
  return table;
}

function buildAnalystDetailsView(ctx: EntityRenderContext, data: CompanyEnriched): HTMLElement {
  const view = ctx.el('div', 'cp-analyst-detail-view');
  const header = ctx.el('div', 'edp-header');
  header.append(ctx.el('h2', 'edp-title', `${data.ticker} Analyst Detail`));
  header.append(ctx.el('div', 'edp-subtitle', 'Firm-level actions and aggregate consensus history'));
  view.append(header);

  const [historyCard, historyBody] = ctx.sectionCard('Aggregate Rating History');
  for (const rec of data.recommendations.slice(0, 12)) {
    const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
    if (total === 0) continue;
    const rowEl = ctx.el('div', 'cp-analyst-history-row');
    rowEl.append(ctx.el('span', 'cp-trend-period', rec.period));
    const bar = ctx.el('div', 'cp-rating-bar cp-rating-bar-mini');
    for (const [count, color] of [
      [rec.strongBuy, '#16a34a'],
      [rec.buy, '#22c55e'],
      [rec.hold, '#eab308'],
      [rec.sell, '#f97316'],
      [rec.strongSell, '#ef4444'],
    ] as const) {
      if (count === 0) continue;
      const segment = ctx.el('div', 'cp-rating-segment');
      segment.style.width = `${(count / total) * 100}%`;
      segment.style.backgroundColor = color;
      bar.append(segment);
    }
    rowEl.append(bar);
    historyBody.append(rowEl);
  }
  view.append(historyCard);

  const [actionsCard, actionsBody] = ctx.sectionCard('Firm Rating Actions');
  if (data.ratingActions.length === 0) {
    actionsBody.append(ctx.makeEmpty('No firm-level rating actions from the current data source'));
  } else {
    const table = ctx.el('div', 'cp-analyst-action-table');
    table.append(simpleTableRow(ctx, ['Date', 'Firm', 'Action', 'From', 'To'], true));
    for (const action of data.ratingActions.slice(0, 40)) {
      table.append(simpleTableRow(ctx, [
        action.gradeTime ? fmtDate(action.gradeTime) : '-',
        action.firm || '-',
        action.action || '-',
        action.fromGrade || '-',
        action.toGrade || '-',
      ]));
    }
    actionsBody.append(table);
  }
  view.append(actionsCard);

  if (data.priceTarget) {
    const [targetCard, targetBody] = ctx.sectionCard('Consensus Price Target');
    targetBody.append(row(ctx, 'Low', fmtPrice(data.priceTarget.targetLow)));
    targetBody.append(row(ctx, 'Mean', fmtPrice(data.priceTarget.targetMean)));
    targetBody.append(row(ctx, 'Median', fmtPrice(data.priceTarget.targetMedian)));
    targetBody.append(row(ctx, 'High', fmtPrice(data.priceTarget.targetHigh)));
    view.append(targetCard);
  }

  return view;
}

function buildPriceTargetGauge(
  ctx: EntityRenderContext,
  current: number,
  low: number,
  mean: number,
  high: number,
): HTMLElement {
  const wrap = ctx.el('div', 'cp-forecast-gauge');
  const rangeMin = Math.min(current, low) * 0.97;
  const rangeMax = Math.max(current, high) * 1.03;
  const span = rangeMax - rangeMin;

  const toPos = (v: number) => ((v - rangeMin) / span * 100).toFixed(1) + '%';

  // Track
  const track = ctx.el('div', 'cp-forecast-track');

  // Analyst range fill (low → high)
  const fill = ctx.el('div', 'cp-forecast-fill');
  const fillLeft = ((low - rangeMin) / span * 100);
  const fillWidth = ((high - low) / span * 100);
  fill.style.left = fillLeft.toFixed(1) + '%';
  fill.style.width = fillWidth.toFixed(1) + '%';
  track.append(fill);

  // Mean marker
  const meanMarker = ctx.el('div', 'cp-forecast-marker cp-forecast-mean');
  meanMarker.style.left = toPos(mean);
  meanMarker.title = 'Mean: ' + fmtPrice(mean);
  track.append(meanMarker);

  // Current price marker
  const currMarker = ctx.el('div', 'cp-forecast-marker cp-forecast-current');
  currMarker.style.left = toPos(current);
  currMarker.title = 'Current: ' + fmtPrice(current);
  track.append(currMarker);

  wrap.append(track);

  // Labels
  const labels = ctx.el('div', 'cp-forecast-labels');
  const lLow = ctx.el('div', 'cp-forecast-lbl');
  lLow.style.left = toPos(low);
  lLow.append(ctx.el('span', 'cp-forecast-lbl-val cp-negative', fmtPrice(low)));
  lLow.append(ctx.el('span', 'cp-forecast-lbl-name', 'Low'));
  labels.append(lLow);

  const lMean = ctx.el('div', 'cp-forecast-lbl');
  lMean.style.left = toPos(mean);
  lMean.append(ctx.el('span', 'cp-forecast-lbl-val', fmtPrice(mean)));
  lMean.append(ctx.el('span', 'cp-forecast-lbl-name', 'Mean'));
  labels.append(lMean);

  const lHigh = ctx.el('div', 'cp-forecast-lbl');
  lHigh.style.left = toPos(high);
  lHigh.append(ctx.el('span', 'cp-forecast-lbl-val cp-positive', fmtPrice(high)));
  lHigh.append(ctx.el('span', 'cp-forecast-lbl-name', 'High'));
  labels.append(lHigh);

  const lCurr = ctx.el('div', 'cp-forecast-lbl cp-forecast-lbl-current');
  lCurr.style.left = toPos(current);
  lCurr.append(ctx.el('span', 'cp-forecast-lbl-val', fmtPrice(current)));
  lCurr.append(ctx.el('span', 'cp-forecast-lbl-name', 'Price'));
  labels.append(lCurr);

  wrap.append(labels);
  return wrap;
}

function buildConsensusCount(ctx: EntityRenderContext, count: number, label: string, cls: string): HTMLElement {
  const el = ctx.el('div', 'cp-consensus-count');
  el.append(ctx.el('span', `cp-consensus-num ${cls}`, String(count)));
  el.append(ctx.el('span', 'cp-consensus-lbl', label));
  return el;
}

function formatExpiry(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  } catch {
    return dateStr;
  }
}

function buildFilingRow(ctx: EntityRenderContext, filing: SecFiling): HTMLElement {
  const r = ctx.el('div', 'edp-sec-filing');

  const typeClass = FILING_TYPE_CLASS[filing.filingType ?? ''] ?? 'edp-sec-type-badge';
  r.append(ctx.el('span', typeClass, filing.filingType ?? ''));

  const info = ctx.el('div', 'edp-sec-filing-info');
  info.append(ctx.el('div', 'edp-sec-filing-title', filing.title || filing.filingType || ''));
  info.append(ctx.el('div', 'edp-sec-filing-meta', fmtDate(filing.filedAt ?? '')));
  r.append(info);

  if (filing.url) {
    const link = document.createElement('a');
    link.className = 'edp-sec-filing-link';
    link.href = sanitizeUrl(filing.url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '↗';
    link.title = 'View on EDGAR';
    r.append(link);
  }

  const readButton = ctx.el('button', 'edp-btn-sm') as HTMLButtonElement;
  readButton.type = 'button';
  readButton.textContent = 'Read';
  readButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
      detail: {
        type: 'secFiling',
        data: {
          cik: filing.issuerCik || '',
          companyName: filing.issuerName || '',
          accessionNumber: filing.accessionNumber || '',
          filingType: filing.filingType || '',
          documentUrl: filing.url || '',
          title: filing.title || '',
          filedAt: filing.filedAt || '',
        },
      },
    }));
  });
  r.append(readButton);

  return r;
}

function buildOpenInstitutionButton(
  ctx: EntityRenderContext,
  holder: CompanyInstitutionHolder,
  label = 'Open',
): HTMLElement {
  if (!holder.cik) {
    return ctx.el('span', 'cp-holders-open-cell', label);
  }

  const button = ctx.el('button', 'cp-holders-open-btn', label) as HTMLButtonElement;
  button.type = 'button';
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
      detail: {
        type: 'institution',
        data: { name: holder.institutionName, cik: holder.cik },
      },
    }));
  });
  return button;
}

// ─── Events helpers ───────────────────────────────────────────────────────────

function buildEventTitle(call: EarningsCallTranscript): string {
  if (call.label && call.label.trim()) return call.label.trim();
  const parts: string[] = [];
  if (call.quarter) parts.push(call.quarter);
  if (call.kind === 'earnings') parts.push('Earnings Release');
  else if (call.kind === 'transcript') parts.push('Earnings Call');
  else if (call.kind === 'press-release') parts.push('Press Release');
  else parts.push('Filing');
  return parts.join(' · ');
}

function buildEvCard(ctx: EntityRenderContext, ev: EvCard): HTMLElement {
  const card = ctx.el('div', `cp-ev-card cp-ev-card-${ev.kind}`);

  // Header row: kind badge + annual tag
  const headerRow = ctx.el('div', 'cp-ev-card-header');
  const kindLabel = ev.kind === 'earnings' ? 'Earnings'
    : ev.kind === 'transcript' ? 'Transcript'
    : ev.kind === 'press-release' ? 'Press Release'
    : ev.kind === 'dividend' ? 'Dividend'
    : ev.kind === 'split' ? 'Split'
    : ev.kind === 'upcoming' ? 'Upcoming'
    : 'Filing';
  headerRow.append(ctx.el('span', `cp-ev-badge cp-ev-badge-${ev.kind}`, kindLabel));
  if (ev.isAnnual) headerRow.append(ctx.el('span', 'cp-ev-annual-tag', 'Annual'));
  if (ev.hour) headerRow.append(ctx.el('span', 'cp-ev-hour-tag', ev.hour.toUpperCase()));
  card.append(headerRow);

  // Title
  card.append(ctx.el('div', 'cp-ev-card-title', ev.title || ev.quarter || '—'));
  if (ev.quarter && ev.title) {
    card.append(ctx.el('div', 'cp-ev-card-quarter', ev.quarter));
  }

  // Date
  if (ev.date) {
    card.append(ctx.el('div', 'cp-ev-card-date', fmtDate(ev.date)));
  }

  if (ev.kind === 'dividend' && ev.amount !== undefined) {
    const detailRow = ctx.el('div', 'cp-ev-card-detail');
    detailRow.append(ctx.el('span', 'cp-ev-eps-label', 'Amount'));
    detailRow.append(ctx.el('span', 'cp-ev-card-detail-value', fmtPrice(ev.amount)));
    card.append(detailRow);
  } else if (ev.kind === 'split' && ev.splitRatio) {
    const detailRow = ctx.el('div', 'cp-ev-card-detail');
    detailRow.append(ctx.el('span', 'cp-ev-eps-label', 'Ratio'));
    detailRow.append(ctx.el('span', 'cp-ev-card-detail-value', ev.splitRatio));
    card.append(detailRow);
  }

  // EPS row — shown for earnings/transcript and upcoming earnings cards that have data
  if ((ev.kind === 'earnings' || ev.kind === 'transcript' || ev.kind === 'upcoming') &&
      (ev.epsActual !== null || ev.epsEstimate !== null)) {
    const epsRow = ctx.el('div', 'cp-ev-card-eps');
    epsRow.append(ctx.el('span', 'cp-ev-eps-label', 'EPS'));
    if (ev.epsActual !== null) {
      epsRow.append(ctx.el('span', 'cp-ev-eps-actual', fmtMetric(ev.epsActual)));
    }
    if (ev.epsEstimate !== null) {
      epsRow.append(ctx.el('span', 'cp-ev-eps-vs', 'est'));
      epsRow.append(ctx.el('span', 'cp-ev-eps-estimate', fmtMetric(ev.epsEstimate)));
    }
    if (ev.epsSurprisePct !== null) {
      const positive = ev.epsSurprisePct >= 0;
      epsRow.append(ctx.el(
        'span',
        `cp-ev-eps-surprise ${positive ? 'cp-positive' : 'cp-negative'}`,
        (positive ? '+' : '') + ev.epsSurprisePct.toFixed(1) + '%',
      ));
    }
    card.append(epsRow);
  }

  // Action buttons
  const actions = ctx.el('div', 'cp-ev-card-actions');
  if (ev.transcriptRef) {
    const btn = ctx.el('button', 'cp-ev-action-btn', 'Transcript') as HTMLButtonElement;
    btn.type = 'button';
    btn.addEventListener('click', () => openEarningsTranscript(ctx, ev.transcriptRef!));
    actions.append(btn);
  }
  if (ev.indexUrl) {
    const link = ctx.el('a', 'cp-ev-action-btn cp-ev-action-link') as HTMLAnchorElement;
    link.href = sanitizeUrl(ev.indexUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Source ↗';
    actions.append(link);
  }
  if (actions.childElementCount > 0) card.append(actions);

  return card;
}
