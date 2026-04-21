import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import type { EntityRenderer, EntityRenderContext } from '../types';
import {
  fetchPoliticianTrades,
  estimateHoldingsFromTrades,
  groupTradesByQuarter,
  buildPortfolioInsights,
  estimateTradeValueFromRange,
  fetchHistoricalPrices,
  type CongressTrade,
  type QuarterlyBreakdown,
  type EstimatedTickerHolding,
} from '@/services/market/portfolio';

interface CongressPoliticianData {
  name: string;
  party: string;
  chamber: 'House' | 'Senate';
  district?: string;
  state?: string;
}

interface CongressPoliticianEnriched {
  name: string;
  party: string;
  chamber: 'House' | 'Senate';
  district?: string;
  state?: string;
  trades: CongressTrade[];
  totalBuys: number;
  totalSells: number;
  estimatedVolume: string;
  quarterlyBreakdown: QuarterlyBreakdown[];
  topTickers: EstimatedTickerHolding[];
  performance: PoliticianPerformance | null;
  wikiSummary?: string;
  wikiUrl?: string;
}

interface PoliticianPerformance {
  dates: string[];
  values: number[];
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpe: number;
  note: string;
}

const client = new MarketServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

const TABS = ['holdings', 'trades', 'insights', 'structure', 'performance', 'filings'] as const;
type TabId = typeof TABS[number];

const TAB_LABELS: Record<TabId, string> = {
  holdings: 'Top Holdings',
  trades: 'Largest Trades',
  insights: 'AI Insights',
  structure: 'Portfolio Structure',
  performance: 'Performance History',
  filings: 'Filings / Disclosures',
};

function fmtCurrency(value: number): string {
  if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(1) + 'K';
  return '$' + value.toFixed(0);
}

export class CongressPoliticianRenderer implements EntityRenderer {
  private activeTab: TabId = 'holdings';

  renderSkeleton(data: unknown, ctx: EntityRenderContext): HTMLElement {
    const { name, party, chamber, state } = data as CongressPoliticianData;
    const container = ctx.el('div', 'edp-generic edp-politician-profile');

    const header = ctx.el('div', 'edp-header');
    const badgeRow = ctx.el('div', 'edp-badge-row');
    badgeRow.append(ctx.badge(party || '—', 'edp-badge' + (party === 'Republican' ? ' edp-badge-severity' : party === 'Democrat' ? ' edp-badge-tier' : '')));
    badgeRow.append(ctx.badge(chamber, 'edp-badge'));
    if (state) badgeRow.append(ctx.badge(state, 'edp-badge'));
    header.append(ctx.el('h2', 'edp-title', name || 'Politician'));
    header.append(badgeRow);

    const summary = ctx.el('div', 'edp-trade-stats');
    summary.append(makeStatCard(ctx, 'Disclosures', '—'));
    summary.append(makeStatCard(ctx, 'Est. Volume', '—'));
    summary.append(makeStatCard(ctx, 'Top Ticker', '—'));
    header.append(summary);
    container.append(header);

    const tabBar = ctx.el('div', 'edp-portfolio-tab-bar');
    for (const tab of TABS) {
      const btn = ctx.el('button', `edp-portfolio-tab${tab === this.activeTab ? ' edp-portfolio-tab-active' : ''}`);
      btn.textContent = TAB_LABELS[tab];
      btn.dataset.tab = tab;
      tabBar.append(btn);
    }
    container.append(tabBar);

    const tabContent = ctx.el('div', 'edp-portfolio-tab-content');
    tabContent.dataset.slot = 'tab-content';
    tabContent.append(ctx.makeLoading('Loading trading history…'));
    container.append(tabContent);

    return container;
  }

  async enrich(data: unknown, signal: AbortSignal): Promise<CongressPoliticianEnriched> {
    const d = data as CongressPoliticianData;
    const trades = await fetchPoliticianTrades(d.name);
    const quarterlyBreakdown = groupTradesByQuarter(trades);
    const topTickers = estimateHoldingsFromTrades(trades);
    const performance = await this.computePerformance(trades, signal);

    let estimatedVolume = 0;
    let totalBuys = 0;
    let totalSells = 0;
    for (const trade of trades) {
      const ev = estimateTradeValueFromRange(trade.amount);
      if (trade.transactionType.toLowerCase().includes('purchase')) { totalBuys++; estimatedVolume += ev; }
      else if (trade.transactionType.toLowerCase().includes('sale')) { totalSells++; estimatedVolume += ev; }
      else { estimatedVolume += ev; }
    }

    return {
      ...d,
      trades,
      totalBuys,
      totalSells,
      estimatedVolume: fmtCurrency(estimatedVolume),
      quarterlyBreakdown,
      topTickers,
      performance,
    };
  }

  renderEnriched(container: HTMLElement, enrichedData: unknown, ctx: EntityRenderContext): void {
    const data = enrichedData as CongressPoliticianEnriched;

    const titleEl = container.querySelector('.edp-title');
    if (titleEl) titleEl.textContent = data.name;

    const summary = container.querySelector('.edp-trade-stats');
    if (summary) {
      summary.replaceChildren();
      summary.append(makeStatCard(ctx, 'Disclosures', `${data.trades.length}`));
      summary.append(makeStatCard(ctx, 'Est. Volume', data.estimatedVolume));
      summary.append(makeStatCard(ctx, 'Top Ticker', data.topTickers[0]?.ticker ?? '—'));
    }

    this.activeTab = 'holdings';
    this.renderTabContent(container, data, ctx);

    const tabBar = container.querySelector('.edp-portfolio-tab-bar');
    tabBar?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.edp-portfolio-tab') as HTMLElement | null;
      if (!btn || !btn.dataset.tab) return;
      this.activeTab = btn.dataset.tab as TabId;
      tabBar.querySelectorAll('.edp-portfolio-tab').forEach(t => t.classList.remove('edp-portfolio-tab-active'));
      btn.classList.add('edp-portfolio-tab-active');
      this.renderTabContent(container, data, ctx);
    });
  }

  private renderTabContent(container: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    const content = container.querySelector<HTMLElement>('[data-slot="tab-content"]');
    if (!content) return;
    content.replaceChildren();

    switch (this.activeTab) {
      case 'holdings': this.renderTopHoldings(content, data, ctx); break;
      case 'trades': this.renderLargestTrades(content, data, ctx); break;
      case 'insights': this.renderInsights(content, data, ctx); break;
      case 'structure': this.renderStructure(content, data, ctx); break;
      case 'performance': this.renderPerformance(content, data, ctx); break;
      case 'filings': this.renderFilings(content, data, ctx); break;
    }
  }

  private renderTopHoldings(content: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    if (data.topTickers.length === 0) {
      content.append(ctx.makeEmpty('No estimated holdings from available disclosures.'));
      return;
    }
    const [card, body] = ctx.sectionCard('Estimated Current Exposure');
    const note = ctx.el('div', 'edp-callout edp-callout-attention edp-callout-text');
    note.textContent = 'Estimated values are midpoints of disclosure amount ranges and do not reflect actual position sizes.';
    body.append(note);
    const grid = ctx.el('div', 'edp-holdings-table');
    for (const h of data.topTickers.slice(0, 25)) {
      const rowEl = ctx.el('div', 'edp-holdings-row');
      rowEl.append(ctx.el('span', 'edp-holdings-name', h.ticker));
      rowEl.append(ctx.el('span', 'edp-holdings-detail', h.name));
      const barWrap = ctx.el('div', 'edp-holdings-bar-wrap');
      const bar = ctx.el('div', 'edp-holdings-bar');
      bar.style.width = `${Math.min(h.percentage, 100)}%`;
      barWrap.append(bar);
      rowEl.append(barWrap);
      rowEl.append(ctx.el('span', 'edp-holdings-pct', h.percentage.toFixed(1) + '%'));
      rowEl.append(ctx.el('span', 'edp-holdings-val', fmtCurrency(h.estimatedValue)));
      grid.append(rowEl);
    }
    body.append(grid);
    content.append(card);
  }

  private renderLargestTrades(content: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    if (data.trades.length === 0) {
      content.append(ctx.makeEmpty('No trades found.'));
      return;
    }
    const buys = data.trades
      .filter(t => t.transactionType.toLowerCase().includes('purchase'))
      .sort((a, b) => estimateTradeValueFromRange(b.amount) - estimateTradeValueFromRange(a.amount))
      .slice(0, 10);
    const sells = data.trades
      .filter(t => t.transactionType.toLowerCase().includes('sale'))
      .sort((a, b) => estimateTradeValueFromRange(b.amount) - estimateTradeValueFromRange(a.amount))
      .slice(0, 10);

    const [card, body] = ctx.sectionCard('Largest Transactions');
    if (buys.length > 0) body.append(ctx.el('h4', 'edp-section-subtitle', 'Top Buys'));
    for (const t of buys) body.append(buildTradeRow(ctx, t));
    if (sells.length > 0) body.append(ctx.el('h4', 'edp-section-subtitle', 'Top Sells'));
    for (const t of sells) body.append(buildTradeRow(ctx, t));
    if (buys.length === 0 && sells.length === 0) body.append(ctx.makeEmpty('No buy or sell records available.'));
    content.append(card);
  }

  private renderInsights(content: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Derived Observations');
    const bullets = buildPortfolioInsights({
      kind: 'politician',
      trades: data.trades,
      estimatedHoldings: data.topTickers,
      quarterly: data.quarterlyBreakdown,
    });
    for (const b of bullets) {
      const p = ctx.el('p', 'edp-description');
      p.textContent = b;
      body.append(p);
    }
    content.append(card);
  }

  private renderStructure(content: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    const [card, body] = ctx.sectionCard('Portfolio Composition');
    if (data.topTickers.length > 0) {
      const concentration = ctx.el('div', 'edp-sector-bars');
      for (const h of data.topTickers.slice(0, 8)) {
        const rowEl = ctx.el('div', 'edp-sector-row');
        rowEl.append(ctx.el('span', 'edp-sector-label', h.ticker));
        const barWrap = ctx.el('div', 'edp-sector-bar-wrap');
        const bar = ctx.el('div', 'edp-sector-bar');
        bar.style.width = `${Math.min(h.percentage, 100)}%`;
        barWrap.append(bar);
        rowEl.append(barWrap);
        rowEl.append(ctx.el('span', 'edp-sector-pct', h.percentage.toFixed(1) + '%'));
        concentration.append(rowEl);
      }
      body.append(concentration);
    }
    if (data.quarterlyBreakdown.length > 0) {
      body.append(ctx.el('h4', 'edp-section-subtitle', 'Quarterly Activity'));
      const qGrid = ctx.el('div', 'edp-trade-stats');
      for (const q of data.quarterlyBreakdown.slice(0, 8)) {
        qGrid.append(makeStatCard(ctx, q.quarter, `${q.buys} buys · ${q.sells} sells`));
      }
      body.append(qGrid);
    }
    if (body.children.length === 0) body.append(ctx.makeEmpty('Not enough data to analyze structure.'));
    content.append(card);
  }

  private renderPerformance(content: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    if (!data.performance || data.performance.dates.length < 2) {
      content.append(ctx.makeEmpty('Performance estimation unavailable — position sizing is based on estimated ranges, and a meaningful time series requires mapped ticker-level historical prices.'));
      return;
    }
    const perf = data.performance;
    const host = ctx.el('div', 'edp-performance-chart');
    host.id = 'edp-pol-perf-chart';
    content.append(host);

    const metrics = ctx.el('div', 'edp-performance-metrics');
    metrics.append(makeMetricCard(ctx, 'Total Return', `${perf.totalReturn >= 0 ? '+' : ''}${perf.totalReturn.toFixed(1)}%`, perf.totalReturn >= 0 ? 'positive' : 'negative'));
    metrics.append(makeMetricCard(ctx, 'Max Drawdown', `${perf.maxDrawdown.toFixed(1)}%`, 'negative'));
    metrics.append(makeMetricCard(ctx, 'Sharpe', perf.sharpe.toFixed(2), 'neutral'));
    metrics.append(makeMetricCard(ctx, 'CAGR', `${perf.cagr >= 0 ? '+' : ''}${perf.cagr.toFixed(1)}%`, perf.cagr >= 0 ? 'positive' : 'negative'));
    content.append(metrics);

    const note = ctx.el('p', 'edp-description');
    note.textContent = perf.note;
    content.append(note);

    requestAnimationFrame(() => this.drawPoliticianPerfChart(host, perf));
  }

  private drawPoliticianPerfChart(container: HTMLElement, perf: PoliticianPerformance): void {
    if (!container || perf.dates.length < 2) return;
    import('d3').then(d3 => {
      const width = container.clientWidth || 400;
      const height = 200;
      const margin = { top: 10, right: 10, bottom: 20, left: 50 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = d3.select(container).append('svg').attr('width', width).attr('height', height).style('overflow', 'visible');
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleLinear().domain([0, perf.dates.length - 1]).range([0, innerW]);
      const yScale = d3.scaleLinear().domain([d3.min(perf.values)! * 0.95, d3.max(perf.values)! * 1.05]).range([innerH, 0]);

      const areaGen = d3.area<number>().x((_, i) => xScale(i)).y0(innerH).y1(d => yScale(d)).curve(d3.curveMonotoneX);
      const lineGen = d3.line<number>().x((_, i) => xScale(i)).y(d => yScale(d)).curve(d3.curveMonotoneX);

      g.append('path').datum(perf.values).attr('fill', 'rgba(59, 130, 246, 0.15)').attr('d', areaGen);
      g.append('path').datum(perf.values).attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 1.5).attr('d', lineGen);

      const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat((d: d3.NumberValue) => {
        const idx = Math.round(Number(d));
        return idx >= 0 && idx < perf.dates.length ? perf.dates[idx]!.slice(5) : '';
      });
      g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis).selectAll('text').attr('fill', 'var(--text-dim, #888)').style('font-size', '9px');
      g.selectAll('.domain, .tick line').attr('stroke', 'var(--border, #333)');

      const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat((d: d3.NumberValue) => `$${(Number(d) / 1000).toFixed(1)}k`);
      g.append('g').call(yAxis).selectAll('text').attr('fill', 'var(--text-dim, #888)').style('font-size', '9px');
      g.selectAll('.domain, .tick line').attr('stroke', 'var(--border, #333)');
    }).catch(() => {
      container.innerHTML = '<div class="edp-empty">Chart rendering unavailable.</div>';
    });
  }

  private renderFilings(content: HTMLElement, data: CongressPoliticianEnriched, ctx: EntityRenderContext): void {
    if (data.trades.length === 0) {
      content.append(ctx.makeEmpty('No disclosure records available.'));
      return;
    }
    const grouped = groupTradesByDisclosureDate(data.trades);
    for (const [date, items] of grouped) {
      const [card, body] = ctx.sectionCard(date || 'Unknown Date');
      for (const t of items.slice(0, 20)) {
        body.append(buildTradeRow(ctx, t));
      }
      content.append(card);
    }
  }

  private async computePerformance(trades: CongressTrade[], signal: AbortSignal): Promise<PoliticianPerformance | null> {
    if (trades.length === 0) return null;
    const symbols = Array.from(new Set(trades.map(t => t.ticker).filter(Boolean)));
    if (symbols.length === 0) return null;
    try {
      const quotes = await client.listMarketQuotes({ symbols }, { signal });
      const priceMap = new Map<string, number>();
      for (const q of quotes.quotes) if (q.price > 0) priceMap.set(q.symbol, q.price);

      const oldestDate = trades.reduce((min, t) => {
        const d = new Date(t.transactionDate || t.disclosureDate);
        return !Number.isNaN(d.getTime()) && d < min ? d : min;
      }, new Date());
      const months = Math.max(24, Math.min(60, Math.ceil((Date.now() - oldestDate.getTime()) / (30 * 24 * 60 * 60 * 1000))));

      const series = await fetchHistoricalPrices(symbols, months);
      if (series.length === 0) return null;

      const histMap = new Map<string, Map<string, number>>();
      for (const s of series) {
        const dm = new Map<string, number>();
        for (const p of s.prices) dm.set(p.date, p.close);
        histMap.set(s.symbol, dm);
      }

      const dates: string[] = [];
      const values: number[] = [];

      const sortedDates = Array.from(new Set(series.flatMap(s => s.prices.map(p => p.date)))).sort();

      const tickerNetValue: Record<string, number> = {};
      const tickerAvgPrice: Record<string, { cost: number; shares: number }> = {};
      let lastKnownPortfolioValue = 0;

      for (const date of sortedDates) {
        for (const trade of trades) {
          if ((trade.transactionDate || '') === date) {
            const sym = trade.ticker;
            const dir = trade.transactionType.toLowerCase().includes('purchase') ? 1 : trade.transactionType.toLowerCase().includes('sale') ? -1 : 0;
            if (!dir || !sym) continue;
            const ev = estimateTradeValueFromRange(trade.amount);
            const price = histMap.get(sym)?.get(date) ?? priceMap.get(sym) ?? 0;
            if (!price || !ev) continue;
            const shares = ev / price;
            tickerNetValue[sym] = (tickerNetValue[sym] ?? 0) + (shares * dir);
            const prior = tickerAvgPrice[sym] ?? { cost: 0, shares: 0 };
            const newShares = Math.max(0, prior.shares + shares * dir);
            const newCost = prior.cost + (dir > 0 ? ev : 0);
            tickerAvgPrice[sym] = { cost: newCost, shares: newShares };
          }
        }

        let portfolioValue = 0;
        let hasPrice = false;
        for (const sym of symbols) {
          const price = histMap.get(sym)?.get(date) ?? priceMap.get(sym) ?? 0;
          const netShares = tickerNetValue[sym] ?? 0;
          if (price && netShares > 0) {
            portfolioValue += netShares * price;
            hasPrice = true;
          }
        }

        if (hasPrice) {
          dates.push(date);
          values.push(portfolioValue);
          lastKnownPortfolioValue = portfolioValue;
        }
      }

      if (dates.length < 2) return null;

      const totalReturn = lastKnownPortfolioValue > 0 ? ((lastKnownPortfolioValue - values[0]!) / values[0]!) * 100 : 0;
      const years = dates.length / 252;
      const cagr = years > 0 && values[0]! > 0 ? (Math.pow(lastKnownPortfolioValue / values[0]!, 1 / years) - 1) * 100 : 0;

      let peak = -Infinity;
      let maxDrawdown = 0;
      for (const v of values) {
        if (v > peak) peak = v;
        const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
        if (dd < maxDrawdown) maxDrawdown = dd;
      }

      const dailyReturns: number[] = [];
      for (let i = 1; i < values.length; i++) {
        if (values[i - 1]! > 0) dailyReturns.push((values[i]! - values[i - 1]!) / values[i - 1]!);
      }
      const avgR = dailyReturns.reduce((a, b) => a + b, 0) / Math.max(dailyReturns.length, 1);
      const stdR = dailyReturns.length > 1
        ? Math.sqrt(dailyReturns.reduce((a, b) => a + (b - avgR) ** 2, 0) / (dailyReturns.length - 1))
        : 0;
      const sharpe = stdR > 0 ? (avgR / stdR) * Math.sqrt(252) : 0;

      return {
        dates,
        values,
        totalReturn,
        cagr,
        maxDrawdown,
        sharpe,
        note: 'Estimated from disclosure ranges and historical prices. Actual position sizes may differ.',
      };
    } catch {
      return null;
    }
  }
}

function makeStatCard(ctx: EntityRenderContext, label: string, value: string): HTMLElement {
  const el = ctx.el('div', 'edp-stat-highlight');
  el.append(ctx.el('span', 'edp-stat-highlight-label', label));
  el.append(ctx.el('span', 'edp-stat-highlight-value', value));
  return el;
}

function makeMetricCard(ctx: EntityRenderContext, label: string, value: string, tone: 'positive' | 'negative' | 'neutral'): HTMLElement {
  const el = ctx.el('div', 'edp-stat-highlight' + (tone === 'positive' ? ' edp-stat-positive' : tone === 'negative' ? ' edp-stat-negative' : ''));
  el.append(ctx.el('span', 'edp-stat-highlight-label', label));
  el.append(ctx.el('span', 'edp-stat-highlight-value', value));
  return el;
}

function buildTradeRow(ctx: EntityRenderContext, trade: CongressTrade): HTMLElement {
  const rowEl = ctx.el('div', 'edp-disclosure-row');
  const isPurchase = trade.transactionType.toLowerCase().includes('purchase');
  const isSale = trade.transactionType.toLowerCase().includes('sale');
  const typeClass = isPurchase ? 'edp-disclosure-badge edp-disclosure-badge-buy' : isSale ? 'edp-disclosure-badge edp-disclosure-badge-sell' : 'edp-disclosure-badge';
  const badge = ctx.el('span', typeClass, isPurchase ? 'BUY' : isSale ? 'SELL' : trade.transactionType);
  rowEl.append(badge);
  const info = ctx.el('div', 'edp-disclosure-info');
  info.append(ctx.el('span', 'edp-disclosure-name', trade.ticker));
  info.append(ctx.el('span', 'edp-disclosure-detail', `${trade.assetDescription || ''} · ${trade.amount}`));
  rowEl.append(info);
  rowEl.append(ctx.el('span', 'edp-disclosure-date', trade.transactionDate));
  return rowEl;
}

function groupTradesByDisclosureDate(trades: CongressTrade[]): Map<string, CongressTrade[]> {
  const map = new Map<string, CongressTrade[]>();
  for (const trade of trades) {
    const key = trade.disclosureDate || trade.transactionDate || 'Unknown';
    const arr = map.get(key) ?? [];
    arr.push(trade);
    map.set(key, arr);
  }
  const sorted = new Map<string, CongressTrade[]>();
  Array.from(map.keys()).sort().reverse().forEach(k => sorted.set(k, map.get(k)!));
  return sorted;
}
