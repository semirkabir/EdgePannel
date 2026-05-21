import type { APTGroup, CyberThreat } from '@/types';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';

export function renderAPTPopup(apt: APTGroup): string {
  const threatColor = apt.threatLevel === 'critical' ? '#f87171'
    : apt.threatLevel === 'high' ? '#fb923c'
    : apt.threatLevel === 'medium' ? '#fbbf24'
    : '#6b7280';
  const threatLabel = (apt.threatLevel ?? 'unknown').toUpperCase();

  const targetsSection = apt.targets?.length
    ? `<div class="popup-section"><span class="section-label">Targets</span><div class="popup-tags">${apt.targets.map(t => `<span class="popup-tag">${escapeHtml(t)}</span>`).join('')}</div></div>`
    : '';
  const techniquesSection = apt.techniques?.length
    ? `<div class="popup-section"><span class="section-label">Techniques</span><div class="popup-tags">${apt.techniques.map(t => `<span class="popup-tag">${escapeHtml(t)}</span>`).join('')}</div></div>`
    : '';
  const opsSection = apt.knownOps?.length
    ? `<div class="popup-section"><span class="section-label">Known Operations</span><div class="popup-ops">${apt.knownOps.map(op =>
        op.url
          ? `<a class="popup-op-link" href="${escapeHtml(op.url)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(op.name)}</a>`
          : `<span class="popup-op-link">${escapeHtml(op.name)}</span>`
      ).join('')}</div></div>`
    : '';

  return `
    <div class="popup-header apt">
      <span class="popup-title">${escapeHtml(apt.name)}</span>
      <span class="popup-badge high" style="background:${threatColor}22;color:${threatColor};border-color:${threatColor}44">${threatLabel}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${t('popups.aka')}: ${escapeHtml(apt.aka)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.sponsor')}</span>
          <span class="stat-value">${escapeHtml(apt.sponsor)}</span>
        </div>
        ${apt.active ? `<div class="popup-stat"><span class="stat-label">Active</span><span class="stat-value">${escapeHtml(apt.active)}</span></div>` : ''}
      </div>
      ${apt.description ? `<p class="popup-description">${escapeHtml(apt.description)}</p>` : ''}
      ${targetsSection}
      ${techniquesSection}
      ${opsSection}
    </div>
  `;
}

export function renderCyberThreatPopup(threat: CyberThreat): string {
  const severityClass = escapeHtml(threat.severity);
  const sourceLabels: Record<string, string> = {
    feodo: 'Feodo Tracker',
    urlhaus: 'URLhaus',
    c2intel: 'C2 Intel Feeds',
    otx: 'AlienVault OTX',
    abuseipdb: 'AbuseIPDB',
  };
  const sourceLabel = sourceLabels[threat.source] || threat.source;
  const typeLabel = threat.type.replace(/_/g, ' ').toUpperCase();
  const tags = (threat.tags || []).slice(0, 6);

  return `
    <div class="popup-header apt ${severityClass}">
      <span class="popup-title">${t('popups.cyberThreat.title')}</span>
      <span class="popup-badge ${severityClass}">${escapeHtml(threat.severity.toUpperCase())}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(typeLabel)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${escapeHtml(threat.indicatorType.toUpperCase())}</span>
          <span class="stat-value">${escapeHtml(threat.indicator)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.country')}</span>
          <span class="stat-value">${escapeHtml(threat.country || t('popups.unknown'))}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.source')}</span>
          <span class="stat-value">${escapeHtml(sourceLabel)}</span>
        </div>
        ${threat.malwareFamily ? `<div class="popup-stat">
          <span class="stat-label">${t('popups.malware')}</span>
          <span class="stat-value">${escapeHtml(threat.malwareFamily)}</span>
        </div>` : ''}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.lastSeen')}</span>
          <span class="stat-value">${escapeHtml(threat.lastSeen ? new Date(threat.lastSeen).toLocaleString() : t('popups.unknown'))}</span>
        </div>
      </div>
      ${tags.length > 0 ? `
      <div class="popup-tags">
        ${tags.map((tag) => `<span class="popup-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>` : ''}
    </div>
  `;
}
