'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Clock, Filter, RefreshCw, Zap, Target, Eye, Flame } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { EnrichedMarket } from '@/lib/markets/enrich'
import { NewsFeed } from './NewsFeed'

interface InsightsDashboardProps {
  onMarketSelect?: (market: any) => void
}

interface MarketAnalytics {
  timeframe: string
  summary: {
    totalMarkets: number
    gainers: number
    losers: number
    unchanged: number
    averageChange: string
    totalVolume: number
  }
  topGainers: MarketWithChange[]
  topLosers: MarketWithChange[]
  biggestMovers: MarketWithChange[]
  highestVolume: MarketWithChange[]
}

interface MarketWithChange {
  id: string
  title: string
  slug: string | null
  ticker: string | null
  platform: string
  category: string | null
  currentPrice: number
  startPrice: number
  priceChange: number
  priceChangePercent: number
  volume24h: number
  liquidity: number | null
  endDate: Date | null
}

interface WhaleActivity {
  timeframe: string
  minAmount: number
  summary: {
    totalTrades: number
    totalAmount: number
    averageAmount: number
    buyCount: number
    sellCount: number
    polymarketCount: number
    kalshiCount: number
    uniqueMarkets: number
    uniqueWallets?: number
  }
  trades: WhaleTrade[]
  note?: string
}

interface WhaleTrade {
  id: string
  marketId: string
  marketTitle: string
  marketSlug: string | null
  marketTicker: string | null
  platform: string
  category: string | null
  amount: number
  side: 'buy' | 'sell'
  outcome: string | null
  price: number
  timestamp: Date
  walletAddress: string | null
  transactionHash: string | null
  size?: number
  traderName?: string | null
  traderProfileImage?: string | null
}

type TimeframeOption = '1h' | '24h' | '7d' | '30d'
type CategoryFilter = 'all' | 'topGainers' | 'topLosers' | 'biggestMovers' | 'whaleActivity'

export function InsightsDashboard({ onMarketSelect }: InsightsDashboardProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('24h')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const [analytics, setAnalytics] = useState<MarketAnalytics | null>(null)
  const [whaleActivity, setWhaleActivity] = useState<WhaleActivity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [platform, setPlatform] = useState<'all' | 'polymarket' | 'kalshi'>('all')
  const [whaleThreshold, setWhaleThreshold] = useState(5000)
  const [showFilters, setShowFilters] = useState(false)

  // Fetch analytics data
  const fetchAnalytics = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [analyticsRes, whaleRes] = await Promise.all([
        fetch(`/api/markets/analytics?timeframe=${timeframe}&platform=${platform}&limit=15`),
        fetch(`/api/whale-activity?timeframe=${timeframe}&platform=${platform}&minAmount=${whaleThreshold}&limit=20`),
      ])

      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data)
      }

      if (whaleRes.ok) {
        const data = await whaleRes.json()
        setWhaleActivity(data)
      }
    } catch (error) {
      console.error('[InsightsDashboard] Error fetching data:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [timeframe, platform, whaleThreshold])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleRefresh = () => {
    fetchAnalytics(true)
  }

  const timeframeLabel = {
    '1h': 'Last Hour',
    '24h': '24 Hours',
    '7d': '7 Days',
    '30d': '30 Days',
  }

  const handleMarketClick = (market: MarketWithChange) => {
    if (onMarketSelect) {
      // Convert to EnrichedMarket format
      const enrichedMarket: Partial<EnrichedMarket> = {
        id: market.id,
        title: market.title,
        platform: market.platform as 'polymarket' | 'kalshi',
        slug: market.slug || undefined,
        ticker: market.ticker || undefined,
        category: market.category || undefined,
        price: market.currentPrice,
        probability: market.currentPrice,
        volume24h: market.volume24h,
        liquidity: market.liquidity || undefined,
        endDate: market.endDate ? new Date(market.endDate) : undefined,
      }
      onMarketSelect(enrichedMarket)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0b0d]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-mono">Loading insights...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-gradient-to-br from-[#0a0b0d] via-[#0e0f11] to-[#0a0b0d] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {/* Header - with top padding to avoid overlap with EdgePannel controls */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-[#0a0b0d]/90 border-b border-white/10 mt-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-400" />
                Market Insights
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                Real-time analytics and whale activity tracking
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all",
                isRefreshing && "animate-spin"
              )}
            >
              <RefreshCw className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Selector */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
              {(['1h', '24h', '7d', '30d'] as TimeframeOption[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                    timeframe === tf
                      ? "bg-blue-500 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {timeframeLabel[tf]}
                </button>
              ))}
            </div>

            {/* Platform Filter */}
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as any)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Platforms</option>
              <option value="polymarket">Polymarket</option>
              <option value="kalshi">Kalshi</option>
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                showFilters
                  ? "bg-blue-500 text-white"
                  : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-3 p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2">
                  Minimum Buy Amount (Whale Threshold)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    min="100"
                    max="1000000"
                    step="100"
                    value={whaleThreshold}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1000
                      setWhaleThreshold(Math.max(100, Math.min(1000000, val)))
                    }}
                    className="w-full pl-7 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="5000"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">
                  Trades above this amount will be flagged as whale activity
                </p>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                {[1000, 5000, 10000, 25000, 50000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setWhaleThreshold(preset)}
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded text-[10px] font-bold transition-all",
                      whaleThreshold === preset
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white"
                    )}
                  >
                    ${(preset / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        {/* Summary Stats */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Market Sentiment"
              value={`${((analytics.summary.gainers / analytics.summary.totalMarkets) * 100).toFixed(0)}%`}
              subtitle={`${analytics.summary.gainers} bullish markets`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="green"
            />
            <StatCard
              title="Bearish Markets"
              value={`${((analytics.summary.losers / analytics.summary.totalMarkets) * 100).toFixed(0)}%`}
              subtitle={`${analytics.summary.losers} below 50%`}
              icon={<TrendingDown className="w-5 h-5" />}
              color="red"
            />
            <StatCard
              title="Total Volume"
              value={`$${(analytics.summary.totalVolume / 1000000).toFixed(1)}M`}
              subtitle={`${timeframeLabel[timeframe]}`}
              icon={<BarChart3 className="w-5 h-5" />}
              color="purple"
            />
            <StatCard
              title="Avg Movement"
              value={`${parseFloat(analytics.summary.averageChange) > 0 ? '+' : ''}${analytics.summary.averageChange}%`}
              subtitle={`across ${analytics.summary.totalMarkets} markets`}
              icon={<Activity className="w-5 h-5" />}
              color="blue"
            />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Activity & Markets */}
          <div className="xl:col-span-2 space-y-6">
            {/* Whale Activity Summary */}
            {whaleActivity && whaleActivity.summary.totalTrades > 0 && (
              <div className="p-5 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Flame className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">Whale Activity Detected</h3>
                    <p className="text-xs text-gray-400">
                      {whaleActivity.summary.totalTrades} large trades in {timeframeLabel[timeframe].toLowerCase()}
                    </p>
                    {whaleActivity.note && (
                      <p className="text-[10px] text-orange-400/70 mt-1 italic">
                        ⚠️ {whaleActivity.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-black text-orange-400">
                      ${(whaleActivity.summary.totalAmount / 1000).toFixed(0)}K
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">Total Volume</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-green-400">
                      {whaleActivity.summary.buyCount}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">Buys</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-red-400">
                      {whaleActivity.summary.sellCount}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">Sells</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-blue-400">
                      {whaleActivity.summary.uniqueMarkets}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">Markets</div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {[
                { id: 'all', label: 'All', icon: Eye },
                { id: 'topGainers', label: 'Top Gainers', icon: TrendingUp },
                { id: 'topLosers', label: 'Top Losers', icon: TrendingDown },
                { id: 'biggestMovers', label: 'Biggest Movers', icon: Activity },
                { id: 'whaleActivity', label: 'Whale Trades', icon: Flame },
              ].map((cat) => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as CategoryFilter)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                      activeCategory === cat.id
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Markets Grid */}
            {analytics && (activeCategory === 'all' || activeCategory === 'topGainers') && (
              <MarketSection
                title="🚀 Top Gainers"
                markets={analytics.topGainers}
                onMarketClick={handleMarketClick}
                type="gainer"
              />
            )}

            {analytics && (activeCategory === 'all' || activeCategory === 'topLosers') && (
              <MarketSection
                title="📉 Top Losers"
                markets={analytics.topLosers}
                onMarketClick={handleMarketClick}
                type="loser"
              />
            )}

            {analytics && (activeCategory === 'all' || activeCategory === 'biggestMovers') && (
              <MarketSection
                title="⚡ Biggest Movers"
                markets={analytics.biggestMovers}
                onMarketClick={handleMarketClick}
                type="mover"
              />
            )}

            {/* Whale Trades */}
            {whaleActivity && whaleActivity.trades.length > 0 && (activeCategory === 'all' || activeCategory === 'whaleActivity') && (
              <WhaleTradesSection trades={whaleActivity.trades} />
            )}
          </div>

          {/* Right Column: News Feed */}
          <div className="xl:col-span-1 min-h-[500px]">
            <div className="sticky top-24 h-[calc(100vh-140px)]">
              <NewsFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'red' | 'purple'
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  }

  return (
    <div className={cn(
      "p-4 rounded-xl bg-gradient-to-br border",
      colorClasses[color]
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">{title}</div>
        <div className={cn("opacity-50", colorClasses[color].split(' ')[3])}>{icon}</div>
      </div>
      <div className="text-2xl font-black text-white mb-1">{value}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  )
}

// Market Section Component
function MarketSection({
  title,
  markets,
  onMarketClick,
  type,
}: {
  title: string
  markets: MarketWithChange[]
  onMarketClick: (market: MarketWithChange) => void
  type: 'gainer' | 'loser' | 'mover'
}) {
  return (
    <div>
      <h2 className="text-lg font-black text-white mb-3 flex items-center gap-2">
        {title}
        <span className="text-xs text-gray-500 font-mono">({markets.length})</span>
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {markets.map((market, idx) => (
          <button
            key={market.id}
            onClick={() => onMarketClick(market)}
            className="group relative p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left"
          >
            {/* Rank Badge */}
            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-gray-400">
              #{idx + 1}
            </div>

            {/* Platform Badge */}
            <div className={cn(
              "absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-black uppercase",
              market.platform === 'polymarket'
                ? "bg-blue-500/20 text-blue-400"
                : "bg-green-500/20 text-green-400"
            )}>
              {market.platform}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-white mb-3 mt-6 line-clamp-2 group-hover:text-blue-400 transition-colors">
              {market.title}
            </h3>

            {/* Stats */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 mb-1">Price Change</span>
                <span className={cn(
                  "text-lg font-black",
                  market.priceChangePercent > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {market.priceChangePercent > 0 ? '+' : ''}{market.priceChangePercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500 mb-1">Current</span>
                <span className="text-lg font-black text-white">
                  {(market.currentPrice * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Volume */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase">Volume</span>
              <span className="text-xs font-bold text-gray-300">
                ${market.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Whale Trades Section
function WhaleTradesSection({ trades }: { trades: WhaleTrade[] }) {
  return (
    <div>
      <h2 className="text-lg font-black text-white mb-3 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-400" />
        Recent Whale Trades
        <span className="text-xs text-gray-500 font-mono">({trades.length})</span>
      </h2>
      <div className="space-y-2">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
                  {trade.marketTitle}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                    trade.platform === 'polymarket'
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  )}>
                    {trade.platform}
                  </span>
                  {trade.category && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400">
                      {trade.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn(
                  "text-lg font-black",
                  trade.side === 'buy' ? "text-green-400" : "text-red-400"
                )}>
                  ${(trade.amount / 1000).toFixed(1)}K
                </div>
                <div className="text-[10px] text-gray-500 uppercase">
                  {trade.side}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                <Clock className="w-3 h-3 inline mr-1" />
                {new Date(trade.timestamp).toLocaleString()}
              </span>
              {trade.outcome && (
                <span className="text-gray-400 font-mono">{trade.outcome}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
