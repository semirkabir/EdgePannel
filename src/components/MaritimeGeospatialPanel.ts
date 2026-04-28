import { Panel } from './Panel';
import type { MaritimeGeospatialSnapshot } from '@/services/maritime';
import { countMaritimeGeospatialFeatures } from '@/services/maritime';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';

function formatAge(value: string): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return 'unknown';
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export class MaritimeGeospatialPanel extends Panel {
  private snapshot: MaritimeGeospatialSnapshot | null = null;

  constructor() {
    super({
      id: 'maritime-geospatial',
      title: t('panels.maritimeGeospatial', { defaultValue: 'Maritime Geospatial' }),
      showCount: true,
      trackActivity: true,
      infoTooltip: 'Lightweight maritime enrichment for satellite observations, ocean conditions, and fishing activity. Imagery is not ingested by the browser.',
    });
    this.showLoading('Checking maritime geospatial feed...');
  }

  public update(snapshot: MaritimeGeospatialSnapshot): void {
    this.snapshot = snapshot;
    this.setCount(countMaritimeGeospatialFeatures(snapshot));
    this.render();
  }

  private render(): void {
    if (!this.snapshot) {
      this.setContent('<div class="panel-empty">No maritime geospatial data loaded</div>');
      return;
    }

    const count = countMaritimeGeospatialFeatures(this.snapshot);
    const statusClass = this.snapshot.status === 'available'
      ? 'ok'
      : this.snapshot.status === 'degraded'
        ? 'warning'
        : 'unavailable';

    if (count === 0) {
      this.setContent(`
        <div class="maritime-geo-panel">
          <div class="maritime-geo-status ${statusClass}">
            <span>${escapeHtml(this.snapshot.status.toUpperCase())}</span>
            <strong>${escapeHtml(this.snapshot.message || 'No maritime geospatial feed data available')}</strong>
          </div>
          <div class="maritime-geo-grid">
            <div><span>Satellite</span><strong>0</strong></div>
            <div><span>Ocean</span><strong>0</strong></div>
            <div><span>Fishing</span><strong>0</strong></div>
          </div>
        </div>
      `);
      return;
    }

    const satelliteRows = this.snapshot.satelliteObservations.slice(0, 4).map((item) => `
      <li>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.type.replace(/_/g, ' '))} · ${escapeHtml(item.confidence)} · ${formatAge(item.observedAt)}</span>
      </li>
    `).join('');
    const oceanRows = this.snapshot.oceanConditions.slice(0, 4).map((item) => `
      <li>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.metric.replace(/_/g, ' '))}: ${escapeHtml(String(item.value))}${escapeHtml(item.unit)} · ${escapeHtml(item.severity)}</span>
      </li>
    `).join('');
    const fishingRows = this.snapshot.fishingActivity.slice(0, 4).map((item) => `
      <li>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.activity)} activity · ${item.vesselsEstimated ?? 'n/a'} est. vessels</span>
      </li>
    `).join('');

    this.setContent(`
      <div class="maritime-geo-panel">
        <div class="maritime-geo-status ${statusClass}">
          <span>${escapeHtml(this.snapshot.status.toUpperCase())}</span>
          <strong>${escapeHtml(this.snapshot.source === 'configured-feed' ? 'Configured feed' : 'No configured feed')}</strong>
        </div>
        <div class="maritime-geo-grid">
          <div><span>Satellite</span><strong>${this.snapshot.satelliteObservations.length}</strong></div>
          <div><span>Ocean</span><strong>${this.snapshot.oceanConditions.length}</strong></div>
          <div><span>Fishing</span><strong>${this.snapshot.fishingActivity.length}</strong></div>
        </div>
        ${satelliteRows ? `<section><h4>Satellite</h4><ul>${satelliteRows}</ul></section>` : ''}
        ${oceanRows ? `<section><h4>Ocean</h4><ul>${oceanRows}</ul></section>` : ''}
        ${fishingRows ? `<section><h4>Fishing</h4><ul>${fishingRows}</ul></section>` : ''}
      </div>
    `);
  }
}
