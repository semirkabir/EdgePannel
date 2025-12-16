/**
 * Fetch all Polymarket markets with tags and output as JSON
 * Claude will then insert them via MCP Supabase
 */

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

const LOCATION_COORDINATES = {
  'united states': { lat: 37.0902, lng: -95.7129 },
  'usa': { lat: 37.0902, lng: -95.7129 },
  'china': { lat: 35.8617, lng: 104.1954 },
  'russia': { lat: 61.5240, lng: 105.3188 },
  'india': { lat: 20.5937, lng: 78.9629 },
  'japan': { lat: 36.2048, lng: 138.2529 },
  'germany': { lat: 51.1657, lng: 10.4515 },
  'united kingdom': { lat: 55.3781, lng: -3.4360 },
  'uk': { lat: 55.3781, lng: -3.4360 },
  'france': { lat: 46.2276, lng: 2.2137 },
  'brazil': { lat: -14.2350, lng: -51.9253 },
  'canada': { lat: 56.1304, lng: -106.3468 },
  'australia': { lat: -25.2744, lng: 133.7751 },
  'mexico': { lat: 23.6345, lng: -102.5528 },
  'south korea': { lat: 35.9078, lng: 127.7669 },
  'italy': { lat: 41.8719, lng: 12.5674 },
  'spain': { lat: 40.4637, lng: -3.7492 },
  'iran': { lat: 32.4279, lng: 53.6880 },
  'turkey': { lat: 38.9637, lng: 35.2433 },
  'argentina': { lat: -38.4161, lng: -63.6167 },
  'poland': { lat: 51.9194, lng: 19.1451 },
  'ukraine': { lat: 48.3794, lng: 31.1656 },
  'netherlands': { lat: 52.1326, lng: 5.2913 },
  'belgium': { lat: 50.5039, lng: 4.4699 },
  'sweden': { lat: 60.1282, lng: 18.6435 },
  'norway': { lat: 60.4720, lng: 8.4689 },
  'denmark': { lat: 56.2639, lng: 9.5018 },
  'finland': { lat: 61.9241, lng: 25.7482 },
  'portugal': { lat: 39.3999, lng: -8.2245 },
  'greece': { lat: 39.0742, lng: 21.8243 },
  'israel': { lat: 31.0461, lng: 34.8516 },
  'saudi arabia': { lat: 23.8859, lng: 45.0792 },
  'egypt': { lat: 26.8206, lng: 30.8025 },
  'south africa': { lat: -30.5595, lng: 22.9375 },
  'nigeria': { lat: 9.0820, lng: 8.6753 },
  'pakistan': { lat: 30.3753, lng: 69.3451 },
  'indonesia': { lat: -0.7893, lng: 113.9213 },
  'thailand': { lat: 15.8700, lng: 100.9925 },
  'vietnam': { lat: 14.0583, lng: 108.2772 },
  'philippines': { lat: 12.8797, lng: 121.7740 },
  'malaysia': { lat: 4.2105, lng: 101.9758 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'taiwan': { lat: 23.6978, lng: 120.9605 },
  'new zealand': { lat: -40.9006, lng: 174.8860 },
  'chile': { lat: -35.6751, lng: -71.5430 },
  'colombia': { lat: 4.5709, lng: -74.2973 },
  'venezuela': { lat: 6.4238, lng: -66.5897 },
  'peru': { lat: -9.1900, lng: -75.0152 },
  'cuba': { lat: 21.5218, lng: -77.7812 },
  'north korea': { lat: 40.3399, lng: 127.5101 },
  'syria': { lat: 34.8021, lng: 38.9968 },
  'iraq': { lat: 33.2232, lng: 43.6793 },
  'afghanistan': { lat: 33.9391, lng: 67.7100 },
  'palestine': { lat: 31.9522, lng: 35.2332 },
  'lebanon': { lat: 33.8547, lng: 35.8623 },
  'morocco': { lat: 31.7917, lng: -7.0926 },
  'algeria': { lat: 28.0339, lng: 1.6596 },
  'tunisia': { lat: 33.8869, lng: 9.5375 },
  'libya': { lat: 26.3351, lng: 17.2283 },
  'sudan': { lat: 12.8628, lng: 30.2176 },
  'ethiopia': { lat: 9.1450, lng: 40.4897 },
  'kenya': { lat: -0.0236, lng: 37.9062 },
  'ghana': { lat: 7.9465, lng: -1.0232 },
  'senegal': { lat: 14.4974, lng: -14.4524 },
  'ivory coast': { lat: 7.5400, lng: -5.5471 },
  'cameroon': { lat: 7.3697, lng: 12.3547 },
  'zimbabwe': { lat: -19.0154, lng: 29.1549 },
  'uganda': { lat: 1.3733, lng: 32.2903 },
  'rwanda': { lat: -1.9403, lng: 29.8739 },
  'myanmar': { lat: 21.9162, lng: 95.9560 },
  'belarus': { lat: 53.7098, lng: 27.9534 },
  'kazakhstan': { lat: 48.0196, lng: 66.9237 },
  'uzbekistan': { lat: 41.3775, lng: 64.5853 },
  'azerbaijan': { lat: 40.1431, lng: 47.5769 },
  'georgia': { lat: 42.3154, lng: 43.3569 },
  'armenia': { lat: 40.0691, lng: 45.0382 },
  'austria': { lat: 47.5162, lng: 14.5501 },
  'switzerland': { lat: 46.8182, lng: 8.2275 },
  'czech republic': { lat: 49.8175, lng: 15.4730 },
  'hungary': { lat: 47.1625, lng: 19.5033 },
  'romania': { lat: 45.9432, lng: 24.9668 },
  'bulgaria': { lat: 42.7339, lng: 25.4858 },
  'croatia': { lat: 45.1, lng: 15.2 },
  'serbia': { lat: 44.0165, lng: 21.0059 },
  'slovakia': { lat: 48.6690, lng: 19.6990 },
  'slovenia': { lat: 46.1512, lng: 14.9955 },
  'ireland': { lat: 53.4129, lng: -8.2439 },
  'iceland': { lat: 64.9631, lng: -19.0208 },
  'luxembourg': { lat: 49.8153, lng: 6.1296 },
  'qatar': { lat: 25.3548, lng: 51.1839 },
  'uae': { lat: 23.4241, lng: 53.8478 },
  'united arab emirates': { lat: 23.4241, lng: 53.8478 },
  'kuwait': { lat: 29.3117, lng: 47.4818 },
  'bahrain': { lat: 26.0667, lng: 50.5577 },
  'oman': { lat: 21.4735, lng: 55.9754 },
  'jordan': { lat: 30.5852, lng: 36.2384 },
  'yemen': { lat: 15.5527, lng: 48.5164 }
};

function inferLocation(title, description = '') {
  const searchText = `${title} ${description}`.toLowerCase();
  const locationKeys = Object.keys(LOCATION_COORDINATES).sort((a, b) => b.length - a.length);

  const contextPatterns = [
    /\b(\w+(?:\s+\w+)?)\s+(?:win|wins|winning|won|to\s+win|defeat|beats?|champion|victory|qualifies?|advances?)\b/gi,
    /\b(\w+(?:\s+\w+)?)'?s?\s+(?:team|election|economy|president|government|military|forces|victory)\b/gi,
  ];

  for (const pattern of contextPatterns) {
    const matches = [...searchText.matchAll(pattern)];
    for (const match of matches) {
      const candidate = match[1].toLowerCase().trim();
      if (LOCATION_COORDINATES[candidate]) {
        return { name: candidate, ...LOCATION_COORDINATES[candidate] };
      }
    }
  }

  for (const location of locationKeys) {
    const regex = new RegExp(`\\b${location}\\b`, 'i');
    if (regex.test(searchText)) {
      return { name: location, ...LOCATION_COORDINATES[location] };
    }
  }

  return null;
}

async function fetchMarketTags(marketId) {
  try {
    const response = await fetch(`${POLYMARKET_API}/markets/${marketId}/tags`, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) return [];

    const tags = await response.json();
    if (Array.isArray(tags)) {
      return tags.map(tag => tag.label).filter(Boolean);
    }
    return [];
  } catch (error) {
    return [];
  }
}

async function main() {
  console.error('Fetching all Polymarket markets...\n');

  const response = await fetch(`${POLYMARKET_API}/markets?closed=false&limit=1000&offset=0`, {
    headers: { 'Content-Type': 'application/json' }
  });

  const markets = await response.json();
  console.error(`Found ${markets.length} markets\n`);
  console.error('Processing with tags...\n');

  const results = [];
  let indexed = 0;
  let skipped = 0;

  for (const market of markets) {
    const location = inferLocation(market.question, market.description);

    if (!location) {
      skipped++;
      continue;
    }

    const tags = await fetchMarketTags(market.id);
    const category = market.category || tags[0] || 'Uncategorized';

    results.push({
      marketId: `polymarket-${market.id}`,
      platform: 'polymarket',
      externalId: market.id,
      title: market.question,
      description: market.description || '',
      category,
      tags,
      probability: market.outcomePrices?.[0] ? parseFloat(market.outcomePrices[0]) : null,
      volume24h: market.volume24hr || 0,
      country: location.name,
      latitude: location.lat,
      longitude: location.lng,
      confidence: 'high'
    });

    indexed++;

    if (indexed % 10 === 0) {
      console.error(`Processed ${indexed} markets...`);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.error(`\nComplete! Indexed: ${indexed}, Skipped: ${skipped}\n`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
