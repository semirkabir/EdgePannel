import { Market, MarketComparison } from '@/types/market'
import { KalshiClient } from './kalshi'
import { PolymarketClient } from './polymarket'
import { enrichMarkets, EnrichedMarket } from '@/lib/markets/enrich'

export class MarketAggregator {
  private kalshiClient?: KalshiClient
  private polymarketClient?: PolymarketClient

  constructor(
    kalshiClient?: KalshiClient,
    polymarketClient?: PolymarketClient
  ) {
    this.kalshiClient = kalshiClient
    this.polymarketClient = polymarketClient
  }

  async getAllMarkets(params?: {
    limit?: number
    cursor?: string
    offset?: number
  }): Promise<Market[]> {
    const markets: Market[] = []

    // Fetch from Kalshi
    if (this.kalshiClient) {
      try {
        console.log('[MarketAggregator] Fetching Kalshi markets...')
        const result = await this.kalshiClient.getMarkets({
          limit: params?.limit || 100,
          cursor: params?.cursor,
        })
        console.log(`[MarketAggregator] Fetched ${result.markets.length} Kalshi markets`)
        markets.push(...result.markets)
      } catch (error: any) {
        console.error('[MarketAggregator] Error fetching Kalshi markets:', error.message || error)
        console.error('[MarketAggregator] Error stack:', error.stack)
      }
    } else {
      console.log('[MarketAggregator] Kalshi client not available - API keys may not be configured')
    }

    // Fetch from Polymarket
    if (this.polymarketClient) {
      try {
        const result = await this.polymarketClient.getMarkets({
          limit: params?.limit || 100,
          offset: params?.offset,
        })
        markets.push(...result.markets)
      } catch (error) {
        console.error('Error fetching Polymarket markets:', error)
      }
    }

    return markets
  }

  async searchMarkets(params: {
    query?: string
    platform?: 'kalshi' | 'polymarket'
    category?: string
    minProbability?: number
    maxProbability?: number
    limit?: number
    cursor?: string
    offset?: number
  }): Promise<{
    markets: Market[]
    hasMore: boolean
    nextCursor?: string
    nextOffset?: number
  }> {
    const markets: Market[] = []
    let hasMore = false
    let nextCursor: string | undefined
    let nextOffset: number | undefined

    // Search Kalshi markets
    if (this.kalshiClient && (params.platform === undefined || params.platform === 'kalshi')) {
      try {
        console.log('[MarketAggregator] Searching Kalshi markets...')
        const result = await this.kalshiClient.getMarkets({
          limit: params.limit || 50,
          cursor: params.cursor,
          search: params.query,
        })
        markets.push(...result.markets)
        if (result.nextCursor) {
          hasMore = true
          nextCursor = result.nextCursor
        }
      } catch (error: any) {
        console.error('[MarketAggregator] Error searching Kalshi markets:', error.message || error)
      }
    }

    // Search Polymarket markets
    if (this.polymarketClient && (params.platform === undefined || params.platform === 'polymarket')) {
      try {
        console.log('[MarketAggregator] Searching Polymarket markets...')
        const result = await this.polymarketClient.getMarkets({
          limit: params.limit || 50,
          offset: params.offset,
          search: params.query,
        })
        markets.push(...result.markets)
        if (result.hasMore) {
          hasMore = true
          nextOffset = result.nextOffset
        }
      } catch (error: any) {
        console.error('[MarketAggregator] Error searching Polymarket markets:', error.message || error)
      }
    }

    // Apply additional filters
    let filtered = markets

    // Category filter
    if (params.category) {
      filtered = filtered.filter(m => 
        m.category?.toLowerCase().includes(params.category!.toLowerCase()) ||
        m.normalizedCategory?.toLowerCase().includes(params.category!.toLowerCase())
      )
    }

    // Probability filters
    if (params.minProbability !== undefined || params.maxProbability !== undefined) {
      filtered = filtered.filter(m => {
        if (m.probability === undefined) return false
        const prob = m.probability * 100
        if (params.minProbability !== undefined && prob < params.minProbability) return false
        if (params.maxProbability !== undefined && prob > params.maxProbability) return false
        return true
      })
    }

    // Sort by relevance if search query provided
    if (params.query) {
      const queryLower = params.query.toLowerCase()
      filtered.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(queryLower) ? 1 : 0
        const bTitle = b.title.toLowerCase().includes(queryLower) ? 1 : 0
        if (aTitle !== bTitle) return bTitle - aTitle
        
        const aDesc = a.description?.toLowerCase().includes(queryLower) ? 0.5 : 0
        const bDesc = b.description?.toLowerCase().includes(queryLower) ? 0.5 : 0
        return bDesc - aDesc
      })
    }

    return {
      markets: filtered,
      hasMore,
      nextCursor,
      nextOffset,
    }
  }

  async getAllEnrichedMarkets(): Promise<EnrichedMarket[]> {
    const markets = await this.getAllMarkets()
    return enrichMarkets(markets)
  }

  findSimilarMarkets(markets: Market[]): MarketComparison[] {
    const comparisons: MarketComparison[] = []
    const processed = new Set<string>()

    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const market1 = markets[i]
        const market2 = markets[j]

        // Skip if same platform
        if (market1.platform === market2.platform) continue

        const key = [market1.id, market2.id].sort().join('-')
        if (processed.has(key)) continue

        const similarity = this.calculateSimilarity(market1, market2)
        
        if (similarity > 0.6) { // Threshold for similarity
          const discrepancy = market1.price && market2.price
            ? Math.abs(market1.price - market2.price)
            : undefined

          comparisons.push({
            markets: [market1, market2],
            discrepancy,
            arbitrageOpportunity: discrepancy !== undefined && discrepancy > 0.05,
            averagePrice: market1.price && market2.price
              ? (market1.price + market2.price) / 2
              : undefined,
          })

          processed.add(key)
        }
      }
    }

    return comparisons
  }

  private calculateSimilarity(market1: Market, market2: Market): number {
    let score = 0
    let factors = 0

    // Title similarity
    if (market1.title && market2.title) {
      const title1 = market1.title.toLowerCase()
      const title2 = market2.title.toLowerCase()
      const words1 = new Set(title1.split(/\s+/))
      const words2 = new Set(title2.split(/\s+/))
      
      const intersection = new Set([...words1].filter(x => words2.has(x)))
      const union = new Set([...words1, ...words2])
      
      const jaccard = intersection.size / union.size
      score += jaccard * 0.5
      factors += 0.5
    }

    // Category similarity
    if (market1.category && market2.category) {
      if (market1.category === market2.category) {
        score += 0.3
      }
      factors += 0.3
    }

    // Date similarity (same event timeframe)
    if (market1.endDate && market2.endDate) {
      const daysDiff = Math.abs(
        (market1.endDate.getTime() - market2.endDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysDiff < 7) {
        score += 0.2 * (1 - daysDiff / 7)
      }
      factors += 0.2
    }

    return factors > 0 ? score / factors : 0
  }

  async getMarketsByLocation(
    markets: Market[],
    country?: string,
    region?: string,
    city?: string
  ): Promise<Market[]> {
    return markets.filter(market => {
      if (country && market.location?.country !== country) return false
      if (region && market.location?.region !== region) return false
      if (city && market.location?.city !== city) return false
      return true
    })
  }
}

