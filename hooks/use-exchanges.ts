import { useMemo } from 'react';
import { getAllExchanges } from '@/lib/data/exchanges';
import { exchangesToGeoJSON, getDetailedMarketStatus } from '@/lib/utils/exchange-geojson';
import { StockExchange, ExchangeMarketData } from '@/types/exchange';

export function useExchanges() {
  const exchanges = useMemo(() => getAllExchanges(), []);

  // Create mock market data with open/closed status
  const marketDataMap = useMemo(() => {
    const map = new Map<string, ExchangeMarketData>();

    exchanges.forEach(exchange => {
      const detailedStatus = getDetailedMarketStatus(exchange);

      map.set(exchange.id, {
        exchangeId: exchange.id,
        isOpen: detailedStatus.isOpen,
        detailedStatus,
        totalVolume: 0,
        totalMarketCap: exchange.marketCap || 0,
        advancingStocks: 0,
        decliningStocks: 0,
        unchangedStocks: 0,
        topGainers: [],
        topLosers: [],
        volumeLeaders: [],
        indices: [],
        sectorBreakdown: [],
        lastUpdated: new Date(),
      });
    });

    return map;
  }, [exchanges]);

  const geoJSON = useMemo(() => {
    return exchangesToGeoJSON(exchanges, marketDataMap);
  }, [exchanges, marketDataMap]);

  return {
    exchanges,
    geoJSON,
    isLoading: false,
  };
}
