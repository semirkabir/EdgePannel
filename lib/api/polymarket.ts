import { Market, MarketDetails, EventData, Candlestick } from '@/types/market'
import { buildCacheKey, cachedJson } from '@/lib/api/response-cache'

interface PolymarketCredentials {
  apiKey?: string
}

export class PolymarketClient {
  private apiKey?: string
  private baseUrl: string = 'https://clob.polymarket.com'

  constructor(credentials?: PolymarketCredentials) {
    this.apiKey = credentials?.apiKey
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
      // If searching, fetch maximum allowing to filter properly
      const isSearch = !!params?.search
      const requestLimit = isSearch ? 2000 : Math.min((params?.limit || 1000) * 2, 2000)
      const offset = params?.offset || 0

      const url = new URL('https://gamma-api.polymarket.com/markets')
      url.searchParams.set('limit', String(requestLimit))
      // Sort by volume as requested to show highest volume markets first
      url.searchParams.set('order', 'volume')
      url.searchParams.set('ascending', 'false')

      if (offset > 0) {
        url.searchParams.set('offset', String(offset))
      }
      // Only fetch open (not closed) markets - these have active trading
      url.searchParams.set('closed', 'false')

      // Use server-side filtering for search if available
      if (isSearch && params?.search) {
        url.searchParams.set('question', params.search)
      }

      const cacheKey = buildCacheKey('polymarket:gamma:markets', [url.toString()])
      let markets: any[]
      try {
        markets = await cachedJson<any[]>(
          cacheKey,
          url.toString(),
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          { ttlMs: 15_000, allowStaleOnError: true, cacheNull: true }
        )
      } catch (error: any) {
        console.error('[Polymarket Client] CLOB API error:', error?.status || 'unknown', error?.message || error)
        // Don't throw - return empty array so other platforms can still work
        return { markets: [], hasMore: false, nextOffset: undefined }
      }

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
          category: sample.category,
          tags: sample.tags,
          image: sample.image,
          icon: sample.icon,
          allKeys: Object.keys(sample),
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

      // Sort by volume (highest first) as requested
      filtered.sort((a, b) => {
        const volA = a.volume24h || 0
        const volB = b.volume24h || 0
        return volB - volA
      })

      // Limit to requested amount after filtering
      const finalMarkets = filtered.slice(0, params?.limit || 500)

      // Enrich top markets with tags for better categorization
      // Only enrich top 20 to avoid too many API calls
      const enrichedMarkets = await this.enrichMarketsWithTags(finalMarkets, 20)

      console.log(`[Polymarket Client] Transformed and sorted ${enrichedMarkets.length} markets by volume (filtered from ${markets.length})`)
      if (enrichedMarkets.length > 0) {
        console.log(`[Polymarket Client] Top market: ${enrichedMarkets[0].title} (volume: ${enrichedMarkets[0].volume24h}, category: ${enrichedMarkets[0].category})`)
      }

      // Determine if there are more results
      const hasMore = filtered.length > finalMarkets.length
      const nextOffset = hasMore ? offset + finalMarkets.length : undefined

      return {
        markets: enrichedMarkets,
        hasMore,
        nextOffset,
      }
    } catch (error: any) {
      console.error('[Polymarket Client] Error fetching markets:', error)
      return { markets: [], hasMore: false, nextOffset: undefined } // Return empty array instead of throwing
    }
  }

  /**
   * Fetch tags for a market by its numeric ID
   */
  private async fetchMarketTags(numericId: string | number): Promise<string[]> {
    try {
      const url = `https://gamma-api.polymarket.com/markets/${numericId}/tags`
      const cacheKey = buildCacheKey('polymarket:gamma:market-tags', [numericId])
      const tags = await cachedJson<any[]>(
        cacheKey,
        url,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        { ttlMs: 6 * 60 * 60 * 1000, allowStaleOnError: true, cacheNull: true }
      )
      if (Array.isArray(tags)) {
        // Extract tag labels (e.g., "Culture", "Games", "Politics")
        return tags.map((tag: any) => tag.label).filter(Boolean)
      }
      return []
    } catch (error) {
      console.warn(`[Polymarket Client] Error fetching tags for market ${numericId}:`, error)
      return []
    }
  }

  /**
   * Fetch full market/event details including images
   * Uses server-side proxy to avoid CORS issues
   */
  private async fetchMarketDetails(conditionId: string): Promise<{ image?: string; icon?: string } | null> {
    try {
      // Use our proxy API to avoid CORS issues
      const response = await fetch(`/api/markets/images?conditionId=${encodeURIComponent(conditionId)}`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        console.warn(`[Polymarket Client] Image proxy failed for ${conditionId}: ${response.status}`)
        return null
      }

      const data = await response.json()

      // Return null if no images found
      if (data.source === 'none') {
        return null
      }

      return {
        image: data.image,
        icon: data.icon
      }
    } catch (error) {
      console.warn(`[Polymarket Client] Error fetching market details for ${conditionId}:`, error)
      return null
    }
  }

  /**
   * Enrich markets with tags and images from the API
   * Only enriches the first N markets to avoid too many API calls
   */
  private async enrichMarketsWithTags(markets: Market[], limit: number = 20): Promise<Market[]> {
    const marketsToEnrich = markets.slice(0, limit)
    const remainingMarkets = markets.slice(limit)

    const enrichedMarkets = await Promise.all(
      marketsToEnrich.map(async (market) => {
        const numericId = market.rawData?.numericId
        const conditionId = market.id

        // Fetch tags
        const tags = numericId ? await this.fetchMarketTags(numericId) : []

        // Fetch full details for image if not already present
        let imageData = null
        if (!market.imageUrl && conditionId) {
          imageData = await this.fetchMarketDetails(conditionId)
        }

        return {
          ...market,
          // Use the first tag as category if no category exists
          category: market.category || (tags.length > 0 ? tags[0] : undefined),
          normalizedCategory: market.normalizedCategory || (tags.length > 0 ? tags[0] : undefined),
          // Add image if we fetched it
          imageUrl: market.imageUrl || imageData?.image || imageData?.icon,
          // Store all tags in rawData for future use
          rawData: {
            ...market.rawData,
            tags,
            ...(imageData && { image: imageData.image, icon: imageData.icon })
          },
        }
      })
    )

    return [...enrichedMarkets, ...remainingMarkets]
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

    // Parse outcomes (can be string or array, default to Yes/No)
    let outcomes: string[] = ['Yes', 'No']
    if (market.outcomes) {
      try {
        outcomes = typeof market.outcomes === 'string'
          ? JSON.parse(market.outcomes)
          : market.outcomes
      } catch (e) {
        console.warn(`[Polymarket] Failed to parse outcomes for ${market.question}`)
      }
    }

    // Parse clobTokenIds (can be string or array)
    let clobTokenIds: string[] = []
    if (market.clobTokenIds) {
      try {
        clobTokenIds = typeof market.clobTokenIds === 'string'
          ? JSON.parse(market.clobTokenIds)
          : market.clobTokenIds
      } catch (e) {
        console.warn(`[Polymarket] Failed to parse clobTokenIds for ${market.question}`)
      }
    }

    // Use event title if available, otherwise use market question
    // Event title is the broader question, market question is the specific option
    let title = market.question
    let subtitle: string | undefined = undefined

    if (market.events && Array.isArray(market.events) && market.events.length > 0) {
      const event = market.events[0]
      if (event.title && event.title !== market.question) {
        // Event has a broader title - use it as the main title
        title = event.title
        // Extract the specific option from the question
        // e.g., "Will X win?" -> "X"
        const optionMatch = market.question.match(/Will (.+?) (win|be|get|reach|hit|dip to|rise to)/)
        if (optionMatch) {
          subtitle = optionMatch[1]
        }
      }
    }

    return {
      id: conditionId,
      platform: 'polymarket',
      title: title,
      description: market.description || '',
      category: market.category || undefined,
      normalizedCategory: market.category || undefined, // Use API category as normalized category
      price: price,
      probability: price,
      volume24h: volume,
      liquidity: market.liquidityNum ? parseFloat(market.liquidityNum.toString()) : undefined,
      endDate: market.endDateIso ? new Date(market.endDateIso) : undefined,
      slug: market.slug || market.marketSlug || undefined,
      outcomes: outcomes,
      outcomePrices: outcomePrices.length > 0 ? outcomePrices : undefined,
      imageUrl: market.image || market.icon || undefined,
      rawData: {
        ...market,
        numericId: market.id, // Store numeric ID for tag fetching
        clobTokenIds: clobTokenIds, // Store token IDs for price history
        subtitle: subtitle, // Store the option name
        originalQuestion: market.question, // Store original question
      },
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

  /**
   * Get order books for multiple tokens in batch
   */
  async getOrderBooks(tokenIds: string[]): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${this.baseUrl}/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(tokenIds),
      })

      if (!response.ok) {
        console.error('[Polymarket] Error fetching batch order books:', response.status)
        return {}
      }

      return response.json()
    } catch (error) {
      console.error('[Polymarket] Error fetching batch order books:', error)
      return {}
    }
  }

  /**
   * Get prices for multiple tokens in batch
   */
  async getPrices(tokenIds: string[]): Promise<Record<string, { price: number; side: string }>> {
    try {
      const response = await fetch(`${this.baseUrl}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenIds),
      })

      if (!response.ok) {
        console.error('[Polymarket] Error fetching batch prices:', response.status)
        return {}
      }

      return response.json()
    } catch (error) {
      console.error('[Polymarket] Error fetching batch prices:', error)
      return {}
    }
  }

  /**
   * Get top position holders for a market (whale tracking)
   */
  async getHolders(conditionId: string, limit: number = 100): Promise<Array<{
    address: string
    amount: number
    outcome: string
  }>> {
    try {
      const url = new URL('https://data-api.polymarket.com/holders')
      url.searchParams.set('market', conditionId)
      url.searchParams.set('limit', String(limit))

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Polymarket] Error fetching holders:', response.status)
        return []
      }

      const data = await response.json()
      return data || []
    } catch (error) {
      console.error('[Polymarket] Error fetching holders:', error)
      return []
    }
  }

  /**
   * Get all trades across users/markets (market activity)
   */
  async getTrades(params?: {
    limit?: number
    offset?: number
    takerOnly?: boolean
    filterType?: string
    filterAmount?: number
    market?: string
    user?: string
    side?: string
  }): Promise<Array<{
    id: string
    market: string
    asset: string
    side: string
    size: number
    price: number
    timestamp: string
    trader: string
  }>> {
    try {
      const url = new URL('https://data-api.polymarket.com/trades')

      if (params?.limit) url.searchParams.set('limit', String(params.limit))
      if (params?.offset) url.searchParams.set('offset', String(params.offset))
      if (params?.takerOnly) url.searchParams.set('takerOnly', 'true')
      if (params?.market) url.searchParams.set('market', params.market)
      if (params?.user) url.searchParams.set('user', params.user)
      if (params?.side) url.searchParams.set('side', params.side)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Polymarket] Error fetching trades:', response.status)
        return []
      }

      const data = await response.json()
      return data || []
    } catch (error) {
      console.error('[Polymarket] Error fetching trades:', error)
      return []
    }
  }

  /**
   * Get user positions with P&L
   */
  async getPositions(userAddress: string, params?: {
    market?: string
    sizeThreshold?: number
    redeemable?: boolean
    mergeable?: boolean
    limit?: number
    offset?: number
    sortBy?: string
    sortDirection?: 'asc' | 'desc'
  }): Promise<Array<{
    market: string
    asset: string
    size: number
    currentValue: number
    initialValue: number
    cashPnl: number
    percentPnl: number
    avgEntryPrice: number
  }>> {
    try {
      const url = new URL('https://data-api.polymarket.com/positions')
      url.searchParams.set('user', userAddress)

      if (params?.market) url.searchParams.set('market', params.market)
      if (params?.sizeThreshold) url.searchParams.set('sizeThreshold', String(params.sizeThreshold))
      if (params?.limit) url.searchParams.set('limit', String(params.limit))
      if (params?.offset) url.searchParams.set('offset', String(params.offset))
      if (params?.sortBy) url.searchParams.set('sortBy', params.sortBy)
      if (params?.sortDirection) url.searchParams.set('sortDirection', params.sortDirection)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Polymarket] Error fetching positions:', response.status)
        return []
      }

      const data = await response.json()
      return data || []
    } catch (error) {
      console.error('[Polymarket] Error fetching positions:', error)
      return []
    }
  }

  /**
   * Get user's total portfolio value
   */
  async getPortfolioValue(userAddress: string, market?: string): Promise<number> {
    try {
      const url = new URL('https://data-api.polymarket.com/value')
      url.searchParams.set('user', userAddress)
      if (market) url.searchParams.set('market', market)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Polymarket] Error fetching portfolio value:', response.status)
        return 0
      }

      const data = await response.json()
      return data?.value || 0
    } catch (error) {
      console.error('[Polymarket] Error fetching portfolio value:', error)
      return 0
    }
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

  async getPriceHistory(tokenId: string, interval: string = '1d'): Promise<{ timestamp: Date; price: number; volume: number }[]> {
    try {
      // Map interval to appropriate time range and fidelity
      const now = Math.floor(Date.now() / 1000) // Current time in seconds
      let startTs: number
      let fidelity: number // Data point frequency in seconds

      if (interval === '1m' || interval === '5m') {
        // Last hour with 1-minute granularity
        startTs = now - (60 * 60)
        fidelity = 1
      } else if (interval === '1h') {
        // Last day with 1-hour granularity
        startTs = now - (24 * 60 * 60)
        fidelity = 60
      } else if (interval === '6h') {
        // Last week with 6-hour granularity
        startTs = now - (7 * 24 * 60 * 60)
        fidelity = 360
      } else {
        // ALL time - fetch 90 days with 1-day granularity
        // Most markets don't exist longer than this, and API may not return data beyond 90 days
        startTs = now - (90 * 24 * 60 * 60)
        fidelity = 1440
      }

      // Use CLOB API for price history
      const url = `${this.baseUrl}/prices-history?market=${tokenId}&startTs=${startTs}&endTs=${now}&fidelity=${fidelity}`
      console.log(`[Polymarket Client] Fetching price history: ${url}`)
      console.log(`[Polymarket Client] Time range: ${new Date(startTs * 1000).toLocaleString()} to ${new Date(now * 1000).toLocaleString()}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error(`[Polymarket Client] Price history request failed: ${response.status} ${response.statusText}`)
        const errorText = await response.text()
        console.error(`[Polymarket Client] Error response: ${errorText}`)
        return []
      }

      const data = await response.json()
      console.log(`[Polymarket Client] Price history response points: ${data?.history?.length || 0}`)
      console.log(`[Polymarket Client] Raw response data:`, data)

      if (data && Array.isArray(data.history) && data.history.length > 0) {
        const history = data.history.map((point: any) => ({
          timestamp: new Date(point.t * 1000),
          price: point.p,
          volume: point.v || 0
        }))

        console.log(`[Polymarket Client] First point: ${history[0]?.timestamp.toLocaleString()}, Last point: ${history[history.length - 1]?.timestamp.toLocaleString()}`)
        return history
      }

      console.warn(`[Polymarket Client] No history data available for interval ${interval}`)
      return []
    } catch (error) {
      console.error('[Polymarket Client] Error fetching price history:', error)
      return []
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

  /**
   * Fetch events from Polymarket API
   * Events contain their associated markets nested inside
   */
  async getEvents(params?: {
    limit?: number
    offset?: number
    closed?: boolean
    order?: string
    ascending?: boolean
  }): Promise<{ events: any[]; hasMore: boolean; nextOffset?: number }> {
    try {
      const limit = params?.limit || 100
      const offset = params?.offset || 0
      const closed = params?.closed !== undefined ? params.closed : false
      const order = params?.order || 'id'
      const ascending = params?.ascending !== undefined ? params.ascending : false

      const url = new URL('https://gamma-api.polymarket.com/events')
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('order', order)
      url.searchParams.set('ascending', String(ascending))
      url.searchParams.set('closed', String(closed))

      if (offset > 0) {
        url.searchParams.set('offset', String(offset))
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Polymarket] Events API error:', response.status, response.statusText)
        return { events: [], hasMore: false, nextOffset: undefined }
      }

      const events = await response.json()
      
      if (!Array.isArray(events)) {
        console.warn('[Polymarket] Events API returned non-array response')
        return { events: [], hasMore: false, nextOffset: undefined }
      }

      console.log(`[Polymarket] Fetched ${events.length} events from API`)

      // Check if there are more events (if we got the full limit, there might be more)
      const hasMore = events.length === limit

      return {
        events,
        hasMore,
        nextOffset: hasMore ? offset + limit : undefined,
      }
    } catch (error) {
      console.error('[Polymarket] Error fetching events:', error)
      return { events: [], hasMore: false, nextOffset: undefined }
    }
  }

  /**
   * Get a specific event by ID or slug
   */
  async getEventByIdOrSlug(idOrSlug: string): Promise<any | null> {
    try {
      // Try by slug first
      const url = new URL(`https://gamma-api.polymarket.com/events/slug/${idOrSlug}`)
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (response.ok) {
        const event = await response.json()
        return event
      }

      // If slug fails, try by ID
      const idUrl = new URL(`https://gamma-api.polymarket.com/events/${idOrSlug}`)
      const idResponse = await fetch(idUrl.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (idResponse.ok) {
        const event = await idResponse.json()
        return event
      }

      return null
    } catch (error) {
      console.error('[Polymarket] Error fetching event by ID/slug:', error)
      return null
    }
  }

  async getEventDetails(slugOrId: string): Promise<EventData | null> {
    try {
      // Try to get event directly first (new approach)
      const event = await this.getEventByIdOrSlug(slugOrId)
      if (event && event.markets && Array.isArray(event.markets)) {
        // Use the event's first market for event data
        const primaryMarket = event.markets[0]
        if (primaryMarket) {
          const eventData: EventData = {
            id: event.id?.toString() || slugOrId,
            eventId: event.id?.toString() || slugOrId,
            probability: parseFloat(primaryMarket.outcomePrices?.[0] || '0'),
            liquidity: parseFloat(primaryMarket.liquidityNum?.toString() || '0'),
            question: event.question || primaryMarket.question || '',
            backgroundInfo: event.description || primaryMarket.description || '',
            resolutionCriteria: event.description || primaryMarket.description || '',
            dateRangeStart: event.startDate || primaryMarket.startDate || new Date().toISOString(),
            dateRangeEnd: event.endDate || primaryMarket.endDateIso || new Date().toISOString(),
            active: event.active !== false,
            closed: event.closed === true,
            searchQueries: undefined,
            rankedArticles: undefined,
          }
          return eventData
        }
      }

      // Fallback to old method: Fetch market details from Gamma API
      const url = new URL('https://gamma-api.polymarket.com/markets')
      url.searchParams.set('slug', slugOrId)
      url.searchParams.set('limit', '20') // Get related markets in same event

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error('[Polymarket] Event details request failed:', response.status)
        return null
      }

      const markets = await response.json()
      if (!Array.isArray(markets) || markets.length === 0) {
        return null
      }

      // Use first market as primary event data
      const primaryMarket = markets[0]

      // Transform to EventData structure
      const eventData: EventData = {
        id: primaryMarket.id?.toString() || slugOrId,
        eventId: primaryMarket.conditionId || slugOrId,
        probability: parseFloat(primaryMarket.outcomePrices?.[0] || '0'),
        liquidity: parseFloat(primaryMarket.liquidityNum?.toString() || '0'),
        question: primaryMarket.question || '',
        backgroundInfo: primaryMarket.description || '',
        resolutionCriteria: primaryMarket.description || '',
        dateRangeStart: primaryMarket.startDate || new Date().toISOString(),
        dateRangeEnd: primaryMarket.endDateIso || new Date().toISOString(),
        active: primaryMarket.active === true,
        closed: primaryMarket.closed === true,
        searchQueries: undefined, // Would need to generate these
        rankedArticles: undefined, // Would need to fetch from news APIs
      }

      return eventData
    } catch (error) {
      console.error('[Polymarket] Error fetching event details:', error)
      return null
    }
  }

  async getCandlesticksForMarkets(
    slugs: string[],
    interval: string = '1h'
  ): Promise<Record<string, Candlestick[]>> {
    try {
      console.log(`[Polymarket] Fetching candlesticks for ${slugs.length} markets`)

      // Fetch candlesticks for each market in parallel
      const candlesticksPromises = slugs.map(async (slug) => {
        try {
          // First, fetch market details to get the token ID
          const url = new URL('https://gamma-api.polymarket.com/markets')
          url.searchParams.set('slug', slug)
          url.searchParams.set('limit', '1')

          const marketResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          })

          if (!marketResponse.ok) {
            console.warn(`[Polymarket] Failed to fetch market for slug ${slug}`)
            return { slug, candlesticks: [] }
          }

          const markets = await marketResponse.json()
          if (!Array.isArray(markets) || markets.length === 0) {
            return { slug, candlesticks: [] }
          }

          const market = markets[0]
          const tokenId = market.clobTokenIds?.[0] || market.tokens?.[0]

          if (!tokenId) {
            console.warn(`[Polymarket] No token ID found for slug ${slug}`)
            return { slug, candlesticks: [] }
          }

          // Fetch price history and convert to candlesticks
          const priceHistory = await this.getPriceHistory(tokenId, interval)

          // Convert price history to candlesticks
          const candlesticks = this.convertPriceHistoryToCandlesticks(priceHistory, interval)

          return { slug, candlesticks }
        } catch (error) {
          console.error(`[Polymarket] Error fetching candlesticks for ${slug}:`, error)
          return { slug, candlesticks: [] }
        }
      })

      const results = await Promise.all(candlesticksPromises)

      // Convert array of results to map keyed by slug
      const candlesticksMap: Record<string, Candlestick[]> = {}
      for (const result of results) {
        candlesticksMap[result.slug] = result.candlesticks
      }

      console.log(`[Polymarket] Fetched candlesticks for ${Object.keys(candlesticksMap).length} markets`)
      return candlesticksMap
    } catch (error) {
      console.error('[Polymarket] Error fetching candlesticks for markets:', error)
      return {}
    }
  }

  private convertPriceHistoryToCandlesticks(
    priceHistory: { timestamp: Date; price: number; volume: number }[],
    interval: string
  ): Candlestick[] {
    if (priceHistory.length === 0) {
      return []
    }

    // Determine interval duration in milliseconds
    let intervalMs: number
    if (interval === '1m') intervalMs = 60 * 1000
    else if (interval === '5m') intervalMs = 5 * 60 * 1000
    else if (interval === '1h') intervalMs = 60 * 60 * 1000
    else if (interval === '6h') intervalMs = 6 * 60 * 60 * 1000
    else intervalMs = 24 * 60 * 60 * 1000 // 1d default

    const candlesticks: Candlestick[] = []
    let currentBucket: typeof priceHistory = []
    let bucketStartTime = Math.floor(priceHistory[0].timestamp.getTime() / intervalMs) * intervalMs

    for (const point of priceHistory) {
      const pointBucket = Math.floor(point.timestamp.getTime() / intervalMs) * intervalMs

      if (pointBucket !== bucketStartTime) {
        // Create candlestick from current bucket
        if (currentBucket.length > 0) {
          const prices = currentBucket.map(p => p.price)
          candlesticks.push({
            timestamp: new Date(bucketStartTime),
            open: currentBucket[0].price,
            high: Math.max(...prices),
            low: Math.min(...prices),
            close: currentBucket[currentBucket.length - 1].price,
            volume: currentBucket.reduce((sum, p) => sum + p.volume, 0),
          })
        }

        // Start new bucket
        currentBucket = [point]
        bucketStartTime = pointBucket
      } else {
        currentBucket.push(point)
      }
    }

    // Add final bucket
    if (currentBucket.length > 0) {
      const prices = currentBucket.map(p => p.price)
      candlesticks.push({
        timestamp: new Date(bucketStartTime),
        open: currentBucket[0].price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: currentBucket[currentBucket.length - 1].price,
        volume: currentBucket.reduce((sum, p) => sum + p.volume, 0),
      })
    }

    return candlesticks
  }
}
