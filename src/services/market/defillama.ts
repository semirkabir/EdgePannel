import { createCircuitBreaker } from '@/utils';

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  category: string;
  chain: string;
  tvl: number;
  tvlDisplay: string;
  change1d: number;
  change7d: number;
  url: string;
  source: string;
}

interface DefiLlamaResponse {
  protocols: DefiLlamaProtocol[];
  fetchedAt?: string;
  error?: string;
}

const breaker = createCircuitBreaker<DefiLlamaProtocol[]>({
  name: 'DefiLlama Protocols',
  cacheTtlMs: 60 * 60 * 1000,
  persistCache: true,
});

let cachedProtocols: DefiLlamaProtocol[] = [];

export async function fetchDefiLlamaProtocols(): Promise<DefiLlamaProtocol[]> {
  const result = await breaker.execute(async () => {
    const response = await fetch('/api/defillama-protocols', {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: DefiLlamaResponse = await response.json();
    if (!Array.isArray(data.protocols) || data.protocols.length === 0) {
      throw new Error('Empty DefiLlama response');
    }
    return data.protocols;
  }, []);

  cachedProtocols = result;
  return result;
}

export function getCachedDefiLlamaProtocols(): DefiLlamaProtocol[] {
  return cachedProtocols;
}