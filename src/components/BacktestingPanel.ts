import { Panel } from './Panel';
import { backtestingService } from '@/services/backtesting-service';
import type { BacktestProviderInfo, BacktestRunRecord } from '@/services/backtesting-types';
import { getBacktestDetailPanel } from './backtest-detail/BacktestDetailPanel';
import { escapeHtml } from '@/utils/sanitize';

function pct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export class BacktestingPanel extends Panel {
  private runs: BacktestRunRecord[] = [];

  public constructor() {
    super({ id: 'backtesting', title: 'Backtesting' });
    void this.render();
  }

  public async render(): Promise<void> {
    this.runs = await backtestingService.recent_runs(6);
    const last = this.runs[0] ?? null;
    const providers = backtestingService.list_providers();
    this.setContentNow(`
      <div class="bt-panel-shell">
        <div class="bt-provider-row">
          ${providers.map((provider) => this.providerChipHtml(provider)).join('')}
        </div>
        ${last ? this.lastResultHtml(last) : '<div class="bt-empty">No backtests yet. Run the Fincept browser provider to create the first result.</div>'}
        <div class="bt-recent">
          <div class="bt-section-head">
            <span>Recent Runs</span>
            <button class="bt-open-btn" id="bt-open">Open Backtester</button>
          </div>
          ${this.runs.length === 0 ? '<div class="bt-mini-empty">No recent runs</div>' : this.runs.map((run) => `
            <button class="bt-run-row" data-run="${escapeHtml(run.id)}">
              <span>${escapeHtml(run.strategy_name)}</span>
              <em>${escapeHtml(run.symbols.join(','))}</em>
              <strong>${pct(run.metrics.total_return)}</strong>
            </button>
          `).join('')}
        </div>
      </div>
    `);
    this.bind();
  }

  private providerChipHtml(provider: BacktestProviderInfo): string {
    const classes = [
      'bt-provider-chip',
      provider.runtime === 'browser' ? 'bt-provider-live' : 'bt-provider-desktop',
    ].join(' ');
    return `
      <span class="${classes}" title="${escapeHtml(provider.description)}">
        ${escapeHtml(provider.label)}
        ${provider.runtime === 'desktop_sidecar' ? `<em>${provider.available ? 'Sidecar' : 'Desktop'}</em>` : ''}
      </span>
    `;
  }

  private lastResultHtml(run: BacktestRunRecord): string {
    return `
      <section class="bt-last-card">
        <div class="bt-last-top">
          <div>
            <span class="bt-kicker">Last Result</span>
            <strong>${escapeHtml(run.strategy_name)}</strong>
            <em>${escapeHtml(run.symbols.join(', '))}</em>
          </div>
          <span class="bt-status">${escapeHtml(run.status.toUpperCase())}</span>
        </div>
        <div class="bt-stat-grid">
          <div><span>Return</span><strong>${pct(run.metrics.total_return)}</strong></div>
          <div><span>Sharpe</span><strong>${run.metrics.sharpe_ratio.toFixed(2)}</strong></div>
          <div><span>MDD</span><strong>${pct(run.metrics.max_drawdown)}</strong></div>
          <div><span>Trades</span><strong>${run.metrics.total_trades}</strong></div>
        </div>
      </section>
    `;
  }

  private bind(): void {
    this.content.querySelector('#bt-open')?.addEventListener('click', () => {
      getBacktestDetailPanel().show(true);
    });

    this.content.querySelectorAll<HTMLElement>('[data-run]').forEach((button) => {
      button.addEventListener('click', () => {
        const run = this.runs.find((item) => item.id === button.dataset.run);
        if (run) getBacktestDetailPanel().showResult(run);
      });
    });
  }
}
