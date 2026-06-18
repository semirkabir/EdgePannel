import type { MilitaryFlight, MilitaryVessel, MilitaryFlightCluster, MilitaryVesselCluster } from '@/types';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';

export function renderMilitaryFlightPopup(flight: MilitaryFlight): string {
  const operatorLabels: Record<string, string> = {
    usaf: 'US Air Force',
    usn: 'US Navy',
    usmc: 'US Marines',
    usa: 'US Army',
    raf: 'Royal Air Force',
    rn: 'Royal Navy',
    faf: 'French Air Force',
    gaf: 'German Air Force',
    plaaf: 'PLA Air Force',
    plan: 'PLA Navy',
    vks: 'Russian Aerospace',
    iaf: 'Israeli Air Force',
    nato: 'NATO',
    other: t('popups.unknown'),
  };
  const typeLabels: Record<string, string> = {
    fighter: t('popups.militaryFlight.types.fighter'),
    bomber: t('popups.militaryFlight.types.bomber'),
    transport: t('popups.militaryFlight.types.transport'),
    tanker: t('popups.militaryFlight.types.tanker'),
    awacs: t('popups.militaryFlight.types.awacs'),
    reconnaissance: t('popups.militaryFlight.types.reconnaissance'),
    helicopter: t('popups.militaryFlight.types.helicopter'),
    drone: t('popups.militaryFlight.types.drone'),
    patrol: t('popups.militaryFlight.types.patrol'),
    special_ops: t('popups.militaryFlight.types.specialOps'),
    vip: t('popups.militaryFlight.types.vip'),
    unknown: t('popups.unknown'),
  };
  const confidenceColors: Record<string, string> = {
    high: 'elevated',
    medium: 'low',
    low: 'low',
  };
  const callsign = escapeHtml(flight.callsign || t('popups.unknown'));
  const aircraftTypeBadge = escapeHtml(flight.aircraftType.toUpperCase());
  const operatorLabel = escapeHtml(operatorLabels[flight.operator] || flight.operatorCountry || t('popups.unknown'));
  const hexCode = escapeHtml(flight.hexCode || '');
  const aircraftType = escapeHtml(typeLabels[flight.aircraftType] || flight.aircraftType);
  const squawk = flight.squawk ? escapeHtml(flight.squawk) : '';
  const note = flight.note ? escapeHtml(flight.note) : '';

  return `
    <div class="popup-header military-flight ${flight.operator}">
      <span class="popup-title">${callsign}</span>
      <span class="popup-badge ${confidenceColors[flight.confidence] || 'low'}">${aircraftTypeBadge}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${operatorLabel}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryFlight.altitude')}</span>
          <span class="stat-value">${flight.altitude > 0 ? `FL${Math.round(flight.altitude / 100)}` : t('popups.militaryFlight.ground')}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryFlight.speed')}</span>
          <span class="stat-value">${flight.speed} kts</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryFlight.heading')}</span>
          <span class="stat-value">${Math.round(flight.heading)}°</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryFlight.hexCode')}</span>
          <span class="stat-value">${hexCode}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${aircraftType}</span>
        </div>
        ${flight.squawk ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryFlight.squawk')}</span>
          <span class="stat-value">${squawk}</span>
        </div>
        ` : ''}
      </div>
      ${flight.note ? `<p class="popup-description">${note}</p>` : ''}
      <div class="popup-attribution">${t('popups.militaryFlight.attribution')}</div>
    </div>
  `;
}

export function renderMilitaryVesselPopup(vessel: MilitaryVessel): string {
  const operatorLabels: Record<string, string> = {
    usn: 'US Navy',
    uscg: 'US Coast Guard',
    rn: 'Royal Navy',
    fn: 'French Navy',
    plan: 'PLA Navy',
    ruf: 'Russian Navy',
    jmsdf: 'Japan Maritime SDF',
    rokn: 'ROK Navy',
    other: t('popups.unknown'),
  };
  const typeLabels: Record<string, string> = {
    carrier: 'Aircraft Carrier',
    destroyer: 'Destroyer',
    frigate: 'Frigate',
    submarine: 'Submarine',
    amphibious: 'Amphibious',
    patrol: 'Patrol',
    auxiliary: 'Auxiliary',
    research: 'Research',
    icebreaker: 'Icebreaker',
    special: 'Special',
    unknown: t('popups.unknown'),
  };

  const darkWarning = vessel.isDark
    ? `<span class="popup-badge high">${t('popups.militaryVessel.aisDark')}</span>`
    : '';

  const deploymentBadge = vessel.usniDeploymentStatus && vessel.usniDeploymentStatus !== 'unknown'
    ? `<span class="popup-badge ${vessel.usniDeploymentStatus === 'deployed' ? 'high' : vessel.usniDeploymentStatus === 'underway' ? 'elevated' : 'low'}">${vessel.usniDeploymentStatus.toUpperCase().replace('-', ' ')}</span>`
    : '';

  const displayType = vessel.vesselType === 'unknown' && vessel.aisShipType
    ? vessel.aisShipType
    : (typeLabels[vessel.vesselType] || vessel.vesselType);
  const badgeType = vessel.vesselType === 'unknown' && vessel.aisShipType
    ? vessel.aisShipType.toUpperCase()
    : vessel.vesselType.toUpperCase();
  const vesselName = escapeHtml(vessel.name || `${t('popups.militaryVessel.vessel')} ${vessel.mmsi}`);
  const vesselOperator = escapeHtml(operatorLabels[vessel.operator] || vessel.operatorCountry || t('popups.unknown'));
  const vesselTypeLabel = escapeHtml(displayType);
  const vesselBadgeType = escapeHtml(badgeType);
  const vesselMmsi = escapeHtml(vessel.mmsi || '—');
  const vesselHull = vessel.hullNumber ? escapeHtml(vessel.hullNumber) : '';
  const vesselNote = vessel.note ? escapeHtml(vessel.note) : '';

  return `
    <div class="popup-header military-vessel ${vessel.operator}">
      <span class="popup-title">${vesselName}</span>
      ${darkWarning}
      ${deploymentBadge}
      <span class="popup-badge elevated">${vesselBadgeType}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${vesselOperator}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.type')}</span>
          <span class="stat-value">${vesselTypeLabel}</span>
        </div>
        ${vessel.usniRegion ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryVessel.region')}</span>
          <span class="stat-value">${escapeHtml(vessel.usniRegion)}</span>
        </div>
        ` : ''}
        ${vessel.usniStrikeGroup ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryVessel.strikeGroup')}</span>
          <span class="stat-value">${escapeHtml(vessel.usniStrikeGroup)}</span>
        </div>
        ` : ''}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryVessel.speed')}</span>
          <span class="stat-value">${vessel.speed} kts</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryVessel.heading')}</span>
          <span class="stat-value">${Math.round(vessel.heading)}°</span>
        </div>
        ${vessel.mmsi ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryVessel.mmsi')}</span>
          <span class="stat-value">${vesselMmsi}</span>
        </div>
        ` : ''}
        ${vessel.hullNumber ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryVessel.hull')}</span>
          <span class="stat-value">${vesselHull}</span>
        </div>
        ` : ''}
      </div>
      ${vessel.usniActivityDescription ? `<p class="popup-description"><strong>${t('popups.militaryVessel.usniIntel')}:</strong> ${escapeHtml(vessel.usniActivityDescription)}</p>` : ''}
      ${vessel.note ? `<p class="popup-description">${vesselNote}</p>` : ''}
      ${vessel.isDark ? `<p class="popup-description alert">${t('popups.militaryVessel.darkDescription')}</p>` : ''}
      ${vessel.usniSource ? `<p class="popup-description" style="opacity:0.7;font-size:0.85em">${t('popups.militaryVessel.approximatePosition')}</p>` : ''}
      ${vessel.usniArticleUrl ? `<div class="popup-attribution"><a href="${escapeHtml(vessel.usniArticleUrl)}" target="_blank" rel="noopener">${t('popups.militaryVessel.usniSource')}${vessel.usniArticleDate ? ` (${new Date(vessel.usniArticleDate).toLocaleDateString()})` : ''}</a></div>` : ''}
    </div>
  `;
}

export function renderMilitaryFlightClusterPopup(cluster: MilitaryFlightCluster): string {
  const activityLabels: Record<string, string> = {
    exercise: t('popups.militaryCluster.flightActivity.exercise'),
    patrol: t('popups.militaryCluster.flightActivity.patrol'),
    transport: t('popups.militaryCluster.flightActivity.transport'),
    unknown: t('popups.militaryCluster.flightActivity.unknown'),
  };
  const activityColors: Record<string, string> = {
    exercise: 'high',
    patrol: 'elevated',
    transport: 'low',
    unknown: 'low',
  };

  const activityType = cluster.activityType || 'unknown';
  const clusterName = escapeHtml(cluster.name);
  const activityTypeLabel = escapeHtml(activityType.toUpperCase());
  const dominantOperator = cluster.dominantOperator ? escapeHtml(cluster.dominantOperator.toUpperCase()) : '';
  const flightSummary = cluster.flights
    .map((f, index) => `
      <button type="button" class="cluster-flight-item" data-flight-index="${index}">
        <div class="cluster-vessel-topline">
          <span class="cluster-vessel-name">${escapeHtml(f.callsign || f.id)}</span>
          ${f.registration ? `<span class="cluster-vessel-hull">${escapeHtml(f.registration)}</span>` : ''}
          <span class="cluster-vessel-status ${f.confidence === 'high' ? 'deployed' : f.confidence === 'medium' ? 'underway' : 'dim'}">${escapeHtml(f.aircraftType.toUpperCase())}</span>
        </div>
        <div class="cluster-vessel-meta">${escapeHtml(f.aircraftModel || f.aircraftType)} · ${escapeHtml(f.operatorCountry || f.operator)}</div>
        ${f.note ? `<div class="cluster-vessel-note">${escapeHtml(f.note)}</div>` : ''}
      </button>
    `)
    .join('');

  return `
    <div class="popup-header military-cluster">
      <span class="popup-title">${clusterName}</span>
      <span class="popup-badge ${activityColors[activityType] || 'low'}">${t('popups.militaryCluster.aircraftCount', { count: String(cluster.flightCount) })}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${activityLabels[activityType] || t('popups.militaryCluster.flightActivity.unknown')}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryCluster.aircraft')}</span>
          <span class="stat-value">${cluster.flightCount}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryCluster.activity')}</span>
          <span class="stat-value">${activityTypeLabel}</span>
        </div>
        ${cluster.dominantOperator ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryCluster.primary')}</span>
          <span class="stat-value">${dominantOperator}</span>
        </div>
        ` : ''}
      </div>
      <div class="popup-section">
        <span class="section-label">${t('popups.militaryCluster.trackedAircraft')}</span>
        <div class="cluster-flights">
          ${flightSummary}
        </div>
      </div>
    </div>
  `;
}

export function renderMilitaryVesselClusterPopup(cluster: MilitaryVesselCluster): string {
  const activityLabels: Record<string, string> = {
    exercise: t('popups.militaryCluster.vesselActivity.exercise'),
    deployment: t('popups.militaryCluster.vesselActivity.deployment'),
    patrol: t('popups.militaryCluster.vesselActivity.patrol'),
    transit: t('popups.militaryCluster.vesselActivity.transit'),
    unknown: t('popups.militaryCluster.vesselActivity.unknown'),
  };
  const activityColors: Record<string, string> = {
    exercise: 'high',
    deployment: 'high',
    patrol: 'elevated',
    transit: 'low',
    unknown: 'low',
  };

  const activityType = cluster.activityType || 'unknown';
  const clusterName = escapeHtml(cluster.name);
  const activityTypeLabel = escapeHtml(activityType.toUpperCase());
  const region = cluster.region ? escapeHtml(cluster.region) : '';
  const vesselSummary = cluster.vessels
    .map((v, index) => {
      const typeLabel = escapeHtml(v.vesselType === 'unknown' ? 'Vessel' : v.vesselType);
      const hull = v.hullNumber ? `<span class="cluster-vessel-hull">${escapeHtml(v.hullNumber)}</span>` : '';
      const operator = escapeHtml(v.operatorCountry || v.operator || 'Navy');
      const note = v.note ? `<div class="cluster-vessel-note">${escapeHtml(v.note)}</div>` : '';
      const status = v.isDark
        ? '<span class="cluster-vessel-status critical">DARK</span>'
        : v.usniDeploymentStatus && v.usniDeploymentStatus !== 'unknown'
          ? `<span class="cluster-vessel-status ${v.usniDeploymentStatus === 'deployed' ? 'deployed' : v.usniDeploymentStatus === 'underway' ? 'underway' : 'dim'}">${escapeHtml(v.usniDeploymentStatus.replace('-', ' ').toUpperCase())}</span>`
          : '';
      return `
        <button type="button" class="cluster-vessel-item" data-vessel-index="${index}">
          <div class="cluster-vessel-topline">
            <span class="cluster-vessel-name">${escapeHtml(v.name)}</span>
            ${hull}
            ${status}
          </div>
          <div class="cluster-vessel-meta">${typeLabel} · ${operator}</div>
          ${note}
        </button>
      `;
    })
    .join('');

  return `
    <div class="popup-header military-cluster">
      <span class="popup-title">${clusterName}</span>
      <span class="popup-badge ${activityColors[activityType] || 'low'}">${t('popups.militaryCluster.vesselsCount', { count: String(cluster.vesselCount) })}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${activityLabels[activityType] || t('popups.militaryCluster.vesselActivity.unknown')}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryCluster.vessels')}</span>
          <span class="stat-value">${cluster.vesselCount}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.militaryCluster.activity')}</span>
          <span class="stat-value">${activityTypeLabel}</span>
        </div>
        ${cluster.region ? `
        <div class="popup-stat">
          <span class="stat-label">${t('popups.region')}</span>
          <span class="stat-value">${region}</span>
        </div>
        ` : ''}
      </div>
      <div class="popup-section">
        <span class="section-label">${t('popups.militaryCluster.trackedVessels')}</span>
        <div class="cluster-vessels">
          ${vesselSummary}
        </div>
      </div>
    </div>
  `;
}

export function renderAircraftPopup(pos: import('@/services/aviation').PositionSample): string {
  const callsign = escapeHtml(pos.callsign || pos.icao24);
  const onGroundBadge = pos.stale ? 'low' : pos.onGround ? 'low' : 'elevated';
  const statusLabel = pos.onGround ? t('popups.aircraft.ground') : t('popups.aircraft.airborne');
  const altDisplay = pos.altitudeFt > 0 ? `FL${Math.round(pos.altitudeFt / 100)} (${pos.altitudeFt.toLocaleString()} ft)` : t('popups.aircraft.ground');
  const observedAt = pos.observedAt instanceof Date ? pos.observedAt : new Date(pos.observedAt);
  const lastContactAt = pos.lastContactAt instanceof Date ? pos.lastContactAt : new Date(pos.lastContactAt || observedAt);
  const ageSec = Math.max(0, Math.round((Date.now() - observedAt.getTime()) / 1000));
  const ageLabel = Number.isFinite(ageSec)
    ? ageSec < 60 ? `${ageSec}s ago` : `${Math.round(ageSec / 60)}m ago`
    : 'unknown';
  const providerLabel = escapeHtml(pos.provider || pos.source || 'unknown');
  const sourceTech = pos.positionSource && pos.positionSource !== 'unknown'
    ? ` (${escapeHtml(pos.positionSource.toUpperCase())})`
    : '';
  const freshnessBadge = pos.freshness === 'live'
    ? `<span class="popup-badge elevated">LIVE</span>`
    : pos.freshness === 'recent'
      ? `<span class="popup-badge low">RECENT</span>`
      : `<span class="popup-badge low">STALE</span>`;
  const verticalRate = Number.isFinite(pos.verticalRateMps)
    ? `${pos.verticalRateMps > 0 ? '+' : ''}${Math.round(pos.verticalRateMps * 196.85)} fpm`
    : 'n/a';

  return `
    <div class="popup-header aircraft">
      <span class="popup-icon">&#9992;</span>
      <span class="popup-title">${callsign}</span>
      <span class="popup-badge ${onGroundBadge}">${statusLabel}</span>
      ${freshnessBadge}
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">ICAO24: ${escapeHtml(pos.icao24)}${pos.originCountry ? ` · ${escapeHtml(pos.originCountry)}` : ''}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <span class="stat-label">${t('popups.aircraft.altitude')}</span>
          <span class="stat-value">${altDisplay}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.aircraft.speed')}</span>
          <span class="stat-value">${pos.groundSpeedKts} kts</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.aircraft.heading')}</span>
          <span class="stat-value">${Math.round(pos.trackDeg)}&deg;</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">Vertical</span>
          <span class="stat-value">${verticalRate}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.aircraft.position')}</span>
          <span class="stat-value">${pos.lat.toFixed(4)}&deg;, ${pos.lon.toFixed(4)}&deg;</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.source')}</span>
          <span class="stat-value">${providerLabel}${sourceTech}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">Category</span>
          <span class="stat-value">${pos.aircraftCategory || 'n/a'}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.updated')}</span>
          <span class="stat-value">${observedAt.toLocaleTimeString()} (${ageLabel})</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">Last contact</span>
          <span class="stat-value">${lastContactAt.toLocaleTimeString()}</span>
        </div>
      </div>
      ${pos.stale ? `<p class="popup-description alert">Position is stale. Treat heading and altitude as last reported, not current.</p>` : ''}
    </div>
  `;
}

export function renderFlightPopup(delay: import('@/services/aviation').AirportDelayAlert): string {
  const severityClass = escapeHtml(delay.severity);
  const severityLabel = escapeHtml(delay.severity.toUpperCase());
  const delayTypeLabels: Record<string, string> = {
    'ground_stop': t('popups.flight.groundStop'),
    'ground_delay': t('popups.flight.groundDelay'),
    'departure_delay': t('popups.flight.departureDelay'),
    'arrival_delay': t('popups.flight.arrivalDelay'),
    'general': t('popups.flight.delaysReported'),
    'closure': t('popups.flight.closure'),
  };
  const delayTypeLabel = delayTypeLabels[delay.delayType] || t('popups.flight.delays');
  const icon = delay.delayType === 'closure' ? '🚫' : delay.delayType === 'ground_stop' ? '🛑' : delay.severity === 'severe' ? '✈️' : '🛫';
  const sourceLabels: Record<string, string> = {
    'faa': t('popups.flight.sources.faa'),
    'eurocontrol': t('popups.flight.sources.eurocontrol'),
    'computed': t('popups.flight.sources.computed'),
  };
  const sourceLabel = sourceLabels[delay.source] || escapeHtml(delay.source);
  const regionLabels: Record<string, string> = {
    'americas': t('popups.flight.regions.americas'),
    'europe': t('popups.flight.regions.europe'),
    'apac': t('popups.flight.regions.apac'),
    'mena': t('popups.flight.regions.mena'),
    'africa': t('popups.flight.regions.africa'),
  };
  const regionLabel = regionLabels[delay.region] || escapeHtml(delay.region);

  const avgDelaySection = delay.avgDelayMinutes > 0
    ? `<div class="popup-stat"><span class="stat-label">${t('popups.flight.avgDelay')}</span><span class="stat-value alert">+${delay.avgDelayMinutes} ${t('popups.timeUnits.m')}</span></div>`
    : '';
  const reasonSection = delay.reason
    ? `<div class="popup-stat"><span class="stat-label">${t('popups.reason')}</span><span class="stat-value">${escapeHtml(delay.reason)}</span></div>`
    : '';
  const cancelledSection = delay.cancelledFlights
    ? `<div class="popup-stat"><span class="stat-label">${t('popups.flight.cancelled')}</span><span class="stat-value alert">${delay.cancelledFlights} ${t('popups.events')}</span></div>`
    : '';

  return `
    <div class="popup-header flight ${severityClass}">
      <span class="popup-icon">${icon}</span>
      <span class="popup-title">${escapeHtml(delay.iata)} - ${delayTypeLabel}</span>
      <span class="popup-badge ${severityClass}">${severityLabel}</span>
      <button class="popup-close" aria-label="Close">×</button>
    </div>
    <div class="popup-body">
      <div class="popup-subtitle">${escapeHtml(delay.name)}</div>
      <div class="popup-location">${escapeHtml(delay.city)}, ${escapeHtml(delay.country)}</div>
      <div class="popup-stats">
        ${avgDelaySection}
        ${reasonSection}
        ${cancelledSection}
        <div class="popup-stat">
          <span class="stat-label">${t('popups.region')}</span>
          <span class="stat-value">${regionLabel}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.source')}</span>
          <span class="stat-value">${sourceLabel}</span>
        </div>
        <div class="popup-stat">
          <span class="stat-label">${t('popups.updated')}</span>
          <span class="stat-value">${delay.updatedAt.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  `;
}
