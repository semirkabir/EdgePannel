/**
 * Global economic indicators router — Eurostat + US Treasury (no API keys).
 * OECD SDMX is Cloudflare-blocked from server-side fetch; omitted gracefully.
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const TREASURY_DEBT_URL =
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=1';

function recentMonths(count = 4) {
  const months = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

async function fetchEurostatUnemployment() {
  for (const period of recentMonths(6)) {
    const url = `${EUROSTAT_BASE}/UNE_RT_M?geo=EU27_2020&s_adj=SA&age=TOTAL&unit=PC_ACT&sex=T&time=${period}`;
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'WorldMonitor/1.0 (edgepannel.com)' },
    }, 12000);
    if (!response.ok) continue;

    const data = await response.json();
    const value = data?.value?.['0'];
    if (typeof value === 'number') {
      return {
        id: 'eu-unemployment',
        name: 'EU Unemployment',
        value,
        unit: '%',
        period,
        source: 'Eurostat',
        region: 'EU27',
      };
    }
  }
  return null;
}

async function fetchTreasuryDebt() {
  const response = await fetchWithTimeout(TREASURY_DEBT_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'WorldMonitor/1.0 (edgepannel.com)' },
  }, 12000);
  if (!response.ok) return null;

  const data = await response.json();
  const row = data?.data?.[0];
  if (!row?.tot_pub_debt_out_amt) return null;

  const debtTrillions = Number(row.tot_pub_debt_out_amt) / 1_000_000_000_000;
  return {
    id: 'us-national-debt',
    name: 'US National Debt',
    value: +debtTrillions.toFixed(2),
    unit: 'T USD',
    period: row.record_date,
    source: 'Treasury',
    region: 'US',
  };
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
    const [eurostatResult, treasuryResult] = await Promise.allSettled([
      fetchEurostatUnemployment(),
      fetchTreasuryDebt(),
    ]);

    const indicators = [];
    if (eurostatResult.status === 'fulfilled' && eurostatResult.value) {
      indicators.push(eurostatResult.value);
    }
    if (treasuryResult.status === 'fulfilled' && treasuryResult.value) {
      indicators.push(treasuryResult.value);
    }

    if (indicators.length === 0) {
      throw new Error('No global indicators available');
    }

    return new Response(JSON.stringify({ indicators, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=43200',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[global-indicators] error:', error?.message);
    return new Response(
      JSON.stringify({
        indicators: [],
        error: isTimeout ? 'Global indicators timeout' : 'Failed to fetch global indicators',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}