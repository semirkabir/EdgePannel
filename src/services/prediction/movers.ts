import type { CorrelationSignal } from '@/services/correlation';
import { SITE_VARIANT } from '@/config/variant';
import { generateSignalId } from '@/utils/analysis-constants';
import { buildMarketUrl, isExpired, isMarketExcluded, normalizeTokenIds, parseMarketPrice, parseNumber } from './market-utils';
import { polyFetch } from './polymarket-client';
import type { PolymarketEvent, PolymarketMarket } from './types';

type PricePoint = { timestamp: number; price: number };

type RankedMover = {
  market: PolymarketMarket;
  event: PolymarketEvent;
  slug: string;
  tokenId: string;
  yesPrice: number;
  dayChangePoints: number;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  relevanceScore: number;
  importanceScore: number;
};

const EVENT_BUCKET_LIMIT = 80;
const CANDIDATE_POOL_LIMIT = 80;
const MAX_FINDINGS = 5;
const MIN_MOVE_POINTS = 5;
const MIN_VOLUME_24H = 10_000;
const DEDUPE_TTL_MS = 6 * 60 * 60 * 1000;
const FULL_RELEVANT_EVENT_TAGS = new Set([
  'politics',
  'geopolitics',
  'world',
  'elections',
  'election',
  'economy',
  'fed',
  'inflation',
  'ukraine',
  'china',
  'middle-east',
  'europe',
]);

const TECH_RELEVANT_EVENT_TAGS = new Set([
  'ai',
  'tech',
  'crypto',
  'science',
  'business',
  'economy',
]);

const FULL_VARIANT_TOPIC_WEIGHTS: Array<{ pattern: RegExp; weight: number }> = [
  // Highest-priority intelligence subjects
  { pattern: /iran|israel|syria|ukraine|russia|china|taiwan/i, weight: 1.0 },
  { pattern: /diplomatic|security agreement|ceasefire|peace deal|airspace/i, weight: 1.0 },
  { pattern: /military|war|invasion|strike|sanction/i, weight: 0.95 },

  // Political leadership and elections
  { pattern: /election|president|prime minister|speaker|starmer|macron/i, weight: 0.85 },

  // Macro / strategic economy
  { pattern: /tariff|fed|inflation|recession|oil|opec/i, weight: 0.75 },
];

const FULL_VARIANT_EXCLUDE_PATTERNS = [
  /\btweets?\b/i,
  /\bwhat will .* say\b/i,
  /\bwill .* say\b/i,
  /\belon musk\b/i,
  /\bbest ai model\b/i,
  /\bgta vi\b/i,
  /\balbum\b/i,
  /\btemperature\b/i,
  /\bexact score\b/i,
  /\bcounter-strike\b/i,
  /\bleague of legends\b/i,
  /\blol:/i,
  /\besports?\b/i,
];

const seenMoverKeys = new Map<string, number>();

function metric(value: unknown): number {
  return parseNumber(value, 0);
}

function normalizedMetric(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.log1p(value) / Math.log1p(max);
}

function marketKey(market: PolymarketMarket): string {
  return market.conditionId || market.condition_id || market.slug || String(market.id || market.question);
}

function fullVariantRelevanceScore(event: PolymarketEvent, market: PolymarketMarket): number {
  const haystack = `${event.title} ${market.question}`;
  return FULL_VARIANT_TOPIC_WEIGHTS.reduce((best, topic) =>
    topic.pattern.test(haystack) ? Math.max(best, topic.weight) : best, 0);
}

function includeMarket(market: PolymarketMarket): boolean {
  if (!market.question || market.closed || isExpired(market.endDate) || isMarketExcluded(market.question)) return false;
  if (!Number.isFinite(market.oneDayPriceChange ?? Number.NaN)) return false;
  if (SITE_VARIANT !== 'tech') {
    if (FULL_VARIANT_EXCLUDE_PATTERNS.some((pattern) => pattern.test(market.question))) return false;
  }
  return normalizeTokenIds(market.clobTokenIds ?? market.clob_token_ids).length > 0;
}

function includeEvent(event: PolymarketEvent): boolean {
  const tags = event.tags?.map((tag) => tag.slug?.toLowerCase()).filter(Boolean) || [];
  const relevantTags = SITE_VARIANT === 'tech' ? TECH_RELEVANT_EVENT_TAGS : FULL_RELEVANT_EVENT_TAGS;
  return tags.some((tag) => relevantTags.has(tag as string));
}

async function fetchEvents(order: 'volume_24hr' | 'volume' | 'liquidity'): Promise<PolymarketEvent[]> {
  const response = await polyFetch('events', {
    active: 'true',
    closed: 'false',
    archived: 'false',
    end_date_min: new Date().toISOString(),
    order,
    ascending: 'false',
    limit: String(EVENT_BUCKET_LIMIT),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function buildCandidatePool(eventBuckets: PolymarketEvent[][]): RankedMover[] {
  const byKey = new Map<string, { market: PolymarketMarket; event: PolymarketEvent }>();

  for (const events of eventBuckets) {
    for (const event of events) {
      if (!includeEvent(event)) continue;
      for (const market of event.markets || []) {
        if (!includeMarket(market)) continue;
        const key = marketKey(market);
        const existing = byKey.get(key);
        const currentVolume24h = metric(market.volume24hr ?? market.volume24hrClob ?? event.volume24hr);
        const existingVolume24h = metric(
          existing?.market.volume24hr
          ?? existing?.market.volume24hrClob
          ?? existing?.event.volume24hr,
        );
        if (!existing || currentVolume24h > existingVolume24h) byKey.set(key, { market, event });
      }
    }
  }

  const base = [...byKey.values()]
    .map(({ market, event }) => {
      const tokenIds = normalizeTokenIds(market.clobTokenIds ?? market.clob_token_ids);
      return {
        market,
        event,
        slug: market.slug || '',
        tokenId: tokenIds[0] || '',
        yesPrice: parseMarketPrice(market),
        dayChangePoints: metric(market.oneDayPriceChange) * 100,
        volume24h: metric(market.volume24hr ?? market.volume24hrClob ?? event.volume24hr),
        totalVolume: metric(market.volumeNum ?? market.volume),
        liquidity: metric(market.liquidityNum ?? market.liquidity ?? event.liquidity),
        relevanceScore: SITE_VARIANT === 'tech' ? 1 : fullVariantRelevanceScore(event, market),
        importanceScore: 0,
      };
    })
    .filter((item) => item.slug && item.tokenId && item.relevanceScore > 0);

  const maxVolume24h = Math.max(0, ...base.map((item) => item.volume24h));
  const maxTotalVolume = Math.max(0, ...base.map((item) => item.totalVolume));
  const maxLiquidity = Math.max(0, ...base.map((item) => item.liquidity));

  return base
    .map((item) => ({
      ...item,
      importanceScore:
        normalizedMetric(item.volume24h, maxVolume24h) * 0.35
        + normalizedMetric(item.totalVolume, maxTotalVolume) * 0.25
        + normalizedMetric(item.liquidity, maxLiquidity) * 0.15
        + item.relevanceScore * 0.25,
    }))
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, CANDIDATE_POOL_LIMIT);
}

async function fetchBatchPriceHistory(tokenIds: string[]): Promise<Record<string, PricePoint[]>> {
  if (tokenIds.length === 0) return {};
  const nowSec = Math.floor(Date.now() / 1000);

  const response = await fetch('https://clob.polymarket.com/batch-prices-history', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markets: tokenIds.slice(0, 20),
      start_ts: nowSec - 24 * 60 * 60,
      end_ts: nowSec,
      interval: '1h',
      fidelity: 1,
    }),
  }).catch(() => null);

  if (!response?.ok) return {};
  const payload = await response.json() as { history?: Record<string, Array<{ t?: number; p?: number }>> };
  const result: Record<string, PricePoint[]> = {};

  for (const [tokenId, history] of Object.entries(payload.history || {})) {
    result[tokenId] = history
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p))
      .map((point) => ({
        timestamp: (point.t as number) * 1000,
        price: Math.round((point.p as number) * 10_000) / 100,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  return result;
}

function fallbackHistory(item: RankedMover): PricePoint[] {
  const now = Date.now();
  return [
    { timestamp: now - 24 * 60 * 60 * 1000, price: Math.max(0, Math.min(100, item.yesPrice - item.dayChangePoints)) },
    { timestamp: now, price: Math.max(0, Math.min(100, item.yesPrice)) },
  ];
}

function compactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function pruneSeen(now: number): void {
  for (const [key, timestamp] of seenMoverKeys) {
    if (now - timestamp > DEDUPE_TTL_MS) seenMoverKeys.delete(key);
  }
}

function toSignal(item: RankedMover, history: PricePoint[]): CorrelationSignal {
  const moveLabel = `${item.dayChangePoints >= 0 ? '+' : ''}${item.dayChangePoints.toFixed(1)} pts`;
  return {
    id: generateSignalId(),
    type: 'prediction_mover',
    title: 'Prediction Market Mover',
    description: `"${item.market.question}" moved ${moveLabel} in 24h on ${compactUsd(item.volume24h)} volume`,
    confidence: Math.min(0.95, 0.55 + Math.abs(item.dayChangePoints) / 50 + item.importanceScore / 5),
    timestamp: new Date(),
    data: {
      predictionShift: item.dayChangePoints,
      relatedTopics: [],
      marketTitle: item.market.question,
      marketSlug: item.slug,
      marketUrl: buildMarketUrl(item.event.slug, item.slug) || buildMarketUrl(undefined, item.slug),
      currentPrice: item.yesPrice,
      dayChangePoints: item.dayChangePoints,
      dayChangeDirection: item.dayChangePoints >= 0 ? 'up' : 'down',
      volume24h: item.volume24h,
      totalVolume: item.totalVolume,
      liquidity: item.liquidity,
      relevanceScore: item.relevanceScore,
      importanceScore: item.importanceScore,
      priceHistory24h: history,
    },
  };
}

export async function fetchPredictionMoverSignals(): Promise<CorrelationSignal[]> {
  const [volume24hEvents, volumeEvents, liquidityEvents] = await Promise.all([
    fetchEvents('volume_24hr'),
    fetchEvents('volume'),
    fetchEvents('liquidity'),
  ]);

  const movers = buildCandidatePool([volume24hEvents, volumeEvents, liquidityEvents])
    .filter((item) => Math.abs(item.dayChangePoints) >= MIN_MOVE_POINTS && item.volume24h >= MIN_VOLUME_24H)
    .sort((a, b) =>
      Math.abs(b.dayChangePoints) - Math.abs(a.dayChangePoints)
      || b.importanceScore - a.importanceScore
      || b.volume24h - a.volume24h,
    )
    .slice(0, MAX_FINDINGS);

  const historyByToken = await fetchBatchPriceHistory(movers.map((item) => item.tokenId));
  const now = Date.now();
  pruneSeen(now);

  const signals: CorrelationSignal[] = [];
  for (const mover of movers) {
    const dedupeKey = `${mover.slug}:${Math.round(mover.dayChangePoints)}`;
    if (seenMoverKeys.has(dedupeKey)) continue;
    seenMoverKeys.set(dedupeKey, now);
    signals.push(toSignal(mover, historyByToken[mover.tokenId] || fallbackHistory(mover)));
  }
  return signals;
}
