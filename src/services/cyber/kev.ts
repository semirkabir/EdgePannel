import {
  CyberServiceClient,
  type KnownExploitedVulnerability,
  type ListKnownExploitedVulnsResponse,
} from '@/generated/client/worldmonitor/cyber/v1/service_client';
import { dataFreshness } from '@/services/data-freshness';
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
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number.isFinite(limit) ? limit : 12)));
  const response = await breaker.execute(async () => {
    return client.listKnownExploitedVulns({ pageSize, cursor: '', search: '' });
  }, emptyFallback, {
    shouldCache: (result) => (result.vulnerabilities?.length ?? 0) > 0,
  });

  const vulnerabilities = response.vulnerabilities ?? [];
  if (vulnerabilities.length > 0) {
    dataFreshness.recordUpdate('cisa_kev', vulnerabilities.length);
  } else {
    dataFreshness.recordError('cisa_kev', 'CISA KEV returned no entries');
  }
  return vulnerabilities;
}
