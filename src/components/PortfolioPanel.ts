import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import {
  fetchCongressTrades,
  getUserPositions,
  addUserPosition,
  removeUserPosition,
  NOTABLE_INVESTORS,
  fetchHistoricalPrices,
  computePortfolioPerformance,
  computeCorrelationMatrix,
  type CongressTrade,
  type PriceSeries,
  type PerformanceResult,
} from '@/services/market/portfolio';
import {
  fetchSec13FFeed,
  filterFilings,
  sortFilings,
  type SecFilingEntry,
  type FilingsSort,
  type FilingsFilter,
} from '@/services/market/sec-filings';

type Tab = 'portfolio' | 'congress' | 'institutions' | 'visualizer';
type VisualizerSubTab = 'performance' | 'correlations';

const TAB_LABELS: Record<Tab, string> = {
  portfolio: 'My Portfolio',
  congress: 'Congress',
  institutions: 'Institutions',
  visualizer: t('portfolio.visualizer') || 'Visualizer',
};

const client = new MarketServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

export class PortfolioPanel extends Panel {
  private activeTab: Tab = 'portfolio';
  private congressCache: CongressTrade[] | null = null;
  private congressFilter = '';
  private vizSubTab: VisualizerSubTab = 'performance';
  private vizCache: { series: PriceSeries[] | null; timestamp: number } = { series: null, timestamp: 0 };
  private vizAbort: AbortController | null = null;
  private filingsCache: SecFilingEntry[] | null = null;
  private filingsSort: FilingsSort = 'newest';
  private filingsTypeFilter = 'all';
  private filingsDateRange: FilingsFilter['dateRange'] = 'all';
  private filingsSearch = '';

  constructor() {
    super({
      id: 'portfolio-tracker',
      title: t('panels.portfolioTracker'),
    });
    void this.render();
  }

  public async render(): Promise<void> {
    this.renderShell();
    await this.renderTabContent();
  }

  private renderShell(): void {
    const tabBar = Object.entries(TAB_LABELS)
      .map(([key, label]) =>
        `<button class="pf-tab${key === this.activeTab ? ' pf-tab-active' : ''}" data-tab="${escapeHtml(key)}">${escapeHtml(label)}</button>`)
      .join('');

    const shell = `
      <div class="pf-shell">
        <div class="pf-tab-bar">${tabBar}</div>
        <div class="pf-content" id="pf-content"></div>
      </div>
    `;
    this.setContentNow(shell);

    this.content.querySelectorAll<HTMLElement>('.pf-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab as Tab;
        this.content.querySelectorAll('.pf-tab').forEach(t => t.classList.remove('pf-tab-active'));
        btn.classList.add('pf-tab-active');
        this.renderTabContent();
      });
    });
  }

  private async renderTabContent(): Promise<void> {
    const contentEl = this.content.querySelector('#pf-content') as HTMLElement | null;
    if (!contentEl) return;
    contentEl.innerHTML = '<div class="pf-loading">Loading\u2026</div>';

    try {
      switch (this.activeTab) {
        case 'portfolio': await this.renderPortfolioTab(contentEl); break;
        case 'congress': await this.renderCongressTab(contentEl); break;
        case 'institutions': await this.renderInstitutionsTab(contentEl); break;
        case 'visualizer': await this.renderVisualizerTab(contentEl); break;
      }
    } catch (err) {
      contentEl.innerHTML = `<div class="pf-error">Error loading data: ${escapeHtml(String(err))}</div>`;
    }
  }

  // ─── My Portfolio ────────────────────────────────────────────────────────

  private async renderPortfolioTab(contentEl: HTMLElement): Promise<void> {
    const positions = getUserPositions();

    const quotes = new Map<string, { price: number; change: number }>();
    if (positions.length > 0) {
      try {
        const resp = await client.listMarketQuotes({ symbols: positions.map(p => p.symbol) });
        for (const q of resp.quotes) quotes.set(q.symbol, q);
      } catch { /* quotes unavailable */ }
    }

    let totalValue = 0;
    let totalCost = 0;
    const rows = positions.map(pos => {
      const quote = quotes.get(pos.symbol);
      const currentPrice = quote?.price ?? 0;
      const marketValue = currentPrice * pos.shares;
      const costBasis = pos.avgCost * pos.shares;
      const pnl = marketValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      totalValue += marketValue;
      totalCost += costBasis;

      const pnlClass = pnl >= 0 ? 'pf-positive' : 'pf-negative';
      const pnlSign = pnl >= 0 ? '+' : '';

      return `
        <div class="pf-position-row">
          <div class="pf-pos-info">
            <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}">${escapeHtml(pos.symbol)}</span>
            <span class="pf-pos-name">${escapeHtml(pos.name)}</span>
          </div>
          <div class="pf-pos-data">
            <div class="pf-pos-col">
              <span class="pf-pos-label">Shares</span>
              <span class="pf-pos-val">${pos.shares.toLocaleString()}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">Avg Cost</span>
              <span class="pf-pos-val">$${pos.avgCost.toFixed(2)}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">Price</span>
              <span class="pf-pos-val">${currentPrice ? '$' + currentPrice.toFixed(2) : '\u2014'}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">P&amp;L</span>
              <span class="pf-pos-val ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pnlSign}${pnlPct.toFixed(1)}%)</span>
            </div>
            <button class="pf-remove-btn" data-symbol="${escapeHtml(pos.symbol)}" title="Remove">\u00d7</button>
          </div>
        </div>
      `;
    }).join('');

    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const totalPnlClass = totalPnl >= 0 ? 'pf-positive' : 'pf-negative';
    const totalPnlSign = totalPnl >= 0 ? '+' : '';

    contentEl.innerHTML = `
      <div class="pf-add-form">
        <input type="text" class="pf-input" id="pf-add-symbol" placeholder="Symbol (e.g. AAPL)" />
        <input type="number" class="pf-input pf-input-sm" id="pf-add-shares" placeholder="Shares" min="0" step="1" />
        <input type="number" class="pf-input pf-input-sm" id="pf-add-cost" placeholder="Avg Cost" min="0" step="0.01" />
        <button class="pf-add-btn" id="pf-add-btn">Add</button>
      </div>
      ${positions.length > 0 ? `
        <div class="pf-summary">
          <div class="pf-summary-item">
            <span class="pf-summary-label">Portfolio Value</span>
            <span class="pf-summary-val">$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="pf-summary-item">
            <span class="pf-summary-label">Total P&amp;L</span>
            <span class="pf-summary-val ${totalPnlClass}">${totalPnlSign}$${Math.abs(totalPnl).toFixed(2)} (${totalPnlSign}${totalPnlPct.toFixed(1)}%)</span>
          </div>
        </div>
        <div class="pf-positions">${rows}</div>
      ` : '<div class="pf-empty">No positions yet. Add a stock above to start tracking your portfolio.</div>'}
    `;

    const addBtn = contentEl.querySelector('#pf-add-btn');
    addBtn?.addEventListener('click', () => {
      const symbolInput = contentEl.querySelector('#pf-add-symbol') as HTMLInputElement;
      const sharesInput = contentEl.querySelector('#pf-add-shares') as HTMLInputElement;
      const costInput = contentEl.querySelector('#pf-add-cost') as HTMLInputElement;
      const symbol = symbolInput.value.trim().toUpperCase();
      const shares = parseFloat(sharesInput.value);
      const avgCost = parseFloat(costInput.value);
      if (!symbol || !shares || !avgCost) return;
      addUserPosition({ symbol, name: symbol, shares, avgCost });
      this.renderTabContent();
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol;
        if (symbol) {
          removeUserPosition(symbol);
          this.renderTabContent();
        }
      });
    });
  }

  // ─── Congress Tab ────────────────────────────────────────────────────────

  private async renderCongressTab(contentEl: HTMLElement): Promise<void> {
    if (!this.congressCache) {
      const resp = await fetchCongressTrades();
      this.congressCache = resp.trades;
    }

    let trades = this.congressCache;
    if (this.congressFilter) {
      const f = this.congressFilter.toLowerCase();
      trades = trades.filter(tr =>
        tr.politician.toLowerCase().includes(f) ||
        tr.ticker.toLowerCase().includes(f) ||
        tr.party.toLowerCase().includes(f)
      );
    }

    const rows = trades.slice(0, 100).map(trade => {
      const isPurchase = trade.transactionType.toLowerCase().includes('purchase');
      const isSale = trade.transactionType.toLowerCase().includes('sale');
      const typeClass = isPurchase ? 'pf-positive' : isSale ? 'pf-negative' : '';
      const typeLabel = isPurchase ? 'BUY' : isSale ? 'SELL' : escapeHtml(trade.transactionType);
      const partyColor = trade.party === 'Republican' ? '#ef4444' : trade.party === 'Democrat' ? '#3b82f6' : '#888';

      return `
        <div class="pf-congress-row">
          <div class="pf-cg-header">
            <span class="pf-cg-name">${escapeHtml(trade.politician)}</span>
            <span class="pf-cg-party" style="color:${partyColor}">${escapeHtml(trade.party.charAt(0))}</span>
            <span class="pf-cg-chamber">${escapeHtml(trade.chamber)}</span>
            <span class="pf-cg-date">${escapeHtml(trade.transactionDate)}</span>
          </div>
          <div class="pf-cg-details">
            <span class="pf-cg-ticker ticker-link" data-ticker="${escapeHtml(trade.ticker)}" data-name="${escapeHtml(trade.assetDescription)}">${escapeHtml(trade.ticker)}</span>
            <span class="pf-cg-type ${typeClass}">${typeLabel}</span>
            <span class="pf-cg-amount">${escapeHtml(trade.amount)}</span>
          </div>
          ${trade.assetDescription ? `<div class="pf-cg-desc">${escapeHtml(trade.assetDescription.slice(0, 80))}</div>` : ''}
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      <div class="pf-filter-bar">
        <input type="text" class="pf-input" id="pf-congress-filter" placeholder="Filter by name, ticker, or party\u2026" value="${escapeHtml(this.congressFilter)}" />
        <span class="pf-count">${trades.length} trades</span>
      </div>
      <div class="pf-congress-list">${rows || '<div class="pf-empty">No trades found</div>'}</div>
    `;

    const filterInput = contentEl.querySelector('#pf-congress-filter') as HTMLInputElement;
    let debounce: ReturnType<typeof setTimeout>;
    filterInput?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.congressFilter = filterInput.value.trim();
        this.renderTabContent();
      }, 300);
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-cg-name').forEach(el => {
      el.addEventListener('click', () => {
        const row = el.closest('.pf-congress-row');
        if (!row) return;
        const trade = this.congressCache?.find(t => t.politician === el.textContent?.trim());
        if (!trade) return;
        document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
          detail: {
            type: 'congressPolitician',
            data: {
              name: trade.politician,
              party: trade.party,
              chamber: trade.chamber,
              district: trade.district,
              state: trade.state,
            },
          },
        }));
      });
    });
  }

  // ─── Institutions Tab ────────────────────────────────────────────────────

  private async renderInstitutionsTab(contentEl: HTMLElement): Promise<void> {
    contentEl.innerHTML = `
      <div class="pf-toolbar" id="pf-inst-toolbar">
        <input type="text" class="pf-input pf-toolbar-search" id="pf-filings-search" placeholder="Search filings\u2026" value="${escapeHtml(this.filingsSearch)}" />
        <select class="pf-select pf-toolbar-select" id="pf-filings-sort">
          <option value="newest"${this.filingsSort === 'newest' ? ' selected' : ''}>Newest</option>
          <option value="oldest"${this.filingsSort === 'oldest' ? ' selected' : ''}>Oldest</option>
          <option value="name"${this.filingsSort === 'name' ? ' selected' : ''}>Name A-Z</option>
        </select>
        <select class="pf-select pf-toolbar-select" id="pf-filings-type">
          <option value="all"${this.filingsTypeFilter === 'all' ? ' selected' : ''}>All Types</option>
          <option value="13F-HR"${this.filingsTypeFilter === '13F-HR' ? ' selected' : ''}>13F-HR</option>
          <option value="13F-NT"${this.filingsTypeFilter === '13F-NT' ? ' selected' : ''}>13F-NT</option>
          <option value="13F-HR/A"${this.filingsTypeFilter === '13F-HR/A' ? ' selected' : ''}>13F-HR/A</option>
        </select>
        <select class="pf-select pf-toolbar-select" id="pf-filings-date">
          <option value="all"${this.filingsDateRange === 'all' ? ' selected' : ''}>All Dates</option>
          <option value="7d"${this.filingsDateRange === '7d' ? ' selected' : ''}>7 Days</option>
          <option value="30d"${this.filingsDateRange === '30d' ? ' selected' : ''}>30 Days</option>
          <option value="quarter"${this.filingsDateRange === 'quarter' ? ' selected' : ''}>Quarter</option>
        </select>
      </div>

      <div class="pf-inst-section pf-inst-filings" id="pf-inst-filings">
        <div class="pf-inst-section-label">Live 13F Filings</div>
        <div id="pf-filings-list" class="pf-filings-list"><div class="pf-loading">Loading filings\u2026</div></div>
      </div>

      <div class="pf-inst-section pf-inst-notable">
        <div class="pf-inst-section-label">Quick Access &mdash; Notable Investors</div>
        <div class="pf-notable-compact-grid" id="pf-notable-grid">
          ${this.renderNotableCards()}
        </div>
      </div>
    `;

    this.bindToolbarEvents(contentEl);
    this.bindNotableCardEvents(contentEl);
    await this.renderFilingsList(contentEl);
  }

  private bindToolbarEvents(contentEl: HTMLElement): void {
    const searchInput = contentEl.querySelector('#pf-filings-search') as HTMLInputElement;
    let debounce: ReturnType<typeof setTimeout>;
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.filingsSearch = searchInput.value.trim();
        this.renderFilingsList(contentEl);
      }, 300);
    });

    const sortSelect = contentEl.querySelector('#pf-filings-sort') as HTMLSelectElement;
    sortSelect?.addEventListener('change', () => {
      this.filingsSort = sortSelect.value as FilingsSort;
      this.renderFilingsList(contentEl);
    });

    const typeSelect = contentEl.querySelector('#pf-filings-type') as HTMLSelectElement;
    typeSelect?.addEventListener('change', () => {
      this.filingsTypeFilter = typeSelect.value;
      this.renderFilingsList(contentEl);
    });

    const dateSelect = contentEl.querySelector('#pf-filings-date') as HTMLSelectElement;
    dateSelect?.addEventListener('change', () => {
      this.filingsDateRange = dateSelect.value as FilingsFilter['dateRange'];
      this.renderFilingsList(contentEl);
    });
  }

  private async renderFilingsList(contentEl: HTMLElement): Promise<void> {
    const listEl = contentEl.querySelector('#pf-filings-list') as HTMLElement;
    if (!listEl) return;

    if (!this.filingsCache) {
      this.filingsCache = await fetchSec13FFeed();
    }

    let entries = filterFilings(this.filingsCache, {
      type: this.filingsTypeFilter,
      dateRange: this.filingsDateRange,
      search: this.filingsSearch,
    });
    entries = sortFilings(entries, this.filingsSort);

    if (entries.length === 0) {
      listEl.innerHTML = '<div class="pf-empty">No 13F filings found matching your filters.</div>';
      return;
    }

    const rows = entries.slice(0, 50).map(entry => {
      const typeClass = entry.filingType === '13F-HR' ? 'pf-filing-type-hr'
        : entry.filingType === '13F-NT' ? 'pf-filing-type-nt'
        : entry.filingType === '13F-HR/A' ? 'pf-filing-type-amend'
        : 'pf-filing-type-other';
      const dateStr = entry.filedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

      return `
        <div class="pf-filing-row" data-cik="${escapeHtml(entry.cik)}" data-name="${escapeHtml(entry.filerName)}">
          <span class="pf-filing-type-badge ${typeClass}">${escapeHtml(entry.filingType)}</span>
          <div class="pf-filing-info">
            <span class="pf-filing-name">${escapeHtml(entry.filerName)}</span>
            <span class="pf-filing-cik">CIK: ${escapeHtml(entry.cik || '\u2014')}</span>
          </div>
          <span class="pf-filing-date">${dateStr}</span>
          ${entry.url ? `<a class="pf-filing-link" href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer" title="View on EDGAR">\u2197</a>` : ''}
        </div>
      `;
    }).join('');

    listEl.innerHTML = rows;

    listEl.querySelectorAll<HTMLElement>('.pf-filing-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.pf-filing-link')) return;
        const cik = row.dataset.cik;
        const name = row.dataset.name;
        if (cik) {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: { type: 'institution', data: { name: name || '', cik } },
          }));
        }
      });
    });
  }

  private renderNotableCards(): string {
    return NOTABLE_INVESTORS.map(inv => `
      <div class="pf-notable-compact-card" data-cik="${escapeHtml(inv.cik)}" title="${escapeHtml(inv.name)} \u2014 ${escapeHtml(inv.description)}">
        <div class="pf-notable-compact-name">${escapeHtml(inv.name.split(' ')[0] ?? inv.name)}</div>
        <div class="pf-notable-compact-desc">${escapeHtml(inv.description)}</div>
      </div>
    `).join('');
  }

  private bindNotableCardEvents(contentEl: HTMLElement): void {
    contentEl.querySelectorAll<HTMLElement>('.pf-notable-compact-card').forEach(card => {
      card.addEventListener('click', () => {
        const cik = card.dataset.cik;
        const inv = NOTABLE_INVESTORS.find(i => i.cik === cik);
        if (cik) {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: { type: 'institution', data: { name: inv?.name || '', cik } },
          }));
        }
      });
    });
  }

  // ─── Visualizer Tab ──────────────────────────────────────────────────────

  private async renderVisualizerTab(contentEl: HTMLElement): Promise<void> {
    const positions = getUserPositions();
    if (positions.length === 0) {
      contentEl.innerHTML = `
        <div class="pf-empty">
          ${t('portfolio.visualizerEmpty') || 'Add positions in the My Portfolio tab to see performance analytics.'}
        </div>
      `;
      return;
    }

    const subTabBar = `
      <div class="pf-viz-tab-bar">
        <button class="pf-viz-subtab${this.vizSubTab === 'performance' ? ' pf-viz-subtab-active' : ''}" data-subtab="performance">${t('portfolio.performance') || 'Performance'}</button>
        <button class="pf-viz-subtab${this.vizSubTab === 'correlations' ? ' pf-viz-subtab-active' : ''}" data-subtab="correlations">${t('portfolio.correlations') || 'Correlations'}</button>
      </div>
    `;

    contentEl.innerHTML = `${subTabBar}<div id="pf-viz-content"><div class="pf-loading">Loading historical data\u2026</div></div>`;

    contentEl.querySelectorAll<HTMLElement>('.pf-viz-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.vizSubTab = btn.dataset.subtab as VisualizerSubTab;
        contentEl.querySelectorAll('.pf-viz-subtab').forEach(b => b.classList.remove('pf-viz-subtab-active'));
        btn.classList.add('pf-viz-subtab-active');
        this.renderVizSubContent(contentEl);
      });
    });

    await this.fetchVizData(positions);
    this.renderVizSubContent(contentEl);
  }

  private async fetchVizData(positions: { symbol: string }[]): Promise<void> {
    const cacheAge = Date.now() - this.vizCache.timestamp;
    if (this.vizCache.series && cacheAge < 5 * 60_000) return;

    this.vizAbort?.abort();
    this.vizAbort = new AbortController();

    try {
      const months = this.vizSubTab === 'correlations' ? 12 : 24;
      const series = await fetchHistoricalPrices(
        positions.map(p => p.symbol),
        months,
      );
      this.vizCache = { series, timestamp: Date.now() };
    } catch {
      this.vizCache = { series: [], timestamp: Date.now() };
    }
  }

  private renderVizSubContent(contentEl: HTMLElement): void {
    const vizContent = contentEl.querySelector('#pf-viz-content') as HTMLElement | null;
    if (!vizContent) return;

    if (!this.vizCache.series || this.vizCache.series.length === 0) {
      vizContent.innerHTML = '<div class="pf-empty">No historical data available for your positions.</div>';
      return;
    }

    if (this.vizSubTab === 'performance') {
      this.renderPerformanceSubTab(vizContent);
    } else {
      this.renderCorrelationsSubTab(vizContent);
    }
  }

  private renderPerformanceSubTab(contentEl: HTMLElement): void {
    const positions = getUserPositions();
    const perf = computePortfolioPerformance(positions, this.vizCache.series!);

    if (perf.dates.length === 0) {
      contentEl.innerHTML = '<div class="pf-empty">Not enough data to compute performance.</div>';
      return;
    }

    const fmt = (n: number, decimals = 2) => n.toFixed(decimals);
    const retClass = perf.totalReturn >= 0 ? 'pf-positive' : 'pf-negative';
    const retSign = perf.totalReturn >= 0 ? '+' : '';

    contentEl.innerHTML = `
      <div class="pf-viz-chart" id="pf-perf-chart"></div>
      <div class="pf-viz-summary">
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.totalReturn') || 'Total Return'}</span>
          <span class="pf-viz-val ${retClass}">${retSign}${fmt(perf.totalReturn)}%</span>
        </div>
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.cagr') || 'CAGR'}</span>
          <span class="pf-viz-val ${perf.cagr >= 0 ? 'pf-positive' : 'pf-negative'}">${fmt(perf.cagr)}%</span>
        </div>
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.maxDrawdown') || 'Max Drawdown'}</span>
          <span class="pf-viz-val pf-negative">${fmt(perf.maxDrawdown)}%</span>
        </div>
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.sharpe') || 'Sharpe'}</span>
          <span class="pf-viz-val">${fmt(perf.sharpe)}</span>
        </div>
      </div>
    `;

    this.drawPerformanceChart(contentEl.querySelector('#pf-perf-chart') as HTMLElement, perf);
  }

  private drawPerformanceChart(container: HTMLElement | null, perf: PerformanceResult): void {
    if (!container || perf.dates.length < 2) return;

    import('d3').then(d3 => {
      const width = container.clientWidth || 400;
      const height = 200;
      const margin = { top: 10, right: 10, bottom: 20, left: 50 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('overflow', 'visible');

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const allValues = [...perf.values, perf.costBasis];
      const xScale = d3.scaleLinear()
        .domain([0, perf.dates.length - 1])
        .range([0, innerW]);
      const yScale = d3.scaleLinear()
        .domain([d3.min(allValues)! * 0.95, d3.max(allValues)! * 1.05])
        .range([innerH, 0]);

      const areaGen = d3.area<number>()
        .x((_, i) => xScale(i))
        .y0(innerH)
        .y1(d => yScale(d))
        .curve(d3.curveMonotoneX);

      const lineGen = d3.line<number>()
        .x((_, i) => xScale(i))
        .y(d => yScale(d))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(perf.values)
        .attr('fill', 'rgba(59, 130, 246, 0.15)')
        .attr('d', areaGen);

      g.append('path')
        .datum(perf.values)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 1.5)
        .attr('d', lineGen);

      const cbY = yScale(perf.costBasis);
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', cbY).attr('y2', cbY)
        .attr('stroke', 'var(--text-dim, #888)')
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1);

      const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat((d: d3.NumberValue) => {
          const idx = Math.round(Number(d));
          return idx >= 0 && idx < perf.dates.length ? perf.dates[idx]!.slice(5) : '';
        });
      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .selectAll('text')
        .attr('fill', 'var(--text-dim, #888)')
        .style('font-size', '9px');
      g.selectAll('.domain, .tick line').attr('stroke', 'var(--border, #333)');

      const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat((d: d3.NumberValue) => `$${(Number(d) / 1000).toFixed(1)}k`);
      g.append('g')
        .call(yAxis)
        .selectAll('text')
        .attr('fill', 'var(--text-dim, #888)')
        .style('font-size', '9px');
      g.selectAll('.domain, .tick line').attr('stroke', 'var(--border, #333)');

      const tooltip = d3.select(container).append('div')
        .attr('class', 'pf-viz-tooltip')
        .style('opacity', 0);
      const focus = g.append('g').style('display', 'none');
      focus.append('circle').attr('r', 3).attr('fill', '#3b82f6');
      focus.append('line').attr('class', 'pf-viz-focus-line')
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', 'var(--text-dim, #555)').attr('stroke-dasharray', '2,2').attr('stroke-width', 0.5);

      svg.append('rect')
        .attr('width', width).attr('height', height)
        .attr('fill', 'transparent')
        .on('mousemove', (event: MouseEvent) => {
          const [mx] = d3.pointer(event);
          const idx = Math.round(xScale.invert(mx - margin.left));
          if (idx < 0 || idx >= perf.values.length) return;
          const val = perf.values[idx]!;
          focus.style('display', null)
            .attr('transform', `translate(${xScale(idx)},${yScale(val)})`);
          focus.select('line.pf-viz-focus-line').attr('x1', 0).attr('x2', 0);
          tooltip.style('opacity', 1)
            .html(`<strong>${perf.dates[idx]}</strong><br/>$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>${val >= perf.costBasis ? '+' : ''}${((val - perf.costBasis) / perf.costBasis * 100).toFixed(1)}%`)
            .style('left', `${Math.min(mx + 10, width - 160)}px`)
            .style('top', `${event.offsetY - 30}px`);
        })
        .on('mouseleave', () => {
          focus.style('display', 'none');
          tooltip.style('opacity', 0);
        });
    }).catch(() => {
      container.innerHTML = '<div class="pf-empty">Chart rendering unavailable.</div>';
    });
  }

  private renderCorrelationsSubTab(contentEl: HTMLElement): void {
    const positions = getUserPositions();
    const corr = computeCorrelationMatrix(positions, this.vizCache.series!);
    const n = corr.symbols.length;

    if (n < 2 || corr.matrix.length === 0) {
      contentEl.innerHTML = '<div class="pf-empty">Need at least 2 positions with price history to compute correlations.</div>';
      return;
    }

    const cellSize = Math.min(48, Math.floor((contentEl.clientWidth - 60) / n));

    const html = `
      <div class="pf-viz-corr-scroll">
        <div class="pf-viz-corr-grid" style="grid-template-columns: 48px repeat(${n}, ${cellSize}px);" id="pf-corr-grid">
          <div class="pf-corr-empty"></div>
          ${corr.symbols.map(s => `<div class="pf-corr-header">${escapeHtml(s)}</div>`).join('')}
          ${corr.matrix.map((row, i) => `
            <div class="pf-corr-row-label">${escapeHtml(corr.symbols[i]!)}</div>
            ${row.map((val, j) => {
              const r = i < j ? (corr.matrix[j]![i]! + val) / 2 : val;
              const color = corrColor(r);
              return `<div class="pf-corr-cell" style="background:${color}" data-i="${i}" data-j="${j}" title="${corr.symbols[i]} / ${corr.symbols[j]}: ${val.toFixed(2)}">${val.toFixed(2)}</div>`;
            }).join('')}
          `).join('')}
        </div>
      </div>
      <div class="pf-viz-summary">
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.avgCorrelation') || 'Avg Correlation'}</span>
          <span class="pf-viz-val">${corr.average.toFixed(2)}</span>
        </div>
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.mostCorrelated') || 'Most Correlated'}</span>
          <span class="pf-viz-val">${corr.maxPair[0] && corr.maxPair[1] ? `${corr.maxPair[0]}/${corr.maxPair[1]}` : '\u2014'} (${corr.maxPair[2].toFixed(2)})</span>
        </div>
        <div class="pf-viz-card">
          <span class="pf-viz-label">${t('portfolio.leastCorrelated') || 'Least Correlated'}</span>
          <span class="pf-viz-val">${corr.minPair[0] && corr.minPair[1] ? `${corr.minPair[0]}/${corr.minPair[1]}` : '\u2014'} (${corr.minPair[2].toFixed(2)})</span>
        </div>
      </div>
    `;
    contentEl.innerHTML = html;
  }
}

function corrColor(val: number): string {
  if (val >= 0) {
    const t = Math.min(val, 1);
    const r = Math.round(220 - t * 188);
    const g = Math.round(220 - t * 80);
    const b = Math.round(220 + t * 36);
    return `rgb(${r},${g},${b})`;
  }
  const t = Math.min(-val, 1);
  const r = Math.round(220 + t * 19);
  const g = Math.round(220 - t * 120);
  const b = Math.round(220 - t * 120);
  return `rgb(${r},${g},${b})`;
}

