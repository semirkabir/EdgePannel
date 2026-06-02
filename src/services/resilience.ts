import {
  ResilienceServiceClient,
  type GetResilienceScoreResponse,
  type GetResilienceRankingResponse,
} from '@/generated/client/worldmonitor/resilience/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getRpcBaseUrl } from '@/services/rpc-client';

const client = new ResilienceServiceClient(getRpcBaseUrl(), { fetch: (...args) => globalThis.fetch(...args) });

const scoreBreaker = createCircuitBreaker<GetResilienceScoreResponse>({
  name: 'Resilience Score',
  cacheTtlMs: 6 * 60 * 60 * 1000,
  persistCache: true,
});

const rankingBreaker = createCircuitBreaker<GetResilienceRankingResponse>({
  name: 'Resilience Ranking',
  cacheTtlMs: 6 * 60 * 60 * 1000,
  persistCache: true,
});

export type { GetResilienceScoreResponse, GetResilienceRankingResponse };
export type { ResilienceDomain, ResilienceDimension, ResilienceRankingItem } from '@/generated/client/worldmonitor/resilience/v1/service_client';

const EMPTY_SCORE: GetResilienceScoreResponse = { countryCode: '', overallScore: 0, level: '', domains: [], cronbachAlpha: 0, trend: '', change30d: 0, lowConfidence: false };
const EMPTY_RANKING: GetResilienceRankingResponse = { items: [] };

export async function fetchResilienceScore(countryCode: string, signal?: AbortSignal): Promise<GetResilienceScoreResponse | null> {
  const result = await scoreBreaker.execute(
    async () => client.getResilienceScore({ countryCode }, { signal }),
    EMPTY_SCORE,
    { cacheKey: `resilience-score:${countryCode}`, shouldCache: (r) => r.countryCode !== '' },
  );
  return result?.countryCode ? result : null;
}

export async function fetchResilienceRanking(signal?: AbortSignal): Promise<GetResilienceRankingResponse | null> {
  const result = await rankingBreaker.execute(
    async () => client.getResilienceRanking({}, { signal }),
    EMPTY_RANKING,
    { cacheKey: 'resilience-ranking', shouldCache: (r) => r.items.length > 0 },
  );
  return result?.items.length ? result : null;
}

export function getResilienceLevel(score: number): 'low' | 'normal' | 'elevated' | 'high' | 'critical' {
  if (score >= 80) return 'low';
  if (score >= 60) return 'normal';
  if (score >= 40) return 'elevated';
  if (score >= 20) return 'high';
  return 'critical';
}

export function getResilienceLevelLabel(level: string): string {
  switch (level) {
    case 'low': return 'Resilient';
    case 'normal': return 'Stable';
    case 'elevated': return 'Moderate';
    case 'high': return 'Fragile';
    case 'critical': return 'Critical';
    default: return level;
  }
}
