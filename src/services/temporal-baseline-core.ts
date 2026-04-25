import type { GetTemporalBaselineResponse, TemporalAnomaly as TemporalAnomalyProto } from '@/generated/client/worldmonitor/infrastructure/v1/service_client';

export type KnownTemporalEventType =
  | 'military_flights'
  | 'vessels'
  | 'protests'
  | 'news'
  | 'ais_gaps'
  | 'satellite_fires';

export type TemporalEventType = KnownTemporalEventType | (string & {});

export interface TemporalAnomaly {
  type: TemporalEventType;
  region: string;
  currentCount: number;
  expectedCount: number;
  zScore: number;
  message: string;
  severity: 'medium' | 'high' | 'critical';
}

const TYPE_LABELS: Record<KnownTemporalEventType, string> = {
  military_flights: 'Military flights',
  vessels: 'Naval vessels',
  protests: 'Protests',
  news: 'News velocity',
  ais_gaps: 'Dark ship activity',
  satellite_fires: 'Satellite fire detections',
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getTypeLabel(type: TemporalEventType): string {
  return TYPE_LABELS[type as KnownTemporalEventType] ?? type.replace(/_/g, ' ');
}

function formatAnomalyMessage(
  type: TemporalEventType,
  _region: string,
  count: number,
  mean: number,
  multiplier: number,
): string {
  const now = new Date();
  const weekday = WEEKDAY_NAMES[now.getUTCDay()];
  const month = MONTH_NAMES[now.getUTCMonth() + 1];
  const mult = multiplier < 10 ? `${multiplier.toFixed(1)}x` : `${Math.round(multiplier)}x`;
  return `${getTypeLabel(type)} ${mult} normal for ${weekday} (${month}) - ${count} vs baseline ${Math.round(mean)}`;
}

function getSeverity(zScore: number): 'medium' | 'high' | 'critical' {
  if (zScore >= 3.0) return 'critical';
  if (zScore >= 2.0) return 'high';
  return 'medium';
}

export function mapServerAnomaly(a: TemporalAnomalyProto): TemporalAnomaly {
  return {
    type: a.type as TemporalEventType,
    region: a.region,
    currentCount: a.currentCount,
    expectedCount: a.expectedCount,
    zScore: a.zScore,
    severity: getSeverity(a.zScore),
    message: a.message,
  };
}

export function mapTemporalBaselineResponse(
  type: TemporalEventType,
  region: string,
  count: number,
  data: GetTemporalBaselineResponse | null,
): TemporalAnomaly | null {
  if (!data?.anomaly) return null;

  return {
    type,
    region,
    currentCount: count,
    expectedCount: Math.round(data.baseline?.mean ?? 0),
    zScore: data.anomaly.zScore,
    severity: getSeverity(data.anomaly.zScore),
    message: formatAnomalyMessage(type, region, count, data.baseline?.mean ?? 0, data.anomaly.multiplier),
  };
}
