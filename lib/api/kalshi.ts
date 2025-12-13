import { Configuration, MarketApi, PortfolioApi, OrdersApi, Market } from 'kalshi-typescript'
import crypto from 'crypto'
import { Market as AppMarket, MarketDetails } from '@/types/market'

interface KalshiCredentials {
  accessKeyId: string
  privateKey: string
}

export class KalshiClient {
  private marketApi: MarketApi
  private portfolioApi: PortfolioApi
  private ordersApi: OrdersApi

  constructor(credentials: KalshiCredentials, useDemo: boolean = false) {
    // Normalize private key - handle both RSA and PKCS#8 formats
    let normalizedPrivateKey = credentials.privateKey.trim()

    // If it's RSA format, we'll let the SDK handle it (it should support both)
    // But ensure proper line breaks are preserved
    if (!normalizedPrivateKey.includes('\n') && normalizedPrivateKey.length > 100) {
      // If it's all on one line, try to format it (though this is less ideal)
      console.warn('[Kalshi] Private key appears to be on a single line. Ensure proper PEM format.')
    }

    // Use the correct API endpoint
    // Production: https://api.elections.kalshi.com/trade-api/v2
    // Demo: https://demo-api.kalshi.com/trade-api/v2
    const basePath = useDemo
      ? 'https://demo-api.kalshi.com/trade-api/v2'
      : 'https://api.elections.kalshi.com/trade-api/v2'

    const config = new Configuration({
      basePath,
      apiKey: credentials.accessKeyId,
      privateKeyPem: normalizedPrivateKey,
    })

    console.log('[Kalshi Client] Initializing with:', {
      basePath,
      hasApiKey: !!credentials.accessKeyId,
      hasPrivateKey: !!normalizedPrivateKey,
      privateKeyFormat: normalizedPrivateKey.includes('BEGIN RSA PRIVATE KEY') ? 'RSA' : 'PKCS#8',
    })

    this.marketApi = new MarketApi(config)
    this.portfolioApi = new PortfolioApi(config)
    this.ordersApi = new OrdersApi(config)
  }

  async getMarkets(params?: {
    limit?: number
    cursor?: string
    event_ticker?: string
    series_ticker?: string
    search?: string
  }): Promise<{ markets: AppMarket[]; nextCursor?: string }> {
    try {
      console.log('[Kalshi Client] Fetching markets with params:', params)


      // Enhance search: If searching, fetch MAX limit (1000) to ensure we scan the whole catalog
      // otherwise we only scan the first 100 random markets and likely miss the search term.
      const isSearch = !!params?.search;
      const fetchLimit = isSearch ? 1000 : (params?.limit || 100);

      const response = await this.marketApi.getMarkets(
        fetchLimit,
        params?.cursor,
        params?.event_ticker,
        params?.series_ticker
      )

      const markets = response.data?.markets || []
      console.log(`[Kalshi Client] Received ${markets.length} raw markets from API`)

      // Log sample market structure for debugging
      if (markets.length > 0) {
        const sample = markets[0]
        console.log('[Kalshi Client] Sample market structure:', {
          ticker: sample.ticker,
          title: sample.title,
          last_price: sample.last_price,
          price: sample.price,
          yes_bid: sample.yes_bid,
          yes_ask: sample.yes_ask,
          expiration_time: sample.expiration_time,
          category: sample.category,
          status: sample.status,
          keys: Object.keys(sample).slice(0, 15), // First 15 keys
        })
      }

      const transformed = this.transformMarkets(markets)
      console.log(`[Kalshi Client] Transformed to ${transformed.length} valid markets (filtered out ${markets.length - transformed.length})`)

      // Apply search filter if provided
      let filtered = transformed
      if (params?.search) {
        const searchLower = params.search.toLowerCase()
        filtered = transformed.filter(m =>
          m.title.toLowerCase().includes(searchLower) ||
          m.description?.toLowerCase().includes(searchLower) ||
          m.category?.toLowerCase().includes(searchLower)
        )
        console.log(`[Kalshi Client] Filtered by search "${params.search}": ${filtered.length} markets`)
      }

      // Get next cursor from response
      const nextCursor = response.data?.cursor || undefined

      return {
        markets: filtered,
        nextCursor,
      }
    } catch (error: any) {
      console.error('[Kalshi Client] Error fetching markets:', error.message || error)
      console.error('[Kalshi Client] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        stack: error.stack,
      })

      // Provide more specific error information
      if (error.response?.status === 401) {
        console.error('[Kalshi Client] Authentication failed - check API key ID and private key')
      } else if (error.response?.status === 403) {
        console.error('[Kalshi Client] Forbidden - check API key permissions')
      }

      return { markets: [], nextCursor: undefined }
    }
  }

  /**
   * Fetch a single market by ticker or URL
   * Supports:
   * - Direct ticker: "KXHIGHNY-25"
   * - Kalshi URL: "https://kalshi.com/markets/..."
   */
  async getMarketByUrl(urlOrTicker: string): Promise<AppMarket | null> {
    try {
      let ticker = urlOrTicker

      // Extract ticker from URL if it's a URL
      if (urlOrTicker.includes('kalshi.com')) {
        // Format: https://kalshi.com/markets/KXHIGHNY-25
        const url = new URL(urlOrTicker)
        const pathSegments = url.pathname.split('/').filter(Boolean)
        ticker = pathSegments[pathSegments.length - 1]
      }

      const response = await this.marketApi.getMarket(ticker)
      return this.transformMarket(response.data.market)
    } catch (error) {
      console.error('[Kalshi Client] Error fetching market by URL:', error)
      return null
    }
  }

  async getMarket(ticker: string): Promise<MarketDetails> {
    const response = await this.marketApi.getMarket(ticker)
    return this.transformMarketDetails(response.data.market)
  }

  async getPortfolio(): Promise<any> {
    const response = await this.portfolioApi.getBalance()
    return response.data
  }

  async createOrder(order: {
    ticker: string
    side: 'yes' | 'no'
    action: 'buy' | 'sell'
    count: number
    type: 'limit' | 'market'
    price?: number
  }): Promise<any> {
    const response = await this.ordersApi.createOrder({
      ticker: order.ticker,
      side: order.side === 'yes' ? 'yes' : 'no', // Ensure type match if needed
      action: order.action,
      count: order.count,
      type: order.type,
      yes_price: order.side === 'yes' ? order.price : undefined,
      no_price: order.side === 'no' ? order.price : undefined,
      client_order_id: crypto.randomUUID(), // Recommended to add client_order_id
    })
    return response.data
  }

  private transformMarkets(markets: any[]): AppMarket[] {
    const now = new Date()
    let filteredCount = 0
    const filterReasons: Record<string, number> = {}

    const transformed = markets
      .map(m => this.transformMarket(m))
      .filter(m => {
        // Filter out expired markets (but be more lenient - allow markets expiring soon)
        if (m.endDate) {
          const endDate = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
          // Only exclude markets that expired more than 7 days ago (more lenient)
          if (endDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
            filterReasons['expired'] = (filterReasons['expired'] || 0) + 1
            return false
          }
        }

        // Filter out markets with invalid prices (resolved markets)
        // But allow markets without prices (they might be new or inactive)
        const rawMarket = m.rawData
        const isResolved = rawMarket?.status === 'resolved' || rawMarket?.status === 'closed' || rawMarket?.closed === true

        // If market is explicitly resolved, filter it out
        if (isResolved) {
          filterReasons['resolved'] = (filterReasons['resolved'] || 0) + 1
          return false
        }

        // Only filter out prices that are completely invalid (outside 0-1 range)
        // Allow prices of 0 or 1 for active markets (they might be new or have extreme probabilities)
        if (m.price !== undefined && m.price !== null) {
          if (m.price < 0 || m.price > 1) {
            filterReasons['invalid_price_range'] = (filterReasons['invalid_price_range'] || 0) + 1
            return false
          }
        }
        // Allow markets without prices - they might be new or inactive but still valid

        // Don't filter by year in title - too aggressive
        // Markets might be about future events

        return true
      })

    if (filteredCount > 0 || Object.keys(filterReasons).length > 0) {
      console.log(`[Kalshi Client] Filtered out ${markets.length - transformed.length} markets:`, filterReasons)
    }

    return transformed
      .sort((a, b) => {
        // Sort by end date (most recent first)
        if (a.endDate && b.endDate) {
          const aDate = a.endDate instanceof Date ? a.endDate : new Date(a.endDate)
          const bDate = b.endDate instanceof Date ? b.endDate : new Date(b.endDate)
          return bDate.getTime() - aDate.getTime()
        }
        if (a.endDate) return -1
        if (b.endDate) return 1
        // Then by volume
        if (a.volume24h && b.volume24h) {
          return b.volume24h - a.volume24h
        }
        return 0
      })
  }

  private transformMarket(market: any): AppMarket {
    const now = new Date()
    let endDate: Date | undefined

    // Handle different possible field names for expiration
    // Kalshi API uses: expiration_time (ISO string)
    if (market.expiration_time) {
      endDate = new Date(market.expiration_time)
    } else if (market.expirationTime) {
      endDate = new Date(market.expirationTime)
    } else if (market.expires_at) {
      endDate = new Date(market.expires_at)
    } else if (market.expirationTimeMs) {
      endDate = new Date(market.expirationTimeMs)
    }

    // Handle price - Kalshi returns prices in cents (0-100), convert to 0-1
    // Check multiple possible field names
    let price: number | undefined
    if (market.last_price !== undefined && market.last_price !== null) {
      price = market.last_price / 100
    } else if (market.lastPrice !== undefined && market.lastPrice !== null) {
      price = market.lastPrice / 100
    } else if (market.yes_bid !== undefined && market.yes_bid !== null) {
      // Use yes bid price if available (in cents, 0-100)
      price = market.yes_bid / 100
    } else if (market.yes_ask !== undefined && market.yes_ask !== null) {
      // Use yes ask price as fallback
      price = market.yes_ask / 100
    } else if (market.price !== undefined && market.price !== null) {
      // If already in 0-1 format
      price = market.price > 1 ? market.price / 100 : market.price
    }

    // Debug: log if price is still undefined (only log first few to avoid spam)
    if (price === undefined) {
      const debugKey = `no_price_${market.ticker}`
      if (!(globalThis as any).__kalshiPriceDebug || (globalThis as any).__kalshiPriceDebug[debugKey]) {
        if (!(globalThis as any).__kalshiPriceDebug) {
          (globalThis as any).__kalshiPriceDebug = {}
        }
        (globalThis as any).__kalshiPriceDebug[debugKey] = true
        console.log('[Kalshi Client] Market without price:', {
          ticker: market.ticker,
          title: market.title?.substring(0, 50),
          availableFields: Object.keys(market).filter(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('bid') || k.toLowerCase().includes('ask')),
        })
      }
    }

    // Get title - Kalshi uses 'title' field
    const title = market.title || market.subtitle || market.question || market.event_ticker || 'Untitled Market'

    return {
      id: market.ticker || market.event_ticker || market.id,
      platform: 'kalshi',
      title: title,
      description: market.description || market.subtitle || '',
      category: market.category || market.category_name || market.series_ticker || 'Uncategorized',
      probability: price,
      price: price,
      volume24h: market.volume_24h || market.volume24h || market.volume || 0,
      liquidity: market.liquidity || 0,
      endDate: endDate,
      ticker: market.ticker || undefined,
      rawData: market,
    }
  }

  private transformMarketDetails(market: any): MarketDetails {
    const base = this.transformMarket(market)
    return {
      ...base,
      priceHistory: market.price_history?.map((p: any) => ({
        timestamp: new Date(p.timestamp),
        price: p.price / 100,
        volume: p.volume || 0,
      })),
      orderBook: market.orderbook ? {
        bids: market.orderbook.bids?.map((b: any) => ({
          price: b.price / 100,
          quantity: b.count,
        })) || [],
        asks: market.orderbook.asks?.map((a: any) => ({
          price: a.price / 100,
          quantity: a.count,
        })) || [],
      } : undefined,
    }
  }
}

