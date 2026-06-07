import { getRpcBaseUrl } from '@/services/rpc-client';
import {
  ConsumerPricesServiceClient,
  type GetConsumerPriceOverviewResponse,
  type GetConsumerPriceBasketSeriesResponse,
  type ListConsumerPriceCategoriesResponse,
  type ListConsumerPriceMoversResponse,
  type ListRetailerPriceSpreadsResponse,
  type GetConsumerPriceFreshnessResponse,
  type CategorySnapshot,
  type PriceMover,
  type RetailerSpread,
  type BasketPoint,
  type RetailerFreshnessInfo,
} from '@/generated/client/worldmonitor/consumer_prices/v1/service_client';
import { createCircuitBreaker } from '@/utils';
import { getHydratedData } from '@/services/bootstrap';

export type {
  GetConsumerPriceOverviewResponse,
  GetConsumerPriceBasketSeriesResponse,
  ListConsumerPriceCategoriesResponse,
  ListConsumerPriceMoversResponse,
  ListRetailerPriceSpreadsResponse,
  GetConsumerPriceFreshnessResponse,
  CategorySnapshot,
  PriceMover,
  RetailerSpread,
  BasketPoint,
  RetailerFreshnessInfo,
};

export const DEFAULT_MARKET = 'ae';
export const DEFAULT_BASKET = 'essentials-ae';
const DEFAULT_RANGE = '30d';

export interface ConsumerPriceMarketOption {
  code: string;
  label: string;
  currencyCode: string;
}

export interface ConsumerPriceBasketOption {
  slug: string;
  label: string;
}

export const CONSUMER_PRICE_MARKETS: ConsumerPriceMarketOption[] = [
  { code: 'ae', label: 'United Arab Emirates', currencyCode: 'AED' },
  { code: 'sa', label: 'Saudi Arabia', currencyCode: 'SAR' },
  { code: 'qa', label: 'Qatar', currencyCode: 'QAR' },
  { code: 'kw', label: 'Kuwait', currencyCode: 'KWD' },
  { code: 'bh', label: 'Bahrain', currencyCode: 'BHD' },
  { code: 'om', label: 'Oman', currencyCode: 'OMR' },
];

const BASKET_TYPES: Array<{ prefix: string; label: string }> = [
  { prefix: 'essentials', label: 'Essentials' },
  { prefix: 'value', label: 'Value' },
];

export function getConsumerPriceBasketOptions(marketCode = DEFAULT_MARKET): ConsumerPriceBasketOption[] {
  const market = normalizeConsumerPriceMarket(marketCode);
  return BASKET_TYPES.map(({ prefix, label }) => ({
    slug: `${prefix}-${market}`,
    label,
  }));
}

export function normalizeConsumerPriceMarket(marketCode: string | null | undefined): string {
  const normalized = String(marketCode ?? '').trim().toLowerCase();
  return CONSUMER_PRICE_MARKETS.some((market) => market.code === normalized)
    ? normalized
    : DEFAULT_MARKET;
}

export function normalizeConsumerPriceBasket(
  basketSlug: string | null | undefined,
  marketCode = DEFAULT_MARKET,
): string {
  const baskets = getConsumerPriceBasketOptions(marketCode);
  const normalized = String(basketSlug ?? '').trim().toLowerCase();
  return baskets.some((basket) => basket.slug === normalized)
    ? normalized
    : baskets[0]?.slug ?? DEFAULT_BASKET;
}

const client = new ConsumerPricesServiceClient(getRpcBaseUrl(), {
  fetch: (...args) => globalThis.fetch(...args),
});

const overviewBreaker = createCircuitBreaker<GetConsumerPriceOverviewResponse>({
  name: 'Consumer Prices Overview',
  cacheTtlMs: 30 * 60 * 1000,
  persistCache: true,
});
const seriesBreaker = createCircuitBreaker<GetConsumerPriceBasketSeriesResponse>({
  name: 'Consumer Prices Series',
  cacheTtlMs: 60 * 60 * 1000,
  persistCache: true,
});
const categoriesBreaker = createCircuitBreaker<ListConsumerPriceCategoriesResponse>({
  name: 'Consumer Prices Categories',
  cacheTtlMs: 30 * 60 * 1000,
  persistCache: true,
});
const moversBreaker = createCircuitBreaker<ListConsumerPriceMoversResponse>({
  name: 'Consumer Prices Movers',
  cacheTtlMs: 30 * 60 * 1000,
  persistCache: true,
});
const spreadBreaker = createCircuitBreaker<ListRetailerPriceSpreadsResponse>({
  name: 'Consumer Prices Spread',
  cacheTtlMs: 30 * 60 * 1000,
  persistCache: true,
});
const freshnessBreaker = createCircuitBreaker<GetConsumerPriceFreshnessResponse>({
  name: 'Consumer Prices Freshness',
  cacheTtlMs: 10 * 60 * 1000,
  persistCache: true,
});

function currencyForMarket(marketCode: string): string {
  return CONSUMER_PRICE_MARKETS.find((market) => market.code === marketCode)?.currencyCode ?? 'AED';
}

function isDefaultSelection(marketCode: string, basketSlug?: string, range?: string): boolean {
  if (marketCode !== DEFAULT_MARKET) return false;
  if (basketSlug !== undefined && basketSlug !== DEFAULT_BASKET) return false;
  if (range !== undefined && range !== DEFAULT_RANGE) return false;
  return true;
}

function emptyOverview(marketCode: string): GetConsumerPriceOverviewResponse {
  return {
    marketCode,
    asOf: '0',
    currencyCode: currencyForMarket(marketCode),
    essentialsIndex: 0,
    valueBasketIndex: 0,
    wowPct: 0,
    momPct: 0,
    retailerSpreadPct: 0,
    coveragePct: 0,
    freshnessLagMin: 0,
    topCategories: [],
    upstreamUnavailable: true,
  };
}

function emptySeries(
  marketCode: string,
  basketSlug: string,
  range: string,
): GetConsumerPriceBasketSeriesResponse {
  return {
    marketCode,
    basketSlug,
    asOf: '0',
    currencyCode: currencyForMarket(marketCode),
    range,
    essentialsSeries: [],
    valueSeries: [],
    upstreamUnavailable: true,
  };
}

function emptyCategories(marketCode: string, range: string): ListConsumerPriceCategoriesResponse {
  return {
    marketCode,
    asOf: '0',
    range,
    categories: [],
    upstreamUnavailable: true,
  };
}

function emptyMovers(marketCode: string, range: string): ListConsumerPriceMoversResponse {
  return {
    marketCode,
    asOf: '0',
    range,
    risers: [],
    fallers: [],
    upstreamUnavailable: true,
  };
}

function emptySpread(marketCode: string, basketSlug: string): ListRetailerPriceSpreadsResponse {
  return {
    marketCode,
    asOf: '0',
    basketSlug,
    currencyCode: currencyForMarket(marketCode),
    retailers: [],
    spreadPct: 0,
    upstreamUnavailable: true,
  };
}

function emptyFreshness(marketCode: string): GetConsumerPriceFreshnessResponse {
  return {
    marketCode,
    asOf: '0',
    retailers: [],
    overallFreshnessMin: 0,
    stalledCount: 0,
    upstreamUnavailable: true,
  };
}

export async function fetchConsumerPriceOverview(
  marketCode = DEFAULT_MARKET,
  basketSlug = DEFAULT_BASKET,
): Promise<GetConsumerPriceOverviewResponse> {
  const market = normalizeConsumerPriceMarket(marketCode);
  const basket = normalizeConsumerPriceBasket(basketSlug, market);
  if (isDefaultSelection(market, basket)) {
    const hydrated = getHydratedData('consumerPricesOverview') as GetConsumerPriceOverviewResponse | undefined;
    if (hydrated?.asOf) return hydrated;
  }

  try {
    return await overviewBreaker.execute(
      () => client.getConsumerPriceOverview({ marketCode: market, basketSlug: basket }),
      emptyOverview(market),
      { cacheKey: `${market}:${basket}` },
    );
  } catch {
    return emptyOverview(market);
  }
}

export async function fetchConsumerPriceBasketSeries(
  marketCode = DEFAULT_MARKET,
  basketSlug = DEFAULT_BASKET,
  range = DEFAULT_RANGE,
): Promise<GetConsumerPriceBasketSeriesResponse> {
  const market = normalizeConsumerPriceMarket(marketCode);
  const basket = normalizeConsumerPriceBasket(basketSlug, market);
  try {
    return await seriesBreaker.execute(
      () => client.getConsumerPriceBasketSeries({ marketCode: market, basketSlug: basket, range }),
      emptySeries(market, basket, range),
      { cacheKey: `${market}:${basket}:${range}` },
    );
  } catch {
    return emptySeries(market, basket, range);
  }
}

export async function fetchConsumerPriceCategories(
  marketCode = DEFAULT_MARKET,
  basketSlug = DEFAULT_BASKET,
  range = DEFAULT_RANGE,
): Promise<ListConsumerPriceCategoriesResponse> {
  const market = normalizeConsumerPriceMarket(marketCode);
  const basket = normalizeConsumerPriceBasket(basketSlug, market);
  if (isDefaultSelection(market, basket, range)) {
    const hydrated = getHydratedData('consumerPricesCategories') as ListConsumerPriceCategoriesResponse | undefined;
    if (hydrated?.categories?.length) return hydrated;
  }

  try {
    return await categoriesBreaker.execute(
      () => client.listConsumerPriceCategories({ marketCode: market, basketSlug: basket, range }),
      emptyCategories(market, range),
      { cacheKey: `${market}:${basket}:${range}` },
    );
  } catch {
    return emptyCategories(market, range);
  }
}

export async function fetchConsumerPriceMovers(
  marketCode = DEFAULT_MARKET,
  range = DEFAULT_RANGE,
  categorySlug?: string,
): Promise<ListConsumerPriceMoversResponse> {
  const market = normalizeConsumerPriceMarket(marketCode);
  if (isDefaultSelection(market, undefined, range) && !categorySlug) {
    const hydrated = getHydratedData('consumerPricesMovers') as ListConsumerPriceMoversResponse | undefined;
    if (hydrated?.risers?.length || hydrated?.fallers?.length) return hydrated;
  }

  try {
    return await moversBreaker.execute(
      () => client.listConsumerPriceMovers({ marketCode: market, range, categorySlug: categorySlug ?? '', limit: 10 }),
      emptyMovers(market, range),
      { cacheKey: `${market}:${range}:${categorySlug ?? 'all'}` },
    );
  } catch {
    return emptyMovers(market, range);
  }
}

export async function fetchRetailerPriceSpreads(
  marketCode = DEFAULT_MARKET,
  basketSlug = DEFAULT_BASKET,
): Promise<ListRetailerPriceSpreadsResponse> {
  const market = normalizeConsumerPriceMarket(marketCode);
  const basket = normalizeConsumerPriceBasket(basketSlug, market);
  if (isDefaultSelection(market, basket)) {
    const hydrated = getHydratedData('consumerPricesSpread') as ListRetailerPriceSpreadsResponse | undefined;
    if (hydrated?.retailers?.length) return hydrated;
  }

  try {
    return await spreadBreaker.execute(
      () => client.listRetailerPriceSpreads({ marketCode: market, basketSlug: basket }),
      emptySpread(market, basket),
      { cacheKey: `${market}:${basket}` },
    );
  } catch {
    return emptySpread(market, basket);
  }
}

export async function fetchConsumerPriceFreshness(
  marketCode = DEFAULT_MARKET,
): Promise<GetConsumerPriceFreshnessResponse> {
  const market = normalizeConsumerPriceMarket(marketCode);
  try {
    return await freshnessBreaker.execute(
      () => client.getConsumerPriceFreshness({ marketCode: market }),
      emptyFreshness(market),
      { cacheKey: market },
    );
  } catch {
    return emptyFreshness(market);
  }
}
