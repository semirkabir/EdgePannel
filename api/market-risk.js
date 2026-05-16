import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const CBOE_VIX_URL = 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';
const CFTC_COT_URL = 'https://www.cftc.gov/dea/newcot/FinFutWk.txt';

const SOURCE_CONFIG = {
  vix: {
    url: CBOE_VIX_URL,
    accept: 'text/csv,text/plain,*/*',
    contentType: 'text/csv; charset=utf-8',
    // VIX data updates daily — cache for 20 minutes on CDN, 5 min locally
    cacheControl: 'public, max-age=300, s-maxage=1200, stale-while-revalidate=3600, stale-if-error=86400',
  },
  cot: {
    url: CFTC_COT_URL,
    accept: 'text/plain,*/*',
    contentType: 'text/plain; charset=utf-8',
    // COT report is published once a week (Fridays) — cache for 4 hours on CDN
    cacheControl: 'public, max-age=900, s-maxage=14400, stale-while-revalidate=28800, stale-if-error=604800',
  },
};

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

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  const cfg = SOURCE_CONFIG[type];
  if (!cfg) {
    return new Response(JSON.stringify({ error: 'Missing or invalid type parameter. Use type=vix or type=cot.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const response = await fetchWithTimeout(cfg.url, {
      headers: {
        'User-Agent': 'EdgePannel/1.0 (edgepannel.app)',
        'Accept': cfg.accept,
      },
    }, 15000);

    if (!response.ok) {
      console.error(`[market-risk proxy] upstream ${type} returned ${response.status}`);
      return new Response(JSON.stringify({ error: `Upstream ${type.toUpperCase()} source returned ${response.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await response.text();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': cfg.contentType,
        'Cache-Control': cfg.cacheControl,
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error(`[market-risk proxy] ${type} error:`, error?.message);
    return new Response(JSON.stringify({
      error: isTimeout ? `${type.toUpperCase()} fetch timeout` : `Failed to fetch ${type.toUpperCase()} data`,
      details: error?.message,
    }), {
      status: isTimeout ? 504 : 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
