import { Market as AppMarket, MarketDetails } from '@/types/market'

/**
 * Public Kalshi API Client - No authentication required
 * Uses Kalshi's public endpoints at https://api.elections.kalshi.com/trade-api/v2
 *
 * This client can fetch market data without API keys, perfect for read-only access.
 * For trading operations, use the authenticated KalshiClient instead.
 */
export class PublicKalshiClient {
  private baseUrl: string

  constructor(useDemo: boolean = false) {
    // Use the correct API endpoint
    // Production: https://api.elections.kalshi.com/trade-api/v2
    // Demo: https://demo-api.kalshi.com/trade-api/v2
    this.baseUrl = useDemo
      ? 'https://demo-api.kalshi.com/trade-api/v2'
      : 'https://api.elections.kalshi.com/trade-api/v2'

    console.log('[Public Kalshi Client] Initialized without authentication for read-only access')
  }

  async getMarkets(params?: {
    limit?: number
    cursor?: string
    event_ticker?: string
    series_ticker?: string
    search?: string
    status?: string
  }): Promise<{ markets: AppMarket[]; nextCursor?: string }> {
    try {
      console.log('[Public Kalshi Client] Fetching markets with params:', params)

      // Build query parameters
      const queryParams = new URLSearchParams()

      // Enhance search: If searching, fetch MAX limit (1000) to ensure we scan the whole catalog
      const isSearch = !!params?.search
      const fetchLimit = isSearch ? 1000 : (params?.limit || 100)

      queryParams.append('limit', fetchLimit.toString())

      if (params?.cursor) queryParams.append('cursor', params.cursor)
      if (params?.event_ticker) queryParams.append('event_ticker', params.event_ticker)
      if (params?.series_ticker) queryParams.append('series_ticker', params.series_ticker)
      if (params?.status) queryParams.append('status', params.status)

      const url = `${this.baseUrl}/markets?${queryParams.toString()}`
      console.log('[Public Kalshi Client] Fetching from:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('[Public Kalshi Client] HTTP error:', response.status, response.statusText)
        return { markets: [], nextCursor: undefined }
      }

      const data = await response.json()
      const markets = data.markets || []
      console.log(`[Public Kalshi Client] Received ${markets.length} raw markets from API`)

      // Log sample market structure for debugging
      if (markets.length > 0) {
        const sample = markets[0]
        console.log('[Public Kalshi Client] Sample market structure:', {
          ticker: sample.ticker,
          title: sample.title,
          last_price: sample.last_price,
          yes_bid: sample.yes_bid,
          yes_ask: sample.yes_ask,
          status: sample.status,
        })
      }

      const transformed = this.transformMarkets(markets)
      console.log(`[Public Kalshi Client] Transformed to ${transformed.length} valid markets`)

      // Apply search filter if provided
      let filtered = transformed
      if (params?.search) {
        const searchLower = params.search.toLowerCase()
        filtered = transformed.filter(m =>
          m.title.toLowerCase().includes(searchLower) ||
          m.description?.toLowerCase().includes(searchLower) ||
          m.category?.toLowerCase().includes(searchLower)
        )
        console.log(`[Public Kalshi Client] Filtered by search "${params.search}": ${filtered.length} markets`)
      }

      // Get next cursor from response
      const nextCursor = data.cursor || undefined

      return {
        markets: filtered,
        nextCursor,
      }
    } catch (error: any) {
      console.error('[Public Kalshi Client] Error fetching markets:', error.message || error)
      return { markets: [], nextCursor: undefined }
    }
  }

  /**
   * Fetch a single market by ticker
   */
  async getMarket(ticker: string): Promise<AppMarket | null> {
    try {
      const url = `${this.baseUrl}/markets/${ticker}`
      console.log('[Public Kalshi Client] Fetching market:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('[Public Kalshi Client] HTTP error:', response.status)
        return null
      }

      const data = await response.json()
      return this.transformMarket(data.market)
    } catch (error) {
      console.error('[Public Kalshi Client] Error fetching market:', error)
      return null
    }
  }

  private transformMarkets(markets: any[]): AppMarket[] {
    const now = new Date()
    const filterReasons: Record<string, number> = {}

    const transformed = markets
      .map(m => this.transformMarket(m))
      .filter(m => {
        // Filter out expired markets (more lenient - allow markets expiring soon)
        if (m.endDate) {
          const endDate = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
          // Only exclude markets that expired more than 7 days ago
          if (endDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
            filterReasons['expired'] = (filterReasons['expired'] || 0) + 1
            return false
          }
        }

        // Filter out resolved/closed markets
        const rawMarket = m.rawData
        const isResolved = rawMarket?.status === 'settled' || rawMarket?.status === 'closed' || rawMarket?.closed === true

        if (isResolved) {
          filterReasons['resolved'] = (filterReasons['resolved'] || 0) + 1
          return false
        }

        // Only filter out prices that are completely invalid (outside 0-1 range)
        if (m.price !== undefined && m.price !== null) {
          if (m.price < 0 || m.price > 1) {
            filterReasons['invalid_price_range'] = (filterReasons['invalid_price_range'] || 0) + 1
            return false
          }
        }

        return true
      })

    if (Object.keys(filterReasons).length > 0) {
      console.log(`[Public Kalshi Client] Filtered out ${markets.length - transformed.length} markets:`, filterReasons)
    }

    return transformed.sort((a, b) => {
      // Sort by volume (highest first)
      if (a.volume24h && b.volume24h) {
        return b.volume24h - a.volume24h
      }
      if (a.volume24h) return -1
      if (b.volume24h) return 1
      return 0
    })
  }

  private transformMarket(market: any): AppMarket {
    let endDate: Date | undefined

    // Handle expiration time
    if (market.expiration_time) {
      endDate = new Date(market.expiration_time)
    } else if (market.close_time) {
      endDate = new Date(market.close_time)
    }

    // Handle price - Kalshi returns prices in cents (0-100), convert to 0-1
    let price: number | undefined
    if (market.last_price !== undefined && market.last_price !== null) {
      price = market.last_price / 100
    } else if (market.yes_bid !== undefined && market.yes_bid !== null) {
      price = market.yes_bid / 100
    } else if (market.yes_ask !== undefined && market.yes_ask !== null) {
      price = market.yes_ask / 100
    }

    // Get title
    const title = market.title || market.subtitle || 'Untitled Market'

    return {
      id: market.ticker || market.id,
      platform: 'kalshi',
      title: title,
      description: market.subtitle || '',
      category: market.category || 'Uncategorized',
      probability: price,
      price: price,
      volume24h: market.volume_24h || market.volume || 0,
      liquidity: market.open_interest || 0,
      endDate: endDate,
      ticker: market.ticker,
      slug: market.series_ticker || market.event_ticker,
      rawData: market,
    }
  }
}
