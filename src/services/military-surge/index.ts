import type { SignalType } from '@/utils/analysis-constants';
import type { SurgeAlert } from './constants';

export {
  SENSITIVE_REGIONS,
  OPERATOR_HOMES,
  THEATERS,
  POSTURE_THEATERS,
  SURGE_THRESHOLD,
  BASELINE_WINDOW_HOURS,
  BASELINE_MIN_SAMPLES,
  TRANSPORT_CALLSIGN_PATTERNS,
  PROXIMITY_RADIUS_KM,
  CLEANUP_INTERVAL,
  MAX_HISTORY_HOURS,
  COUNTRY_TO_ISO,
  REGION_AFFECTED_COUNTRIES,
  TARGET_NATION_CODES,
} from './constants';

export type {
  GeoRegion,
  OperatorHomeRegions,
  MilitaryTheater,
  SurgeAlert,
  TheaterActivity,
  ForeignPresenceAlert,
  TheaterPostureSummary,
} from './constants';

export {
  analyzeFlightsForSurge,
  getActiveSurges,
  getTheaterActivity,
  classifyFlight,
  activityHistory,
} from './surge-detector';

export {
  detectForeignMilitaryPresence,
  getActiveForeignPresence,
  foreignPresenceToSignal,
} from './foreign-presence';

export {
  getTheaterPostureSummaries,
  recalcPostureWithVessels,
  getCriticalPostures,
} from './posture';

export function surgeAlertToSignal(surge: SurgeAlert): {
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
  const typeLabels = {
    airlift: '🛫 Military Airlift Surge',
    fighter: '✈️ Fighter Deployment Surge',
    reconnaissance: '🔭 Reconnaissance Surge',
  };

  const aircraftList = Array.from(surge.aircraftTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${count}x ${type}`)
    .join(', ');

  const severity = surge.surgeMultiple >= 4 ? 'critical' :
    surge.surgeMultiple >= 3 ? 'high' : 'medium';

  const confidence = Math.min(0.95, 0.6 + (surge.surgeMultiple - 2) * 0.1);

  const metadata = {
    theaterId: surge.theater.id,
    surgeType: surge.type,
    currentCount: surge.currentCount,
    baselineCount: surge.baselineCount,
    surgeMultiple: surge.surgeMultiple,
    aircraftTypes: Object.fromEntries(surge.aircraftTypes),
    nearbyBases: surge.nearbyBases,
  };

  return {
    id: `surge-${surge.id}-${surge.firstDetected.getTime()}`,
    type: 'military_surge',
    source: 'Military Flight Tracking',
    title: `${typeLabels[surge.type]} - ${surge.theater.name}`,
    description: `${surge.currentCount} ${surge.type} aircraft detected (${surge.surgeMultiple.toFixed(1)}x baseline). ` +
      `${aircraftList}. Near: ${surge.nearbyBases.slice(0, 3).join(', ')}`,
    severity,
    confidence,
    category: 'military',
    timestamp: surge.firstDetected,
    location: {
      lat: surge.theater.centerLat,
      lon: surge.theater.centerLon,
      name: surge.theater.name,
    },
    data: metadata,
    metadata,
  };
}
