/**
 * Nearby-hazards lookup for a selected aircraft.
 *
 * Aggregates aviation-specific and cross-module hazards within a radius of a
 * given lat/lon (typically an aircraft's current position). Designed to
 * complement Codex's selected-aircraft drawer with context that the drawer
 * itself doesn't compute.
 *
 * Sources:
 *  - Aviation SIGMETs (sync, from getCachedAirSigmets)
 *  - Airport delay alerts (async, from fetchFlightDelays)
 *  - Geo-convergence score (sync, from getAlertsNearLocation)
 *  - Nearby infrastructure (sync, from getNearbyInfrastructure)
 */

import { haversineKm } from '@/utils/geo';
import { getCachedAirSigmets, fetchFlightDelays, type AirSigmet, type AirportDelayAlert } from './index';
import { getAlertsNearLocation } from '@/services/geo-convergence';
import { getNearbyInfrastructure } from '@/services/related-assets';
import type { AssetType } from '@/types';

export interface NearbySigmetHazard {
  id: string;
  hazard: string;
  hazardLabel: string;
  summary: string;
  severity: number;
  distanceKm: number;
  altitudeLow: number | null;
  altitudeHigh: number | null;
}

export interface NearbyAirportHazard {
  iata: string;
  name: string;
  city: string;
  country: string;
  severity: string;
  delayType: string;
  avgDelayMinutes: number;
  reason: string | null;
  distanceKm: number;
}

export interface NearbyInfrastructureHazard {
  type: AssetType;
  name: string;
  distanceKm: number;
}

export interface NearbyHazardsResult {
  lat: number;
  lon: number;
  radiusKm: number;
  sigmets: NearbySigmetHazard[];
  airports: NearbyAirportHazard[];
  infrastructure: NearbyInfrastructureHazard[];
  convergence: { score: number; types: number } | null;
  totalHazardCount: number;
  hasHighSeverity: boolean;
}

const DEFAULT_RADIUS_KM = 150;
const MAX_PER_CATEGORY = 10;

function sigmetCenter(sigmet: AirSigmet): { lat: number; lon: number } | null {
  if (sigmet.center) return sigmet.center;
  if (sigmet.coords.length > 0) return sigmet.coords[0]!;
  return null;
}

function gatherNearbySigmets(lat: number, lon: number, radiusKm: number): NearbySigmetHazard[] {
  const sigmets = getCachedAirSigmets();
  if (!sigmets.length) return [];

  const hazards: NearbySigmetHazard[] = [];
  for (const sigmet of sigmets) {
    const center = sigmetCenter(sigmet);
    if (!center) continue;
    const dist = haversineKm(lat, lon, center.lat, center.lon);
    if (dist > radiusKm) continue;

    hazards.push({
      id: sigmet.id,
      hazard: sigmet.hazard,
      hazardLabel: sigmet.hazardLabel,
      summary: sigmet.summary,
      severity: sigmet.severity,
      distanceKm: Math.round(dist),
      altitudeLow: sigmet.altitudeLow,
      altitudeHigh: sigmet.altitudeHigh,
    });
  }

  return hazards.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_PER_CATEGORY);
}

async function gatherNearbyAirports(lat: number, lon: number, radiusKm: number): Promise<NearbyAirportHazard[]> {
  let delays: AirportDelayAlert[];
  try {
    delays = await fetchFlightDelays();
  } catch {
    return [];
  }

  const hazards: NearbyAirportHazard[] = [];
  for (const alert of delays) {
    if (alert.severity === 'normal') continue;
    const dist = haversineKm(lat, lon, alert.lat, alert.lon);
    if (dist > radiusKm) continue;

    hazards.push({
      iata: alert.iata,
      name: alert.name,
      city: alert.city,
      country: alert.country,
      severity: alert.severity,
      delayType: alert.delayType,
      avgDelayMinutes: alert.avgDelayMinutes,
      reason: alert.reason ?? null,
      distanceKm: Math.round(dist),
    });
  }

  return hazards.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_PER_CATEGORY);
}

function gatherNearbyInfrastructure(lat: number, lon: number, radiusKm: number): NearbyInfrastructureHazard[] {
  const types: AssetType[] = ['base', 'nuclear', 'pipeline', 'cable', 'waterway'];
  const assets = getNearbyInfrastructure(lat, lon, types);
  return assets
    .filter(a => a.distanceKm <= radiusKm)
    .map(a => ({ type: a.type, name: a.name, distanceKm: Math.round(a.distanceKm) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_PER_CATEGORY);
}

/**
 * Get all hazards near a given lat/lon within a radius.
 *
 * Sync sources (SIGMETs, convergence, infrastructure) are gathered immediately.
 * Async sources (airport delays) are fetched with circuit-breaker caching.
 */
export async function getNearbyHazards(lat: number, lon: number, radiusKm = DEFAULT_RADIUS_KM): Promise<NearbyHazardsResult> {
  const sigmets = gatherNearbySigmets(lat, lon, radiusKm);
  const airports = await gatherNearbyAirports(lat, lon, radiusKm);
  const infrastructure = gatherNearbyInfrastructure(lat, lon, radiusKm);
  const convergence = getAlertsNearLocation(lat, lon, radiusKm);

  const totalHazardCount = sigmets.length + airports.length + infrastructure.length + (convergence ? 1 : 0);
  const hasHighSeverity = sigmets.some(s => s.severity >= 5) || airports.some(a => a.severity === 'severe' || a.severity === 'major');

  return {
    lat,
    lon,
    radiusKm,
    sigmets,
    airports,
    infrastructure,
    convergence,
    totalHazardCount,
    hasHighSeverity,
  };
}

/**
 * Sync version — only returns hazards from synchronously-available sources
 * (SIGMETs, infrastructure, convergence). Airport delays are excluded.
 * Useful for real-time UI that can't await.
 */
export function getNearbyHazardsSync(lat: number, lon: number, radiusKm = DEFAULT_RADIUS_KM): Omit<NearbyHazardsResult, 'airports'> {
  const sigmets = gatherNearbySigmets(lat, lon, radiusKm);
  const infrastructure = gatherNearbyInfrastructure(lat, lon, radiusKm);
  const convergence = getAlertsNearLocation(lat, lon, radiusKm);

  const totalHazardCount = sigmets.length + infrastructure.length + (convergence ? 1 : 0);
  const hasHighSeverity = sigmets.some(s => s.severity >= 5);

  return {
    lat,
    lon,
    radiusKm,
    sigmets,
    infrastructure,
    convergence,
    totalHazardCount,
    hasHighSeverity,
  };
}
