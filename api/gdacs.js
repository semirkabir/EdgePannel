import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const GDACS_URL =
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS?eventlist=TC,FL,VO,WF&alertlevel=Red,Orange&limit=50';

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
      GDACS_URL,
      {
        headers: {
          'User-Agent': 'WorldMonitor/1.0 (edgepannel.app)',
          Accept: 'application/json',
        },
      },
      15000,
    );

    const body = await response.text();
    const isSuccess = response.status >= 200 && response.status < 300;

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        // 10-minute CDN cache — GDACS updates roughly hourly
        'Cache-Control': isSuccess
          ? 'public, max-age=600, s-maxage=600, stale-while-revalidate=1200, stale-if-error=3600'
          : 'public, max-age=15, s-maxage=60',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[gdacs proxy] error:', error?.message);
    return new Response(
      JSON.stringify({
        features: [],
        error: isTimeout ? 'GDACS timeout' : 'Failed to fetch GDACS alerts',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}
