import { useState, useEffect } from 'react';
import { StockMover } from '@/types/exchange';

interface ExchangeMoversData {
  gainers: StockMover[];
  losers: StockMover[];
  mostActive: StockMover[];
  timestamp: string;
}

export function useExchangeMovers(exchangeId: string | null, enabled: boolean = true) {
  const [data, setData] = useState<ExchangeMoversData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exchangeId || !enabled) {
      setData(null);
      return;
    }

    const fetchMovers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/exchanges/movers?exchangeId=${exchangeId}&count=5`);

        if (!response.ok) {
          throw new Error('Failed to fetch movers');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('[useExchangeMovers] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovers();

    // Refresh every 5 minutes (Yahoo Finance data is delayed anyway)
    const interval = setInterval(fetchMovers, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [exchangeId, enabled]);

  return {
    gainers: data?.gainers || [],
    losers: data?.losers || [],
    mostActive: data?.mostActive || [],
    isLoading,
    error,
  };
}
