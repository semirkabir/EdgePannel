'use client'

import { useEffect, useState } from 'react'
import { MarketDetails as MarketDetailsType, Candlestick } from '@/types/market'
import { Button } from '@/components/ui/button'
import { MarketChart } from '@/components/charts/MarketChart'
import { CandlestickChart } from '@/components/charts/CandlestickChart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, ExternalLink, Landmark, CloudRain, Trophy, Cpu, Film, Activity, Globe as GlobeIcon, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { RightPanel } from '@/components/ui/RightPanel'

// Map categories to icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Politics': <Landmark className="w-3 h-3" />,
  'Economics': <TrendingUp className="w-3 h-3" />,
  'Weather': <CloudRain className="w-3 h-3" />,
  'Sports': <Trophy className="w-3 h-3" />,
  'Technology': <Cpu className="w-3 h-3" />,
  'Entertainment': <Film className="w-3 h-3" />,
  'Health': <Activity className="w-3 h-3" />,
  'International': <GlobeIcon className="w-3 h-3" />,
  'General': <LayoutGrid className="w-3 h-3" />,
  'Other': <LayoutGrid className="w-3 h-3" />
}

interface MarketDetailsProps {
  market: MarketDetailsType | null
  onClose: () => void
}

export function MarketDetails({ market, onClose }: MarketDetailsProps) {
  // Cache the market so we can display it while the panel is animating out
  const [activeMarket, setActiveMarket] = useState<MarketDetailsType | null>(market)
  const [timeRange, setTimeRange] = useState('1W')
  const [chartType, setChartType] = useState<'line' | 'candle'>('line')
  const [candlesticks, setCandlesticks] = useState<Candlestick[]>([])
  const [isLoadingCandlesticks, setIsLoadingCandlesticks] = useState(false)

  useEffect(() => {
    if (market) {
      setActiveMarket(market)
    }
  }, [market])

  // Helper to safely get date string
  const getEndDateString = () => {
    if (!activeMarket?.endDate) return 'N/A';
    try {
      const date = activeMarket.endDate instanceof Date ? activeMarket.endDate : new Date(activeMarket.endDate);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Invalid Date';
    }
  }

  // Calculate price change from history
  const getPriceChange = () => {
    if (!activeMarket?.priceHistory || activeMarket.priceHistory.length < 2) {
      return { change: 0, percentage: 0, isPositive: true };
    }

    const history = activeMarket.priceHistory;
    const currentPrice = activeMarket.price || history[history.length - 1]?.price || 0;
    const oldestPrice = history[0]?.price || 0;

    if (oldestPrice === 0) {
      return { change: 0, percentage: 0, isPositive: true };
    }

    const change = currentPrice - oldestPrice;
    const percentage = (change / oldestPrice) * 100;
    const isPositive = change >= 0;

    return { change, percentage, isPositive };
  }

  const priceChange = getPriceChange();

  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!activeMarket?.id || !activeMarket.platform) return

      // If we already have history and it matches the requested range/granularity, maybe skip?
      // For now, simple fetch on mount/change

      setIsLoadingHistory(true)
      try {
        // Map timeRange to interval
        let interval = '1d'
        if (timeRange === '1H') interval = '1m' // or 5m
        else if (timeRange === '1D') interval = '1h'
        else if (timeRange === '1W') interval = '6h'
        else if (timeRange === 'ALL') interval = '1d'

        const response = await fetch(`/api/markets/history?id=${activeMarket.id}&platform=${activeMarket.platform}&interval=${interval}`)
        if (response.ok) {
          const data = await response.json()
          if (data.history && Array.isArray(data.history)) {
            setActiveMarket(prev => prev ? ({
              ...prev,
              priceHistory: data.history
            }) : null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    fetchHistory()
  }, [activeMarket?.id, activeMarket?.platform, timeRange])

  // Fetch candlestick data
  useEffect(() => {
    const fetchCandlesticks = async () => {
      if (!activeMarket) return

      setIsLoadingCandlesticks(true)
      try {
        // Map timeRange to interval
        let interval = '1d'
        if (timeRange === '1H') interval = '1m'
        else if (timeRange === '1D') interval = '1h'
        else if (timeRange === '1W') interval = '6h'
        else if (timeRange === 'ALL') interval = '1d'

        if (activeMarket.platform === 'kalshi' && activeMarket.ticker) {
          // Kalshi: single market candlesticks
          const response = await fetch(`/api/markets/candlesticks?eventTicker=${activeMarket.ticker}&interval=${interval}`)
          if (response.ok) {
            const data = await response.json()
            if (data.candlesticks && Array.isArray(data.candlesticks)) {
              setCandlesticks(data.candlesticks.map((c: any) => ({
                ...c,
                timestamp: new Date(c.timestamp)
              })))
            }
          }
        } else if (activeMarket.platform === 'polymarket' && activeMarket.slug) {
          // Polymarket: fetch candlesticks for the main market
          // For multi-outcome markets, we could fetch all outcomes but for now just the main one
          const response = await fetch(`/api/markets/candlesticks?platform=polymarket&marketSlugs=${activeMarket.slug}&interval=${interval}`)
          if (response.ok) {
            const data = await response.json()
            if (data.candlesticks && typeof data.candlesticks === 'object') {
              // candlesticks is a map of slug -> Candlestick[]
              const marketCandlesticks = data.candlesticks[activeMarket.slug]
              if (Array.isArray(marketCandlesticks)) {
                setCandlesticks(marketCandlesticks.map((c: any) => ({
                  ...c,
                  timestamp: new Date(c.timestamp)
                })))
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch candlesticks:', error)
      } finally {
        setIsLoadingCandlesticks(false)
      }
    }

    fetchCandlesticks()
  }, [activeMarket?.ticker, activeMarket?.slug, activeMarket?.platform, timeRange])

  // Fetch event details with articles
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!activeMarket) return

      try {
        let url: string | null = null

        if (activeMarket.platform === 'kalshi' && activeMarket.ticker) {
          url = `/api/markets/event-details?ticker=${activeMarket.ticker}`
        } else if (activeMarket.platform === 'polymarket' && activeMarket.slug) {
          url = `/api/markets/event-details?platform=polymarket&slug=${activeMarket.slug}`
        }

        if (url) {
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            if (data.eventData) {
              setActiveMarket(prev => prev ? ({
                ...prev,
                eventData: data.eventData
              }) : null)
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch event details:', error)
      }
    }

    fetchEventDetails()
  }, [activeMarket?.ticker, activeMarket?.slug, activeMarket?.platform])

  // Get articles from event data or use mock tweets
  const articles = activeMarket?.eventData?.rankedArticles || []
  const hasArticles = articles.length > 0

  // Mock tweets as fallback
  const mockTweets = [
    { id: 1, user: 'MarketAnalyst', handle: '@analyst_top', text: `Huge movement on "${activeMarket?.title}" today! Volume spiking. #predictionmarkets`, time: '2m ago' },
    { id: 2, user: 'CryptoTrader', handle: '@cryptotrader', text: 'Buying YES on this one. The odds are too good to pass up.', time: '15m ago' },
    { id: 3, user: 'NewsBreaker', handle: '@newsbreaker', text: 'Breaking: New developments might affect the outcome of this market significantly.', time: '1h ago' },
    { id: 4, user: 'PolymarketWhale', handle: '@polywhale', text: 'Just saw a massive buy order come in. Someone knows something.', time: '3h ago' },
  ]

  // Get category with proper capitalization
  const getCategory = () => {
    if (!activeMarket?.category) return null
    const category = activeMarket.category.charAt(0).toUpperCase() + activeMarket.category.slice(1)
    return category
  }

  const category = getCategory()

  return (
    <RightPanel
      isOpen={!!market}
      onClose={onClose}
      title={activeMarket?.title || 'Market'}
      subtitle={
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-[10px] font-mono uppercase tracking-wider",
            activeMarket?.platform === 'polymarket' ? "text-blue-400" : "text-green-400"
          )}>
            {activeMarket?.platform}
          </span>
          {category && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-[10px] font-medium text-purple-300">
              {CATEGORY_ICONS[category] || <LayoutGrid className="w-2.5 h-2.5" />}
              {category}
            </span>
          )}
        </div>
      }
    >
      {/* 1. Hero / Price Section (Gamified) */}
      {activeMarket && (
        <div className="px-5 pt-8 pb-4 text-center relative">
          <div className="inline-flex flex-col items-center">
            <span className="text-sm font-medium text-gray-400 mb-1 tracking-wide">CHANCE</span>
            <div className={cn(
              "text-6xl font-black tracking-tighter tabular-nums mb-2",
              (activeMarket.price || 0) >= 0.5 ? "text-[#00ff7f]" : "text-[#ff4d4d]" // Neon Green / Red
            )}>
              {Math.round((activeMarket.price || 0) * 100)}%
            </div>

            {/* Price Change - Calculated from history */}
            {priceChange.percentage !== 0 && (
              <div className={cn(
                "flex items-center gap-1.5 text-sm font-medium px-2 py-0.5 rounded-full",
                priceChange.isPositive
                  ? "text-emerald-400 bg-emerald-400/10"
                  : "text-red-400 bg-red-400/10"
              )}>
                {priceChange.isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {priceChange.isPositive ? '+' : ''}{priceChange.percentage.toFixed(1)}% {
                    timeRange === '1H' ? 'Last Hour' :
                      timeRange === '1D' ? 'Today' :
                        timeRange === '1W' ? 'This Week' :
                          'All Time'
                  }
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi-Outcome Display */}
      {activeMarket && Array.isArray(activeMarket.outcomes) && Array.isArray(activeMarket.outcomePrices) && activeMarket.outcomes.length > 2 && (
        <div className="px-5 mb-6">
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">All Outcomes</h3>
          <div className="space-y-2">
            {activeMarket.outcomes.map((outcome, index) => {
              const price = activeMarket.outcomePrices?.[index]
              if (price === undefined) return null

              const percentage = Math.round(price * 100)
              const isLeading = index === 0 || price === Math.max(...(activeMarket.outcomePrices || []))

              return (
                <div
                  key={index}
                  className={cn(
                    "relative rounded-lg overflow-hidden border transition-all",
                    isLeading
                      ? "bg-blue-500/10 border-blue-500/30"
                      : "bg-white/5 border-white/10"
                  )}
                >
                  {/* Background progress bar */}
                  <div
                    className={cn(
                      "absolute inset-0 transition-all",
                      isLeading ? "bg-blue-500/20" : "bg-white/5"
                    )}
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Content */}
                  <div className="relative px-3 py-2.5 flex items-center justify-between">
                    <span className={cn(
                      "text-sm font-medium",
                      isLeading ? "text-blue-300" : "text-gray-300"
                    )}>
                      {outcome}
                    </span>
                    <span className={cn(
                      "text-base font-bold tabular-nums",
                      isLeading ? "text-blue-400" : "text-gray-400"
                    )}>
                      {percentage}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Chart Section */}
      <div className="w-full h-[280px] mb-4 relative group">
        {/* Controls Bubble */}
        <div className="absolute top-2 right-4 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Chart Type Toggle - show for both platforms */}
          <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg border border-white/5 backdrop-blur-sm">
            <button
              onClick={() => setChartType('line')}
              className={cn(
                "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                chartType === 'line' ? "bg-white/20 text-white" : "text-gray-500 hover:text-gray-300"
              )}
            >
              LINE
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={cn(
                "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                chartType === 'candle' ? "bg-white/20 text-white" : "text-gray-500 hover:text-gray-300"
              )}
            >
              CANDLE
            </button>
          </div>
          {/* Time Filters */}
          <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg border border-white/5 backdrop-blur-sm">
            {['1H', '1D', '1W', 'ALL'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                  timeRange === range ? "bg-white/20 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {chartType === 'candle' && candlesticks.length > 0 ? (
          <CandlestickChart data={candlesticks} />
        ) : activeMarket?.priceHistory && activeMarket.priceHistory.length > 0 ? (
          <MarketChart data={activeMarket.priceHistory} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs tracking-wider">
            {isLoadingHistory || isLoadingCandlesticks ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              'No chart data available'
            )}
          </div>
        )}
      </div>

      {/* 3. Action Buttons (Gamified) */}
      {activeMarket && (
        <div className="px-5 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-12 bg-[#00ff7f] hover:bg-[#00cc66] text-black font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(0,255,127,0.2)] border-0"
              onClick={() => {
                const url = activeMarket.rawData?.url || (activeMarket.platform === 'polymarket' ? `https://polymarket.com/market/${activeMarket.slug || activeMarket.id}` : `https://kalshi.com/markets/${activeMarket.slug || activeMarket.ticker || activeMarket.id}`);
                window.open(url, '_blank');
              }}
            >
              BET YES
            </Button>
            <Button
              className="h-12 bg-[#ff4d4d] hover:bg-[#cc0000] text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(255,77,77,0.2)] border-0"
              onClick={() => {
                const url = activeMarket.rawData?.url || (activeMarket.platform === 'polymarket' ? `https://polymarket.com/market/${activeMarket.slug || activeMarket.id}` : `https://kalshi.com/markets/${activeMarket.slug || activeMarket.ticker || activeMarket.id}`);
                window.open(url, '_blank');
              }}
            >
              BET NO
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs font-mono text-gray-500">
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold mb-0.5">${(activeMarket.volume24h || 0).toLocaleString(undefined, { notation: 'compact' })}</span>
              <span>VOL</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold mb-0.5">${(activeMarket.liquidity || 0).toLocaleString(undefined, { notation: 'compact' })}</span>
              <span>LIQ</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold mb-0.5">
                {getEndDateString()}
              </span>
              <span>ENDS</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Details / Tweets Tabs */}
      {activeMarket && (
        <div className="px-5">
          <Tabs defaultValue="tweets" className="w-full">
            <TabsList className="w-full bg-white/5 p-1 rounded-xl mb-4 border border-white/5">
              <TabsTrigger value="tweets" className="flex-1 rounded-lg text-xs font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                LATEST NEWS
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 rounded-lg text-xs font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500">
                MARKET INFO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tweets" className="mt-0 space-y-3">
              {hasArticles ? (
                articles.map((article, idx) => (
                  <a
                    key={idx}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition-colors line-clamp-2">
                          {article.title}
                        </h4>
                        {article.author && (
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            By {article.author}
                          </span>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                      {article.summary}
                    </p>
                  </a>
                ))
              ) : (
                mockTweets.map((tweet) => (
                  <div key={tweet.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-black">
                        {tweet.user[0]}
                      </div>
                      <span className="text-xs font-bold text-gray-200">{tweet.user}</span>
                      <span className="text-[10px] text-gray-500 ml-auto">{tweet.time}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {tweet.text}
                    </p>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="info" className="mt-0">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Description</h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  {activeMarket.description || 'No description available for this market.'}
                </p>

                <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Resolution Source</h4>
                <a
                  href={activeMarket.rawData?.url || '#'}
                  target="_blank"
                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {activeMarket.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'} Source
                </a>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </RightPanel>
  )
}
