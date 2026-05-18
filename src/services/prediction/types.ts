import type { GetPredictionMarketDetailResponse } from '@/generated/client/worldmonitor/prediction/v1/service_client';

export interface PredictionMarket {
  title: string;
  yesPrice: number;
  volume?: number;
  liquidity?: number;
  conditionId?: string;
  tokenIds?: string[];
  url?: string;
  endDate?: string;
  slug?: string;
  eventId?: string;
  eventSlug?: string;
  marketCount?: number;
  markets?: PredictionMarket[];
  confidence?: 'high' | 'medium' | 'low';
  extractedFrom?: 'sports' | 'country' | 'city' | 'state' | 'pattern' | 'context' | 'event-inherited';
  region?: string;
  city?: string;
}

export interface GeoPredictionMarket extends PredictionMarket {
  country: string;
  lat: number;
  lon: number;
}

export interface PolymarketMarket {
  question: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string;
  volumeNum?: number;
  closed?: boolean;
  slug?: string;
  endDate?: string;
  description?: string;
  resolution_source?: string;
  liquidity?: number | string;
  liquidityNum?: number;
  volume24hr?: number;
  volume24hrClob?: number;
  oneDayPriceChange?: number | null;
  oneHourPriceChange?: number | null;
  oneWeekPriceChange?: number | null;
  lastTradePrice?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  eventSlug?: string;
  event_slug?: string;
  eventId?: string | number;
  event_id?: string | number;
  conditionId?: string;
  condition_id?: string;
  clobTokenIds?: string[] | string;
  clob_token_ids?: string[] | string;
  id?: string | number;
  tags?: Array<{ label?: string; slug?: string }>;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  volume?: number;
  volume24hr?: number;
  liquidity?: number;
  markets?: PolymarketMarket[];
  tags?: Array<{ slug: string }>;
  closed?: boolean;
  endDate?: string;
}

export interface BootstrapPredictionData {
  geopolitical: PredictionMarket[];
  tech: PredictionMarket[];
  fetchedAt: number;
}

export type PredictionMarketDetailResponse = GetPredictionMarketDetailResponse;
