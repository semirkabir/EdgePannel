import type { AisDisruptionEvent, SocialUnrestEvent, NaturalEvent, GulfInvestment } from '@/types';
import type { AisPositionData } from '@/services/maritime';

import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { getNaturalEventIcon } from '@/services/eonet';
import type { ProtestClusterData } from './types';

function stat(label: string, value: string): string {
  return `<div class="popup-stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}
function pbadge(text: string, cls: string): string {
  return `<span class="popup-badge ${cls}">${text}</span>`;
}
function section(title: string, content: string): string {
  return `<div class="popup-section"><span class="section-label">${title}</span>${content}</div>`;
}
function tags(items: string[]): string {
  return `<div class="popup-tags">${items.map(i => `<span class="popup-tag">${i}</span>`).join('')}</div>`;
}
function sanitizeClassToken(value: string | undefined, fallback = 'unknown'): string {
  const token = String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '').replace(/^[^A-Za-z_]/, '');
  return token || fallback;
}
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t('popups.timeAgo.s', { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('popups.timeAgo.m', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('popups.timeAgo.h', { count: hours });
  const days = Math.floor(hours / 24);
  return t('popups.timeAgo.d', { count: days });
}
function normalizeSeverity(s: string): 'high' | 'medium' | 'low' {
  const v = (s || '').trim().toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  return 'low';
}

export function renderProtestPopup(event: SocialUnrestEvent): string {
  const severityClass = escapeHtml(event.severity);
  const severityLabel = escapeHtml(event.severity.toUpperCase());
  const eventTypeLabel = escapeHtml(event.eventType.replace('_', ' ').toUpperCase());
  const icon = event.eventType === 'riot' ? '🔥' : event.eventType === 'strike' ? '✊' : '📢';
  const sourceLabel = event.sourceType === 'acled' ? t('popups.protest.acledVerified') : t('popups.protest.gdelt');
  const validatedBadge = event.validated ? `<span class="popup-badge verified">${t('popups.verified')}</span>` : '';
  const fatalitiesSection = event.fatalities
    ? `<div class="popup-stat"><span class="stat-label">${t('popups.fatalities')}</span><span class="stat-value alert">${event.fatalities}</span></div>`
    : '';
  const actorsSection = event.actors?.length
    ? `<div class="popup-stat"><span class="stat-label">${t('popups.actors')}</span><span class="stat-value">${event.actors.map(a => escapeHtml(a)).join(', ')}</span></div>`
    : '';
  const tagsSection = event.tags?.length
    ? `<div class="popup-tags">${event.tags.map(t => `<span class="popup-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  const relatedHotspots = event.relatedHotspots?.length
    ? `<div class="popup-related">${t('popups.near')}: ${event.relatedHotspots.map(h => escapeHtml(h)).join(', ')}</div>`
    : '';

  return `
    <div class="popup-header protest ${severityClass}">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title">${eventTypeLabel}</span>
      <span class="popup-badge ${severityClass}">${severityLabel}</span>
      ${validatedBadge}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${event.city ? `${escapeHtml(event.city)}, ` : ''}${escapeHtml(event.country)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.time')}</span>
          <span class="stat-value">${event.time.toLocaleDateString()}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.source')}</span>
          <span class="stat-value">${sourceLabel}</span>
        </div>
        ${fatalitiesSection}
        ${actorsSection}
      </div>
      ${event.title ? `<p class="popup-description">${escapeHtml(event.title)}</p>` : ''}
      ${tagsSection}
      ${relatedHotspots}
    </div>
  `;
}

export function renderProtestClusterPopup(data: ProtestClusterData): string {
  const totalCount = data.count ?? data.items.length;
  const riots = data.riotCount ?? data.items.filter(e => e.eventType === 'riot').length;
  const highSeverity = data.highSeverityCount ?? data.items.filter(e => e.severity === 'high').length;
  const verified = data.verifiedCount ?? data.items.filter(e => e.validated).length;
  const totalFatalities = data.totalFatalities ?? data.items.reduce((sum, e) => sum + (e.fatalities || 0), 0);

  const sortedItems = [...data.items].sort((a, b) => {
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const typeOrder: Record<string, number> = { riot: 0, civil_unrest: 1, strike: 2, demonstration: 3, protest: 4 };
    const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;
    return (typeOrder[a.eventType] ?? 5) - (typeOrder[b.eventType] ?? 5);
  });

  const listItems = sortedItems.slice(0, 10).map(event => {
    const icon = event.eventType === 'riot' ? '🔥' : event.eventType === 'strike' ? '✊' : '📢';
    const sevClass = event.severity;
    const dateStr = event.time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const city = event.city ? escapeHtml(event.city) : '';
    const title = event.title ? `: ${escapeHtml(event.title.slice(0, 40))}${event.title.length > 40 ? '...' : ''}` : '';
    return `<li class="cluster-item ${sevClass}">${icon} ${dateStr}${city ? ` • ${city}` : ''}${title}</li>`;
  }).join('');

  const renderedCount = Math.min(10, data.items.length);
  const remainingCount = Math.max(0, totalCount - renderedCount);
  const moreCount = remainingCount > 0 ? `<li class="cluster-more">+${remainingCount} ${t('popups.moreEvents')}</li>` : '';
  const headerClass = highSeverity > 0 ? 'high' : riots > 0 ? 'medium' : 'low';

  return `
    <div class="popup-header protest ${headerClass} cluster">
      <span class="popup-title">📢 ${escapeHtml(data.country)}</span>
      <span class="popup-badge">${totalCount} ${t('popups.events').toUpperCase()}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body cluster-popup">
      <div class="cluster-summary">
        ${riots ? `<span class="summary-item riot">🔥 ${riots} ${t('popups.protest.riots')}</span>` : ''}
        ${highSeverity ? `<span class="summary-item high">⚠️ ${highSeverity} ${t('popups.protest.highSeverity')}</span>` : ''}
        ${verified ? `<span class="summary-item verified">✓ ${verified} ${t('popups.verified')}</span>` : ''}
        ${totalFatalities > 0 ? `<span class="summary-item fatalities">💀 ${totalFatalities} ${t('popups.fatalities')}</span>` : ''}
      </div>
      <ul class="cluster-list">${listItems}${moreCount}</ul>
      ${data.sampled ? `<p class="popup-more">${t('popups.sampledList', { count: data.items.length })}</p>` : ''}
    </div>
  `;
}

export function renderAisPopup(event: AisDisruptionEvent): string {
  const severityClass = escapeHtml(event.severity);
  const severityLabel = escapeHtml(event.severity.toUpperCase());
  const typeLabel = event.type === 'gap_spike' ? t('popups.aisGapSpike') : t('popups.chokepointCongestion');
  const changeLabel = event.type === 'gap_spike' ? t('popups.darkening') : t('popups.density');
  const countLabel = event.type === 'gap_spike' ? t('popups.darkShips') : t('popups.vesselCount');
  const countValue = event.type === 'gap_spike'
    ? event.darkShips?.toString() || '—'
    : event.vesselCount?.toString() || '—';

  return `
    <div class="popup-header ais">
      <span class="popup-title">${escapeHtml(event.name.toUpperCase())}</span>
      <span class="popup-badge ${severityClass}">${severityLabel}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${typeLabel}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${changeLabel}</span>
          <span class="stat-value">${event.changePct}% ↑</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${countLabel}</span>
          <span class="stat-value">${countValue}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.window')}</span>
          <span class="stat-value">${event.windowHours}H</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.region')}</span>
          <span class="stat-value">${escapeHtml(event.region || `${event.lat.toFixed(2)}°, ${event.lon.toFixed(2)}°`)}</span>
        </div>
      </div>
      <p class="popup-description">${escapeHtml(event.description)}</p>
    </div>
  `;
}

export function renderAisVesselPopup(vessel: AisPositionData): string {
  const name = escapeHtml(vessel.name || `MMSI ${vessel.mmsi}`);
  const mmsi = escapeHtml(vessel.mmsi);
  const shipTypeName = (() => {
    const st = vessel.shipType ?? 0;
    if (st >= 80 && st <= 89) return 'Tanker';
    if (st >= 70 && st <= 79) return 'Cargo';
    if (st >= 60 && st <= 69) return 'Passenger';
    if (st >= 40 && st <= 49) return 'High Speed';
    if (st === 37) return 'Pleasure Craft';
    if (st === 36 || st === 35) return 'Military';
    if (st === 52) return 'Tug';
    if (st === 51) return 'SAR';
    if (st === 30) return 'Fishing';
    if (st > 0) return `Type ${st}`;
    return 'Vessel';
  })();
  const speedStr = vessel.speed != null ? `${vessel.speed.toFixed(1)} kts` : '—';
  const headingVal = vessel.heading != null && vessel.heading >= 0 && vessel.heading <= 360
    ? vessel.heading
    : vessel.course;
  const headingStr = headingVal != null ? `${Math.round(headingVal)}°` : '—';
  const coordStr = `${vessel.lat.toFixed(4)}°, ${vessel.lon.toFixed(4)}°`;

  return `
    <div class="popup-header ais">
      <span class="popup-title">🚢 ${name}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(shipTypeName)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">Speed</span>
          <span class="stat-value">${speedStr}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">Heading</span>
          <span class="stat-value">${headingStr}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">MMSI</span>
          <span class="stat-value">${mmsi}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">Position</span>
          <span class="stat-value">${coordStr}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderNaturalEventPopup(event: NaturalEvent): string {
  const categoryColors: Record<string, string> = {
    severeStorms: 'high',
    wildfires: 'high',
    volcanoes: 'high',
    earthquakes: 'elevated',
    floods: 'elevated',
    landslides: 'elevated',
    drought: 'medium',
    dustHaze: 'low',
    snow: 'low',
    tempExtremes: 'elevated',
    seaLakeIce: 'low',
    waterColor: 'low',
    manmade: 'elevated',
  };
  const icon = getNaturalEventIcon(event.category);
  const severityClass = categoryColors[event.category] || 'low';
  const categoryClass = sanitizeClassToken(event.category, 'manmade');
  const timeAgo = getTimeAgo(event.date);

  return `
    <div class="popup-header nat-event ${categoryClass}">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title">${escapeHtml(event.categoryTitle.toUpperCase())}</span>
      <span class="popup-badge ${severityClass}">${event.closed ? t('popups.naturalEvent.closed') : t('popups.naturalEvent.active')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(event.title)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.naturalEvent.reported')}</span>
          <span class="stat-value">${timeAgo}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${event.lat.toFixed(2)}°, ${event.lon.toFixed(2)}°</span>
        </div>
        ${event.magnitude ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.magnitude')}</span>
          <span class="stat-value">${event.magnitude}${event.magnitudeUnit ? ` ${escapeHtml(event.magnitudeUnit)}` : ''}</span>
        </div>
        ` : ''}
        ${event.sourceName ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.source')}</span>
          <span class="stat-value">${escapeHtml(event.sourceName)}</span>
        </div>
        ` : ''}
      </div>
      ${event.description ? `<p class="popup-description">${escapeHtml(event.description)}</p>` : ''}
      ${event.sourceUrl ? `<a href="${event.sourceUrl}" target="_blank" class="popup-link">${t('popups.naturalEvent.viewOnSource', { source: escapeHtml(event.sourceName || t('popups.source')) })} →</a>` : ''}
      <div class="popup-attribution">${t('popups.naturalEvent.attribution')}</div>
    </div>
  `;
}

export function renderIranEventPopup(event: import('./types').IranEventPopupData): string {
  const severity = normalizeSeverity(event.severity);
  const timeAgo = event.timestamp ? getTimeAgo(new Date(event.timestamp)) : '';

  const relatedHtml = event.relatedEvents && event.relatedEvents.length > 0 ? `
      <div class="popup-section">
        <span class="section-label">${t('popups.iranEvent.relatedEvents')}</span>
        <ul class="cluster-list">
          ${event.relatedEvents.map(r => {
    const rSev = normalizeSeverity(r.severity);
    const rTime = r.timestamp ? getTimeAgo(new Date(r.timestamp)) : '';
    const rTitle = r.title.length > 60 ? r.title.slice(0, 60) + '…' : r.title;
    return `<li class="cluster-item"><span class="popup-badge ${rSev}" style="font-size:9px;padding:1px 4px;">${escapeHtml(rSev.toUpperCase())}</span> ${escapeHtml(rTitle)}${rTime ? ` <span style="color:var(--text-muted);font-size:10px;">${escapeHtml(rTime)}</span>` : ''}</li>`;
  }).join('')}
        </ul>
      </div>` : '';

  return `
    <div class="popup-header iranEvent ${severity}">
      <span class="popup-title">${escapeHtml(event.title)}</span>
      <span class="popup-badge ${severity}">${escapeHtml(severity.toUpperCase())}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${escapeHtml(event.category)}</span>
        </div>
        ${event.locationName ? `<div class="popup-stat">
          <span class="stat-label">${t('popups.location')}</span>
          <span class="stat-value">${escapeHtml(event.locationName)}</span>
        </div>` : ''}
        ${timeAgo ? `<div class="popup-stat">
          <span class="stat-label">${t('popups.time')}</span>
          <span class="stat-value">${escapeHtml(timeAgo)}</span>
        </div>` : ''}
      </div>
      ${relatedHtml}
      ${event.sourceUrl ? `<a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow" class="popup-link">${t('popups.source')} →</a>` : ''}
    </div>
  `;
}

export function renderGpsJammingPopup(data: import('./types').GpsJammingPopupData): string {
  const isHigh = data.level === 'high';
  const badgeClass = isHigh ? 'critical' : 'medium';
  const headerColor = isHigh ? '#ff5050' : '#ffb432';
  return `
    <div class="popup-header" style="background:${headerColor}">
      <span class="popup-title">${t('popups.gpsJamming.title')}</span>
      <span class="popup-badge ${badgeClass}">${escapeHtml(data.level.toUpperCase())}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.gpsJamming.interference')}</span>
          <span class="stat-value">${data.pct}%</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.gpsJamming.aircraftAffected')}</span>
          <span class="stat-value">${data.bad} / ${data.total}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.gpsJamming.aircraftNormal')}</span>
          <span class="stat-value">${data.good}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.gpsJamming.h3Hex')}</span>
          <span class="stat-value" style="font-size:10px">${escapeHtml(data.h3)}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderTechActivityPopup(activity: import('@/services/tech-activity').TechHubActivity): string {
  const icon = activity.hasBreaking ? '🔥' : activity.trend === 'rising' ? '📈' : '📰';
  return `
    <div class="popup-header tech-activity">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title">${escapeHtml(activity.name)}</span>
      ${pbadge(activity.activityLevel.toUpperCase(), activity.activityLevel)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(activity.city)}, ${escapeHtml(activity.country)}</div>
      <div class="popup-stats">
        ${stat('Score', `${activity.score}/100`)}
        ${stat('News', `${activity.newsCount} articles`)}
        ${stat('Trend', activity.trend.charAt(0).toUpperCase() + activity.trend.slice(1))}
      </div>
      ${activity.topStories.length > 0 && activity.topStories[0] ? `<p class="popup-description">${escapeHtml(activity.topStories[0].title)}</p>` : ''}
    </div>
  `;
}

export function renderGeoActivityPopup(activity: import('@/services/geo-activity').GeoHubActivity): string {
  const icon = activity.hasBreaking ? '🔥' : activity.trend === 'rising' ? '📈' : '📰';
  return `
    <div class="popup-header geo-activity">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title">${escapeHtml(activity.name)}</span>
      ${pbadge(activity.activityLevel.toUpperCase(), activity.activityLevel)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(activity.region)} • ${escapeHtml(activity.country)}</div>
      <div class="popup-stats">
        ${stat('Score', `${activity.score}/100`)}
        ${stat('News', `${activity.newsCount} articles`)}
        ${stat('Trend', activity.trend.charAt(0).toUpperCase() + activity.trend.slice(1))}
      </div>
      ${activity.topStories.length > 0 && activity.topStories[0] ? `<p class="popup-description">${escapeHtml(activity.topStories[0].title)}</p>` : ''}
    </div>
  `;
}

export function renderGulfInvestmentPopup(inv: GulfInvestment): string {
  const flag = inv.investingCountry === 'SA' ? '🇸🇦' : '🇦🇪';
  const usd = inv.investmentUSD != null
    ? (inv.investmentUSD >= 1000 ? `$${(inv.investmentUSD / 1000).toFixed(1)}B` : `$${inv.investmentUSD}M`)
    : t('components.investments.undisclosed');
  const statusColors: Record<string, string> = {
    'operational': 'normal', 'under-construction': 'medium', 'announced': 'low',
    'rumoured': 'low', 'cancelled': 'high', 'divested': '',
  };
  const badgeClass = statusColors[inv.status] ?? '';
  return `
    <div class="popup-header gcc-investment">
      <span class="popup-title">${flag} ${escapeHtml(inv.assetName)}</span>
      ${pbadge(escapeHtml(inv.status.toUpperCase()), badgeClass)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.location'), `${escapeHtml(inv.targetCountry)}`)}
        ${stat(t('components.investments.asset'), escapeHtml(inv.assetType))}
        ${stat(t('components.investments.investment'), usd)}
        ${inv.stakePercent != null ? stat('Stake', `${inv.stakePercent}%`) : ''}
        ${inv.yearAnnounced != null ? stat(t('components.investments.year'), String(inv.yearAnnounced)) : ''}
      </div>
      ${section(t('components.investments.allEntities'), tags([escapeHtml(inv.investingEntity)]))}
      ${section(t('components.investments.allSectors'), tags([escapeHtml(inv.sector)]))}
      ${inv.description ? `<p class="popup-description">${escapeHtml(inv.description)}</p>` : ''}
      ${inv.sourceUrl ? `<a href="${escapeHtml(inv.sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow" class="popup-link">${t('popups.source')} →</a>` : ''}
    </div>
  `;
}
