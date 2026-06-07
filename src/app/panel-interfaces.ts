import type { MarketData } from '@/types';
import type { PredictionMarket } from '@/services/prediction';
import type { Monitor } from '@/types';
import type { TheaterPostureSummary } from '@/services/military-surge';
import type { GetShippingRatesResponse, GetChokepointStatusResponse } from '@/services/supply-chain';
import type { SolarWeatherSnapshot } from '@/services/solar-weather';

export interface CIIRefreshable {
  refresh(forceLocal?: boolean): void;
  renderScores(scores: Record<string, number>): void;
  renderFromCached(cached: unknown): void;
}

export interface MarketRenderable {
  renderMarkets(data: MarketData[], rateLimited?: boolean): void;
}

export interface HeatmapRenderable {
  renderHeatmap(data: unknown[], rateLimited?: boolean): void;
}

export interface CommoditiesRenderable {
  renderCommodities(data: unknown[]): void;
  showRetrying(): void;
}

export interface CryptoRenderable {
  renderCrypto(data: unknown): void;
  showRetrying(): void;
}

export interface PredictionRenderable {
  renderPredictions(data: PredictionMarket[]): void;
}

export interface InsightsRenderable {
  refresh(): void;
}

export interface StrategicPostureRenderable {
  getPostures(): TheaterPostureSummary[];
}

export interface EconomicPanelRenderable {
  renderFredData(data: unknown): void;
  renderEIAData(data: unknown): void;
  renderWorldBankData(data: unknown): void;
  refresh(): void;
}

export interface TradePolicyRenderable {
  renderTradeRestrictions(data: unknown): void;
  renderTariffTrends(data: unknown): void;
  renderTradeFlows(data: unknown): void;
}

export interface SupplyChainRenderable {
  renderShippingRates(data: GetShippingRatesResponse): void;
  renderChokepointStatus(data: GetChokepointStatusResponse): void;
}

export interface SanctionsRenderable {
  renderSanctions(data: unknown[]): void;
}

export interface SolarWeatherRenderable {
  setData?(data: SolarWeatherSnapshot): void;
}

export interface MonitorRenderable {
  renderMonitors(monitors: Monitor[]): void;
}

export interface SatelliteFiresRenderable {
  update(stats: unknown[], totalCount: number): void;
}

export interface TechReadinessRenderable {
  refresh(): void;
}

export interface UCDPEventsRenderable {
  setEvents(events: unknown[]): void;
  getEvents?(): unknown[];
}

export interface PanelRegistry {
  getPanel<T>(key: string): T | undefined;
  hasPanel(key: string): boolean;
}

export function createPanelRegistry(panels: Record<string, unknown>): PanelRegistry {
  return {
    getPanel<T>(key: string): T | undefined {
      return panels[key] as T | undefined;
    },
    hasPanel(key: string): boolean {
      return key in panels;
    },
  };
}

export function callPanelMethod(panels: Record<string, unknown>, key: string, method: string, ...args: unknown[]): void {
  const panel = panels[key] as Record<string, unknown> | undefined;
  const candidate = panel?.[method];
  if (typeof candidate === 'function') {
    (candidate as (...methodArgs: unknown[]) => unknown)(...args);
  }
}
