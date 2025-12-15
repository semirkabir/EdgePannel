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
  slug?: string // URL slug for market page
  ticker?: string // Kalshi ticker
  outcomes?: string[] // Possible outcomes (Yes/No or custom)
  outcomePrices?: number[] // Prices for each outcome
  imageUrl?: string // Market image/icon URL
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
  eventData?: EventData
  candlesticks?: Candlestick[]
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

export interface RankedArticle {
  link: string
  title: string
  author: string | null
  summary: string
  clean_url: string | null
  full_text?: string
}

export interface SearchQueries {
  gnews: string[]
  newscatcher: string[]
}

export interface EventData {
  id: string
  eventId: string
  probability: number
  liquidity: number
  question: string
  backgroundInfo: string
  resolutionCriteria: string
  dateRangeStart: string
  dateRangeEnd: string
  active: boolean
  closed: boolean
  searchQueries?: SearchQueries
  rankedArticles?: RankedArticle[]
}

export interface Candlestick {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

