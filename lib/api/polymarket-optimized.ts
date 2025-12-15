/**
 * Optimized Polymarket API Client
 * 
 * API Endpoints Used:
 * - Gamma API (https://gamma-api.polymarket.com): Market metadata, events, tags
 * - CLOB API (https://clob.polymarket.com): Order books, prices, trading
 * - Data API (https://data-api.polymarket.com): Comments, trades, positions, holders
 * 
 * Optimization Strategy:
 * 1. Use Gamma API for bulk market fetching (supports pagination, filtering)
 * 2. Use CLOB API for real-time prices and order books
 * 3. Use Data API for social features (comments, trades, whale tracking)
 * 4. Batch requests where possible to reduce API calls
 * 5. Cache responses appropriately
 */

import { Market, MarketDetails, EventData, Candlestick, PricePoint } from '@/types/market'

// API Base URLs
const GAMMA_API = 'https://gamma-api.polymarket.com'
const CLOB_API = 'https://clob.polymarket.com'
const DATA_API = 'https://data-api.polymarket.com'

// Types for API responses
interface GammaMarket {
  id: number
  question: string
  conditionId: string
  slug: string
  description?: string
  outcomes: string[]
  outcomePrices: string // JSON string like '["0.65", "0.35"]'
  volume: number
  volume24hr: number
  volumeNum: number
  liquidity: number
  liquidityNum: number
  endDateIso?: string
  startDate?: string
  category?: string
  closed: boolean
  archived: boolean
  active: boolean
  clobTokenIds?: string[]
  enableOrderBook: boolean
  acceptingOrders: boolean
  negRisk: boolean
  negRiskMarketId?: string
  negRiskRequestId?: string
}

interface GammaEvent {
  id: number
  slug: string
  title: string
  description?: string
  markets: GammaMarket[]
  startDate?: string
  endDate?: string
  category?: string
  volume: number
  liquidity: number
}

export interface PolymarketComment {
  id: string
  conditionId: string
  content: string
  createdAt: string
  parentId?: string
  profileId: string
  username?: string
  profileImage?: string
  likes: number
  repliesCount: number
}

export interface PolymarketTrade {
  id: string
  taker_order_id: string
  market: string
  asset_id: string
  side: 'BUY' | 'SELL'
  size: string
  fee_rate_bps: string
  price: string
  status: string
  match_time: string
  last_update: string
  outcome: string
  bucket_index: number
  owner: string
  maker_address: string
  transaction_hash: string
  trader_side: string
}


export class PolymarketOptimizedClient {
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheTTL = 30000 // 30 seconds default cache

  /**
   * Fetch ALL markets from Gamma API with pagination
   * This is the most efficient way to get market metadata
   */
  async fetchAllMarkets(options?: {
    limit?: number
    offset?: number
    closed?: boolean
    active?: boolean
    order?: 'volume' | 'liquidity' | 'startDate' | 'endDate'
    ascending?: boolean
    tag?: string
    slug?: string
  }): Promise<{ markets: Market[]; total: number; hasMore: boolean }> {
    const url = new URL(`${GAMMA_API}/markets`)
    
    // Default to fetching open, active markets sorted by volume
    url.searchParams.set('limit', String(options?.limit || 500))
    url.searchParams.set('offset', String(options?.offset || 0))
    url.searchParams.set('closed', String(options?.closed ?? false))
    url.searchParams.set('order', options?.order || 'volume')
    url.searchParams.set('ascending', String(options?.ascending ?? false))
    
    if (options?.active !== undefined) {
      url.searchParams.set('active', String(options.active))
    }
    if (options?.tag) {
      url.searchParams.set('tag', options.tag)
    }
    if (options?.slug) {
      url.searchParams.set('slug', options.slug)
    }

    console.log(`[Polymarket Optimized] Fetching markets: ${url.toString()}`)

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) {
        console.error(`[Polymarket Optimized] API error: ${response.status}`)
        return { markets: [], total: 0, hasMore: false }
      }

      const data: GammaMarket[] = await response.json()
      
      if (!Array.isArray(data)) {
        return { markets: [], total: 0, hasMore: false }
      }

      const markets = data
        .filter(m => m.conditionId && m.question && !m.archived)
        .map(m => this.transformGammaMarket(m))
        .filter((m): m is Market => m !== null)

      console.log(`[Polymarket Optimized] Fetched ${markets.length} markets`)

      return {
        markets,
        total: markets.length,
        hasMore: data.length === (options?.limit || 500)
      }
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching markets:', error)
      return { markets: [], total: 0, hasMore: false }
    }
  }

  /**
   * Fetch events (grouped markets) from Gamma API
   * Events contain multiple related markets
   */
  async fetchEvents(options?: {
    limit?: number
    offset?: number
    slug?: string
    active?: boolean
  }): Promise<GammaEvent[]> {
    const url = new URL(`${GAMMA_API}/events`)
    
    url.searchParams.set('limit', String(options?.limit || 100))
    url.searchParams.set('offset', String(options?.offset || 0))
    
    if (options?.slug) {
      url.searchParams.set('slug', options.slug)
    }
    if (options?.active !== undefined) {
      url.searchParams.set('active', String(options.active))
    }

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) return []
      return response.json()
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching events:', error)
      return []
    }
  }

  /**
   * Get market by slug - efficient single market lookup
   */
  async getMarketBySlug(slug: string): Promise<Market | null> {
    const url = new URL(`${GAMMA_API}/markets`)
    url.searchParams.set('slug', slug)
    url.searchParams.set('limit', '1')

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) return null
      
      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return null
      
      return this.transformGammaMarket(data[0])
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching market by slug:', error)
      return null
    }
  }

  /**
   * Get market by condition ID
   */
  async getMarketByConditionId(conditionId: string): Promise<Market | null> {
    const url = new URL(`${GAMMA_API}/markets`)
    url.searchParams.set('conditionId', conditionId)
    url.searchParams.set('limit', '1')

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) return null
      
      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return null
      
      return this.transformGammaMarket(data[0])
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching market by conditionId:', error)
      return null
    }
  }


  /**
   * Batch fetch prices from CLOB API
   * More efficient than individual requests
   */
  async getBatchPrices(tokenIds: string[]): Promise<Record<string, number>> {
    if (tokenIds.length === 0) return {}

    try {
      const response = await fetch(`${CLOB_API}/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenIds)
      })

      if (!response.ok) return {}
      
      const data = await response.json()
      const prices: Record<string, number> = {}
      
      for (const [tokenId, priceData] of Object.entries(data)) {
        if (priceData && typeof (priceData as any).price === 'number') {
          prices[tokenId] = (priceData as any).price
        }
      }
      
      return prices
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching batch prices:', error)
      return {}
    }
  }

  /**
   * Get order book summary for a market
   */
  async getOrderBookSummary(tokenId: string): Promise<{
    spread: number
    bestBid: number
    bestAsk: number
    bidDepth: number
    askDepth: number
  } | null> {
    try {
      const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`, {
        headers: { 'Accept': 'application/json' }
      })

      if (!response.ok) return null
      
      const data = await response.json()
      
      const bids = data.bids || []
      const asks = data.asks || []
      
      const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0
      const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 1
      
      const bidDepth = bids.reduce((sum: number, b: any) => sum + parseFloat(b.size), 0)
      const askDepth = asks.reduce((sum: number, a: any) => sum + parseFloat(a.size), 0)
      
      return {
        spread: bestAsk - bestBid,
        bestBid,
        bestAsk,
        bidDepth,
        askDepth
      }
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching order book:', error)
      return null
    }
  }

  /**
   * Fetch comments for a market from Data API
   */
  async getComments(conditionId: string, options?: {
    limit?: number
    offset?: number
  }): Promise<PolymarketComment[]> {
    const url = new URL(`${DATA_API}/comments`)
    url.searchParams.set('asset_id', conditionId)
    url.searchParams.set('limit', String(options?.limit || 20))
    url.searchParams.set('offset', String(options?.offset || 0))

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) {
        console.error(`[Polymarket Optimized] Comments API error: ${response.status}`)
        return []
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching comments:', error)
      return []
    }
  }

  /**
   * Fetch recent trades for a market
   */
  async getTrades(options?: {
    market?: string
    maker?: string
    limit?: number
    before?: string
    after?: string
  }): Promise<PolymarketTrade[]> {
    const url = new URL(`${DATA_API}/trades`)
    
    if (options?.market) url.searchParams.set('market', options.market)
    if (options?.maker) url.searchParams.set('maker', options.maker)
    if (options?.limit) url.searchParams.set('limit', String(options.limit))
    if (options?.before) url.searchParams.set('before', options.before)
    if (options?.after) url.searchParams.set('after', options.after)

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) return []
      
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching trades:', error)
      return []
    }
  }

  /**
   * Fetch price history for charts
   */
  async getPriceHistory(tokenId: string, options?: {
    interval?: '1m' | '5m' | '1h' | '6h' | '1d'
    fidelity?: number
    startTs?: number
    endTs?: number
  }): Promise<PricePoint[]> {
    const now = Math.floor(Date.now() / 1000)
    const interval = options?.interval || '1h'
    
    // Calculate time range based on interval
    let startTs = options?.startTs
    let fidelity = options?.fidelity
    
    if (!startTs || !fidelity) {
      switch (interval) {
        case '1m':
          startTs = now - 3600 // 1 hour
          fidelity = 60
          break
        case '5m':
          startTs = now - 6 * 3600 // 6 hours
          fidelity = 300
          break
        case '1h':
          startTs = now - 24 * 3600 // 1 day
          fidelity = 3600
          break
        case '6h':
          startTs = now - 7 * 24 * 3600 // 1 week
          fidelity = 6 * 3600
          break
        case '1d':
        default:
          startTs = now - 30 * 24 * 3600 // 30 days
          fidelity = 24 * 3600
          break
      }
    }

    const url = `${DATA_API}/prices-history?market=${tokenId}&startTs=${startTs}&endTs=${options?.endTs || now}&fidelity=${fidelity}`

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) {
        console.error(`[Polymarket Optimized] Price history failed: ${response.status} ${response.statusText}`)
        return []
      }
      
      const data = await response.json()
      
      if (data?.history && Array.isArray(data.history)) {
        return data.history.map((point: any) => ({
          timestamp: new Date(point.t * 1000),
          price: point.p,
          volume: point.v || 0
        }))
      }
      
      return []
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching price history:', error)
      return []
    }
  }


  /**
   * Get top holders (whales) for a market
   */
  async getTopHolders(conditionId: string, limit = 50): Promise<Array<{
    address: string
    position: number
    outcome: string
    value: number
  }>> {
    const url = new URL(`${DATA_API}/positions`)
    url.searchParams.set('market', conditionId)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('sortBy', 'SIZE')
    url.searchParams.set('sortDirection', 'DESC')

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) return []
      
      const data = await response.json()
      return Array.isArray(data) ? data.map((p: any) => ({
        address: p.proxyWallet || p.owner,
        position: parseFloat(p.size || '0'),
        outcome: p.outcome,
        value: parseFloat(p.currentValue || '0')
      })) : []
    } catch (error) {
      console.error('[Polymarket Optimized] Error fetching holders:', error)
      return []
    }
  }

  /**
   * Transform Gamma API market to our Market type
   */
  private transformGammaMarket(market: GammaMarket): Market | null {
    if (!market.conditionId || !market.question) return null

    // Parse outcome prices
    let price: number | undefined
    let outcomePrices: number[] = []

    if (market.outcomePrices) {
      try {
        const prices = typeof market.outcomePrices === 'string'
          ? JSON.parse(market.outcomePrices)
          : market.outcomePrices

        if (Array.isArray(prices)) {
          outcomePrices = prices.map((p: any) => parseFloat(String(p)))
          price = outcomePrices[0] // First outcome (usually "Yes")
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Validate price
    if (price !== undefined && (price < 0 || price > 1 || isNaN(price))) {
      price = undefined
    }

    return {
      id: market.conditionId,
      platform: 'polymarket',
      title: market.question,
      description: market.description || '',
      category: market.category,
      normalizedCategory: market.category,
      price,
      probability: price,
      volume24h: market.volume24hr || market.volumeNum || 0,
      liquidity: market.liquidityNum || market.liquidity || 0,
      endDate: market.endDateIso ? new Date(market.endDateIso) : undefined,
      slug: market.slug,
      outcomes: market.outcomes || ['Yes', 'No'],
      outcomePrices: outcomePrices.length > 0 ? outcomePrices : undefined,
      rawData: {
        ...market,
        numericId: market.id,
        clobTokenIds: market.clobTokenIds,
        enableOrderBook: market.enableOrderBook,
        acceptingOrders: market.acceptingOrders,
        negRisk: market.negRisk,
        negRiskMarketId: market.negRiskMarketId
      }
    }
  }

  /**
   * Index all markets for database storage
   * Fetches markets in batches and yields them for processing
   */
  async *indexAllMarkets(batchSize = 500): AsyncGenerator<Market[], void, unknown> {
    let offset = 0
    let hasMore = true
    let totalFetched = 0

    console.log('[Polymarket Optimized] Starting full market index...')

    while (hasMore) {
      const result = await this.fetchAllMarkets({
        limit: batchSize,
        offset,
        closed: false,
        order: 'volume',
        ascending: false
      })

      if (result.markets.length === 0) {
        hasMore = false
        break
      }

      totalFetched += result.markets.length
      console.log(`[Polymarket Optimized] Indexed ${totalFetched} markets so far...`)

      yield result.markets

      offset += batchSize
      hasMore = result.hasMore

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`[Polymarket Optimized] Indexing complete. Total: ${totalFetched} markets`)
  }

  /**
   * Get market details with all enriched data
   */
  async getMarketDetails(conditionId: string): Promise<MarketDetails | null> {
    const market = await this.getMarketByConditionId(conditionId)
    if (!market) return null

    // Fetch additional data in parallel
    const tokenId = market.rawData?.clobTokenIds?.[0] || conditionId
    
    const [priceHistory, comments, orderBook] = await Promise.all([
      this.getPriceHistory(tokenId, { interval: '1h' }),
      this.getComments(conditionId, { limit: 10 }),
      this.getOrderBookSummary(tokenId)
    ])

    return {
      ...market,
      priceHistory,
      orderBook: orderBook ? {
        bids: [{ price: orderBook.bestBid, quantity: orderBook.bidDepth }],
        asks: [{ price: orderBook.bestAsk, quantity: orderBook.askDepth }]
      } : undefined,
      rawData: {
        ...market.rawData,
        comments,
        orderBookSummary: orderBook
      }
    }
  }
}

// Export singleton instance
export const polymarketClient = new PolymarketOptimizedClient()
