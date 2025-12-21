'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Activity, BarChart3, Clock, Filter, RefreshCw, Zap, Eye, Flame } from 'lucide-react'
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
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0a0b0d] via-[#0e0f11] to-[#0a0b0d]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse" />
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm font-mono">Loading insights...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-black scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {/* Header - with top padding to avoid overlap with EdgePannel controls */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-black/80 border-b border-white/10 mt-20 shadow-lg shadow-blue-500/5">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-white mb-1 flex items-center gap-3 group">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/10 group-hover:from-yellow-500/30 group-hover:to-orange-500/20 transition-colors">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                Market Insights
              </h1>
              <p className="text-xs text-gray-500 font-mono tracking-wide">
                Real-time analytics and whale activity tracking
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={cn(
                "p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300",
                isRefreshing && "animate-spin"
              )}
              title="Refresh insights"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Selector */}
            <div className="flex gap-1 p-1.5 bg-white/5 rounded-xl border border-white/10">
              {(['1h', '24h', '7d', '30d'] as TimeframeOption[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                    timeframe === tf
                      ? "bg-white text-black shadow-lg shadow-white/10"
                      : "text-gray-400 hover:text-white hover:bg-white/10 active:scale-95"
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
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-300 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition-all duration-200 cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="polymarket">Polymarket</option>
              <option value="kalshi">Kalshi</option>
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 active:scale-95",
                showFilters
                  ? "bg-white text-black shadow-lg shadow-white/10"
                  : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 p-5 bg-white/5 rounded-xl border border-white/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-3 uppercase tracking-widest">
                  Minimum Buy Amount (Whale Threshold)
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold group-focus-within:text-white transition-colors">$</span>
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
                    className="w-full pl-8 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all duration-200"
                    placeholder="5000"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
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
                      "flex-1 px-2 py-2 rounded-lg text-[10px] font-bold transition-all duration-200 active:scale-95",
                      whaleThreshold === preset
                        ? "bg-white text-black shadow-lg"
                        : "bg-black/40 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
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
              <div className="p-6 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 shadow-lg shadow-orange-500/5 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-lg bg-gradient-to-br from-orange-500/30 to-red-500/20 border border-orange-500/30">
                    <Flame className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white mb-0.5">Whale Activity Detected</h3>
                    <p className="text-xs text-gray-400">
                      {whaleActivity.summary.totalTrades} large trades in {timeframeLabel[timeframe].toLowerCase()}
                    </p>
                    {whaleActivity.note && (
                      <p className="text-[10px] text-orange-300/80 mt-2 italic flex items-center gap-1.5">
                        <span>⚠️</span> {whaleActivity.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="text-lg font-black text-orange-400 mb-0.5">
                      ${(whaleActivity.summary.totalAmount / 1000).toFixed(0)}K
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Volume</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="text-lg font-black text-green-400 mb-0.5">
                      {whaleActivity.summary.buyCount}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Buys</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="text-lg font-black text-red-400 mb-0.5">
                      {whaleActivity.summary.sellCount}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Sells</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="text-lg font-black text-blue-400 mb-0.5">
                      {whaleActivity.summary.uniqueMarkets}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Markets</div>
                  </div>
                </div>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-6 px-6">
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
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 active:scale-95",
                      activeCategory === cat.id
                        ? "bg-white text-black shadow-lg"
                        : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
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
              />
            )}

            {analytics && (activeCategory === 'all' || activeCategory === 'topLosers') && (
              <MarketSection
                title="📉 Top Losers"
                markets={analytics.topLosers}
                onMarketClick={handleMarketClick}
              />
            )}

            {analytics && (activeCategory === 'all' || activeCategory === 'biggestMovers') && (
              <MarketSection
                title="⚡ Biggest Movers"
                markets={analytics.biggestMovers}
                onMarketClick={handleMarketClick}
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
    blue: {
      gradient: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      hover: 'hover:from-blue-500/30 hover:to-blue-600/20 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10',
    },
    green: {
      gradient: 'from-green-500/20 to-green-600/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      hover: 'hover:from-green-500/30 hover:to-green-600/20 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10',
    },
    red: {
      gradient: 'from-red-500/20 to-red-600/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      hover: 'hover:from-red-500/30 hover:to-red-600/20 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10',
    },
    purple: {
      gradient: 'from-purple-500/20 to-purple-600/10',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      hover: 'hover:from-purple-500/30 hover:to-purple-600/20 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10',
    },
  }

  const colors = colorClasses[color]

  return (
    <div className={cn(
      "p-5 rounded-xl bg-gradient-to-br border transition-all duration-300 hover:scale-105 group",
      colors.gradient,
      colors.border,
      colors.hover
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">{title}</div>
        <div className={cn("opacity-60 group-hover:opacity-100 transition-opacity", colors.text)}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-black text-white mb-2">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 leading-relaxed">{subtitle}</div>}
    </div>
  )
}

// Market Section Component
function MarketSection({
  title,
  markets,
  onMarketClick,
}: {
  title: string
  markets: MarketWithChange[]
  onMarketClick: (market: MarketWithChange) => void
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3">
        <span>{title}</span>
        <span className="text-xs text-gray-500 font-mono bg-white/10 px-2.5 py-1 rounded-lg">
          {markets.length}
        </span>
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {markets.map((market, idx) => (
          <button
            key={market.id}
            onClick={() => onMarketClick(market)}
            className="group relative p-5 rounded-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 hover:from-white/10 hover:to-white/20 hover:border-white/30 transition-all duration-300 text-left hover:shadow-lg hover:shadow-blue-500/10 hover:scale-105 active:scale-95"
          >
            {/* Rank Badge */}
            <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-black text-blue-300">
              #{idx + 1}
            </div>

            {/* Platform Badge */}
            <div className={cn(
              "absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
              market.platform === 'polymarket'
                ? "bg-blue-500/30 text-blue-300 border border-blue-500/30"
                : "bg-green-500/30 text-green-300 border border-green-500/30"
            )}>
              {market.platform}
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold text-white mb-4 mt-8 line-clamp-2 group-hover:text-blue-300 transition-colors leading-tight">
              {market.title}
            </h3>

            {/* Stats */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Change</span>
                <span className={cn(
                  "text-xl font-black",
                  market.priceChangePercent > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {market.priceChangePercent > 0 ? '+' : ''}{market.priceChangePercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Price</span>
                <span className="text-xl font-black text-white">
                  {(market.currentPrice * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Volume Bar */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Volume</span>
                <span className="text-xs font-bold text-gray-300">
                  ${market.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (market.volume24h / 1000000) * 100)}%` }}
                />
              </div>
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
      <h2 className="text-xl font-black text-white mb-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/10">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        Recent Whale Trades
        <span className="text-xs text-gray-500 font-mono bg-white/10 px-2.5 py-1 rounded-lg">
          {trades.length}
        </span>
      </h2>
      <div className="space-y-3">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className="group p-5 rounded-xl bg-gradient-to-r from-white/5 to-white/10 border border-white/10 hover:from-white/10 hover:to-white/20 hover:border-orange-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="text-sm font-bold text-white mb-2 line-clamp-1 group-hover:text-orange-300 transition-colors">
                  {trade.marketTitle}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
                    trade.platform === 'polymarket'
                      ? "bg-blue-500/30 text-blue-300 border border-blue-500/30"
                      : "bg-green-500/30 text-green-300 border border-green-500/30"
                  )}>
                    {trade.platform}
                  </span>
                  {trade.category && (
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/30">
                      {trade.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn(
                  "text-xl font-black",
                  trade.side === 'buy' ? "text-green-400" : "text-red-400"
                )}>
                  ${(trade.amount / 1000).toFixed(1)}K
                </div>
                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                  {trade.side}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-3 border-t border-white/10">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {new Date(trade.timestamp).toLocaleString()}
              </span>
              {trade.outcome && (
                <span className="text-gray-400 font-mono bg-white/10 px-2 py-1 rounded">{trade.outcome}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
