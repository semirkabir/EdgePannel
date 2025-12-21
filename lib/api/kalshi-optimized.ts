/**
 * Optimized Kalshi Client - Public API Access (matching Polymarket Client structure)
 *
 * Kalshi public endpoints that don't require authentication:
 * - GET /markets - List all markets (public)
 * - GET /events - List all events (public)
 * - GET /markets/{ticker} - Get market details (public)
 */

import { Market } from '@/types/market'

interface KalshiRawMarket {
  ticker: string
  title: string
  status: string
  last_price?: number
  yes_bid?: number
  yes_ask?: number
  volume?: number
  close_time?: string
  expiration_time?: string
  category?: string
  series_ticker?: string
  subtitle?: string
  liquidity?: number
  open_interest?: number
}

export class KalshiOptimizedClient {
  private baseUrl: string = 'https://api.elections.kalshi.com/trade-api/v2'

  constructor() {
    // No credentials needed for public API
  }

  /**
   * Fetch markets from Kalshi public API (matches Polymarket Client.getMarkets signature)
   */
  async getMarkets(params?: {
    limit?: number
    offset?: number
    closed?: boolean
    search?: string
  }): Promise<{ markets: Market[]; hasMore: boolean; nextOffset?: number }> {
    try {
      // Match Polymarket's fetch strategy
      const isSearch = !!params?.search
      const requestLimit = isSearch ? 1000 : Math.min((params?.limit || 500) * 2, 1000)
      const offset = params?.offset || 0

      const url = new URL(`${this.baseUrl}/markets`)

      // Kalshi uses 'open' status (not 'active' like Polymarket)
      url.searchParams.set('status', 'open')
      url.searchParams.set('limit', String(requestLimit))

      if (offset > 0) {
        url.searchParams.set('cursor', this.offsetToCursor(offset))
      }

      console.log('[Kalshi Optimized] Fetching markets from:', url.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always get fresh data (matching Polymarket)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Kalshi Optimized] API error:', response.status, errorText)
        // Don't throw - return empty array so other platforms can still work (matching Polymarket)
        return { markets: [], hasMore: false, nextOffset: undefined }
      }

      const data = await response.json()
      const markets = data.markets || []

      console.log(`[Kalshi Optimized] Received ${markets.length} markets from API`)

      if (!Array.isArray(markets) || markets.length === 0) {
        console.warn('[Kalshi Optimized] No markets returned from API')
        return { markets: [], hasMore: false, nextOffset: undefined }
      }



      const now = new Date()

      // Transform markets (matching Polymarket's filtering logic)
      const transformed = markets
        .filter((m: KalshiRawMarket) => {
          // Basic sanity checks: must have ticker and title
          if (!m || !m.ticker || !m.title) {
            return false
          }

          // Only fetch open markets (we already filtered by status, but double-check)
          if (m.status !== 'open') {
            return false
          }

          // Filter out sports markets
          const titleLower = m.title?.toLowerCase() || ''
          const categoryLower = m.category?.toLowerCase() || ''
          const sportsKeywords = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'championship', 'super bowl', 'world cup', 'sports', 'game', 'match', 'player', 'team', 'season']
          if (sportsKeywords.some(keyword => titleLower.includes(keyword) || categoryLower.includes(keyword))) {
            return false
          }

          return true
        })
        .map((m: KalshiRawMarket) => this.transformMarket(m))
        .filter((m: Market | null) => {
          if (!m) {
            return false
          }

          // Filter out markets with zero or very low volume (matching Polymarket)
          if (m.volume24h !== undefined && m.volume24h < 10) {
            // Check if market has a future end date
            if (m.endDate) {
              const end = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
              if (end < now) {
                return false // Past end date and no volume
              }
            } else {
              return false // No volume and no end date
            }
          }

          // Only filter out prices that are completely invalid (outside 0-1 range)
          if (m.price !== undefined && m.price !== null) {
            if (m.price < 0 || m.price > 1) {
              return false
            }
          }

          return true
        }) as Market[]

      // Apply search filter if provided (matching Polymarket)
      let filtered = transformed
      if (params?.search) {
        const searchLower = params.search.toLowerCase()
        filtered = transformed.filter(m =>
          m.title.toLowerCase().includes(searchLower) ||
          m.description?.toLowerCase().includes(searchLower) ||
          m.category?.toLowerCase().includes(searchLower)
        )
        console.log(`[Kalshi Optimized] Filtered by search "${params.search}": ${filtered.length} markets`)
      }

      // Sort by volume (highest first) - matching Polymarket
      filtered.sort((a, b) => {
        const volA = a.volume24h || 0
        const volB = b.volume24h || 0
        return volB - volA
      })

      // Limit to requested amount after filtering (matching Polymarket)
      const finalMarkets = filtered.slice(0, params?.limit || 500)

      console.log(`[Kalshi Optimized] Transformed and sorted ${finalMarkets.length} markets by volume (filtered from ${markets.length})`)


      // Determine if there are more results (matching Polymarket)
      const hasMore = filtered.length > finalMarkets.length
      const nextOffset = hasMore ? offset + finalMarkets.length : undefined

      return {
        markets: finalMarkets,
        hasMore,
        nextOffset,
      }
    } catch (error: any) {
      console.error('[Kalshi Optimized] Error fetching markets:', error.message || error)
      return { markets: [], hasMore: false, nextOffset: undefined } // Return empty array instead of throwing
    }
  }

  /**
   * Transform a single Kalshi market to app format (matching Polymarket structure)
   */
  private transformMarket(market: KalshiRawMarket): Market | null {
    const ticker = market.ticker
    if (!ticker || !market.title) {
      return null
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

    // Validate price range
    if (price !== undefined && price !== null) {
      if (price < 0 || price > 1 || isNaN(price)) {
        price = undefined // Reset invalid prices instead of filtering out the entire market
      }
    }

    // Parse volume
    const volume = market.volume ? parseFloat(market.volume.toString()) : 0

    // Parse outcomes (Kalshi uses yes/no)
    const outcomes: string[] = ['Yes', 'No']

    // Parse end date
    let endDate: Date | undefined
    if (market.close_time) {
      endDate = new Date(market.close_time)
    } else if (market.expiration_time) {
      endDate = new Date(market.expiration_time)
    }

    // Parse category
    const category = market.category || market.series_ticker || 'Uncategorized'

    // Normalize category (matching Polymarket's structure)
    const normalizedCategory = category

    return {
      id: ticker,
      platform: 'kalshi',
      title: market.title,
      description: market.subtitle || '',
      category: category,
      normalizedCategory: normalizedCategory,
      probability: price,
      price: price,
      volume24h: volume,
      liquidity: market.liquidity || market.open_interest || 0,
      endDate: endDate,
      slug: market.series_ticker,
      ticker: ticker,
      outcomes: outcomes,
      outcomePrices: price !== undefined ? [price, 1 - price] : undefined,
      rawData: market,
    } as Market
  }

  /**
   * Simple offset to cursor converter
   * In a real implementation, you'd use the cursor from the API response
   */
  private offsetToCursor(offset: number): string {
    return `offset_${offset}`
  }
}
