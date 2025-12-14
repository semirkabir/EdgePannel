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
    sort?: 'volume' | 'relevance' | 'liquidity'
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

    // Enhance limits for volume sort to ensure we get high volume markets across pages if needed
    // If category filtering is active, we need to fetch significantly more markets to ensure we find matches
    // since the APIs often don't support direct category filtering 1:1.
    // For general search, we also want to fetch more from each provider to fill the quota.
    const userLimit = params.limit ? Math.max(params.limit, 50) : 50;

    // We fetch a bit more from each to ensure we have enough after merging and filtering
    const fetchLimit = params.category ? Math.max(userLimit, 500) : userLimit + 20;

    const fetchPromises = [];

    // Search Kalshi markets
    if (this.kalshiClient && (params.platform === undefined || params.platform === 'kalshi')) {
      fetchPromises.push(
        this.kalshiClient.getMarkets({
          limit: fetchLimit,
          cursor: params.cursor,
          search: params.query,
        }).then(result => {
          console.log(`[MarketAggregator] Fetched ${result.markets.length} Kalshi markets`);
          return { markets: result.markets, nextCursor: result.nextCursor };
        }).catch(error => {
          console.error('[MarketAggregator] Error searching Kalshi markets:', error.message || error);
          return { markets: [], nextCursor: undefined };
        })
      );
    }

    // Search Polymarket markets
    if (this.polymarketClient && (params.platform === undefined || params.platform === 'polymarket')) {
      fetchPromises.push(
        this.polymarketClient.getMarkets({
          limit: fetchLimit,
          offset: params.offset,
          search: params.query, // Pass search query to Polymarket
        }).then(result => {
          console.log(`[MarketAggregator] Fetched ${result.markets.length} Polymarket markets`);
          return { markets: result.markets, hasMore: result.hasMore, nextOffset: result.nextOffset };
        }).catch(error => {
          console.error('[MarketAggregator] Error searching Polymarket markets:', error.message || error);
          return { markets: [], hasMore: false };
        })
      );
    }

    // Wait for both concurrent fetches
    const results = await Promise.all(fetchPromises);

    // Flatten results
    // Flatten results
    for (const res of results) {
      markets.push(...res.markets);
      // Naive cursor handling: just take the first valid one we find for now (imperfect for aggregated paging)
      if ((res as any).nextCursor && !nextCursor) nextCursor = (res as any).nextCursor;
      if ((res as any).nextOffset !== undefined && nextOffset === undefined) {
        nextOffset = (res as any).nextOffset;
        hasMore = (res as any).hasMore || false;
      } else if ((res as any).nextCursor) {
        hasMore = true;
      }
    }

    // Apply additional filters
    let filtered = markets

    // Category filter
    if (params.category) {
      const categories = params.category.toLowerCase().split(',').map(c => c.trim());
      // Logic from before...
      filtered = filtered.filter(m => {
        const mCat = (m.category || '').toLowerCase();
        const mNormCat = (m.normalizedCategory || '').toLowerCase();

        // Exact or partial matches
        const matches = categories.some(cat => {
          const catLower = cat.toLowerCase();
          const categoryMatch = mCat.includes(catLower) || mNormCat.includes(catLower);

          // Special mappings
          const specialMappings: Record<string, string[]> = {
            'tech': ['technology', 'ai', 'crypto', 'software'],
            'technology': ['tech', 'ai', 'crypto', 'software'],
            'culture': ['entertainment', 'pop culture', 'sports', 'music'],
            'entertainment': ['culture', 'pop culture', 'sports', 'music'],
            'politics': ['political', 'election', 'government'],
            'sports': ['sport', 'athletics', 'games'],
            'crypto': ['cryptocurrency', 'bitcoin', 'ethereum', 'web3'],
          };
          const mappedTerms = specialMappings[catLower] || [];
          const mappingMatch = mappedTerms.some(term => mCat.includes(term) || mNormCat.includes(term));

          return categoryMatch || mappingMatch;
        });
        return matches;
      });
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

    // Sort
    if (params.sort === 'volume') {
      filtered.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    } else if (params.sort === 'liquidity') {
      filtered.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
    } else if (params.query) {
      // Relevance sort (default for search)
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

    // Slice to limit
    const finalMarkets = filtered.slice(0, userLimit)

    // Populate Price History for Top Results (for Sparkline)
    const marketsWithHistory = await Promise.all(finalMarkets.map(async (market, index) => {
      if (index >= 15) return market // Skip beyond top 15

      try {
        let history: any[] = []

        if (market.platform === 'polymarket' && this.polymarketClient) {
          history = await this.polymarketClient.getPriceHistory(market.id, '1h')
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          history = history.filter(p => p.timestamp >= oneDayAgo)
        } else if (market.platform === 'kalshi' && this.kalshiClient) {
          const details = await this.kalshiClient.getMarket(market.id)
          if (details.priceHistory) {
            history = details.priceHistory
          }
        }

        if (history.length > 0) {
          return {
            ...market,
            priceHistory: history
          }
        }
      } catch (e) {
        console.warn(`[Aggregator] Failed to fetch history for ${market.id}`, e)
      }
      return market
    }))

    return {
      markets: marketsWithHistory,
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

