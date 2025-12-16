/**
 * Optimized Kalshi Client - Public API Access
 *
 * Similar to Polymarket, Kalshi has public endpoints that don't require authentication:
 * - GET /markets - List all markets (public)
 * - GET /events - List all events (public)
 * - GET /markets/{ticker} - Get market details (public)
 * - GET /series - List series (public)
 *
 * This client focuses on public data access without requiring API keys.
 */

import { Market as AppMarket } from '@/types/market'

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2'

interface KalshiMarketResponse {
  markets: any[]
  cursor?: string
}

interface KalshiEventResponse {
  events: any[]
  cursor?: string
}

export class KalshiOptimizedClient {
  private baseUrl: string

  constructor(useDemo: boolean = false) {
    this.baseUrl = useDemo
      ? 'https://demo-api.kalshi.com/trade-api/v2'
      : KALSHI_API_BASE
  }

  /**
   * Fetch markets from Kalshi public API (no auth required)
   */
  async getMarkets(params?: {
    limit?: number
    cursor?: string
    status?: 'open' | 'closed' | 'settled'
    series_ticker?: string
    event_ticker?: string
  }): Promise<{ markets: AppMarket[]; nextCursor?: string }> {
    try {
      const url = new URL(`${this.baseUrl}/markets`)

      // Default to open markets (Kalshi uses 'open' not 'active')
      url.searchParams.set('status', params?.status || 'open')
      url.searchParams.set('limit', String(params?.limit || 200))

      if (params?.cursor) {
        url.searchParams.set('cursor', params.cursor)
      }

      if (params?.series_ticker) {
        url.searchParams.set('series_ticker', params.series_ticker)
      }

      if (params?.event_ticker) {
        url.searchParams.set('event_ticker', params.event_ticker)
      }

      console.log('[Kalshi Optimized] Fetching markets from:', url.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Kalshi Optimized] API error:', response.status, response.statusText)
        const text = await response.text()
        console.error('[Kalshi Optimized] Response:', text.substring(0, 500))
        return { markets: [], nextCursor: undefined }
      }

      const data: KalshiMarketResponse = await response.json()

      console.log(`[Kalshi Optimized] Received ${data.markets?.length || 0} markets`)

      if (!data.markets || data.markets.length === 0) {
        return { markets: [], nextCursor: data.cursor }
      }

      // Log sample market for debugging
      if (data.markets.length > 0) {
        const sample = data.markets[0]
        console.log('[Kalshi Optimized] Sample market:', {
          ticker: sample.ticker,
          title: sample.title,
          status: sample.status,
          last_price: sample.last_price,
          volume: sample.volume,
        })
      }

      const transformed = this.transformMarkets(data.markets)

      return {
        markets: transformed,
        nextCursor: data.cursor,
      }
    } catch (error: any) {
      console.error('[Kalshi Optimized] Error fetching markets:', error.message || error)
      return { markets: [], nextCursor: undefined }
    }
  }

  /**
   * Fetch events from Kalshi public API (no auth required)
   */
  async getEvents(params?: {
    limit?: number
    cursor?: string
    status?: 'active' | 'closed' | 'settled'
    series_ticker?: string
  }): Promise<{ events: any[]; nextCursor?: string }> {
    try {
      const url = new URL(`${this.baseUrl}/events`)

      url.searchParams.set('status', params?.status || 'active')
      url.searchParams.set('limit', String(params?.limit || 100))

      if (params?.cursor) {
        url.searchParams.set('cursor', params.cursor)
      }

      if (params?.series_ticker) {
        url.searchParams.set('series_ticker', params.series_ticker)
      }

      console.log('[Kalshi Optimized] Fetching events from:', url.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Kalshi Optimized] Events API error:', response.status)
        return { events: [], nextCursor: undefined }
      }

      const data: KalshiEventResponse = await response.json()

      console.log(`[Kalshi Optimized] Received ${data.events?.length || 0} events`)

      return {
        events: data.events || [],
        nextCursor: data.cursor,
      }
    } catch (error: any) {
      console.error('[Kalshi Optimized] Error fetching events:', error.message || error)
      return { events: [], nextCursor: undefined }
    }
  }

  /**
   * Fetch a single market by ticker
   */
  async getMarket(ticker: string): Promise<AppMarket | null> {
    try {
      const url = `${this.baseUrl}/markets/${ticker}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Kalshi Optimized] Market API error:', response.status)
        return null
      }

      const data = await response.json()

      if (!data.market) {
        return null
      }

      return this.transformMarket(data.market)
    } catch (error: any) {
      console.error('[Kalshi Optimized] Error fetching market:', error.message || error)
      return null
    }
  }

  /**
   * Transform Kalshi markets to app format
   */
  private transformMarkets(markets: any[]): AppMarket[] {
    return markets
      .map(m => this.transformMarket(m))
      .filter(m => {
        // Filter out invalid markets
        if (!m.title) return false

        // Only include active/open markets
        const status = m.rawData?.status
        if (status && !['active', 'open'].includes(status)) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        // Sort by volume (highest first)
        if (a.volume24h && b.volume24h) {
          return b.volume24h - a.volume24h
        }
        return 0
      })
  }

  /**
   * Transform a single Kalshi market to app format
   */
  private transformMarket(market: any): AppMarket {
    // Kalshi prices are in cents (0-100), convert to 0-1
    let price: number | undefined
    if (market.last_price !== undefined && market.last_price !== null) {
      price = market.last_price / 100
    } else if (market.yes_bid !== undefined) {
      price = market.yes_bid / 100
    } else if (market.yes_ask !== undefined) {
      price = market.yes_ask / 100
    }

    // Parse end date
    let endDate: Date | undefined
    if (market.close_time) {
      endDate = new Date(market.close_time)
    } else if (market.expiration_time) {
      endDate = new Date(market.expiration_time)
    }

    return {
      id: market.ticker,
      platform: 'kalshi',
      title: market.title || market.ticker || 'Untitled',
      description: market.subtitle || '',
      category: market.category || market.series_ticker || 'Uncategorized',
      probability: price,
      price: price,
      volume24h: market.volume || market.volume_24h || 0,
      liquidity: market.liquidity || market.open_interest || 0,
      endDate: endDate,
      ticker: market.ticker,
      slug: market.series_ticker,
      rawData: market,
    }
  }
}
