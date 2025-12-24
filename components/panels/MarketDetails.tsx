'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'

import { MarketDetails as MarketDetailsType, Candlestick } from '@/types/market'
import { Button } from '@/components/ui/button'
import { MarketChart } from '@/components/charts/MarketChart'
import { CandlestickChart } from '@/components/charts/CandlestickChart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, ExternalLink, Landmark, CloudRain, Trophy, Cpu, Film, Activity, Globe as GlobeIcon, LayoutGrid, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { RightPanel } from '@/components/ui/RightPanel'
import { useLiveVolume, getEventIdFromMarket } from '@/hooks/use-live-volume'
import { useOpenInterest } from '@/hooks/use-open-interest'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LatencyTag } from '@/components/edge/LatencyTag'
import { useExchangeMovers } from '@/hooks/use-exchange-movers'

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
  market: MarketDetailsType | any | null // Can be a market or an event object
  onClose: () => void
}

export function MarketDetails({ market, onClose }: MarketDetailsProps) {
  // Check if market is actually an event (has markets array)
  const isEvent = market && (market as any).isEvent === true && Array.isArray((market as any).markets)
  const isExchange = market && (market as any).isExchange === true

  // Cache the market/event so we can display it while the panel is animating out
  const [activeMarket, setActiveMarket] = useState<MarketDetailsType | null>(
    isEvent || isExchange ? null : (market as MarketDetailsType | null)
  )
  const [activeEvent, setActiveEvent] = useState<any>(isEvent ? market : null)
  const [activeExchange, setActiveExchange] = useState<any>(isExchange ? market : null)
  const [timeRange, setTimeRange] = useState('1W')
  const [chartType, setChartType] = useState<'line' | 'candle'>('line')
  const [candlesticks, setCandlesticks] = useState<Candlestick[]>([])
  const [isLoadingCandlesticks, setIsLoadingCandlesticks] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [relatedMarkets, setRelatedMarkets] = useState<any[]>([])
  const [isLoadingRelated, setIsLoadingRelated] = useState(false)
  const [topHolders, setTopHolders] = useState<any[]>([])
  const [isLoadingHolders, setIsLoadingHolders] = useState(false)
  const [commentSort, setCommentSort] = useState<'recent' | 'likes'>('recent')
  const [relatedMarketsByTags, setRelatedMarketsByTags] = useState<any[]>([])
  const [isLoadingRelatedByTags, setIsLoadingRelatedByTags] = useState(false)

  // Ref to scroll container for scrolling to top when switching markets
  const panelTopRef = useRef<HTMLDivElement>(null)

  // Virtualizer for related markets
  const relatedParentRef = useRef<HTMLDivElement>(null)
  const relatedVirtualizer = useVirtualizer({
    count: relatedMarketsByTags.length,
    getScrollElement: () => relatedParentRef.current,
    estimateSize: () => 80, // Height of related market row + padding
    overscan: 5,
  })

  // Fetch live volume for Polymarket markets
  const eventId = activeMarket?.platform === 'polymarket' ? getEventIdFromMarket(activeMarket) : null
  const { liveVolume, isLoading: isLoadingLiveVolume } = useLiveVolume(eventId, {
    enabled: !!eventId && !!activeMarket,
    refreshInterval: 30000,
  })

  // Fetch Open Interest for Polymarket markets
  const conditionId = activeMarket?.platform === 'polymarket'
    ? (activeMarket.id || activeMarket.rawData?.conditionId)
    : null
  const { openInterest, isLoading: isLoadingOI } = useOpenInterest(conditionId || undefined, {
    enabled: !!conditionId && !!activeMarket && activeMarket.platform === 'polymarket',
    refreshInterval: 30000,
  })

  // Fetch exchange movers for stock exchanges
  const { gainers, losers, mostActive, isLoading: isLoadingMovers } = useExchangeMovers(
    activeExchange?.id || null,
    !!activeExchange
  )

  useEffect(() => {
    if (market) {
      const isEventData = (market as any).isEvent === true && Array.isArray((market as any).markets)
      const isExchangeData = (market as any).isExchange === true

      if (isExchangeData) {
        setActiveExchange(market)
        setActiveEvent(null)
        setActiveMarket(null)
      } else if (isEventData) {
        setActiveEvent(market)
        setActiveExchange(null)
        // Set the first market as active by default
        const firstMarket = (market as any).markets[0]
        if (firstMarket) {
          // Preserve more data from the original market object
          const fullMarket = {
            id: firstMarket.id,
            title: firstMarket.title,
            description: firstMarket.description || '',
            platform: (market as any).platform,
            volume24h: firstMarket.volume24h || 0,
            price: firstMarket.price || 0,
            probability: firstMarket.price || 0,
            slug: firstMarket.slug || firstMarket.id,
            ticker: firstMarket.ticker || '',
            category: (market as any).category,
            imageUrl: firstMarket.imageUrl,
            endDate: firstMarket.endDate ? (typeof firstMarket.endDate === 'string' ? new Date(firstMarket.endDate) : firstMarket.endDate) : undefined,
            rawData: firstMarket.rawData || {},
            tags: firstMarket.tags || firstMarket.rawData?.tags || (market as any).tags || [],
          }
          setActiveMarket(fullMarket as MarketDetailsType)
        } else {
          setActiveMarket(null)
        }
      } else {
        setActiveMarket(market as MarketDetailsType)
        setActiveEvent(null)
        setActiveExchange(null)
      }
    } else {
      setActiveMarket(null)
      setActiveEvent(null)
      setActiveExchange(null)
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

  // Get current price (prioritize live data)
  const getCurrentPrice = () => {
    // Use the most recent price from history if available, otherwise use market price
    if (activeMarket?.priceHistory && activeMarket.priceHistory.length > 0) {
      const latestHistoryPrice = activeMarket.priceHistory[activeMarket.priceHistory.length - 1]?.price
      if (latestHistoryPrice !== undefined) {
        return latestHistoryPrice
      }
    }
    return activeMarket?.price || 0
  }

  const currentPrice = getCurrentPrice()

  // Calculate price change from history
  const getPriceChange = () => {
    if (!activeMarket?.priceHistory || activeMarket.priceHistory.length < 2) {
      return { change: 0, percentage: 0, isPositive: true };
    }

    const history = activeMarket.priceHistory;
    const latestPrice = history[history.length - 1]?.price || activeMarket.price || 0;
    const oldestPrice = history[0]?.price || 0;

    if (oldestPrice === 0) {
      return { change: 0, percentage: 0, isPositive: true };
    }

    const change = latestPrice - oldestPrice;
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

        // For Polymarket, try to get the token ID from rawData
        let url = `/api/markets/history?id=${activeMarket.id}&platform=${activeMarket.platform}&interval=${interval}`

        if (activeMarket.platform === 'polymarket') {
          // Try to get token ID from rawData.clobTokenIds
          const tokenIds = activeMarket.rawData?.clobTokenIds
          if (tokenIds && Array.isArray(tokenIds) && tokenIds.length > 0) {
            url += `&assetId=${tokenIds[0]}`
          } else if (activeMarket.slug) {
            // Fallback to using slug
            url = `/api/markets/history?id=${activeMarket.slug}&platform=${activeMarket.platform}&interval=${interval}`
          }
        }

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data.history && Array.isArray(data.history)) {
            setActiveMarket(prev => prev ? ({
              ...prev,
              priceHistory: data.history
            }) : null)
          } else {
            console.warn('[MarketDetails] No history data in response')
          }
        } else {
          console.error('[MarketDetails] History API error:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    fetchHistory()
  }, [activeMarket?.id, activeMarket?.platform, activeMarket?.slug, timeRange, JSON.stringify(activeMarket?.rawData?.clobTokenIds)])


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


  // Fetch Polymarket comments
  useEffect(() => {
    const fetchComments = async () => {
      if (!activeMarket || activeMarket.platform !== 'polymarket') {
        setComments([])
        return
      }

      // Extract identifiers for fetching comments
      const conditionId = activeMarket.id || activeMarket.rawData?.conditionId
      const marketId = activeMarket.rawData?.numericId || activeMarket.rawData?.id
      const slug = activeMarket.slug || activeMarket.rawData?.slug

      if (!conditionId && !marketId && !slug) {
        console.warn('[MarketDetails] No identifiers found for comments')
        return
      }

      setIsLoadingComments(true)
      try {
        // Build params - prefer slug for page scraping, then marketId, then conditionId
        const params = new URLSearchParams({ limit: '20' })
        if (slug) {
          params.set('slug', slug)
        } else if (marketId) {
          params.set('marketId', String(marketId))
        } else if (conditionId) {
          params.set('conditionId', conditionId)
        }

        const response = await fetch(`/api/markets/comments?${params.toString()}`)

        if (response.ok) {
          const data = await response.json()
          // Sort by reaction count (highest to lowest)
          const sortedComments = (data.comments || []).sort((a: any, b: any) => {
            return (b.likes || 0) - (a.likes || 0)
          })
          setComments(sortedComments)
        } else {
          console.error('[MarketDetails] Comments API error:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('[MarketDetails] Error fetching comments:', error)
      } finally {
        setIsLoadingComments(false)
      }
    }

    fetchComments()
  }, [activeMarket?.id, activeMarket?.platform, activeMarket?.slug, activeMarket?.rawData?.numericId])


  // Fetch related markets from the same event (only for non-event markets)
  // When we have an activeEvent, we already have all markets, so skip this fetch
  useEffect(() => {
    const fetchRelatedMarkets = async () => {
      // Skip if we already have event data with markets
      if (activeEvent && activeEvent.markets && Array.isArray(activeEvent.markets)) {
        setRelatedMarkets([])
        return
      }

      if (!activeMarket || activeMarket.platform !== 'polymarket') {
        setRelatedMarkets([])
        return
      }

      const eventId = activeMarket.rawData?.events?.[0]?.id
      if (!eventId) {
        setRelatedMarkets([])
        return
      }

      setIsLoadingRelated(true)
      try {
        // Use our API route instead of direct fetch to avoid CORS
        const response = await fetch(`/api/markets/event-details?platform=polymarket&eventId=${eventId}`)

        if (response.ok) {
          const data = await response.json()
          const eventData = data.eventData
          const markets = eventData?.markets || []

          // Filter out the current market and sort by volume
          const otherMarkets = markets
            .filter((m: any) => m.conditionId !== activeMarket.id)
            .sort((a: any, b: any) => {
              const aVol = a.volume24hr || 0
              const bVol = b.volume24hr || 0
              return parseFloat(bVol.toString()) - parseFloat(aVol.toString())
            })
            .slice(0, 10) // Show top 10 related markets
            .map((m: any) => {
              // Parse outcome prices
              let price = 0
              try {
                const prices = typeof m.outcomePrices === 'string'
                  ? JSON.parse(m.outcomePrices)
                  : m.outcomePrices
                if (Array.isArray(prices) && prices.length > 0) {
                  price = parseFloat(prices[0].toString())
                }
              } catch (e) {
                console.warn('[MarketDetails] Failed to parse outcomePrices')
              }

              // Extract option name from question
              let optionName = m.question
              const optionMatch = m.question.match(/Will (.+?) (win|be|get|reach|hit|dip to|rise to)/)
              if (optionMatch) {
                optionName = optionMatch[1]
              }

              return {
                id: m.conditionId,
                question: m.question,
                optionName,
                price,
                volume: m.volume24hr || 0,
                slug: m.slug
              }
            })

          console.log('[MarketDetails] Found', otherMarkets.length, 'related markets')
          setRelatedMarkets(otherMarkets)
        }
      } catch (error) {
        console.error('[MarketDetails] Error fetching related markets:', error)
        setRelatedMarkets([]) // Set empty on error
      } finally {
        setIsLoadingRelated(false)
      }
    }

    fetchRelatedMarkets()
  }, [activeMarket?.id, activeMarket?.platform, activeMarket?.rawData?.events, activeEvent?.id])


  // Fetch related markets by tags
  useEffect(() => {
    // Reset related markets when market changes
    setRelatedMarketsByTags([])
    setIsLoadingRelatedByTags(false)

    const fetchRelatedByTags = async () => {
      if (!activeMarket || activeMarket.platform !== 'polymarket') {
        setRelatedMarketsByTags([])
        setIsLoadingRelatedByTags(false)
        return
      }

      // Get tags from market - try multiple sources
      // Polymarket API returns tags as objects with {id, slug, label} or as strings
      let tagObjects: any[] = []

      // Try to get tag objects from rawData (from events API or market details)
      if (activeMarket.rawData?.tags && Array.isArray(activeMarket.rawData.tags)) {
        tagObjects = activeMarket.rawData.tags.filter((t: any) =>
          typeof t === 'object' && (t.slug || t.id || t.label)
        )
      }

      // If no tag objects, try to get from market.tags (might be strings or objects)
      if (tagObjects.length === 0 && activeMarket.tags) {
        tagObjects = activeMarket.tags
          .filter((t: any) => typeof t === 'object' && (t.slug || t.id || t.label))
          .map((t: any) => typeof t === 'object' ? t : null)
          .filter(Boolean)
      }

      // If still no tag objects, try to fetch tags from API using market ID
      if (tagObjects.length === 0 && activeMarket.id) {
        try {
          const tagsResponse = await fetch(`/api/markets/${activeMarket.id}/tags`, {
            cache: 'no-store' // Prevent caching
          })
          if (tagsResponse.ok) {
            const tagsData = await tagsResponse.json()
            if (tagsData.tags && Array.isArray(tagsData.tags) && tagsData.tags.length > 0) {
              tagObjects = tagsData.tags.filter((t: any) => typeof t === 'object' && (t.slug || t.id))
            }
          }
        } catch (e) {
          // Fallback to category if tag fetch fails
        }
      }

      // Fallback: use category as tag name if no tag objects found
      if (tagObjects.length === 0 && activeMarket.category) {
        // We'll need to convert category to slug, but this is less ideal
        const categorySlug = activeMarket.category
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')

        if (categorySlug) {
          tagObjects = [{ slug: categorySlug, label: activeMarket.category }]
        }
      }

      if (tagObjects.length === 0) {
        setRelatedMarketsByTags([])
        setIsLoadingRelatedByTags(false)
        return
      }

      // Use the first tag's slug (preferred) or ID
      const primaryTag = tagObjects[0]
      const tagSlug = primaryTag.slug || primaryTag.label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const tagId = primaryTag.id

      if (!tagSlug && !tagId) {
        setRelatedMarketsByTags([])
        setIsLoadingRelatedByTags(false)
        return
      }

      setIsLoadingRelatedByTags(true)
      try {
        const params = new URLSearchParams({
          limit: '20',
        })

        // Prefer tagId over tagSlug for more accurate results
        if (tagId) {
          params.set('tagId', String(tagId))
        } else if (tagSlug) {
          params.set('tagSlug', tagSlug)
        }

        if (activeMarket.id) {
          params.set('marketId', activeMarket.id)
        }

        // Add cache-busting parameter to ensure fresh data
        // params.set('_t', Date.now().toString())

        const response = await fetch(`/api/markets/related-by-tags?${params.toString()}`, {
          // cache: 'no-store' // Allow default caching
        })

        if (response.ok) {
          const data = await response.json()
          setRelatedMarketsByTags(data.markets || [])
        } else {
          console.error('[MarketDetails] Related markets API error:', response.status, response.statusText)
          setRelatedMarketsByTags([])
        }
      } catch (error) {
        console.error('[MarketDetails] Error fetching related markets by tags:', error)
        setRelatedMarketsByTags([])
      } finally {
        setIsLoadingRelatedByTags(false)
      }
    }

    fetchRelatedByTags()
  }, [activeMarket?.id, activeMarket?.platform, activeMarket?.category, JSON.stringify(activeMarket?.tags), JSON.stringify(activeMarket?.rawData?.tags)])


  // Fetch top holders for Polymarket markets
  useEffect(() => {
    const fetchTopHolders = async () => {
      if (!activeMarket || activeMarket.platform !== 'polymarket') {
        setTopHolders([])
        return
      }

      const conditionId = activeMarket.id || activeMarket.rawData?.conditionId
      if (!conditionId) {
        console.warn('[MarketDetails] No condition ID found for top holders')
        return
      }

      setIsLoadingHolders(true)
      try {
        console.log('[MarketDetails] Fetching top holders for conditionId:', conditionId)
        const response = await fetch(`/api/markets/top-holders?conditionId=${conditionId}&limit=20`)

        if (response.ok) {
          const data = await response.json()
          console.log('[MarketDetails] Received top holders:', data.holders?.length || 0)
          setTopHolders(data.holders || [])
        } else {
          console.error('[MarketDetails] Top holders API error:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('[MarketDetails] Error fetching top holders:', error)
      } finally {
        setIsLoadingHolders(false)
      }
    }

    fetchTopHolders()
  }, [activeMarket?.id, activeMarket?.platform, activeMarket?.rawData?.conditionId])


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

  // Debug: Log event markets
  useEffect(() => {
    if (activeEvent) {
      console.log('[MarketDetails] ActiveEvent:', {
        id: activeEvent.id,
        title: activeEvent.title,
        marketsCount: activeEvent.markets?.length || 0,
        hasMarkets: Array.isArray(activeEvent.markets),
        markets: activeEvent.markets?.map((m: any) => ({
          id: m.id,
          title: m.title,
          price: m.price,
          volume24h: m.volume24h
        })) || []
      })
      console.log('[MarketDetails] Active market:', {
        id: activeMarket?.id,
        slug: activeMarket?.slug,
        ticker: activeMarket?.ticker
      })
    } else {
      console.log('[MarketDetails] No activeEvent')
    }
  }, [activeEvent, activeMarket])

  return (
    <RightPanel
      isOpen={!!market}
      onClose={onClose}
      title={activeExchange ? activeExchange.name : (activeEvent ? activeEvent.title : (activeMarket?.title || 'Market'))}
      subtitle={
        activeExchange ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-[10px] font-mono uppercase tracking-wider",
              activeExchange.isOpen ? "text-emerald-400" : "text-gray-400"
            )}>
              {activeExchange.isOpen ? '● OPEN' : '● CLOSED'}
            </span>
            <span className="text-[10px] text-gray-400">
              {activeExchange.city}, {activeExchange.country}
            </span>
            <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-[10px] font-medium text-purple-300">
              {activeExchange.shortName}
            </span>
          </div>
        ) : (
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
            {(activeMarket as any)?.updatedAt && (
              <LatencyTag updatedAt={(activeMarket as any).updatedAt} size="sm" />
            )}
            {activeEvent && activeEvent.markets && (
              <span className="text-[10px] text-gray-400">
                {activeEvent.markets.length} {activeEvent.markets.length === 1 ? 'market' : 'markets'} in event
              </span>
            )}
          </div>
        )
      }
    >
      {/* Scroll anchor for when switching markets */}
      <div ref={panelTopRef} className="h-0" />

      {/* Exchange Details View */}
      {activeExchange && (
        <div className="px-4 pt-8 pb-4">
          {/* Exchange Header */}
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold text-white mb-2">{activeExchange.name}</h2>
            <div className="text-sm text-gray-400 mb-4">
              {activeExchange.city}, {activeExchange.country}
            </div>
            <div className={cn(
              "inline-block px-4 py-2 rounded-lg text-sm font-bold",
              activeExchange.isOpen
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                : "bg-gray-500/20 text-gray-300 border border-gray-500/50"
            )}>
              {activeExchange.isOpen ? 'Market Open' : 'Market Closed'}
            </div>
          </div>

          {/* Trading Information */}
          <div className="space-y-4 mb-6">
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-sm font-semibold text-white mb-3">Exchange Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Currency</span>
                  <span className="text-white font-semibold">{activeExchange.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Timezone</span>
                  <span className="text-white font-semibold">{activeExchange.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Region</span>
                  <span className="text-white font-semibold capitalize">{activeExchange.region?.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Major Indices */}
            {activeExchange.indices && Array.isArray(activeExchange.indices) && activeExchange.indices.length > 0 && (
              <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
                <h3 className="text-sm font-semibold text-white mb-3">Major Indices</h3>
                <div className="space-y-2">
                  {activeExchange.indices.map((index: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700/20 last:border-0">
                      <span className="text-sm text-gray-300">{index}</span>
                      <span className="text-sm text-gray-500">–</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External Link */}
            <a
              href={activeExchange.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg text-emerald-300 font-semibold transition-all"
            >
              Visit Exchange Website
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Top Movers Sections */}
          <div className="space-y-4">
            {/* Gainers */}
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Gainers
              </h3>
              {isLoadingMovers ? (
                <div className="text-center py-4 text-xs text-gray-400">Loading...</div>
              ) : gainers.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">No data available</div>
              ) : (
                <div className="space-y-2">
                  {gainers.map((stock, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700/20 last:border-0">
                      <div>
                        <div className="font-bold text-sm text-white">{stock.ticker}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{stock.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">${stock.price.toFixed(2)}</div>
                        <div className="text-xs font-bold text-emerald-400">+{stock.changePercent.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Losers */}
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Top Losers
              </h3>
              {isLoadingMovers ? (
                <div className="text-center py-4 text-xs text-gray-400">Loading...</div>
              ) : losers.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">No data available</div>
              ) : (
                <div className="space-y-2">
                  {losers.map((stock, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700/20 last:border-0">
                      <div>
                        <div className="font-bold text-sm text-white">{stock.ticker}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{stock.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">${stock.price.toFixed(2)}</div>
                        <div className="text-xs font-bold text-red-400">{stock.changePercent.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most Active */}
            <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30">
              <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Most Active
              </h3>
              {isLoadingMovers ? (
                <div className="text-center py-4 text-xs text-gray-400">Loading...</div>
              ) : mostActive.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">No data available</div>
              ) : (
                <div className="space-y-2">
                  {mostActive.map((stock, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700/20 last:border-0">
                      <div>
                        <div className="font-bold text-sm text-white">{stock.ticker}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{stock.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">${stock.price.toFixed(2)}</div>
                        <div className={cn(
                          "text-xs font-bold",
                          stock.changePercent >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1. Hero / Price Section (Gamified) */}
      {activeMarket && (
        <div className="px-4 pt-8 pb-4 relative overflow-hidden w-full max-w-full">
          {/* Compact Layout with Image on Side */}
          <div className="flex items-start gap-4 mb-4 w-full max-w-full">
            {/* Left: Price Section */}
            <div className="flex-1 text-center">
              {/* Show specific option if this is part of a multi-option event */}
              {activeMarket.rawData?.subtitle && (
                <div className="mb-3 inline-block px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                    {activeMarket.rawData.subtitle}
                  </span>
                </div>
              )}
              <span className="text-sm font-medium text-gray-400 mb-1 tracking-wide block">CHANCE</span>
              <div className={cn(
                "text-6xl font-black tracking-tighter tabular-nums mb-2",
                currentPrice >= 0.5 ? "text-[#00ff7f]" : "text-[#ff4d4d]" // Neon Green / Red
              )}>
                {Math.round(currentPrice * 100)}%
              </div>

              {/* Price Change - Calculated from history */}
              {priceChange.percentage !== 0 && (
                <div className={cn(
                  "inline-flex items-center gap-1.5 text-sm font-medium px-2 py-0.5 rounded-full",
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

            {/* Right: Compact Market Image */}
            <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-gray-700/50 shadow-lg relative">
              <Image
                src={activeMarket.imageUrl || (activeMarket as any).image || activeMarket.rawData?.image || activeMarket.rawData?.icon || activeMarket.rawData?.eventImage}
                alt={activeMarket.title}
                fill
                className="object-cover"
              />
            </div>

          </div>
        </div>
      )}

      {/* Multi-Outcome Display */}
      {activeMarket && Array.isArray(activeMarket.outcomes) && Array.isArray(activeMarket.outcomePrices) && activeMarket.outcomes.length > 2 && (
        <div className="px-4 mb-6 overflow-hidden">
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
      <div className="px-4 mb-4 relative group overflow-hidden w-full max-w-full">
        <div className="w-full h-[280px] relative overflow-hidden max-w-full">
          {/* Controls Bubble */}
          <div className="absolute top-2 right-2 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
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
            <div className="w-full h-full max-w-full overflow-hidden">
              <CandlestickChart data={candlesticks} />
            </div>
          ) : activeMarket?.priceHistory && activeMarket.priceHistory.length > 0 ? (
            <div className="w-full h-full max-w-full overflow-hidden">
              <MarketChart data={activeMarket.priceHistory} />
            </div>
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
      </div>

      {/* 3. Action Buttons (Gamified) */}
      {activeMarket && (
        <div className="px-4 mb-8 overflow-hidden w-full max-w-full">
          <div className="grid grid-cols-2 gap-3 w-full max-w-full">
            <Button
              className="h-12 bg-[#00ff7f] hover:bg-[#00cc66] text-black font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(0,255,127,0.2)] border-0 min-w-0 w-full"
              onClick={() => {
                const url = activeMarket.rawData?.url || (activeMarket.platform === 'polymarket' ? `https://polymarket.com/market/${activeMarket.slug || activeMarket.id}` : `https://kalshi.com/markets/${activeMarket.slug || activeMarket.ticker || activeMarket.id}`);
                window.open(url, '_blank');
              }}
            >
              <div className="flex items-center justify-between w-full px-2">
                <span>Yes</span>
                <span className="font-mono opacity-80">{Math.round(currentPrice * 100)}¢</span>
              </div>
            </Button>
            <Button
              className="h-12 bg-[#ff4d4d] hover:bg-[#cc0000] text-white font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(255,77,77,0.2)] border-0 min-w-0 w-full"
              onClick={() => {
                const url = activeMarket.rawData?.url || (activeMarket.platform === 'polymarket' ? `https://polymarket.com/market/${activeMarket.slug || activeMarket.id}` : `https://kalshi.com/markets/${activeMarket.slug || activeMarket.ticker || activeMarket.id}`);
                window.open(url, '_blank');
              }}
            >
              <div className="flex items-center justify-between w-full px-2">
                <span>No</span>
                <span className="font-mono opacity-80">{Math.round((1 - currentPrice) * 100)}¢</span>
              </div>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-3 mt-4 text-xs font-mono text-gray-500 w-full max-w-full overflow-hidden px-1 flex-wrap">
            <div className="flex flex-col items-center min-w-0">
              {isLoadingLiveVolume ? (
                <span className="text-gray-500 font-bold mb-0.5">...</span>
              ) : (
                <>
                  <span className={cn(
                    "font-bold mb-0.5 flex items-center gap-1 truncate",
                    liveVolume !== null ? "text-emerald-300" : "text-gray-300"
                  )}>
                    ${((liveVolume ?? activeMarket.volume24h) || 0).toLocaleString(undefined, { notation: 'compact' })}
                    {liveVolume !== null && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Live volume" />
                    )}
                  </span>
                  {liveVolume !== null && activeMarket.volume24h && (
                    <span className="text-[10px] text-gray-600 truncate">24h: ${activeMarket.volume24h.toLocaleString(undefined, { notation: 'compact' })}</span>
                  )}
                </>
              )}
              <span className="truncate">{liveVolume !== null ? 'LIVE VOL' : 'VOL'}</span>
            </div>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <div className="flex flex-col items-center min-w-0">
              <span className="text-gray-300 font-bold mb-0.5 truncate">${(activeMarket.liquidity || 0).toLocaleString(undefined, { notation: 'compact' })}</span>
              <span>LIQ</span>
            </div>
            {activeMarket.platform === 'polymarket' && (openInterest || isLoadingOI) && (
              <>
                <div className="w-px h-6 bg-white/10 flex-shrink-0" />
                <div className="flex flex-col items-center min-w-0">
                  {isLoadingOI ? (
                    <span className="text-gray-500 font-bold mb-0.5">...</span>
                  ) : openInterest ? (
                    <>
                      <span className="text-blue-300 font-bold mb-0.5 flex items-center gap-1 truncate">
                        ${openInterest.totalOI.toLocaleString(undefined, { notation: 'compact' })}
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" title="Open Interest" />
                      </span>
                      <span className="text-[10px] text-gray-600 truncate">
                        Y: ${openInterest.yesOI.toLocaleString(undefined, { notation: 'compact' })} |
                        N: ${openInterest.noOI.toLocaleString(undefined, { notation: 'compact' })}
                      </span>
                    </>
                  ) : null}
                  <span>OI</span>
                </div>
              </>
            )}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <div className="flex flex-col items-center min-w-0">
              <span className="text-gray-300 font-bold mb-0.5 truncate">
                {getEndDateString()}
              </span>
              <span>ENDS</span>
            </div>
          </div>
        </div>
      )}


      {/* 3.6. Related Markets in Same Event (fallback for non-event markets) */}
      {activeMarket && !activeEvent && relatedMarkets.length > 0 && (
        <div className="px-4 mb-6 overflow-hidden">
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide">Other Options</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {relatedMarkets.map((relMarket: any) => (
              <button
                key={relMarket.id}
                onClick={() => {
                  window.open(`https://polymarket.com/event/${relMarket.slug}`, '_blank')
                }}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">
                    {relMarket.optionName}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    ${(relMarket.volume || 0).toLocaleString(undefined, { notation: 'compact' })} vol
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "text-2xl font-black tabular-nums",
                    relMarket.price >= 0.5 ? "text-[#00ff7f]" : "text-[#ff4d4d]"
                  )}>
                    {Math.round(relMarket.price * 100)}%
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Details / Tweets Tabs */}
      {activeMarket && (
        <div className="px-4 w-full max-w-full overflow-hidden">
          <Tabs defaultValue="comments" className="w-full max-w-full">
            <TabsList className="w-full max-w-full bg-white/5 p-1 rounded-xl mb-4 border border-white/5 shrink-0 overflow-hidden">
              <TabsTrigger value="comments" className="flex-1 rounded-lg text-[10px] font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500 min-w-0 px-1 text-center break-words">
                {activeMarket.platform === 'polymarket' ? 'COMMENTS' : 'LATEST NEWS'}
              </TabsTrigger>
              {activeMarket.platform === 'polymarket' && (
                <TabsTrigger value="holders" className="flex-1 rounded-lg text-[10px] font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500 min-w-0 px-1 text-center break-words">
                  TOP HOLDERS
                </TabsTrigger>
              )}
              <TabsTrigger value="related" className="flex-1 rounded-lg text-[10px] font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500 min-w-0 px-1 text-center break-words">
                RELATED
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 rounded-lg text-[10px] font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-500 min-w-0 px-1 text-center break-words">
                MARKET INFO
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="mt-0 w-full overflow-hidden">
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : activeMarket.platform === 'polymarket' && comments.length > 0 ? (
                <>
                  {/* Sort Controls */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400 font-medium">
                      {comments.length} comment{comments.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg border border-white/5">
                      <button
                        onClick={() => setCommentSort('recent')}
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                          commentSort === 'recent' ? "bg-white/20 text-white" : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        RECENT
                      </button>
                      <button
                        onClick={() => setCommentSort('likes')}
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                          commentSort === 'likes' ? "bg-white/20 text-white" : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        TOP
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-hide w-full">
                    {[...comments]
                      .sort((a, b) => {
                        if (commentSort === 'likes') {
                          return (b.likes || 0) - (a.likes || 0)
                        }
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      })
                      .map((comment) => (
                        <div key={comment.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors w-full overflow-hidden">
                          <div className="flex items-center gap-2 mb-2">
                            {comment.user?.profile_image ? (
                              <div className="w-5 h-5 relative flex-shrink-0">
                                <Image
                                  src={comment.user.profile_image}
                                  alt={comment.user.username}
                                  fill
                                  className="rounded-full object-cover"
                                />
                              </div>
                            ) : (

                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-black flex-shrink-0">
                                {comment.user?.username?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <span className="text-xs font-bold text-gray-200 truncate max-w-[120px]">{comment.user?.username || 'Anonymous'}</span>
                            <span className="text-[10px] text-gray-500 ml-auto whitespace-nowrap">
                              {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed break-words whitespace-normal overflow-wrap-anywhere">
                            {comment.comment}
                          </p>
                          {(comment.likes > 0 || comment.replies_count > 0) && (
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                              {comment.likes > 0 && <span>❤️ {comment.likes}</span>}
                              {comment.replies_count > 0 && <span>💬 {comment.replies_count}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </>
              ) : hasArticles ? (
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
                <div className="text-center py-8 text-gray-500 text-xs">
                  No comments available yet
                </div>
              )}
            </TabsContent>

            {activeMarket.platform === 'polymarket' && (
              <TabsContent value="holders" className="mt-0 space-y-3 w-full overflow-hidden">
                {isLoadingHolders ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : topHolders.length > 0 ? (
                  <div className="space-y-2">
                    {topHolders.map((holder, idx) => {
                      const position = holder.outcome === 0 ? 'YES' : 'NO'
                      const positionColor = position === 'YES' ? 'text-[#00ff7f]' : 'text-[#ff4d4d]'
                      const positionBg = position === 'YES' ? 'bg-[#00ff7f]/10' : 'bg-[#ff4d4d]/10'
                      const amount = parseFloat(holder.amount || 0)
                      const username = holder.name || holder.pseudonym || 'Anonymous'
                      const profileImage = holder.profileImageOptimized || holder.profileImage

                      const profileUrl = `https://polymarket.com/profile/${encodeURIComponent(username)}`

                      return (
                        <a
                          key={idx}
                          href={profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {profileImage ? (
                                <div className="w-7 h-7 relative flex-shrink-0">
                                  <Image
                                    src={profileImage}
                                    alt={username}
                                    fill
                                    className="rounded-full object-cover"
                                  />
                                </div>
                              ) : (

                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white font-black">
                                  {username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="text-xs font-medium text-gray-200 truncate max-w-[180px] group-hover:text-blue-400 transition-colors">
                                  {username}
                                  {holder.verified && (
                                    <span className="ml-1 text-blue-400">✓</span>
                                  )}
                                </div>
                                <div className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider mt-0.5",
                                  positionColor
                                )}>
                                  {position} Position
                                </div>
                              </div>
                            </div>
                            <div className={cn(
                              "px-2 py-1 rounded-md text-xs font-bold",
                              positionBg,
                              positionColor
                            )}>
                              {position}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex flex-col">
                              <span className="text-gray-500 text-[10px] uppercase tracking-wide">Holdings</span>
                              <span className="text-gray-300 font-bold tabular-nums">
                                {amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} shares
                              </span>
                            </div>
                            {holder.proxyWallet && (
                              <div className="flex flex-col items-end">
                                <span className="text-gray-500 text-[10px] uppercase tracking-wide">Wallet</span>
                                <span className="text-gray-400 font-mono text-[10px]">
                                  {holder.proxyWallet.slice(0, 6)}...{holder.proxyWallet.slice(-4)}
                                </span>
                              </div>
                            )}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    No top holders data available
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="related" className="mt-0 w-full overflow-hidden">
              {isLoadingRelatedByTags ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : relatedMarketsByTags.length > 0 ? (
                <div
                  ref={relatedParentRef}
                  className="max-h-[500px] overflow-y-auto scrollbar-hide w-full"
                >
                  <div
                    style={{
                      height: `${relatedVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {relatedVirtualizer.getVirtualItems().map((virtualRow) => {
                      const market = relatedMarketsByTags[virtualRow.index]
                      return (
                        <div
                          key={market.id}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            paddingBottom: '8px', // Space between items
                          }}
                        >
                          <button
                            onClick={() => {
                              // Convert to full market format and select it
                              const fullMarket = {
                                id: market.id || market.conditionId,
                                title: market.title,
                                description: market.description || '',
                                platform: 'polymarket',
                                volume24h: market.volume24h || 0,
                                price: market.price || 0,
                                probability: market.price || 0,
                                slug: market.slug,
                                category: activeMarket?.category,
                                imageUrl: market.imageUrl,
                                endDate: market.endDate ? new Date(market.endDate) : undefined,
                                rawData: market,
                              }
                              setActiveMarket(fullMarket as MarketDetailsType)
                              setActiveEvent(null)
                            }}
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 transition-all group h-full"
                          >
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-sm font-medium text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-2">
                                {market.title}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                ${(market.volume24h || 0).toLocaleString(undefined, { notation: 'compact' })} vol
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                              <div className={cn(
                                "text-2xl font-black tabular-nums",
                                (market.price || 0) >= 0.5 ? "text-[#00ff7f]" : "text-[#ff4d4d]"
                              )}>
                                {Math.round((market.price || 0) * 100)}%
                              </div>
                              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No related markets found
                </div>
              )}
            </TabsContent>

            <TabsContent value="info" className="mt-0 w-full overflow-hidden">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 w-full max-w-full overflow-hidden">
                <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide">Description</h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4 break-words overflow-wrap-anywhere max-w-full">
                  {activeMarket.description || 'No description available for this market.'}
                </p>

                <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wide mt-4">Resolution Source</h4>
                <a
                  href={activeMarket.rawData?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors w-fit"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{activeMarket.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'} Source</span>
                </a>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Market Options List - Show ALL markets in event BELOW the tabs */}
      {activeMarket && activeEvent && activeEvent.markets && Array.isArray(activeEvent.markets) && activeEvent.markets.length > 1 && (
        <div className="px-4 mb-6 mt-6 overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">All Markets in Event</h3>
            <span className="text-xs text-gray-500 font-mono">{activeEvent.markets.length} markets</span>
          </div>

          <div className="space-y-2">
            {activeEvent.markets
              .map((m: any, idx: number) => {
                const marketId = m.id || m.slug || m.ticker || String(idx)

                // Check if this is the currently active market
                const marketIds = [m.id, m.slug, m.ticker].filter(Boolean).map(id => String(id).toLowerCase())
                const activeMarketIds = [
                  activeMarket.id,
                  activeMarket.slug,
                  activeMarket.ticker,
                ].filter(Boolean).map(id => String(id).toLowerCase())
                const isActive = marketIds.some(mid => activeMarketIds.includes(mid))

                const marketPrice = m.price || 0
                const marketVolume = m.volume24h || 0

                return (
                  <button
                    key={marketId}
                    onClick={() => {
                      // Switch to this market
                      const fullMarket = {
                        id: m.id,
                        title: m.title,
                        description: m.description || '',
                        platform: activeEvent.platform,
                        volume24h: m.volume24h || 0,
                        price: m.price || 0,
                        probability: m.price || 0,
                        slug: m.slug || m.id,
                        ticker: m.ticker || '',
                        category: activeEvent.category,
                        imageUrl: m.imageUrl,
                        endDate: m.endDate ? (typeof m.endDate === 'string' ? new Date(m.endDate) : m.endDate) : undefined,
                        rawData: m.rawData || {},
                        tags: m.tags || m.rawData?.tags || activeEvent.tags || [],
                      }
                      setActiveMarket(fullMarket as MarketDetailsType)
                      // Scroll to top of panel to show the chart
                      setTimeout(() => {
                        panelTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 100)
                    }}
                    className={cn(
                      "w-full bg-gray-800/40 rounded-lg border transition-all hover:border-gray-600/50 cursor-pointer text-left",
                      isActive ? "border-blue-500/50 bg-blue-500/10" : "border-gray-700/30"
                    )}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Market Name and Volume */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={cn(
                              "text-sm font-semibold line-clamp-1",
                              isActive ? "text-blue-300" : "text-white"
                            )}>
                              {m.title || m.question}
                            </h4>
                            {isActive && (
                              <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[9px] font-bold text-blue-300 uppercase flex-shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            ${marketVolume.toLocaleString(undefined, { notation: 'compact' })} Vol.
                          </div>
                        </div>

                        {/* Right: Probability */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className={cn(
                              "text-2xl font-black tabular-nums",
                              marketPrice >= 0.5 ? "text-[#00ff7f]" : "text-[#ff4d4d]"
                            )}>
                              {Math.round(marketPrice * 100)}%
                            </div>
                          </div>
                          <ChevronDown className={cn(
                            "w-4 h-4 transition-transform",
                            isActive ? "rotate-180 text-blue-400" : "text-gray-500"
                          )} />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </RightPanel>
  )
}
