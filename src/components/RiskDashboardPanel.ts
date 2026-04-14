import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { fetchGemRiskScores, getRiskLevel, getRiskColor, type GemRiskScore } from '@/services/data360';
import { escapeHtml } from '@/utils/sanitize';
import { getCountryFlag } from '@/utils/country-flags';

/**
 * GEM Risk Dashboard — shows the top 10 riskiest countries by composite
 * IFC/World Bank GEM risk score, with sub-dimension breakdown bars.
 */
export class RiskDashboardPanel extends Panel {
  private rankings: GemRiskScore[] = [];
  private loading = false;
  private lastFetch = 0;
  private readonly REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  constructor() {
    super({
      id: 'risk-dashboard',
      title: t('panels.riskDashboard') ?? 'GEM Risk Dashboard',
      showCount: true,
      infoTooltip: t('components.riskDashboard.infoTooltip') ?? 'IFC Global Emerging Market risk scores — Political, Economic, Operational & Sovereign risk dimensions ranked by composite score.',
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
      this.rankings = await fetchGemRiskScores();
      if (!this.element?.isConnected) return;
      this.lastFetch = Date.now();
      this.setCount(this.rankings.length);
      this.render();
    } catch (error) {
      if (!this.element?.isConnected) return;
      console.error('[RiskDashboardPanel] Error fetching data:', error);
      this.showError(t('common.noDataAvailable') ?? 'Failed to load risk data');
    } finally {
      this.loading = false;
    }
  }

  private showFetchingState(): void {
    this.setContent(`
      <div class="risk-fetch-progress">
        <div class="risk-fetch-icon">
          <div class="risk-globe-ring"></div>
          <span class="risk-globe">⚠️</span>
        </div>
        <div class="risk-fetch-title">${t('components.riskDashboard.fetchingData') ?? 'Loading GEM Risk Scores…'}</div>
        <div class="risk-fetch-indicators">
          <div class="risk-indicator-item" style="animation-delay: 0s">
            <span class="risk-indicator-icon">🏛️</span>
            <span class="risk-indicator-name">${t('components.riskDashboard.politicalRisk') ?? 'Political Risk'}</span>
            <span class="risk-indicator-status"></span>
          </div>
          <div class="risk-indicator-item" style="animation-delay: 0.2s">
            <span class="risk-indicator-icon">💰</span>
            <span class="risk-indicator-name">${t('components.riskDashboard.economicRisk') ?? 'Economic Risk'}</span>
            <span class="risk-indicator-status"></span>
          </div>
          <div class="risk-indicator-item" style="animation-delay: 0.4s">
            <span class="risk-indicator-icon">⚙️</span>
            <span class="risk-indicator-name">${t('components.riskDashboard.operationalRisk') ?? 'Operational Risk'}</span>
            <span class="risk-indicator-status"></span>
          </div>
          <div class="risk-indicator-item" style="animation-delay: 0.6s">
            <span class="risk-indicator-icon">🏦</span>
            <span class="risk-indicator-name">${t('components.riskDashboard.sovereignRisk') ?? 'Sovereign Risk'}</span>
            <span class="risk-indicator-status"></span>
          </div>
        </div>
        <div class="risk-fetch-note">${t('components.riskDashboard.analyzingCountries') ?? 'Analyzing country risk profiles…'}</div>
      </div>
    `);
  }

  private getFlag(countryCode: string): string {
    return getCountryFlag(countryCode);
  }

  private getRiskCategoryBadge(risk: number): { label: string; cssClass: string; color: string } {
    const level = getRiskLevel(risk);
    switch (level) {
      case 'low':
        return { label: 'Very Low Risk', cssClass: 'risk-cat-very-low', color: '#22c55e' };
      case 'moderate':
        return { label: 'Low Risk', cssClass: 'risk-cat-low', color: '#84cc16' };
      case 'high':
        return { label: 'Moderate Risk', cssClass: 'risk-cat-moderate', color: '#eab308' };
      default:
        // We don't have 'very high' in the getRiskLevel return type, but we handle it:
        return { label: 'High Risk', cssClass: 'risk-cat-high', color: '#ef4444' };
    }
  }

  /** Safety score is the inverse of risk on 0-100 scale */
  private safetyScore(risk: number): number {
    return Math.round(100 - risk);
  }

  private formatComponent(value: number | null): string {
    if (value === null) return '—';
    return Math.round(value).toString();
  }

  private render(): void {
    if (this.rankings.length === 0) {
      this.showError(t('common.noDataAvailable') ?? 'No risk data available');
      return;
    }

    // Show top 10 riskiest countries (already sorted highest-risk first)
    const top = this.rankings.slice(0, 10);

    const html = `
      <div class="risk-dashboard-list">
        ${top.map(country => this.renderCountry(country)).join('')}
      </div>
      <div class="risk-dashboard-footer">
        <span class="risk-dashboard-source">${t('components.riskDashboard.source') ?? 'Source: IFC Global Emerging Market (GEM) Risk'}</span>
        <span class="risk-dashboard-updated">${t('components.riskDashboard.updated', { date: new Date(this.lastFetch).toLocaleDateString() }) ?? `Updated: ${new Date(this.lastFetch).toLocaleDateString()}`}</span>
      </div>
    `;

    this.setContent(html);
  }

  private renderCountry(country: GemRiskScore): string {
    const riskColor = getRiskColor(country.compositeRisk);
    const cat = this.getRiskCategoryBadge(country.compositeRisk);
    const safety = this.safetyScore(country.compositeRisk);
    const safetyColor = safety >= 70 ? '#22c55e' : safety >= 50 ? '#84cc16' : safety >= 30 ? '#eab308' : '#ef4444';

    // Compute each sub-dimension bar width & color (0-10 scale; map to percentage)
    const dimensions = [
      {
        key: 'political',
        label: 'Political',
        value: country.components.political,
        color: '#8b5cf6', // purple
      },
      {
        key: 'economic',
        label: 'Economic',
        value: country.components.economic,
        color: '#3b82f6', // blue
      },
      {
        key: 'operational',
        label: 'Operational',
        value: country.components.operational,
        color: '#f59e0b', // amber
      },
      {
        key: 'sovereign',
        label: 'Sovereign',
        value: country.components.sovereign,
        color: '#ef4444', // red
      },
    ];

    const dimBars = dimensions.map(d => {
      const rawValue = d.value !== null ? d.value : 0;
      // GEM sub-indicators are 0-10, map to 0-100% width
      const pct = Math.min(100, Math.max(0, (rawValue / 10) * 100));
      const display = d.value !== null ? d.value.toFixed(1) : '—';
      return `
        <div class="risk-dim-row">
          <span class="risk-dim-label">${d.label}</span>
          <div class="risk-dim-bar-bg">
            <div class="risk-dim-bar-fill" style="width: ${pct}%; background: ${d.color};"></div>
          </div>
          <span class="risk-dim-value" style="color: ${d.color}">${display}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="risk-dashboard-item ${cat.cssClass}" data-country="${escapeHtml(country.countryCode)}">
        <div class="risk-item-header">
          <div class="risk-item-rank-flag">
            <span class="risk-item-rank">#${country.rank}</span>
            <span class="risk-item-flag">${this.getFlag(country.countryCode)}</span>
          </div>
          <div class="risk-item-info">
            <div class="risk-item-name">${escapeHtml(country.countryName)}</div>
            <span class="risk-item-badge ${cat.cssClass}" style="--badge-color: ${cat.color}">${cat.label}</span>
          </div>
          <div class="risk-item-scores">
            <div class="risk-item-risk" title="Composite Risk Score">
              <span class="risk-item-risk-label">Risk</span>
              <span class="risk-item-risk-value" style="color: ${riskColor}">${country.compositeRisk.toFixed(1)}</span>
            </div>
            <div class="risk-item-safety" title="Safety Score (100 - Risk)">
              <span class="risk-item-safety-label">Safety</span>
              <span class="risk-item-safety-value" style="color: ${safetyColor}">${safety}</span>
            </div>
          </div>
        </div>
        <div class="risk-item-dimensions">
          ${dimBars}
        </div>
      </div>
    `;
  }
}