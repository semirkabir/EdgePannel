/**
 * Place / entity search — Nominatim forward + Wikidata (no API keys).
 * Nominatim: max 1 req/sec per their usage policy.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const USER_AGENT = 'EdgePannel/2.0 (https://edgepannel.app)';
const MIN_QUERY_LEN = 2;
const MAX_PLACES = 5;
const MAX_ENTITIES = 5;

let lastNominatimRequest = 0;

async function throttleNominatim() {
  const now = Date.now();
  const wait = 1100 - (now - lastNominatimRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimRequest = Date.now();
}

async function searchNominatim(query) {
  await throttleNominatim();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(MAX_PLACES));
  url.searchParams.set('accept-language', 'en');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  }, 12000);

  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data) ? data : []).map((item) => ({
    id: `nominatim:${item.osm_type || 'node'}:${item.osm_id || item.place_id}`,
    source: 'Nominatim',
    title: String(item.name || item.display_name || '').split(',')[0].trim(),
    subtitle: String(item.display_name || '').slice(0, 120),
    lat: Number(item.lat),
    lon: Number(item.lon),
    type: String(item.type || item.class || 'place'),
    importance: Number(item.importance) || 0,
    wikidataId: '',
    url: `https://www.openstreetmap.org/${item.osm_type || 'node'}/${item.osm_id || ''}`,
  })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

async function searchWikidata(query) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(MAX_ENTITIES));

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  }, 12000);

  if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data.search) ? data.search : []).map((item) => ({
    id: `wikidata:${item.id}`,
    source: 'Wikidata',
    title: String(item.label || item.id),
    subtitle: String(item.description || '').slice(0, 120),
    lat: null,
    lon: null,
    type: 'entity',
    importance: 0,
    wikidataId: String(item.id || ''),
    url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
  }));
}

function dedupeResults(places, entities) {
  const seen = new Set();
  const merged = [];

  for (const item of [...places, ...entities]) {
    const key = `${item.source}:${item.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const query = String(url.searchParams.get('q') || '').trim();

  if (query.length < MIN_QUERY_LEN) {
    return new Response(JSON.stringify({ results: [], error: 'Query too short' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const [placesResult, entitiesResult] = await Promise.allSettled([
      searchNominatim(query),
      searchWikidata(query),
    ]);

    const places = placesResult.status === 'fulfilled' ? placesResult.value : [];
    const entities = entitiesResult.status === 'fulfilled' ? entitiesResult.value : [];
    const results = dedupeResults(places, entities);

    return new Response(JSON.stringify({ results, query, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[place-search] error:', error?.message);
    return new Response(
      JSON.stringify({ results: [], error: isTimeout ? 'Place search timeout' : 'Place search failed' }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}