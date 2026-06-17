/**
 * Aviation SIGMET / AIRMET proxy — aviationweather.gov (no API key).
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import { fetchWithTimeout } from './_relay.js';

export const config = { runtime: 'edge' };

const SIGMET_URL = 'https://aviationweather.gov/api/data/airsigmet?format=json';
const MAX_SIGMETS = 30;

const HAZARD_LABELS = {
  CONVECTIVE: 'Convective',
  TURB: 'Turbulence',
  ICE: 'Icing',
  IFR: 'IFR',
  MTW: 'Mountain wave',
  VOLCANIC: 'Volcanic ash',
  TROPICAL: 'Tropical cyclone',
};

function hazardLabel(code) {
  return HAZARD_LABELS[code] || code || 'Aviation hazard';
}

function centroid(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const point of coords) {
    lat += Number(point.lat) || 0;
    lon += Number(point.lon) || 0;
  }
  return { lat: lat / coords.length, lon: lon / coords.length };
}

function normalizeSigmet(raw) {
  const coords = Array.isArray(raw.coords)
    ? raw.coords
      .map((c) => ({ lat: Number(c.lat), lon: Number(c.lon) }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
    : [];

  const center = centroid(coords);
  const hazard = String(raw.hazard || '').toUpperCase();
  const seriesId = String(raw.seriesId || raw.alphaChar || '').trim();
  const id = `sigmet:${seriesId || hazard}:${raw.validTimeFrom || raw.receiptTime || coords.length}`;

  return {
    id,
    hazard,
    hazardLabel: hazardLabel(hazard),
    type: String(raw.airSigmetType || 'SIGMET'),
    seriesId,
    icaoId: String(raw.icaoId || ''),
    severity: Number(raw.severity) || 0,
    validFrom: typeof raw.validTimeFrom === 'number' ? raw.validTimeFrom * 1000 : null,
    validTo: typeof raw.validTimeTo === 'number' ? raw.validTimeTo * 1000 : null,
    altitudeLow: raw.altitudeLow1 ?? raw.altitudeLow2 ?? null,
    altitudeHigh: raw.altitudeHi1 ?? raw.altitudeHi2 ?? null,
    movementDir: raw.movementDir ?? null,
    movementSpd: raw.movementSpd ?? null,
    coords,
    center,
    summary: String(raw.rawAirSigmet || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220),
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
    const response = await fetchWithTimeout(
      SIGMET_URL,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'WorldMonitor/1.0 (edgepannel.app)',
        },
      },
      15000,
    );

    if (!response.ok) {
      throw new Error(`SIGMET HTTP ${response.status}`);
    }

    const raw = await response.json();
    const sigmets = (Array.isArray(raw) ? raw : [])
      .map(normalizeSigmet)
      .filter((s) => s.coords.length >= 3 || s.center)
      .sort((a, b) => (b.severity || 0) - (a.severity || 0))
      .slice(0, MAX_SIGMETS);

    return new Response(JSON.stringify({ sigmets, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=1800',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[airsigmet] error:', error?.message);
    return new Response(
      JSON.stringify({ sigmets: [], error: isTimeout ? 'SIGMET timeout' : 'Failed to fetch SIGMET data' }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}