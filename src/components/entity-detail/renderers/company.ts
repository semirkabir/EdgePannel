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
  type RevenueBreakdown,
  type UpgradeDowngradeAction,
  type FinancialReport,
} from '@/services/market/finnhub-extra';
import {
  fetchCompanyInstitutionHolders13F,
  type CompanyInstitutionHolder,
} from '@/services/market/normalized-13f';
import {
  buildFinancialRows,
  getLatestFinancialValue,
  normalizeFinancialReports,
  ratio,
  type FinancialDisplayRow,
  type FinancialFrequency,
  type FinancialStatementKind,
  type NormalizedFinancialPeriod,
} from '@/services/market/company-financials';

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
  earningsSurprises: EarningsSurprise[];
  financialsAnnual: NormalizedFinancialPeriod[];
  financialsQuarterly: NormalizedFinancialPeriod[];
  epsEstimates: EstimateSeries;
  revenueEstimates: EstimateSeries;
  dividends: StockDividend[];
  revenueBreakdown: RevenueBreakdown | null;
  ratingActions: UpgradeDowngradeAction[];
}

const client = new MarketServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

const TABS = ['overview', 'financials', 'forecasts', 'news', 'options', 'holders', 'filings'] as const;
type TabId = typeof TABS[number];

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  financials: 'Financials',
  forecasts: 'Forecasts',
  news: 'News',
  options: 'Options',
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

function appendLightweightChart(parent: HTMLElement, data: CompanyEnriched, positive: boolean): void {
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
  const quote = data.quote;
  wrap.classList.add('edp-tradingview-fallback-active');
  const price = quote?.price != null ? fmtPrice(quote.price) : 'Quote unavailable';
  const change = quote?.change ?? null;
  const changeClass = change == null ? '' : change >= 0 ? 'edp-positive' : 'edp-negative';
  const changeText = change == null ? '' : fmtChange(change);
  const marketCap = data.profile?.marketCapitalization
    ? `MCAP ${fmtFinnhubMarketCap(data.profile.marketCapitalization)}`
    : '';
  const exchange = data.profile?.exchange || 'Market snapshot';

  wrap.textContent = '';
  const card = document.createElement('div');
  card.className = 'edp-tv-fallback-card';
  const quoteCol = document.createElement('div');
  quoteCol.className = 'edp-tv-fallback-quote';

  const priceEl = document.createElement('div');
  priceEl.className = 'edp-tv-fallback-price';
  priceEl.textContent = price;
  quoteCol.append(priceEl);

  if (changeText) {
    const changeEl = document.createElement('div');
    changeEl.className = `edp-tv-fallback-change ${changeClass}`.trim();
    changeEl.textContent = changeText;
    quoteCol.append(changeEl);
  }

  const metaEl = document.createElement('div');
  metaEl.className = 'edp-tv-fallback-meta';
  metaEl.textContent = [marketCap, exchange].filter(Boolean).join(' - ');
  quoteCol.append(metaEl);

  card.append(quoteCol);
  appendLightweightChart(card, data, (change ?? 0) >= 0);
  wrap.append(card);
}

function renderMarketSnapshot(container: HTMLElement, data: CompanyEnriched): void {
  const wrap = container.querySelector('.edp-tradingview-widget');
  if (!wrap) return;
  renderLocalMarketSnapshot(wrap, data);
}

function renderCompanyLogoHero(container: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
  if (!data.profile?.logo || container.querySelector('.edp-auto-hero')) return;

  const hero = ctx.el('section', 'edp-auto-hero cp-company-logo-hero');
  const img = ctx.el('img', 'edp-auto-hero-img') as HTMLImageElement;
  img.src = sanitizeUrl(data.profile.logo);
  img.alt = `${data.profile.name || data.companyName || data.name} logo`;
  img.loading = 'lazy';
  img.onerror = () => hero.remove();
  hero.append(img);

  const header = container.querySelector('.edp-header');
  if (header) header.insertAdjacentElement('beforebegin', hero);
  else container.prepend(hero);
}

function makeTabNavButton(direction: 'left' | 'right'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `cp-tab-nav cp-tab-nav-${direction}`;
  button.setAttribute('aria-label', direction === 'left' ? 'Scroll company tabs left' : 'Scroll company tabs right');
  button.innerHTML = direction === 'left'
    ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>'
    : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
  return button;
}

function setupTabNavigation(container: HTMLElement): void {
  const shell = container.querySelector<HTMLElement>('.cp-tab-shell');
  const tabBar = container.querySelector<HTMLElement>('.cp-tab-bar');
  const left = container.querySelector<HTMLButtonElement>('.cp-tab-nav-left');
  const right = container.querySelector<HTMLButtonElement>('.cp-tab-nav-right');
  if (!shell || !tabBar || !left || !right || shell.dataset.bound === 'true') return;
  shell.dataset.bound = 'true';

  const update = () => {
    const atStart = tabBar.scrollLeft <= 4;
    const atEnd = tabBar.scrollLeft + tabBar.clientWidth >= tabBar.scrollWidth - 4;
    left.disabled = atStart;
    right.disabled = atEnd;
    shell.classList.toggle('cp-tab-shell-overflowing', tabBar.scrollWidth > tabBar.clientWidth + 4);
  };

  left.addEventListener('click', () => tabBar.scrollBy({ left: -160, behavior: 'smooth' }));
  right.addEventListener('click', () => tabBar.scrollBy({ left: 160, behavior: 'smooth' }));
  tabBar.addEventListener('scroll', update, { passive: true });
  const ro = new ResizeObserver(update);
  ro.observe(tabBar);
  requestAnimationFrame(update);
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
    const tabShell = ctx.el('div', 'cp-tab-shell');
    const tabBar = ctx.el('div', 'cp-tab-bar');
    for (const tab of TABS) {
      const btn = ctx.el('button', `cp-tab${tab === 'overview' ? ' cp-tab-active' : ''}`);
      btn.textContent = TAB_LABELS[tab];
      btn.dataset.tab = tab;
      tabBar.append(btn);
    }
    tabShell.append(makeTabNavButton('left'), tabBar, makeTabNavButton('right'));
    container.append(tabShell);

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
      client.listHistoricalPrices({ symbols: [ticker], months: 12 }, { signal }),
    ]);

    const [
      profile, metrics, peers, news,
      priceTarget, recommendations, insiderTxns, optionChain, ownership, earningsSurprises,
      financialsAnnual, financialsQuarterly, epsEstimates, revenueEstimates, dividends,
      revenueBreakdown, ratingActions,
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
      () => fetchEarningsSurprises(ticker),
      () => fetchFinancialsReported(ticker, 'annual'),
      () => fetchFinancialsReported(ticker, 'quarterly'),
      () => fetchEpsEstimates(ticker, 'quarterly'),
      () => fetchRevenueEstimates(ticker, 'quarterly'),
      () => fetchStockDividends(ticker),
      () => fetchRevenueBreakdown(ticker),
      () => fetchUpgradeDowngrade(ticker),
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
      earningsSurprises: settledValue<EarningsSurprise[]>(earningsSurprises, []),
      financialsAnnual: normalizeFinancialReports(settledValue<FinancialReport[]>(financialsAnnual, []), 'annual'),
      financialsQuarterly: normalizeFinancialReports(settledValue<FinancialReport[]>(financialsQuarterly, []), 'quarterly'),
      epsEstimates: settledValue<EstimateSeries>(epsEstimates, { symbol: ticker, freq: 'quarterly', data: [] }),
      revenueEstimates: settledValue<EstimateSeries>(revenueEstimates, { symbol: ticker, freq: 'quarterly', data: [] }),
      dividends: settledValue<StockDividend[]>(dividends, []),
      revenueBreakdown: settledValue<RevenueBreakdown | null>(revenueBreakdown, null),
      ratingActions: settledValue<UpgradeDowngradeAction[]>(ratingActions, []),
    };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const data = enrichedData as CompanyEnriched;

    renderCompanyLogoHero(container, data, ctx);
    renderMarketSnapshot(container, data);

    // Update header with company name from profile
    const displayName = data.profile?.name || data.companyName || data.name;
    const titleEl = container.querySelector('.edp-title');
    if (titleEl) titleEl.textContent = displayName;

    const badgeRow = container.querySelector('.edp-badge-row');
    if (badgeRow) {
      badgeRow.replaceChildren();
      badgeRow.append(ctx.badge('$' + data.ticker, 'edp-badge edp-badge-ticker'));
      const sector = data.profile?.gicsSector || data.profile?.finnhubIndustry;
      if (sector) badgeRow.append(ctx.badge(sector, 'edp-badge edp-badge-sector'));
    }

    // Add logo if available
    if (data.profile?.logo) {
      const header = container.querySelector('.edp-header');
      if (header && !header.querySelector('.cp-logo')) {
        const logo = ctx.el('img', 'cp-logo') as HTMLImageElement;
        logo.src = sanitizeUrl(data.profile.logo);
        logo.alt = displayName;
        logo.onerror = () => logo.remove();
        header.prepend(logo);
      }
    }

    // Render initial tab
    this.activeTab = 'overview';
    this.activeOptionExpiry = 0;
    this.newsCategory = 'all';
    this.activeFinancialFrequency = 'quarterly';
    this.activeFinancialStatement = 'income';
    this.financialSearch = '';
    this.renderTabContent(container, data, ctx);

    // Tab click handlers
    const tabBar = container.querySelector('.cp-tab-bar');
    setupTabNavigation(container);
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
    const content = container.querySelector('[data-slot="tab-content"]');
    if (!content) return;
    content.replaceChildren();

    switch (this.activeTab) {
      case 'overview':   this.renderOverviewTab(content as HTMLElement, data, ctx); break;
      case 'financials': this.renderFinancialsTab(content as HTMLElement, data, ctx); break;
      case 'forecasts':  this.renderForecastsTab(content as HTMLElement, data, ctx); break;
      case 'news':       this.renderNewsTab(content as HTMLElement, data, ctx); break;
      case 'options':    this.renderOptionsTab(content as HTMLElement, data, ctx); break;
      case 'holders':    this.renderHoldersTab(content as HTMLElement, data, ctx); break;
      case 'filings':    this.renderFilingsTab(content as HTMLElement, data, ctx); break;
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

    if (data.profile?.description) {
      const [card, body] = ctx.sectionCard('About');
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

      const metrics: [string, string][] = [
        ['P/E',        fmtMetric(m.peBasicExclExtraTTM || m.peAnnual, 'x')],
        ['P/B',        fmtMetric(m.pbAnnual, 'x')],
        ['P/S',        fmtMetric(m.psAnnual, 'x')],
        ['EPS',        fmtMetric(m.epsAnnual)],
        ['ROE',        fmtPercent(m.roeRfy)],
        ['ROA',        fmtPercent(m.roaRfy)],
        ['Div Yield',  fmtPercent(m.dividendYieldIndicatedAnnual)],
        ['Beta',       fmtMetric(m.beta)],
        ['52W High',   m['52WeekHigh'] ? fmtPrice(m['52WeekHigh']) : '—'],
        ['52W Low',    m['52WeekLow'] ? fmtPrice(m['52WeekLow']) : '—'],
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
          bar.style.width = Math.min(Math.abs(val), 100) + '%';
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
      body.append(peersWrap);
      content.append(card);
    }
  }

  // ─── Financials Tab ──────────────────────────────────────────────────────

  private renderFinancialsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    const periods = this.activeFinancialFrequency === 'annual' ? data.financialsAnnual : data.financialsQuarterly;
    const hasFinancials = periods.length > 0;
    if (!hasFinancials && !data.metrics) {
      content.append(ctx.makeEmpty('Financial data unavailable'));
      return;
    }

    if (hasFinancials) {
      const [statementCard, statementBody] = ctx.sectionCard('Statements');
      statementBody.append(this.buildFinancialControls(ctx, content, data));
      statementBody.append(buildFinancialChart(ctx, periods, this.activeFinancialStatement));
      const rows = buildFinancialRows(periods, this.activeFinancialStatement)
        .filter((item) => item.label.toLowerCase().includes(this.financialSearch.toLowerCase()));
      statementBody.append(buildFinancialTable(ctx, periods, rows, data.profile?.currency || 'USD'));
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
    // Price target visualization
    if (data.priceTarget && data.quote?.price) {
      const [card, body] = ctx.sectionCard('Price Target');
      const pt = data.priceTarget;
      const currentPrice = data.quote.price;

      // Build visual gauge
      const gauge = buildPriceTargetGauge(ctx, currentPrice, pt.targetLow, pt.targetMean, pt.targetHigh);
      body.append(gauge);

      // Stats row below gauge
      const statsRow = ctx.el('div', 'cp-forecast-stats');
      const items: [string, string, string][] = [
        ['Low',    fmtPrice(pt.targetLow),    'cp-negative'],
        ['Mean',   fmtPrice(pt.targetMean),   ''],
        ['Median', fmtPrice(pt.targetMedian), ''],
        ['High',   fmtPrice(pt.targetHigh),   'cp-positive'],
      ];
      for (const [label, value, cls] of items) {
        const item = ctx.el('div', 'cp-forecast-stat-item');
        item.append(ctx.el('span', 'cp-forecast-stat-label', label));
        item.append(ctx.el('span', `cp-forecast-stat-value ${cls}`.trim(), value));
        statsRow.append(item);
      }
      body.append(statsRow);

      // Upside from current
      const upside = ((pt.targetMean - currentPrice) / currentPrice) * 100;
      const upsideRow = ctx.el('div', 'edp-detail-row');
      upsideRow.append(ctx.el('span', 'edp-detail-label', 'Implied Upside (Mean)'));
      upsideRow.append(ctx.el('span',
        upside >= 0 ? 'edp-detail-value cp-positive' : 'edp-detail-value cp-negative',
        fmtChange(upside)));
      body.append(upsideRow);

      if (pt.lastUpdated) {
        body.append(ctx.el('div', 'cp-forecast-updated', 'Updated ' + fmtDate(pt.lastUpdated)));
      }

      content.append(card);
    } else if (data.priceTarget) {
      const [card, body] = ctx.sectionCard('Price Target');
      body.append(row(ctx, 'Mean Target', fmtPrice(data.priceTarget.targetMean)));
      body.append(row(ctx, 'High', fmtPrice(data.priceTarget.targetHigh)));
      body.append(row(ctx, 'Low', fmtPrice(data.priceTarget.targetLow)));
      content.append(card);
    }

    // Analyst consensus
    if (data.recommendations.length > 0) {
      const [card, body] = ctx.sectionCard('Analyst Consensus');
      card.classList.add('cp-card-with-action');
      const detailButton = ctx.el('button', 'cp-card-action-btn', 'Open details') as HTMLButtonElement;
      detailButton.type = 'button';
      detailButton.addEventListener('click', () => {
        ctx.navigate(buildAnalystDetailsView(ctx, data));
      });
      card.append(detailButton);
      const latest = data.recommendations[0]!;
      const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;

      if (total > 0) {
        // Summary counts
        const buys = latest.strongBuy + latest.buy;
        const sells = latest.sell + latest.strongSell;
        const summaryRow = ctx.el('div', 'cp-consensus-summary');
        summaryRow.append(buildConsensusCount(ctx, buys, 'Buy', 'cp-positive'));
        summaryRow.append(buildConsensusCount(ctx, latest.hold, 'Hold', 'cp-neutral'));
        summaryRow.append(buildConsensusCount(ctx, sells, 'Sell', 'cp-negative'));
        body.append(summaryRow);

        // Rating bar
        const ratingBar = ctx.el('div', 'cp-rating-bar');
        const segments: [number, string, string][] = [
          [latest.strongBuy,  '#16a34a', 'Strong Buy'],
          [latest.buy,        '#22c55e', 'Buy'],
          [latest.hold,       '#eab308', 'Hold'],
          [latest.sell,       '#f97316', 'Sell'],
          [latest.strongSell, '#ef4444', 'Strong Sell'],
        ];
        for (const [count, color, label] of segments) {
          if (count === 0) continue;
          const seg = ctx.el('div', 'cp-rating-segment');
          seg.style.width = ((count / total) * 100) + '%';
          seg.style.backgroundColor = color;
          seg.title = `${label}: ${count}`;
          seg.textContent = String(count);
          ratingBar.append(seg);
        }
        body.append(ratingBar);

        // Legend
        const legend = ctx.el('div', 'cp-rating-legend');
        const entries: [string, number, string][] = [
          ['Strong Buy',  latest.strongBuy,  '#16a34a'],
          ['Buy',         latest.buy,         '#22c55e'],
          ['Hold',        latest.hold,        '#eab308'],
          ['Sell',        latest.sell,        '#f97316'],
          ['Strong Sell', latest.strongSell,  '#ef4444'],
        ];
        for (const [label, count, color] of entries) {
          const item = ctx.el('div', 'cp-rating-legend-item');
          const dot = ctx.el('span', 'cp-rating-dot');
          dot.style.backgroundColor = color;
          item.append(dot);
          item.append(ctx.el('span', '', `${label} (${count})`));
          legend.append(item);
        }
        body.append(legend);
      }

      // Historical trend
      if (data.recommendations.length > 1) {
        body.append(ctx.el('div', 'cp-trend-title', 'Historical Consensus'));
        for (const rec of data.recommendations.slice(0, 6)) {
          const tTotal = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
          if (tTotal === 0) continue;
          const tRow = ctx.el('div', 'cp-trend-row');
          tRow.append(ctx.el('span', 'cp-trend-period', rec.period));
          const miniBar = ctx.el('div', 'cp-rating-bar cp-rating-bar-mini');
          const segs: [number, string][] = [
            [rec.strongBuy,  '#16a34a'],
            [rec.buy,        '#22c55e'],
            [rec.hold,       '#eab308'],
            [rec.sell,       '#f97316'],
            [rec.strongSell, '#ef4444'],
          ];
          for (const [c, col] of segs) {
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

    if (data.epsEstimates.data.length > 0 || data.revenueEstimates.data.length > 0 || data.earningsSurprises.length > 0) {
      const [card, body] = ctx.sectionCard('Earnings & Revenue');
      const latest = data.earningsSurprises[0];
      if (latest) {
        const summary = ctx.el('div', 'cp-mini-kpi-grid');
        for (const [label, value] of [
          ['Latest EPS', fmtMetric(latest.actual)],
          ['Estimate', fmtMetric(latest.estimate)],
          ['Surprise', fmtChange(latest.surprisePercent ?? 0)],
        ]) {
          const item = ctx.el('div', 'cp-mini-kpi');
          item.append(ctx.el('span', 'cp-mini-kpi-label', label));
          item.append(ctx.el('span', 'cp-mini-kpi-value', value));
          summary.append(item);
        }
        body.append(summary);
      }
      if (data.epsEstimates.data.length > 0) {
        body.append(buildEstimateStrip(ctx, 'EPS Estimates', data.epsEstimates, false));
      }
      if (data.revenueEstimates.data.length > 0) {
        body.append(buildEstimateStrip(ctx, 'Revenue Estimates', data.revenueEstimates, true));
      }
      if (data.earningsSurprises.length > 0) {
        body.append(buildEarningsTable(ctx, data.earningsSurprises.slice(0, 8)));
      }
      content.append(card);
    }

    // Insider transactions
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
        if (tx.transactionValue) {
          details.append(ctx.el('span', 'cp-insider-val', fmtLargeNumber(Math.abs(tx.transactionValue))));
        }
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
      && data.epsEstimates.data.length === 0
      && data.revenueEstimates.data.length === 0
      && data.earningsSurprises.length === 0
    ) {
      content.append(ctx.makeEmpty('No forecast data available'));
    }
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
    if (data.ownership.length === 0) {
      content.append(ctx.makeEmpty('Institutional ownership data unavailable'));
      return;
    }

    const [card, body] = ctx.sectionCard('Top Institutional Holders');

    // Header
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
        .filter(Boolean)
        .join(' · ');
      if (metaText) {
        nameWrap.append(ctx.el('div', 'cp-holders-meta', metaText));
      }

      // Mini bar showing relative size
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

  // ─── Filings Tab ─────────────────────────────────────────────────────────

  private renderFilingsTab(content: HTMLElement, data: CompanyEnriched, ctx: EntityRenderContext): void {
    if (data.ownership.length > 0) {
      const [ownersCard, ownersBody] = ctx.sectionCard('13F Ownership Snapshot');
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

function buildFinancialTable(
  ctx: EntityRenderContext,
  periods: NormalizedFinancialPeriod[],
  rows: FinancialDisplayRow[],
  currency: string,
): HTMLElement {
  if (rows.length === 0) return ctx.makeEmpty('No matching financial rows');
  const wrap = ctx.el('div', 'cp-financial-table-wrap');
  const table = ctx.el('div', 'cp-financial-table');
  table.style.setProperty('--period-count', String(periods.length));
  const header = ctx.el('div', 'cp-financial-table-row cp-financial-table-header');
  header.append(ctx.el('span', 'cp-financial-row-label', `Currency: ${currency}`));
  for (const period of periods) header.append(ctx.el('span', 'cp-financial-cell', period.label));
  table.append(header);
  for (const rowItem of rows) {
    const rowEl = ctx.el('div', 'cp-financial-table-row');
    rowEl.append(ctx.el('span', 'cp-financial-row-label', rowItem.label));
    for (const value of rowItem.values) rowEl.append(ctx.el('span', 'cp-financial-cell', fmtFinancialValue(value)));
    table.append(rowEl);
  }
  wrap.append(table);
  return wrap;
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
    table.append(simpleTableRow(ctx, ['Date', 'Firm', 'Action', 'From', 'To', 'Analyst'], true));
    for (const action of data.ratingActions.slice(0, 40)) {
      table.append(simpleTableRow(ctx, [
        action.gradeTime ? fmtDate(action.gradeTime) : '-',
        action.firm || '-',
        action.action || '-',
        action.fromGrade || '-',
        action.toGrade || '-',
        'Unavailable',
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
