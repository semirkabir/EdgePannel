/**
 * WHO Global Health Observatory — capped outbreak indicators (no API key).
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const GHO_BASE = 'https://ghoapi.azureedge.net/api';
const MAX_INDICATORS = 12;

const INDICATOR_QUERIES = [
  {
    code: 'WHS3_62',
    name: 'Measles cases',
    unit: 'cases',
    filter: 'TimeDim ge 2022 and SpatialDimType eq \'COUNTRY\' and NumericValue gt 1000',
  },
  {
    code: 'WHS2_152',
    name: 'Malaria deaths',
    unit: 'per 100k',
    filter: 'TimeDim ge 2020 and SpatialDimType eq \'COUNTRY\' and NumericValue gt 50',
  },
];

async function fetchIndicatorRows({ code, name, unit, filter }) {
  const url = `${GHO_BASE}/${code}?$filter=${encodeURIComponent(filter)}&$orderby=NumericValue desc&$top=20&$select=SpatialDim,TimeDim,NumericValue`;
  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'WorldMonitor/1.0 (edgepannel.app)' },
  }, 15000);

  if (!response.ok) throw new Error(`WHO GHO ${code} HTTP ${response.status}`);
  const data = await response.json();
  const rows = Array.isArray(data.value) ? data.value : [];

  const byCountry = new Map();
  for (const row of rows) {
    const countryCode = String(row.SpatialDim || '').toUpperCase();
    if (!countryCode || countryCode.length !== 3 || countryCode === 'GLOBAL') continue;
    const year = Number(row.TimeDim) || 0;
    const value = Number(row.NumericValue) || 0;
    const existing = byCountry.get(countryCode);
    if (!existing || year > existing.year) {
      byCountry.set(countryCode, { countryCode, year, value });
    }
  }

  return [...byCountry.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((row) => ({
      id: `who-gho:${code}:${row.countryCode}`,
      indicatorCode: code,
      indicatorName: name,
      countryCode: row.countryCode,
      year: row.year,
      value: Math.round(row.value),
      unit,
      source: 'WHO GHO',
    }));
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
    const results = await Promise.allSettled(INDICATOR_QUERIES.map(fetchIndicatorRows));
    const indicators = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        indicators.push(...result.value);
      }
    }

    const capped = indicators
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_INDICATORS);

    if (capped.length === 0) {
      throw new Error('No WHO GHO indicators available');
    }

    return new Response(JSON.stringify({ indicators: capped, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=43200',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[who-gho] error:', error?.message);
    return new Response(
      JSON.stringify({
        indicators: [],
        error: isTimeout ? 'WHO GHO timeout' : 'Failed to fetch WHO GHO indicators',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}