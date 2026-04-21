import type { MilitaryFlight } from '@/types';
import type { SignalType } from '@/utils/analysis-constants';
import { focalPointDetector } from '../focal-point-detector';
import {
  SENSITIVE_REGIONS,
  OPERATOR_HOMES,
  COUNTRY_TO_ISO,
  REGION_AFFECTED_COUNTRIES,
} from './constants';
import type { GeoRegion, ForeignPresenceAlert } from './constants';

const activeForeignPresence = new Map<string, ForeignPresenceAlert>();
const seenForeignAlerts = new Set<string>();

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRegionForPosition(lat: number, lon: number): GeoRegion | null {
  for (const region of SENSITIVE_REGIONS) {
    const dist = distanceKm(lat, lon, region.lat, region.lon);
    if (dist <= region.radiusKm) {
      return region;
    }
  }
  return null;
}

function isHomeRegion(operator: string, regionId: string): boolean {
  const config = OPERATOR_HOMES.find(o => o.operator === operator);
  if (!config) return true;
  return config.homeRegions.includes(regionId);
}

function getOperatorThreshold(operator: string): number {
  const config = OPERATOR_HOMES.find(o => o.operator === operator);
  return config?.alertThreshold ?? 3;
}

function getOperatorCountry(operator: string): string {
  const config = OPERATOR_HOMES.find(o => o.operator === operator);
  return config?.country ?? 'Unknown';
}

export function detectForeignMilitaryPresence(flights: MilitaryFlight[]): ForeignPresenceAlert[] {
  const newAlerts: ForeignPresenceAlert[] = [];

  const presenceMap = new Map<string, { operator: import('@/types').MilitaryOperator; region: GeoRegion; flights: MilitaryFlight[] }>();

  for (const flight of flights) {
    const region = getRegionForPosition(flight.lat, flight.lon);
    if (!region) continue;

    if (isHomeRegion(flight.operator, region.id)) continue;

    const key = `${flight.operator}-${region.id}`;
    const existing = presenceMap.get(key);
    if (existing) {
      existing.flights.push(flight);
    } else {
      presenceMap.set(key, { operator: flight.operator, region, flights: [flight] });
    }
  }

  for (const [key, presence] of presenceMap) {
    const threshold = getOperatorThreshold(presence.operator);
    if (presence.flights.length < threshold) continue;

    const alertKey = `${key}-${Math.floor(Date.now() / (2 * 60 * 60 * 1000))}`;
    if (seenForeignAlerts.has(alertKey)) continue;
    seenForeignAlerts.add(alertKey);

    const alert: ForeignPresenceAlert = {
      id: key,
      operator: presence.operator,
      operatorCountry: getOperatorCountry(presence.operator),
      region: presence.region,
      aircraftCount: presence.flights.length,
      flights: presence.flights,
      firstDetected: new Date(),
    };

    activeForeignPresence.set(key, alert);
    newAlerts.push(alert);
  }

  return newAlerts;
}

export function getActiveForeignPresence(): ForeignPresenceAlert[] {
  return Array.from(activeForeignPresence.values());
}

export function foreignPresenceToSignal(alert: ForeignPresenceAlert): {
  id: string;
  type: SignalType;
  source: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  category: string;
  timestamp: Date;
  location?: { lat: number; lon: number; name: string };
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
} {
  const aircraftTypes = new Map<string, number>();
  const callsigns: string[] = [];

  for (const flight of alert.flights) {
    const typeKey = flight.aircraftModel || flight.aircraftType || 'unknown';
    aircraftTypes.set(typeKey, (aircraftTypes.get(typeKey) || 0) + 1);
    callsigns.push(flight.callsign);
  }

  const aircraftList = Array.from(aircraftTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${count}x ${type}`)
    .join(', ');

  const criticalCombos = [
    ['vks', 'baltics'], ['vks', 'poland-border'], ['vks', 'alaska-adiz'],
    ['plaaf', 'taiwan-strait'], ['plan', 'taiwan-strait'],
    ['usaf', 'iran-border'], ['usn', 'persian-gulf'], ['iaf', 'iran-border'],
  ];

  const isCritical = criticalCombos.some(
    ([op, reg]) => alert.operator === op && alert.region.id === reg
  );

  const severity = isCritical ? 'critical' :
    alert.aircraftCount >= 5 ? 'high' : 'medium';

  const confidence = Math.min(0.95, 0.7 + alert.aircraftCount * 0.05);

  const relevantCountries: string[] = [];
  const operatorISO = COUNTRY_TO_ISO[alert.operatorCountry];
  if (operatorISO) relevantCountries.push(operatorISO);

  const affectedCountries = REGION_AFFECTED_COUNTRIES[alert.region.id] || [];
  for (const iso of affectedCountries) {
    if (!relevantCountries.includes(iso)) {
      relevantCountries.push(iso);
    }
  }

  const newsContext = focalPointDetector.getNewsCorrelationContext(relevantCountries);

  let description = `${alert.aircraftCount} ${alert.operatorCountry} aircraft detected in ${alert.region.name}. ` +
    `${aircraftList}. Callsigns: ${callsigns.slice(0, 4).join(', ')}${callsigns.length > 4 ? '...' : ''}`;

  const focalPointContexts: string[] = [];
  for (const iso of relevantCountries) {
    const fp = focalPointDetector.getFocalPointForCountry(iso);
    if (fp && fp.newsMentions > 0) {
      focalPointContexts.push(`${fp.displayName}: ${fp.newsMentions} news mentions (${fp.urgency})`);
    }
  }

  const metadata: Record<string, unknown> = {
    operator: alert.operator,
    operatorCountry: alert.operatorCountry,
    regionId: alert.region.id,
    regionName: alert.region.name,
    lat: alert.region.lat,
    lon: alert.region.lon,
    aircraftCount: alert.aircraftCount,
    aircraftTypes: Object.fromEntries(aircraftTypes),
    callsigns,
    relevantCountries,
    newsCorrelation: newsContext,
    focalPointContext: focalPointContexts.length > 0 ? focalPointContexts : null,
  };

  return {
    id: `foreign-${alert.id}-${alert.firstDetected.getTime()}`,
    type: 'military_surge',
    source: 'Military Flight Tracking',
    title: `🚨 ${alert.operatorCountry} Military in ${alert.region.name}`,
    description,
    severity,
    confidence,
    category: 'military',
    timestamp: alert.firstDetected,
    location: {
      lat: alert.region.lat,
      lon: alert.region.lon,
      name: alert.region.name,
    },
    data: metadata,
    metadata,
  };
}
