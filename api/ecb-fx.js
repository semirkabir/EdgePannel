/**
 * ECB Foreign Exchange Reference Rates proxy.
 *
 * Fetches daily EUR reference exchange rates from the European Central Bank's
 * free SDMX 2.1 REST API, parses the response into a simplified JSON shape,
 * and adds a derived 1-day % change field.
 *
 * Source: https://data-api.ecb.europa.eu/service/data/EXR/
 * No API key required. Cache-Control: 1 hour (ECB publishes once per business day).
 */

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

export const config = { runtime: 'edge' };

// All currencies for which ECB publishes official reference rates
const ECB_CURRENCIES =
  'USD+JPY+GBP+CHF+CNY+INR+BRL+CAD+AUD+NZD+MXN+TRY+PLN+HUF+CZK+RON+ZAR+KRW+SGD+HKD+NOK+SEK+DKK+IDR+MYR+PHP+THB+ILS+BGN+HRK+ISK+DZD';

const ECB_URL =
  `https://data-api.ecb.europa.eu/service/data/EXR/D.${ECB_CURRENCIES}.EUR.SP00.A` +
  `?format=jsondata&lastNObservations=2`;

/**
 * Parse the SDMX 2.1 JSON envelope into a flat array of rate objects.
 * The SDMX series key format is "freq:currency:denom:type:suffix" where each
 * segment is an index into the corresponding dimension's values array.
 */
function parseSdmx(data) {
  const seriesDims  = data?.structure?.dimensions?.series      ?? [];
  const obsDims     = data?.structure?.dimensions?.observation ?? [];

  const currencyDimIdx = seriesDims.findIndex(d => d.id === 'CURRENCY');
  const currencies     = seriesDims[currencyDimIdx]?.values ?? [];

  // Build a sorted list of date strings so we can find latest/prev by index
  const dateSeries = obsDims[0]?.values ?? [];
  const sortedDates = [...dateSeries].sort((a, b) => a.id.localeCompare(b.id));
  const latestDate  = sortedDates.at(-1)?.id ?? '';
  const prevDate    = sortedDates.at(-2)?.id  ?? '';

  const latestDateIdx = dateSeries.findIndex(v => v.id === latestDate);
  const prevDateIdx   = dateSeries.findIndex(v => v.id === prevDate);

  const series  = data?.dataSets?.[0]?.series ?? {};
  const rates   = [];

  for (const [key, sd] of Object.entries(series)) {
    const parts   = key.split(':');
    const currIdx = parseInt(parts[currencyDimIdx] ?? '0', 10);
    const currency = currencies[currIdx]?.id;
    if (!currency) continue;

    const latest = sd.observations?.[String(latestDateIdx)];
    const prev   = sd.observations?.[String(prevDateIdx)];

    const rate     = latest?.[0];
    const prevRate = prev?.[0] ?? null;

    if (rate == null || !isFinite(rate) || rate <= 0) continue;

    const changePct =
      prevRate && isFinite(prevRate) && prevRate > 0
        ? parseFloat((((rate - prevRate) / prevRate) * 100).toFixed(4))
        : 0;

    rates.push({
      currency,
      rateVsEur:     rate,
      prevRateVsEur: prevRate,
      changePct,
      date:          latestDate,
    });
  }

  return {
    rates,
    publishDate:  latestDate,
    baseCurrency: 'EUR',
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
    const response = await fetch(ECB_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`ECB HTTP ${response.status}`);

    const data   = await response.json();
    const parsed = parseSdmx(data);

    if (!parsed.rates.length) throw new Error('ECB returned empty rate set');

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache 1 hour — ECB publishes reference rates once per business day (~16:00 CET)
        'Cache-Control':
          'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200, stale-if-error=86400',
        ...corsHeaders,
      },
    });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[ecb-fx proxy] error:', error?.message);
    return new Response(
      JSON.stringify({
        rates: [],
        error: isTimeout ? 'ECB timeout' : 'Failed to fetch ECB FX reference rates',
      }),
      {
        status: isTimeout ? 504 : 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}
