'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, BarChart3, Users, Shield, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { DashboardStatCard } from './DashboardStatCard'
import { MarketTicker } from './MarketTicker'
import { TrendingMarketsTable } from './TrendingMarketsTable'
import { ActivityFeed } from './ActivityFeed'
import { PolymarketWebSocketClient } from '@/lib/ws/polymarket-websocket'

interface InsightsDashboardProps {
  onMarketSelect?: (market: any) => void
}

interface Trade {
  id: string
  marketTitle: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  timestamp: number
  size: number
}

export function InsightsDashboard({ onMarketSelect }: InsightsDashboardProps) {
  // Stats state
  const [stats, setStats] = useState({
    volume24h: 0,
    activeTraders: 0,
    peakHour: '-- UTC',
    closingToday: 0,
    avgVolume7d: 0,
    avgTraders7d: 0,
    totalLiquidity: 0,
    marketCount: 0,
  });

  const [trendingMarkets, setTrendingMarkets] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastTradeTime, setLastTradeTime] = useState<Date | null>(null);

  // Trade tracking - only count NEW trades
  const seenTradeIdsRef = useRef<Set<string>>(new Set());
  const newTradeTimestampsRef = useRef<number[]>([]); // Only timestamps of truly new trades
  const [tps, setTps] = useState(0);
  const [tpm, setTpm] = useState(0);
  const [peakTps, setPeakTps] = useState(0);

  // WebSocket ref
  const wsClientRef = useRef<PolymarketWebSocketClient | null>(null);

  // Calculate TPS/TPM from ONLY new trades we've seen
  const updateTradeRates = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const tenSecondsAgo = now - 10000;

    // Filter to only trades in the last minute
    const recentTrades = newTradeTimestampsRef.current.filter(t => t > oneMinuteAgo);
    newTradeTimestampsRef.current = recentTrades;

    // Calculate rates
    const tradesLast10Seconds = recentTrades.filter(t => t > tenSecondsAgo).length;
    const currentTps = tradesLast10Seconds / 10;
    const currentTpm = recentTrades.length;

    setTps(parseFloat(currentTps.toFixed(1)));
    setTpm(currentTpm);
    setPeakTps(prev => Math.max(prev, currentTps));
  }, []);

  // Fetch live trades - only process NEW ones
  const fetchLiveTrades = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/live-trades?limit=50');

      if (!response.ok) {
        setIsConnected(false);
        return;
      }

      const data = await response.json();
      const trades: Trade[] = data.trades || [];

      if (trades.length > 0) {
        setIsConnected(true);

        const now = Date.now();
        let hasNewTrades = false;
        const newActivityItems: any[] = [];

        // Process each trade - only if we haven't seen it before
        for (const trade of trades) {
          if (!seenTradeIdsRef.current.has(trade.id)) {
            seenTradeIdsRef.current.add(trade.id);
            hasNewTrades = true;

            // Record timestamp for TPS calculation
            const tradeTime = trade.timestamp * 1000;
            if (tradeTime > now - 60000) {
              newTradeTimestampsRef.current.push(now); // Use current time for new trades
            }

            // Add to activity
            newActivityItems.push({
              id: trade.id,
              type: 'trade' as const,
              marketName: trade.marketTitle,
              side: trade.side as 'buy' | 'sell',
              amount: trade.amount,
              price: trade.price,
              size: trade.size,
              timestamp: new Date(trade.timestamp * 1000),
            });
          }
        }

        if (hasNewTrades) {
          setLastTradeTime(new Date());

          // Add new trades to the top
          setActivityFeed(prev => {
            const merged = [...newActivityItems, ...prev].slice(0, 100);
            return merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          });

          updateTradeRates();
        }

        // Cleanup old seen IDs (keep last 1000)
        if (seenTradeIdsRef.current.size > 1000) {
          const arr = Array.from(seenTradeIdsRef.current);
          seenTradeIdsRef.current = new Set(arr.slice(-500));
        }
      }
    } catch (error) {
      console.error('Error fetching live trades:', error);
      setIsConnected(false);
    }
  }, [updateTradeRates]);

  // Fetch market stats
  const fetchMarketStats = useCallback(async () => {
    try {
      const response = await fetch('/api/insights/market-stats');

      if (!response.ok) return;

      const data = await response.json();

      if (data.stats) {
        setStats({
          volume24h: data.stats.volume24h || 0,
          activeTraders: data.stats.activeTraders || 0,
          peakHour: data.stats.peakHour || '-- UTC',
          closingToday: data.stats.closingToday || 0,
          avgVolume7d: data.stats.avgVolume7d || 0,
          avgTraders7d: data.stats.avgTraders7d || 0,
          totalLiquidity: data.stats.totalLiquidity || 0,
          marketCount: data.stats.marketCount || 0,
        });
      }

      if (data.trendingMarkets) {
        setTrendingMarkets(data.trendingMarkets);
      }
    } catch (error) {
      console.error('Error fetching market stats:', error);
    }
  }, []);

  // Initial fetch
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchMarketStats(), fetchLiveTrades()]);
    setIsLoading(false);
  }, [fetchMarketStats, fetchLiveTrades]);

  // Setup WebSocket for price updates
  useEffect(() => {
    const client = new PolymarketWebSocketClient();
    wsClientRef.current = client;

    client.connect().then(() => {
      client.onMessage((msg) => {
        // Update market prices in real-time
        if (msg.price !== undefined) {
          const conditionId = msg.asset_id || msg.market;
          if (conditionId) {
            setTrendingMarkets(prev => prev.map(m =>
              m.id === conditionId ? { ...m, price: msg.price } : m
            ));
          }
        }
      });
    }).catch(err => {
      console.error('[Dashboard] WS Connection failed:', err);
    });

    return () => {
      client.disconnect();
    };
  }, []);

  // Subscribe to market price updates when markets change
  useEffect(() => {
    if (wsClientRef.current?.isConnected() && trendingMarkets.length > 0) {
      trendingMarkets.slice(0, 20).forEach(m => {
        if (m.id) wsClientRef.current?.subscribe(m.id);
      });
    }
  }, [trendingMarkets]);

  // Setup polling
  useEffect(() => {
    fetchAllData();

    // Poll trades every 2 seconds
    const tradeInterval = setInterval(fetchLiveTrades, 2000);

    // Poll market stats every 30 seconds
    const statsInterval = setInterval(fetchMarketStats, 30000);

    // Update rate display every second
    const ratesInterval = setInterval(updateTradeRates, 1000);

    return () => {
      clearInterval(tradeInterval);
      clearInterval(statsInterval);
      clearInterval(ratesInterval);
    };
  }, [fetchAllData, fetchLiveTrades, fetchMarketStats, updateTradeRates]);

  const estimatedTradeCount = Math.floor(stats.volume24h / 150);

  if (isLoading && trendingMarkets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0b0d]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Connecting to Polymarket...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0a0b0d] overflow-hidden flex flex-col p-4 pt-20">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={cn(
          "w-2 h-2 rounded-full shadow-lg",
          isConnected ? "bg-green-500 animate-pulse shadow-green-500/50" : "bg-red-500 shadow-red-500/50"
        )} />
        <h1 className="text-xl font-black text-white uppercase tracking-widest font-mono">
          Market Overview
          <span className={cn(
            "ml-3 text-xs px-1.5 py-0.5 rounded font-bold border",
            isConnected ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
          )}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {lastTradeTime && (
            <span className="text-[10px] text-gray-500 font-mono">
              Last trade: {lastTradeTime.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#0e0f11] border border-white/10 rounded flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
          </button>
          <div className="px-3 py-1.5 bg-[#0e0f11] border border-white/10 rounded flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            Polymarket
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <DashboardStatCard
          title="24h Volume"
          value={stats.volume24h > 0 ? `$${(stats.volume24h / 1000000).toFixed(2)}M` : '---'}
          subValue={stats.volume24h > 0 ? `~${estimatedTradeCount.toLocaleString()} trades` : 'Loading...'}
          icon={<BarChart3 className="w-4 h-4" />}
          chartData={[10, 25, 15, 30, 45, 20, 55, 40, 60, 50, 70, 65, 80]}
          loading={isLoading && stats.volume24h === 0}
        />

        <DashboardStatCard
          title="Active Traders"
          value={stats.activeTraders > 0 ? stats.activeTraders.toLocaleString() : '---'}
          subValue={stats.volume24h > 0 && stats.activeTraders > 0
            ? `Avg: $${Math.floor(stats.volume24h / stats.activeTraders).toLocaleString()}`
            : 'Loading...'}
          subValueColor="text-blue-400"
          icon={<Users className="w-4 h-4" />}
          chartData={[20, 30, 25, 40, 35, 50, 45, 60, 55, 70]}
          loading={isLoading && stats.activeTraders === 0}
        />

        <DashboardStatCard
          title="Peak Hours"
          value={stats.peakHour}
          subValue={stats.volume24h > 0 ? `~$${((stats.volume24h / 24) / 1000000).toFixed(2)}M/hr` : 'Loading...'}
          subValueColor="text-purple-400"
          icon={<Clock className="w-4 h-4" />}
          chartData={[5, 10, 8, 15, 20, 12, 25, 18, 10, 5, 8, 12, 10, 15, 20, 30, 25, 15, 10, 5]}
          loading={isLoading}
        />
      </div>

      {/* Secondary Stats + Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 h-28">
        <div className="col-span-1 lg:col-span-2 grid grid-cols-3 gap-4">
          <DashboardStatCard
            title="Closing Today"
            value={stats.closingToday.toString()}
            subValue="markets"
            icon={<Clock className="w-3 h-3" />}
            loading={isLoading}
            className="h-full"
          />
          <DashboardStatCard
            title="7d Avg Volume"
            value={stats.avgVolume7d > 0 ? `$${(stats.avgVolume7d / 1000000).toFixed(1)}M` : '---'}
            subValue={stats.avgVolume7d > 0 ? 'per day' : 'Loading...'}
            loading={isLoading}
            className="h-full"
          />
          <DashboardStatCard
            title="7d Avg Traders"
            value={stats.avgTraders7d > 0 ? Math.floor(stats.avgTraders7d).toLocaleString() : '---'}
            subValue={stats.avgTraders7d > 0 ? 'per day' : 'Loading...'}
            loading={isLoading}
            className="h-full"
          />
        </div>

        <div className="col-span-1 lg:col-span-2 h-full">
          <div className="h-full border border-white/5 bg-[#0e0f11] rounded-xl p-4 flex items-center">
            <MarketTicker tps={tps} tpm={tpm} peakTps={peakTps} />
          </div>
        </div>
      </div>

      {/* Bottom: Table + Activity */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col min-h-0 border border-white/5 rounded-xl bg-[#0a0b0d] overflow-hidden">
          <TrendingMarketsTable
            markets={trendingMarkets}
            onMarketSelect={onMarketSelect || (() => { })}
          />
        </div>

        <div className="lg:col-span-1 flex flex-col min-h-0 border border-white/5 rounded-xl bg-[#0e0f11] overflow-hidden">
          <ActivityFeed items={activityFeed} />
        </div>
      </div>
    </div>
  );
}
