export type Platform = 'polymarket' | 'kalshi'

export interface Market {
  id: string
  platform: Platform
  title: string
  description?: string
  category?: string
  normalizedCategory?: string
  outcome?: string
  probability?: number
  price?: number
  volume24h?: number
  liquidity?: number
  endDate?: Date
  location?: {
    country?: string
    region?: string
    city?: string
    coordinates?: {
      lat: number
      lng: number
    }
  }
  rawData?: any
  isBreakingNews?: boolean
  isLivePrediction?: boolean
  keywords?: string[]
}

export interface MarketComparison {
  markets: Market[]
  discrepancy?: number
  arbitrageOpportunity?: boolean
  averagePrice?: number
}

export interface MarketDetails extends Market {
  priceHistory?: PricePoint[]
  orderBook?: OrderBook
  relatedMarkets?: Market[]
}

export interface PricePoint {
  timestamp: Date
  price: number
  volume: number
}

export interface OrderBook {
  bids: Order[]
  asks: Order[]
}

export interface Order {
  price: number
  quantity: number
}

