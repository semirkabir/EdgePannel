import { InfrastructureServiceClient, type TemporalAnomaly as TemporalAnomalyProto } from '@/generated/client/worldmonitor/infrastructure/v1/service_client';
import { getHydratedData } from '@/services/bootstrap';
import { createCircuitBreaker } from '@/utils';
import { isLocalDevTaskEnabled } from '@/services/local-dev-stability';

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

const client = new InfrastructureServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });
const reportBreaker = createCircuitBreaker<void>({ name: 'Temporal Baseline Update', cacheTtlMs: 5 * 60 * 1000 });
const checkBreakers = new Map<string, ReturnType<typeof createCircuitBreaker<TemporalAnomaly | null>>>();
const checkInflight = new Map<string, Promise<TemporalAnomaly | null>>();
let reportFailureLogged = false;
const checkFailureLogged = new Set<string>();

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

const SERVER_TYPES = new Set<string>(['news', 'satellite_fires']);

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

function mapServerAnomaly(a: TemporalAnomalyProto): TemporalAnomaly {
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

export function consumeServerAnomalies(): { anomalies: TemporalAnomaly[]; trackedTypes: string[] } {
  const raw = getHydratedData('temporalAnomalies') as {
    anomalies?: TemporalAnomalyProto[];
    trackedTypes?: string[];
    computedAt?: string;
  } | undefined;

  if (!raw?.anomalies) return { anomalies: [], trackedTypes: [] };
  return {
    anomalies: raw.anomalies.map(mapServerAnomaly),
    trackedTypes: raw.trackedTypes ?? [],
  };
}

export async function fetchLiveAnomalies(): Promise<{ anomalies: TemporalAnomaly[]; trackedTypes: string[] }> {
  try {
    const resp = await client.listTemporalAnomalies({});
    return {
      anomalies: (resp.anomalies ?? []).map(mapServerAnomaly),
      trackedTypes: resp.trackedTypes ?? [],
    };
  } catch (e) {
    console.warn('[TemporalBaseline] Live fetch failed:', e);
    return { anomalies: [], trackedTypes: [] };
  }
}

// Client-side baseline for types NOT handled server-side (military_flights, vessels, ais_gaps)
async function reportMetrics(
  updates: Array<{ type: TemporalEventType; region: string; count: number }>
): Promise<void> {
  if (!isLocalDevTaskEnabled('temporalBaseline')) return;

  try {
    await reportBreaker.execute(async () => {
      await client.recordBaselineSnapshot({ updates });
    }, undefined);
    reportFailureLogged = false;
  } catch (e) {
    if (!reportFailureLogged) {
      console.warn('[TemporalBaseline] Update unavailable; using local fallback only');
      reportFailureLogged = true;
    }
  }
}

function getCheckBreaker(key: string) {
  let breaker = checkBreakers.get(key);
  if (!breaker) {
    breaker = createCircuitBreaker<TemporalAnomaly | null>({ name: `Temporal Baseline ${key}`, cacheTtlMs: 5 * 60 * 1000 });
    checkBreakers.set(key, breaker);
  }
  return breaker;
}

async function checkAnomaly(
  type: TemporalEventType,
  region: string,
  count: number,
): Promise<TemporalAnomaly | null> {
  if (!isLocalDevTaskEnabled('temporalBaseline')) return null;

  const key = `${type}:${region}`;
  const inflight = checkInflight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
  try {
    const data = await getCheckBreaker(key).execute(async () => {
      return client.getTemporalBaseline({ type, region, count });
    }, null);
    if (!data?.anomaly) return null;
    checkFailureLogged.delete(key);

    return {
      type,
      region,
      currentCount: count,
      expectedCount: Math.round(data.baseline?.mean ?? 0),
      zScore: data.anomaly.zScore,
      severity: getSeverity(data.anomaly.zScore),
      message: formatAnomalyMessage(type, region, count, data.baseline?.mean ?? 0, data.anomaly.multiplier),
    };
  } catch (e) {
    if (!checkFailureLogged.has(key)) {
      console.warn(`[TemporalBaseline] Baseline check unavailable for ${key}`);
      checkFailureLogged.add(key);
    }
    return null;
  }
  })();

  checkInflight.set(key, task);
  try {
    return await task;
  } finally {
    checkInflight.delete(key);
  }
}

export async function updateAndCheck(
  metrics: Array<{ type: TemporalEventType; region: string; count: number }>
): Promise<TemporalAnomaly[]> {
  const clientOnly = metrics.filter(m => !SERVER_TYPES.has(m.type));
  if (clientOnly.length === 0) return [];

  reportMetrics(clientOnly).catch(() => {});

  const results = await Promise.allSettled(
    clientOnly.map(m => checkAnomaly(m.type, m.region, m.count))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<TemporalAnomaly | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((a): a is TemporalAnomaly => a !== null)
    .sort((a, b) => b.zScore - a.zScore);
}
