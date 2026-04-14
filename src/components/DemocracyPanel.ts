/**
 * DemocracyPanel — Ranked list of countries by composite democracy score
 * with sub-score bars for V-Dem democracy indices.
 *
 * Data source: V-Dem (Varieties of Democracy) via Data360 API.
 * Displays: Electoral, Liberal, Participatory, Deliberative, Egalitarian
 * sub-scores plus Freedom of Expression and Clean Elections indicators.
 */

import { Panel } from './Panel';
import { t } from '@/services/i18n';
import {
  fetchDemocracyRankings,
  fetchVdemCore,
  getRegimeTypeColor,
  type DemocracyScore,
} from '@/services/data360';
import { escapeHtml } from '@/utils/sanitize';
import { getCountryFlag } from '@/utils/country-flags';

export class DemocracyPanel extends Panel {
  private rankings: DemocracyScore[] = [];
  private loading = false;
  private lastFetch = 0;
  private readonly REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  static readonly panelKey = 'democracy';

  constructor() {
    super({
      id: 'democracy',
      title: t('panels.democracy'),
      showCount: true,
      infoTooltip: t('components.democracy.infoTooltip'),
    });
  }

  public async refresh(): Promise<void> {
    if (this.loading) return;
    if (Date.now() - this.lastFetch < this.REFRESH_INTERVAL && this.rankings.length > 0) {
      return;
    }

    this.loading = true;
    this.showFetchingState();

    try {
      const [democracyScores] = await Promise.all([
        fetchDemocracyRankings(),
        // Pre-warm V-Dem core data cache
        fetchVdemCore().catch(() => []),
      ]);

      if (!this.element?.isConnected) return;

      this.rankings = democracyScores;
      this.lastFetch = Date.now();
      this.setCount(this.rankings.length);
      this.render();
    } catch (error) {
      if (!this.element?.isConnected) return;
      console.error('[DemocracyPanel] Error fetching data:', error);
      this.showError(t('common.failedDemocracy'));
    } finally {
      this.loading = false;
    }
  }

  private showFetchingState(): void {
    this.setContent(`
      <div class="democracy-fetch-progress">
        <div class="democracy-fetch-icon">
          <div class="democracy-globe-ring"></div>
          <span class="democracy-globe">🏛️</span>
        </div>
        <div class="democracy-fetch-title">${t('components.democracy.fetchingData')}</div>
        <div class="democracy-fetch-indicators">
          <div class="democracy-indicator-item" style="animation-delay: 0s">
            <span class="democracy-indicator-icon">🗳️</span>
            <span class="democracy-indicator-name">${t('components.democracy.electoralIndicator')}</span>
            <span class="democracy-indicator-status"></span>
          </div>
          <div class="democracy-indicator-item" style="animation-delay: 0.15s">
            <span class="democracy-indicator-icon">⚖️</span>
            <span class="democracy-indicator-name">${t('components.democracy.liberalIndicator')}</span>
            <span class="democracy-indicator-status"></span>
          </div>
          <div class="democracy-indicator-item" style="animation-delay: 0.3s">
            <span class="democracy-indicator-icon">🤝</span>
            <span class="democracy-indicator-name">${t('components.democracy.participatoryIndicator')}</span>
            <span class="democracy-indicator-status"></span>
          </div>
          <div class="democracy-indicator-item" style="animation-delay: 0.45s">
            <span class="democracy-indicator-icon">💬</span>
            <span class="democracy-indicator-name">${t('components.democracy.deliberativeIndicator')}</span>
            <span class="democracy-indicator-status"></span>
          </div>
          <div class="democracy-indicator-item" style="animation-delay: 0.6s">
            <span class="democracy-indicator-icon">🏳️</span>
            <span class="democracy-indicator-name">${t('components.democracy.egalitarianIndicator')}</span>
            <span class="democracy-indicator-status"></span>
          </div>
        </div>
        <div class="democracy-fetch-note">${t('components.democracy.analyzingCountries')}</div>
      </div>
    `);
  }

  private getFlag(countryCode: string): string {
    return getCountryFlag(countryCode);
  }

  private getRegimeBadgeClass(regimeType: DemocracyScore['regimeType']): string {
    switch (regimeType) {
      case 'Full Democracy': return 'regime-full-democracy';
      case 'Democracy': return 'regime-democracy';
      case 'Hybrid Regime': return 'regime-hybrid';
      case 'Autocracy': return 'regime-autocracy';
      default: return 'regime-hybrid';
    }
  }

  private renderBar(value: number | null, label: string, color: string): string {
    if (value === null) {
      return `<div class="democracy-sub-bar" title="${escapeHtml(label)}: —">
        <div class="democracy-sub-bar-label">${escapeHtml(label)}</div>
        <div class="democracy-sub-bar-track">
          <div class="democracy-sub-bar-fill" style="width: 0%; background: #4b5563;"></div>
        </div>
        <div class="democracy-sub-bar-value">—</div>
      </div>`;
    }
    const pct = Math.min(100, Math.max(0, value));
    return `<div class="democracy-sub-bar" title="${escapeHtml(label)}: ${pct.toFixed(1)}">
      <div class="democracy-sub-bar-label">${escapeHtml(label)}</div>
      <div class="democracy-sub-bar-track">
        <div class="democracy-sub-bar-fill" style="width: ${pct}%; background: ${color};"></div>
      </div>
      <div class="democracy-sub-bar-value">${Math.round(pct)}</div>
    </div>`;
  }

  private render(): void {
    if (this.rankings.length === 0) {
      this.showError(t('common.noDataAvailable'));
      return;
    }

    // Show top 25 countries
    const top = this.rankings.slice(0, 25);

    const html = `
      <div class="democracy-list">
        ${top.map(country => {
          const regimeBadge = this.getRegimeBadgeClass(country.regimeType);
          const regimeColor = getRegimeTypeColor(country.regimeType);
          return `
            <div class="democracy-item ${regimeBadge}" data-country="${escapeHtml(country.countryCode)}">
              <div class="democracy-item-header">
                <div class="democracy-rank">#${country.rank}</div>
                <div class="democracy-flag">${this.getFlag(country.countryCode)}</div>
                <div class="democracy-info">
                  <div class="democracy-name">${escapeHtml(country.countryName)}</div>
                  <span class="democracy-regime-badge" style="background: ${regimeColor}20; color: ${regimeColor}; border: 1px solid ${regimeColor}40;">${escapeHtml(country.regimeType)}</span>
                </div>
                <div class="democracy-score" style="color: ${this.getScoreColor(country.compositeScore)}">${country.compositeScore.toFixed(1)}</div>
              </div>
              <div class="democracy-sub-scores">
                ${this.renderBar(country.components.electoral, t('components.democracy.electoral'), '#3b82f6')}
                ${this.renderBar(country.components.liberal, t('components.democracy.liberal'), '#8b5cf6')}
                ${this.renderBar(country.components.participatory, t('components.democracy.participatory'), '#06b6d4')}
                ${this.renderBar(country.components.deliberative, t('components.democracy.deliberative'), '#f59e0b')}
                ${this.renderBar(country.components.egalitarian, t('components.democracy.egalitarian'), '#10b981')}
              </div>
              <div class="democracy-indicators">
                ${country.components.freedomOfExpression !== null
                  ? `<span class="democracy-indicator" title="${escapeHtml(t('components.democracy.freedomOfExpression'))}">
                      🗣️ ${Math.round(country.components.freedomOfExpression)}
                    </span>`
                  : ''}
                ${country.components.cleanElections !== null
                  ? `<span class="democracy-indicator" title="${escapeHtml(t('components.democracy.cleanElections'))}">
                      ✅ ${Math.round(country.components.cleanElections)}
                    </span>`
                  : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="democracy-footer">
        <span class="democracy-source">${t('components.democracy.source')}</span>
        <span class="democracy-updated">${t('components.democracy.updated', { date: new Date(this.lastFetch).toLocaleDateString() })}</span>
      </div>
    `;

    this.setContent(html);
  }

  private getScoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#84cc16';
    if (score >= 30) return '#eab308';
    return '#ef4444';
  }
}