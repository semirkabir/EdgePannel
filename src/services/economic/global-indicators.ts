import { createCircuitBreaker } from '@/utils';

export interface GlobalIndicator {
  id: string;
  name: string;
  value: number;
  unit: string;
  period: string;
  source: string;
  region: string;
}

interface GlobalIndicatorsResponse {
  indicators: GlobalIndicator[];
  fetchedAt?: string;
  error?: string;
}

const breaker = createCircuitBreaker<GlobalIndicator[]>({
  name: 'Global Indicators',
  cacheTtlMs: 6 * 60 * 60 * 1000,
  persistCache: true,
});

let cachedIndicators: GlobalIndicator[] = [];

export async function fetchGlobalIndicators(): Promise<GlobalIndicator[]> {
  const result = await breaker.execute(async () => {
    const response = await fetch('/api/global-indicators', {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: GlobalIndicatorsResponse = await response.json();
    if (!Array.isArray(data.indicators) || data.indicators.length === 0) {
      throw new Error('Empty global indicators response');
    }
    return data.indicators;
  }, []);

  cachedIndicators = result;
  return result;
}

export function getCachedGlobalIndicators(): GlobalIndicator[] {
  return cachedIndicators;
}