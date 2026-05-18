import { Panel } from './Panel';
import { escapeHtml } from '@/utils/sanitize';
import { getRecentAlerts, type UnifiedAlert } from '@/services/cross-module-integration';

function formatRelativeTime(date: Date): string {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function alertComponentLabels(alert: UnifiedAlert): string[] {
  const labels: string[] = [];
  if (alert.components.convergence) labels.push('geo convergence');
  if (alert.components.ciiChange) labels.push('country instability');
  if (alert.components.cascade) labels.push('infrastructure');
  if (alert.components.supplemental) labels.push(alert.components.supplemental.sourceName);
  return labels;
}

export class IncidentBriefsPanel extends Panel {
  private alerts: UnifiedAlert[] = [];
  private readonly onIntelligenceUpdated = () => this.refresh();

  constructor() {
    super({
      id: 'incident-briefs',
      title: 'Incident Briefs',
      showCount: true,
      trackActivity: true,
    });
    document.addEventListener('wm:intelligence-updated', this.onIntelligenceUpdated);
    this.refresh();
  }

  public refresh(): void {
    this.alerts = getRecentAlerts(24);
    this.setCount(this.alerts.length);
    this.render();
  }

  private render(): void {
    if (this.alerts.length === 0) {
      this.setContent(`
        <div class="incident-briefs-empty">
          <strong>No active briefs yet</strong>
          <span>Composite alerts will appear here when multiple signals converge.</span>
        </div>
      `);
      return;
    }

    const cards = this.alerts.slice(0, 6).map((alert) => {
      const components = alertComponentLabels(alert);
      const countries = alert.countries.slice(0, 3).join(', ');
      return `
        <article class="incident-brief-card priority-${escapeHtml(alert.priority)}">
          <div class="incident-brief-head">
            <span class="incident-brief-priority">${escapeHtml(alert.priority)}</span>
            <span>${formatRelativeTime(alert.timestamp)}</span>
          </div>
          <h3>${escapeHtml(alert.title)}</h3>
          <p>${escapeHtml(alert.summary)}</p>
          <div class="incident-brief-meta">
            ${countries ? `<span>${escapeHtml(countries)}</span>` : ''}
            ${components.map((component) => `<span>${escapeHtml(component)}</span>`).join('')}
          </div>
        </article>
      `;
    }).join('');

    this.setContent(`<div class="incident-brief-grid">${cards}</div>`);
  }

  public override destroy(): void {
    document.removeEventListener('wm:intelligence-updated', this.onIntelligenceUpdated);
    super.destroy();
  }
}
