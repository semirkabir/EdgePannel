/**
 * Batch geocode prediction market titles via Groq LLM.
 *
 * Receives an array of market titles that failed deterministic geotagging
 * and returns lat/lon coordinates extracted by an LLM. Runs as a Vercel
 * edge function so the Groq API key never reaches the browser.
 *
 * POST /api/prediction/geotag
 * Body: { markets: [{ title: string; slug?: string; volume?: number }[] }
 * Response: { results: [{ title: string; country: string; lat: number; lon: number; confidence: string }[] }
 */

export const config = { runtime: 'edge' };

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Known country/region → centroid map used as a stable lookup.
 * Groq returns country names; we resolve them to coordinates here
 * so we never trust LLM-generated numbers for lat/lon.
 */
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'United States': { lat: 39.83, lon: -98.58 },
  'Russia': { lat: 61.52, lon: 105.32 },
  'Ukraine': { lat: 48.38, lon: 31.17 },
  'China': { lat: 35.86, lon: 104.20 },
  'Taiwan': { lat: 23.70, lon: 120.96 },
  'Israel': { lat: 31.05, lon: 34.85 },
  'Palestine': { lat: 31.95, lon: 35.23 },
  'Iran': { lat: 32.43, lon: 53.69 },
  'Saudi Arabia': { lat: 23.89, lon: 45.08 },
  'Turkey': { lat: 38.96, lon: 35.24 },
  'India': { lat: 20.59, lon: 78.96 },
  'Japan': { lat: 36.20, lon: 138.25 },
  'South Korea': { lat: 35.91, lon: 127.77 },
  'North Korea': { lat: 40.34, lon: 127.51 },
  'United Kingdom': { lat: 55.38, lon: -3.44 },
  'France': { lat: 46.23, lon: 2.21 },
  'Germany': { lat: 51.17, lon: 10.45 },
  'Italy': { lat: 41.87, lon: 12.57 },
  'Poland': { lat: 51.92, lon: 19.15 },
  'Brazil': { lat: -14.24, lon: -51.93 },
  'United Arab Emirates': { lat: 23.42, lon: 53.85 },
  'Mexico': { lat: 23.63, lon: -102.55 },
  'Argentina': { lat: -38.42, lon: -63.62 },
  'Canada': { lat: 56.13, lon: -106.35 },
  'Australia': { lat: -25.27, lon: 133.78 },
  'South Africa': { lat: -30.56, lon: 22.94 },
  'Nigeria': { lat: 9.08, lon: 8.68 },
  'Egypt': { lat: 26.82, lon: 30.80 },
  'Pakistan': { lat: 30.38, lon: 69.35 },
  'Syria': { lat: 34.80, lon: 38.99 },
  'Yemen': { lat: 15.55, lon: 48.52 },
  'Lebanon': { lat: 33.85, lon: 35.86 },
  'Iraq': { lat: 33.22, lon: 43.68 },
  'Afghanistan': { lat: 33.94, lon: 67.71 },
  'Venezuela': { lat: 6.42, lon: -66.59 },
  'Colombia': { lat: 4.57, lon: -74.30 },
  'Sudan': { lat: 12.86, lon: 30.22 },
  'Myanmar': { lat: 21.92, lon: 95.96 },
  'Philippines': { lat: 12.88, lon: 121.77 },
  'Indonesia': { lat: -0.79, lon: 113.92 },
  'Thailand': { lat: 15.87, lon: 100.99 },
  'Vietnam': { lat: 14.06, lon: 108.28 },
  'Spain': { lat: 40.46, lon: -3.75 },
  'Netherlands': { lat: 52.13, lon: 5.29 },
  'Belgium': { lat: 50.50, lon: 4.47 },
  'Sweden': { lat: 60.13, lon: 18.64 },
  'Norway': { lat: 60.47, lon: 8.47 },
  'Finland': { lat: 61.92, lon: 25.75 },
  'Denmark': { lat: 56.26, lon: 9.50 },
  'Greece': { lat: 39.07, lon: 21.82 },
  'Hungary': { lat: 47.16, lon: 19.50 },
  'Romania': { lat: 45.94, lon: 24.97 },
  'Czech Republic': { lat: 49.82, lon: 15.47 },
  'Ireland': { lat: 53.41, lon: -8.24 },
  'Portugal': { lat: 39.40, lon: -8.22 },
  'Austria': { lat: 47.52, lon: 14.55 },
  'Switzerland': { lat: 46.82, lon: 8.23 },
  'Serbia': { lat: 44.02, lon: 21.01 },
  'Kosovo': { lat: 42.60, lon: 20.90 },
  'Georgia': { lat: 42.32, lon: 43.36 },
  'Armenia': { lat: 40.07, lon: 45.04 },
  'Azerbaijan': { lat: 40.14, lon: 47.58 },
  'Qatar': { lat: 25.35, lon: 51.18 },
  'Kuwait': { lat: 29.31, lon: 47.48 },
  'Jordan': { lat: 30.59, lon: 36.24 },
  'Libya': { lat: 26.34, lon: 17.23 },
  'Morocco': { lat: 31.79, lon: -7.09 },
  'Algeria': { lat: 28.03, lon: 1.66 },
  'Tunisia': { lat: 33.89, lon: 9.54 },
  'Ethiopia': { lat: 9.15, lon: 40.49 },
  'Kenya': { lat: -0.02, lon: 37.91 },
  'Ghana': { lat: 7.95, lon: -1.02 },
  'Senegal': { lat: 14.50, lon: -14.45 },
  'Democratic Republic of the Congo': { lat: -4.04, lon: 21.76 },
  'Zimbabwe': { lat: -19.02, lon: 29.15 },
  'Chile': { lat: -35.68, lon: -71.54 },
  'Peru': { lat: -9.19, lon: -75.02 },
  'Ecuador': { lat: -1.83, lon: -78.18 },
  'Bolivia': { lat: -16.29, lon: -63.59 },
  'Uruguay': { lat: -32.52, lon: -55.77 },
  'Paraguay': { lat: -23.44, lon: -58.44 },
  'Cuba': { lat: 21.52, lon: -77.78 },
  'Haiti': { lat: 18.97, lon: -72.29 },
  'Dominican Republic': { lat: 18.74, lon: -70.16 },
  'Panama': { lat: 8.54, lon: -80.78 },
  'Guatemala': { lat: 15.78, lon: -90.23 },
  'El Salvador': { lat: 13.79, lon: -88.90 },
  'Nicaragua': { lat: 12.87, lon: -85.21 },
  'Honduras': { lat: 15.20, lon: -86.24 },
  'Costa Rica': { lat: 9.75, lon: -83.75 },
  'Malaysia': { lat: 4.21, lon: 101.98 },
  'Singapore': { lat: 1.35, lon: 103.82 },
  'Bangladesh': { lat: 23.68, lon: 90.36 },
  'Sri Lanka': { lat: 7.87, lon: 80.77 },
  'Nepal': { lat: 28.39, lon: 84.12 },
  'Kazakhstan': { lat: 48.02, lon: 66.92 },
  'Uzbekistan': { lat: 41.38, lon: 64.59 },
  'Mongolia': { lat: 46.86, lon: 103.85 },
  'New Zealand': { lat: -40.90, lon: 174.89 },
  'Gaza': { lat: 31.50, lon: 34.47 },
  'European Union': { lat: 50.00, lon: 10.00 },
  'Europe': { lat: 50.00, lon: 10.00 },
  'Middle East': { lat: 29.00, lon: 42.00 },
  'Africa': { lat: 5.00, lon: 20.00 },
  'Asia': { lat: 35.00, lon: 90.00 },
  'Latin America': { lat: -15.00, lon: -60.00 },
  'South America': { lat: -15.00, lon: -60.00 },
  'NATO': { lat: 50.00, lon: 10.00 },
  'United Nations': { lat: 40.75, lon: -73.97 },
  'WHO': { lat: 46.20, lon: 6.15 },
  'IMF': { lat: 38.90, lon: -77.04 },
  'World Bank': { lat: 38.90, lon: -77.04 },
};

/** Reverse alias map: common alternate names → canonical name. */
const NAME_ALIASES: Record<string, string> = {
  'USA': 'United States', 'US': 'United States', 'America': 'United States',
  'UK': 'United Kingdom', 'Britain': 'United Kingdom', 'Great Britain': 'United Kingdom',
  'DRC': 'Democratic Republic of the Congo', 'Congo': 'Democratic Republic of the Congo',
  'Czechia': 'Czech Republic',
  'UAE': 'United Arab Emirates',
  'DPRK': 'North Korea', 'NK': 'North Korea',
  'ROK': 'South Korea', 'SK': 'South Korea',
  'Kremlin': 'Russia', 'Moscow': 'Russia', 'Russian Federation': 'Russia',
  'Beijing': 'China', 'PRC': 'China', 'Chinese': 'China',
  'Tehran': 'Iran', 'Iranian': 'Iran',
  'Washington': 'United States', 'White House': 'United States', 'US Government': 'United States',
  'Brussels': 'European Union', 'EU': 'European Union',
  'Hamas': 'Gaza', 'Palestinian': 'Palestine', 'Palestinian Territories': 'Palestine',
  'Hezbollah': 'Lebanon',
  'Houthis': 'Yemen', 'Houthi': 'Yemen',
  'Taliban': 'Afghanistan',
  'Assad': 'Syria', 'Syrian': 'Syria',
  'Netanyahu': 'Israel', 'Israeli': 'Israel', 'IDF': 'Israel',
  'Putin': 'Russia', 'Russian': 'Russia',
  'Zelensky': 'Ukraine', 'Zelenskyy': 'Ukraine', 'Ukrainian': 'Ukraine',
  'Xi': 'China',
  'Modi': 'India', 'Indian': 'India',
  'Erdogan': 'Turkey', 'Turkish': 'Turkey',
  'MBS': 'Saudi Arabia', 'Saudi': 'Saudi Arabia',
  'Khamenei': 'Iran', 'IRGC': 'Iran',
  'Kim Jong Un': 'North Korea',
  'Lula': 'Brazil', 'Brazilian': 'Brazil',
  'Macron': 'France', 'French': 'France',
  'Scholz': 'Germany', 'German': 'Germany',
  'Sunak': 'United Kingdom', 'British': 'United Kingdom',
  'Biden': 'United States', 'Trump': 'United States', 'American': 'United States',
  'Fed': 'United States', 'Federal Reserve': 'United States', 'FOMC': 'United States',
  'SEC': 'United States',
  'NATO': 'NATO',
};

/** Resolve a Groq-returned country name to canonical form + coordinates. */
function resolveCountry(raw: string): { country: string; lat: number; lon: number; confidence: 'high' | 'low' } | null {
  // Direct match
  if (COUNTRY_COORDS[raw]) {
    return { country: raw, ...COUNTRY_COORDS[raw], confidence: 'high' };
  }
  // Alias match
  const canonical = NAME_ALIASES[raw];
  if (canonical && COUNTRY_COORDS[canonical]) {
    return { country: canonical, ...COUNTRY_COORDS[canonical], confidence: 'high' };
  }
  // Partial match — check if any canonical name contains the raw string or vice versa
  const lowerRaw = raw.toLowerCase();
  for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
    if (name.toLowerCase().includes(lowerRaw) || lowerRaw.includes(name.toLowerCase())) {
      return { country: name, ...coords, confidence: 'low' };
    }
  }
  return null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { markets: Array<{ title: string; slug?: string; volume?: number }> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const markets = body.markets;
  if (!Array.isArray(markets) || markets.length === 0) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cap batch size to stay within Groq token limits
  const batch = markets.slice(0, 80);

  // Build the prompt — one line per market for structured parsing
  const marketLines = batch
    .map((m, i) => `${i + 1}. "${m.title}"`)
    .join('\n');

  const systemPrompt = `You are a geolocation expert. For each prediction market title below, identify the PRIMARY country, region, or city the market is about.

Rules:
- Return a JSON object with a "results" key containing an array, one entry per input line, in the same order.
- Each entry: {"line": <number>, "country": "<canonical country or region name>", "city": "<city if applicable or null>"}
- If the market is about a specific city, include it in the "city" field.
- If the market is global, abstract, or has no geographic focus, set "country" to null.
- Use canonical country names (e.g. "United States" not "USA", "United Kingdom" not "UK").
- For US state-level markets, set country to "United States" and city to the state name.
- For sports markets, identify the home city of the primary team.
- Do NOT include any text outside the JSON object.`;

  const userPrompt = `Geolocate these prediction markets:

${marketLines}`;

  try {
    const groqResp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text().catch(() => '');
      console.error('[Geotag] Groq API error:', groqResp.status, errText);
      return new Response(JSON.stringify({ error: 'Groq API error', results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const groqData = await groqResp.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = groqData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse the JSON response — expect {"results": [...]} from json_object mode
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fallback: try to extract JSON object/array from markdown-wrapped content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Extract the results array — handles both {"results": [...]} and raw [...]
    const entries = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>)?.results;
    if (!Array.isArray(entries)) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = entries
      .map((entry: any) => {
        const idx = entry.line - 1;
        if (idx < 0 || idx >= batch.length) return null;
        const market = batch[idx];
        if (!market) return null;
        const countryName = entry.country;
        if (!countryName) return null;

        const resolved = resolveCountry(countryName);
        if (!resolved) return null;

        return {
          title: market.title,
          slug: market.slug,
          volume: market.volume,
          country: resolved.country,
          city: entry.city || undefined,
          lat: resolved.lat,
          lon: resolved.lon,
          confidence: resolved.confidence,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200',
      },
    });
  } catch (err) {
    console.error('[Geotag] handler error:', err);
    return new Response(JSON.stringify({ error: 'internal error', results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
