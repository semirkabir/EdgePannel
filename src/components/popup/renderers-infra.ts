import type { UnderseaCable, CableAdvisory, RepairShip, InternetOutage, AIDataCenter, Port, Spaceport, CriticalMineralProject } from '@/types';
import { UNDERSEA_CABLES } from '@/config';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { getCableHealthRecord } from '@/services/cable-health';
import type { DatacenterClusterData } from './types';

function stat(label: string, value: string): string {
  return `<div class="popup-stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;
}
function pbadge(text: string, cls: string): string {
  return `<span class="popup-badge ${cls}">${text}</span>`;
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

function getLatestCableAdvisory(cableAdvisories: CableAdvisory[], cableId: string): CableAdvisory | undefined {
  const advisories = cableAdvisories.filter((item) => item.cableId === cableId);
  return advisories.reduce<CableAdvisory | undefined>((latest, advisory) => {
    if (!latest) return advisory;
    return advisory.reported.getTime() > latest.reported.getTime() ? advisory : latest;
  }, undefined);
}

function getPriorityRepairShip(repairShips: RepairShip[], cableId: string): RepairShip | undefined {
  const ships = repairShips.filter((item) => item.cableId === cableId);
  if (ships.length === 0) return undefined;
  const onStation = ships.find((ship) => ship.status === 'on-station');
  return onStation || ships[0];
}

export function renderCablePopup(cable: UnderseaCable, cableAdvisories: CableAdvisory[], repairShips: RepairShip[]): string {
  const advisory = getLatestCableAdvisory(cableAdvisories, cable.id);
  const repairShip = getPriorityRepairShip(repairShips, cable.id);
  const healthRecord = getCableHealthRecord(cable.id);

  let statusLabel: string;
  let statusBadge: string;
  if (healthRecord?.status === 'fault') {
    statusLabel = t('popups.cable.fault');
    statusBadge = 'high';
  } else if (healthRecord?.status === 'degraded') {
    statusLabel = t('popups.cable.degraded');
    statusBadge = 'elevated';
  } else if (advisory) {
    statusLabel = advisory.severity === 'fault' ? t('popups.cable.fault') : t('popups.cable.degraded');
    statusBadge = advisory.severity === 'fault' ? 'high' : 'elevated';
  } else {
    statusLabel = t('popups.cable.active');
    statusBadge = 'low';
  }
  const repairEta = repairShip?.eta || advisory?.repairEta;
  const cableName = escapeHtml(cable.name.toUpperCase());
  const safeStatusLabel = escapeHtml(statusLabel);
  const safeRepairEta = repairEta ? escapeHtml(repairEta) : '';
  const advisoryTitle = advisory ? escapeHtml(advisory.title) : '';
  const advisoryImpact = advisory ? escapeHtml(advisory.impact) : '';
  const advisoryDescription = advisory ? escapeHtml(advisory.description) : '';
  const repairShipName = repairShip ? escapeHtml(repairShip.name) : '';
  const repairShipNote = repairShip ? escapeHtml(repairShip.note || t('popups.repairShip.note')) : '';

  return `
    <div class="popup-header cable">
      <span class="popup-title">🌐 ${cableName}</span>
      <span class="popup-badge ${statusBadge}">${cable.major ? t('popups.cable.major') : t('popups.cable.cable')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${t('popups.cable.subtitle')}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${t('popups.cable.type')}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.waypoints')}</span>
          <span class="stat-value">${cable.points.length}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.status')}</span>
          <span class="stat-value">${safeStatusLabel}</span>
        </div>
        ${repairEta ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.repairEta')}</span>
          <span class="stat-value">${safeRepairEta}</span>
        </div>
        ` : ''}
      </div>
      ${advisory ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.cable.advisory')}</span>
          <div class="popup-tags">
            <span class="popup-tag">${advisoryTitle}</span>
            <span class="popup-tag">${advisoryImpact}</span>
          </div>
          <p class="popup-description">${advisoryDescription}</p>
        </div>
      ` : ''}
      ${repairShip ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.cable.repairDeployment')}</span>
          <div class="popup-tags">
            <span class="popup-tag">${repairShipName}</span>
            <span class="popup-tag">${repairShip.status === 'on-station' ? t('popups.cable.repairStatus.onStation') : t('popups.cable.repairStatus.enRoute')}</span>
          </div>
          <p class="popup-description">${repairShipNote}</p>
        </div>
      ` : ''}
      ${healthRecord?.evidence?.length ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.cable.health.evidence')}</span>
          <ul class="evidence-list">
            ${healthRecord.evidence.map((e) => `<li class="evidence-item"><strong>${escapeHtml(e.source)}</strong>: ${escapeHtml(e.summary)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${cable._enrichNearbyOutages != null && cable._enrichNearbyOutages > 0 ? `
        <div class="popup-section">
          <span class="section-label" style="color:#fb923c">⚡ Regional Internet Outages</span>
          <p class="popup-description" style="margin:4px 0 0">${cable._enrichNearbyOutages} active outage${cable._enrichNearbyOutages > 1 ? 's' : ''} detected within 1,500 km of this cable's path${cable._enrichNearbyJamming ? ' · <span style="color:#fbbf24">GPS jamming active nearby</span>' : ''}</p>
        </div>
      ` : cable._enrichNearbyJamming ? `
        <div class="popup-section">
          <span class="section-label" style="color:#fbbf24">📡 GPS Jamming Detected</span>
          <p class="popup-description" style="margin:4px 0 0">Active GPS jamming detected within 500 km of this cable's landing points</p>
        </div>
      ` : ''}
      <p class="popup-description">${t('popups.cable.description')}</p>
    </div>
  `;
}

export function renderCableAdvisoryPopup(advisory: CableAdvisory): string {
  const cable = UNDERSEA_CABLES.find((item) => item.id === advisory.cableId);
  const timeAgo = getTimeAgo(advisory.reported);
  const statusLabel = advisory.severity === 'fault' ? t('popups.cable.fault') : t('popups.cable.degraded');
  const cableName = escapeHtml(cable?.name.toUpperCase() || advisory.cableId.toUpperCase());
  const advisoryTitle = escapeHtml(advisory.title);
  const advisoryImpact = escapeHtml(advisory.impact);
  const advisoryEta = advisory.repairEta ? escapeHtml(advisory.repairEta) : '';
  const advisoryDescription = escapeHtml(advisory.description);

  return `
    <div class="popup-header cable">
      <span class="popup-title">🚨 ${cableName}</span>
      <span class="popup-badge ${advisory.severity === 'fault' ? 'high' : 'elevated'}">${statusLabel}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${advisoryTitle}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.cableAdvisory.reported')}</span>
          <span class="stat-value">${timeAgo}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.cableAdvisory.impact')}</span>
          <span class="stat-value">${advisoryImpact}</span>
        </div>
        ${advisory.repairEta ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.cableAdvisory.eta')}</span>
          <span class="stat-value">${advisoryEta}</span>
        </div>
        ` : ''}
      </div>
      <p class="popup-description">${advisoryDescription}</p>
    </div>
  `;
}

export function renderRepairShipPopup(ship: RepairShip): string {
  const cable = UNDERSEA_CABLES.find((item) => item.id === ship.cableId);
  const shipName = escapeHtml(ship.name.toUpperCase());
  const cableLabel = escapeHtml(cable?.name || ship.cableId);
  const shipEta = escapeHtml(ship.eta);
  const shipOperator = ship.operator ? escapeHtml(ship.operator) : '';
  const shipNote = escapeHtml(ship.note || t('popups.repairShip.description'));

  return `
    <div class="popup-header cable">
      <span class="popup-title">🚢 ${shipName}</span>
      <span class="popup-badge elevated">${t('popups.repairShip.badge')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${cableLabel}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.status')}</span>
          <span class="stat-value">${ship.status === 'on-station' ? t('popups.repairShip.status.onStation') : t('popups.repairShip.status.enRoute')}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.cableAdvisory.eta')}</span>
          <span class="stat-value">${shipEta}</span>
        </div>
        ${ship.operator ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.operator')}</span>
          <span class="stat-value">${shipOperator}</span>
        </div>
        ` : ''}
      </div>
      <p class="popup-description">${shipNote}</p>
    </div>
  `;
}

export function renderOutagePopup(outage: InternetOutage): string {
  const severityColors: Record<string, string> = {
    'total': 'high',
    'major': 'elevated',
    'partial': 'low',
  };
  const severityLabels: Record<string, string> = {
    'total': t('popups.outage.levels.total'),
    'major': t('popups.outage.levels.major'),
    'partial': t('popups.outage.levels.partial'),
  };
  const timeAgo = getTimeAgo(outage.pubDate);
  const severityClass = escapeHtml(outage.severity);

  return `
    <div class="popup-header outage ${severityClass}">
      <span class="popup-title">📡 ${escapeHtml(outage.country.toUpperCase())}</span>
      <span class="popup-badge ${severityColors[outage.severity] || 'low'}">${severityLabels[outage.severity] || t('popups.outage.levels.disruption')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(outage.title)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.severity')}</span>
          <span class="stat-value">${escapeHtml(outage.severity.toUpperCase())}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.outage.reported')}</span>
          <span class="stat-value">${timeAgo}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${outage.lat.toFixed(2)}°, ${outage.lon.toFixed(2)}°</span>
        </div>
      </div>
      ${outage.categories && outage.categories.length > 0 ? `
        <div class="popup-section">
          <span class="section-label">${t('popups.outage.categories')}</span>
          <div class="popup-tags">
            ${outage.categories.slice(0, 5).map(c => `<span class="popup-tag">${escapeHtml(c)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <p class="popup-description">${escapeHtml(outage.description.slice(0, 250))}${outage.description.length > 250 ? '...' : ''}</p>
      <a href="${sanitizeUrl(outage.link)}" target="_blank" class="popup-link">${t('popups.outage.readReport')} →</a>
    </div>
  `;
}

export function renderDatacenterPopup(dc: AIDataCenter): string {
  const statusColors: Record<string, string> = {
    'existing': 'normal',
    'planned': 'elevated',
    'decommissioned': 'low',
  };
  const statusLabels: Record<string, string> = {
    'existing': t('popups.datacenter.status.existing'),
    'planned': t('popups.datacenter.status.planned'),
    'decommissioned': t('popups.datacenter.status.decommissioned'),
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return `
    <div class="popup-header datacenter ${dc.status}">
      <span class="popup-title">🖥️ ${escapeHtml(dc.name)}</span>
      <span class="popup-badge ${statusColors[dc.status] || 'normal'}">${statusLabels[dc.status] || t('popups.datacenter.status.unknown')}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(dc.owner)} • ${escapeHtml(dc.country)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.gpuChipCount')}</span>
          <span class="stat-value">${formatNumber(dc.chipCount)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.chipType')}</span>
          <span class="stat-value">${escapeHtml(dc.chipType || t('popups.unknown'))}</span>
        </div>
        ${dc.powerMW ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.power')}</span>
          <span class="stat-value">${dc.powerMW.toFixed(0)} MW</span>
        </div>
        ` : ''}
        ${dc.sector ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.sector')}</span>
          <span class="stat-value">${escapeHtml(dc.sector)}</span>
        </div>
        ` : ''}
      </div>
      ${dc.note ? `<p class="popup-description">${escapeHtml(dc.note)}</p>` : ''}
      <div class="popup-attribution">${t('popups.datacenter.attribution')}</div>
    </div>
  `;
}

export function renderDatacenterClusterPopup(data: DatacenterClusterData): string {
  const totalCount = data.count ?? data.items.length;
  const totalChips = data.totalChips ?? data.items.reduce((sum, dc) => sum + dc.chipCount, 0);
  const totalPower = data.totalPowerMW ?? data.items.reduce((sum, dc) => sum + (dc.powerMW || 0), 0);
  const existingCount = data.existingCount ?? data.items.filter(dc => dc.status === 'existing').length;
  const plannedCount = data.plannedCount ?? data.items.filter(dc => dc.status === 'planned').length;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  const dcListHtml = data.items.slice(0, 8).map(dc => `
    <div class="cluster-item">
      <span class="cluster-item-icon">${dc.status === 'planned' ? '🔨' : '🖥️'}</span>
      <div class="cluster-item-info">
        <span class="cluster-item-name">${escapeHtml(dc.name.slice(0, 40))}${dc.name.length > 40 ? '...' : ''}</span>
        <span class="cluster-item-detail">${escapeHtml(dc.owner)} • ${formatNumber(dc.chipCount)} ${t('popups.datacenter.chips')}</span>
      </div>
    </div>
  `).join('');

  return `
    <div class="popup-header datacenter cluster">
      <span class="popup-title">🖥️ ${t('popups.datacenter.cluster.title', { count: String(totalCount) })}</span>
      <span class="popup-badge elevated">${escapeHtml(data.region)}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(data.country)}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.cluster.totalChips')}</span>
          <span class="stat-value">${formatNumber(totalChips)}</span>
        </div>
        ${totalPower > 0 ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.cluster.totalPower')}</span>
          <span class="stat-value">${totalPower.toFixed(0)} MW</span>
        </div>
        ` : ''}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.cluster.operational')}</span>
          <span class="stat-value">${existingCount}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.datacenter.cluster.planned')}</span>
          <span class="stat-value">${plannedCount}</span>
        </div>
      </div>
      <div class="cluster-list">
        ${dcListHtml}
      </div>
      ${totalCount > 8 ? `<p class="popup-more">${t('popups.datacenter.cluster.moreDataCenters', { count: String(Math.max(0, totalCount - 8)) })}</p>` : ''}
      ${data.sampled ? `<p class="popup-more">${t('popups.datacenter.cluster.sampledSites', { count: String(data.items.length) })}</p>` : ''}
      <div class="popup-attribution">${t('popups.datacenter.attribution')}</div>
    </div>
  `;
}

export function renderPortPopup(port: Port): string {
  const typeLabels: Record<string, string> = {
    container: t('popups.port.types.container'),
    oil: t('popups.port.types.oil'),
    lng: t('popups.port.types.lng'),
    naval: t('popups.port.types.naval'),
    mixed: t('popups.port.types.mixed'),
    bulk: t('popups.port.types.bulk'),
  };
  const typeColors: Record<string, string> = {
    container: 'elevated',
    oil: 'high',
    lng: 'high',
    naval: 'elevated',
    mixed: 'normal',
    bulk: 'low',
  };
  const typeIcons: Record<string, string> = {
    container: '🏭',
    oil: '🛢️',
    lng: '🔥',
    naval: '⚓',
    mixed: '🚢',
    bulk: '📦',
  };

  const rankSection = port.rank
    ? `<div class="popup-stat"><span class="stat-label">${t('popups.port.worldRank')}</span><span class="stat-value">#${port.rank}</span></div>`
    : '';

  return `
    <div class="popup-header port ${escapeHtml(port.type)}">
      <span class="popup-icon">${typeIcons[port.type] || '🚢'}</span>
      <span class="popup-title">${escapeHtml(port.name.toUpperCase())}</span>
      <span class="popup-badge ${typeColors[port.type] || 'normal'}">${typeLabels[port.type] || port.type.toUpperCase()}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(port.country)}</div>
      <div class="popup-stats">
        ${rankSection}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${typeLabels[port.type] || port.type.toUpperCase()}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${port.lat.toFixed(2)}°, ${port.lon.toFixed(2)}°</span>
        </div>
      </div>
      <p class="popup-description">${escapeHtml(port.note)}</p>
    </div>
  `;
}

export function renderSpaceportPopup(port: Spaceport): string {
  const statusColors: Record<string, string> = { active: 'elevated', construction: 'high', inactive: 'low' };
  const statusLabels: Record<string, string> = {
    active: t('popups.spaceport.status.active'),
    construction: t('popups.spaceport.status.construction'),
    inactive: t('popups.spaceport.status.inactive'),
  };
  return `
    <div class="popup-header spaceport ${port.status}">
      <span class="popup-icon">🚀</span>
      <span class="popup-title">${escapeHtml(port.name.toUpperCase())}</span>
      ${pbadge(statusLabels[port.status] || port.status.toUpperCase(), statusColors[port.status] || 'normal')}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(port.operator)} • ${escapeHtml(port.country)}</div>
      <div class="popup-stats">
        ${stat(t('popups.spaceport.launchActivity'), escapeHtml(port.launches.toUpperCase()))}
        ${stat(t('popups.coordinates'), `${port.lat.toFixed(2)}°, ${port.lon.toFixed(2)}°`)}
      </div>
      <p class="popup-description">${t('popups.spaceport.description')}</p>
    </div>
  `;
}

export function renderMineralPopup(mine: CriticalMineralProject): string {
  const statusColors: Record<string, string> = {
    'producing': 'elevated',
    'development': 'high',
    'exploration': 'low',
  };
  const statusLabels: Record<string, string> = {
    'producing': t('popups.mineral.status.producing'),
    'development': t('popups.mineral.status.development'),
    'exploration': t('popups.mineral.status.exploration'),
  };

  const icon = mine.mineral === 'Lithium' ? '🔋' : mine.mineral === 'Rare Earths' ? '🧲' : '💎';
  const ciiScore = mine._enrichCii;
  const ciiColor = ciiScore ? (ciiScore.level === 'critical' || ciiScore.level === 'high' ? '#f87171' : ciiScore.level === 'elevated' ? '#fbbf24' : '#4ade80') : null;
  const sanctioned = mine._enrichSanctioned;
  const sanctionColor = sanctioned === 'severe' ? '#f87171' : '#fb923c';

  return `
    <div class="popup-header mineral ${mine.status}">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title">${escapeHtml(mine.name.toUpperCase())}</span>
      <span class="popup-badge ${statusColors[mine.status] || 'normal'}">${statusLabels[mine.status] || mine.status.toUpperCase()}</span>
      ${sanctioned ? `<span class="popup-badge high">SANCTIONED</span>` : ''}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${t('popups.mineral.projectSubtitle', { mineral: escapeHtml(mine.mineral.toUpperCase()) })}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.operator')}</span>
          <span class="stat-value">${escapeHtml(mine.operator)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.country')}</span>
          <span class="stat-value">${escapeHtml(mine.country)}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.coordinates')}</span>
          <span class="stat-value">${mine.lat.toFixed(2)}°, ${mine.lon.toFixed(2)}°</span>
        </div>
        ${ciiScore ? `<div class="popup-stat"><span class="stat-label">Country Stability</span><span class="stat-value" style="color:${ciiColor}">${escapeHtml(ciiScore.level.toUpperCase())} (${ciiScore.score.toFixed(0)}/100)</span></div>` : ''}
        ${sanctioned ? `<div class="popup-stat"><span class="stat-label">Sanctions Risk</span><span class="stat-value" style="color:${sanctionColor}">${escapeHtml(sanctioned.toUpperCase())}</span></div>` : ''}
      </div>
      <p class="popup-description">${escapeHtml(mine.significance)}</p>
    </div>
  `;
}
