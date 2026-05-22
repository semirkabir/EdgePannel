import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const CACHE_TTL_SECONDS = 1800;
const cache = new Map();

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      'Cache-Control': status >= 200 && status < 300
        ? `public, max-age=300, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`
        : 'public, max-age=30, s-maxage=60',
    },
  });
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL_SECONDS * 1000) return null;
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { ts: Date.now(), data });
  return data;
}

function cleanName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function sourceStatus(source, status, summary, items = [], extra = {}) {
  return { source, status, summary, items, ...extra };
}

function normalizeUrl(url) {
  try {
    return new URL(url).toString();
  } catch {
    return '';
  }
}

async function fetchOpenFigi(ticker) {
  if (!ticker) return sourceStatus('OpenFIGI', 'skipped', 'Ticker not available for instrument mapping.');

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.OPENFIGI_API_KEY) headers['X-OPENFIGI-APIKEY'] = process.env.OPENFIGI_API_KEY;

  const response = await fetchWithTimeout('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers,
    body: JSON.stringify([{ idType: 'TICKER', idValue: ticker, exchCode: 'US' }]),
  }, 12_000);
  if (!response.ok) throw new Error(`OpenFIGI HTTP ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data?.[0]?.data) ? data[0].data.slice(0, 4) : [];
  if (results.length === 0) return sourceStatus('OpenFIGI', 'empty', 'No OpenFIGI mapping found.');

  return sourceStatus(
    'OpenFIGI',
    'ok',
    `Mapped ${ticker} to ${results[0].figi || 'instrument metadata'}.`,
    results.map((item) => ({
      title: [item.ticker, item.name].filter(Boolean).join(' - '),
      subtitle: [item.securityType, item.marketSector, item.exchCode].filter(Boolean).join(' · '),
      value: item.figi || item.compositeFIGI || '',
      url: 'https://www.openfigi.com/',
    })),
  );
}

async function fetchCourtListener(name) {
  const url = new URL('https://www.courtlistener.com/api/rest/v4/search/');
  url.searchParams.set('q', name);
  url.searchParams.set('type', 'r');
  url.searchParams.set('order_by', 'score desc');

  const headers = { Accept: 'application/json' };
  if (process.env.COURTLISTENER_API_TOKEN) headers.Authorization = `Token ${process.env.COURTLISTENER_API_TOKEN}`;

  const response = await fetchWithTimeout(url.toString(), { headers }, 12_000);
  if (!response.ok) throw new Error(`CourtListener HTTP ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results.slice(0, 5) : [];

  return sourceStatus(
    'CourtListener',
    results.length ? 'ok' : 'empty',
    results.length ? `${data.count ?? results.length} legal search hits; showing top ${results.length}.` : 'No CourtListener legal search hits.',
    results.map((item) => ({
      title: item.caseName || item.case_name || item.caseNameFull || 'Case result',
      subtitle: [item.court_citation_string || item.court, item.dateFiled, item.docketNumber].filter(Boolean).join(' · '),
      value: item.suitNature || item.cause || item.jurisdictionType || '',
      url: item.absolute_url ? `https://www.courtlistener.com${item.absolute_url}` :
        item.docket_absolute_url ? `https://www.courtlistener.com${item.docket_absolute_url}` : '',
    })),
  );
}

async function fetchOpenAlex(name) {
  const url = new URL('https://api.openalex.org/institutions');
  url.searchParams.set('search', name);
  url.searchParams.set('per-page', '5');
  url.searchParams.set('select', 'id,display_name,country_code,type,works_count,cited_by_count,summary_stats,homepage_url');
  if (process.env.OPENALEX_MAILTO) url.searchParams.set('mailto', process.env.OPENALEX_MAILTO);

  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: 'application/json' } }, 12_000);
  if (!response.ok) throw new Error(`OpenAlex HTTP ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results.slice(0, 5) : [];

  return sourceStatus(
    'OpenAlex',
    results.length ? 'ok' : 'empty',
    results.length ? `Found ${results.length} research institution/entity matches.` : 'No OpenAlex institution matches.',
    results.map((item) => ({
      title: item.display_name || 'OpenAlex result',
      subtitle: [item.type, item.country_code].filter(Boolean).join(' · '),
      value: `${Number(item.works_count || 0).toLocaleString()} works · ${Number(item.cited_by_count || 0).toLocaleString()} citations`,
      url: item.id || item.homepage_url || '',
    })),
  );
}

async function fetchUsaSpending(name) {
  const end = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);
  const start = startDate.toISOString().split('T')[0];

  const body = {
    filters: {
      recipient_search_text: [name],
      time_period: [{ start_date: start, end_date: end }],
      award_type_codes: ['A', 'B', 'C', 'D'],
    },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Description', 'Start Date', 'Award Type'],
    limit: 5,
    sort: 'Award Amount',
    order: 'desc',
  };

  const response = await fetchWithTimeout('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  }, 20_000);
  if (!response.ok) throw new Error(`USAspending HTTP ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results.slice(0, 5) : [];
  const total = results.reduce((sum, item) => sum + (Number(item['Award Amount']) || 0), 0);

  return sourceStatus(
    'USAspending',
    results.length ? 'ok' : 'empty',
    results.length ? `${results.length} recent recipient award matches; shown value ${formatUsd(total)}.` : 'No recent USAspending recipient matches.',
    results.map((item) => ({
      title: item['Recipient Name'] || 'Award recipient',
      subtitle: [item['Awarding Agency'], item['Start Date']].filter(Boolean).join(' · '),
      value: formatUsd(Number(item['Award Amount']) || 0),
      url: item['Award ID'] ? `https://www.usaspending.gov/award/${encodeURIComponent(item['Award ID'])}` : 'https://www.usaspending.gov/',
      description: String(item.Description || '').slice(0, 180),
    })),
  );
}

async function fetchOpenSanctions(name, type) {
  const key = process.env.OPENSANCTIONS_API_KEY || '';
  if (!key) {
    return sourceStatus('OpenSanctions', 'not_configured', 'Set OPENSANCTIONS_API_KEY to enable live sanctions/PEP matching.');
  }
  const schema = type === 'congressPolitician' ? 'Person' : 'LegalEntity';
  const response = await fetchWithTimeout('https://api.opensanctions.org/match/default', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `ApiKey ${key}` },
    body: JSON.stringify({ queries: { q0: { schema, properties: { name: [name] } } } }),
  }, 15_000);
  if (!response.ok) throw new Error(`OpenSanctions HTTP ${response.status}`);
  const data = await response.json();
  const matches = data?.responses?.q0?.results || data?.results || [];
  const items = Array.isArray(matches) ? matches.slice(0, 5) : [];

  return sourceStatus(
    'OpenSanctions',
    items.length ? 'ok' : 'empty',
    items.length ? `${items.length} OpenSanctions match candidates.` : 'No OpenSanctions match candidates.',
    items.map((match) => {
      const entity = match.entity || match;
      const props = entity.properties || {};
      return {
        title: props.name?.[0] || entity.caption || entity.name || 'Sanctions match',
        subtitle: [entity.schema, props.country?.join(', ')].filter(Boolean).join(' · '),
        value: match.score ? `score ${Math.round(match.score * 100)}%` : '',
        url: entity.id ? `https://www.opensanctions.org/entities/${encodeURIComponent(entity.id)}/` : 'https://www.opensanctions.org/',
      };
    }),
  );
}

async function fetchPatentsView(name) {
  return sourceStatus(
    'PatentsView',
    'unavailable',
    'PatentsView legacy API currently redirects to USPTO transition guidance; live assignee search is not enabled.',
    [],
    { sourceUrl: 'https://data.uspto.gov/support/transition-guide/patentsview' },
  );
}

function formatUsd(value) {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

async function safeProvider(name, fn) {
  try {
    return await fn();
  } catch (error) {
    return sourceStatus(name, 'error', error instanceof Error ? error.message : String(error));
  }
}

export default async function handler(req) {
  const cors = getCorsHeaders(req, 'GET, OPTIONS');
  if (isDisallowedOrigin(req)) return json(req, { error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return json(req, { error: 'Method not allowed' }, 405);

  const url = new URL(req.url);
  const name = cleanName(url.searchParams.get('name'));
  const ticker = cleanName(url.searchParams.get('ticker')).toUpperCase();
  const type = cleanName(url.searchParams.get('type'));

  if (!name && !ticker) return json(req, { error: 'name or ticker is required' }, 400);

  const queryName = name || ticker;
  const cacheKey = JSON.stringify({ name: queryName.toLowerCase(), ticker, type });
  const cached = cacheGet(cacheKey);
  if (cached) return json(req, cached);

  const sources = await Promise.all([
    safeProvider('OpenFIGI', () => fetchOpenFigi(ticker)),
    safeProvider('CourtListener', () => fetchCourtListener(queryName)),
    safeProvider('OpenAlex', () => fetchOpenAlex(queryName)),
    safeProvider('USAspending', () => fetchUsaSpending(queryName)),
    safeProvider('OpenSanctions', () => fetchOpenSanctions(queryName, type)),
    safeProvider('PatentsView', () => fetchPatentsView(queryName)),
  ]);

  const payload = {
    query: { name: queryName, ticker, type },
    fetchedAt: new Date().toISOString(),
    sources: sources.filter(Boolean).map((source) => ({
      ...source,
      items: (source.items || []).map((item) => ({ ...item, url: normalizeUrl(item.url) })),
    })),
  };

  return json(req, cacheSet(cacheKey, payload));
}
