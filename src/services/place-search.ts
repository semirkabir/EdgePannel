import { createCircuitBreaker } from '@/utils';

export interface PlaceSearchResult {
  id: string;
  source: 'Nominatim' | 'Wikidata' | string;
  title: string;
  subtitle: string;
  lat: number | null;
  lon: number | null;
  type: string;
  importance: number;
  wikidataId: string;
  url: string;
}

interface PlaceSearchResponse {
  results: PlaceSearchResult[];
  query?: string;
  fetchedAt?: string;
  error?: string;
}

const breaker = createCircuitBreaker<PlaceSearchResult[]>({
  name: 'Place Search',
  cacheTtlMs: 5 * 60 * 1000,
  persistCache: false,
});

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return breaker.execute(async () => {
    const url = `/api/place-search?q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: PlaceSearchResponse = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  }, []);
}