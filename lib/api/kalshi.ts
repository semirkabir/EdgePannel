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
      : 'https://trade-api.kalshi.com/trade-api/v2'
  }

  private generateSignature(timestamp: string, method: string, path: string): string {
    const message = `${timestamp}${method}${path}`
    const key = crypto.createPrivateKey({
      key: this.privateKey,
      format: 'pem',
    })
    
    const signature = crypto.sign('RSA-SHA256', Buffer.from(message), {
      key,
      padding: crypto.constants.RSA_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
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

    const response = await fetch(`${this.baseUrl}${path}`, options)
    const data: KalshiApiResponse<T> = await response.json()

    if (!response.ok || data.status !== 'ok') {
      throw new Error(data.error || `Kalshi API error: ${response.statusText}`)
    }

    return data.data as T
  }

  async getMarkets(params?: {
    limit?: number
    cursor?: string
    event_ticker?: string
    series_ticker?: string
  }): Promise<Market[]> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.cursor) queryParams.append('cursor', params.cursor)
    if (params?.event_ticker) queryParams.append('event_ticker', params.event_ticker)
    if (params?.series_ticker) queryParams.append('series_ticker', params.series_ticker)

    const path = `/markets?${queryParams.toString()}`
    const data = await this.request<any>('GET', path)

    return this.transformMarkets(data.markets || [])
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
    return markets.map(m => this.transformMarket(m))
  }

  private transformMarket(market: any): Market {
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
      endDate: market.expiration_time ? new Date(market.expiration_time) : undefined,
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

