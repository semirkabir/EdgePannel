import type { ConflictZone, Hotspot, NuclearFacility, EconomicCenter, GammaIrradiator, Pipeline, StrategicWaterway, SanctionedAsset } from '@/types';
import type { PositiveGeoEvent } from '@/services/positive-events-geo';
import type { KindnessPoint } from '@/services/kindness-data';
import type { SpeciesRecovery } from '@/services/conservation-data';
import type { RenewableInstallation } from '@/services/renewable-installations';
import type { Earthquake } from '@/services/earthquakes';
import type { WeatherAlert } from '@/services/weather';
import type { NewsItem } from '@/types';
import type { GdeltArticle } from '@/services/gdelt-intel';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { getCSSColor } from '@/utils';
import { t } from '@/services/i18n';
import { formatArticleDate, extractDomain } from '@/services/gdelt-intel';
import { buildArticleLinkAttributes } from '@/services/article-open';
import { getHotspotEscalation, getEscalationChange24h } from '@/services/hotspot-escalation';

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
function list(items: string[]): string {
  return `<ul class="popup-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
}
function externalLink(url: string, className: string, labelHtml: string): string {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) {
    return `<span class="${className} disabled-link">${labelHtml}</span>`;
  }
  return `<a href="${safeUrl}" target="_blank" rel="noopener" class="${className}">${labelHtml}</a>`;
}
function articleLink(url: string, title: string, source: string | undefined, publishedAt: string | Date | undefined, className: string, labelHtml: string): string {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) {
    return `<span class="${className} disabled-link">${labelHtml}</span>`;
  }
  const attrs = buildArticleLinkAttributes({ url: safeUrl, title, source, publishedAt });
  return `<a href="${safeUrl}" target="_blank" rel="noopener" class="${className}" ${attrs}>${labelHtml}</a>`;
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
function getTimeUntil(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return t('popups.expired');
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(ms / (1000 * 60))}${t('popups.timeUnits.m')}`;
  if (hours < 24) return `${hours}${t('popups.timeUnits.h')}`;
  return `${Math.floor(hours / 24)}${t('popups.timeUnits.d')}`;
}
function getLocalizedHotspotSubtext(subtext: string): string {
  const slug = subtext
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const key = `popups.hotspotSubtexts.${slug}`;
  const localized = t(key);
  return localized === key ? subtext : localized;
}
function getMarketStatus(hours: { open: string; close: string; timezone: string }): 'open' | 'closed' | 'unknown' {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: hours.timezone,
    });
    const currentTime = formatter.format(now);
    const [openH = 0, openM = 0] = hours.open.split(':').map(Number);
    const [closeH = 0, closeM = 0] = hours.close.split(':').map(Number);
    const [currH = 0, currM = 0] = currentTime.split(':').map(Number);
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;
    const currMins = currH * 60 + currM;
    if (currMins >= openMins && currMins < closeMins) {
      return 'open';
    }
    return 'closed';
  } catch {
    return 'unknown';
  }
}

export function renderConflictPopup(conflict: ConflictZone): string {
  const severityClass = conflict.intensity === 'high' ? 'high' : conflict.intensity === 'medium' ? 'medium' : 'low';
  return `
    <div class="popup-header conflict">
      <span class="popup-title">${escapeHtml(conflict.name.toUpperCase())}</span>
      ${pbadge(escapeHtml(conflict.intensity?.toUpperCase() || t('popups.unknown').toUpperCase()), severityClass)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.startDate'), escapeHtml(conflict.startDate || t('popups.unknown')))}
        ${stat(t('popups.casualties'), escapeHtml(conflict.casualties || t('popups.unknown')))}
        ${stat(t('popups.displaced'), escapeHtml(conflict.displaced || t('popups.unknown')))}
        ${stat(t('popups.location'), escapeHtml(conflict.location || `${conflict.center[1]}°N, ${conflict.center[0]}°E`))}
      </div>
      ${conflict.description ? `<p class="popup-description">${escapeHtml(conflict.description)}</p>` : ''}
      ${conflict.parties?.length ? section(t('popups.belligerents'), tags(conflict.parties.map(p => escapeHtml(p)))) : ''}
      ${conflict.keyDevelopments?.length ? section(t('popups.keyDevelopments'), list(conflict.keyDevelopments.map(d => escapeHtml(d)))) : ''}
    </div>
  `;
}

export function renderHotspotPopup(hotspot: Hotspot, relatedNews?: NewsItem[]): string {
  const severityClass = hotspot.level || 'low';
  const severityLabel = escapeHtml((hotspot.level || 'low').toUpperCase());
  const localizedSubtext = hotspot.subtext ? getLocalizedHotspotSubtext(hotspot.subtext) : '';

  const dynamicScore = getHotspotEscalation(hotspot.id);
  const change24h = getEscalationChange24h(hotspot.id);

  const escalationColors: Record<number, string> = {
    1: getCSSColor('--semantic-normal'),
    2: getCSSColor('--semantic-normal'),
    3: getCSSColor('--semantic-elevated'),
    4: getCSSColor('--semantic-high'),
    5: getCSSColor('--semantic-critical'),
  };
  const escalationLabels: Record<number, string> = {
    1: t('popups.hotspot.levels.stable'),
    2: t('popups.hotspot.levels.watch'),
    3: t('popups.hotspot.levels.elevated'),
    4: t('popups.hotspot.levels.high'),
    5: t('popups.hotspot.levels.critical')
  };
  const trendIcons: Record<string, string> = { 'escalating': '↑', 'stable': '→', 'de-escalating': '↓' };
  const trendColors: Record<string, string> = { 'escalating': getCSSColor('--semantic-critical'), 'stable': getCSSColor('--semantic-elevated'), 'de-escalating': getCSSColor('--semantic-normal') };

  const displayScore = dynamicScore?.combinedScore ?? hotspot.escalationScore ?? 3;
  const displayScoreInt = Math.round(displayScore);
  const displayTrend = dynamicScore?.trend ?? hotspot.escalationTrend ?? 'stable';

  const escalationSection = `
    <div class="popup-section escalation-section">
      <span class="section-label">${t('popups.hotspot.escalation')}</span>
      <div class="escalation-display">
        <div class="escalation-score" style="background: ${escalationColors[displayScoreInt] || getCSSColor('--text-dim')}">
          <span class="score-value">${displayScore.toFixed(1)}/5</span>
          <span class="score-label">${escalationLabels[displayScoreInt] || t('popups.unknown')}</span>
        </div>
        <div class="escalation-trend" style="color: ${trendColors[displayTrend] || getCSSColor('--text-dim')}">
          <span class="trend-icon">${trendIcons[displayTrend] || ''}</span>
          <span class="trend-label">${escapeHtml(displayTrend.toUpperCase())}</span>
        </div>
      </div>
      ${dynamicScore ? `
        <div class="escalation-breakdown">
          <div class="breakdown-header">
            <span class="baseline-label">${t('popups.hotspot.baseline')}: ${dynamicScore.staticBaseline}/5</span>
            ${change24h ? `
              <span class="change-label ${change24h.change >= 0 ? 'rising' : 'falling'}">
                24h: ${change24h.change >= 0 ? '+' : ''}${change24h.change}
              </span>
            ` : ''}
          </div>
          <div class="breakdown-components">
            <div class="breakdown-row">
              <span class="component-label">${t('popups.hotspot.components.news')}</span>
              <div class="component-bar-bg">
                <div class="component-bar news" style="width: ${dynamicScore.components.newsActivity}%"></div>
              </div>
              <span class="component-value">${Math.round(dynamicScore.components.newsActivity)}</span>
            </div>
            <div class="breakdown-row">
              <span class="component-label">${t('popups.hotspot.components.cii')}</span>
              <div class="component-bar-bg">
                <div class="component-bar cii" style="width: ${dynamicScore.components.ciiContribution}%"></div>
              </div>
              <span class="component-value">${Math.round(dynamicScore.components.ciiContribution)}</span>
            </div>
            <div class="breakdown-row">
              <span class="component-label">${t('popups.hotspot.components.geo')}</span>
              <div class="component-bar-bg">
                <div class="component-bar geo" style="width: ${dynamicScore.components.geoConvergence}%"></div>
              </div>
              <span class="component-value">${Math.round(dynamicScore.components.geoConvergence)}</span>
            </div>
            <div class="breakdown-row">
              <span class="component-label">${t('popups.hotspot.components.military')}</span>
              <div class="component-bar-bg">
                <div class="component-bar military" style="width: ${dynamicScore.components.militaryActivity}%"></div>
              </div>
              <span class="component-value">${Math.round(dynamicScore.components.militaryActivity)}</span>
            </div>
          </div>
        </div>
      ` : ''}
      ${hotspot.escalationIndicators && hotspot.escalationIndicators.length > 0 ? `
        <div class="escalation-indicators">
          ${hotspot.escalationIndicators.map(i => `<span class="indicator-tag">• ${escapeHtml(i)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  const historySection = hotspot.history ? `
    <div class="popup-section history-section">
      <span class="section-label">${t('popups.historicalContext')}</span>
      <div class="history-content">
        ${hotspot.history.lastMajorEvent ? `
          <div class="history-event">
            <span class="history-label">${t('popups.lastMajorEvent')}:</span>
            <span class="history-value">${escapeHtml(hotspot.history.lastMajorEvent)} ${hotspot.history.lastMajorEventDate ? `(${escapeHtml(hotspot.history.lastMajorEventDate)})` : ''}</span>
          </div>
        ` : ''}
        ${hotspot.history.precedentDescription ? `
          <div class="history-event">
            <span class="history-label">${t('popups.precedents')}:</span>
            <span class="history-value">${escapeHtml(hotspot.history.precedentDescription)}</span>
          </div>
        ` : ''}
        ${hotspot.history.cyclicalRisk ? `
          <div class="history-event cyclical">
            <span class="history-label">${t('popups.cyclicalPattern')}:</span>
            <span class="history-value">${escapeHtml(hotspot.history.cyclicalRisk)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  const whyItMattersSection = hotspot.whyItMatters ? `
    <div class="popup-section why-matters-section">
      <span class="section-label">${t('popups.whyItMatters')}</span>
      <p class="why-matters-text">${escapeHtml(hotspot.whyItMatters)}</p>
    </div>
  ` : '';

  const displayTitle = localizedSubtext || hotspot.name;
  const showCodeBadge = localizedSubtext && hotspot.name.toUpperCase() !== localizedSubtext.toUpperCase();

  return `
    <div class="popup-header hotspot ${severityClass}">
      <div class="popup-title-block">
        <span class="popup-title">${escapeHtml(displayTitle.toUpperCase())}</span>
        ${showCodeBadge ? `<span class="popup-code">${escapeHtml(hotspot.name)}</span>` : ''}
      </div>
      <span class="popup-badge ${severityClass}">${severityLabel}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      ${hotspot.description ? `<p class="popup-description">${escapeHtml(hotspot.description)}</p>` : ''}
      ${escalationSection}
      <div class="popup-stats">
        ${hotspot.location ? `
          <div class="popup-stat">
            <span class="stat-label">${t('popups.location')}</span>
            <span class="stat-value">${escapeHtml(hotspot.location)}</span>
          </div>
        ` : ''}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${escapeHtml(`${hotspot.lat.toFixed(2)}°N, ${hotspot.lon.toFixed(2)}°E`)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.status')}</span>
          <span class="stat-value">${escapeHtml(hotspot.status || t('popups.monitoring'))}</span>
        </div>
      </div>
      ${whyItMattersSection}
      ${historySection}
      ${hotspot.agencies && hotspot.agencies.length > 0 ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.keyEntities')}</span>
          <div class="popup-tags">
            ${hotspot.agencies.map(a => `<span class="popup-tag">${escapeHtml(a)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      ${relatedNews && relatedNews.length > 0 ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.relatedHeadlines')}</span>
          <div class="popup-news">
            ${relatedNews.slice(0, 5).map(n => `
              <div class="popup-news-item">
                <span class="news-source">${escapeHtml(n.source)}</span>
                ${articleLink(n.link, n.title, n.source, n.pubDate, 'news-title', escapeHtml(n.title))}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <div class="hotspot-gdelt-context" data-hotspot-id="${escapeHtml(hotspot.id)}">
        <div class="hotspot-gdelt-header">${t('popups.liveIntel')}</div>
        <div class="hotspot-gdelt-loading">${t('popups.loadingNews')}</div>
      </div>
    </div>
  `;
}

export function renderGdeltArticle(article: GdeltArticle): string {
  const domain = article.source || extractDomain(article.url);
  const timeAgo = formatArticleDate(article.date);

  return `
    ${articleLink(article.url, article.title, domain, article.date, 'hotspot-gdelt-article', `
      <div class="article-meta">
        <span>${escapeHtml(domain)}</span>
        <span>${escapeHtml(timeAgo)}</span>
      </div>
      <div class="article-title">${escapeHtml(article.title)}</div>
    `)}
  `;
}

export function renderEarthquakePopup(earthquake: Earthquake): string {
  const severity = earthquake.magnitude >= 6 ? 'high' : earthquake.magnitude >= 5 ? 'medium' : 'low';
  const severityLabel = earthquake.magnitude >= 6 ? t('popups.earthquake.levels.major') : earthquake.magnitude >= 5 ? t('popups.earthquake.levels.moderate') : t('popups.earthquake.levels.minor');
  const timeAgo = getTimeAgo(new Date(earthquake.occurredAt));

  return `
    <div class="popup-header earthquake">
      <span class="popup-title magnitude">M${earthquake.magnitude.toFixed(1)}</span>
      <span class="popup-badge ${severity}">${severityLabel}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <p class="popup-location">${escapeHtml(earthquake.place)}</p>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.depth')}</span>
          <span class="stat-value">${earthquake.depthKm.toFixed(1)} km</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${(earthquake.location?.latitude ?? 0).toFixed(2)}°, ${(earthquake.location?.longitude ?? 0).toFixed(2)}°</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.time')}</span>
          <span class="stat-value">${timeAgo}</span>
        </div>
      </div>
      ${externalLink(earthquake.sourceUrl, 'popup-link', `${t('popups.viewUSGS')} →`)}
    </div>
  `;
}

export function renderWeatherPopup(alert: WeatherAlert): string {
  const severityClass = escapeHtml(alert.severity.toLowerCase());
  const expiresIn = getTimeUntil(alert.expires);

  return `
    <div class="popup-header weather ${severityClass}">
      <span class="popup-title">${escapeHtml(alert.event.toUpperCase())}</span>
      <span class="popup-badge ${severityClass}">${escapeHtml(alert.severity.toUpperCase())}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <p class="popup-headline">${escapeHtml(alert.headline)}</p>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.area')}</span>
          <span class="stat-value">${escapeHtml(alert.areaDesc)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.expires')}</span>
          <span class="stat-value">${expiresIn}</span>
        </div>
      </div>
      <p class="popup-description">${escapeHtml(alert.description.slice(0, 300))}${alert.description.length > 300 ? '...' : ''}</p>
    </div>
  `;
}

export function renderBasePopup(base: import('@/types').MilitaryBase): string {
  const typeLabels: Record<string, string> = {
    'us-nato': t('popups.base.types.us-nato'),
    'china': t('popups.base.types.china'),
    'russia': t('popups.base.types.russia'),
  };
  const typeColors: Record<string, string> = {
    'us-nato': 'elevated',
    'china': 'high',
    'russia': 'high',
  };

  const enriched = base as import('@/types').MilitaryBase & { kind?: string; catAirforce?: boolean; catNaval?: boolean; catNuclear?: boolean; catSpace?: boolean; catTraining?: boolean };
  const categories: string[] = [];
  if (enriched.catAirforce) categories.push('Air Force');
  if (enriched.catNaval) categories.push('Naval');
  if (enriched.catNuclear) categories.push('Nuclear');
  if (enriched.catSpace) categories.push('Space');
  if (enriched.catTraining) categories.push('Training');

  const ciiScore = base._enrichCii;
  const ciiColor = ciiScore ? (ciiScore.level === 'critical' || ciiScore.level === 'high' ? '#f87171' : ciiScore.level === 'elevated' ? '#fbbf24' : '#4ade80') : null;
  const nearbyConflicts = base._enrichNearbyConflicts ?? [];

  return `
    <div class="popup-header base">
      <span class="popup-title">${escapeHtml(base.name.toUpperCase())}</span>
      <span class="popup-badge ${typeColors[base.type] || 'low'}">${escapeHtml(typeLabels[base.type] || base.type.toUpperCase())}</span>
      ${nearbyConflicts.length > 0 ? pbadge('ACTIVE CONFLICT ZONE', 'high') : ''}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      ${base.description ? `<p class="popup-description">${escapeHtml(base.description)}</p>` : ''}
      ${enriched.kind ? `<p class="popup-description" style="opacity:0.7;margin-top:2px">${escapeHtml(enriched.kind.replace(/_/g, ' '))}</p>` : ''}
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${escapeHtml(typeLabels[base.type] || base.type)}</span>
        </div>
        ${base.arm ? `<div class="popup-stat"><span class="stat-label">Branch</span><span class="stat-value">${escapeHtml(base.arm)}</span></div>` : ''}
        ${base.country ? `<div class="popup-stat"><span class="stat-label">Country</span><span class="stat-value">${escapeHtml(base.country)}</span></div>` : ''}
        ${categories.length > 0 ? `<div class="popup-stat"><span class="stat-label">Categories</span><span class="stat-value">${escapeHtml(categories.join(', '))}</span></div>` : ''}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${base.lat.toFixed(2)}°, ${base.lon.toFixed(2)}°</span>
        </div>
        ${ciiScore ? stat('Country Stability', `<span style="color:${ciiColor}">${escapeHtml(ciiScore.level.toUpperCase())} (${ciiScore.score.toFixed(0)}/100)</span>`) : ''}
      </div>
      ${nearbyConflicts.length > 0 ? section('Nearby Conflicts (500km)', `<div class="popup-tags">${nearbyConflicts.map(c => `<span class="popup-tag">${escapeHtml(c.type)} · ${c.deaths} deaths · ${c.distKm}km</span>`).join('')}</div>`) : ''}
    </div>
  `;
}

export function renderWaterwayPopup(waterway: StrategicWaterway): string {
  return `
    <div class="popup-header waterway">
      <span class="popup-title">${escapeHtml(waterway.name)}</span>
      <span class="popup-badge elevated">${t('popups.strategic')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      ${waterway.description ? `<p class="popup-description">${escapeHtml(waterway.description)}</p>` : ''}
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${waterway.lat.toFixed(2)}°, ${waterway.lon.toFixed(2)}°</span>
        </div>
      </div>
    </div>
  `;
}

export function renderNuclearPopup(facility: NuclearFacility): string {
  const typeLabels: Record<string, string> = {
    'plant': t('popups.nuclear.types.plant'),
    'enrichment': t('popups.nuclear.types.enrichment'),
    'weapons': t('popups.nuclear.types.weapons'),
    'research': t('popups.nuclear.types.research'),
  };
  const statusColors: Record<string, string> = {
    'active': 'elevated',
    'contested': 'high',
    'decommissioned': 'low',
  };

  const nearbyEq = facility._enrichNearbyEarthquakes;
  const seismicHtml = nearbyEq && nearbyEq.length > 0 ? `
    <div class="popup-section">
      <span class="section-label" style="color:#fb923c">⚠ Nearby Seismic Activity</span>
      <div class="popup-tags">
        ${nearbyEq.map(eq => `<span class="popup-tag" title="${escapeHtml(eq.place)}">M${eq.mag.toFixed(1)} · ${Math.round(eq.distKm)}km</span>`).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="popup-header nuclear">
      <span class="popup-title">${escapeHtml(facility.name.toUpperCase())}</span>
      <span class="popup-badge ${statusColors[facility.status] || 'low'}">${escapeHtml(facility.status.toUpperCase())}</span>
      ${nearbyEq && nearbyEq.length > 0 ? `<span class="popup-badge high">SEISMIC RISK</span>` : ''}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${escapeHtml(typeLabels[facility.type] || facility.type.toUpperCase())}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.status')}</span>
          <span class="stat-value">${escapeHtml(facility.status.toUpperCase())}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${facility.lat.toFixed(2)}°, ${facility.lon.toFixed(2)}°</span>
        </div>
      </div>
      ${seismicHtml}
      <p class="popup-description">${t('popups.nuclear.description')}</p>
    </div>
  `;
}

export function renderEconomicPopup(center: EconomicCenter): string {
  const typeLabels: Record<string, string> = {
    'exchange': t('popups.economic.types.exchange'),
    'central-bank': t('popups.economic.types.centralBank'),
    'financial-hub': t('popups.economic.types.financialHub'),
  };
  const typeIcons: Record<string, string> = {
    'exchange': '📈',
    'central-bank': '🏛',
    'financial-hub': '💰',
  };

  const marketStatus = center.marketHours ? getMarketStatus(center.marketHours) : null;
  const marketStatusLabel = marketStatus
    ? marketStatus === 'open'
      ? t('popups.open')
      : marketStatus === 'closed'
        ? t('popups.economic.closed')
        : t('popups.unknown')
    : '';

  return `
    <div class="popup-header economic ${center.type}">
      <span class="popup-title">${typeIcons[center.type] || ''} ${escapeHtml(center.name.toUpperCase())}</span>
      <span class="popup-badge ${marketStatus === 'open' ? 'elevated' : 'low'}">${escapeHtml(marketStatusLabel || typeLabels[center.type] || '')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      ${center.description ? `<p class="popup-description">${escapeHtml(center.description)}</p>` : ''}
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${escapeHtml(typeLabels[center.type] || center.type.toUpperCase())}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.country')}</span>
          <span class="stat-value">${escapeHtml(center.country)}</span>
        </div>
        ${center.marketHours ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.tradingHours')}</span>
          <span class="stat-value">${escapeHtml(center.marketHours.open)} - ${escapeHtml(center.marketHours.close)}</span>
        </div>
        ` : ''}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${center.lat.toFixed(2)}°, ${center.lon.toFixed(2)}°</span>
        </div>
      </div>
    </div>
  `;
}

export function renderIrradiatorPopup(irradiator: GammaIrradiator): string {
  return `
    <div class="popup-header irradiator">
      <span class="popup-title">☢ ${escapeHtml(irradiator.city.toUpperCase())}</span>
      <span class="popup-badge elevated">${t('popups.gamma')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${t('popups.irradiator.subtitle')}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.country')}</span>
          <span class="stat-value">${escapeHtml(irradiator.country)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.city')}</span>
          <span class="stat-value">${escapeHtml(irradiator.city)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${irradiator.lat.toFixed(2)}°, ${irradiator.lon.toFixed(2)}°</span>
        </div>
      </div>
      <p class="popup-description">${t('popups.irradiator.description')}</p>
    </div>
  `;
}

export function renderPipelinePopup(pipeline: Pipeline): string {
  const typeLabels: Record<string, string> = {
    'oil': t('popups.pipeline.types.oil'),
    'gas': t('popups.pipeline.types.gas'),
    'products': t('popups.pipeline.types.products'),
  };
  const typeColors: Record<string, string> = {
    'oil': 'high',
    'gas': 'elevated',
    'products': 'low',
  };
  const statusLabels: Record<string, string> = {
    'operating': t('popups.pipeline.status.operating'),
    'construction': t('popups.pipeline.status.construction'),
  };
  const typeIcon = pipeline.type === 'oil' ? '🛢' : pipeline.type === 'gas' ? '🔥' : '⛽';

  const sanctioned = pipeline._enrichSanctionedCountries;
  const sanctionHtml = sanctioned && sanctioned.length > 0 ? `
    <div class="popup-section">
      <span class="section-label" style="color:#f87171">⚠ Sanctions Exposure</span>
      <div class="popup-tags">
        ${sanctioned.map(s => `<span class="popup-tag" style="border-color:#f87171;color:#f87171">${escapeHtml(s.code)} — ${escapeHtml(s.severity.toUpperCase())}</span>`).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="popup-header pipeline ${pipeline.type}">
      <span class="popup-title">${typeIcon} ${escapeHtml(pipeline.name.toUpperCase())}</span>
      <span class="popup-badge ${typeColors[pipeline.type] || 'low'}">${escapeHtml(pipeline.type.toUpperCase())}</span>
      ${sanctioned && sanctioned.length > 0 ? `<span class="popup-badge high">SANCTIONED ROUTE</span>` : ''}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${typeLabels[pipeline.type] || t('popups.pipeline.title')}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.status')}</span>
          <span class="stat-value">${escapeHtml(statusLabels[pipeline.status] || pipeline.status.toUpperCase())}</span>
        </div>
        ${pipeline.capacity ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.capacity')}</span>
          <span class="stat-value">${escapeHtml(pipeline.capacity)}</span>
        </div>
        ` : ''}
        ${pipeline.length ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.length')}</span>
          <span class="stat-value">${escapeHtml(pipeline.length)}</span>
        </div>
        ` : ''}
        ${pipeline.operator ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.operator')}</span>
          <span class="stat-value">${escapeHtml(pipeline.operator)}</span>
        </div>
        ` : ''}
      </div>
      ${sanctionHtml}
      ${pipeline.countries && pipeline.countries.length > 0 ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.countries')}</span>
          <div class="popup-tags">
            ${pipeline.countries.map(c => `<span class="popup-tag">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <p class="popup-description">${t('popups.pipeline.description', { type: pipeline.type, status: pipeline.status === 'operating' ? t('popups.pipelineStatusDesc.operating') : t('popups.pipelineStatusDesc.construction') })}</p>
    </div>
  `;
}

export function renderFirePopup(fire: { region?: string; brightness?: number; frp?: number; acq_date?: string }): string {
  const intensityClass = (fire.brightness ?? 0) > 400 ? 'high' : (fire.brightness ?? 0) > 350 ? 'medium' : 'low';
  return `
    <div class="popup-header fire">
      <span class="popup-icon">🔥</span>
      <span class="popup-title">${escapeHtml(fire.region || 'Active Fire')}</span>
      ${pbadge(intensityClass.toUpperCase(), intensityClass)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${fire.brightness != null ? stat('Brightness', `${fire.brightness.toFixed(0)}K`) : ''}
        ${fire.frp != null ? stat('Fire Radiative Power', `${fire.frp.toFixed(0)} MW`) : ''}
        ${fire.acq_date ? stat('Detected', escapeHtml(fire.acq_date)) : ''}
      </div>
    </div>
  `;
}

export function renderPositiveEventPopup(event: PositiveGeoEvent): string {
  const catLabel = event.category ? event.category.replace(/-/g, ' & ') : 'Positive Event';
  return `
    <div class="popup-header positive-event">
      <span class="popup-icon">⭐</span>
      <span class="popup-title">${escapeHtml(event.name)}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat('Category', escapeHtml(catLabel))}
        ${event.count > 1 ? stat('Sources', String(event.count)) : ''}
      </div>
    </div>
  `;
}

export function renderKindnessEventPopup(point: KindnessPoint): string {
  return `
    <div class="popup-header kindness-event">
      <span class="popup-icon">💚</span>
      <span class="popup-title">${escapeHtml(point.name)}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      ${point.description ? `<p class="popup-description">${escapeHtml(point.description)}</p>` : ''}
    </div>
  `;
}

export function renderUcdpEventPopup(event: import('@/types').UcdpGeoEvent): string {
  const typeLabel = event.type_of_violence?.replace(/-/g, ' ') ?? 'Armed Conflict';
  const displaced = event._enrichDisplacedCount;
  return `
    <div class="popup-header conflict">
      <span class="popup-title">${escapeHtml(event.side_a)} vs ${escapeHtml(event.side_b)}</span>
      ${pbadge(typeLabel.toUpperCase(), 'high')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat(t('popups.country'), escapeHtml(event.country))}
        ${event.deaths_best > 0 ? stat('Est. Deaths', event.deaths_best.toLocaleString()) : ''}
        ${event.date_start ? stat('Date', escapeHtml(event.date_start)) : ''}
        ${displaced != null && displaced > 0 ? stat('Refugees / Displaced', `<span style="color:#fb923c">${displaced.toLocaleString()}</span>`) : ''}
      </div>
    </div>
  `;
}

export function renderSpeciesRecoveryPopup(species: SpeciesRecovery): string {
  const trendIcon = species.populationTrend === 'increasing' ? '↑' : '→';
  return `
    <div class="popup-header species-recovery">
      <span class="popup-icon">🌿</span>
      <span class="popup-title">${escapeHtml(species.commonName)}</span>
      ${pbadge(escapeHtml(species.recoveryStatus).toUpperCase(), 'normal')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat('Scientific Name', `<em>${escapeHtml(species.scientificName)}</em>`)}
        ${stat('IUCN Status', escapeHtml(species.iucnCategory))}
        ${stat('Trend', `${trendIcon} ${escapeHtml(species.populationTrend)}`)}
        ${species.region ? stat('Region', escapeHtml(species.region)) : ''}
      </div>
      ${species.summaryText ? `<p class="popup-description">${escapeHtml(species.summaryText)}</p>` : ''}
    </div>
  `;
}

export function renderRenewableInstallationPopup(installation: RenewableInstallation): string {
  const typeLabel = installation.type.charAt(0).toUpperCase() + installation.type.slice(1);
  const statusClass = installation.status === 'operational' ? 'normal' : 'medium';
  return `
    <div class="popup-header renewable-installation">
      <span class="popup-icon">⚡</span>
      <span class="popup-title">${escapeHtml(installation.name)}</span>
      ${pbadge(typeLabel.toUpperCase(), statusClass)}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-stats">
        ${stat('Capacity', `${installation.capacityMW.toLocaleString()} MW`)}
        ${stat(t('popups.country'), escapeHtml(installation.country))}
        ${stat('Year', String(installation.year))}
        ${stat('Status', escapeHtml(installation.status.replace(/_/g, ' ')))}
      </div>
    </div>
  `;
}

export function renderSanctionedAssetPopup(asset: SanctionedAsset): string {
  const typeLabel = asset.type.replace(/_/g, ' ');
  const value = asset.value ? stat('Value', escapeHtml(asset.value)) : '';
  const owner = asset.owner ? stat('Owner / linked party', escapeHtml(asset.owner)) : '';
  return `
    <div class="popup-header sanctions high">
      <span class="popup-icon">!</span>
      <span class="popup-title">${escapeHtml(asset.name.toUpperCase())}</span>
      ${pbadge(typeLabel.toUpperCase(), 'high')}
      <button class="popup-close" aria-label="Close">&times;</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(asset.sanctionCountry)} sanctions exposure</div>
      <div class="popup-stats">
        ${stat('Program', escapeHtml(asset.program))}
        ${owner}
        ${value}
        ${stat(t('popups.coordinates'), `${asset.lat.toFixed(2)}&deg;, ${asset.lon.toFixed(2)}&deg;`)}
      </div>
      <p class="popup-description">${escapeHtml(asset.description)}</p>
    </div>
  `;
}
