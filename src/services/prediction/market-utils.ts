import type { PredictionMarket, PolymarketMarket } from './types';

const EXCLUDE_KEYWORDS = [
  'nba', 'nfl', 'mlb', 'nhl', 'fifa', 'world cup', 'super bowl', 'championship',
  'playoffs', 'oscar', 'grammy', 'emmy', 'box office', 'movie', 'album', 'song',
  'streamer', 'influencer', 'celebrity', 'kardashian',
  'bachelor', 'reality tv', 'mvp', 'touchdown', 'home run', 'goal scorer',
  'academy award', 'bafta', 'golden globe', 'cannes', 'sundance',
  'documentary', 'feature film', 'tv series', 'season finale',
  'tweet', 'tweets', 'what will', 'will elon musk post', 'gta vi',
];

export function isMarketExcluded(title: string): boolean {
  const lower = title.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
}

export function parseMarketPrice(market: PolymarketMarket): number {
  try {
    const pricesStr = market.outcomePrices;
    if (pricesStr) {
      const prices: string[] = JSON.parse(pricesStr);
      if (prices.length >= 1) {
        const parsed = parseFloat(prices[0]!);
        if (!isNaN(parsed)) return parsed * 100;
      }
    }
  } catch { /* keep default */ }
  return 50;
}

export function buildMarketUrl(eventSlug?: string, marketSlug?: string): string | undefined {
  if (eventSlug && marketSlug) return `https://polymarket.com/event/${eventSlug}/${marketSlug}`;
  if (marketSlug) return `https://polymarket.com/market/${marketSlug}`;
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;
  return undefined;
}

export function extractMarketSlug(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://polymarket.com');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'market' && parts[1]) return parts[1];
    if (parts[0] === 'event' && parts[2]) return parts[2];
  } catch {
    return value;
  }
  return undefined;
}

export function parseEndDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? raw : undefined;
}

export function isExpired(endDate?: string): boolean {
  if (!endDate) return false;
  const ms = Date.parse(endDate);
  return Number.isFinite(ms) && ms < Date.now();
}

export function normalizePredictionMarket(market: PredictionMarket): PredictionMarket {
  const slug = market.slug || extractMarketSlug(market.url);
  const url = slug
    ? (market.url?.includes('/event/') || market.url?.includes('/market/') ? market.url : buildMarketUrl(undefined, slug))
    : market.url;
  return {
    ...market,
    slug,
    url,
  };
}

export function deduplicateMarkets(markets: PredictionMarket[]): PredictionMarket[] {
  const deduped = new Map<string, PredictionMarket>();
  for (const market of markets) {
    const key = market.slug || market.url || market.title;
    if (!key) continue;
    const existing = deduped.get(key);
    if (!existing || (market.volume ?? 0) > (existing.volume ?? 0)) {
      deduped.set(key, market);
    }
  }
  return [...deduped.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

export function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeTokenIds(raw?: string[] | string): string[] {
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
  } catch {
    return [];
  }
}

export function parseEpochMillis(value: unknown): number {
  const parsed = parseNumber(value);
  if (!parsed) return 0;
  return parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
}
