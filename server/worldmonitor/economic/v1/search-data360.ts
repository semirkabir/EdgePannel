/**
 * RPC: searchData360 -- proxy Data360 searchv2 endpoint
 *
 * Searches Data360 indicators/databases by keyword using Azure Cognitive Search.
 */

import type {
  ServerContext,
  SearchData360Request,
  SearchData360Response,
  SearchData360Result,
} from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';

import { CHROME_UA } from '../../../_shared/constants';
import { cachedFetchJson } from '../../../_shared/redis';

interface Data360SearchHit {
  id?: string;
  name?: string;
  database_id?: string;
  description?: string;
  // The API may return nested objects with different field names
  'series_description/idno'?: string;
  'series_description/name'?: string;
  'series_description/database_id'?: string;
  [key: string]: unknown;
}

interface Data360SearchResponse {
  value?: Data360SearchHit[];
  '@odata.count'?: number;
}

const SEARCH_URL = 'https://data360api.worldbank.org/data360/searchv2';

export async function searchData360(
  _ctx: ServerContext,
  req: SearchData360Request,
): Promise<SearchData360Response> {
  try {
    const { query } = req;
    if (!query) return { results: [], totalCount: 0 };

    const top = req.top > 0 ? Math.min(req.top, 100) : 20;
    const cacheKey = `economic:data360:search:${query}:${top}:${req.filter || ''}:${req.select || ''}`;

    const result = await cachedFetchJson<SearchData360Response>(cacheKey, 86400, async () => {
      const body: Record<string, unknown> = {
        search: query,
        top,
      };
      if (req.filter) body['filter'] = req.filter;
      if (req.select) body['select'] = req.select;

      const response = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': CHROME_UA,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        console.warn(`[data360] Search API returned ${response.status}`);
        return null;
      }

      const data = await response.json() as Data360SearchResponse;
      if (!data || !data.value) return null;

      return data;
    });

    if (!result || !result.value) return { results: [], totalCount: 0 };

    const results: SearchData360Result[] = result.value.map((hit) => ({
      id: hit['series_description/idno'] || hit.id || '',
      name: hit['series_description/name'] || hit.name || '',
      databaseId: hit['series_description/database_id'] || hit.database_id || '',
      description: hit.description || '',
    }));

    return {
      results,
      totalCount: result['@odata.count'] || results.length,
    };
  } catch (err) {
    console.warn('[data360] searchData360 error:', err instanceof Error ? err.message : String(err));
    return { results: [], totalCount: 0 };
  }
}