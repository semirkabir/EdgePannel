import type { PopupType } from '@/components/MapPopup';

export type ExternalEnrichmentStatus = 'ok' | 'empty' | 'skipped' | 'not_configured' | 'unavailable' | 'error';

export interface ExternalEnrichmentItem {
  title: string;
  subtitle: string;
  value: string;
  url: string;
  description?: string;
}

export interface ExternalEnrichmentSource {
  source: string;
  status: ExternalEnrichmentStatus;
  summary: string;
  sourceUrl?: string;
  items: ExternalEnrichmentItem[];
}

export interface ExternalEnrichmentResult {
  query: {
    name: string;
    ticker: string;
    type: string;
  };
  fetchedAt: string;
  sources: ExternalEnrichmentSource[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(data: unknown, keys: string[]): string {
  if (!isRecord(data)) return '';
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getExternalEnrichmentQuery(type: PopupType, data: unknown): { name: string; ticker: string } | null {
  const ticker = getString(data, ['ticker', 'symbol']).toUpperCase();
  const name = getString(data, [
    'name',
    'companyName',
    'institutionName',
    'title',
    'label',
    'shortName',
    'operator',
    'recipientName',
    'issuer',
  ]);

  if (!name && !ticker) return null;

  // Avoid noisy searches for event records whose title is not an entity name.
  const noisyTypes = new Set<PopupType>([
    'article',
    'hotspot',
    'earthquake',
    'weather',
    'fire',
    'positiveEvent',
    'kindnessEvent',
    'ucdpEvent',
    'protest',
    'protestCluster',
    'techEvent',
    'techEventCluster',
    'predictionMarket',
  ]);
  if (noisyTypes.has(type) && !ticker) return null;

  return { name: name || ticker, ticker };
}

export async function fetchExternalEnrichment(
  type: PopupType,
  data: unknown,
  signal?: AbortSignal,
): Promise<ExternalEnrichmentResult | null> {
  const query = getExternalEnrichmentQuery(type, data);
  if (!query) return null;

  const url = new URL('/api/external-enrichment', window.location.origin);
  url.searchParams.set('type', type);
  if (query.name) url.searchParams.set('name', query.name);
  if (query.ticker) url.searchParams.set('ticker', query.ticker);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) return null;
  const dataJson = await response.json() as ExternalEnrichmentResult & { error?: string };
  if (dataJson.error || !Array.isArray(dataJson.sources)) return null;
  return dataJson;
}
