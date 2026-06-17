/**
 * DefiLlama protocols — top TVL summary (no API key).
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const PROTOCOLS_URL = 'https://api.llama.fi/protocols';
const MAX_PROTOCOLS = 15;

function formatTvl(value) {
  if (!Number.isFinite(value)) return '$0';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
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
      PROTOCOLS_URL,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'WorldMonitor/1.0 (edgepannel.app)',
        },
      },
      25000,
    );

    if (!response.ok) {
      throw new Error(`DefiLlama HTTP ${response.status}`);
    }

    const raw = await response.json();
    const protocols = (Array.isArray(raw) ? raw : [])
      .filter((p) => Number(p.tvl) > 0)
      .sort((a, b) => Number(b.tvl) - Number(a.tvl))
      .slice(0, MAX_PROTOCOLS)
      .map((p) => ({
        id: `defillama:${p.slug || p.name}`,
        name: String(p.name || ''),
        slug: String(p.slug || ''),
        symbol: String(p.symbol || ''),
        category: String(p.category || ''),
        chain: String(p.chain || ''),
        tvl: Number(p.tvl) || 0,
        tvlDisplay: formatTvl(Number(p.tvl) || 0),
        change1d: Number(p.change_1d) || 0,
        change7d: Number(p.change_7d) || 0,
        url: String(p.url || `https://defillama.com/protocol/${p.slug || ''}`),
        source: 'DefiLlama',
      }));

    return new Response(JSON.stringify({ protocols, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[defillama-protocols] error:', error?.message);
    return new Response(
      JSON.stringify({
        protocols: [],
        error: isTimeout ? 'DefiLlama timeout' : 'Failed to fetch DefiLlama protocols',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}