import type { AppContext } from '@/app/app-context';
import { getTrendingTermSnapshots } from '@/services/trending-keywords';

export interface TrendingSearchItem {
  label: string;
  query: string;
  icon: string;
  meta?: string;
}

const MAX_TRENDING_ITEMS = 14;

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function addUnique(items: TrendingSearchItem[], item: TrendingSearchItem): void {
  if (!item.query || !item.label) return;
  const key = item.query.toLowerCase();
  if (items.some(existing => existing.query.toLowerCase() === key || existing.label.toLowerCase() === item.label.toLowerCase())) return;
  items.push(item);
}

function headlineTerm(title: string): string {
  const compact = clean(title)
    .replace(/^[^:]{1,18}:\s*/, '')
    .replace(/\s+-\s+[^-]{2,40}$/, '');
  const words = compact.split(/\s+/).filter(word => /[A-Za-z0-9]/.test(word));
  return words.slice(0, 5).join(' ');
}

/**
 * Build a mixed set of trending search chips — stocks, predictions,
 * trending terms, and breaking news — for the search modal marquee.
 * Interleaved so the variety is visible while scrolling.
 */
export function buildLiveTrendingSearches(ctx: AppContext): TrendingSearchItem[] {
  // Gather candidates from each source separately, then interleave
  const stockItems: TrendingSearchItem[] = [];
  const termItems: TrendingSearchItem[] = [];
  const predictionItems: TrendingSearchItem[] = [];
  const newsItems: TrendingSearchItem[] = [];

  // --- Stock market movers (sorted by absolute % change) ---
  const markets = ctx.intelligenceStore?.latestMarkets?.length
    ? ctx.intelligenceStore.latestMarkets
    : ctx.latestMarkets;
  for (const market of [...markets]
    .filter(m => Number.isFinite(m.change ?? NaN))
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, 6)) {
    const change = market.change ?? 0;
    stockItems.push({
      label: market.symbol,
      query: market.symbol,
      icon: change >= 0 ? '🟢' : '🔴',
      meta: `${change >= 0 ? '+' : ''}${change.toFixed(2)}% · ${market.name}`,
    });
  }

  // --- GDELT / source-mention trending terms ---
  for (const term of getTrendingTermSnapshots(5)) {
    termItems.push({
      label: term.term,
      query: term.term,
      icon: term.uniqueSources >= 3 ? '📈' : '🔥',
      meta: term.uniqueSources > 1
        ? `${term.count} mentions · ${term.uniqueSources} sources`
        : `${term.count} mentions`,
    });
  }

  // --- Prediction markets sorted by volume ---
  const predictions = ctx.intelligenceStore?.latestPredictions?.length
    ? ctx.intelligenceStore.latestPredictions
    : ctx.latestPredictions;
  for (const market of [...predictions].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 3)) {
    const label = headlineTerm(market.title);
    predictionItems.push({
      label,
      query: label,
      icon: '🎯',
      meta: Number.isFinite(market.yesPrice)
        ? `${Math.round(market.yesPrice)}% odds`
        : 'prediction market',
    });
  }

  // --- Breaking news headlines ---
  const news = ctx.newsStore?.allNews?.length ? ctx.newsStore.allNews : ctx.allNews;
  for (const item of [...news]
    .sort((a, b) =>
      Number(Boolean(b.isAlert)) - Number(Boolean(a.isAlert)) ||
      b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 3)) {
    const query = headlineTerm(item.title);
    newsItems.push({
      label: query,
      query,
      icon: item.isAlert ? '⚡' : '📰',
      meta: item.source,
    });
  }

  // Interleave: stock, term, stock, prediction, stock, news, stock, term, …
  // This keeps variety visible in the first N chips without clustering by type.
  const result: TrendingSearchItem[] = [];
  const queues = [stockItems, termItems, predictionItems, newsItems].filter(q => q.length > 0);
  let qi = 0;
  while (result.length < MAX_TRENDING_ITEMS && queues.some(q => q.length > 0)) {
    const q = queues[qi % queues.length]!;
    if (q.length > 0) {
      const item = q.shift()!;
      addUnique(result, item);
    }
    qi++;
  }

  return result;
}
