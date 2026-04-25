import {
  InfrastructureServiceClient,
  type GetTemporalBaselineResponse,
  type TemporalAnomaly as TemporalAnomalyProto,
} from '@/generated/client/worldmonitor/infrastructure/v1/service_client';
import { getHydratedData } from '@/services/bootstrap';
import { createCircuitBreaker } from '@/utils';
import { isLocalDevTaskEnabled } from '@/services/local-dev-stability';
import {
  mapServerAnomaly,
  mapTemporalBaselineResponse,
  type TemporalAnomaly,
  type TemporalEventType,
} from '@/services/temporal-baseline-core';

export { mapTemporalBaselineResponse };
export type { KnownTemporalEventType, TemporalAnomaly, TemporalEventType } from '@/services/temporal-baseline-core';

const client = new InfrastructureServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });
const reportBreaker = createCircuitBreaker<void>({ name: 'Temporal Baseline Update', cacheTtlMs: 5 * 60 * 1000 });
const checkBreakers = new Map<string, ReturnType<typeof createCircuitBreaker<GetTemporalBaselineResponse | null>>>();
const checkInflight = new Map<string, Promise<TemporalAnomaly | null>>();
let reportFailureLogged = false;
const checkFailureLogged = new Set<string>();

const SERVER_TYPES = new Set<string>(['news', 'satellite_fires']);

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
    breaker = createCircuitBreaker<GetTemporalBaselineResponse | null>({ name: `Temporal Baseline ${key}`, cacheTtlMs: 5 * 60 * 1000 });
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
    const anomaly = mapTemporalBaselineResponse(type, region, count, data);
    if (!anomaly) return null;
    checkFailureLogged.delete(key);
    return anomaly;
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
