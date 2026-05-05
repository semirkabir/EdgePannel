import { DetailPanelBase } from '../detail-panel/DetailPanelBase';
import { portfolioService } from '@/services/portfolio-service';
import type { DetailView, HoldingWithQuote, PortfolioSummary, Transaction } from '@/services/portfolio-types';
import type { ComputedMetrics } from '@/services/portfolio-types';
import { donutSvg, SECTOR_COLORS, sparklineSvg } from '@/services/market/portfolio';
import { escapeHtml } from '@/utils/sanitize';

type PortfolioDetailMode =
  | { kind: 'aggregate'; portfolioId: string; activeView?: DetailView }
  | { kind: 'position'; portfolioId: string; symbol: string };

const DETAIL_TABS: Array<{ view: DetailView; label: string; live: boolean }> = [
  { view: 'AnalyticsSectors', label: 'SECTORS', live: true },
  { view: 'PerfRisk', label: 'PERF/RISK', live: true },
  { view: 'Optimization', label: 'OPTIMIZE', live: false },
  { view: 'QuantStats', label: 'QUANTSTATS', live: false },
  { view: 'ReportsPme', label: 'REPORTS', live: true },
  { view: 'Indices', label: 'INDICES', live: false },
  { view: 'RiskMgmt', label: 'RISK', live: false },
  { view: 'Planning', label: 'PLANNING', live: false },
  { view: 'Economics', label: 'ECONOMICS', live: false },
];

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function pct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function number(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

function pnlClass(value: number): string {
  return value >= 0 ? 'pd-positive' : 'pd-negative';
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export class PortfolioDetailPanel extends DetailPanelBase {
  private current: PortfolioDetailMode | null = null;
  private activeView: DetailView = 'AnalyticsSectors';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    super({
      id: 'portfolio-detail-panel',
      ariaLabel: 'Portfolio Details',
      contentId: 'portfolio-detail-content',
      closeId: 'portfolio-detail-close',
      rootClassName: 'portfolio-detail-panel detail-panel',
      shellClassName: 'pd-shell dp-shell',
      closeClassName: 'pd-close dp-close',
      contentClassName: 'pd-panel-content dp-panel-content',
      closeText: '\u00d7',
    });
  }

  public showAggregate(portfolioId: string, activeView: DetailView = 'AnalyticsSectors', maximize = false): void {
    this.current = { kind: 'aggregate', portfolioId, activeView };
    this.activeView = activeView;
    this.openPanel();
    if (maximize) this.maximize();
    void this.render();
    this.startRefresh();
  }

  public showPosition(portfolioId: string, symbol: string): void {
    this.current = { kind: 'position', portfolioId, symbol };
    this.openPanel();
    void this.render();
    this.startRefresh();
  }

  public hide(): void {
    this.stopRefresh();
    if (this.isMaximizedState) this.minimize();
    this.closePanel();
    this.current = null;
    this.onCloseCallback?.();
  }

  private startRefresh(): void {
    this.stopRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.isVisible() && document.visibilityState === 'visible') void this.render();
    }, 60_000);
  }

  private stopRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async render(): Promise<void> {
    if (!this.current) return;
    this.content.innerHTML = '<div class="pd-loading">Loading portfolio...</div>';
    try {
      if (this.current.kind === 'position') {
        await this.renderPosition(this.current.portfolioId, this.current.symbol);
        return;
      }
      await this.renderAggregate(this.current.portfolioId);
    } catch (error) {
      this.content.innerHTML = `<div class="pd-error">Portfolio detail failed: ${escapeHtml(String(error))}</div>`;
    }
  }

  private async renderPosition(portfolioId: string, symbol: string): Promise<void> {
    const [summary, transactions] = await Promise.all([
      portfolioService.get_summary(portfolioId),
      portfolioService.get_transactions(portfolioId, symbol),
    ]);
    const holding = summary.holdings.find((item) => item.symbol === symbol);
    if (!holding) {
      this.content.innerHTML = `<div class="pd-empty">No position found for ${escapeHtml(symbol)}.</div>`;
      return;
    }

    this.content.innerHTML = `
      ${this.headerHtml(summary, `${holding.symbol} Position`, false)}
      <section class="pd-position-hero">
        <div>
          <div class="pd-kicker">${escapeHtml(holding.sector)}</div>
          <h2>${escapeHtml(holding.symbol)}</h2>
          <div class="pd-muted">${escapeHtml(holding.name || holding.symbol)}</div>
        </div>
        <div class="pd-price-block">
          <strong>${money(holding.current_price)}</strong>
          <span class="${pnlClass(holding.day_change_percent)}">${pct(holding.day_change_percent)}</span>
        </div>
      </section>
      <section class="pd-kpi-grid">
        ${this.kpi('Qty', holding.quantity.toLocaleString())}
        ${this.kpi('Cost', money(holding.cost_basis))}
        ${this.kpi('Value', money(holding.market_value))}
        ${this.kpi('P&L', `${money(holding.unrealized_pnl)} ${pct(holding.unrealized_pnl_percent)}`, pnlClass(holding.unrealized_pnl))}
        ${this.kpi('Weight', pct(holding.weight).replace('+', ''))}
        ${this.kpi('Avg Buy', money(holding.avg_buy_price))}
      </section>
      <section class="pd-card">
        <div class="pd-card-head"><h3>Price Spark</h3></div>
        <div class="pd-spark-large">${holding.sparkline.length >= 2 ? sparklineSvg(holding.sparkline, holding.day_change_percent, 340, 82) : '<span class="pd-muted">No sparkline data</span>'}</div>
      </section>
      <section class="pd-card">
        <div class="pd-card-head">
          <h3>Transactions</h3>
          <div class="pd-action-row">
            <button class="pd-mini-btn" data-pd-action="buy">BUY</button>
            <button class="pd-mini-btn" data-pd-action="sell">SELL</button>
            <button class="pd-mini-btn" data-pd-action="dividend">DIV</button>
          </div>
        </div>
        ${this.transactionsHtml(transactions)}
      </section>
    `;

    this.bindCommon(summary.portfolio.id);
    this.bindPositionActions(summary.portfolio.id, holding);
  }

  private async renderAggregate(portfolioId: string): Promise<void> {
    const [summary, metrics] = await Promise.all([
      portfolioService.get_summary(portfolioId),
      portfolioService.get_metrics(portfolioId),
    ]);

    this.content.innerHTML = `
      ${this.headerHtml(summary, summary.portfolio.name, true)}
      ${this.commandBarHtml(summary)}
      <section class="pd-kpi-grid pd-kpi-grid-wide">
        ${this.kpi('NAV', money(summary.total_market_value))}
        ${this.kpi('P&L', `${money(summary.total_unrealized_pnl)} ${pct(summary.total_unrealized_pnl_percent)}`, pnlClass(summary.total_unrealized_pnl))}
        ${this.kpi('Day', `${money(summary.total_day_change)} ${pct(summary.total_day_change_percent)}`, pnlClass(summary.total_day_change))}
        ${this.kpi('Positions', String(summary.total_positions))}
        ${this.kpi('Cost', money(summary.total_cost_basis))}
        ${this.kpi('Sharpe', number(metrics.sharpe))}
        ${this.kpi('Beta', number(metrics.beta))}
        ${this.kpi('Risk', String(metrics.risk_score))}
      </section>
      <div class="pd-workspace">
        <aside class="pd-left-rail">
          ${this.heatmapHtml(summary.holdings)}
          ${this.moversHtml(summary)}
        </aside>
        <main class="pd-center">
          ${this.performanceHtml(summary, metrics)}
          ${this.activeTabHtml(summary, metrics)}
          ${this.positionsTableHtml(summary.holdings)}
        </main>
        <aside class="pd-right-rail">
          ${this.sectorDonutHtml(summary)}
          ${this.correlationHtml(summary.holdings)}
        </aside>
      </div>
      <footer class="pd-status">EdgePannel | ${escapeHtml(summary.portfolio.name)} | LIVE | ${summary.total_positions} positions | ${escapeHtml(new Date(summary.last_updated).toLocaleTimeString())}</footer>
    `;

    this.bindCommon(summary.portfolio.id);
    this.bindAggregate(summary);
  }

  private headerHtml(summary: PortfolioSummary, title: string, aggregate: boolean): string {
    return `
      <header class="pd-header">
        <div>
          <div class="pd-kicker">${aggregate ? 'Portfolio' : escapeHtml(summary.portfolio.name)}</div>
          <h2>${escapeHtml(title)}</h2>
          <div class="pd-muted">${escapeHtml(summary.portfolio.currency)} | ${escapeHtml(summary.portfolio.owner || 'Local')}</div>
        </div>
        <div class="pd-header-actions">
          ${aggregate ? '<button class="pd-icon-btn" data-pd-export title="Export JSON">JSON</button>' : ''}
          <button class="pd-icon-btn" data-pd-refresh title="Refresh">&#8635;</button>
          <button class="pd-icon-btn" data-pd-maximize title="Maximize">${this.isMaximizedState ? '&minus;' : '&#9633;'}</button>
        </div>
      </header>
    `;
  }

  private commandBarHtml(summary: PortfolioSummary): string {
    const tabs = DETAIL_TABS.map((tab) => `
      <button class="pd-tab${tab.view === this.activeView ? ' pd-tab-active' : ''}${tab.live ? '' : ' pd-tab-muted'}" data-pd-tab="${tab.view}">
        ${tab.label}
      </button>
    `).join('');

    return `
      <section class="pd-command-bar">
        <div class="pd-command-select">${escapeHtml(summary.portfolio.name.toUpperCase())} &#9662;</div>
        <div class="pd-command-stat">NAV ${money(summary.total_market_value)}</div>
        <div class="pd-command-stat ${pnlClass(summary.total_unrealized_pnl)}">P&L ${money(summary.total_unrealized_pnl)}</div>
        <div class="pd-command-stat ${pnlClass(summary.total_day_change_percent)}">DAY ${pct(summary.total_day_change_percent)}</div>
        <div class="pd-command-stat">POS ${summary.total_positions}</div>
        <div class="pd-action-row">
          <button class="pd-mini-btn" data-pd-action="buy">BUY</button>
          <button class="pd-mini-btn" data-pd-action="sell">SELL</button>
          <button class="pd-mini-btn" data-pd-action="dividend">DIV</button>
        </div>
        <div class="pd-tabs">${tabs}</div>
      </section>
    `;
  }

  private kpi(label: string, value: string, className = ''): string {
    return `<div class="pd-kpi"><span>${escapeHtml(label)}</span><strong class="${className}">${escapeHtml(value)}</strong></div>`;
  }

  private heatmapHtml(holdings: HoldingWithQuote[]): string {
    const tiles = holdings.map((holding) => {
      const intensity = Math.min(0.34, Math.abs(holding.unrealized_pnl_percent) / 100);
      const color = holding.unrealized_pnl >= 0 ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)';
      return `
        <button class="pd-heat-tile" data-pd-symbol="${escapeHtml(holding.symbol)}" style="background: color-mix(in srgb, ${color} ${Math.round(intensity * 100)}%, var(--surface));">
          <strong>${escapeHtml(holding.symbol)}</strong>
          <span class="${pnlClass(holding.unrealized_pnl)}">${pct(holding.unrealized_pnl_percent)}</span>
        </button>
      `;
    }).join('');
    return `<section class="pd-card"><div class="pd-card-head"><h3>Holdings Heatmap</h3></div><div class="pd-heatmap">${tiles}</div></section>`;
  }

  private moversHtml(summary: PortfolioSummary): string {
    const movers = [...summary.gainers.slice(0, 3), ...summary.losers.slice(0, 3)]
      .map((holding) => `<div class="pd-mover"><span>${escapeHtml(holding.symbol)}</span><strong class="${pnlClass(holding.day_change_percent)}">${pct(holding.day_change_percent)}</strong></div>`)
      .join('');
    return `<section class="pd-card"><div class="pd-card-head"><h3>Top Movers</h3></div>${movers || '<div class="pd-muted">No movers yet</div>'}</section>`;
  }

  private performanceHtml(summary: PortfolioSummary, metrics: ComputedMetrics): string {
    const spark = summary.holdings[0]?.sparkline ?? [];
    return `
      <section class="pd-card">
        <div class="pd-card-head">
          <h3>Performance</h3>
          <span class="pd-muted">MDD ${pct(metrics.max_drawdown * 100)} | VaR 95 ${pct(metrics.var_95 * 100).replace('+', '')}</span>
        </div>
        <div class="pd-spark-large">${spark.length >= 2 ? sparklineSvg(spark, summary.total_unrealized_pnl_percent, 520, 120) : '<span class="pd-muted">Performance series pending</span>'}</div>
      </section>
    `;
  }

  private activeTabHtml(summary: PortfolioSummary, metrics: ComputedMetrics): string {
    if (this.activeView === 'AnalyticsSectors') return this.sectorsTabHtml(summary);
    if (this.activeView === 'PerfRisk') return this.perfRiskTabHtml(metrics);
    if (this.activeView === 'ReportsPme') return this.reportsTabHtml(summary, metrics);

    const tab = DETAIL_TABS.find((item) => item.view === this.activeView);
    return `
      <section class="pd-card">
        <div class="pd-card-head"><h3>${escapeHtml(tab?.label ?? 'Tool')}</h3></div>
        <div class="pd-empty">Compute backend not connected. This module is registered and will use the same portfolio contract when the analytics worker or sidecar provider is attached.</div>
      </section>
    `;
  }

  private sectorsTabHtml(summary: PortfolioSummary): string {
    const sectors = new Map<string, number>();
    for (const holding of summary.holdings) sectors.set(holding.sector, (sectors.get(holding.sector) ?? 0) + holding.market_value);
    const rows = Array.from(sectors.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sector, value]) => `<div class="pd-table-row"><span>${escapeHtml(sector)}</span><strong>${money(value)}</strong><em>${pct((value / summary.total_market_value) * 100).replace('+', '')}</em></div>`)
      .join('');
    return `<section class="pd-card"><div class="pd-card-head"><h3>Sectors</h3></div><div class="pd-table">${rows}</div></section>`;
  }

  private perfRiskTabHtml(metrics: ComputedMetrics): string {
    return `
      <section class="pd-card">
        <div class="pd-card-head"><h3>Performance / Risk</h3></div>
        <div class="pd-metric-grid">
          ${this.kpi('Sharpe', number(metrics.sharpe))}
          ${this.kpi('Beta', number(metrics.beta))}
          ${this.kpi('Volatility', pct(metrics.volatility * 100).replace('+', ''))}
          ${this.kpi('Max DD', pct(metrics.max_drawdown * 100))}
          ${this.kpi('VaR 95', pct(metrics.var_95 * 100).replace('+', ''))}
          ${this.kpi('CVaR 95', pct(metrics.cvar_95 * 100).replace('+', ''))}
          ${this.kpi('Top 3 Conc.', pct(metrics.concentration_top3).replace('+', ''))}
          ${this.kpi('Risk Score', String(metrics.risk_score))}
        </div>
      </section>
    `;
  }

  private reportsTabHtml(summary: PortfolioSummary, metrics: ComputedMetrics): string {
    return `
      <section class="pd-card">
        <div class="pd-card-head"><h3>Reports</h3></div>
        <p class="pd-report-copy">
          ${escapeHtml(summary.portfolio.name)} has ${summary.total_positions} positions, NAV ${money(summary.total_market_value)},
          unrealized P&L ${money(summary.total_unrealized_pnl)} (${pct(summary.total_unrealized_pnl_percent)}), and a risk score of ${metrics.risk_score}.
        </p>
      </section>
    `;
  }

  private positionsTableHtml(holdings: HoldingWithQuote[]): string {
    const rows = holdings.map((holding) => `
      <button class="pd-position-row" data-pd-symbol="${escapeHtml(holding.symbol)}">
        <span>${escapeHtml(holding.symbol)}</span>
        <em>${escapeHtml(holding.sector)}</em>
        <strong>${money(holding.market_value)}</strong>
        <b class="${pnlClass(holding.unrealized_pnl)}">${pct(holding.unrealized_pnl_percent)}</b>
      </button>
    `).join('');
    return `<section class="pd-card"><div class="pd-card-head"><h3>Positions</h3></div><div class="pd-position-table">${rows}</div></section>`;
  }

  private sectorDonutHtml(summary: PortfolioSummary): string {
    const sectors = new Map<string, number>();
    for (const holding of summary.holdings) sectors.set(holding.sector, (sectors.get(holding.sector) ?? 0) + holding.market_value);
    const segments = Array.from(sectors.entries()).map(([label, value]) => ({
      label,
      value,
      color: SECTOR_COLORS[label] ?? SECTOR_COLORS.Other ?? '#94a3b8',
    }));
    const legend = segments.map((segment) => `<span><i style="background:${segment.color}"></i>${escapeHtml(segment.label)}</span>`).join('');
    return `<section class="pd-card"><div class="pd-card-head"><h3>Sector Allocation</h3></div><div class="pd-donut">${donutSvg(segments, 150, 16)}<div class="pd-donut-legend">${legend}</div></div></section>`;
  }

  private correlationHtml(holdings: HoldingWithQuote[]): string {
    const top = holdings.slice(0, 5);
    const rows = top.map((a, rowIndex) => `
      <div class="pd-corr-row">
        ${top.map((b, colIndex) => {
          const value = rowIndex === colIndex ? 1 : Math.max(-0.4, Math.min(0.95, 0.25 + ((a.weight + b.weight) / 160)));
          return `<span title="${escapeHtml(a.symbol)} / ${escapeHtml(b.symbol)}" style="opacity:${0.35 + Math.abs(value) * 0.65}">${value.toFixed(2)}</span>`;
        }).join('')}
      </div>
    `).join('');
    return `<section class="pd-card"><div class="pd-card-head"><h3>Correlation</h3></div><div class="pd-corr">${rows}</div></section>`;
  }

  private transactionsHtml(transactions: Transaction[]): string {
    if (transactions.length === 0) return '<div class="pd-empty">No transactions yet.</div>';
    return `
      <div class="pd-tx-list">
        ${transactions.slice(0, 12).map((transaction) => `
          <div class="pd-tx-row">
            <span>${escapeHtml(transaction.transaction_date)}</span>
            <strong>${escapeHtml(transaction.transaction_type)}</strong>
            <em>${escapeHtml(transaction.symbol)}</em>
            <b>${transaction.quantity.toLocaleString()} @ ${money(transaction.price)}</b>
          </div>
        `).join('')}
      </div>
    `;
  }

  private bindCommon(portfolioId: string): void {
    this.content.querySelector<HTMLElement>('[data-pd-refresh]')?.addEventListener('click', () => void this.render());
    this.content.querySelector<HTMLElement>('[data-pd-maximize]')?.addEventListener('click', () => {
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
      void this.render();
    });
    this.content.querySelector<HTMLElement>('[data-pd-export]')?.addEventListener('click', async () => {
      const payload = await portfolioService.export_json(portfolioId);
      downloadJson(`${payload.portfolio_name.replace(/\s+/g, '_').toLowerCase()}_portfolio.json`, payload);
    });
  }

  private bindAggregate(summary: PortfolioSummary): void {
    const portfolioId = summary.portfolio.id;
    this.content.querySelectorAll<HTMLElement>('[data-pd-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeView = button.dataset.pdTab as DetailView;
        void this.render();
      });
    });

    this.content.querySelectorAll<HTMLElement>('[data-pd-symbol]').forEach((button) => {
      button.addEventListener('click', () => {
        const symbol = button.dataset.pdSymbol;
        if (symbol) this.showPosition(portfolioId, symbol);
      });
    });

    this.content.querySelectorAll<HTMLElement>('[data-pd-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const holding = summary.holdings[0];
        if (!holding) return;
        const action = button.dataset.pdAction;
        if (action === 'buy') await portfolioService.buy(portfolioId, holding.symbol, 1, holding.current_price, 'Quick buy from aggregate command bar');
        if (action === 'sell') await portfolioService.sell(portfolioId, holding.symbol, 1, holding.current_price, 'Quick sell from aggregate command bar');
        if (action === 'dividend') await portfolioService.dividend(portfolioId, holding.symbol, 1, 'Quick dividend from aggregate command bar');
        await this.render();
      });
    });
  }

  private bindPositionActions(portfolioId: string, holding: HoldingWithQuote): void {
    this.content.querySelectorAll<HTMLElement>('[data-pd-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.pdAction;
        if (action === 'buy') await portfolioService.buy(portfolioId, holding.symbol, 1, holding.current_price, 'Quick buy from detail panel');
        if (action === 'sell') await portfolioService.sell(portfolioId, holding.symbol, 1, holding.current_price, 'Quick sell from detail panel');
        if (action === 'dividend') await portfolioService.dividend(portfolioId, holding.symbol, 1, 'Quick dividend from detail panel');
        await this.render();
      });
    });
  }
}

let singleton: PortfolioDetailPanel | null = null;

export function getPortfolioDetailPanel(): PortfolioDetailPanel {
  singleton ??= new PortfolioDetailPanel();
  return singleton;
}
