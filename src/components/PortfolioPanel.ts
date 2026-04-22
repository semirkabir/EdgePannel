import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import {
  fetchCongressTrades,
  fetchInstitutionalHoldings,
  getUserPositions,
  addUserPosition,
  editUserPosition,
  removeUserPosition,
  NOTABLE_INVESTORS,
  type CongressTrade,
  type InstitutionalHoldingsResponse,
  getTickerSector,
  SECTOR_COLORS,
  sparklineSvg,
  donutSvg,
  sortCongressTrades,
  type CongressSortField,
  type SortDir,
} from '@/services/market/portfolio';
import { setMarketWatchlistEntries, getMarketWatchlistEntries } from '@/services/market-watchlist';

type Tab = 'portfolio' | 'filings' | 'tools';
type ToolCategoryKey = 'all' | 'planning' | 'research' | 'construction' | 'attribution' | 'lab';
type ToolGroupKey =
  | 'backtest-portfolio'
  | 'factor-analysis'
  | 'asset-analytics'
  | 'monte-carlo-simulation'
  | 'portfolio-optimization'
  | 'tactical-asset-allocation'
  | 'forward-testing';
type ToolKey =
  | 'backtest-asset-allocation'
  | 'backtest-portfolio-core'
  | 'backtest-dynamic-allocation'
  | 'manager-performance-analysis'
  | 'factor-regression'
  | 'risk-factor-allocation'
  | 'match-factor-exposures'
  | 'principal-component-analysis'
  | 'factor-statistics'
  | 'fund-factor-regressions'
  | 'fund-performance-attribution'
  | 'fund-screener'
  | 'fund-rankings'
  | 'fund-performance'
  | 'asset-correlations'
  | 'asset-autocorrelation'
  | 'asset-cointegration'
  | 'monte-carlo-simulation-core'
  | 'financial-goals'
  | 'asset-liability-modeling'
  | 'efficient-frontier'
  | 'portfolio-optimization-core'
  | 'black-litterman-model'
  | 'rolling-optimization'
  | 'market-valuation'
  | 'moving-averages'
  | 'momentum-rotation'
  | 'dual-momentum'
  | 'adaptive-allocation'
  | 'target-volatility'
  | 'walk-forward-testing'
  | 'out-of-sample-validation'
  | 'scenario-forward-testing';

interface ToolCategory {
  key: ToolCategoryKey;
  label: string;
}

interface ToolItem {
  key: ToolKey;
  label: string;
}

interface ToolGroup {
  key: ToolGroupKey;
  title: string;
  description: string;
  categories: ToolCategoryKey[];
  tools: ToolItem[];
}

const TAB_LABELS: Record<Tab, string> = {
  portfolio: 'My Portfolio',
  filings: 'Public Filings',
  tools: 'Tools',
};

const TOOL_CATEGORIES: ToolCategory[] = [
  { key: 'all', label: 'All Functions' },
  { key: 'planning', label: 'Financial Planning' },
  { key: 'research', label: 'Research & Insights' },
  { key: 'construction', label: 'Portfolio Construction' },
  { key: 'attribution', label: 'Performance Attribution' },
  { key: 'lab', label: 'Model Laboratory' },
];

const TOOL_GROUPS: ToolGroup[] = [
  {
    key: 'backtest-portfolio',
    title: 'Backtest Portfolio',
    description: 'Backtest a portfolio asset allocation and compare historical and realized returns and risk characteristics against benchmark and model portfolios.',
    categories: ['all', 'construction', 'attribution'],
    tools: [
      { key: 'backtest-asset-allocation', label: 'Backtest Asset Allocation' },
      { key: 'backtest-portfolio-core', label: 'Backtest Portfolio' },
      { key: 'backtest-dynamic-allocation', label: 'Backtest Dynamic Allocation' },
      { key: 'manager-performance-analysis', label: 'Manager Performance Analysis' },
    ],
  },
  {
    key: 'factor-analysis',
    title: 'Factor Analysis',
    description: 'Run factor and regression analysis to understand portfolio return drivers, factor exposures, and attribution against systematic risk premia.',
    categories: ['all', 'research', 'attribution'],
    tools: [
      { key: 'factor-regression', label: 'Factor Regression' },
      { key: 'risk-factor-allocation', label: 'Risk Factor Allocation' },
      { key: 'match-factor-exposures', label: 'Match Factor Exposures' },
      { key: 'principal-component-analysis', label: 'Principal Component Analysis' },
      { key: 'factor-statistics', label: 'Factor Statistics' },
      { key: 'fund-factor-regressions', label: 'Fund Factor Regressions' },
      { key: 'fund-performance-attribution', label: 'Fund Performance Attribution' },
    ],
  },
  {
    key: 'asset-analytics',
    title: 'Asset Analytics',
    description: 'Screen funds, compare rankings, and inspect correlation structure across assets and funds before they enter a portfolio model.',
    categories: ['all', 'research'],
    tools: [
      { key: 'fund-screener', label: 'Fund Screener' },
      { key: 'fund-rankings', label: 'Fund Rankings' },
      { key: 'fund-performance', label: 'Fund Performance' },
      { key: 'asset-correlations', label: 'Asset Correlations' },
      { key: 'asset-autocorrelation', label: 'Asset Autocorrelation' },
      { key: 'asset-cointegration', label: 'Asset Cointegration' },
    ],
  },
  {
    key: 'monte-carlo-simulation',
    title: 'Monte Carlo Simulation',
    description: 'Model long-horizon portfolio outcomes using historical or forecast assumptions to test sustainability, goals, and liability coverage.',
    categories: ['all', 'planning', 'lab'],
    tools: [
      { key: 'monte-carlo-simulation-core', label: 'Monte Carlo Simulation' },
      { key: 'financial-goals', label: 'Financial Goals' },
      { key: 'asset-liability-modeling', label: 'Asset Liability Modeling' },
    ],
  },
  {
    key: 'portfolio-optimization',
    title: 'Portfolio Optimization',
    description: 'Explore efficient frontier and optimizer workflows for risk-return trade-offs, constrained allocations, and view-based portfolio construction.',
    categories: ['all', 'construction', 'lab'],
    tools: [
      { key: 'efficient-frontier', label: 'Efficient Frontier' },
      { key: 'portfolio-optimization-core', label: 'Portfolio Optimization' },
      { key: 'black-litterman-model', label: 'Black-Litterman Model' },
      { key: 'rolling-optimization', label: 'Rolling Optimization' },
    ],
  },
  {
    key: 'tactical-asset-allocation',
    title: 'Tactical Asset Allocation',
    description: 'Compare tactical allocation rules using valuation, momentum, moving averages, and volatility-targeting frameworks.',
    categories: ['all', 'construction', 'lab'],
    tools: [
      { key: 'market-valuation', label: 'Market Valuation' },
      { key: 'moving-averages', label: 'Moving Averages' },
      { key: 'momentum-rotation', label: 'Momentum Rotation' },
      { key: 'dual-momentum', label: 'Dual Momentum' },
      { key: 'adaptive-allocation', label: 'Adaptive Allocation' },
      { key: 'target-volatility', label: 'Target Volatility' },
    ],
  },
  {
    key: 'forward-testing',
    title: 'Forward Testing',
    description: 'Reserve space for walk-forward validation and out-of-sample testing tools so strategies can graduate from research into live evaluation.',
    categories: ['all', 'research', 'lab'],
    tools: [
      { key: 'walk-forward-testing', label: 'Walk-Forward Testing' },
      { key: 'out-of-sample-validation', label: 'Out-of-Sample Validation' },
      { key: 'scenario-forward-testing', label: 'Scenario Forward Testing' },
    ],
  },
];

const client = new MarketServiceClient('', {
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});

type CongressFilter = { party: string; chamber: string; type: string };
type FeaturedPolitician = {
  name: string;
  party: string;
  chamber: 'House' | 'Senate';
  state: string;
  tradeCount: number;
  latestDisclosure: string;
};

export class PortfolioPanel extends Panel {
  private activeTab: Tab = 'portfolio';
  private congressCache: CongressTrade[] | null = null;
  private institutionHoldingsCache = new Map<string, InstitutionalHoldingsResponse>();
  private filingsFilter = '';
  private congressFilters: CongressFilter = { party: '', chamber: '', type: '' };
  private congressSort: { field: CongressSortField; dir: SortDir } = { field: 'date', dir: 'desc' };
  private institutionCik: string | null = null;
  private activeToolsCategory: ToolCategoryKey = 'all';
  private activeToolGroup: ToolGroupKey | null = null;
  private activeTool: ToolKey | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private editingSymbol: string | null = null;

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

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.activeTab === 'portfolio' && document.visibilityState === 'visible') {
        this.renderTabContent();
      }
    }, 60_000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
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
        this.editingSymbol = null;
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
        case 'filings': await this.renderFilingsTab(contentEl); break;
        case 'tools': this.renderToolsTab(contentEl); break;
      }
    } catch (err) {
      contentEl.innerHTML = `<div class="pf-error">Error loading data: ${escapeHtml(String(err))}</div>`;
    }
  }

  // ─── My Portfolio ────────────────────────────────────────────────────────

  private async renderPortfolioTab(contentEl: HTMLElement): Promise<void> {
    const positions = getUserPositions();
    const quotes = new Map<string, { price: number; change: number; sparkline: number[]; name: string }>();
    let lastUpdated = '';

    if (positions.length > 0) {
      try {
        const resp = await client.listMarketQuotes({ symbols: positions.map(p => p.symbol) });
        for (const q of resp.quotes) quotes.set(q.symbol, { price: q.price, change: q.change, sparkline: q.sparkline, name: q.name });
        lastUpdated = new Date().toLocaleTimeString();
      } catch { /* quotes unavailable */ }
    }

    this.startAutoRefresh();

    if (positions.length === 0) {
      contentEl.innerHTML = `
        <div class="pf-add-form">
          <input type="text" class="pf-input" id="pf-add-symbol" placeholder="Symbol (e.g. AAPL)" />
          <input type="number" class="pf-input pf-input-sm" id="pf-add-shares" placeholder="Shares" min="0" step="1" />
          <input type="number" class="pf-input pf-input-sm" id="pf-add-cost" placeholder="Avg Cost" min="0" step="0.01" />
          <button class="pf-add-btn" id="pf-add-btn">Add</button>
        </div>
        <div class="pf-empty">No positions yet. Add a stock above to start tracking your portfolio.</div>
      `;
      this.bindAddForm(contentEl);
      return;
    }

    let totalValue = 0;
    let totalCost = 0;
    const sectorMap = new Map<string, number>();

    const rows = positions.map(pos => {
      const quote = quotes.get(pos.symbol);
      const currentPrice = quote?.price ?? 0;
      const dayChange = quote?.change ?? 0;
      const sparkData = quote?.sparkline ?? [];
      const marketValue = currentPrice * pos.shares;
      const costBasis = pos.avgCost * pos.shares;
      const pnl = marketValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      totalValue += marketValue;
      totalCost += costBasis;

      const sector = getTickerSector(pos.symbol);
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + marketValue);

      const pnlClass = pnl >= 0 ? 'pf-positive' : 'pf-negative';
      const pnlSign = pnl >= 0 ? '+' : '';
      const dayClass = dayChange >= 0 ? 'pf-positive' : 'pf-negative';
      const daySign = dayChange >= 0 ? '+' : '';

      const isEditing = this.editingSymbol === pos.symbol;
      const sectorColor = SECTOR_COLORS[sector] || SECTOR_COLORS.Other;

      if (isEditing) {
        return `
          <div class="pf-position-row pf-editing" data-symbol="${escapeHtml(pos.symbol)}">
            <div class="pf-pos-info">
              <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}">${escapeHtml(pos.symbol)}</span>
              <span class="pf-pos-sector" style="background:${sectorColor}30;color:${sectorColor}">${escapeHtml(sector)}</span>
            </div>
            <div class="pf-edit-form">
              <label class="pf-edit-label">Shares<input type="number" class="pf-input pf-input-sm pf-edit-input" id="pf-edit-shares-${escapeHtml(pos.symbol)}" value="${pos.shares}" min="0" step="1" /></label>
              <label class="pf-edit-label">Avg Cost<input type="number" class="pf-input pf-input-sm pf-edit-input" id="pf-edit-cost-${escapeHtml(pos.symbol)}" value="${pos.avgCost.toFixed(2)}" min="0" step="0.01" /></label>
              <button class="pf-edit-save" data-symbol="${escapeHtml(pos.symbol)}">Save</button>
              <button class="pf-edit-cancel">Cancel</button>
            </div>
          </div>`;
      }

      return `
        <div class="pf-position-row" data-symbol="${escapeHtml(pos.symbol)}">
          <div class="pf-pos-info">
            <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}">${escapeHtml(pos.symbol)}</span>
            <span class="pf-pos-name">${escapeHtml(quote?.name || pos.name)}</span>
            <span class="pf-pos-sector" style="background:${sectorColor}30;color:${sectorColor}">${escapeHtml(sector)}</span>
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
              <span class="pf-pos-label">Day</span>
              <span class="pf-pos-val ${dayClass}">${dayChange !== 0 ? daySign + dayChange.toFixed(2) + '%' : '\u2014'}</span>
            </div>
            <div class="pf-pos-col">
              <span class="pf-pos-label">P&amp;L</span>
              <span class="pf-pos-val ${pnlClass}">${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pnlSign}${pnlPct.toFixed(1)}%)</span>
            </div>
            ${sparkData.length >= 2 ? `<div class="pf-pos-spark">${sparklineSvg(sparkData, dayChange, 56, 20)}</div>` : ''}
            <div class="pf-pos-actions">
              <button class="pf-icon-btn pf-watchlist-add" data-symbol="${escapeHtml(pos.symbol)}" data-name="${escapeHtml(pos.name)}" title="Add to watchlist">\u2606</button>
              <button class="pf-icon-btn pf-edit-btn" data-symbol="${escapeHtml(pos.symbol)}" title="Edit">\u270E</button>
              <button class="pf-remove-btn" data-symbol="${escapeHtml(pos.symbol)}" title="Remove">\u00d7</button>
            </div>
          </div>
        </div>`;
    }).join('');

    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const totalPnlClass = totalPnl >= 0 ? 'pf-positive' : 'pf-negative';
    const totalPnlSign = totalPnl >= 0 ? '+' : '';

    const donutSegments = Array.from(sectorMap.entries())
      .map(([label, value]) => ({ label, value, color: (SECTOR_COLORS as Record<string, string>)[label] ?? SECTOR_COLORS.Other! }))
      .sort((a, b) => b.value - a.value);

    const donutHtml = donutSegments.length > 1
      ? `<div class="pf-donut-wrap">${donutSvg(donutSegments, 120, 14)}<div class="pf-donut-legend">${donutSegments.map(s => `<span class="pf-donut-legend-item"><span class="pf-donut-dot" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`).join('')}</div></div>`
      : '';

    contentEl.innerHTML = `
      <div class="pf-add-form">
        <input type="text" class="pf-input" id="pf-add-symbol" placeholder="Symbol (e.g. AAPL)" />
        <input type="number" class="pf-input pf-input-sm" id="pf-add-shares" placeholder="Shares" min="0" step="1" />
        <input type="number" class="pf-input pf-input-sm" id="pf-add-cost" placeholder="Avg Cost" min="0" step="0.01" />
        <button class="pf-add-btn" id="pf-add-btn">Add</button>
      </div>
      <div class="pf-summary">
        <div class="pf-summary-item">
          <span class="pf-summary-label">Portfolio Value</span>
          <span class="pf-summary-val">$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">Total P&amp;L</span>
          <span class="pf-summary-val ${totalPnlClass}">${totalPnlSign}$${Math.abs(totalPnl).toFixed(2)} (${totalPnlSign}${totalPnlPct.toFixed(1)}%)</span>
        </div>
        ${lastUpdated ? `<div class="pf-summary-item"><span class="pf-summary-label">Updated</span><span class="pf-summary-val pf-updated">${escapeHtml(lastUpdated)}</span></div>` : ''}
      </div>
      ${donutHtml}
      <div class="pf-positions">${rows}</div>
    `;

    this.bindAddForm(contentEl);
    this.bindPositionActions(contentEl);
  }

  private bindAddForm(contentEl: HTMLElement): void {
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

    const symbolInput = contentEl.querySelector('#pf-add-symbol') as HTMLInputElement;
    if (symbolInput) {
      symbolInput.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') addBtn?.dispatchEvent(new Event('click'));
      });
    }
  }

  private bindPositionActions(contentEl: HTMLElement): void {
    contentEl.querySelectorAll<HTMLElement>('.pf-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol;
        if (symbol) { removeUserPosition(symbol); this.renderTabContent(); }
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editingSymbol = btn.dataset.symbol || null;
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-edit-save').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol!;
        const sharesInput = contentEl.querySelector(`#pf-edit-shares-${CSS.escape(symbol)}`) as HTMLInputElement;
        const costInput = contentEl.querySelector(`#pf-edit-cost-${CSS.escape(symbol)}`) as HTMLInputElement;
        const shares = parseFloat(sharesInput?.value);
        const avgCost = parseFloat(costInput?.value);
        if (shares && avgCost) {
          editUserPosition(symbol, { shares, avgCost });
        }
        this.editingSymbol = null;
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-edit-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editingSymbol = null;
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-watchlist-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol || '';
        const name = btn.dataset.name || symbol;
        if (!symbol) return;
        const entries = getMarketWatchlistEntries();
        if (!entries.some(e => e.symbol === symbol)) {
          entries.push({ symbol, name });
          setMarketWatchlistEntries(entries);
        }
        btn.textContent = '\u2605';
        btn.classList.add('pf-watchlisted');
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.ticker-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = el.dataset.ticker;
        const name = el.dataset.name;
        if (ticker) {
          const panel = (window as any).__entityDetailPanel;
          panel?.show('company', { ticker, name: name || ticker });
        }
      });
    });
  }

  // ─── Public Filings Tab ──────────────────────────────────────────────────

  private async renderFilingsTab(contentEl: HTMLElement): Promise<void> {
    if (!this.congressCache) {
      const resp = await fetchCongressTrades();
      this.congressCache = resp.trades;
    }

    const query = this.filingsFilter.trim().toLowerCase();
    const featuredInstitutions = NOTABLE_INVESTORS.filter(inv => this.matchesInstitution(inv, query));
    const featuredPoliticians = this.getFeaturedPoliticians(this.congressCache)
      .filter(pol => this.matchesPolitician(pol, query))
      .slice(0, query ? 16 : 8);

    let trades = sortCongressTrades(this.congressCache, this.congressSort.field, this.congressSort.dir);

    if (query) {
      trades = trades.filter(tr =>
        tr.politician.toLowerCase().includes(query) ||
        tr.ticker.toLowerCase().includes(query) ||
        tr.party.toLowerCase().includes(query) ||
        tr.assetDescription.toLowerCase().includes(query) ||
        tr.chamber.toLowerCase().includes(query) ||
        tr.state.toLowerCase().includes(query)
      );
    }

    if (this.congressFilters.party) {
      trades = trades.filter(tr => tr.party === this.congressFilters.party);
    }
    if (this.congressFilters.chamber) {
      trades = trades.filter(tr => tr.chamber === this.congressFilters.chamber);
    }
    if (this.congressFilters.type) {
      const tf = this.congressFilters.type;
      trades = trades.filter(tr => {
        const t = tr.transactionType.toLowerCase();
        if (tf === 'purchase') return t.includes('purchase');
        if (tf === 'sale') return t.includes('sale');
        return true;
      });
    }

    const sortIcon = (field: CongressSortField) => {
      if (this.congressSort.field !== field) return ' \u2195';
      return this.congressSort.dir === 'asc' ? ' \u2191' : ' \u2193';
    };

    const featuredInstitutionCards = featuredInstitutions.map(inv => `
      <button class="pf-featured-card pf-featured-card-firm${this.institutionCik === inv.cik ? ' pf-featured-card-active' : ''}" data-featured-kind="institution" data-cik="${escapeHtml(inv.cik)}" data-name="${escapeHtml(inv.name)}">
        <span class="pf-featured-eyebrow">Featured Firm</span>
        <span class="pf-featured-name">${escapeHtml(inv.name)}</span>
        <span class="pf-featured-meta">${escapeHtml(inv.description)}</span>
        <span class="pf-featured-badge">13F Filing</span>
      </button>
    `).join('');

    const featuredPoliticianCards = featuredPoliticians.map(pol => `
      <button class="pf-featured-card pf-featured-card-politician" data-featured-kind="politician" data-name="${escapeHtml(pol.name)}" data-party="${escapeHtml(pol.party)}" data-chamber="${escapeHtml(pol.chamber)}" data-state="${escapeHtml(pol.state)}">
        <span class="pf-featured-eyebrow">Featured Politician</span>
        <span class="pf-featured-name">${escapeHtml(pol.name)}</span>
        <span class="pf-featured-meta">${escapeHtml(pol.party)} \u00b7 ${escapeHtml(pol.chamber)}${pol.state ? ` \u00b7 ${escapeHtml(pol.state)}` : ''}</span>
        <span class="pf-featured-badge">Congress Filing</span>
      </button>
    `).join('');

    const rows = trades.slice(0, 100).map(trade => {
      const isPurchase = trade.transactionType.toLowerCase().includes('purchase');
      const isSale = trade.transactionType.toLowerCase().includes('sale');
      const typeClass = isPurchase ? 'pf-positive' : isSale ? 'pf-negative' : '';
      const typeLabel = isPurchase ? 'BUY' : isSale ? 'SELL' : escapeHtml(trade.transactionType);
      const partyColor = trade.party === 'Republican' ? '#ef4444' : trade.party === 'Democrat' ? '#3b82f6' : '#888';

      return `
        <div class="pf-congress-row" data-trade-idx="${escapeHtml(String(this.congressCache!.indexOf(trade)))}">
          <div class="pf-cg-header">
            <button class="pf-cg-name" data-name="${escapeHtml(trade.politician)}" data-party="${escapeHtml(trade.party)}" data-chamber="${escapeHtml(trade.chamber)}" data-state="${escapeHtml(trade.state)}">${escapeHtml(trade.politician)}</button>
            <span class="pf-cg-party" style="color:${partyColor}">${escapeHtml(trade.party.charAt(0))}</span>
            <span class="pf-cg-chamber">${escapeHtml(trade.chamber)}</span>
          </div>
          <div class="pf-cg-details">
            <span class="pf-cg-ticker ticker-link" data-ticker="${escapeHtml(trade.ticker)}" data-name="${escapeHtml(trade.assetDescription)}">${escapeHtml(trade.ticker)}</span>
            <span class="pf-cg-type ${typeClass}">${typeLabel}</span>
            <span class="pf-cg-amount">${escapeHtml(trade.amount)}</span>
          </div>
          <div class="pf-cg-meta">
            <span class="pf-cg-date">Trade ${escapeHtml(trade.transactionDate)}</span>
            <span class="pf-cg-filing">Congress filing ${escapeHtml(trade.disclosureDate)}</span>
          </div>
          ${trade.assetDescription ? `<div class="pf-cg-desc">${escapeHtml(trade.assetDescription.slice(0, 80))}</div>` : ''}
        </div>`;
    }).join('');

    contentEl.innerHTML = `
      <div class="pf-filter-bar">
        <input type="text" class="pf-input" id="pf-filings-filter" placeholder="Search politicians, firms, tickers, or parties\u2026" value="${escapeHtml(this.filingsFilter)}" />
        <div class="pf-filter-chips">
          <button class="pf-chip${!this.congressFilters.party ? ' pf-chip-active' : ''}" data-filter="party" data-value="">All</button>
          <button class="pf-chip${this.congressFilters.party === 'Democrat' ? ' pf-chip-active' : ''}" data-filter="party" data-value="Democrat" style="--chip-color:#3b82f6">D</button>
          <button class="pf-chip${this.congressFilters.party === 'Republican' ? ' pf-chip-active' : ''}" data-filter="party" data-value="Republican" style="--chip-color:#ef4444">R</button>
          <span class="pf-chip-sep">|</span>
          <button class="pf-chip${!this.congressFilters.type ? ' pf-chip-active' : ''}" data-filter="type" data-value="">All</button>
          <button class="pf-chip${this.congressFilters.type === 'purchase' ? ' pf-chip-active pf-positive' : ''}" data-filter="type" data-value="purchase">Buy</button>
          <button class="pf-chip${this.congressFilters.type === 'sale' ? ' pf-chip-active pf-negative' : ''}" data-filter="type" data-value="sale">Sell</button>
        </div>
      </div>
      <div class="pf-section">
        <div class="pf-section-head">
          <div>
            <div class="pf-section-title">Featured Filers</div>
            <div class="pf-section-subtitle">Congress disclosures and notable 13F firms in one view.</div>
          </div>
        </div>
        <div class="pf-featured-stack">
          <div class="pf-featured-group">
            <div class="pf-featured-group-title">Featured Firms</div>
            <div class="pf-featured-grid">${featuredInstitutionCards || '<div class="pf-empty">No firm matches.</div>'}</div>
          </div>
          <div class="pf-featured-group">
            <div class="pf-featured-group-title">Featured Politicians</div>
            <div class="pf-featured-grid">${featuredPoliticianCards || '<div class="pf-empty">No politician matches.</div>'}</div>
          </div>
        </div>
      </div>
      <div class="pf-section pf-inst-shell">
        <div class="pf-section-head">
          <div>
            <div class="pf-section-title">Latest 13F Filing</div>
            <div class="pf-section-subtitle">Select a featured firm above to load its most recent disclosed holdings.</div>
          </div>
          <div class="pf-inst-actions">
            ${this.institutionCik ? '<button class="pf-inline-btn" id="pf-open-institution-detail" type="button">Open Profile</button><button class="pf-inline-btn-secondary" id="pf-clear-institution" type="button">Clear</button>' : ''}
          </div>
        </div>
        <div id="pf-holdings-content">${this.institutionCik ? '<div class="pf-loading">Loading 13F holdings\u2026</div>' : '<div class="pf-empty">Choose a featured firm to load its latest 13F filing.</div>'}</div>
      </div>
      <div class="pf-section">
        <div class="pf-section-head">
          <div>
            <div class="pf-section-title">Congress Filings</div>
            <div class="pf-section-subtitle">Individual disclosures reported by members of Congress.</div>
          </div>
          <div class="pf-count">${trades.length} filings${trades.length > 100 ? ' (showing first 100)' : ''}</div>
        </div>
      </div>
      <div class="pf-congress-header">
        <button class="pf-sort-btn" data-sort="politician">Politician${sortIcon('politician')}</button>
        <button class="pf-sort-btn" data-sort="ticker">Ticker${sortIcon('ticker')}</button>
        <button class="pf-sort-btn" data-sort="type">Type${sortIcon('type')}</button>
        <button class="pf-sort-btn" data-sort="amount">Amount${sortIcon('amount')}</button>
        <button class="pf-sort-btn" data-sort="date">Date${sortIcon('date')}</button>
      </div>
      <div class="pf-congress-list">${rows || '<div class="pf-empty">No trades found</div>'}</div>
    `;

    const filterInput = contentEl.querySelector('#pf-filings-filter') as HTMLInputElement;
    let debounce: number | undefined;
    filterInput?.addEventListener('input', () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => { this.filingsFilter = filterInput.value.trim(); this.renderTabContent(); }, 300);
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filterType = chip.dataset.filter as keyof CongressFilter;
        const value = chip.dataset.value;
        if (filterType) { (this.congressFilters as any)[filterType] = value; }
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.sort as CongressSortField;
        if (this.congressSort.field === field) {
          this.congressSort.dir = this.congressSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this.congressSort = { field, dir: 'desc' };
        }
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-congress-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.ticker-link, .pf-sort-btn, button, a')) return;
        const idx = parseInt(row.dataset.tradeIdx || '0', 10);
        const trade = this.congressCache?.[idx];
        if (trade) {
          const panel = (window as any).__entityDetailPanel;
          panel?.show('congressTrade', trade);
        }
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-featured-card').forEach(card => {
      card.addEventListener('click', () => {
        const kind = card.dataset.featuredKind;
        if (kind === 'institution') {
          this.institutionCik = card.dataset.cik || null;
          this.renderTabContent();
          return;
        }
        const name = card.dataset.name;
        if (name) {
          const panel = (window as any).__entityDetailPanel;
          panel?.show('congressPolitician', {
            name,
            party: card.dataset.party || '',
            chamber: (card.dataset.chamber as 'House' | 'Senate') || 'House',
            state: card.dataset.state || '',
          });
        }
      });
    });

    const clearInstitutionBtn = contentEl.querySelector('#pf-clear-institution');
    clearInstitutionBtn?.addEventListener('click', () => {
      this.institutionCik = null;
      this.renderTabContent();
    });

    const openInstitutionBtn = contentEl.querySelector('#pf-open-institution-detail');
    openInstitutionBtn?.addEventListener('click', () => {
      if (!this.institutionCik) return;
      const institution = NOTABLE_INVESTORS.find(inv => inv.cik === this.institutionCik);
      const panel = (window as any).__entityDetailPanel;
      panel?.show('institution', {
        name: institution?.name || 'Institution',
        cik: this.institutionCik,
      });
    });

    if (this.institutionCik) {
      await this.loadInstitutionHoldings(contentEl);
    }

    contentEl.querySelectorAll<HTMLElement>('.pf-cg-name').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = el.dataset.name;
        if (!name) return;
        const panel = (window as any).__entityDetailPanel;
        panel?.show('congressPolitician', {
          name,
          party: el.dataset.party || '',
          chamber: (el.dataset.chamber as 'House' | 'Senate') || 'House',
          state: el.dataset.state || '',
        });
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-cg-ticker').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = el.dataset.ticker;
        const name = el.dataset.name;
        if (ticker) {
          const panel = (window as any).__entityDetailPanel;
          panel?.show('company', { ticker, name: name || ticker });
        }
      });
    });
  }

  private async loadInstitutionHoldings(contentEl: HTMLElement): Promise<void> {
    const holdingsDiv = contentEl.querySelector('#pf-holdings-content') as HTMLElement | null;
    if (!holdingsDiv || !this.institutionCik) return;
    holdingsDiv.innerHTML = '<div class="pf-loading">Loading 13F holdings\u2026</div>';

    try {
      const data = await this.getInstitutionHoldings(this.institutionCik);

      if (data.holdings.length === 0) {
        holdingsDiv.innerHTML = '<div class="pf-empty">No holdings data available for this filer.</div>';
        return;
      }

      const totalValue = data.holdings.reduce((sum, h) => sum + h.value, 0);
      const sectorMap = new Map<string, number>();
      for (const h of data.holdings) {
        const sector = getTickerSector(h.issuer.split(' ')[0] || h.issuer);
        sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.value);
      }

      const donutSegments = Array.from(sectorMap.entries())
        .map(([label, value]) => ({ label, value, color: (SECTOR_COLORS as Record<string, string>)[label] ?? SECTOR_COLORS.Other! }))
        .sort((a, b) => b.value - a.value);

      const donutHtml = donutSegments.length > 1
        ? `<div class="pf-donut-wrap">${donutSvg(donutSegments, 120, 14)}<div class="pf-donut-legend">${donutSegments.map(s => `<span class="pf-donut-legend-item"><span class="pf-donut-dot" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`).join('')}</div></div>`
        : '';

      const rows = data.holdings.map((h, i) => {
        const pct = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
        return `
          <div class="pf-holding-row">
            <span class="pf-hold-rank">${i + 1}</span>
            <div class="pf-hold-info">
              <span class="pf-hold-name">${escapeHtml(h.issuer)}</span>
              <span class="pf-hold-title">${escapeHtml(h.title)}</span>
            </div>
            <div class="pf-hold-data">
              <span class="pf-hold-value">$${formatLargeNum(h.value)}</span>
              <span class="pf-hold-shares">${h.shares.toLocaleString()} shr</span>
              <div class="pf-hold-pct-bar">
                <div class="pf-hold-pct-fill" style="width:${Math.min(pct, 100)}%"></div>
              </div>
              <span class="pf-hold-pct">${pct.toFixed(1)}%</span>
            </div>
          </div>
        `;
      }).join('');

      holdingsDiv.innerHTML = `
        <div class="pf-inst-header">
          <span class="pf-inst-name">${escapeHtml(data.name)}</span>
          <span class="pf-inst-label">13F Filing</span>
          <span class="pf-inst-meta">Filed ${escapeHtml(data.filingDate)} \u00b7 ${data.totalHoldings} positions \u00b7 13F value $${formatLargeNum(totalValue)}</span>
        </div>
        ${donutHtml}
        <div class="pf-holdings-list">${rows}</div>
      `;
    } catch (err) {
      holdingsDiv.innerHTML = `<div class="pf-error">Failed to load holdings: ${escapeHtml(String(err))}</div>`;
    }
  }

  private getFeaturedPoliticians(trades: CongressTrade[]): FeaturedPolitician[] {
    const politicians = new Map<string, FeaturedPolitician>();

    for (const trade of trades) {
      const existing = politicians.get(trade.politician);
      if (existing) {
        existing.tradeCount += 1;
        if (trade.disclosureDate > existing.latestDisclosure) {
          existing.latestDisclosure = trade.disclosureDate;
        }
        continue;
      }

      politicians.set(trade.politician, {
        name: trade.politician,
        party: trade.party,
        chamber: trade.chamber,
        state: trade.state,
        tradeCount: 1,
        latestDisclosure: trade.disclosureDate,
      });
    }

    return Array.from(politicians.values()).sort((a, b) =>
      b.tradeCount - a.tradeCount || b.latestDisclosure.localeCompare(a.latestDisclosure)
    );
  }

  private matchesInstitution(investor: { name: string; description: string }, query: string): boolean {
    if (!query) return true;
    return investor.name.toLowerCase().includes(query) || investor.description.toLowerCase().includes(query);
  }

  private matchesPolitician(politician: FeaturedPolitician, query: string): boolean {
    if (!query) return true;
    return (
      politician.name.toLowerCase().includes(query) ||
      politician.party.toLowerCase().includes(query) ||
      politician.chamber.toLowerCase().includes(query) ||
      politician.state.toLowerCase().includes(query)
    );
  }

  private async getInstitutionHoldings(cik: string): Promise<InstitutionalHoldingsResponse> {
    const cached = this.institutionHoldingsCache.get(cik);
    if (cached) return cached;
    const data = await fetchInstitutionalHoldings(cik);
    this.institutionHoldingsCache.set(cik, data);
    return data;
  }

  // ─── Tools Tab ───────────────────────────────────────────────────────────

  private renderToolsTab(contentEl: HTMLElement): void {
    const visibleGroups = TOOL_GROUPS.filter(group =>
      this.activeToolsCategory === 'all' || group.categories.includes(this.activeToolsCategory)
    );

    const selectedGroup = this.activeToolGroup
      ? visibleGroups.find(group => group.key === this.activeToolGroup) || null
      : null;
    const selectedTool = this.activeTool
      ? visibleGroups.flatMap(group => group.tools.map(tool => ({ group, tool }))).find(entry => entry.tool.key === this.activeTool) || null
      : null;

    const categoryRail = TOOL_CATEGORIES.map(category => `
      <button class="pf-tools-category${category.key === this.activeToolsCategory ? ' pf-tools-category-active' : ''}" data-tools-category="${escapeHtml(category.key)}">
        ${escapeHtml(category.label)}
      </button>
    `).join('');

    const cards = visibleGroups.map(group => {
      const isSelectedGroup = selectedGroup?.key === group.key || selectedTool?.group.key === group.key;
      const toolItems = group.tools.map(tool => `
        <button class="pf-tool-link${selectedTool?.tool.key === tool.key ? ' pf-tool-link-active' : ''}" data-tool-group="${escapeHtml(group.key)}" data-tool-key="${escapeHtml(tool.key)}">
          ${escapeHtml(tool.label)} <span class="pf-tool-link-arrow">\u203a</span>
        </button>
      `).join('');

      return `
        <section class="pf-tool-card${isSelectedGroup ? ' pf-tool-card-active' : ''}" data-tool-card="${escapeHtml(group.key)}">
          <div class="pf-tool-card-head">
            <span class="pf-tool-card-title">${escapeHtml(group.title)}</span>
          </div>
          <div class="pf-tool-card-rule"></div>
          <p class="pf-tool-card-description">${escapeHtml(group.description)}</p>
          <div class="pf-tool-link-list">${toolItems}</div>
        </section>
      `;
    }).join('');

    const detailTitle = selectedTool?.tool.label || 'Select a tool';
    const detailGroup = selectedTool?.group.title || 'Tool Page';
    const detailDescription = selectedTool
      ? `This is the blank page shell for ${selectedTool.tool.label}. We can define its inputs, controls, charts, and outputs next.`
      : 'Choose a specific tool from the catalog to open its page here.';

    contentEl.innerHTML = `
      <div class="pf-tools-shell">
        <aside class="pf-tools-rail">
          <div class="pf-tools-rail-head">
            <div class="pf-tools-kicker">Tools</div>
            <div class="pf-tools-heading">Select Solutions For</div>
          </div>
          <div class="pf-tools-category-list">${categoryRail}</div>
        </aside>
        <section class="pf-tools-main">
          ${selectedTool ? `
            <div class="pf-tools-detail pf-tools-detail-open">
              <div class="pf-tools-detail-head">
                <button class="pf-tools-back" id="pf-tools-back" type="button">\u2039 Back to catalog</button>
                <span class="pf-tools-detail-badge">${escapeHtml(detailGroup)}</span>
                <h3 class="pf-tools-detail-title">${escapeHtml(detailTitle)}</h3>
                <p class="pf-tools-detail-copy">${escapeHtml(detailDescription)}</p>
              </div>
              <div class="pf-tool-page-shell">
                <div class="pf-tool-page-toolbar">
                  <div class="pf-tool-page-pill">${escapeHtml(selectedTool.group.title)}</div>
                  <div class="pf-tool-page-pill pf-tool-page-pill-muted">${escapeHtml(selectedTool.tool.label)}</div>
                </div>
                <div class="pf-tool-page-body">
                  <div class="pf-tool-page-canvas">Blank tool page</div>
                </div>
              </div>
            </div>
          ` : `
            <section class="pf-tools-catalog">
              <div class="pf-tools-catalog-head">
                <div>
                  <div class="pf-section-title">Tool Catalog</div>
                  <div class="pf-section-subtitle">Portfolio research, optimization, backtesting, and planning workflows.</div>
                </div>
                <div class="pf-tools-count">${visibleGroups.length} sections</div>
              </div>
              <div class="pf-tools-grid">${cards || '<div class="pf-empty">No tools in this category yet.</div>'}</div>
            </section>
          `}
        </section>
      </div>
    `;

    contentEl.querySelectorAll<HTMLElement>('[data-tools-category]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeToolsCategory = button.dataset.toolsCategory as ToolCategoryKey;
        const nextVisibleGroups = TOOL_GROUPS.filter(group =>
          this.activeToolsCategory === 'all' || group.categories.includes(this.activeToolsCategory)
        );
        const stillVisible = this.activeTool ? nextVisibleGroups.some(group => group.tools.some(tool => tool.key === this.activeTool)) : false;
        if (!stillVisible) {
          this.activeTool = null;
          this.activeToolGroup = null;
        }
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('[data-tool-group]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeToolGroup = (button.dataset.toolGroup as ToolGroupKey) || null;
        this.activeTool = (button.dataset.toolKey as ToolKey) || null;
        this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('[data-tool-card]').forEach(card => {
      card.addEventListener('click', () => {
        const groupKey = card.dataset.toolCard as ToolGroupKey;
        this.activeToolGroup = groupKey;
        this.renderTabContent();
      });
    });

    const backBtn = contentEl.querySelector('#pf-tools-back');
    backBtn?.addEventListener('click', () => {
      this.activeTool = null;
      this.renderTabContent();
    });
  }

  public override destroy(): void {
    this.stopAutoRefresh();
    super.destroy();
  }
}

function formatLargeNum(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return value.toFixed(0);
}
