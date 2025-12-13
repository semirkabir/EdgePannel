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
    // Fetch top markets by volume from Polymarket's Gamma API (has better volume data)
    try {
      // Gamma API supports limit and active parameters
      // Fetch more than requested to ensure we have enough after filtering
      const requestLimit = Math.min((params?.limit || 500) * 2, 2000)
      const offset = params?.offset || 0

      const url = new URL('https://gamma-api.polymarket.com/markets')
      url.searchParams.set('limit', String(requestLimit))
      if (offset > 0) {
        url.searchParams.set('offset', String(offset))
      }
      // Only fetch open (not closed) markets - these have active trading
      url.searchParams.set('closed', 'false')

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
        return { markets: [], hasMore: false, nextOffset: undefined }
      }

      const markets = await marketsResponse.json()

      console.log(`[Polymarket Client] Received ${markets.length} markets from Gamma API`)

      if (!Array.isArray(markets) || markets.length === 0) {
        console.warn('[Polymarket Client] No markets returned from Gamma API')
        return { markets: [], hasMore: false, nextOffset: undefined }
      }

      // Log sample market structure for debugging
      if (markets.length > 0) {
        const sample = markets[0]
        console.log('[Polymarket Client] Sample market structure:', {
          question: sample.question?.substring(0, 50),
          conditionId: sample.conditionId,
          active: sample.active,
          archived: sample.archived,
          closed: sample.closed,
          volume24hr: sample.volume24hr,
          liquidity: sample.liquidity,
          endDateIso: sample.endDateIso,
          keys: Object.keys(sample).slice(0, 15),
        })
      }

      const now = new Date()

      // Transform markets using Gamma API format
      const transformed = markets
        .filter((m: any) => {
          // Basic sanity checks: must have a question and ID
          if (!m || !m.question || !m.conditionId) {
            return false
          }

          // Skip archived markets
          if (m.archived === true) {
            return false
          }

          // Since we're fetching with active=true, most markets should be valid
          // Just filter out obviously resolved markets
          return true
        })
        .map((m: any) => this.transformMarketFromGamma(m))
        .filter((m: Market | null) => {
          if (!m) {
            return false
          }

          // Filter out markets with zero or very low volume (likely old/resolved)
          if (m.volume24h !== undefined && m.volume24h < 10) {
            // Check if market has a future end date
            if (m.endDate) {
              const end = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
              if (end < now) {
                return false // Past end date and no volume = resolved market
              }
            } else {
              return false // No volume and no end date
            }
          }

          // Allow markets without prices - they might be new or inactive
          // Only filter out prices that are completely invalid (outside 0-1 range)
          if (m.price !== undefined && m.price !== null) {
            if (m.price < 0 || m.price > 1) {
              return false
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

      // Sort by 24h volume (highest first) to get top markets
      filtered.sort((a, b) => {
        const volA = a.volume24h || 0
        const volB = b.volume24h || 0
        return volB - volA
      })

      // Limit to requested amount after filtering
      const finalMarkets = filtered.slice(0, params?.limit || 500)

      console.log(`[Polymarket Client] Transformed and sorted ${finalMarkets.length} markets by volume (filtered from ${markets.length})`)
      if (finalMarkets.length > 0) {
        console.log(`[Polymarket Client] Top market: ${finalMarkets[0].title} (volume: ${finalMarkets[0].volume24h})`)
      }

      // Determine if there are more results
      const hasMore = filtered.length > finalMarkets.length
      const nextOffset = hasMore ? offset + finalMarkets.length : undefined

      return {
        markets: finalMarkets,
        hasMore,
        nextOffset,
      }
    } catch (error: any) {
      console.error('[Polymarket Client] Error fetching markets:', error)
      return { markets: [], hasMore: false, nextOffset: undefined } // Return empty array instead of throwing
    }
  }

  private transformMarketFromGamma(market: any): Market | null {
    const conditionId = market.conditionId
    if (!conditionId || !market.question) {
      return null
    }

    // Extract price from Gamma API format (outcomePrices is a JSON string like "[\"0.65\", \"0.35\"]")
    let price: number | undefined
    let outcomePrices: number[] = []

    if (market.outcomePrices) {
      try {
        const prices = typeof market.outcomePrices === 'string'
          ? JSON.parse(market.outcomePrices)
          : market.outcomePrices

        if (Array.isArray(prices)) {
          outcomePrices = prices.map((p: any) => parseFloat(p.toString()))
          // First outcome is typically "Yes"
          if (outcomePrices.length > 0) {
            price = outcomePrices[0]
          }
        }
      } catch (e) {
        console.warn(`[Polymarket] Failed to parse outcomePrices for ${market.question}`)
      }
    }

    // Validate price range
    if (price !== undefined && price !== null) {
      if (price < 0 || price > 1 || isNaN(price)) {
        price = undefined // Reset invalid prices instead of filtering out the entire market
      }
    }

    // Parse volume (can be number or string)
    const volume = market.volume24hr ? parseFloat(market.volume24hr.toString()) : 0

    // Parse outcomes (default to Yes/No)
    const outcomes = market.outcomes || ['Yes', 'No']

    return {
      id: conditionId,
      platform: 'polymarket',
      title: market.question,
      description: market.description || '',
      category: market.category || undefined,
      price: price,
      probability: price,
      volume24h: volume,
      liquidity: market.liquidityNum ? parseFloat(market.liquidityNum.toString()) : undefined,
      endDate: market.endDateIso ? new Date(market.endDateIso) : undefined,
      slug: market.slug || market.marketSlug || undefined,
      outcomes: outcomes,
      outcomePrices: outcomePrices.length > 0 ? outcomePrices : undefined,
      rawData: market,
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



  /**
   * Fetch a single market by ID or URL
   * Supports:
   * - Direct ID: "0x123..."
   * - Polymarket URL: "https://polymarket.com/event/..."
   * - Slug: "will-trump-win"
   */
  async getMarketByUrl(urlOrId: string): Promise<Market | null> {
    try {
      // Extract condition ID from URL if it's a URL
      let conditionId = urlOrId

      if (urlOrId.includes('polymarket.com')) {
        // Try to extract from URL path
        // Format: https://polymarket.com/event/...?id=0x123 or /market/slug
        const url = new URL(urlOrId)
        const idParam = url.searchParams.get('id')
        if (idParam) {
          conditionId = idParam
        } else {
          // Try to get from path (last segment might be the slug or ID)
          const pathSegments = url.pathname.split('/').filter(Boolean)
          conditionId = pathSegments[pathSegments.length - 1]
        }
      }

      // Fetch from CLOB API
      const response = await fetch(`${this.baseUrl}/markets/${conditionId}`, {
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        console.error('[Polymarket Client] Error fetching market:', response.status)
        return null
      }

      const marketData = await response.json()
      return this.transformMarketFromTokens(marketData)
    } catch (error) {
      console.error('[Polymarket Client] Error fetching market by URL:', error)
      return null
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

