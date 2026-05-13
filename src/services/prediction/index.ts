export type { PredictionMarket, GeoPredictionMarket, PredictionMarketDetailResponse, PolymarketMarket, PolymarketEvent, BootstrapPredictionData } from './types';
export { isMarketExcluded, parseMarketPrice, buildMarketUrl, extractMarketSlug, parseEndDate, isExpired, normalizePredictionMarket, deduplicateMarkets, parseNumber, normalizeTokenIds, parseEpochMillis } from './market-utils';
export { fetchPredictions, getPredictionMarketDetail, fetchMarketDetails, polyFetch, fetchEventsByTag, client } from './polymarket-client';
export { fetchCountryMarkets, fetchGeoTaggedMarkets } from './country-fetcher';

import type { PredictionMarket, PolymarketEvent } from './types';
import { isExpired, parseMarketPrice, buildMarketUrl, parseEndDate, extractMarketSlug, isMarketExcluded } from './market-utils';
import { polyFetch, client } from './polymarket-client';

export async function searchPredictions(query: string): Promise<PredictionMarket[]> {
  if (!query || query.length < 2) return [];
  const lowerQuery = query.toLowerCase();
  const dedupeAndSort = (markets: PredictionMarket[]): PredictionMarket[] => {
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
  };

  try {
    const markets: PredictionMarket[] = [];
    const seen = new Set<string>();
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const resp = await client.listPredictionMarkets({
        category: '',
        query,
        pageSize: 100,
        cursor,
      });
      for (const m of resp.markets ?? []) {
        const closesAt = m.closesAt ? new Date(m.closesAt).toISOString() : undefined;
        if (isExpired(closesAt)) continue;
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        markets.push({
          title: m.title,
          yesPrice: m.yesPrice * 100,
          volume: m.volume,
          url: m.url,
          endDate: closesAt,
          slug: extractMarketSlug(m.url) || m.id,
        });
      }
      cursor = resp.pagination?.nextCursor ?? '';
      if (!cursor) break;
    }
    if (markets.length > 0) {
      return dedupeAndSort(markets);
    }
  } catch { /* RPC unavailable (e.g. localhost), fall through */ }

  try {
    const response = await polyFetch('events', {
      closed: 'false',
      active: 'true',
      archived: 'false',
      end_date_min: new Date().toISOString(),
      order: 'volume',
      ascending: 'false',
      limit: '250',
    });
    if (!response.ok) return [];
    const events: PolymarketEvent[] = await response.json();
    if (!Array.isArray(events)) return [];

    const results: PredictionMarket[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      if (event.closed || seen.has(event.id)) continue;
      seen.add(event.id);

      const titleMatches = event.title?.toLowerCase().includes(lowerQuery);
      const matchingMarkets = (event.markets ?? []).filter(m =>
        m.question?.toLowerCase().includes(lowerQuery),
      );

      if (!titleMatches && matchingMarkets.length === 0) continue;
      if (isMarketExcluded(event.title)) continue;

      const candidates = matchingMarkets.length > 0
        ? matchingMarkets.filter(m => !m.closed && !isExpired(m.endDate))
        : (event.markets ?? []).filter(m => !m.closed && !isExpired(m.endDate));

      if (candidates.length > 0) {
        for (const market of candidates) {
          const marketKey = market.slug || `${event.id}:${market.question || event.title}`;
          if (seen.has(marketKey)) continue;
          seen.add(marketKey);
          results.push({
            title: market.question || event.title,
            yesPrice: parseMarketPrice(market),
            volume: market.volumeNum ?? (market.volume ? parseFloat(market.volume) : event.volume ?? 0),
            url: market.slug ? buildMarketUrl(event.slug, market.slug) : buildMarketUrl(event.slug),
            endDate: parseEndDate(market.endDate ?? event.endDate),
            slug: market.slug,
          });
        }
      } else if (titleMatches) {
        results.push({
          title: event.title,
          yesPrice: 50,
          volume: event.volume ?? 0,
          url: buildMarketUrl(event.slug),
          endDate: parseEndDate(event.endDate),
          slug: event.slug,
        });
      }
    }

    return dedupeAndSort(results);
  } catch { return []; }
}
