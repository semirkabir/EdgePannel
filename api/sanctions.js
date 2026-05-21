/**
 * OFAC SDN List proxy — fetches the US Treasury OFAC Specially Designated
 * Nationals Advanced JSON, normalises entries into a lightweight format, and
 * returns the 200 most-recent by UID (highest UID = more recently added).
 *
 * Source: https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.json
 * No API key required. Cache-Control: 6 hours (360 min).
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const OFAC_URL =
  'https://www.treasury.gov/ofac/downloads/sanctions/1.0/sdn_advanced.json';

const MAX_ENTRIES = 200;

function mapSdnType(sdnType) {
  switch ((sdnType || '').toLowerCase()) {
    case 'individual': return 'person';
    case 'entity':     return 'company';
    case 'vessel':     return 'vessel';
    case 'aircraft':   return 'aircraft';
    default:           return 'other';
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
    const response = await fetchWithTimeout(
      OFAC_URL,
      {
        headers: {
          'User-Agent': 'WorldMonitor/1.0 (edgepannel.app)',
          Accept: 'application/json',
        },
      },
      30000, // 30s — the full list is ~8MB
    );

    if (!response.ok) {
      throw new Error(`OFAC returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const publishDate =
      data?.sdnList?.publshInformation?.publishDate ||
      data?.sdnList?.publishInformation?.publishDate ||
      new Date().toISOString();

    const entries = data?.sdnList?.sdnEntry ?? [];

    // Sort by uid descending (higher uid = added later to the list)
    const sorted = [...entries].sort((a, b) => {
      const ua = parseInt(a.uid ?? '0', 10);
      const ub = parseInt(b.uid ?? '0', 10);
      return ub - ua;
    });

    const normalised = sorted.slice(0, MAX_ENTRIES).map(entry => ({
      id: `ofac-${entry.uid ?? entry.lastName?.slice(0, 12) ?? 'unk'}`,
      name: buildName(entry),
      type: mapSdnType(entry.sdnType),
      countries: extractCountries(entry),
      programs: extractPrograms(entry),
      dateAdded: publishDate,
      source: 'OFAC',
      aliases: extractAliases(entry),
    }));

    const payload = JSON.stringify({ entities: normalised, publishDate });

    return new Response(payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache 6 hours — OFAC list typically updated once per business day
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
        error: isTimeout ? 'OFAC timeout' : 'Failed to fetch OFAC SDN list',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}
