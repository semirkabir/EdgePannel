import type { MarketData, ClusteredEvent } from '@/types';
import type { GeoPredictionMarket, PredictionMarket } from '@/services/prediction';
import type { CyberThreat } from '@/types';
import type { IntelligenceCache } from '@/app/app-context';
import type { AppEventBus } from '../event-bus';

export interface IntelligenceStore {
  latestMarkets: MarketData[];
  latestPredictions: PredictionMarket[];
  latestPolymarketGeo: GeoPredictionMarket[];
  latestClusters: ClusteredEvent[];
  cyberThreatsCache: CyberThreat[] | null;
  cache: IntelligenceCache;
  setMarkets(data: MarketData[]): void;
  setPredictions(data: PredictionMarket[]): void;
  setPolymarketGeo(data: GeoPredictionMarket[]): void;
  setClusters(data: ClusteredEvent[]): void;
  setCyberThreats(data: CyberThreat[] | null): void;
  updateCache(partial: Partial<IntelligenceCache>): void;
  destroy(): void;
}

export function createIntelligenceStore(bus: AppEventBus): IntelligenceStore {
  let latestMarkets: MarketData[] = [];
  let latestPredictions: PredictionMarket[] = [];
  let latestPolymarketGeo: GeoPredictionMarket[] = [];
  let latestClusters: ClusteredEvent[] = [];
  let cyberThreatsCache: CyberThreat[] | null = null;
  let cache: IntelligenceCache = {};

  return {
    get latestMarkets() { return latestMarkets; },
    get latestPredictions() { return latestPredictions; },
    get latestPolymarketGeo() { return latestPolymarketGeo; },
    get latestClusters() { return latestClusters; },
    get cyberThreatsCache() { return cyberThreatsCache; },
    get cache() { return cache; },

    setMarkets(data: MarketData[]) {
      latestMarkets = data;
      bus.emit('intelligence:markets-updated', data);
    },

    setPredictions(data: PredictionMarket[]) {
      latestPredictions = data;
      bus.emit('intelligence:predictions-updated', data);
    },

    setPolymarketGeo(data: GeoPredictionMarket[]) {
      latestPolymarketGeo = data;
      bus.emit('intelligence:polymarket-geo-updated', data);
    },

    setClusters(data: ClusteredEvent[]) {
      latestClusters = data;
      bus.emit('intelligence:clusters-updated', data);
    },

    setCyberThreats(data: CyberThreat[] | null) {
      cyberThreatsCache = data;
      bus.emit('intelligence:cyber-updated', data);
    },

    updateCache(partial: Partial<IntelligenceCache>) {
      cache = { ...cache, ...partial };
      bus.emit('intelligence:cache-updated', cache);
    },

    destroy() {
      latestMarkets = [];
      latestPredictions = [];
      latestPolymarketGeo = [];
      latestClusters = [];
      cyberThreatsCache = null;
      cache = {};
    },
  };
}
