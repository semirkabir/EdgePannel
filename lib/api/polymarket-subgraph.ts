/**
 * Polymarket Subgraph Client
 * 
 * Uses Goldsky-hosted Polymarket subgraphs for real-time aggregate data:
 * - Positions: User position tracking with P&L
 * - Activity: Market activity history
 * - Open Interest: OI data per market
 * - Orders: Orderbook data
 * - PNL: Profit & loss tracking
 * 
 * @see https://docs.polymarket.com/developers/subgraph/overview
 */

const SUBGRAPH_ENDPOINTS = {
  positions: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn',
  activity: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn',
  openInterest: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/oi-subgraph/0.0.6/gn',
  orders: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn',
  pnl: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn',
} as const

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

export class PolymarketSubgraphClient {
  private async query<T>(
    endpoint: keyof typeof SUBGRAPH_ENDPOINTS,
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    const url = SUBGRAPH_ENDPOINTS[endpoint]

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: variables || {},
        }),
        // Cache for 10 seconds - subgraphs update frequently
        next: { revalidate: 10 },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`[Subgraph ${endpoint}] HTTP error:`, response.status, errorText)
        throw new Error(`Subgraph ${endpoint} error: ${response.status} ${response.statusText}`)
      }

      const result: GraphQLResponse<T> = await response.json()

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => e.message).join(', ')
        console.error(`[Subgraph ${endpoint}] GraphQL errors:`, errorMessages)
        console.error(`[Subgraph ${endpoint}] Query:`, query)
        console.error(`[Subgraph ${endpoint}] Variables:`, variables)
        throw new Error(`GraphQL errors: ${errorMessages}`)
      }

      if (!result.data) {
        console.warn(`[Subgraph ${endpoint}] No data returned, but no errors either`)
        // Return empty data structure based on query type
        return {} as T
      }

      return result.data
    } catch (error: any) {
      console.error(`[Subgraph ${endpoint}] Error:`, error)
      console.error(`[Subgraph ${endpoint}] Query:`, query)
      console.error(`[Subgraph ${endpoint}] Variables:`, variables)
      throw error
    }
  }

  /**
   * Get user positions with detailed P&L from Positions subgraph
   */
  async getUserPositions(userAddress: string, options?: {
    market?: string
    limit?: number
    skip?: number
  }): Promise<Array<{
    id: string
    user: string
    market: string
    outcome: string
    size: string
    avgPrice: string
    currentPrice: string
    pnl: string
    pnlPercent: string
    timestamp: string
  }>> {
    const query = `
      query GetUserPositions($user: String!, $market: String, $first: Int, $skip: Int) {
        positions(
          where: { 
            user: $user
            ${options?.market ? 'market: $market' : ''}
          }
          first: $first
          skip: $skip
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          user
          market
          outcome
          size
          avgPrice
          currentPrice
          pnl
          pnlPercent
          timestamp
        }
      }
    `

    const data = await this.query<{
      positions: Array<{
        id: string
        user: string
        market: string
        outcome: string
        size: string
        avgPrice: string
        currentPrice: string
        pnl: string
        pnlPercent: string
        timestamp: string
      }>
    }>('positions', query, {
      user: userAddress.toLowerCase(),
      market: options?.market,
      first: options?.limit || 100,
      skip: options?.skip || 0,
    })

    return data.positions
  }

  /**
   * Get market activity from Activity subgraph
   */
  async getMarketActivity(marketId: string, options?: {
    limit?: number
    skip?: number
    type?: 'trade' | 'order' | 'all'
  }): Promise<Array<{
    id: string
    type: string
    market: string
    user: string
    amount: string
    price: string
    timestamp: string
    txHash: string
  }>> {
    const typeFilter = options?.type && options.type !== 'all' 
      ? `type: "${options.type}"` 
      : ''

    const query = `
      query GetMarketActivity($market: String!, $first: Int, $skip: Int) {
        activities(
          where: { 
            market: $market
            ${typeFilter}
          }
          first: $first
          skip: $skip
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          type
          market
          user
          amount
          price
          timestamp
          txHash
        }
      }
    `

    const data = await this.query<{
      activities: Array<{
        id: string
        type: string
        market: string
        user: string
        amount: string
        price: string
        timestamp: string
        txHash: string
      }>
    }>('activity', query, {
      market: marketId,
      first: options?.limit || 50,
      skip: options?.skip || 0,
    })

    return data.activities
  }

  /**
   * Get Open Interest for a market from OI subgraph
   * Note: The actual schema may vary. This tries multiple possible schema formats.
   * Returns null if data is not available (allows graceful degradation in UI)
   */
  async getOpenInterest(marketId: string): Promise<{
    market: string
    yesOI: string
    noOI: string
    totalOI: string
    timestamp: string
  } | null> {
    // Normalize market ID (lowercase, remove 0x prefix if needed)
    const normalizedMarketId = marketId.toLowerCase().startsWith('0x') 
      ? marketId.toLowerCase() 
      : marketId.toLowerCase()

    // Try multiple possible query formats based on actual Polymarket subgraph schema
    // The subgraph might use different field names for filtering (market, conditionId, id)
    const queries = [
      // Format 1: Query by conditionId (most likely - conditionId is the market identifier)
      `
        query GetOpenInterest($conditionId: String!) {
          marketOpenInterests(
            where: { conditionId: $conditionId }
            first: 1
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            conditionId
            market
            yesOI
            noOI
            totalOI
            value
            timestamp
          }
        }
      `,
      // Format 2: Query by market field (alternative)
      `
        query GetOpenInterest($market: String!) {
          marketOpenInterests(
            where: { market: $market }
            first: 1
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            conditionId
            market
            yesOI
            noOI
            totalOI
            value
            timestamp
          }
        }
      `,
      // Format 3: Query by id field
      `
        query GetOpenInterest($id: String!) {
          marketOpenInterests(
            where: { id: $id }
            first: 1
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            conditionId
            market
            yesOI
            noOI
            totalOI
            value
            timestamp
          }
        }
      `,
      // Format 4: Try openInterests entity (alternative naming)
      `
        query GetOpenInterest($market: String!) {
          openInterests(
            where: { market: $market }
            first: 1
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            market
            yesOI
            noOI
            totalOI
            timestamp
          }
        }
      `,
    ]

    // First, try to get a sample of data to verify the subgraph has data and check the schema
    try {
      const sampleQuery = `
        query SampleOpenInterest {
          marketOpenInterests(first: 1, orderBy: timestamp, orderDirection: desc) {
            id
            conditionId
            market
            yesOI
            noOI
            totalOI
            value
            timestamp
          }
        }
      `
      const sampleData = await this.query<any>('openInterest', sampleQuery)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Open Interest] Sample data from subgraph:', JSON.stringify(sampleData).substring(0, 300))
      }
    } catch (sampleError: any) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Open Interest] Could not fetch sample data:', sampleError.message)
      }
    }

    for (let i = 0; i < queries.length; i++) {
      try {
        // Try different variable names based on query format
        const variables = i === 0 
          ? { conditionId: normalizedMarketId }  // Format 1 uses conditionId
          : i === 2
          ? { id: normalizedMarketId }  // Format 3 uses id
          : { market: normalizedMarketId }  // Formats 2 and 4 use market
        
        const data = await this.query<any>('openInterest', queries[i], variables)

        // Log what we got back (in dev mode)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Open Interest] Query ${i + 1} result:`, JSON.stringify(data).substring(0, 200))
        }

        // Check for marketOpenInterests (most likely format)
        if (data.marketOpenInterests && Array.isArray(data.marketOpenInterests) && data.marketOpenInterests.length > 0) {
          const oi = data.marketOpenInterests[0]
          // Handle different field names
          const totalOI = oi.totalOI || oi.total_oi || oi.value || oi.amount || '0'
          const yesOI = oi.yesOI || oi.yes_oi || '0'
          const noOI = oi.noOI || oi.no_oi || '0'
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Open Interest] Found data for ${normalizedMarketId}:`, { totalOI, yesOI, noOI })
          }
          
          return {
            market: oi.market || normalizedMarketId,
            yesOI: String(yesOI),
            noOI: String(noOI),
            totalOI: String(totalOI),
            timestamp: oi.timestamp || new Date().toISOString(),
          }
        }

        // Check for openInterests (alternative format)
        if (data.openInterests && Array.isArray(data.openInterests) && data.openInterests.length > 0) {
          const oi = data.openInterests[0]
          return {
            market: oi.market || normalizedMarketId,
            yesOI: String(oi.yesOI || oi.yes_oi || '0'),
            noOI: String(oi.noOI || oi.no_oi || '0'),
            totalOI: String(oi.totalOI || oi.total_oi || oi.amount || oi.value || '0'),
            timestamp: oi.timestamp || new Date().toISOString(),
          }
        }

        // If we got data but no results, log it
        if (process.env.NODE_ENV === 'development' && data) {
          console.warn(`[Open Interest] Query ${i + 1} returned data but no openInterests/marketOpenInterests:`, Object.keys(data))
        }
      } catch (error: any) {
        // Log the error for this query format
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Open Interest] Query ${i + 1} failed:`, error.message)
        }
        
        // Try next query format
        if (i === queries.length - 1) {
          // Last query failed, log and return null
          console.warn(`[Open Interest] All query formats failed for market ${normalizedMarketId}:`, error.message)
          return null
        }
        continue
      }
    }

    return null
  }

  /**
   * Get Open Interest for multiple markets
   */
  async getMultipleOpenInterest(marketIds: string[]): Promise<Record<string, {
    yesOI: number
    noOI: number
    totalOI: number
  }>> {
    const query = `
      query GetMultipleOpenInterest($markets: [String!]!) {
        openInterests(
          where: { market_in: $markets }
          orderBy: timestamp
          orderDirection: desc
        ) {
          market
          yesOI
          noOI
          totalOI
        }
      }
    `

    const data = await this.query<{
      openInterests: Array<{
        market: string
        yesOI: string
        noOI: string
        totalOI: string
      }>
    }>('openInterest', query, {
      markets: marketIds,
    })

    // Group by market (take latest for each)
    const result: Record<string, { yesOI: number; noOI: number; totalOI: number }> = {}
    const seen = new Set<string>()

    for (const oi of data.openInterests) {
      if (!seen.has(oi.market)) {
        seen.add(oi.market)
        result[oi.market] = {
          yesOI: parseFloat(oi.yesOI),
          noOI: parseFloat(oi.noOI),
          totalOI: parseFloat(oi.totalOI),
        }
      }
    }

    return result
  }

  /**
   * Get orderbook data from Orders subgraph
   */
  async getOrderBook(marketId: string, side?: 'buy' | 'sell'): Promise<{
    bids: Array<{ price: string; size: string; user: string }>
    asks: Array<{ price: string; size: string; user: string }>
  }> {
    const sideFilter = side ? `side: "${side.toUpperCase()}"` : ''

    const query = `
      query GetOrderBook($market: String!) {
        bids: orders(
          where: { 
            market: $market
            side: "BUY"
            status: "OPEN"
          }
          orderBy: price
          orderDirection: desc
          first: 20
        ) {
          price
          size
          user
        }
        asks: orders(
          where: { 
            market: $market
            side: "SELL"
            status: "OPEN"
          }
          orderBy: price
          orderDirection: asc
          first: 20
        ) {
          price
          size
          user
        }
      }
    `

    const data = await this.query<{
      bids: Array<{ price: string; size: string; user: string }>
      asks: Array<{ price: string; size: string; user: string }>
    }>('orders', query, {
      market: marketId,
    })

    return data
  }

  /**
   * Get user P&L summary from PNL subgraph
   */
  async getUserPNL(userAddress: string, options?: {
    market?: string
    startTime?: number
    endTime?: number
  }): Promise<{
    totalPnl: string
    realizedPnl: string
    unrealizedPnl: string
    winRate: string
    totalTrades: string
  } | null> {
    const query = `
      query GetUserPNL($user: String!, $market: String, $startTime: BigInt, $endTime: BigInt) {
        pnlSummaries(
          where: { 
            user: $user
            ${options?.market ? 'market: $market' : ''}
            ${options?.startTime ? 'timestamp_gte: $startTime' : ''}
            ${options?.endTime ? 'timestamp_lte: $endTime' : ''}
          }
          first: 1
          orderBy: timestamp
          orderDirection: desc
        ) {
          totalPnl
          realizedPnl
          unrealizedPnl
          winRate
          totalTrades
        }
      }
    `

    const data = await this.query<{
      pnlSummaries: Array<{
        totalPnl: string
        realizedPnl: string
        unrealizedPnl: string
        winRate: string
        totalTrades: string
      }>
    }>('pnl', query, {
      user: userAddress.toLowerCase(),
      market: options?.market,
      startTime: options?.startTime?.toString(),
      endTime: options?.endTime?.toString(),
    })

    return data.pnlSummaries[0] || null
  }

  /**
   * Get recent activity across all markets (for activity feed)
   */
  async getRecentActivity(options?: {
    limit?: number
    skip?: number
    minAmount?: string
  }): Promise<Array<{
    id: string
    type: string
    market: string
    user: string
    amount: string
    price: string
    timestamp: string
    txHash: string
  }>> {
    const query = `
      query GetRecentActivity($first: Int, $skip: Int, $minAmount: String) {
        activities(
          ${options?.minAmount ? 'where: { amount_gte: $minAmount }' : ''}
          first: $first
          skip: $skip
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          type
          market
          user
          amount
          price
          timestamp
          txHash
        }
      }
    `

    const data = await this.query<{
      activities: Array<{
        id: string
        type: string
        market: string
        user: string
        amount: string
        price: string
        timestamp: string
        txHash: string
      }>
    }>('activity', query, {
      first: options?.limit || 100,
      skip: options?.skip || 0,
      minAmount: options?.minAmount,
    })

    return data.activities
  }
}

