import { Panel } from './Panel';
import { algoTradingService } from '@/services/algo-trading-service';
import { SCANNER_PRESETS } from '@/services/algo-indicators';
import { getAlgoDetailPanel } from './algo-detail/AlgoDetailPanel';
import type { AlgoDeployment, AlgoStrategy } from '@/services/algo-types';
import { escapeHtml } from '@/utils/sanitize';

type AlgoOpenTab = 'builder' | 'strategies' | 'scanner' | 'dashboard';

export class AlgoTradingPanel extends Panel {
  private strategies: AlgoStrategy[] = [];
  private deployments: AlgoDeployment[] = [];

  public constructor() {
    super({ id: 'algo-trading', title: 'Algo Trading' });
    void this.render();
  }

  public async render(): Promise<void> {
    [this.strategies, this.deployments] = await Promise.all([
      algoTradingService.list_strategies(),
      algoTradingService.list_deployments(),
    ]);
    const live = this.deployments.filter((deployment) => deployment.status === 'running').length;
    this.setContentNow(`
      <div class="algo-panel-shell">
        <div class="algo-top">
          <span class="algo-live">${live} LIVE</span>
          <button class="algo-open" data-algo-open="builder">Open Builder</button>
          <button class="algo-open" data-algo-open="scanner">Open Scanner</button>
          <button class="algo-open" data-algo-open="dashboard">Open Dashboard</button>
        </div>
        <section class="algo-card">
          <div class="algo-section-title">Saved Strategies</div>
          ${this.strategies.slice(0, 3).map((strategy) => `
            <button class="algo-strategy" data-algo-open="strategies">
              <span>${escapeHtml(strategy.name)}</span>
              <em>${escapeHtml(strategy.symbol)} | ${new Date(strategy.updated_at).toLocaleDateString()}</em>
            </button>
          `).join('')}
        </section>
        <section class="algo-card">
          <div class="algo-section-title">Quick Scan</div>
          <div class="algo-chip-row">
            ${SCANNER_PRESETS.map((preset) => `<button data-algo-preset="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</button>`).join('')}
          </div>
        </section>
      </div>
    `);
    this.bind();
  }

  private bind(): void {
    this.content.querySelectorAll<HTMLElement>('[data-algo-open]').forEach((button) => {
      button.addEventListener('click', () => {
        getAlgoDetailPanel().show((button.dataset.algoOpen ?? 'builder') as AlgoOpenTab);
      });
    });
    this.content.querySelectorAll<HTMLElement>('[data-algo-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        getAlgoDetailPanel().show('scanner');
        setTimeout(() => {
          const presetButton = document.querySelector<HTMLElement>(`[data-ad-preset="${CSS.escape(button.dataset.algoPreset ?? '')}"]`);
          presetButton?.click();
        }, 50);
      });
    });
  }
}
