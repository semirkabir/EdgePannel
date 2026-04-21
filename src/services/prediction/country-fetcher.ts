import type { PredictionMarket } from './types';
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
