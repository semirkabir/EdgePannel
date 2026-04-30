import { DetailPanelBase } from '../detail-panel/DetailPanelBase';
import { backtestingService } from '@/services/backtesting-service';
import { FINCEPT_STRATEGIES, normalizeStrategyParams } from '@/services/backtest-providers/fincept-provider';
import type {
  BacktestCommand,
  BacktestProviderId,
  BacktestResultEnvelope,
  BacktestRunRequest,
  BacktestRunRecord,
  BacktestStrategy,
} from '@/services/backtesting-types';
import { escapeHtml } from '@/utils/sanitize';

const PROVIDERS: BacktestProviderId[] = ['vectorbt', 'backtesting.py', 'fasttrade', 'zipline', 'bt', 'fincept'];
const COMMANDS: Array<{ id: BacktestCommand; label: string }> = [
  { id: 'run', label: 'Run' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'walk_forward', label: 'Walk-Forward' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'indicator_signals', label: 'Indicator Signals' },
  { id: 'ml_labels', label: 'ML Labels' },
  { id: 'cv_splits', label: 'CV Splits' },
  { id: 'returns_analysis', label: 'Returns Analysis' },
  { id: 'signal_generators', label: 'Signal Generators' },
];

type ResultTab = 'summary' | 'metrics' | 'trades' | 'raw';

function pct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function downloadJson(filename: string, payload: BacktestResultEnvelope): void {
  const blob = new Blob([backtestingService.export_result_json(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export class BacktestDetailPanel extends DetailPanelBase {
  private provider: BacktestProviderId = 'fincept';
  private command: BacktestCommand = 'run';
  private strategyId = FINCEPT_STRATEGIES[0]?.id ?? 'sma_crossover';
  private result: BacktestRunRecord | null = null;
  private resultTab: ResultTab = 'summary';

  public constructor() {
    super({
      id: 'backtest-detail-panel',
      ariaLabel: 'Backtesting Console',
      contentId: 'backtest-detail-content',
      closeId: 'backtest-detail-close',
      rootClassName: 'backtest-detail-panel detail-panel',
      shellClassName: 'bd-shell dp-shell',
      closeClassName: 'bd-close dp-close',
      contentClassName: 'bd-panel-content dp-panel-content',
      closeText: '\u00d7',
    });
  }

  public show(maximize = true): void {
    this.openPanel();
    if (maximize) this.maximize();
    void this.render();
  }

  public showResult(result: BacktestRunRecord): void {
    this.result = result;
    this.provider = result.provider;
    this.strategyId = result.request.strategy_id;
    this.openPanel();
    this.maximize();
    void this.render();
  }

  public hide(): void {
    if (this.isMaximizedState) this.minimize();
    this.closePanel();
    this.onCloseCallback?.();
  }

  private get selectedStrategy(): BacktestStrategy {
    if (this.provider !== 'fincept') {
      return {
        id: `${this.provider}_sidecar_placeholder`,
        name: `${this.provider} Sidecar Strategy`,
        category: 'Sidecar Required',
        description: `${this.provider} strategies load when the Tauri sidecar provider is connected.`,
        params: [],
      };
    }
    return FINCEPT_STRATEGIES.find((strategy) => strategy.id === this.strategyId) ?? FINCEPT_STRATEGIES[0]!;
  }

  private async render(): Promise<void> {
    const strategies = await backtestingService.load_strategies(this.provider);
    const strategy = strategies.find((item) => item.id === this.strategyId) ?? strategies[0] ?? this.selectedStrategy;

    this.content.innerHTML = `
      <header class="bd-header">
        <div>
          <div class="bd-kicker">Backtesting</div>
          <h2>Strategy Console</h2>
          <span>${this.provider === 'fincept' ? 'READY' : 'SIDECAR REQUIRED'}</span>
        </div>
        <div class="bd-header-actions">
          <button class="bd-icon-btn" data-bd-refresh title="Refresh">&#8635;</button>
          <button class="bd-icon-btn" data-bd-max title="Maximize">${this.isMaximizedState ? '&minus;' : '&#9633;'}</button>
        </div>
      </header>
      ${this.providerStripHtml()}
      <div class="bd-console">
        <aside class="bd-left">
          ${this.commandListHtml()}
          ${this.strategyFormHtml(strategies, strategy)}
        </aside>
        <main class="bd-main">
          ${this.resultTabsHtml()}
        </main>
        <aside class="bd-right">
          ${this.settingsHtml()}
        </aside>
      </div>
      <footer class="bd-status">Providers ${PROVIDERS.length} | Strategies ${strategies.length} | v1 browser engine | ${this.provider === 'fincept' ? 'READY' : 'WAITING FOR SIDECAR'}</footer>
    `;

    this.bind();
  }

  private providerStripHtml(): string {
    return `
      <section class="bd-provider-strip">
        ${PROVIDERS.map((provider) => `
          <button class="bd-provider${provider === this.provider ? ' bd-provider-active' : ''}${provider === 'fincept' ? '' : ' bd-provider-muted'}" data-provider="${provider}">
            ${escapeHtml(provider)}
          </button>
        `).join('')}
        <span class="bd-ready-dot">${this.provider === 'fincept' ? 'READY' : 'SIDECAR'}</span>
        <button class="bd-run-btn" data-run>RUN</button>
      </section>
    `;
  }

  private commandListHtml(): string {
    return `
      <section class="bd-card">
        <h3>Commands</h3>
        <div class="bd-command-list">
          ${COMMANDS.map((command) => `
            <button class="${command.id === this.command ? 'bd-command-active' : ''}" data-command="${command.id}">${escapeHtml(command.label)}</button>
          `).join('')}
        </div>
      </section>
    `;
  }

  private strategyFormHtml(strategies: BacktestStrategy[], strategy: BacktestStrategy): string {
    const categories = Array.from(new Set(strategies.map((item) => item.category)));
    return `
      <section class="bd-card">
        <h3>Strategy</h3>
        <label>Category
          <select id="bd-category">${categories.map((cat) => `<option>${escapeHtml(cat)}</option>`).join('')}</select>
        </label>
        <label>Strategy
          <select id="bd-strategy">
            ${strategies.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === strategy.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
          </select>
        </label>
        <p class="bd-muted">${escapeHtml(strategy.description)}</p>
        <div class="bd-param-grid">
          ${strategy.params.map((param) => `
            <label>${escapeHtml(param.label)}
              <input name="${escapeHtml(param.name)}" type="${param.type === 'integer' || param.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(String(param.default))}" ${param.min != null ? `min="${param.min}"` : ''} ${param.max != null ? `max="${param.max}"` : ''} ${param.step != null ? `step="${param.step}"` : ''}>
            </label>
          `).join('')}
        </div>
      </section>
    `;
  }

  private settingsHtml(): string {
    return `
      <section class="bd-card">
        <h3>Market Data</h3>
        <label>Symbols<input id="bd-symbols" value="SPY"></label>
        <label>Start<input id="bd-start" type="date" value="2024-01-02"></label>
        <label>End<input id="bd-end" type="date" value="2024-09-06"></label>
      </section>
      <section class="bd-card">
        <h3>Execution</h3>
        <label>Capital<input id="bd-capital" type="number" value="100000" min="1000" step="1000"></label>
        <label>Commission<input id="bd-commission" type="number" value="1" min="0" step="0.01"></label>
        <label>Slippage %<input id="bd-slippage" type="number" value="0.05" min="0" step="0.01"></label>
        <label>Leverage<input id="bd-leverage" type="number" value="1" min="1" step="0.1"></label>
        <label>Sizing<select id="bd-sizing"><option value="percent">Percent</option><option value="fixed">Fixed</option></select></label>
        <label class="bd-check"><input id="bd-short" type="checkbox"> Allow short</label>
        <label>Benchmark<input id="bd-benchmark" value="SPY"></label>
      </section>
    `;
  }

  private resultTabsHtml(): string {
    if (!this.result) {
      return `
        <section class="bd-card bd-result-card">
          <div class="bd-empty">Run the Fincept provider on bundled SPY data to populate SUMMARY, METRICS, TRADES, and RAW JSON.</div>
        </section>
      `;
    }

    const tabs: Array<{ id: ResultTab; label: string }> = [
      { id: 'summary', label: 'SUMMARY' },
      { id: 'metrics', label: 'METRICS' },
      { id: 'trades', label: 'TRADES' },
      { id: 'raw', label: 'RAW JSON' },
    ];

    return `
      <section class="bd-card bd-result-card">
        <div class="bd-result-head">
          <div class="bd-tabs">${tabs.map((tab) => `<button class="${tab.id === this.resultTab ? 'bd-tab-active' : ''}" data-result-tab="${tab.id}">${tab.label}</button>`).join('')}</div>
          <button class="bd-mini-btn" data-export-json>EXPORT JSON</button>
        </div>
        ${this.resultBodyHtml(this.result)}
      </section>
    `;
  }

  private resultBodyHtml(result: BacktestRunRecord): string {
    if (result.status !== 'ok') {
      return `<div class="bd-empty">${escapeHtml(result.message)}</div><pre class="bd-raw">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    }

    if (this.resultTab === 'metrics') {
      const metrics = result.metrics;
      return `
        <div class="bd-table">
          ${Object.entries(metrics).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${typeof value === 'number' ? value.toFixed(2) : escapeHtml(String(value))}</strong></div>`).join('')}
        </div>
      `;
    }

    if (this.resultTab === 'trades') {
      return `
        <div class="bd-trades">
          ${result.trades.length === 0 ? '<div class="bd-empty">No closed trades.</div>' : result.trades.map((trade) => `
            <div class="bd-trade-row">
              <span>${escapeHtml(trade.symbol)}</span>
              <span>${escapeHtml(trade.entry_date)} -> ${escapeHtml(trade.exit_date)}</span>
              <strong>${money(trade.pnl)}</strong>
              <em>${pct(trade.return_pct)}</em>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (this.resultTab === 'raw') {
      return `<pre class="bd-raw">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    }

    return `
      <div class="bd-kpi-grid">
        <div><span>Total Return</span><strong>${pct(result.metrics.total_return)}</strong></div>
        <div><span>Sharpe</span><strong>${result.metrics.sharpe_ratio.toFixed(2)}</strong></div>
        <div><span>Max Drawdown</span><strong>${pct(result.metrics.max_drawdown)}</strong></div>
        <div><span>Trades</span><strong>${result.metrics.total_trades}</strong></div>
      </div>
      ${this.equityChartHtml(result)}
    `;
  }

  private equityChartHtml(result: BacktestRunRecord): string {
    const values = result.equity_curve.map((point) => point.equity);
    if (values.length < 2) return '<div class="bd-empty">No equity curve.</div>';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const points = values.map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 560;
      const y = 150 - (((value - min) / range) * 130);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="bd-equity" viewBox="0 0 560 170" role="img" aria-label="Equity curve"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/><text x="8" y="18">${money(max)}</text><text x="8" y="162">${money(min)}</text></svg>`;
  }

  private bind(): void {
    this.content.querySelector<HTMLElement>('[data-bd-refresh]')?.addEventListener('click', () => void this.render());
    this.content.querySelector<HTMLElement>('[data-bd-max]')?.addEventListener('click', () => {
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
      void this.render();
    });

    this.content.querySelectorAll<HTMLElement>('[data-provider]').forEach((button) => {
      button.addEventListener('click', () => {
        this.provider = button.dataset.provider as BacktestProviderId;
        this.strategyId = this.provider === 'fincept' ? FINCEPT_STRATEGIES[0]?.id ?? 'sma_crossover' : `${this.provider}_sidecar_placeholder`;
        void this.render();
      });
    });

    this.content.querySelectorAll<HTMLElement>('[data-command]').forEach((button) => {
      button.addEventListener('click', () => {
        this.command = button.dataset.command as BacktestCommand;
        void this.render();
      });
    });

    this.content.querySelector<HTMLSelectElement>('#bd-strategy')?.addEventListener('change', (event) => {
      this.strategyId = (event.currentTarget as HTMLSelectElement).value;
      void this.render();
    });

    this.content.querySelector<HTMLElement>('[data-run]')?.addEventListener('click', () => void this.run());

    this.content.querySelectorAll<HTMLElement>('[data-result-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        this.resultTab = button.dataset.resultTab as ResultTab;
        void this.render();
      });
    });

    this.content.querySelector<HTMLElement>('[data-export-json]')?.addEventListener('click', () => {
      if (this.result) downloadJson(`backtest_${this.result.strategy_name.replace(/\s+/g, '_').toLowerCase()}.json`, this.result);
    });
  }

  private async run(): Promise<void> {
    const strategy = this.selectedStrategy;
    const values: Record<string, FormDataEntryValue | string | number | boolean | undefined> = {};
    this.content.querySelectorAll<HTMLInputElement>('.bd-param-grid input').forEach((input) => {
      values[input.name] = input.value;
    });
    const params = normalizeStrategyParams(strategy, values);

    const request: BacktestRunRequest = {
      provider: this.provider,
      command: this.command,
      strategy_id: strategy.id,
      strategy_name: strategy.name,
      params,
      market_data: {
        symbols: (this.content.querySelector<HTMLInputElement>('#bd-symbols')?.value || 'SPY')
          .split(',')
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean),
        start: this.content.querySelector<HTMLInputElement>('#bd-start')?.value || '2024-01-02',
        end: this.content.querySelector<HTMLInputElement>('#bd-end')?.value || '2024-09-06',
      },
      execution: {
        capital: Number(this.content.querySelector<HTMLInputElement>('#bd-capital')?.value || 100000),
        commission: Number(this.content.querySelector<HTMLInputElement>('#bd-commission')?.value || 1),
        slippage: Number(this.content.querySelector<HTMLInputElement>('#bd-slippage')?.value || 0.05),
        leverage: Number(this.content.querySelector<HTMLInputElement>('#bd-leverage')?.value || 1),
        sizing: (this.content.querySelector<HTMLSelectElement>('#bd-sizing')?.value || 'percent') as 'fixed' | 'percent',
        allow_short: Boolean(this.content.querySelector<HTMLInputElement>('#bd-short')?.checked),
        benchmark: this.content.querySelector<HTMLInputElement>('#bd-benchmark')?.value || 'SPY',
      },
    };

    this.content.querySelector<HTMLElement>('.bd-result-card')?.replaceChildren(this.el('div', 'bd-empty', 'Running backtest...'));
    this.result = await backtestingService.run_command(request);
    this.resultTab = 'summary';
    void this.render();
  }
}

let singleton: BacktestDetailPanel | null = null;

export function getBacktestDetailPanel(): BacktestDetailPanel {
  singleton ??= new BacktestDetailPanel();
  return singleton;
}
