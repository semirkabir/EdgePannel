import type { AppContext, IntelligenceCache } from '@/app/app-context';
import type { ClusteredEvent, CyberThreat, MarketData, NewsItem } from '@/types';
import type { PredictionMarket } from '@/services/prediction';

type PhrasePools = Array<readonly string[]>;

const MAX_PHRASE_LENGTH = 72;
const MAX_POOL_ITEMS = 8;
const MAX_TOTAL_PHRASES = 60;

function compactText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, max = MAX_PHRASE_LENGTH): string {
  const text = compactText(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max - 1).trimEnd();
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 36 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}...`;
}

function withPrefix(prefix: string, value: unknown): string {
  const text = truncate(compactText(value), MAX_PHRASE_LENGTH - prefix.length - 2);
  return text ? `${prefix}: ${text}` : '';
}

function dateMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const phrase = compactText(value);
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(phrase);
  }
  return deduped;
}

function interleavePools(pools: PhrasePools): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...pools.map((pool) => pool.length));

  for (let i = 0; i < maxLength && phrases.length < MAX_TOTAL_PHRASES; i++) {
    for (const pool of pools) {
      const phrase = pool[i];
      if (!phrase) continue;
      const key = phrase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      phrases.push(phrase);
      if (phrases.length >= MAX_TOTAL_PHRASES) break;
    }
  }

  return phrases;
}

function latestNewsPhrases(news: readonly NewsItem[], prefix: string): string[] {
  return unique(
    [...news]
      .sort((a, b) => {
        const alertDelta = Number(Boolean(b.isAlert)) - Number(Boolean(a.isAlert));
        if (alertDelta !== 0) return alertDelta;
        const tierDelta = (a.tier ?? 99) - (b.tier ?? 99);
        if (tierDelta !== 0) return tierDelta;
        return dateMs(b.pubDate) - dateMs(a.pubDate);
      })
      .slice(0, MAX_POOL_ITEMS)
      .map((item) => withPrefix(prefix, item.title)),
  );
}

function clusterPhrases(clusters: readonly ClusteredEvent[]): string[] {
  return unique(
    [...clusters]
      .sort((a, b) => {
        const alertDelta = Number(Boolean(b.isAlert)) - Number(Boolean(a.isAlert));
        if (alertDelta !== 0) return alertDelta;
        const sourceDelta = (b.sourceCount ?? 0) - (a.sourceCount ?? 0);
        if (sourceDelta !== 0) return sourceDelta;
        return dateMs(b.lastUpdated) - dateMs(a.lastUpdated);
      })
      .slice(0, MAX_POOL_ITEMS)
      .map((cluster) => withPrefix('Cluster', cluster.primaryTitle)),
  );
}

function predictionPhrases(predictions: readonly PredictionMarket[]): string[] {
  return unique(
    [...predictions]
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, MAX_POOL_ITEMS)
      .map((market) => {
        const probability = Number.isFinite(market.yesPrice) ? `${Math.round(market.yesPrice)}%` : '';
        return withPrefix(probability ? `Odds ${probability}` : 'Prediction', market.title);
      }),
  );
}

function marketPhrases(markets: readonly MarketData[]): string[] {
  return unique(
    [...markets]
      .filter((market) => Number.isFinite(market.change ?? NaN))
      .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
      .slice(0, MAX_POOL_ITEMS)
      .map((market) => {
        const change = market.change ?? 0;
        const direction = change >= 0 ? '+' : '';
        return truncate(`${market.symbol} ${direction}${change.toFixed(2)}% ${market.name}`);
      }),
  );
}

function cyberPhrases(threats: readonly CyberThreat[]): string[] {
  const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return unique(
    [...threats]
      .sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0))
      .slice(0, MAX_POOL_ITEMS)
      .map((threat) => {
        const label = threat.malwareFamily || threat.tags[0] || threat.indicator;
        return withPrefix('Cyber', [label, threat.country, threat.severity].filter(Boolean).join(' '));
      }),
  );
}

function cachePhrases(cache: IntelligenceCache): string[] {
  const phrases: string[] = [];

  for (const outage of (cache.outages ?? []).slice(0, 4)) {
    const record = outage as { country?: string; countryName?: string; provider?: string; impact?: string; severity?: string };
    phrases.push(withPrefix('Outage', [record.countryName || record.country, record.provider, record.impact || record.severity].filter(Boolean).join(' ')));
  }

  for (const protest of (cache.protests?.events ?? []).slice(0, 4)) {
    const record = protest as { location?: string; country?: string; eventType?: string; actor1?: string; notes?: string };
    phrases.push(withPrefix('Protest', [record.location || record.country, record.eventType, record.actor1, record.notes].filter(Boolean).join(' ')));
  }

  for (const quake of (cache.earthquakes ?? []).slice(0, 4)) {
    const record = quake as { magnitude?: number; mag?: number; place?: string; location?: string };
    const magnitude = record.magnitude ?? record.mag;
    phrases.push(withPrefix('Quake', [`M${magnitude ?? '?'}`, record.place || record.location].filter(Boolean).join(' ')));
  }

  for (const advisory of (cache.advisories ?? []).slice(0, 4)) {
    const record = advisory as { title?: string; name?: string; severity?: string };
    phrases.push(withPrefix('Advisory', [record.severity, record.title || record.name].filter(Boolean).join(' ')));
  }

  const military = cache.military;
  if (military?.flightClusters?.length) {
    phrases.push(...military.flightClusters.slice(0, 4).map((cluster) => {
      const record = cluster as { label?: string; callsigns?: string[]; region?: string; count?: number };
      return withPrefix('Military air', [record.label, record.region, record.count ? `${record.count} flights` : '', record.callsigns?.[0]].filter(Boolean).join(' '));
    }));
  } else if (military?.flights?.length) {
    phrases.push(...military.flights.slice(0, 4).map((flight) => {
      const record = flight as { callsign?: string; aircraftType?: string; country?: string };
      return withPrefix('Military air', [record.callsign, record.aircraftType, record.country].filter(Boolean).join(' '));
    }));
  }

  return unique(phrases);
}

export function buildLiveSearchTickerPhrases(ctx: AppContext): string[] {
  const news = ctx.newsStore?.allNews?.length ? ctx.newsStore.allNews : ctx.allNews;
  const happyNews = ctx.newsStore?.happyAllItems?.length ? ctx.newsStore.happyAllItems : ctx.happyAllItems;
  const markets = ctx.intelligenceStore?.latestMarkets?.length ? ctx.intelligenceStore.latestMarkets : ctx.latestMarkets;
  const predictions = ctx.intelligenceStore?.latestPredictions?.length ? ctx.intelligenceStore.latestPredictions : ctx.latestPredictions;
  const clusters = ctx.intelligenceStore?.latestClusters?.length ? ctx.intelligenceStore.latestClusters : ctx.latestClusters;
  const cyber = ctx.intelligenceStore?.cyberThreatsCache ?? ctx.cyberThreatsCache ?? [];
  const cache = ctx.intelligenceStore?.cache ?? ctx.intelligenceCache;

  return interleavePools([
    latestNewsPhrases(happyNews.length > 0 ? happyNews : news, happyNews.length > 0 ? 'Good news' : 'News'),
    clusterPhrases(clusters),
    predictionPhrases(predictions),
    marketPhrases(markets),
    cyberPhrases(cyber),
    cachePhrases(cache),
  ]);
}
