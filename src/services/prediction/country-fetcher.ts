import type { GeoPredictionMarket, PredictionMarket } from './types';
import { isMarketExcluded, parseMarketPrice, buildMarketUrl, parseEndDate, isExpired } from './market-utils';
import { fetchEventsByTag } from './polymarket-client';

const COUNTRY_TAG_MAP: Record<string, string[]> = {
  'United States': ['usa', 'politics', 'elections'],
  'Russia': ['russia', 'geopolitics', 'ukraine'],
  'Ukraine': ['ukraine', 'geopolitics', 'russia'],
  'China': ['china', 'geopolitics', 'asia'],
  'Taiwan': ['china', 'asia', 'geopolitics'],
  'Israel': ['middle-east', 'geopolitics'],
  'Palestine': ['middle-east', 'geopolitics'],
  'Iran': ['middle-east', 'geopolitics'],
  'Saudi Arabia': ['middle-east', 'geopolitics'],
  'Turkey': ['middle-east', 'europe'],
  'India': ['asia', 'geopolitics'],
  'Japan': ['asia', 'geopolitics'],
  'South Korea': ['asia', 'geopolitics'],
  'North Korea': ['asia', 'geopolitics'],
  'United Kingdom': ['europe', 'politics'],
  'France': ['europe', 'politics'],
  'Germany': ['europe', 'politics'],
  'Italy': ['europe', 'politics'],
  'Poland': ['europe', 'geopolitics'],
  'Brazil': ['world', 'politics'],
  'United Arab Emirates': ['middle-east', 'world'],
  'Mexico': ['world', 'politics'],
  'Argentina': ['world', 'politics'],
  'Canada': ['world', 'politics'],
  'Australia': ['world', 'politics'],
  'South Africa': ['world', 'politics'],
  'Nigeria': ['world', 'politics'],
  'Egypt': ['middle-east', 'world'],
  'Pakistan': ['asia', 'geopolitics'],
  'Syria': ['middle-east', 'geopolitics'],
  'Yemen': ['middle-east', 'geopolitics'],
  'Lebanon': ['middle-east', 'geopolitics'],
  'Iraq': ['middle-east', 'geopolitics'],
  'Afghanistan': ['geopolitics', 'world'],
  'Venezuela': ['world', 'politics'],
  'Colombia': ['world', 'politics'],
  'Sudan': ['world', 'geopolitics'],
  'Myanmar': ['asia', 'geopolitics'],
  'Philippines': ['asia', 'world'],
  'Indonesia': ['asia', 'world'],
  'Thailand': ['asia', 'world'],
  'Vietnam': ['asia', 'world'],
};

const COUNTRY_CENTROIDS: Record<string, [lon: number, lat: number]> = {
  'United States': [-98.58, 39.83],
  'Russia': [105.32, 61.52],
  'Ukraine': [31.17, 48.38],
  'China': [104.20, 35.86],
  'Taiwan': [120.96, 23.70],
  'Israel': [34.85, 31.05],
  'Palestine': [35.23, 31.95],
  'Iran': [53.69, 32.43],
  'Saudi Arabia': [45.08, 23.89],
  'Turkey': [35.24, 38.96],
  'India': [78.96, 20.59],
  'Japan': [138.25, 36.20],
  'South Korea': [127.77, 35.91],
  'North Korea': [127.51, 40.34],
  'United Kingdom': [-3.44, 55.38],
  'France': [2.21, 46.23],
  'Germany': [10.45, 51.17],
  'Italy': [12.57, 41.87],
  'Poland': [19.15, 51.92],
  'Brazil': [-51.93, -14.24],
  'United Arab Emirates': [53.85, 23.42],
  'Mexico': [-102.55, 23.63],
  'Argentina': [-63.62, -38.42],
  'Canada': [-106.35, 56.13],
  'Australia': [133.78, -25.27],
  'South Africa': [22.94, -30.56],
  'Nigeria': [8.68, 9.08],
  'Egypt': [30.80, 26.82],
  'Pakistan': [69.35, 30.38],
  'Syria': [38.99, 34.80],
  'Yemen': [48.52, 15.55],
  'Lebanon': [35.86, 33.85],
  'Iraq': [43.68, 33.22],
  'Afghanistan': [67.71, 33.94],
  'Venezuela': [-66.59, 6.42],
  'Colombia': [-74.30, 4.57],
  'Sudan': [30.22, 12.86],
  'Myanmar': [95.96, 21.92],
  'Philippines': [121.77, 12.88],
  'Indonesia': [113.92, -0.79],
  'Thailand': [100.99, 15.87],
  'Vietnam': [108.28, 14.06],
};

function getCountryVariants(country: string): string[] {
  const lower = country.toLowerCase();
  const variants = [lower];

  const VARIANT_MAP: Record<string, string[]> = {
    'russia': ['russian', 'moscow', 'kremlin', 'putin'],
    'ukraine': ['ukrainian', 'kyiv', 'kiev', 'zelensky', 'zelenskyy'],
    'china': ['chinese', 'beijing', 'xi jinping', 'prc'],
    'taiwan': ['taiwanese', 'taipei', 'tsmc'],
    'united states': ['american', 'usa', 'biden', 'trump', 'washington'],
    'israel': ['israeli', 'netanyahu', 'idf', 'tel aviv'],
    'palestine': ['palestinian', 'gaza', 'hamas', 'west bank'],
    'iran': ['iranian', 'tehran', 'khamenei', 'irgc'],
    'north korea': ['dprk', 'pyongyang', 'kim jong un'],
    'south korea': ['korean', 'seoul'],
    'saudi arabia': ['saudi', 'riyadh', 'mbs'],
    'united kingdom': ['british', 'uk', 'britain', 'london'],
    'france': ['french', 'paris', 'macron'],
    'germany': ['german', 'berlin', 'scholz'],
    'turkey': ['turkish', 'ankara', 'erdogan'],
    'india': ['indian', 'delhi', 'modi'],
    'japan': ['japanese', 'tokyo'],
    'brazil': ['brazilian', 'brasilia', 'lula', 'bolsonaro'],
    'united arab emirates': ['uae', 'emirati', 'dubai', 'abu dhabi'],
    'syria': ['syrian', 'damascus', 'assad'],
    'yemen': ['yemeni', 'houthi', 'sanaa'],
    'lebanon': ['lebanese', 'beirut', 'hezbollah'],
    'egypt': ['egyptian', 'cairo', 'sisi'],
    'pakistan': ['pakistani', 'islamabad'],
    'sudan': ['sudanese', 'khartoum'],
    'myanmar': ['burmese', 'burma'],
  };

  const extra = VARIANT_MAP[lower];
  if (extra) variants.push(...extra);
  return variants;
}

function countVariantMatches(title: string, country: string): number {
  const lower = title.toLowerCase();
  return getCountryVariants(country).reduce((count, variant) => count + (lower.includes(variant) ? 1 : 0), 0);
}

async function runThrottled<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

export async function fetchCountryMarkets(country: string): Promise<PredictionMarket[]> {
  const tags = COUNTRY_TAG_MAP[country] ?? ['geopolitics', 'world'];
  const uniqueTags = [...new Set(tags)].slice(0, 3);
  const variants = getCountryVariants(country);

  try {
    const eventResults = await Promise.all(uniqueTags.map(tag => fetchEventsByTag(tag, 30)));
    const seen = new Set<string>();
    const markets: PredictionMarket[] = [];

    for (const events of eventResults) {
      for (const event of events) {
        if (event.closed || seen.has(event.id)) continue;
        seen.add(event.id);

        const titleLower = event.title.toLowerCase();
        const eventTitleMatches = variants.some(v => titleLower.includes(v));
        if (!eventTitleMatches) {
          const marketTitles = (event.markets ?? []).map(m => (m.question ?? '').toLowerCase());
          if (!marketTitles.some(mt => variants.some(v => mt.includes(v)))) continue;
        }

        if (isMarketExcluded(event.title)) continue;

        if (event.markets && event.markets.length > 0) {
          const candidates = eventTitleMatches
            ? event.markets.filter(m => !m.closed && !isExpired(m.endDate))
            : event.markets.filter(m =>
                !m.closed && !isExpired(m.endDate) &&
                variants.some(v => (m.question ?? '').toLowerCase().includes(v)));
          if (candidates.length === 0) continue;

          const topMarket = candidates.reduce((best, m) => {
            const vol = m.volumeNum ?? (m.volume ? parseFloat(m.volume) : 0);
            const bestVol = best.volumeNum ?? (best.volume ? parseFloat(best.volume) : 0);
            return vol > bestVol ? m : best;
          });
          markets.push({
            title: topMarket.question || event.title,
            yesPrice: parseMarketPrice(topMarket),
            volume: event.volume ?? 0,
            url: buildMarketUrl(event.slug, topMarket.slug),
            endDate: parseEndDate(topMarket.endDate ?? event.endDate),
            slug: topMarket.slug,
          });
        } else {
          markets.push({
            title: event.title,
            yesPrice: 50,
            volume: event.volume ?? 0,
            url: buildMarketUrl(event.slug),
            endDate: parseEndDate(event.endDate),
            slug: event.slug,
          });
        }
      }
    }

    return markets
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 5);
  } catch (e) {
    console.error(`[Polymarket] fetchCountryMarkets(${country}) failed:`, e);
    return [];
  }
}

export async function fetchGeoTaggedMarkets(): Promise<GeoPredictionMarket[]> {
  type Candidate = {
    market: GeoPredictionMarket;
    matchScore: number;
  };

  const countries = Object.keys(COUNTRY_TAG_MAP).filter(country => COUNTRY_CENTROIDS[country]);
  const results = await runThrottled(countries, 6, async (country) => {
    const centroid = COUNTRY_CENTROIDS[country];
    if (!centroid) return [] as Candidate[];

    const markets = await fetchCountryMarkets(country);
    const [lon, lat] = centroid;
    return markets.map((market): Candidate => ({
      market: {
        ...market,
        country,
        lon,
        lat,
      },
      matchScore: countVariantMatches(market.title, country),
    }));
  });

  const deduped = new Map<string, Candidate>();
  for (const candidates of results) {
    for (const candidate of candidates) {
      const key = candidate.market.slug || candidate.market.url || candidate.market.title;
      const existing = deduped.get(key);
      if (
        !existing ||
        candidate.matchScore > existing.matchScore ||
        (candidate.matchScore === existing.matchScore && (candidate.market.volume ?? 0) > (existing.market.volume ?? 0))
      ) {
        deduped.set(key, candidate);
      }
    }
  }

  return [...deduped.values()]
    .map(({ market }) => market)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 200);
}
