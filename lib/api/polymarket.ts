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
  }): Promise<Market[]> {
    // Using Polymarket's subgraph API
    const query = `
      query GetMarkets($limit: Int, $offset: Int) {
        markets(
          first: $limit
          skip: $offset
          where: { closed: ${params?.closed ? 'true' : 'false'} }
          orderBy: volume
          orderDirection: desc
        ) {
          id
          question
          description
          outcomes
          conditionId
          endDate
          volume
          liquidity
          marketMakerAddresses
        }
      }
    `

    const response = await fetch('https://api.thegraph.com/subgraphs/name/polymarket/polymarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          limit: params?.limit || 100,
          offset: params?.offset || 0,
        },
      }),
    })

    const data = await response.json()
    return this.transformMarkets(data.data?.markets || [])
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
    return {
      id: market.id || market.conditionId,
      platform: 'polymarket',
      title: market.question,
      description: market.description,
      probability: market.lastPrice ? parseFloat(market.lastPrice) : undefined,
      price: market.lastPrice ? parseFloat(market.lastPrice) : undefined,
      volume24h: market.volume ? parseFloat(market.volume) : undefined,
      liquidity: market.liquidity ? parseFloat(market.liquidity) : undefined,
      endDate: market.endDate ? new Date(parseInt(market.endDate) * 1000) : undefined,
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

