import { Configuration, MarketApi, PortfolioApi, OrdersApi, Market } from 'kalshi-typescript'
import crypto from 'crypto'
import { Market as AppMarket, MarketDetails } from '@/types/market'

interface KalshiCredentials {
  accessKeyId: string
  privateKey: string
}

export class KalshiClient {
  private marketApi: MarketApi
  private portfolioApi: PortfolioApi
  private ordersApi: OrdersApi

  constructor(credentials: KalshiCredentials, useDemo: boolean = false) {
    const config = new Configuration({
      basePath: useDemo
        ? 'https://demo-api.kalshi.com/trade-api/v2'
        : 'https://api.elections.kalshi.com/trade-api/v2',
      apiKey: credentials.accessKeyId,
      privateKeyPem: credentials.privateKey,
    })

    this.marketApi = new MarketApi(config)
    this.portfolioApi = new PortfolioApi(config)
    this.ordersApi = new OrdersApi(config)
  }

  async getMarkets(params?: {
    limit?: number
    cursor?: string
    event_ticker?: string
    series_ticker?: string
  }): Promise<AppMarket[]> {
    try {
      const response = await this.marketApi.getMarkets(
        params?.limit,
        params?.cursor,
        params?.event_ticker,
        params?.series_ticker
      )

      return this.transformMarkets(response.data.markets || [])
    } catch (error: any) {
      console.error('[Kalshi Client] Error fetching markets:', error.message || error)
      return []
    }
  }

  async getMarket(ticker: string): Promise<MarketDetails> {
    const response = await this.marketApi.getMarket(ticker)
    return this.transformMarketDetails(response.data.market)
  }

  async getPortfolio(): Promise<any> {
    const response = await this.portfolioApi.getBalance()
    return response.data
  }

  async createOrder(order: {
    ticker: string
    side: 'yes' | 'no'
    action: 'buy' | 'sell'
    count: number
    type: 'limit' | 'market'
    price?: number
  }): Promise<any> {
    const response = await this.ordersApi.createOrder({
      ticker: order.ticker,
      side: order.side === 'yes' ? 'yes' : 'no', // Ensure type match if needed
      action: order.action,
      count: order.count,
      type: order.type,
      yes_price: order.side === 'yes' ? order.price : undefined,
      no_price: order.side === 'no' ? order.price : undefined,
      client_order_id: crypto.randomUUID(), // Recommended to add client_order_id
    })
    return response.data
  }

  private transformMarkets(markets: any[]): AppMarket[] {
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

  private transformMarket(market: any): AppMarket {
    const now = new Date()
    let endDate: Date | undefined

    if (market.expiration_time) {
      endDate = new Date(market.expiration_time)
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

