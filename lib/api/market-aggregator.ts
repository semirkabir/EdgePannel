import { Market, MarketComparison } from '@/types/market'
import { KalshiClient } from './kalshi'
import { PolymarketClient } from './polymarket'

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

  async getAllMarkets(): Promise<Market[]> {
    const markets: Market[] = []

    if (this.kalshiClient) {
      try {
        const kalshiMarkets = await this.kalshiClient.getMarkets({ limit: 100 })
        markets.push(...kalshiMarkets)
      } catch (error) {
        console.error('Error fetching Kalshi markets:', error)
      }
    }

    if (this.polymarketClient) {
      try {
        const polymarketMarkets = await this.polymarketClient.getMarkets({ limit: 100 })
        markets.push(...polymarketMarkets)
      } catch (error) {
        console.error('Error fetching Polymarket markets:', error)
      }
    }

    return markets
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

