import crypto from 'crypto'
import { Market, MarketDetails } from '@/types/market'

interface KalshiCredentials {
  accessKeyId: string
  privateKey: string
}

interface KalshiApiResponse<T> {
  status: string
  data?: T
  error?: string
}

export class KalshiClient {
  private accessKeyId: string
  private privateKey: string
  private baseUrl: string

  constructor(credentials: KalshiCredentials, useDemo: boolean = false) {
    this.accessKeyId = credentials.accessKeyId
    this.privateKey = credentials.privateKey
    this.baseUrl = useDemo
      ? 'https://demo-api.kalshi.com/trade-api/v2'
      : 'https://api.elections.kalshi.com/trade-api/v2'
  }

  private generateSignature(timestamp: string, method: string, path: string): string {
    const message = `${timestamp}${method}${path}`
    const key = crypto.createPrivateKey({
      key: this.privateKey,
      format: 'pem',
    })
    
    const signature = crypto.sign('RSA-SHA256', Buffer.from(message), {
      key,
      padding: (crypto.constants as any).RSA_PSS_PADDING || crypto.constants.RSA_PKCS1_PADDING,
      saltLength: (crypto.constants as any).RSA_PSS_SALTLEN_MAX_SIGN || 32,
    })

    return signature.toString('base64')
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const timestamp = Date.now().toString()
    const signature = this.generateSignature(timestamp, method, path)

    const headers: HeadersInit = {
      'KALSHI-ACCESS-KEY': this.accessKeyId,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, options)
    } catch (fetchError: any) {
      console.error(`[Kalshi Client] Fetch failed:`, fetchError.message)
      throw new Error(`Kalshi API fetch failed: ${fetchError.message}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Kalshi Client] HTTP error ${response.status}:`, errorText)
      throw new Error(`Kalshi API HTTP error: ${response.status} ${response.statusText}`)
    }

    const data: KalshiApiResponse<T> = await response.json()

    if (data.status !== 'ok') {
      console.error('[Kalshi Client] API error response:', data)
      throw new Error(data.error || `Kalshi API error: ${data.status}`)
    }

    return data.data as T
  }

  async getMarkets(params?: {
    limit?: number
    cursor?: string
    event_ticker?: string
    series_ticker?: string
  }): Promise<Market[]> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.cursor) queryParams.append('cursor', params.cursor)
      if (params?.event_ticker) queryParams.append('event_ticker', params.event_ticker)
      if (params?.series_ticker) queryParams.append('series_ticker', params.series_ticker)

      const path = `/markets?${queryParams.toString()}`
      const data = await this.request<any>('GET', path)

      return this.transformMarkets(data.markets || [])
    } catch (error: any) {
      console.error('[Kalshi Client] Error fetching markets:', error.message || error)
      return [] // Return empty array instead of throwing
    }
  }

  async getMarket(ticker: string): Promise<MarketDetails> {
    const data = await this.request<any>('GET', `/markets/${ticker}`)
    return this.transformMarketDetails(data.market)
  }

  async getPortfolio(): Promise<any> {
    return this.request<any>('GET', '/portfolio')
  }

  async createOrder(order: {
    ticker: string
    side: 'yes' | 'no'
    action: 'buy' | 'sell'
    count: number
    type: 'limit' | 'market'
    price?: number
  }): Promise<any> {
    return this.request<any>('POST', '/portfolio/orders', order)
  }

  private transformMarkets(markets: any[]): Market[] {
    const now = new Date()
    return markets
      .map(m => this.transformMarket(m))
      .filter(m => {
        // Filter out expired markets
        if (m.endDate) {
          const endDate = m.endDate instanceof Date ? m.endDate : new Date(m.endDate)
          // Only include markets that haven't expired or expired less than 1 day ago
          if (endDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
            return false
          }
        }
        
        // Filter out markets with invalid prices (resolved)
        if (m.price === undefined || m.price <= 0 || m.price >= 1) {
          return false
        }
        
        // Filter out markets with old years in title
        if (m.title) {
          const yearMatch = m.title.match(/\b(20\d{2})\b/)
          if (yearMatch) {
            const year = parseInt(yearMatch[1])
            const currentYear = now.getFullYear()
            if (year < currentYear - 1) {
              return false
            }
          }
        }
        
        return true
      })
      .sort((a, b) => {
        // Sort by end date (most recent first)
        if (a.endDate && b.endDate) {
          const aDate = a.endDate instanceof Date ? a.endDate : new Date(a.endDate)
          const bDate = b.endDate instanceof Date ? b.endDate : new Date(b.endDate)
          return bDate.getTime() - aDate.getTime()
        }
        if (a.endDate) return -1
        if (b.endDate) return 1
        // Then by volume
        if (a.volume24h && b.volume24h) {
          return b.volume24h - a.volume24h
        }
        return 0
      })
  }

  private transformMarket(market: any): Market {
    const now = new Date()
    let endDate: Date | undefined
    
    if (market.expiration_time) {
      endDate = new Date(market.expiration_time)
      // Filter out markets that expired more than 1 day ago
      if (endDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
        // Return null would require changing return type, so we'll filter later
      }
    }

    return {
      id: market.ticker,
      platform: 'kalshi',
      title: market.title || market.subtitle,
      description: market.description,
      category: market.category,
      probability: market.last_price ? market.last_price / 100 : undefined,
      price: market.last_price ? market.last_price / 100 : undefined,
      volume24h: market.volume_24h,
      liquidity: market.liquidity,
      endDate: endDate,
      rawData: market,
    }
  }

  private transformMarketDetails(market: any): MarketDetails {
    const base = this.transformMarket(market)
    return {
      ...base,
      priceHistory: market.price_history?.map((p: any) => ({
        timestamp: new Date(p.timestamp),
        price: p.price / 100,
        volume: p.volume || 0,
      })),
      orderBook: market.orderbook ? {
        bids: market.orderbook.bids?.map((b: any) => ({
          price: b.price / 100,
          quantity: b.count,
        })) || [],
        asks: market.orderbook.asks?.map((a: any) => ({
          price: a.price / 100,
          quantity: a.count,
        })) || [],
      } : undefined,
    }
  }
}

