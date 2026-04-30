import { Panel } from './Panel';
import type { PopupType } from './MapPopup';
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
  getTickerSector,
  SECTOR_COLORS,
  sparklineSvg,
  donutSvg,
} from '@/services/market/portfolio';
import { fetchSec13FFeed, type SecFilingEntry } from '@/services/market/sec-filings';
import {
  getFeaturedInstitutionResults,
  normalizeInstitutionName,
  searchInstitutions13F,
  type InstitutionSearchResult,
} from '@/services/market/normalized-13f';
import { setMarketWatchlistEntries, getMarketWatchlistEntries } from '@/services/market-watchlist';
import { portfolioService } from '@/services/portfolio-service';
import type { DetailView, HoldingWithQuote, Portfolio, PortfolioSummary } from '@/services/portfolio-types';
import { getPortfolioDetailPanel } from './portfolio-detail/PortfolioDetailPanel';

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

type FirmFilter = 'all' | 'thirteen_filers';
type PeopleFilter = 'all' | 'public_figures' | 'politicians';
type FeaturedPerson = {
  name: string;
  party: string;
  chamber: 'House' | 'Senate';
  state: string;
  tradeCount: number;
  latestDisclosure: string;
  category: 'politician' | 'public_figure';
};

export class PortfolioPanel extends Panel {
  private activeTab: Tab = 'portfolio';
  private congressCache: CongressTrade[] | null = null;
  private filingsFilter = '';
  private featuredFilters: { firms: FirmFilter; people: PeopleFilter } = { firms: 'all', people: 'all' };
  private institutionCik: string | null = null;
  private activeToolsCategory: ToolCategoryKey = 'all';
  private activeToolGroup: ToolGroupKey | null = null;
  private activeTool: ToolKey | null = null;
  private activePortfolioId: string | 'legacy-watchlist' | null = null;
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
      if ((this.activeTab === 'portfolio' || this.activeTab === 'filings') && document.visibilityState === 'visible') {
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
    const portfolios = await portfolioService.list_portfolios();
    if (!this.activePortfolioId) {
      this.activePortfolioId = portfolios.find((portfolio) => portfolio.name === 'Demo Portfolio')?.id
        ?? portfolios[0]?.id
        ?? 'legacy-watchlist';
    }

    if (this.activePortfolioId !== 'legacy-watchlist') {
      const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === this.activePortfolioId);
      if (selectedPortfolio) {
        await this.renderRepositoryPortfolioTab(contentEl, portfolios, selectedPortfolio);
        return;
      }
      this.activePortfolioId = 'legacy-watchlist';
    }

    const positions = getUserPositions();
    const quotes = new Map<string, { price: number; change: number; sparkline: number[]; name: string }>();
    let lastUpdated = '';
    const selectorHtml = this.renderPortfolioSelector(portfolios);

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
        ${selectorHtml}
        <div class="pf-add-form">
          <input type="text" class="pf-input" id="pf-add-symbol" placeholder="Symbol (e.g. AAPL)" />
          <input type="number" class="pf-input pf-input-sm" id="pf-add-shares" placeholder="Shares" min="0" step="1" />
          <input type="number" class="pf-input pf-input-sm" id="pf-add-cost" placeholder="Avg Cost" min="0" step="0.01" />
          <button class="pf-add-btn" id="pf-add-btn">Add</button>
        </div>
        <div class="pf-empty">No positions yet. Add a stock above to start tracking your portfolio.</div>
      `;
      this.bindPortfolioSelector(contentEl);
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
      ${selectorHtml}
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

    this.bindPortfolioSelector(contentEl);
    this.bindAddForm(contentEl);
    this.bindPositionActions(contentEl);
  }

  private async renderRepositoryPortfolioTab(contentEl: HTMLElement, portfolios: Portfolio[], portfolio: Portfolio): Promise<void> {
    const summary = await portfolioService.get_summary(portfolio.id);
    const sectorMap = new Map<string, number>();
    for (const holding of summary.holdings) {
      sectorMap.set(holding.sector, (sectorMap.get(holding.sector) || 0) + holding.market_value);
    }

    const donutSegments = Array.from(sectorMap.entries())
      .map(([label, value]) => ({ label, value, color: (SECTOR_COLORS as Record<string, string>)[label] ?? SECTOR_COLORS.Other! }))
      .sort((a, b) => b.value - a.value);

    const donutHtml = donutSegments.length > 1
      ? `<div class="pf-donut-wrap">${donutSvg(donutSegments, 120, 14)}<div class="pf-donut-legend">${donutSegments.map(s => `<span class="pf-donut-legend-item"><span class="pf-donut-dot" style="background:${s.color}"></span>${escapeHtml(s.label)}</span>`).join('')}</div></div>`
      : '';

    const rows = summary.holdings.map((holding) => this.renderRepositoryHoldingRow(holding)).join('');

    contentEl.innerHTML = `
      ${this.renderPortfolioSelector(portfolios)}
      <div class="pf-section-head">
        <div>
          <div class="pf-section-title">${escapeHtml(summary.portfolio.name)}</div>
          <div class="pf-section-subtitle">${escapeHtml(summary.portfolio.currency)} transaction-replay portfolio</div>
        </div>
        <button class="pf-inline-btn" id="pf-open-full-portfolio" type="button">Open full</button>
      </div>
      <div class="pf-summary">
        <div class="pf-summary-item">
          <span class="pf-summary-label">NAV</span>
          <span class="pf-summary-val">$${summary.total_market_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">P&amp;L</span>
          <span class="pf-summary-val ${summary.total_unrealized_pnl >= 0 ? 'pf-positive' : 'pf-negative'}">${summary.total_unrealized_pnl >= 0 ? '+' : ''}$${Math.abs(summary.total_unrealized_pnl).toFixed(2)} (${summary.total_unrealized_pnl >= 0 ? '+' : ''}${summary.total_unrealized_pnl_percent.toFixed(1)}%)</span>
        </div>
        <div class="pf-summary-item">
          <span class="pf-summary-label">Positions</span>
          <span class="pf-summary-val">${summary.total_positions}</span>
        </div>
      </div>
      ${donutHtml}
      <div class="pf-positions">${rows || '<div class="pf-empty">No holdings in this portfolio.</div>'}</div>
    `;

    this.bindPortfolioSelector(contentEl);
    this.bindRepositoryPortfolioActions(contentEl, summary);
  }

  private renderRepositoryHoldingRow(holding: HoldingWithQuote): string {
    const pnlClass = holding.unrealized_pnl >= 0 ? 'pf-positive' : 'pf-negative';
    const pnlSign = holding.unrealized_pnl >= 0 ? '+' : '';
    const dayClass = holding.day_change_percent >= 0 ? 'pf-positive' : 'pf-negative';
    const daySign = holding.day_change_percent >= 0 ? '+' : '';
    const sectorColor = SECTOR_COLORS[holding.sector] || SECTOR_COLORS.Other;

    return `
      <div class="pf-position-row" data-symbol="${escapeHtml(holding.symbol)}">
        <div class="pf-pos-info">
          <span class="pf-pos-symbol ticker-link" data-ticker="${escapeHtml(holding.symbol)}" data-name="${escapeHtml(holding.name || holding.symbol)}">${escapeHtml(holding.symbol)}</span>
          <span class="pf-pos-name">${escapeHtml(holding.name || holding.symbol)}</span>
          <span class="pf-pos-sector" style="background:${sectorColor}30;color:${sectorColor}">${escapeHtml(holding.sector)}</span>
        </div>
        <div class="pf-pos-data">
          <div class="pf-pos-col">
            <span class="pf-pos-label">Qty</span>
            <span class="pf-pos-val">${holding.quantity.toLocaleString()}</span>
          </div>
          <div class="pf-pos-col">
            <span class="pf-pos-label">Price</span>
            <span class="pf-pos-val">${holding.current_price ? '$' + holding.current_price.toFixed(2) : '-'}</span>
          </div>
          <div class="pf-pos-col">
            <span class="pf-pos-label">Day</span>
            <span class="pf-pos-val ${dayClass}">${daySign}${holding.day_change_percent.toFixed(2)}%</span>
          </div>
          <div class="pf-pos-col">
            <span class="pf-pos-label">P&amp;L</span>
            <span class="pf-pos-val ${pnlClass}">${pnlSign}$${Math.abs(holding.unrealized_pnl).toFixed(2)} (${pnlSign}${holding.unrealized_pnl_percent.toFixed(1)}%)</span>
          </div>
          ${holding.sparkline.length >= 2 ? `<div class="pf-pos-spark">${sparklineSvg(holding.sparkline, holding.day_change_percent, 56, 20)}</div>` : ''}
          <div class="pf-pos-actions">
            <button class="pf-row-open-btn pf-position-expand" data-symbol="${escapeHtml(holding.symbol)}" title="Expand position" type="button">&rsaquo;</button>
          </div>
        </div>
      </div>`;
  }

  private renderPortfolioSelector(portfolios: Portfolio[]): string {
    const portfolioOptions = portfolios.map((portfolio) => `
      <option value="${escapeHtml(portfolio.id)}"${portfolio.id === this.activePortfolioId ? ' selected' : ''}>
        ${escapeHtml(portfolio.name)}
      </option>
    `).join('');
    const legacySelected = this.activePortfolioId === 'legacy-watchlist' ? ' selected' : '';

    return `
      <div class="pf-portfolio-switcher">
        <label class="pf-switch-label" for="pf-portfolio-select">Portfolios</label>
        <select class="pf-select pf-portfolio-select" id="pf-portfolio-select">
          ${portfolioOptions}
          <option value="legacy-watchlist"${legacySelected}>My Watchlist</option>
        </select>
      </div>
    `;
  }

  private bindPortfolioSelector(contentEl: HTMLElement): void {
    const select = contentEl.querySelector<HTMLSelectElement>('#pf-portfolio-select');
    select?.addEventListener('change', () => {
      this.activePortfolioId = select.value === 'legacy-watchlist' ? 'legacy-watchlist' : select.value;
      this.editingSymbol = null;
      this.renderTabContent();
    });
  }

  private bindRepositoryPortfolioActions(contentEl: HTMLElement, summary: PortfolioSummary): void {
    contentEl.querySelector('#pf-open-full-portfolio')?.addEventListener('click', () => {
      this.openPortfolioDetail(summary.portfolio.id);
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-position-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = btn.dataset.symbol;
        if (symbol) this.openPortfolioPosition(summary.portfolio.id, symbol);
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.ticker-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = el.dataset.ticker;
        const name = el.dataset.name;
        if (ticker) {
          this.openEntityDetail('company', { ticker, name: name || ticker });
        }
      });
    });
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
          this.openEntityDetail('company', { ticker, name: name || ticker });
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

    this.startAutoRefresh();

    const getFeaturedInitials = (name: string): string => {
      const parts = name.split(/[\s.&'-]+/).filter(Boolean);
      const initials = parts.slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');
      return initials || name.slice(0, 2).toUpperCase();
    };

    const formatRelativeTime = (value: string | Date): string => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return 'Just now';
      const diff = Math.max(0, Date.now() - date.getTime());
      const minutes = Math.floor(diff / 60_000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    const formatFiledDate = (value: string | Date): string => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const secFeed = await fetchSec13FFeed();
    const query = this.filingsFilter.trim().toLowerCase();

    const featuredInstitutions = (query
      ? await searchInstitutions13F(this.filingsFilter, { recentFilings: secFeed, limit: 16 })
      : getFeaturedInstitutionResults(secFeed).slice(0, 8))
      .filter(inv => this.matchesFirmFilter(inv));
    const featuredPeople = this.getFeaturedPeople(this.congressCache)
      .filter(person => this.matchesPerson(person, query))
      .filter(person => this.matchesPeopleFilter(person))
      .slice(0, query ? 16 : 8);

    let trades = [...this.congressCache];
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
    if (this.featuredFilters.people === 'public_figures') {
      trades = [];
    }

    const institutionMatchSet = new Set(
      featuredInstitutions.map(inv => inv.cik || normalizeInstitutionName(inv.name)).filter(Boolean)
    );
    const tickerQueryMatches = featuredInstitutions.filter(inv => inv.matchReason === 'ticker');
    const selected13FFeedSource = tickerQueryMatches.length > 0
      ? secFeed.filter(entry =>
        institutionMatchSet.has(entry.cik) ||
        institutionMatchSet.has(normalizeInstitutionName(entry.filerName))
      )
      : secFeed;
    const skipTextFilter = tickerQueryMatches.length > 0;
    let top13FFeed = (selected13FFeedSource.length > 0 ? selected13FFeedSource : secFeed)
      .filter(entry =>
        skipTextFilter ||
        !query ||
        entry.filerName.toLowerCase().includes(query) ||
        entry.cik.includes(query) ||
        entry.filingType.toLowerCase().includes(query)
      )
      .sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime())
      .slice(0, 6);

    if (top13FFeed.length === 0) {
      const fallbackTargets = featuredInstitutions
        .slice(0, 6)
        .filter(inv => inv.cik)
        .map(inv => ({ cik: inv.cik, name: inv.name }));

      if (fallbackTargets.length > 0) {
        const fallbackHistory = await Promise.all(
          fallbackTargets.map(async (target) => {
            try {
              const historyResp = await fetchInstitutionalHoldings(target.cik);
              return (historyResp.filingHistory || []).map((entry): SecFilingEntry => ({
                id: entry.id,
                title: `${entry.filingType} - ${historyResp.name || target.name}`,
                filerName: historyResp.name || target.name,
                cik: target.cik,
                filingType: entry.filingType,
                filedAt: new Date(entry.acceptedAt || entry.filingDate || Date.now()),
                url: entry.url,
                description: '',
              }));
            } catch {
              return [];
            }
          }),
        );

        top13FFeed = fallbackHistory
          .flat()
          .filter(entry => !Number.isNaN(entry.filedAt.getTime()))
          .sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime())
          .slice(0, 6);
      }
    }

    const liveCongressTrades = [...trades]
      .sort((a, b) =>
        `${b.disclosureDate}T23:59:59Z`.localeCompare(`${a.disclosureDate}T23:59:59Z`) ||
        b.transactionDate.localeCompare(a.transactionDate)
      )
      .slice(0, 6);

    const featuredInstitutionCards = featuredInstitutions.map(inv => `
      <button class="pf-featured-card pf-featured-card-firm${this.institutionCik === inv.cik ? ' pf-featured-card-active' : ''}" data-featured-kind="institution" data-cik="${escapeHtml(inv.cik)}" data-name="${escapeHtml(inv.name)}">
        <span class="pf-featured-avatar" aria-hidden="true">${escapeHtml(getFeaturedInitials(inv.name))}</span>
        <span class="pf-featured-name">${escapeHtml(inv.name)}</span>
        <span class="pf-featured-meta">${escapeHtml(this.getInstitutionSubtitle(inv))}</span>
      </button>
    `).join('');

    const featuredPeopleCards = featuredPeople.map(person => `
      <button class="pf-featured-card pf-featured-card-person" data-featured-kind="person" data-name="${escapeHtml(person.name)}" data-party="${escapeHtml(person.party)}" data-chamber="${escapeHtml(person.chamber)}" data-state="${escapeHtml(person.state)}">
        <span class="pf-featured-avatar" aria-hidden="true">${escapeHtml(getFeaturedInitials(person.name))}</span>
        <span class="pf-featured-name">${escapeHtml(person.name)}</span>
        <span class="pf-featured-meta">${escapeHtml(person.party)} \u00b7 ${escapeHtml(person.chamber)}${person.state ? ` \u00b7 ${escapeHtml(person.state)}` : ''}</span>
      </button>
    `).join('');

    const secFeedRows = top13FFeed.map((entry: SecFilingEntry) => `
      <div class="pf-filing-row">
        <span class="pf-filing-info">
          <span class="pf-filing-name">${escapeHtml(entry.filerName)}</span>
          <span class="pf-filing-cik">CIK ${escapeHtml(entry.cik || 'N/A')} \u00b7 ${escapeHtml(formatRelativeTime(entry.filedAt))}</span>
        </span>
        <span class="pf-filing-type-badge ${entry.filingType.includes('/A') ? 'pf-filing-type-amend' : entry.filingType.includes('NT') ? 'pf-filing-type-nt' : 'pf-filing-type-hr'}">${escapeHtml(entry.filingType)}</span>
        <span class="pf-filing-date">${escapeHtml(formatFiledDate(entry.filedAt))}</span>
        <button class="pf-row-open-btn" type="button" title="Open in right panel" aria-label="Open in right panel" data-open-kind="institution" data-cik="${escapeHtml(entry.cik)}" data-name="${escapeHtml(entry.filerName)}">\u2197</button>
      </div>
    `).join('');

    const congressFeedRows = liveCongressTrades.map(trade => {
      const isPurchase = trade.transactionType.toLowerCase().includes('purchase');
      const isSale = trade.transactionType.toLowerCase().includes('sale');
      const typeBadgeClass = isPurchase ? 'pf-filing-type-hr' : isSale ? 'pf-filing-type-amend' : 'pf-filing-type-other';
      const typeLabel = isPurchase ? 'BUY' : isSale ? 'SELL' : trade.transactionType.toUpperCase();
      const companyLabel = trade.ticker || trade.assetDescription || trade.politician;
      const companyMeta = [trade.politician, trade.party, trade.chamber].filter(Boolean).join(' \u00b7 ');

      return `
        <div class="pf-filing-row pf-congress-filing-row">
          <span class="pf-filing-info">
            <span class="pf-filing-name">${escapeHtml(companyLabel)}</span>
            <span class="pf-filing-cik">${escapeHtml(companyMeta)}</span>
          </span>
          <span class="pf-filing-type-badge ${typeBadgeClass}">${escapeHtml(typeLabel)}</span>
          <span class="pf-filing-date">${escapeHtml(formatFiledDate(`${trade.disclosureDate}T23:59:59Z`))}</span>
          <button class="pf-row-open-btn" type="button" title="Open in right panel" aria-label="Open in right panel" data-open-kind="${trade.ticker ? 'company' : 'congressTrade'}" data-trade-idx="${escapeHtml(String(this.congressCache!.indexOf(trade)))}" data-ticker="${escapeHtml(trade.ticker)}" data-name="${escapeHtml(trade.assetDescription || trade.ticker || trade.politician)}">\u2197</button>
        </div>`;
    }).join('');

    contentEl.innerHTML = `
      <div class="pf-filter-bar">
        <input type="text" class="pf-input" id="pf-filings-filter" placeholder="Search people, firms, tickers, or parties..." value="${escapeHtml(this.filingsFilter)}" />
        <div class="pf-filter-groups">
          <div class="pf-filter-group">
            <span class="pf-filter-group-label">Firms</span>
            <div class="pf-filter-chips">
              <button class="pf-chip${this.featuredFilters.firms === 'all' ? ' pf-chip-active' : ''}" data-filter-group="firms" data-value="all">All</button>
              <button class="pf-chip${this.featuredFilters.firms === 'thirteen_filers' ? ' pf-chip-active' : ''}" data-filter-group="firms" data-value="thirteen_filers">13F Filers</button>
            </div>
          </div>
          <div class="pf-filter-group">
            <span class="pf-filter-group-label">People</span>
            <div class="pf-filter-chips">
              <button class="pf-chip${this.featuredFilters.people === 'all' ? ' pf-chip-active' : ''}" data-filter-group="people" data-value="all">All</button>
              <button class="pf-chip${this.featuredFilters.people === 'public_figures' ? ' pf-chip-active' : ''}" data-filter-group="people" data-value="public_figures">Public Figures</button>
              <button class="pf-chip${this.featuredFilters.people === 'politicians' ? ' pf-chip-active' : ''}" data-filter-group="people" data-value="politicians">Politicians</button>
            </div>
          </div>
        </div>
      </div>
      <div class="pf-section">
        <div class="pf-section-head">
          <div>
            <div class="pf-section-title">Featured Filers</div>
            <div class="pf-section-subtitle">Notable firms and people in one view.</div>
          </div>
        </div>
        <div class="pf-featured-stack">
          <div class="pf-featured-group">
            <div class="pf-featured-group-head">
              <div class="pf-featured-group-title">Firms</div>
              <div class="pf-featured-group-meta">${featuredInstitutions.length} shown</div>
            </div>
            <div class="pf-featured-row">${featuredInstitutionCards || '<div class="pf-empty">No firm matches.</div>'}</div>
          </div>
          <div class="pf-featured-group">
            <div class="pf-featured-group-head">
              <div class="pf-featured-group-title">People</div>
              <div class="pf-featured-group-meta">${featuredPeople.length} shown</div>
            </div>
            <div class="pf-featured-row">${featuredPeopleCards || '<div class="pf-empty">No people matches.</div>'}</div>
          </div>
        </div>
      </div>
      <div class="pf-filings-grid">
        <div class="pf-section pf-inst-shell pf-live-card">
          <div class="pf-section-head">
            <div>
              <div class="pf-section-title">Latest 13F Filings</div>
              <div class="pf-section-subtitle">${tickerQueryMatches.length > 0 ? `Recent 13F filers tied to ${escapeHtml(this.filingsFilter.trim().toUpperCase())}.` : 'Live SEC 13F filings, listed as they post.'}</div>
            </div>
            <div class="pf-count">${top13FFeed.length} shown</div>
          </div>
          <div class="pf-filings-list">${secFeedRows || '<div class="pf-mini-empty">No recent 13F filings match the current filters.</div>'}</div>
        </div>
        <div class="pf-section pf-inst-shell pf-live-card pf-congress-shell">
          <div class="pf-section-head">
            <div>
              <div class="pf-section-title">Congress Filings</div>
              <div class="pf-section-subtitle">Live congressional trade disclosures, with direct jumps into the right panel.</div>
            </div>
            <div class="pf-count">${liveCongressTrades.length} live</div>
          </div>
          <div class="pf-congress-list pf-congress-feed">${congressFeedRows || '<div class="pf-mini-empty">No congressional filings match the current filters.</div>'}</div>
        </div>
      </div>
    `;

    const filterInput = contentEl.querySelector('#pf-filings-filter') as HTMLInputElement;
    let debounce: number | undefined;
    filterInput?.addEventListener('input', () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        this.filingsFilter = filterInput.value.trim();
        this.renderTabContent();
      }, 300);
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filterGroup = chip.dataset.filterGroup;
        const value = chip.dataset.value;
        if (!filterGroup || !value) return;

        if (filterGroup === 'firms') {
          this.featuredFilters.firms = value as FirmFilter;
        } else if (filterGroup === 'people') {
          this.featuredFilters.people = value as PeopleFilter;
        }

        void this.renderTabContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-featured-card').forEach(card => {
      card.addEventListener('click', () => {
        const kind = card.dataset.featuredKind;
        if (kind === 'institution') {
          this.institutionCik = card.dataset.cik || null;
          this.openInstitutionDetail(this.institutionCik, card.dataset.name || 'Institution');
          void this.renderTabContent();
          return;
        }

        const name = card.dataset.name;
        if (name) {
          this.openEntityDetail('congressPolitician', {
            name,
            party: card.dataset.party || '',
            chamber: (card.dataset.chamber as 'House' | 'Senate') || 'House',
            state: card.dataset.state || '',
          });
        }
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-row-open-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const openKind = button.dataset.openKind;

        if (openKind === 'institution') {
          this.openEntityDetail('institution', {
            name: button.dataset.name || 'Institution',
            cik: button.dataset.cik || '',
          });
          return;
        }

        if (openKind === 'company') {
          const ticker = button.dataset.ticker;
          if (ticker) {
            this.openEntityDetail('company', {
              ticker,
              name: button.dataset.name || ticker,
            });
          }
          return;
        }

        const idx = parseInt(button.dataset.tradeIdx || '-1', 10);
        const trade = idx >= 0 ? this.congressCache?.[idx] : null;
        if (trade) {
          this.openEntityDetail('congressTrade', trade);
        }
      });
    });
  }

  private getFeaturedPeople(trades: CongressTrade[]): FeaturedPerson[] {
    const people = new Map<string, FeaturedPerson>();

    for (const trade of trades) {
      const existing = people.get(trade.politician);
      if (existing) {
        existing.tradeCount += 1;
        if (trade.disclosureDate > existing.latestDisclosure) {
          existing.latestDisclosure = trade.disclosureDate;
        }
        continue;
      }

      people.set(trade.politician, {
        name: trade.politician,
        party: trade.party,
        chamber: trade.chamber,
        state: trade.state,
        tradeCount: 1,
        latestDisclosure: trade.disclosureDate,
        category: 'politician',
      });
    }

    return Array.from(people.values()).sort((a, b) =>
      b.tradeCount - a.tradeCount || b.latestDisclosure.localeCompare(a.latestDisclosure)
    );
  }

  private matchesFirmFilter(_investor: InstitutionSearchResult): boolean {
    switch (this.featuredFilters.firms) {
      case 'all':
      case 'thirteen_filers':
      default:
        return true;
    }
  }

  private matchesPerson(person: FeaturedPerson, query: string): boolean {
    if (!query) return true;
    return (
      person.name.toLowerCase().includes(query) ||
      person.party.toLowerCase().includes(query) ||
      person.chamber.toLowerCase().includes(query) ||
      person.state.toLowerCase().includes(query)
    );
  }

  private matchesPeopleFilter(person: FeaturedPerson): boolean {
    switch (this.featuredFilters.people) {
      case 'public_figures':
        return person.category === 'public_figure';
      case 'politicians':
        return person.category === 'politician';
      case 'all':
      default:
        return true;
    }
  }

  private getInstitutionSubtitle(institution: InstitutionSearchResult): string {
    if (institution.relatedTicker) {
      return institution.subtitle;
    }
    if (institution.subtitle) {
      return institution.subtitle;
    }
    if (institution.latestFilingDate) {
      return `Latest filed ${new Date(institution.latestFilingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return 'Known 13F filer';
  }

  private openInstitutionDetail(cik: string | null, name = 'Institution'): void {
    if (!cik) {
      this.openEntityDetail('institution', { name, cik: '' });
      return;
    }
    const institution = NOTABLE_INVESTORS.find(inv => inv.cik === cik);
    this.openEntityDetail('institution', {
      name: institution?.name || name,
      cik,
    });
  }

  private openPortfolioDetail(portfolioId: string, view: DetailView = 'AnalyticsSectors'): void {
    getPortfolioDetailPanel().showAggregate(portfolioId, view);
  }

  private openPortfolioPosition(portfolioId: string, symbol: string): void {
    getPortfolioDetailPanel().showPosition(portfolioId, symbol);
  }

  private async resolveActiveRepositoryPortfolioId(): Promise<string> {
    if (this.activePortfolioId && this.activePortfolioId !== 'legacy-watchlist') return this.activePortfolioId;
    const portfolios = await portfolioService.list_portfolios();
    return portfolios.find((portfolio) => portfolio.name === 'Demo Portfolio')?.id
      ?? portfolios[0]?.id
      ?? (await portfolioService.ensure_demo_portfolio()).id;
  }

  private mapToolToDetailView(tool: ToolKey | null): DetailView {
    if (!tool) return 'AnalyticsSectors';
    if (tool.includes('optimization') || tool.includes('black-litterman') || tool.includes('efficient-frontier')) return 'Optimization';
    if (tool.includes('factor') || tool.includes('risk') || tool.includes('correlation')) return 'RiskMgmt';
    if (tool.includes('statistics') || tool.includes('cointegration') || tool.includes('autocorrelation')) return 'QuantStats';
    if (tool.includes('financial') || tool.includes('liability')) return 'Planning';
    if (tool.includes('valuation')) return 'Economics';
    if (tool.includes('backtest') || tool.includes('walk-forward') || tool.includes('out-of-sample')) return 'PerfRisk';
    return 'ReportsPme';
  }

  private async openPortfolioToolDetail(tool: ToolKey | null): Promise<void> {
    const portfolioId = await this.resolveActiveRepositoryPortfolioId();
    getPortfolioDetailPanel().showAggregate(portfolioId, this.mapToolToDetailView(tool));
  }

  private openEntityDetail(type: PopupType, data: unknown): void {
    document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
      detail: { type, data },
    }));

    const fallback = (window as any).__entityDetailPanel;
    fallback?.show?.(type, data);
  }
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
        void this.openPortfolioToolDetail(this.activeTool);
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
