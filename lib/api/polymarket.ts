import { Market, MarketDetails } from '@/types/market'

interface PolymarketCredentials {
  apiKey: string
}

export class PolymarketClient {
  private apiKey: string
  private baseUrl: string = 'https://clob.polymarket.com'

  constructor(credentials: PolymarketCredentials) {
    this.apiKey = credentials.apiKey
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getMarkets(params?: {
    limit?: number
    offset?: number
    closed?: boolean
    search?: string
  }): Promise<{ markets: Market[]; hasMore: boolean; nextOffset?: number }> {
    // View-only: use Polymarket's public CLOB endpoint with light filtering
    try {
      const limit = params?.limit || 200
      const offset = params?.offset || 0
      const url = new URL(`${this.baseUrl}/markets`)
      url.searchParams.set('limit', String(limit))
      if (offset > 0) {
        url.searchParams.set('offset', String(offset))
      }
      // Ask Polymarket for open markets only when supported
      if (params?.closed === false) {
        url.searchParams.set('closed', 'false')
      }

      const marketsResponse = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always get fresh data
      })

      if (!marketsResponse.ok) {
        const errorText = await marketsResponse.text()
        console.error('[Polymarket Client] CLOB API error:', marketsResponse.status, errorText)
        // Don't throw - return empty array so other platforms can still work
        return []
      }

      const responseData = await marketsResponse.json()
      const markets = responseData.data || responseData || []

      console.log(`[Polymarket Client] Received ${markets.length} markets from CLOB API`)

      if (!Array.isArray(markets) || markets.length === 0) {
        console.warn('[Polymarket Client] No markets returned from CLOB API')
        return []
      }

      // Log sample market structure for debugging
      if (markets.length > 0) {
        const sample = markets[0]
        console.log('[Polymarket Client] Sample market structure:', {
          question: sample.question?.substring(0, 50),
          condition_id: sample.condition_id,
          question_id: sample.question_id,
          archived: sample.archived,
          resolved: sample.resolved,
          closed: sample.closed,
          hasTokens: !!sample.tokens,
          tokenCount: sample.tokens?.length || 0,
          firstTokenPrice: sample.tokens?.[0]?.price,
          keys: Object.keys(sample).slice(0, 15),
        })
      }

      const now = new Date()

      // Transform markets using token prices (fast, view-only)
      const transformed = markets
        .filter((m: any) => {
          // Basic sanity checks: must have a question and ID
          if (!m || !m.question || (!m.condition_id && !m.question_id)) {
            return false
          }

          // Skip archived markets
          if (m.archived) {
            return false
          }

          // If Polymarket flags as resolved, skip
          if (m.resolved === true) {
            return false
          }

          // Allow recently closed markets (closed within last 7 days) for display purposes
          if (m.closed === true) {
            // Check if it was closed recently (within 7 days)
            if (m.end_date_iso) {
              const endDate = new Date(m.end_date_iso)
              const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              if (endDate < sevenDaysAgo) {
                return false
              }
            } else {
              // If no end date but marked as closed, skip
              return false
            }
          }

          return true
        })
        .map((m: any) => this.transformMarketFromTokens(m))
        .filter((m: Market | null) => {
          if (!m) {
            return false
          }

          // Allow markets without prices - they might be new or inactive
          // Only filter out prices that are completely invalid (outside 0-1 range)
          // Allow prices of 0 and 1 (they're valid probabilities, just extreme)
          if (m.price !== undefined && m.price !== null) {
            if (m.price < 0 || m.price > 1) {
              return false
            }
            // Prices of 0 or 1 are valid (just extreme probabilities)
          }

          // If we still have an obviously historical market by endDate, drop it (> 1 year old)
          if (m.endDate) {
            const end = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
            if (isFinite(end.getTime())) {
              const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
              if (end < oneYearAgo) {
                return false
              }
            }
          }

          return true
        }) as Market[]

      // Apply search filter if provided
      let filtered = transformed
      if (params?.search) {
        const searchLower = params.search.toLowerCase()
        filtered = transformed.filter(m => 
          m.title.toLowerCase().includes(searchLower) ||
          m.description?.toLowerCase().includes(searchLower) ||
          m.category?.toLowerCase().includes(searchLower)
        )
        console.log(`[Polymarket Client] Filtered by search "${params.search}": ${filtered.length} markets`)
      }
      
      console.log(`[Polymarket Client] Transformed ${filtered.length} markets`)
      
      // Determine if there are more results
      const hasMore = filtered.length === limit
      const nextOffset = hasMore ? offset + limit : undefined
      
      return {
        markets: filtered,
        hasMore,
        nextOffset,
      }
    } catch (error: any) {
      console.error('[Polymarket Client] Error fetching markets:', error)
      return { markets: [], hasMore: false, nextOffset: undefined } // Return empty array instead of throwing
    }
  }

  private transformMarketFromTokens(market: any): Market | null {
    const conditionId = market.condition_id || market.question_id
    if (!conditionId || !market.question) {
      return null
    }

    // Extract price from tokens array (fast path from CLOB API)
    let price: number | undefined

    if (market.tokens && Array.isArray(market.tokens) && market.tokens.length > 0) {
      // Prefer the \"Yes\" outcome
      const yesToken = market.tokens.find((t: any) =>
        t.outcome && (t.outcome.toLowerCase() === 'yes' || t.outcome.toLowerCase() === 'true')
      )

      if (yesToken && yesToken.price !== undefined && yesToken.price !== null) {
        price = parseFloat(yesToken.price.toString())
      } else if (market.tokens[0] && market.tokens[0].price !== undefined) {
        // Fallback to first token
        price = parseFloat(market.tokens[0].price.toString())
      }
    }

    // Allow markets without prices or with prices between 0 and 1 (inclusive)
    // Prices of 0 and 1 are valid (extreme probabilities)
    if (price !== undefined && price !== null) {
      if (price < 0 || price > 1) {
        return null // Only filter out completely invalid prices
      }
    }
    // Allow markets without prices - they might be new or inactive

    return {
      id: conditionId,
      platform: 'polymarket',
      title: market.question,
      description: market.description || '',
      category: market.category || market.tags?.[0] || undefined,
      price: price,
      probability: price,
      volume24h: market.volume_24h ? parseFloat(market.volume_24h.toString()) : undefined,
      liquidity: market.liquidity ? parseFloat(market.liquidity.toString()) : undefined,
      endDate: market.end_date_iso ? new Date(market.end_date_iso) : undefined,
      rawData: market,
    }
  }



  async getMarket(marketId: string): Promise<MarketDetails> {
    const query = `
      query GetMarket($id: ID!) {
        market(id: $id) {
          id
          question
          description
          outcomes
          conditionId
          endDate
          volume
          liquidity
          prices
          lastPrice
        }
      }
    `

    const response = await fetch('https://api.thegraph.com/subgraphs/name/polymarket/polymarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: marketId },
      }),
    })

    const data = await response.json()
    return this.transformMarketDetails(data.data?.market)
  }

  async getOrderBook(marketId: string): Promise<any> {
    // Use CLOB API for order book
    return this.request(`/book?market=${marketId}`)
  }

  async createOrder(order: {
    market: string
    side: 'buy' | 'sell'
    size: string
    price: string
    type: 'LIMIT' | 'MARKET'
  }): Promise<any> {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    })
  }

  private transformMarkets(markets: any[]): Market[] {
    return markets.map(m => this.transformMarket(m))
  }

  private transformMarket(market: any): Market {
    // GraphQL returns markets with different structure
    // Calculate price from outcomes if available
    let price: number | undefined
    if (market.outcomes && Array.isArray(market.outcomes) && market.outcomes.length > 0) {
      // Try to get the first outcome's price
      const firstOutcome = market.outcomes[0]
      if (firstOutcome.price) {
        price = parseFloat(firstOutcome.price)
      }
    }

    return {
      id: market.id || market.conditionId || `polymarket-${Date.now()}-${Math.random()}`,
      platform: 'polymarket',
      title: market.question || 'Untitled Market',
      description: market.description || '',
      probability: price,
      price: price,
      volume24h: market.volume ? parseFloat(market.volume.toString()) : undefined,
      liquidity: market.liquidity ? parseFloat(market.liquidity.toString()) : undefined,
      endDate: market.endDate ? new Date(parseInt(market.endDate.toString()) * 1000) : undefined,
      rawData: market,
    }
  }

  private transformMarketDetails(market: any): MarketDetails {
    const base = this.transformMarket(market)
    return {
      ...base,
      orderBook: market.orderbook ? {
        bids: market.orderbook.bids || [],
        asks: market.orderbook.asks || [],
      } : undefined,
    }
  }
}

