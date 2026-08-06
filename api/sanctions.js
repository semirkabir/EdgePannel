/**
 * Sanctions proxy — merges US Treasury OFAC SDN with OpenSanctions bulk datasets.
 *
 * Sources:
 *   - OFAC: https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.json
 *   - OpenSanctions: https://data.opensanctions.org/datasets/latest/index.json
 *
 * No API key required. Cache-Control: 6 hours.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const OFAC_URL =
  'https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.json';
const OPENSANCTIONS_INDEX_URL =
  'https://data.opensanctions.org/datasets/latest/index.json';

const MAX_OFAC_ENTRIES = 200;
const MAX_OPENSANCTIONS_ENTRIES = 200;
const MAX_TOTAL_ENTRIES = 400;

const OPENSANCTIONS_DATASETS = [
  'eu_sanctions_map',
  'un_sc_sanctions',
  'gb_fcdo_sanctions',
];

const SCHEMA_TYPE_MAP = {
  Person: 'person',
  Company: 'company',
  Organization: 'company',
  LegalEntity: 'company',
  Vessel: 'vessel',
  Airplane: 'aircraft',
  Aircraft: 'aircraft',
};

function mapSdnType(sdnType) {
  switch ((sdnType || '').toLowerCase()) {
    case 'individual': return 'person';
    case 'entity': return 'company';
    case 'vessel': return 'vessel';
    case 'aircraft': return 'aircraft';
    default: return 'other';
  }
}

function extractCountries(entry) {
  const countries = new Set();
  for (const addr of entry.addressList?.address ?? []) {
    if (addr.country) countries.add(addr.country.toUpperCase());
  }
  for (const nat of entry.nationalityList?.nationality ?? []) {
    if (nat.country) countries.add(nat.country.toUpperCase());
  }
  return [...countries].filter(Boolean).slice(0, 5);
}

function extractAliases(entry) {
  return (entry.akaList?.aka ?? [])
    .filter(a => a.type === 'a.k.a.' && a.lastName)
    .map(a => [a.firstName, a.lastName].filter(Boolean).join(' ').trim())
    .slice(0, 4);
}

function extractPrograms(entry) {
  return (entry.programList?.program ?? []).slice(0, 6);
}

function buildName(entry) {
  if (entry.firstName) {
    return [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
  }
  return (entry.lastName || '').trim();
}

function normalizeNameKey(name) {
  return (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function inferOpenSanctionsSource(datasets = []) {
  if (datasets.some(d => d.startsWith('us_ofac') || d === 'us_trade_csl')) return 'OFAC';
  if (datasets.some(d => d.startsWith('eu_'))) return 'EU';
  if (datasets.some(d => d.startsWith('un_'))) return 'UN';
  if (datasets.some(d => d.startsWith('gb_'))) return 'UK';
  if (datasets.some(d => d.startsWith('ua_'))) return 'UA';
  return 'OpenSanctions';
}

function mapFtmSchema(schema) {
  return SCHEMA_TYPE_MAP[schema] || 'other';
}

function parseFtmEntity(raw) {
  if (!raw?.target) return null;
  if (!raw.caption || !raw.id) return null;

  const topics = raw.properties?.topics ?? [];
  const isSanctioned = topics.some(t =>
    ['sanction', 'crime', 'debarment', 'wanted', 'poi'].includes(t),
  );
  if (!isSanctioned && !raw.datasets?.some(d => OPENSANCTIONS_DATASETS.includes(d))) {
    return null;
  }

  const countries = [...new Set((raw.properties?.country ?? []).map(c => String(c).toUpperCase()))]
    .filter(Boolean)
    .slice(0, 5);
  const programs = [...new Set([
    ...(raw.properties?.programId ?? []),
    ...(raw.datasets ?? []).slice(0, 3),
  ])].slice(0, 6);
  const aliases = [...new Set(raw.properties?.alias ?? [])].slice(0, 4);
  const source = inferOpenSanctionsSource(raw.datasets);

  return {
    id: `os-${raw.id}`,
    name: raw.caption,
    type: mapFtmSchema(raw.schema),
    countries,
    programs,
    dateAdded: raw.last_change || raw.last_seen || new Date().toISOString(),
    source,
    aliases,
    opensanctionsId: raw.id,
  };
}

async function fetchOpenSanctionsDatasetUrls() {
  const response = await fetchWithTimeout(
    OPENSANCTIONS_INDEX_URL,
    { headers: { Accept: 'application/json', 'User-Agent': 'WorldMonitor/1.0 (edgepannel.com)' } },
    15000,
  );
  if (!response.ok) throw new Error(`OpenSanctions index HTTP ${response.status}`);

  const index = await response.json();
  const urls = [];
  for (const datasetName of OPENSANCTIONS_DATASETS) {
    const dataset = index.datasets?.find(d => d.name === datasetName);
    const resource = dataset?.resources?.find(r => r.name === 'entities.ftm.json');
    if (resource?.url) urls.push(resource.url);
  }
  return urls;
}

async function fetchOpenSanctionsEntities() {
  const urls = await fetchOpenSanctionsDatasetUrls();
  const entities = [];

  for (const url of urls) {
    if (entities.length >= MAX_OPENSANCTIONS_ENTRIES) break;

    const response = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/json', 'User-Agent': 'WorldMonitor/1.0 (edgepannel.com)' } },
      25000,
    );
    if (!response.ok) continue;

    const text = await response.text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entity = parseFtmEntity(JSON.parse(line));
        if (entity) entities.push(entity);
      } catch {
        // skip malformed lines
      }
      if (entities.length >= MAX_OPENSANCTIONS_ENTRIES) break;
    }
  }

  return entities.sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)));
}

async function fetchOfacEntities() {
  const response = await fetchWithTimeout(
    OFAC_URL,
    {
      headers: {
        'User-Agent': 'WorldMonitor/1.0 (edgepannel.com)',
        Accept: 'application/json',
      },
    },
    30000,
  );

  if (!response.ok) throw new Error(`OFAC returned HTTP ${response.status}`);

  const data = await response.json();
  const publishDate =
    data?.sdnList?.publshInformation?.publishDate ||
    data?.sdnList?.publishInformation?.publishDate ||
    new Date().toISOString();

  const entries = data?.sdnList?.sdnEntry ?? [];
  const sorted = [...entries].sort((a, b) => {
    const ua = parseInt(a.uid ?? '0', 10);
    const ub = parseInt(b.uid ?? '0', 10);
    return ub - ua;
  });

  return sorted.slice(0, MAX_OFAC_ENTRIES).map(entry => ({
    id: `ofac-${entry.uid ?? entry.lastName?.slice(0, 12) ?? 'unk'}`,
    name: buildName(entry),
    type: mapSdnType(entry.sdnType),
    countries: extractCountries(entry),
    programs: extractPrograms(entry),
    dateAdded: publishDate,
    source: 'OFAC',
    aliases: extractAliases(entry),
  }));
}

function mergeSanctionEntities(ofacEntities, openSanctionsEntities) {
  const merged = [];
  const seenNames = new Set();

  for (const entity of ofacEntities) {
    const key = normalizeNameKey(entity.name);
    if (!key || seenNames.has(key)) continue;
    seenNames.add(key);
    merged.push(entity);
  }

  for (const entity of openSanctionsEntities) {
    const key = normalizeNameKey(entity.name);
    if (!key || seenNames.has(key)) continue;
    seenNames.add(key);
    merged.push(entity);
    if (merged.length >= MAX_TOTAL_ENTRIES) break;
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

  try {
    const [ofacResult, osResult] = await Promise.allSettled([
      fetchOfacEntities(),
      fetchOpenSanctionsEntities(),
    ]);

    const ofacEntities = ofacResult.status === 'fulfilled' ? ofacResult.value : [];
    const openSanctionsEntities = osResult.status === 'fulfilled' ? osResult.value : [];

    if (ofacResult.status === 'rejected') {
      console.error('[sanctions proxy] OFAC error:', ofacResult.reason?.message);
    }
    if (osResult.status === 'rejected') {
      console.error('[sanctions proxy] OpenSanctions error:', osResult.reason?.message);
    }

    const entities = mergeSanctionEntities(ofacEntities, openSanctionsEntities);
    if (entities.length === 0) {
      throw new Error('No sanctions data from OFAC or OpenSanctions');
    }

    const publishDate = new Date().toISOString();
    const payload = JSON.stringify({ entities, publishDate });

    return new Response(payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=43200, stale-if-error=86400',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[sanctions proxy] error:', error?.message);
    return new Response(
      JSON.stringify({
        entities: [],
        error: isTimeout ? 'Sanctions timeout' : 'Failed to fetch sanctions data',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}