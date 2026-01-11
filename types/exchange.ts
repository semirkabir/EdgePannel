export type ExchangeRegion = 'americas' | 'europe' | 'asia_pacific' | 'middle_east_africa';

export interface TradingHours {
  open: string;              // "09:30" in local time
  close: string;             // "16:00" in local time
  preMarketOpen?: string;    // "04:00"
  afterHoursClose?: string;  // "20:00"
  tradingDays: number[];     // 1-5 (Mon-Fri typically)
  holidays?: string[];       // ISO date strings
}

export interface StockExchange {
  id: string;
  name: string;
  shortName: string;         // e.g., "NYSE", "LSE"
  country: string;
  city: string;
  region: ExchangeRegion;
  timezone: string;          // IANA timezone
  tradingHours: TradingHours;
  coordinates: { lat: number; lng: number };
  logo?: string;             // URL to exchange logo
  website: string;
  marketCap?: number;        // Total market cap in USD
  currency: string;          // Primary trading currency
  indices: string[];         // e.g., ["S&P 500", "Dow Jones"]
}

export interface StockMover {
  ticker: string;
  name: string;
  price: number;
  change: number;            // Absolute change
  changePercent: number;     // Percentage change
  volume: number;
  marketCap?: number;
  sector?: string;
  sparklineData?: number[];  // Last N price points
}

export interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

export interface SectorData {
  name: string;
  changePercent: number;
  volume: number;
  marketCap: number;
}

export interface ExchangeMarketData {
  exchangeId: string;
  isOpen: boolean;
  nextOpenTime?: Date;
  nextCloseTime?: Date;
  detailedStatus?: import('@/lib/utils/exchange-geojson').DetailedMarketStatus;
  totalVolume: number;       // Daily volume in USD
  totalMarketCap: number;
  advancingStocks: number;
  decliningStocks: number;
  unchangedStocks: number;
  topGainers: StockMover[];
  topLosers: StockMover[];
  volumeLeaders: StockMover[];
  indices: IndexData[];
  sectorBreakdown: SectorData[];
  lastUpdated: Date;
}

export interface ExchangeHoverData {
  exchange: StockExchange;
  marketData: ExchangeMarketData;
  activeTab: 'gainers' | 'losers' | 'volume';
}

export type MarketType = 'prediction' | 'financial';
