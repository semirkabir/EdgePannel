import { DetailPanelBase } from '../detail-panel/DetailPanelBase';
import { algoTradingService } from '@/services/algo-trading-service';
import { ALGO_INDICATORS, ALGO_TIMEFRAMES, DEFAULT_US_WATCHLIST, SCANNER_PRESETS } from '@/services/algo-indicators';
import type { AlgoBacktestResult, AlgoDeployment, AlgoScanMatch, AlgoStrategy } from '@/services/algo-types';
import { escapeHtml } from '@/utils/sanitize';

type AlgoTab = 'builder' | 'strategies' | 'scanner' | 'dashboard';

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function pct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export class AlgoDetailPanel extends DetailPanelBase {
  private activeTab: AlgoTab = 'builder';
  private strategies: AlgoStrategy[] = [];
  private deployments: AlgoDeployment[] = [];
  private scanMatches: AlgoScanMatch[] = [];
  private backtestResult: AlgoBacktestResult | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  public constructor() {
    super({
      id: 'algo-detail-panel',
      ariaLabel: 'Algo Trading',
      contentId: 'algo-detail-content',
      closeId: 'algo-detail-close',
      rootClassName: 'algo-detail-panel detail-panel',
      shellClassName: 'ad-shell dp-shell',
      closeClassName: 'ad-close dp-close',
      contentClassName: 'ad-panel-content dp-panel-content',
      closeText: '\u00d7',
    });
  }

  public show(tab: AlgoTab = 'builder', maximize = true): void {
    this.activeTab = tab;
    this.openPanel();
    if (maximize) this.maximize();
    void this.render();
    this.startPoll();
  }

  public hide(): void {
    this.stopPoll();
    if (this.isMaximizedState) this.minimize();
    this.closePanel();
    this.onCloseCallback?.();
  }

  private startPoll(): void {
    this.stopPoll();
    this.pollTimer = setInterval(() => {
      if (this.isVisible() && this.activeTab === 'dashboard') void this.render();
    }, 5000);
  }

  private stopPoll(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async render(): Promise<void> {
    [this.strategies, this.deployments] = await Promise.all([
      algoTradingService.list_strategies(),
      algoTradingService.list_deployments(),
    ]);

    this.content.innerHTML = `
      <header class="ad-header">
        <div>
          <div class="ad-kicker">Algo Trading</div>
          <h2>Strategy Builder</h2>
          <span>${this.deployments.filter((item) => item.status === 'running').length} LIVE PAPER</span>
        </div>
        <div class="ad-header-actions">
          <button class="ad-icon-btn" data-ad-refresh>&#8635;</button>
          <button class="ad-icon-btn" data-ad-max>${this.isMaximizedState ? '&minus;' : '&#9633;'}</button>
        </div>
      </header>
      <nav class="ad-tabs">
        ${this.tabButton('builder', 'BUILDER')}
        ${this.tabButton('strategies', 'MY STRATEGIES')}
        ${this.tabButton('scanner', 'SCANNER')}
        ${this.tabButton('dashboard', 'DASHBOARD')}
        <span class="ad-live-dot">${this.deployments.filter((item) => item.status === 'running').length} LIVE</span>
      </nav>
      ${this.tabBodyHtml()}
    `;
    this.bind();
  }

  private tabButton(tab: AlgoTab, label: string): string {
    return `<button class="${this.activeTab === tab ? 'ad-tab-active' : ''}" data-ad-tab="${tab}">${label}</button>`;
  }

  private tabBodyHtml(): string {
    if (this.activeTab === 'strategies') return this.strategiesHtml();
    if (this.activeTab === 'scanner') return this.scannerHtml();
    if (this.activeTab === 'dashboard') return this.dashboardHtml();
    return this.builderHtml();
  }

  private builderHtml(): string {
    const strategy = this.strategies[0];
    return `
      <div class="ad-builder">
        <section class="ad-card">
          <h3>Definition</h3>
          <label>Name<input id="ad-name" value="${escapeHtml(strategy?.name ?? 'RSI Oversold Bounce')}"></label>
          <label>Description<textarea id="ad-description">${escapeHtml(strategy?.description ?? '')}</textarea></label>
          <label>Symbol<input id="ad-symbol" value="${escapeHtml(strategy?.symbol ?? 'SPY')}"></label>
          <label>Timeframe<select id="ad-timeframe">${ALGO_TIMEFRAMES.map((tf) => `<option${strategy?.timeframe === tf ? ' selected' : ''}>${tf}</option>`).join('')}</select></label>
          ${this.conditionBlockHtml('Entry', 'entry')}
          ${this.conditionBlockHtml('Exit', 'exit')}
          <div class="ad-risk-grid">
            <label>SL %<input id="ad-sl" type="number" value="${strategy?.risk.stopLossPct ?? 5}"></label>
            <label>TP %<input id="ad-tp" type="number" value="${strategy?.risk.takeProfitPct ?? 12}"></label>
            <label>Trail %<input id="ad-trail" type="number" value="${strategy?.risk.trailingStopPct ?? 0}"></label>
            <label>Size %<input id="ad-size" type="number" value="${strategy?.risk.positionSizePct ?? 95}"></label>
          </div>
          <button class="ad-primary" data-ad-save>SAVE</button>
        </section>
        <section class="ad-card">
          <h3>Backtest</h3>
          <label>Capital<input id="ad-capital" type="number" value="100000"></label>
          <label>Start<input id="ad-start" type="date" value="2024-01-02"></label>
          <label>End<input id="ad-end" type="date" value="2024-09-06"></label>
          <button class="ad-primary" data-ad-backtest>RUN BACKTEST</button>
          ${this.backtestHtml()}
        </section>
      </div>
    `;
  }

  private conditionBlockHtml(title: string, prefix: string): string {
    return `
      <div class="ad-condition-block">
        <div class="ad-block-head"><strong>${title}</strong><select id="ad-${prefix}-join"><option>AND</option><option>OR</option></select></div>
        <div class="ad-condition-row">
          <select id="ad-${prefix}-indicator">${ALGO_INDICATORS.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join('')}</select>
          <select id="ad-${prefix}-operator"><option>&lt;</option><option>&gt;</option><option>&gt;=</option><option>&lt;=</option></select>
          <input id="ad-${prefix}-value" type="number" value="${prefix === 'entry' ? 30 : 55}">
        </div>
      </div>
    `;
  }

  private backtestHtml(): string {
    if (!this.backtestResult) return '<div class="ad-empty">No backtest result yet.</div>';
    return `
      <div class="ad-kpi-grid">
        <div><span>Return</span><strong>${pct(this.backtestResult.total_return)}</strong></div>
        <div><span>MDD</span><strong>${pct(this.backtestResult.max_drawdown)}</strong></div>
        <div><span>Trades</span><strong>${this.backtestResult.total_trades}</strong></div>
        <div><span>Win Rate</span><strong>${pct(this.backtestResult.win_rate)}</strong></div>
      </div>
    `;
  }

  private strategiesHtml(): string {
    return `
      <section class="ad-card">
        <h3>Saved Strategies</h3>
        <div class="ad-table">
          ${this.strategies.map((strategy) => `
            <div class="ad-row">
              <span>${escapeHtml(strategy.name)}</span>
              <em>${escapeHtml(strategy.symbol)} ${escapeHtml(strategy.timeframe)}</em>
              <button data-ad-deploy="${escapeHtml(strategy.id)}">Deploy Paper</button>
              <button data-ad-edit="${escapeHtml(strategy.id)}">Edit</button>
              <button data-ad-delete="${escapeHtml(strategy.id)}">Delete</button>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  private scannerHtml(): string {
    return `
      <section class="ad-card">
        <h3>Scanner</h3>
        <div class="ad-chip-row">
          ${SCANNER_PRESETS.map((preset) => `<button data-ad-preset="${preset.id}">${escapeHtml(preset.label)}</button>`).join('')}
        </div>
        <label>Watchlist<input id="ad-watchlist" value="${escapeHtml(DEFAULT_US_WATCHLIST.join(','))}"></label>
        <button class="ad-primary" data-ad-scan>SCAN</button>
        <div class="ad-table">
          ${this.scanMatches.length === 0 ? '<div class="ad-empty">No scan matches yet.</div>' : this.scanMatches.map((match) => `
            <div class="ad-row"><span>${escapeHtml(match.symbol)}</span><em>${escapeHtml(match.signal)}</em><strong>${money(match.price)}</strong></div>
          `).join('')}
        </div>
      </section>
    `;
  }

  private dashboardHtml(): string {
    return `
      <section class="ad-card">
        <div class="ad-card-head">
          <h3>Deployments</h3>
          <button data-ad-stop-all>Stop All</button>
        </div>
        <div class="ad-table">
          ${this.deployments.length === 0 ? '<div class="ad-empty">No deployments yet.</div>' : this.deployments.map((deployment) => `
            <div class="ad-row">
              <span>${escapeHtml(deployment.strategy_name)}</span>
              <em>${escapeHtml(deployment.status)} ${escapeHtml(deployment.mode)}</em>
              <strong>${money(deployment.pnl)}</strong>
              <b>${deployment.trades} trades</b>
              <button data-ad-stop="${escapeHtml(deployment.id)}">Stop</button>
            </div>
          `).join('')}
        </div>
        <div class="ad-muted">Live broker mode is disabled. Connect a broker via Tauri sidecar.</div>
      </section>
    `;
  }

  private bind(): void {
    this.content.querySelector<HTMLElement>('[data-ad-refresh]')?.addEventListener('click', () => void this.render());
    this.content.querySelector<HTMLElement>('[data-ad-max]')?.addEventListener('click', () => {
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
      void this.render();
    });
    this.content.querySelectorAll<HTMLElement>('[data-ad-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.adTab as AlgoTab;
        void this.render();
      });
    });
    this.content.querySelector<HTMLElement>('[data-ad-save]')?.addEventListener('click', () => void this.saveFromBuilder());
    this.content.querySelector<HTMLElement>('[data-ad-backtest]')?.addEventListener('click', () => void this.runBacktest());
    this.content.querySelector<HTMLElement>('[data-ad-scan]')?.addEventListener('click', () => void this.runPresetScan());
    this.content.querySelectorAll<HTMLElement>('[data-ad-preset]').forEach((button) => {
      button.addEventListener('click', () => void this.runPresetScan(button.dataset.adPreset));
    });
    this.content.querySelectorAll<HTMLElement>('[data-ad-deploy]').forEach((button) => {
      button.addEventListener('click', async () => {
        await algoTradingService.deploy_strategy(button.dataset.adDeploy ?? '', 'paper');
        this.activeTab = 'dashboard';
        await this.render();
      });
    });
    this.content.querySelectorAll<HTMLElement>('[data-ad-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        await algoTradingService.delete_strategy(button.dataset.adDelete ?? '');
        await this.render();
      });
    });
    this.content.querySelectorAll<HTMLElement>('[data-ad-stop]').forEach((button) => {
      button.addEventListener('click', async () => {
        await algoTradingService.stop_deployment(button.dataset.adStop ?? '');
        await this.render();
      });
    });
    this.content.querySelector<HTMLElement>('[data-ad-stop-all]')?.addEventListener('click', async () => {
      await algoTradingService.stop_all_deployments();
      await this.render();
    });
  }

  private buildStrategyFromForm(): Omit<AlgoStrategy, 'id' | 'created_at' | 'updated_at'> & { id?: string } {
    const entryIndicator = this.inputValue('ad-entry-indicator', 'rsi');
    const exitIndicator = this.inputValue('ad-exit-indicator', 'rsi');
    return {
      id: this.strategies[0]?.id,
      name: this.inputValue('ad-name', 'RSI Oversold Bounce'),
      description: this.inputValue('ad-description', ''),
      symbol: this.inputValue('ad-symbol', 'SPY').toUpperCase(),
      timeframe: this.inputValue('ad-timeframe', '1d') as AlgoStrategy['timeframe'],
      entryJoin: this.inputValue('ad-entry-join', 'AND') as AlgoStrategy['entryJoin'],
      exitJoin: this.inputValue('ad-exit-join', 'OR') as AlgoStrategy['exitJoin'],
      entryConditions: [{
        id: 'entry_1',
        left: { indicator: entryIndicator, params: { period: 14 } },
        operator: this.inputValue('ad-entry-operator', '<') as AlgoStrategy['entryConditions'][number]['operator'],
        compareMode: 'value',
        rightValue: Number(this.inputValue('ad-entry-value', '30')),
      }],
      exitConditions: [{
        id: 'exit_1',
        left: { indicator: exitIndicator, params: { period: 14 } },
        operator: this.inputValue('ad-exit-operator', '>') as AlgoStrategy['exitConditions'][number]['operator'],
        compareMode: 'value',
        rightValue: Number(this.inputValue('ad-exit-value', '55')),
      }],
      risk: {
        stopLossPct: Number(this.inputValue('ad-sl', '5')),
        takeProfitPct: Number(this.inputValue('ad-tp', '12')),
        trailingStopPct: Number(this.inputValue('ad-trail', '0')),
        positionSizePct: Number(this.inputValue('ad-size', '95')),
      },
    };
  }

  private inputValue(id: string, fallback: string): string {
    const el = this.content.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${CSS.escape(id)}`);
    return el?.value || fallback;
  }

  private async saveFromBuilder(): Promise<void> {
    await algoTradingService.save_strategy(this.buildStrategyFromForm());
    this.activeTab = 'strategies';
    await this.render();
  }

  private async runBacktest(): Promise<void> {
    const strategy = await algoTradingService.save_strategy(this.buildStrategyFromForm());
    this.backtestResult = await algoTradingService.run_backtest({
      strategy,
      capital: Number(this.inputValue('ad-capital', '100000')),
      start: this.inputValue('ad-start', '2024-01-02'),
      end: this.inputValue('ad-end', '2024-09-06'),
    });
    await this.render();
  }

  private async runPresetScan(presetId = 'rsi_oversold'): Promise<void> {
    const request = algoTradingService.scannerPreset(presetId);
    const custom = this.content.querySelector<HTMLInputElement>('#ad-watchlist')?.value;
    if (custom) request.symbols = custom.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    this.scanMatches = await algoTradingService.run_scan(request);
    this.activeTab = 'scanner';
    await this.render();
  }
}

let singleton: AlgoDetailPanel | null = null;

export function getAlgoDetailPanel(): AlgoDetailPanel {
  singleton ??= new AlgoDetailPanel();
  return singleton;
}
