import type { GeoPredictionMarket, PolymarketEvent, PolymarketMarket, PredictionMarket } from './types';
import { isMarketExcluded, parseMarketPrice, buildMarketUrl, parseEndDate, isExpired, normalizeTokenIds } from './market-utils';
import { fetchEventsByTag, polyFetch } from './polymarket-client';
import { getPersistentCache, setPersistentCache, cacheAgeMs } from '@/services/persistent-cache';
import { geotagPredictionMarket, COUNTRY_BOUNDS, sampleInsideCountry } from './geotagging';
import { COUNTRY_DATA } from '../../generated/geo-data';
import { isCoordinateInCountry, nameToCountryCode } from '../country-geometry';

const GLOBAL_DISCOVERY_TAGS = ['world', 'politics', 'elections', 'geopolitics', 'economics', 'middle-east', 'asia', 'europe'];
const GLOBAL_DISCOVERY_PAGE_SIZE = 500;
const GLOBAL_DISCOVERY_PAGES = 5;
const QUICK_DISCOVERY_TAG_LIMIT = 120;
const QUICK_DISCOVERY_PAGE_SIZE = 200;
const QUICK_DISCOVERY_PAGES = 1;
const GEO_MARKETS_CACHE_KEY = 'prediction:geo-markets:v3';
const GEO_MARKETS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GEO_MARKETS_STALE_TTL_MS = 24 * 60 * 60 * 1000;
let inFlightGeoMarketsRefresh: Promise<GeoPredictionMarket[]> | null = null;

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
  'Spain': ['europe', 'politics'],
  'Netherlands': ['europe', 'politics'],
  'Belgium': ['europe', 'politics'],
  'Sweden': ['europe', 'politics'],
  'Norway': ['europe', 'politics'],
  'Finland': ['europe', 'politics'],
  'Denmark': ['europe', 'politics'],
  'Greece': ['europe', 'politics'],
  'Hungary': ['europe', 'politics'],
  'Romania': ['europe', 'politics'],
  'Czech Republic': ['europe', 'politics'],
  'Ireland': ['europe', 'politics'],
  'Portugal': ['europe', 'politics'],
  'Austria': ['europe', 'politics'],
  'Switzerland': ['europe', 'politics'],
  'Serbia': ['europe', 'geopolitics'],
  'Kosovo': ['europe', 'geopolitics'],
  'Georgia': ['geopolitics', 'world'],
  'Armenia': ['geopolitics', 'world'],
  'Azerbaijan': ['geopolitics', 'world'],
  'Qatar': ['middle-east', 'world'],
  'Kuwait': ['middle-east', 'world'],
  'Jordan': ['middle-east', 'geopolitics'],
  'Libya': ['middle-east', 'world'],
  'Morocco': ['world', 'politics'],
  'Algeria': ['world', 'politics'],
  'Tunisia': ['world', 'politics'],
  'Ethiopia': ['world', 'geopolitics'],
  'Kenya': ['world', 'politics'],
  'Ghana': ['world', 'politics'],
  'Senegal': ['world', 'politics'],
  'Democratic Republic of the Congo': ['world', 'geopolitics'],
  'Zimbabwe': ['world', 'politics'],
  'Chile': ['world', 'politics'],
  'Peru': ['world', 'politics'],
  'Ecuador': ['world', 'politics'],
  'Bolivia': ['world', 'politics'],
  'Uruguay': ['world', 'politics'],
  'Paraguay': ['world', 'politics'],
  'Cuba': ['world', 'politics'],
  'Haiti': ['world', 'politics'],
  'Dominican Republic': ['world', 'politics'],
  'Panama': ['world', 'politics'],
  'Guatemala': ['world', 'politics'],
  'El Salvador': ['world', 'politics'],
  'Nicaragua': ['world', 'politics'],
  'Honduras': ['world', 'politics'],
  'Costa Rica': ['world', 'politics'],
  'Malaysia': ['asia', 'world'],
  'Singapore': ['asia', 'world'],
  'Bangladesh': ['asia', 'world'],
  'Sri Lanka': ['asia', 'world'],
  'Nepal': ['asia', 'world'],
  'Kazakhstan': ['asia', 'geopolitics'],
  'Uzbekistan': ['asia', 'world'],
  'Mongolia': ['asia', 'world'],
  'New Zealand': ['world', 'politics'],
};

// Auto-fill tags for any countries in the generated geo dataset not yet manually mapped
for (const country of Object.values(COUNTRY_DATA)) {
  if (!COUNTRY_TAG_MAP[country.name]) {
    COUNTRY_TAG_MAP[country.name] = ['world', 'politics'];
  }
}

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
  'Spain': [-3.75, 40.46],
  'Netherlands': [5.29, 52.13],
  'Belgium': [4.47, 50.50],
  'Sweden': [18.64, 60.13],
  'Norway': [8.47, 60.47],
  'Finland': [25.75, 61.92],
  'Denmark': [9.50, 56.26],
  'Greece': [21.82, 39.07],
  'Hungary': [19.50, 47.16],
  'Romania': [24.97, 45.94],
  'Czech Republic': [15.47, 49.82],
  'Ireland': [-8.24, 53.41],
  'Portugal': [-8.22, 39.40],
  'Austria': [14.55, 47.52],
  'Switzerland': [8.23, 46.82],
  'Serbia': [21.01, 44.02],
  'Kosovo': [20.90, 42.60],
  'Georgia': [43.36, 42.32],
  'Armenia': [45.04, 40.07],
  'Azerbaijan': [47.58, 40.14],
  'Qatar': [51.18, 25.35],
  'Kuwait': [47.48, 29.31],
  'Jordan': [36.24, 30.59],
  'Libya': [17.23, 26.34],
  'Morocco': [-7.09, 31.79],
  'Algeria': [1.66, 28.03],
  'Tunisia': [9.54, 33.89],
  'Ethiopia': [40.49, 9.15],
  'Kenya': [37.91, -0.02],
  'Ghana': [-1.02, 7.95],
  'Senegal': [-14.45, 14.50],
  'Democratic Republic of the Congo': [21.76, -4.04],
  'Zimbabwe': [29.15, -19.02],
  'Chile': [-71.54, -35.68],
  'Peru': [-75.02, -9.19],
  'Ecuador': [-78.18, -1.83],
  'Bolivia': [-63.59, -16.29],
  'Uruguay': [-55.77, -32.52],
  'Paraguay': [-58.44, -23.44],
  'Cuba': [-77.78, 21.52],
  'Haiti': [-72.29, 18.97],
  'Dominican Republic': [-70.16, 18.74],
  'Panama': [-80.78, 8.54],
  'Guatemala': [-90.23, 15.78],
  'El Salvador': [-88.90, 13.79],
  'Nicaragua': [-85.21, 12.87],
  'Honduras': [-86.24, 15.20],
  'Costa Rica': [-83.75, 9.75],
  'Malaysia': [101.98, 4.21],
  'Singapore': [103.82, 1.35],
  'Bangladesh': [90.36, 23.68],
  'Sri Lanka': [80.77, 7.87],
  'Nepal': [84.12, 28.39],
  'Kazakhstan': [66.92, 48.02],
  'Uzbekistan': [64.59, 41.38],
  'Mongolia': [103.85, 46.86],
  'New Zealand': [174.89, -40.90],
};

// Auto-fill centroids for any countries in the generated geo dataset not yet manually mapped
for (const country of Object.values(COUNTRY_DATA)) {
  if (!COUNTRY_CENTROIDS[country.name]) {
    COUNTRY_CENTROIDS[country.name] = [country.lon, country.lat];
  }
}

const COUNTRY_SPREAD_DEGREES: Record<string, { lon: number; lat: number }> = {
  'United States': { lon: 24, lat: 10 },
  'Russia': { lon: 42, lat: 10 },
  'Canada': { lon: 26, lat: 9 },
  'China': { lon: 18, lat: 8 },
  'Australia': { lon: 18, lat: 8 },
  'Brazil': { lon: 16, lat: 9 },
  'India': { lon: 10, lat: 7 },
  'Mexico': { lon: 10, lat: 6 },
  'South Africa': { lon: 8, lat: 5 },
  'Indonesia': { lon: 16, lat: 5 },
  'Argentina': { lon: 8, lat: 8 },
};

const GEO_MARKETS_PER_COUNTRY = 120;
const GEO_MARKETS_TOTAL_LIMIT = 10_000;

type TagEventFetcher = (tag: string, limit?: number) => Promise<PolymarketEvent[]>;

type Candidate = {
  market: GeoPredictionMarket;
  matchScore: number;
};

export interface GeoTaggedMarketsInitialLoad {
  markets: GeoPredictionMarket[];
  needsRefresh: boolean;
  source: 'fresh-cache' | 'stale-cache' | 'quick-refresh' | 'empty';
}

function createTagEventFetcher(): TagEventFetcher {
  const requests = new Map<string, Promise<PolymarketEvent[]>>();
  return (tag: string, limit = 50) => {
    const key = `${tag}:${limit}`;
    const cached = requests.get(key);
    if (cached) return cached;

    const request = fetchEventsByTag(tag, limit);
    requests.set(key, request);
    return request;
  };
}

function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function spreadMarketAroundCountry(country: string, market: PredictionMarket, centroid: [lon: number, lat: number]): [lon: number, lat: number] {
  const spread = COUNTRY_SPREAD_DEGREES[country] ?? { lon: 3.8, lat: 2.4 };
  const seed = `${country}:${market.slug || market.url || market.title}`;
  const angle = hashStringToUnit(`${seed}:angle`) * Math.PI * 2;
  const radius = Math.sqrt(hashStringToUnit(`${seed}:radius`));
  let lon = centroid[0] + Math.cos(angle) * spread.lon * radius;
  let lat = centroid[1] + Math.sin(angle) * spread.lat * radius;

  const bounds = COUNTRY_BOUNDS[country.toLowerCase()];
  if (bounds) {
    const [minLat, minLon, maxLat, maxLon] = bounds;
    const latPadding = (maxLat - minLat) * 0.08;
    const lonPadding = (maxLon - minLon) * 0.08;
    lon = Math.max(minLon + lonPadding, Math.min(maxLon - lonPadding, lon));
    lat = Math.max(minLat + latPadding, Math.min(maxLat - latPadding, lat));

    // If the centroid+spread+clamp landed outside the real country polygon
    // (i.e. in a neighbour or the ocean), fall through to rejection sampling
    // against the actual polygon. Bbox clamping alone can't fix that because
    // countries aren't rectangles.
    const code = nameToCountryCode(country);
    if (code && isCoordinateInCountry(lat, lon, code) !== true) {
      // Covers both false (geometry loaded, point is outside) and null (geometry
      // not yet loaded). Brazil's bbox overlaps Bolivia/Argentina, so we must
      // resample rather than trust the clamped coordinate in either case.
      const resampled = sampleInsideCountry(country, seed, bounds);
      lat = resampled.lat;
      lon = resampled.lon;
    }
  }

  return [
    Math.max(-179.5, Math.min(179.5, lon)),
    Math.max(-84, Math.min(84, lat)),
  ];
}

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
    'spain': ['spanish', 'madrid'],
    'netherlands': ['dutch', 'amsterdam', 'hague'],
    'belgium': ['belgian', 'brussels'],
    'sweden': ['swedish', 'stockholm'],
    'norway': ['norwegian', 'oslo'],
    'finland': ['finnish', 'helsinki'],
    'denmark': ['danish', 'copenhagen'],
    'greece': ['greek', 'athens'],
    'hungary': ['hungarian', 'budapest', 'orban'],
    'romania': ['romanian', 'bucharest'],
    'czech republic': ['czech', 'prague'],
    'ireland': ['irish', 'dublin'],
    'portugal': ['portuguese', 'lisbon'],
    'austria': ['austrian', 'vienna'],
    'switzerland': ['swiss', 'bern', 'geneva'],
    'serbia': ['serbian', 'belgrade'],
    'kosovo': ['kosovar', 'pristina'],
    'georgia': ['georgian', 'tbilisi'],
    'armenia': ['armenian', 'yerevan'],
    'azerbaijan': ['azerbaijani', 'baku'],
    'qatar': ['qatari', 'doha'],
    'kuwait': ['kuwaiti', 'kuwait city'],
    'jordan': ['jordanian', 'amman'],
    'libya': ['libyan', 'tripoli'],
    'morocco': ['moroccan', 'rabat'],
    'algeria': ['algerian', 'algiers'],
    'tunisia': ['tunisian', 'tunis'],
    'ethiopia': ['ethiopian', 'addis ababa'],
    'kenya': ['kenyan', 'nairobi'],
    'ghana': ['ghanaian', 'accra'],
    'senegal': ['senegalese', 'dakar'],
    'democratic republic of the congo': ['drc', 'congo', 'congolese', 'kinshasa'],
    'zimbabwe': ['zimbabwean', 'harare'],
    'chile': ['chilean', 'santiago'],
    'peru': ['peruvian', 'lima'],
    'ecuador': ['ecuadorian', 'quito'],
    'bolivia': ['bolivian', 'la paz'],
    'uruguay': ['uruguayan', 'montevideo'],
    'paraguay': ['paraguayan', 'asuncion'],
    'cuba': ['cuban', 'havana'],
    'haiti': ['haitian', 'port-au-prince'],
    'dominican republic': ['dominican', 'santo domingo'],
    'panama': ['panamanian', 'panama city'],
    'guatemala': ['guatemalan', 'guatemala city'],
    'el salvador': ['salvadoran', 'san salvador'],
    'nicaragua': ['nicaraguan', 'managua'],
    'honduras': ['honduran', 'tegucigalpa'],
    'costa rica': ['costa rican', 'san jose'],
    'malaysia': ['malaysian', 'kuala lumpur'],
    'singapore': ['singaporean'],
    'bangladesh': ['bangladeshi', 'dhaka'],
    'sri lanka': ['sri lankan', 'colombo'],
    'nepal': ['nepali', 'kathmandu'],
    'kazakhstan': ['kazakh', 'astana'],
    'uzbekistan': ['uzbek', 'tashkent'],
    'mongolia': ['mongolian', 'ulaanbaatar'],
    'new zealand': ['new zealanders', 'kiwi', 'wellington'],
  };

  const extra = VARIANT_MAP[lower];
  if (extra) variants.push(...extra);

  // Auto-generate variants from the geo dataset (demonyms + aliases)
  const countryEntry = Object.values(COUNTRY_DATA).find(c => c.name.toLowerCase() === lower);
  if (countryEntry) {
    if (countryEntry.demonym) {
      countryEntry.demonym.split(/,|\/| or /).map(s => s.trim().toLowerCase()).filter(Boolean).forEach(d => {
        if (!variants.includes(d)) variants.push(d);
      });
    }
    if (countryEntry.aliases) {
      countryEntry.aliases.forEach(a => {
        const la = a.toLowerCase();
        if (!variants.includes(la)) variants.push(la);
      });
    }
  }

  return variants;
}

function countVariantMatches(title: string, country: string): number {
  const lower = title.toLowerCase();
  return getCountryVariants(country).reduce((count, variant) => count + (lower.includes(variant) ? 1 : 0), 0);
}

function countryMatchScore(eventTitle: string, marketTitles: string[], country: string): number {
  const joinedMarkets = marketTitles.join(' ');
  return countVariantMatches(eventTitle, country) * 2 + countVariantMatches(joinedMarkets, country);
}

function getEventKey(event: Pick<PolymarketEvent, 'id' | 'slug' | 'title'>): string {
  return event.id || event.slug || event.title;
}

function getMarketEventKey(market: PredictionMarket): string {
  return market.eventId || market.eventSlug || market.slug || market.url || market.title;
}

function getMarketVolume(market: PolymarketMarket): number {
  return market.volumeNum ?? (market.volume ? parseFloat(market.volume) : 0);
}

function getMarketLiquidity(market: PolymarketMarket): number {
  return typeof market.liquidityNum === 'number'
    ? market.liquidityNum
    : typeof market.liquidity === 'number'
      ? market.liquidity
      : typeof market.liquidity === 'string'
        ? parseFloat(market.liquidity)
        : 0;
}

function getMarketTokenIds(market: PolymarketMarket): string[] {
  return normalizeTokenIds(market.clobTokenIds ?? market.clob_token_ids);
}

function eventToPredictionMarket(
  event: PolymarketEvent,
  variants: string[],
): PredictionMarket | null {
  if (event.closed || isMarketExcluded(event.title)) return null;

  if (event.markets && event.markets.length > 0) {
    const titleLower = event.title.toLowerCase();
    const eventTitleMatches = variants.some(v => titleLower.includes(v));
    const candidates = eventTitleMatches
      ? event.markets.filter(m => !m.closed && !isExpired(m.endDate))
      : event.markets.filter(m =>
          !m.closed && !isExpired(m.endDate) &&
          variants.some(v => (m.question ?? '').toLowerCase().includes(v)));

    const topMarket = candidates
      .filter(m => !isMarketExcluded(m.question || event.title))
      .sort((a, b) => {
        const aVol = a.volumeNum ?? (a.volume ? parseFloat(a.volume) : 0);
        const bVol = b.volumeNum ?? (b.volume ? parseFloat(b.volume) : 0);
        return bVol - aVol;
      })[0];

    if (!topMarket) return null;
    const vol = topMarket.volumeNum ?? (topMarket.volume ? parseFloat(topMarket.volume) : 0);
    return {
      title: topMarket.question || event.title,
      yesPrice: parseMarketPrice(topMarket),
      volume: vol || event.volume || 0,
      conditionId: topMarket.conditionId || topMarket.condition_id,
      tokenIds: getMarketTokenIds(topMarket),
      url: buildMarketUrl(event.slug, topMarket.slug),
      endDate: parseEndDate(topMarket.endDate ?? event.endDate),
      slug: topMarket.slug,
      eventId: event.id,
      eventSlug: event.slug,
    };
  }

  return {
    title: event.title,
    yesPrice: 50,
    volume: event.volume ?? 0,
    url: buildMarketUrl(event.slug),
    endDate: parseEndDate(event.endDate),
    slug: event.slug,
    eventId: event.id,
    eventSlug: event.slug,
  };
}

export function eventToGroupedPredictionMarket(event: PolymarketEvent): PredictionMarket | null {
  if (event.closed || !event.title || isMarketExcluded(event.title)) return null;

  const childMarkets = (event.markets ?? [])
    .filter(market => !market.closed && !isExpired(market.endDate) && !isMarketExcluded(market.question || event.title))
    .map((market): PredictionMarket => {
      const volume = getMarketVolume(market);
      return {
        title: market.question || event.title,
        yesPrice: parseMarketPrice(market),
        volume,
        liquidity: getMarketLiquidity(market),
        conditionId: market.conditionId || market.condition_id,
        tokenIds: getMarketTokenIds(market),
        url: buildMarketUrl(event.slug, market.slug),
        endDate: parseEndDate(market.endDate ?? event.endDate),
        slug: market.slug,
        eventId: event.id,
        eventSlug: event.slug,
      };
    });

  if (childMarkets.length === 0) {
    return {
      title: event.title,
      yesPrice: 50,
      volume: event.volume ?? 0,
      liquidity: event.liquidity ?? 0,
      url: buildMarketUrl(event.slug),
      endDate: parseEndDate(event.endDate),
      slug: event.slug,
      eventId: event.id,
      eventSlug: event.slug,
      marketCount: 1,
      markets: [],
    };
  }

  const representative = [...childMarkets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0]!;
  const totalVolume = childMarkets.reduce((sum, market) => sum + (market.volume ?? 0), 0) || event.volume || 0;
  const totalLiquidity = childMarkets.reduce((sum, market) => sum + (market.liquidity ?? 0), 0) || event.liquidity || 0;
  const earliestEndDate = childMarkets
    .map(market => market.endDate)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return {
    title: event.title,
    yesPrice: representative.yesPrice,
    volume: totalVolume,
    liquidity: totalLiquidity,
    conditionId: representative.conditionId,
    tokenIds: representative.tokenIds,
    url: representative.url || buildMarketUrl(event.slug),
    endDate: earliestEndDate ?? parseEndDate(event.endDate),
    slug: representative.slug || event.slug,
    eventId: event.id,
    eventSlug: event.slug,
    marketCount: childMarkets.length,
    markets: childMarkets,
  };
}

function marketToPredictionMarket(market: PolymarketMarket): PredictionMarket | null {
  if (!market.question || market.closed || isExpired(market.endDate) || isMarketExcluded(market.question)) return null;

  const eventId = market.eventId ?? market.event_id;
  const eventSlug = market.eventSlug ?? market.event_slug;
  const slug = market.slug;
  const volume = market.volumeNum ?? (market.volume ? parseFloat(market.volume) : 0);

  return {
    title: market.question,
    yesPrice: parseMarketPrice(market),
    volume,
    liquidity: getMarketLiquidity(market),
    conditionId: market.conditionId || market.condition_id,
    tokenIds: getMarketTokenIds(market),
    url: buildMarketUrl(typeof eventSlug === 'string' ? eventSlug : undefined, slug),
    endDate: parseEndDate(market.endDate),
    slug,
    eventId: eventId === undefined ? undefined : String(eventId),
    eventSlug: typeof eventSlug === 'string' ? eventSlug : undefined,
  };
}

function toGeoCandidate(market: PredictionMarket, matchScore = 1): { market: GeoPredictionMarket; matchScore: number } | null {
  const geotagged = geotagPredictionMarket(market, getMarketEventKey(market));
  if (!geotagged || geotagged.confidence === 'low') return null;

  return {
    market: {
      ...market,
      country: geotagged.country,
      region: geotagged.region,
      city: geotagged.city,
      lat: geotagged.lat,
      lon: geotagged.lon,
      confidence: geotagged.confidence,
      extractedFrom: geotagged.extractedFrom,
    },
    matchScore: matchScore + (geotagged.confidence === 'high' ? 4 : 2),
  };
}

interface DiscoveryOptions {
  pageSize?: number;
  pages?: number;
  tagLimit?: number;
}

async function fetchDiscoveryEvents(
  options: DiscoveryOptions = {},
  fetchTagEvents: TagEventFetcher = fetchEventsByTag,
): Promise<PolymarketEvent[]> {
  const pageSize = options.pageSize ?? GLOBAL_DISCOVERY_PAGE_SIZE;
  const pages = options.pages ?? GLOBAL_DISCOVERY_PAGES;
  const tagLimit = options.tagLimit ?? GLOBAL_DISCOVERY_PAGE_SIZE;
  const tagResults = await Promise.all(GLOBAL_DISCOVERY_TAGS.map(tag => fetchTagEvents(tag, tagLimit)));
  const pagedResults = await Promise.all(
    Array.from({ length: pages }, (_, page) => polyFetch('events', {
      closed: 'false',
      active: 'true',
      archived: 'false',
      end_date_min: new Date().toISOString(),
      order: 'volume',
      ascending: 'false',
      limit: String(pageSize),
      offset: String(page * pageSize),
    }).then(async (response) => {
      if (!response.ok) return [] as PolymarketEvent[];
      const data = await response.json();
      return Array.isArray(data) ? data as PolymarketEvent[] : [];
    }).catch(() => [] as PolymarketEvent[]))
  );

  const byEvent = new Map<string, PolymarketEvent>();
  for (const events of [...tagResults, ...pagedResults]) {
    for (const event of events) {
      if (!event.title || event.closed || isMarketExcluded(event.title)) continue;
      byEvent.set(getEventKey(event), event);
    }
  }

  return [...byEvent.values()]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

async function fetchDiscoveryMarkets(options: DiscoveryOptions = {}): Promise<PredictionMarket[]> {
  const pageSize = options.pageSize ?? GLOBAL_DISCOVERY_PAGE_SIZE;
  const pages = options.pages ?? GLOBAL_DISCOVERY_PAGES;
  const pageResults = await Promise.all(
    Array.from({ length: pages }, (_, page) => polyFetch('markets', {
      closed: 'false',
      active: 'true',
      archived: 'false',
      end_date_min: new Date().toISOString(),
      order: 'volume',
      ascending: 'false',
      limit: String(pageSize),
      offset: String(page * pageSize),
    }).then(async (response) => {
      if (!response.ok) return [] as PolymarketMarket[];
      const data = await response.json();
      return Array.isArray(data) ? data as PolymarketMarket[] : [];
    }).catch(() => [] as PolymarketMarket[]))
  );

  const byEvent = new Map<string, PredictionMarket>();
  for (const marketData of pageResults.flat()) {
    const market = marketToPredictionMarket(marketData);
    if (!market) continue;

    const key = getMarketEventKey(market);
    const existing = byEvent.get(key);
    if (!existing || (market.volume ?? 0) > (existing.volume ?? 0)) {
      byEvent.set(key, market);
    }
  }

  return [...byEvent.values()]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
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

export async function fetchCountryMarkets(
  country: string,
  fetchTagEvents: TagEventFetcher = fetchEventsByTag,
): Promise<PredictionMarket[]> {
  const tags = COUNTRY_TAG_MAP[country] ?? ['geopolitics', 'world'];
  const uniqueTags = [...new Set(tags)].slice(0, 3);
  const variants = getCountryVariants(country);

  try {
    const eventResults = await Promise.all(uniqueTags.map(tag => fetchTagEvents(tag, 160)));
    const seen = new Set<string>();
    const markets: PredictionMarket[] = [];

    for (const events of eventResults) {
      for (const event of events) {
        const eventKey = getEventKey(event);
        if (event.closed || seen.has(eventKey)) continue;
        seen.add(eventKey);

        const titleLower = event.title.toLowerCase();
        const eventTitleMatches = variants.some(v => titleLower.includes(v));
        if (!eventTitleMatches) {
          const marketTitles = (event.markets ?? []).map(m => (m.question ?? '').toLowerCase());
          if (!marketTitles.some(mt => variants.some(v => mt.includes(v)))) continue;
        }

        const market = eventToPredictionMarket(event, variants);
        if (market) markets.push(market);
      }
    }

    return markets
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, GEO_MARKETS_PER_COUNTRY);
  } catch (e) {
    console.error(`[Polymarket] fetchCountryMarkets(${country}) failed:`, e);
    return [];
  }
}

/** Groq LLM geotag fallback — batches unmatched high-volume markets. */
interface GroqGeotagResult {
  title: string;
  country: string;
  city?: string;
  lat: number;
  lon: number;
  confidence: string;
}

const GROQ_GEOTAG_CACHE_KEY = 'prediction:groq-geotag:v1';
const GROQ_GEOTAG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — LLM results are stable
const GROQ_VOLUME_THRESHOLD = 10_000; // Only send markets with volume > $10K

async function fetchGroqGeotags(
  markets: Array<{ title: string; slug?: string; volume?: number }>,
): Promise<Map<string, GroqGeotagResult>> {
  if (markets.length === 0) return new Map();

  // Check cache first — use title hash as cache key
  const cacheKey = `${GROQ_GEOTAG_CACHE_KEY}:${markets.map(m => m.slug || m.title).sort().join('|').slice(0, 500)}`;
  try {
    const cached = await getPersistentCache<GroqGeotagResult[]>(cacheKey);
    if (cached && cacheAgeMs(cached.updatedAt) < GROQ_GEOTAG_CACHE_TTL_MS) {
      const map = new Map<string, GroqGeotagResult>();
      for (const r of cached.data) {
        map.set(r.title, r);
      }
      return map;
    }
  } catch { /* cache miss */ }

  try {
    const resp = await fetch('/api/prediction/geotag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markets }),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) return new Map();

    const data = await resp.json() as { results?: GroqGeotagResult[] };
    const results = data.results || [];
    if (results.length === 0) return new Map();

    // Cache the results
    try {
      await setPersistentCache(cacheKey, results);
    } catch { /* cache write failed, non-critical */ }

    const map = new Map<string, GroqGeotagResult>();
    for (const r of results) {
      map.set(r.title, r);
    }
    return map;
  } catch {
    return new Map();
  }
}

function getGeoCountries(): string[] {
  return Object.keys(COUNTRY_TAG_MAP).filter(country => COUNTRY_CENTROIDS[country]);
}

function makeCountryCandidate(country: string, market: PredictionMarket, matchScore: number): Candidate | null {
  const centroid = COUNTRY_CENTROIDS[country];
  if (!centroid) return null;

  const [lon, lat] = spreadMarketAroundCountry(country, market, centroid);
  return {
    market: {
      ...market,
      country,
      lon,
      lat,
    },
    matchScore,
  };
}

function findBestCountryForEvent(event: PolymarketEvent, countries: string[]): Candidate | null {
  const groupedMarket = eventToGroupedPredictionMarket(event);
  if (groupedMarket) {
    const eventCandidate = toGeoCandidate(groupedMarket, 10);
    if (eventCandidate) return eventCandidate;
  }

  const eventTitle = event.title ?? '';
  const marketTitles = (event.markets ?? []).map(m => m.question ?? '');
  let bestCountry = '';
  let bestScore = 0;

  for (const country of countries) {
    const score = countryMatchScore(eventTitle, marketTitles, country);
    if (score > bestScore) {
      bestScore = score;
      bestCountry = country;
    }
  }

  if (!bestCountry || bestScore <= 0) return null;
  const market = eventToPredictionMarket(event, getCountryVariants(bestCountry));
  return market ? toGeoCandidate(market, bestScore) ?? makeCountryCandidate(bestCountry, market, bestScore) : null;
}

function findBestCountryForMarket(market: PredictionMarket, countries: string[]): Candidate | null {
  const directCandidate = toGeoCandidate(market, 6);
  if (directCandidate) return directCandidate;

  let bestCountry = '';
  let bestScore = 0;

  for (const country of countries) {
    const score = countryMatchScore('', [market.title], country);
    if (score > bestScore) {
      bestScore = score;
      bestCountry = country;
    }
  }

  return bestCountry && bestScore > 0 ? makeCountryCandidate(bestCountry, market, bestScore) : null;
}

function dedupeCandidates(candidates: Candidate[]): GeoPredictionMarket[] {
  const deduped = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = getMarketEventKey(candidate.market);
    const existing = deduped.get(key);
    if (
      !existing ||
      candidate.matchScore > existing.matchScore ||
      (candidate.matchScore === existing.matchScore && (candidate.market.volume ?? 0) > (existing.market.volume ?? 0))
    ) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()]
    .map(({ market }) => market)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, GEO_MARKETS_TOTAL_LIMIT);
}

async function fetchGeoTaggedMarketsQuick(): Promise<GeoPredictionMarket[]> {
  const countries = getGeoCountries();
  const fetchTagEvents = createTagEventFetcher();
  const quickOptions = {
    pageSize: QUICK_DISCOVERY_PAGE_SIZE,
    pages: QUICK_DISCOVERY_PAGES,
    tagLimit: QUICK_DISCOVERY_TAG_LIMIT,
  };
  const [events, markets] = await Promise.all([
    fetchDiscoveryEvents(quickOptions, fetchTagEvents),
    fetchDiscoveryMarkets(quickOptions),
  ]);

  const candidates = [
    ...events.map(event => findBestCountryForEvent(event, countries)),
    ...markets.map(market => findBestCountryForMarket(market, countries)),
  ].filter((candidate): candidate is Candidate => Boolean(candidate));

  return dedupeCandidates(candidates);
}

async function fetchGeoTaggedMarketsFresh(): Promise<GeoPredictionMarket[]> {
  const countries = getGeoCountries();
  const fetchTagEvents = createTagEventFetcher();

  const countryResultsPromise = runThrottled(countries, 6, async (country) => {
    const centroid = COUNTRY_CENTROIDS[country];
    if (!centroid) return [] as Candidate[];

    const markets = await fetchCountryMarkets(country, fetchTagEvents);
    return markets.map((market): Candidate => {
      const directCandidate = toGeoCandidate(market, countVariantMatches(market.title, country));
      if (directCandidate) return directCandidate;

      const [lon, lat] = spreadMarketAroundCountry(country, market, centroid);
      return {
        market: {
          ...market,
          country,
          lon,
          lat,
        },
        matchScore: countVariantMatches(market.title, country),
      };
    });
  });
  const [results, discoveryEvents, discoveryMarkets] = await Promise.all([
    countryResultsPromise,
    fetchDiscoveryEvents({}, fetchTagEvents),
    fetchDiscoveryMarkets(),
  ]);

  // Collect unmatched high-volume markets for Groq fallback.
  // Keep references to the full PredictionMarket objects so we can spread them.
  const unmatchedForGroq: Array<{ title: string; slug?: string; volume?: number }> = [];
  const unmatchedMarketMap = new Map<string, PredictionMarket>();

  // Build event geotag inheritance map: eventId → GeoPredictionMarket geotag.
  // Child markets that fail their own geotagging inherit the parent event's location.
  const eventGeotags = new Map<string, GeoPredictionMarket>();
  const deduped = new Map<string, Candidate>();

  const discoveryCandidateResults = discoveryEvents.map((event) => {
    const candidate = findBestCountryForEvent(event, countries);
    if (candidate) {
      // Record the event's geotag for child market inheritance
      if (event.id) {
        eventGeotags.set(String(event.id), candidate.market);
      }
      // Also try to geotag individual child markets that weren't bundled
      for (const childMarket of event.markets ?? []) {
        const childKey = childMarket.slug || (childMarket.question ?? '');
        if (!deduped.has(childKey)) {
          const fullMarket = eventToPredictionMarket(event, [childMarket.question ?? '']);
          if (!fullMarket) continue;
          const childGeo: GeoPredictionMarket = {
            ...fullMarket,
            country: candidate.market.country,
            city: candidate.market.city,
            lat: candidate.market.lat,
            lon: candidate.market.lon,
            confidence: candidate.market.confidence,
            extractedFrom: 'event-inherited',
          };
          deduped.set(childKey, { market: childGeo, matchScore: candidate.matchScore - 1 });
        }
      }
    }
    if (!candidate) {
      const topVol = event.markets?.reduce((max, m) => {
        const v = m.volumeNum ?? (m.volume ? parseFloat(m.volume) : 0);
        return v > max ? v : max;
      }, 0) ?? event.volume ?? 0;
      if (topVol >= GROQ_VOLUME_THRESHOLD) {
        const repMarket = event.markets?.[0];
        const entry = {
          title: repMarket?.question || event.title,
          slug: repMarket?.slug || event.slug,
          volume: topVol,
        };
        unmatchedForGroq.push(entry);
        // Store a minimal PredictionMarket for reconstruction
        unmatchedMarketMap.set(entry.title, {
          title: entry.title,
          yesPrice: 50,
          volume: topVol,
          slug: entry.slug,
          url: entry.slug ? buildMarketUrl(event.slug, entry.slug) : buildMarketUrl(event.slug),
          endDate: parseEndDate(repMarket?.endDate ?? event.endDate),
          eventId: event.id,
          eventSlug: event.slug,
        });
      }
    }
    return candidate;
  });
  const discoveryMarketCandidates = discoveryMarkets.map((market) => {
    const candidate = findBestCountryForMarket(market, countries);
    if (!candidate && (market.volume ?? 0) >= GROQ_VOLUME_THRESHOLD) {
      unmatchedForGroq.push({
        title: market.title,
        slug: market.slug,
        volume: market.volume,
      });
      unmatchedMarketMap.set(market.title, market);
    }
    return candidate;
  });

  // Fire Groq fallback in parallel with dedup (non-blocking)
  const groqPromise = fetchGroqGeotags(unmatchedForGroq.slice(0, 60));

  const discoveryCandidates = [
    ...discoveryCandidateResults,
    ...discoveryMarketCandidates,
  ].filter((candidate): candidate is Candidate => Boolean(candidate));

  for (const candidates of [...results, discoveryCandidates]) {
    for (const candidate of candidates) {
      const key = getMarketEventKey(candidate.market);
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

  // Merge Groq results for markets not yet matched
  try {
    const groqResults = await groqPromise;
    for (const market of unmatchedForGroq) {
      const groq = groqResults.get(market.title);
      if (!groq) continue;

      const key = market.slug || market.title;
      // Only add if not already matched by deterministic pass
      if (deduped.has(key)) continue;

      // Reconstruct the full PredictionMarket from our stored reference
      const fullMarket = unmatchedMarketMap.get(market.title);
      if (!fullMarket) continue;

      // Spread the point within the country bounds
      const bounds = COUNTRY_BOUNDS[groq.country.toLowerCase()];
      let lat = groq.lat;
      let lon = groq.lon;
      if (bounds) {
        const seed = `${groq.country}:${market.slug || market.title}`;
        const spread = sampleInsideCountry(groq.country, seed, bounds);
        lat = spread.lat;
        lon = spread.lon;
      }

      deduped.set(key, {
        market: {
          ...fullMarket,
          country: groq.country,
          city: groq.city,
          lat,
          lon,
          confidence: groq.confidence as 'high' | 'medium' | 'low',
          extractedFrom: groq.city ? 'city' : 'country',
        },
        matchScore: groq.confidence === 'high' ? 3 : 1,
      });
    }
  } catch {
    // Groq fallback failed — deterministic results still ship
  }

  // Apply event location inheritance: collect all unmatched markets that have
  // an eventId referencing a successfully-geotagged event, and inherit that location.
  // These are markets that appeared in discoveryEvents but didn't make it into deduped.
  for (const event of discoveryEvents) {
    if (!event.id) continue;
    const eventGeo = eventGeotags.get(String(event.id));
    if (!eventGeo) continue;

    for (const childMarket of event.markets ?? []) {
      const childKey = childMarket.slug || (childMarket.question ?? '');
      if (deduped.has(childKey)) continue; // already matched

      const fullMarket = eventToPredictionMarket(event, [childMarket.question ?? '']);
      if (!fullMarket) continue;

      deduped.set(childKey, {
        market: {
          ...fullMarket,
          country: eventGeo.country,
          city: eventGeo.city,
          lat: eventGeo.lat,
          lon: eventGeo.lon,
          confidence: 'low',
          extractedFrom: 'event-inherited' as const,
        },
        matchScore: 1,
      });
    }
  }

  return [...deduped.values()]
    .map(({ market }) => market)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, GEO_MARKETS_TOTAL_LIMIT);
}

export async function fetchGeoTaggedMarketsWithCache(refresh: () => Promise<GeoPredictionMarket[]> = fetchGeoTaggedMarketsFresh): Promise<GeoPredictionMarket[]> {
  const cached = await getPersistentCache<GeoPredictionMarket[]>(GEO_MARKETS_CACHE_KEY);
  if (cached && cacheAgeMs(cached.updatedAt) < GEO_MARKETS_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const markets = await refresh();
    if (markets.length > 0) {
      await setPersistentCache(GEO_MARKETS_CACHE_KEY, markets);
      return markets;
    }

    if (cached && cacheAgeMs(cached.updatedAt) < GEO_MARKETS_STALE_TTL_MS) {
      return cached.data;
    }

    return markets;
  } catch (error) {
    console.warn('[Polymarket] geotagged market refresh failed:', error);
    if (cached && cacheAgeMs(cached.updatedAt) < GEO_MARKETS_STALE_TTL_MS) {
      return cached.data;
    }
    return [];
  }
}

export async function fetchGeoTaggedMarkets(): Promise<GeoPredictionMarket[]> {
  return fetchGeoTaggedMarketsWithCache();
}

export async function fetchGeoTaggedMarketsInitial(): Promise<GeoTaggedMarketsInitialLoad> {
  const cached = await getPersistentCache<GeoPredictionMarket[]>(GEO_MARKETS_CACHE_KEY);
  if (cached && cached.data.length > 0) {
    const age = cacheAgeMs(cached.updatedAt);
    if (age < GEO_MARKETS_CACHE_TTL_MS) {
      return { markets: cached.data, needsRefresh: false, source: 'fresh-cache' };
    }
    if (age < GEO_MARKETS_STALE_TTL_MS) {
      return { markets: cached.data, needsRefresh: true, source: 'stale-cache' };
    }
  }

  try {
    const quickMarkets = await fetchGeoTaggedMarketsQuick();
    if (quickMarkets.length > 0) {
      return { markets: quickMarkets, needsRefresh: true, source: 'quick-refresh' };
    }
  } catch (error) {
    console.warn('[Polymarket] quick geotagged market refresh failed:', error);
  }

  return { markets: [], needsRefresh: true, source: 'empty' };
}

export async function refreshGeoTaggedMarkets(): Promise<GeoPredictionMarket[]> {
  if (!inFlightGeoMarketsRefresh) {
    inFlightGeoMarketsRefresh = (async () => {
      const markets = await fetchGeoTaggedMarketsFresh();
      if (markets.length > 0) {
        try {
          await setPersistentCache(GEO_MARKETS_CACHE_KEY, markets);
        } catch {
          // Cache persistence is opportunistic; fresh markets should still render.
        }
      }
      return markets;
    })().finally(() => {
      inFlightGeoMarketsRefresh = null;
    });
  }
  return inFlightGeoMarketsRefresh;
}
