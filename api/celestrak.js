import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const CELESTRAK_GP_URL = 'https://celestrak.org/NORAD/elements/gp.php';
const ALLOWED_GROUPS = new Set([
  'active',
  'stations',
  'visual',
  'weather',
  'goes',
  'resource',
  'sarsat',
  'dmc',
  'tdrss',
  'argos',
  'planet',
  'spire',
  'geo',
  'intelsat',
  'ses',
  'eutelsat',
  'starlink',
  'oneweb',
  'qianfan',
  'kuiper',
  'iridium-NEXT',
  'orbcomm',
  'globalstar',
  'amateur',
  'satnogs',
  'x-comm',
  'other-comm',
  'gnss',
  'gps-ops',
  'glo-ops',
  'galileo',
  'beidou',
  'sbas',
  'science',
  'geodetic',
  'engineering',
  'education',
  'military',
  'radar',
  'cubesat',
]);

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req, 'GET, OPTIONS');

  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const group = url.searchParams.get('GROUP') || url.searchParams.get('group') || '';
  if (!ALLOWED_GROUPS.has(group)) {
    return new Response(JSON.stringify({ error: 'Unsupported CelesTrak group' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const celestrakUrl = new URL(CELESTRAK_GP_URL);
  celestrakUrl.searchParams.set('GROUP', group);
  celestrakUrl.searchParams.set('FORMAT', 'json');

  try {
    const response = await fetchWithTimeout(celestrakUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; EdgePannel/1.0; +https://edgepannel.com)',
      },
    }, 15000);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': response.ok
          ? 'public, max-age=900, s-maxage=3600, stale-while-revalidate=21600'
          : 'public, max-age=60, s-maxage=300',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    return new Response(JSON.stringify({ error: isTimeout ? 'CelesTrak timeout' : 'CelesTrak fetch failed' }), {
      status: isTimeout ? 504 : 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
