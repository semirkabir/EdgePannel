import {
  CyberServiceClient,
  type KnownExploitedVulnerability,
  type ListKnownExploitedVulnsResponse,
} from '@/generated/client/worldmonitor/cyber/v1/service_client';
import { createCircuitBreaker } from '@/utils';

export type { KnownExploitedVulnerability };

const client = new CyberServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });
const breaker = createCircuitBreaker<ListKnownExploitedVulnsResponse>({
  name: 'CISA KEV',
  cacheTtlMs: 60 * 60 * 1000,
  persistCache: true,
});

const emptyFallback: ListKnownExploitedVulnsResponse = {
  vulnerabilities: [],
  pagination: { nextCursor: '', totalCount: 0 },
};

export async function fetchKnownExploitedVulns(limit = 12): Promise<KnownExploitedVulnerability[]> {
  const response = await breaker.execute(async () => {
    return client.listKnownExploitedVulns({ pageSize: limit, cursor: '', search: '' });
  }, emptyFallback);
  return response.vulnerabilities ?? [];
}