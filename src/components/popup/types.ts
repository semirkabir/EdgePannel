import type { TechHQ } from '@/config/tech-geo';
import type { SocialUnrestEvent, AIDataCenter } from '@/types';

export interface TechEventPopupData {
  id: string;
  title: string;
  location: string;
  lat: number;
  lng: number;
  country: string;
  startDate: string;
  endDate: string;
  url: string | null;
  daysUntil: number;
}

export interface TechHQClusterData {
  items: TechHQ[];
  city: string;
  country: string;
  count?: number;
  faangCount?: number;
  unicornCount?: number;
  publicCount?: number;
  sampled?: boolean;
}

export interface TechEventClusterData {
  items: TechEventPopupData[];
  location: string;
  country: string;
  count?: number;
  soonCount?: number;
  sampled?: boolean;
}

export interface GpsJammingPopupData {
  h3: string;
  lat: number;
  lon: number;
  level: 'medium' | 'high';
  pct: number;
  good: number;
  bad: number;
  total: number;
}

export interface IranEventPopupData {
  id: string;
  title: string;
  category: string;
  sourceUrl: string;
  latitude: number;
  longitude: number;
  locationName: string;
  timestamp: string | number;
  severity: string;
  relatedEvents?: IranEventPopupData[];
}

export interface StockExchangePopupData {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  tier: string;
  marketCap?: number;
  tradingHours?: string;
  timezone?: string;
  description?: string;
  // Runtime enrichment (populated at click time by DeckGLMap)
  enrichCii?: { score: number; level: string } | null;
}

export interface FinancialCenterPopupData {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;
  gfciRank?: number;
  specialties?: string[];
  description?: string;
  // Runtime enrichment
  _enrichCii?: { score: number; level: string } | null;
}

export interface CentralBankPopupData {
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  type: string;
  currency?: string;
  description?: string;
  // Runtime enrichment (populated at click time by DeckGLMap)
  enrichCii?: { score: number; level: string } | null;
  enrichSanctioned?: 'severe' | 'high' | 'moderate' | null;
}

export interface CommodityHubPopupData {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;
  commodities?: string[];
  description?: string;
  // Runtime enrichment (populated at click time by DeckGLMap)
  enrichWtiPrice?: number | null;
  enrichBrentPrice?: number | null;
}

export interface ProtestClusterData {
  items: SocialUnrestEvent[];
  country: string;
  count?: number;
  riotCount?: number;
  highSeverityCount?: number;
  verifiedCount?: number;
  totalFatalities?: number;
  sampled?: boolean;
}

export interface DatacenterClusterData {
  items: AIDataCenter[];
  region: string;
  country: string;
  count?: number;
  totalChips?: number;
  totalPowerMW?: number;
  existingCount?: number;
  plannedCount?: number;
  sampled?: boolean;
}
