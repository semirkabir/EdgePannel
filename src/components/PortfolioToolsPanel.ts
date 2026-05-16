import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { portfolioService } from '@/services/portfolio-service';
import type { DetailView } from '@/services/portfolio-types';
import { getPortfolioDetailPanel } from './portfolio-detail/PortfolioDetailPanel';

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

export class PortfolioToolsPanel extends Panel {
  private activeToolsCategory: ToolCategoryKey = 'all';
  private activeToolGroup: ToolGroupKey | null = null;
  private activeTool: ToolKey | null = null;

  constructor() {
    super({
      id: 'portfolio-tools',
      title: t('panels.portfolioTools'),
    });
    void this.render();
  }

  public async render(): Promise<void> {
    this.showLoading();
    this.renderToolsTab(this.content);
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
        this.renderToolsTab(contentEl);
      });
    });

    contentEl.querySelectorAll<HTMLElement>('[data-tool-group]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeToolGroup = (button.dataset.toolGroup as ToolGroupKey) || null;
        this.activeTool = (button.dataset.toolKey as ToolKey) || null;
        this.renderToolsTab(contentEl);
        void this.openPortfolioToolDetail(this.activeTool);
      });
    });

    contentEl.querySelectorAll<HTMLElement>('[data-tool-card]').forEach(card => {
      card.addEventListener('click', () => {
        const groupKey = card.dataset.toolCard as ToolGroupKey;
        this.activeToolGroup = groupKey;
        this.renderToolsTab(contentEl);
      });
    });

    const backBtn = contentEl.querySelector('#pf-tools-back');
    backBtn?.addEventListener('click', () => {
      this.activeTool = null;
      this.renderToolsTab(contentEl);
    });
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

  private async resolveActiveRepositoryPortfolioId(): Promise<string> {
    const portfolios = await portfolioService.list_portfolios();
    return portfolios.find((portfolio) => portfolio.name === 'Demo Portfolio')?.id
      ?? portfolios[0]?.id
      ?? (await portfolioService.ensure_demo_portfolio()).id;
  }

}
