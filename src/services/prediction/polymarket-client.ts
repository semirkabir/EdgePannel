import { PredictionServiceClient, type GetPredictionMarketDetailResponse } from '@/generated/client/worldmonitor/prediction/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { isDesktopRuntime } from '@/services/runtime';
import { tryInvokeTauri } from '@/services/tauri-bridge';
import { getHydratedData } from '@/services/bootstrap';
import { SITE_VARIANT } from '@/config';
import type { PredictionMarket, PolymarketMarket, PolymarketEvent, BootstrapPredictionData } from './types';
import {
  isMarketExcluded,
  parseMarketPrice,
  buildMarketUrl,
  parseEndDate,
  isExpired,
  parseNumber,
  normalizeTokenIds,
  parseEpochMillis,
  extractMarketSlug,
  normalizePredictionMarket,
} from './market-utils';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const POLYMARKET_PROXY_URL = '/api/polymarket';
const wsRelayUrl = import.meta.env.VITE_WS_RELAY_URL || '';
const DIRECT_RAILWAY_POLY_URL = wsRelayUrl
  ? wsRelayUrl.replace('wss://', 'https://').replace('ws://', 'http://').replace(/\/$/, '') + '/polymarket'
  : '';
const isLocalhostRuntime = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const PROXY_STRIP_KEYS = new Set(['end_date_min', 'active', 'archived']);

const breaker = createCircuitBreaker<PredictionMarket[]>({ name: 'Polymarket', cacheTtlMs: 24 * 60 * 60 * 1000, persistCache: true });

export const client = new PredictionServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

let directFetchWorks: boolean | null = null;
let directFetchProbe: Promise<boolean> | null = null;
async function probeDirectFetchCapability(): Promise<boolean> {
  if (directFetchWorks !== null) return directFetchWorks;
  if (!directFetchProbe) {
    directFetchProbe = fetch(`${GAMMA_API}/events?closed=false&active=true&archived=false&order=volume&ascending=false&limit=1`, {
      headers: { 'Accept': 'application/json' },
    })
      .then(resp => {
        directFetchWorks = resp.ok;
        return directFetchWorks;
      })
      .catch(() => {
        directFetchWorks = false;
        return false;
      })
      .finally(() => {
        directFetchProbe = null;
      });
  }
  return directFetchProbe;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const timeout = AbortSignal.timeout(8000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: combined });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function fetchBroadPriceHistory(tokenId: string, signal?: AbortSignal): Promise<Array<{ timestamp: number; price: number }>> {
  const urls = [
    `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=max&fidelity=60`,
    `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=1w&fidelity=1`,
    `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=1d&fidelity=1`,
    `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=6h&fidelity=1`,
    `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=1h&fidelity=1`,
  ];

  const results = await Promise.all(urls.map((url) => fetchJson<{ history?: Array<{ t?: number; p?: number }> }>(url, signal)));
  const merged = new Map<number, number>();

  for (const historyData of results) {
    for (const point of historyData?.history || []) {
      if (!Number.isFinite(point?.t) || !Number.isFinite(point?.p)) continue;
      merged.set(parseEpochMillis(point.t as number), point.p as number);
    }
  }

  return [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, price]) => ({ timestamp, price }));
}

export async function polyFetch(endpoint: 'events' | 'markets', params: Record<string, string>): Promise<Response> {
  const qs = new URLSearchParams(params).toString();

  const canUseDirect = directFetchWorks === true || (directFetchWorks === null && await probeDirectFetchCapability());
  if (canUseDirect) {
    try {
      const resp = await fetch(`${GAMMA_API}/${endpoint}?${qs}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (resp.ok) {
        directFetchWorks = true;
        return resp;
      }
    } catch {
      directFetchWorks = false;
    }
  }

  if (isDesktopRuntime()) {
    try {
      const body = await tryInvokeTauri<string>('fetch_polymarket', { path: endpoint, params: qs });
      if (body) {
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch { /* Tauri command failed, fall through to proxy */ }
  }

  const proxyParams: Record<string, string> = { endpoint };
  for (const [k, v] of Object.entries(params)) {
    if (PROXY_STRIP_KEYS.has(k)) continue;
    proxyParams[k === 'tag_slug' ? 'tag' : k] = v;
  }
  const proxyQs = new URLSearchParams(proxyParams).toString();

  try {
    const resp = await fetch(`${POLYMARKET_PROXY_URL}?${proxyQs}`);
    if (resp.ok) {
      const data = await resp.clone().json();
      if (Array.isArray(data) && data.length > 0) return resp;
    }
  } catch { /* Proxy unavailable */ }

  if (isLocalhostRuntime && DIRECT_RAILWAY_POLY_URL) {
    try {
      const resp = await fetch(`${DIRECT_RAILWAY_POLY_URL}?${proxyQs}`);
      if (resp.ok) {
        const data = await resp.clone().json();
        if (Array.isArray(data) && data.length > 0) return resp;
      }
    } catch { /* Railway unavailable */ }
  }

  try {
    const resp = await client.listPredictionMarkets({
      category: params.tag_slug ?? '',
      query: '',
      pageSize: parseInt(params.limit ?? '50', 10),
      cursor: '',
    });
    if (resp.markets && resp.markets.length > 0) {
      const gammaData = resp.markets.map(m => ({
        question: m.title,
        outcomePrices: JSON.stringify([String(m.yesPrice), String(1 - m.yesPrice)]),
        volumeNum: m.volume,
        slug: extractMarketSlug(m.url) || m.id,
        endDate: m.closesAt ? new Date(m.closesAt).toISOString() : undefined,
      }));
      return new Response(JSON.stringify(endpoint === 'events'
        ? [{ id: 'sebuf', title: gammaData[0]?.question, slug: '', volume: 0, markets: gammaData }]
        : gammaData
      ), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch { /* sebuf handler failed (Cloudflare expected) */ }

  return fetch(`${POLYMARKET_PROXY_URL}?${proxyQs}`);
}

export async function fetchEventsByTag(tag: string, limit = 50): Promise<PolymarketEvent[]> {
  const response = await polyFetch('events', {
    tag_slug: tag,
    closed: 'false',
    active: 'true',
    archived: 'false',
    end_date_min: new Date().toISOString(),
    order: 'volume',
    ascending: 'false',
    limit: String(limit),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function fetchTopMarkets(): Promise<PredictionMarket[]> {
  const response = await polyFetch('markets', {
    closed: 'false',
    active: 'true',
    archived: 'false',
    end_date_min: new Date().toISOString(),
    order: 'volume',
    ascending: 'false',
    limit: '200',
  });
  if (!response.ok) return [];
  const data: PolymarketMarket[] = await response.json();

  return data
    .filter(m => m.question && !isMarketExcluded(m.question))
    .map(m => {
      const yesPrice = parseMarketPrice(m);
      const volume = m.volumeNum ?? (m.volume ? parseFloat(m.volume) : 0);
      return {
        title: m.question,
        yesPrice,
        volume,
        url: buildMarketUrl(undefined, m.slug),
        endDate: parseEndDate(m.endDate),
        slug: m.slug,
      };
    });
}

const GEOPOLITICAL_TAGS = [
  'politics', 'geopolitics', 'elections', 'world',
  'ukraine', 'china', 'middle-east', 'europe',
  'economy', 'fed', 'inflation',
];

const TECH_TAGS = [
  'ai', 'tech', 'crypto', 'science',
  'elon-musk', 'business', 'economy',
];

const POOL_SIZE = 150;

export async function fetchPredictions(): Promise<PredictionMarket[]> {
  return breaker.execute(async () => {
    const hydrated = getHydratedData('predictions') as BootstrapPredictionData | undefined;
    if (hydrated && hydrated.fetchedAt && Date.now() - hydrated.fetchedAt < 2 * 60 * 60 * 1000) {
      const variant = SITE_VARIANT === 'tech' ? hydrated.tech : hydrated.geopolitical;
      if (variant && variant.length > 0) {
        return variant.map(normalizePredictionMarket);
      }
    }

    try {
      const tags = SITE_VARIANT === 'tech' ? TECH_TAGS : GEOPOLITICAL_TAGS;
      const rpcResults = await client.listPredictionMarkets({
        category: tags[0] ?? '',
        query: '',
        pageSize: POOL_SIZE,
        cursor: '',
      });
      if (rpcResults.markets && rpcResults.markets.length > 0) {
        return rpcResults.markets
          .filter(m => !isExpired(m.closesAt ? new Date(m.closesAt).toISOString() : undefined))
          .map(m => ({
            title: m.title,
            yesPrice: m.yesPrice * 100,
            volume: m.volume,
            url: m.url,
            endDate: m.closesAt ? new Date(m.closesAt).toISOString() : undefined,
            slug: extractMarketSlug(m.url) || m.id,
          }))
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, POOL_SIZE);
      }
    } catch { /* RPC failed, fall through to direct fetch */ }

    const tags = SITE_VARIANT === 'tech' ? TECH_TAGS : GEOPOLITICAL_TAGS;
    const eventResults = await Promise.all(tags.map(tag => fetchEventsByTag(tag, 50)));

    const seen = new Set<string>();
    const markets: PredictionMarket[] = [];

    for (const events of eventResults) {
      for (const event of events) {
        if (event.closed || seen.has(event.id)) continue;
        seen.add(event.id);

        if (isMarketExcluded(event.title)) continue;

        const eventVolume = event.volume ?? 0;

        if (event.markets && event.markets.length > 0) {
          const activeCandidates = event.markets.filter(m =>
            !m.closed && !isExpired(m.endDate)
          );
          if (activeCandidates.length === 0) continue;

          const topMarket = activeCandidates.reduce((best, m) => {
            const vol = m.volumeNum ?? (m.volume ? parseFloat(m.volume) : 0);
            const bestVol = best.volumeNum ?? (best.volume ? parseFloat(best.volume) : 0);
            return vol > bestVol ? m : best;
          });

          markets.push({
            title: topMarket.question || event.title,
            yesPrice: parseMarketPrice(topMarket),
            volume: eventVolume,
            url: buildMarketUrl(event.slug, topMarket.slug),
            endDate: parseEndDate(topMarket.endDate ?? event.endDate),
            slug: topMarket.slug,
          });
        } else {
          markets.push({
            title: event.title,
            yesPrice: 50,
            volume: eventVolume,
            url: buildMarketUrl(event.slug),
            endDate: parseEndDate(event.endDate),
            slug: event.slug,
          });
        }
      }
    }

    if (markets.length < POOL_SIZE) {
      const fallbackMarkets = await fetchTopMarkets();
      for (const m of fallbackMarkets) {
        if (markets.length >= POOL_SIZE) break;
        if (!markets.some(existing => existing.slug === m.slug || existing.title === m.title)) {
          markets.push(m);
        }
      }
    }

    const result = markets
      .filter(m => !isExpired(m.endDate))
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, POOL_SIZE);

    if (result.length === 0) {
      throw new Error('No markets returned — upstream may be down');
    }

    return result;
  }, []);
}

async function buildPredictionMarketDetailFallback(
  slug: string,
  options?: { bookDepth?: number; tradeLimit?: number; refresh?: boolean; signal?: AbortSignal },
): Promise<GetPredictionMarketDetailResponse | null> {
  const marketRows = await polyFetch('markets', { slug });
  if (!marketRows.ok) return null;
  const data: PolymarketMarket[] = await marketRows.json();
  const market = data[0];
  if (!market) return null;

  const tokenIds = normalizeTokenIds(market.clobTokenIds);
  const tokenId = tokenIds[0] || '';
  const conditionId = market.conditionId || market.condition_id || '';
  const marketId = String(market.id || '');
  const bookDepth = Math.max(1, Math.min(25, options?.bookDepth ?? 10));
  const tradeLimit = Math.max(1, Math.min(100, options?.tradeLimit ?? 20));
  const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) as string[] : [];
  const yesPrice = prices[0] != null ? parseFloat(prices[0]) : 0.5;
  const noPrice = Math.max(0, Math.min(1, 1 - yesPrice));

  const [bookData, midpointData, bestAskData, bestBidData, spreadData, historyData, lastTradeData, tradesData, holdersData, commentsData] = await Promise.all([
    tokenId ? fetchJson<{ bids?: Array<{ price?: string | number; size?: string | number }>; asks?: Array<{ price?: string | number; size?: string | number }>; tick_size?: string; min_order_size?: string; hash?: string; timestamp?: string | number; }>(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`, options?.signal) : Promise.resolve(null),
    tokenId ? fetchJson<{ mid?: string | number }>(`https://clob.polymarket.com/midpoint?token_id=${encodeURIComponent(tokenId)}`, options?.signal) : Promise.resolve(null),
    tokenId ? fetchJson<{ price?: string | number }>(`https://clob.polymarket.com/price?token_id=${encodeURIComponent(tokenId)}&side=BUY`, options?.signal) : Promise.resolve(null),
    tokenId ? fetchJson<{ price?: string | number }>(`https://clob.polymarket.com/price?token_id=${encodeURIComponent(tokenId)}&side=SELL`, options?.signal) : Promise.resolve(null),
    tokenId ? fetchJson<{ spread?: string | number }>(`https://clob.polymarket.com/spread?token_id=${encodeURIComponent(tokenId)}`, options?.signal) : Promise.resolve(null),
    tokenId ? fetchBroadPriceHistory(tokenId, options?.signal) : Promise.resolve([]),
    tokenId ? fetchJson<{ price?: string | number; side?: string }>(`https://clob.polymarket.com/last-trade-price?token_id=${encodeURIComponent(tokenId)}`, options?.signal) : Promise.resolve(null),
    conditionId ? fetchJson<Array<{ side?: string; size?: number; price?: number; timestamp?: number }>>(`https://data-api.polymarket.com/trades?market=${encodeURIComponent(conditionId)}&limit=${tradeLimit}&offset=0&takerOnly=true`, options?.signal) : Promise.resolve(null),
    conditionId ? fetchJson<Array<{ holders?: Array<{ proxyWallet?: string; amount?: number; outcomeIndex?: number; name?: string; pseudonym?: string; profileImage?: string }> }>>(`https://data-api.polymarket.com/holders?market=${encodeURIComponent(conditionId)}&limit=10`, options?.signal) : Promise.resolve(null),
    marketId ? fetchJson<Array<{ body?: string; createdAt?: string; reactionCount?: number; userAddress?: string; profile?: { name?: string; pseudonym?: string; profileImage?: string } }>>(`${GAMMA_API}/comments?parent_entity_type=market&parent_entity_id=${encodeURIComponent(marketId)}&limit=10&order=createdAt&ascending=false`, options?.signal) : Promise.resolve(null),
  ]);

  return {
    market: {
      slug: market.slug || slug,
      title: market.question,
      url: buildMarketUrl(market.eventSlug || market.event_slug, market.slug) || `https://polymarket.com/market/${slug}`,
      category: market.tags?.[0]?.label || market.tags?.[0]?.slug || '',
      eventId: String(market.eventId || market.event_id || ''),
      eventSlug: market.eventSlug || market.event_slug || '',
      marketId,
      conditionId,
      tokenIds,
      closed: Boolean(market.closed),
      closesAt: market.endDate ? Date.parse(market.endDate) : 0,
      description: market.description || '',
      resolutionSource: market.resolution_source || '',
      volume: market.volumeNum ?? (market.volume ? parseFloat(market.volume) : 0),
      liquidity: parseNumber(market.liquidityNum ?? market.liquidity),
    },
    pricing: {
      yesPrice,
      noPrice,
      midpoint: parseNumber(midpointData?.mid, yesPrice),
      bestBid: parseNumber(bestBidData?.price),
      bestAsk: parseNumber(bestAskData?.price),
      spread: parseNumber(spreadData?.spread),
      lastTradePrice: parseNumber(lastTradeData?.price, yesPrice),
      lastTradeSide: lastTradeData?.side || '',
    },
    orderBook: {
      bids: (bookData?.bids || []).slice(0, bookDepth).map((row) => ({ price: parseNumber(row.price), size: parseNumber(row.size) })),
      asks: (bookData?.asks || []).slice(0, bookDepth).map((row) => ({ price: parseNumber(row.price), size: parseNumber(row.size) })),
      tickSize: bookData?.tick_size || '',
      minOrderSize: bookData?.min_order_size || '',
      hash: bookData?.hash || '',
      updatedAt: parseEpochMillis(bookData?.timestamp),
    },
    recentTrades: (tradesData || []).slice(0, tradeLimit).map((trade) => ({
      price: parseNumber(trade.price),
      size: parseNumber(trade.size),
      side: trade.side || '',
      timestamp: parseEpochMillis(trade.timestamp),
    })),
    history: historyData,
    holders: (holdersData || []).flatMap((envelope) => envelope.holders ?? []).map((holder) => ({
      address: holder.proxyWallet || '',
      label: holder.name || holder.pseudonym || `${holder.proxyWallet?.slice(0, 6) ?? ''}…${holder.proxyWallet?.slice(-4) ?? ''}`,
      profileImage: holder.profileImage || '',
      shares: parseNumber(holder.amount),
      value: parseNumber(holder.amount) * (holder.outcomeIndex === 0 ? yesPrice : noPrice),
      side: holder.outcomeIndex === 0 ? 'yes' : 'no',
    })),
    comments: (commentsData || []).filter((comment) => Boolean(comment.body)).map((comment) => ({
      author: comment.profile?.name || comment.profile?.pseudonym || 'Anonymous',
      text: comment.body || '',
      profileImage: comment.profile?.profileImage || '',
      userAddress: comment.userAddress || '',
      likes: comment.reactionCount || 0,
      createdAt: comment.createdAt ? Date.parse(comment.createdAt) : 0,
    })),
  };
}

export async function getPredictionMarketDetail(
  slug: string,
  options?: { bookDepth?: number; tradeLimit?: number; refresh?: boolean; signal?: AbortSignal },
): Promise<GetPredictionMarketDetailResponse | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  try {
    const response = await client.getPredictionMarketDetail({
      slug: trimmed,
      eventId: '',
      bookDepth: options?.bookDepth ?? 10,
      tradeLimit: options?.tradeLimit ?? 20,
      refresh: options?.refresh ?? false,
    }, { signal: options?.signal });
    if (response?.market) {
      const tokenId = response.market.tokenIds?.[0] || '';
      if (tokenId) {
        const history = await fetchBroadPriceHistory(tokenId, options?.signal);
        if (history.length > 0) {
          return { ...response, history };
        }
      }
      return response;
    }
  } catch (error) {
    console.warn(`[Polymarket] getPredictionMarketDetail(${trimmed}) failed:`, error);
  }
  return buildPredictionMarketDetailFallback(trimmed, options);
}

export async function fetchMarketDetails(slug: string): Promise<{ description?: string; resolutionSource?: string; liquidity?: number } | null> {
  try {
    const response = await polyFetch('markets', { slug });
    if (!response.ok) return null;
    const data: PolymarketMarket[] = await response.json();
    if (!data || data.length === 0) return null;
    const market = data[0] as unknown as { description?: string; resolution_source?: string; liquidityNum?: number };
    return {
      description: market.description,
      resolutionSource: market.resolution_source,
      liquidity: market.liquidityNum
    };
  } catch (e) {
    console.warn(`Failed to fetch details for market ${slug}:`, e);
    return null;
  }
}
