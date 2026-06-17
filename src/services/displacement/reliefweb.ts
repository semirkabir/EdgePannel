import { createCircuitBreaker } from '@/utils';
import { matchCountryNamesInText } from '@/services/country-geometry';
import type { SupplementalSignal } from '@/services/supplemental-signal-bus';

export interface ReliefWebUpdate {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  country: string;
  categories: string[];
  summary: string;
  source: string;
}

interface ReliefWebResponse {
  updates: ReliefWebUpdate[];
  fetchedAt?: string;
  error?: string;
}

const breaker = createCircuitBreaker<ReliefWebUpdate[]>({
  name: 'ReliefWeb Updates',
  cacheTtlMs: 60 * 60 * 1000,
  persistCache: true,
});

let cachedUpdates: ReliefWebUpdate[] = [];

export async function fetchReliefWebUpdates(): Promise<ReliefWebUpdate[]> {
  const result = await breaker.execute(async () => {
    const response = await fetch('/api/reliefweb-updates', {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: ReliefWebResponse = await response.json();
    if (!Array.isArray(data.updates) || data.updates.length === 0) {
      throw new Error('Empty ReliefWeb response');
    }
    return data.updates;
  }, []);

  cachedUpdates = result;
  return result;
}

export function getCachedReliefWebUpdates(): ReliefWebUpdate[] {
  return cachedUpdates;
}

export function buildReliefWebSignals(updates: ReliefWebUpdate[]): SupplementalSignal[] {
  const signals: SupplementalSignal[] = [];
  const seen = new Set<string>();

  for (const update of updates.slice(0, 12)) {
    const text = `${update.title} ${update.country} ${update.categories.join(' ')}`;
    const countries = matchCountryNamesInText(text.toLowerCase());
    if (countries.length === 0) continue;

    const severity: SupplementalSignal['severity'] =
      /crisis|famine|displacement|emergency|funding|hunger|conflict/i.test(update.title)
        ? 'high'
        : 'medium';

    for (const country of countries.slice(0, 2)) {
      const key = `${country}-${update.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      signals.push({
        sourceId: 'reliefweb',
        sourceName: 'ReliefWeb',
        country,
        value: severity === 'high' ? 75 : 45,
        severity,
        label: update.title.slice(0, 90),
        timestamp: new Date(update.pubDate),
        tags: ['humanitarian', 'displacement', ...update.categories.slice(0, 2).map((c) => c.toLowerCase())],
      });
    }
  }

  return signals;
}