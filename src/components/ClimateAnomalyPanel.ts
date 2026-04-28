import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import {
  type ClimateAnomaly,
  type ClimatePhysicalSignal,
  type ClimateSourceStatus,
  getSeverityIcon,
  formatDelta,
} from '@/services/climate';
import { t } from '@/services/i18n';

export class ClimateAnomalyPanel extends Panel {
  private anomalies: ClimateAnomaly[] = [];
  private physicalSignals: ClimatePhysicalSignal[] = [];
  private sourceStatus: ClimateSourceStatus[] = [];
  private onZoneClick?: (lat: number, lon: number) => void;

  constructor() {
    super({
      id: 'climate',
      title: t('panels.climate'),
      showCount: true,
      trackActivity: true,
      infoTooltip: t('components.climate.infoTooltip'),
    });
    this.showLoading(t('common.loadingClimateData'));
  }

  public setZoneClickHandler(handler: (lat: number, lon: number) => void): void {
    this.onZoneClick = handler;
  }

  public setAnomalies(anomalies: ClimateAnomaly[]): void {
    this.anomalies = anomalies;
    this.setCount(anomalies.length);
    this.renderContent();
  }

  public setPhysicalSignals(signals: ClimatePhysicalSignal[]): void {
    this.physicalSignals = signals;
    this.renderContent();
  }

  public setSourceStatus(status: ClimateSourceStatus[]): void {
    this.sourceStatus = status;
    this.renderContent();
  }

  private renderContent(): void {
    if (this.anomalies.length === 0 && this.physicalSignals.length === 0 && this.sourceStatus.length === 0) {
      this.showEmptyState(t('components.climate.noAnomalies'));
      return;
    }

    const sorted = [...this.anomalies].sort((a, b) => {
      const severityOrder = { extreme: 0, moderate: 1, normal: 2 };
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    const rows = sorted.map(a => {
      const icon = getSeverityIcon(a);
      const tempClass = a.tempDelta > 0 ? 'climate-warm' : 'climate-cold';
      const precipClass = a.precipDelta > 0 ? 'climate-wet' : 'climate-dry';
      const sevClass = `severity-${a.severity}`;
      const rowClass = a.severity === 'extreme' ? ' climate-extreme-row' : '';

      return `<tr class="climate-row${rowClass}" data-lat="${a.lat}" data-lon="${a.lon}">
        <td class="climate-zone"><span class="climate-icon">${icon}</span>${escapeHtml(a.zone)}</td>
        <td class="climate-num ${tempClass}">${formatDelta(a.tempDelta, '°C')}</td>
        <td class="climate-num ${precipClass}">${formatDelta(a.precipDelta, 'mm')}</td>
        <td><span class="climate-badge ${sevClass}">${t(`components.climate.severity.${a.severity}`)}</span></td>
      </tr>`;
    }).join('');

    const anomalyTable = rows ? `
      <table class="climate-table">
        <thead>
          <tr>
            <th>${t('components.climate.zone')}</th>
            <th>${t('components.climate.temp')}</th>
            <th>${t('components.climate.precip')}</th>
            <th>${t('components.climate.severityLabel')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    ` : '';
    const physicalSignals = this.renderPhysicalSignals();
    const sourceStatus = this.renderSourceStatus();

    this.setContent(`
      <div class="climate-panel-content">
        ${anomalyTable}
        ${physicalSignals}
        ${sourceStatus}
      </div>
    `);

    this.content.querySelectorAll('.climate-row, .climate-physical-card').forEach(el => {
      el.addEventListener('click', () => {
        const lat = Number((el as HTMLElement).dataset.lat);
        const lon = Number((el as HTMLElement).dataset.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) this.onZoneClick?.(lat, lon);
      });
    });
  }

  private renderPhysicalSignals(): string {
    if (this.physicalSignals.length === 0) return '';
    const cards = this.physicalSignals.map(signal => `
      <button type="button" class="climate-physical-card severity-${signal.severity}" data-lat="${signal.lat}" data-lon="${signal.lon}">
        <span class="climate-physical-location">${escapeHtml(signal.location)}</span>
        <span class="climate-physical-value">${signal.europeanAqi === null ? 'AQI n/a' : `AQI ${signal.europeanAqi}`}</span>
        <span class="climate-physical-meta">PM2.5 ${formatPollutionValue(signal.pm25)} / PM10 ${formatPollutionValue(signal.pm10)}</span>
      </button>
    `).join('');
    return `
      <div class="climate-physical-section">
        <div class="climate-section-label">Air quality observations</div>
        <div class="climate-physical-grid">${cards}</div>
      </div>
    `;
  }

  private renderSourceStatus(): string {
    const unavailable = this.sourceStatus.filter(status => !status.ok);
    if (unavailable.length === 0) return '';
    const rows = unavailable.map(status => `
      <div class="climate-source-status">
        <span>${escapeHtml(status.source)}</span>
        <span>${escapeHtml(status.message ?? 'source unavailable')}</span>
      </div>
    `).join('');
    return `<div class="climate-source-statuses">${rows}</div>`;
  }
}

function formatPollutionValue(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(1)} ug/m3`;
}
