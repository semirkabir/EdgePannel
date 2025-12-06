import { Platform } from './market'

export interface TradeOrder {
  platform: Platform
  marketId: string
  side: 'buy' | 'sell'
  quantity: number
  price?: number // Optional for market orders
  orderType: 'limit' | 'market'
}

export interface TradeExecution {
  orderId: string
  status: 'pending' | 'filled' | 'cancelled' | 'failed'
  filledQuantity?: number
  averagePrice?: number
  executedAt?: Date
  error?: string
}

export interface Portfolio {
  totalValue: number
  positions: Position[]
  cashBalance: {
    polymarket?: number
    kalshi?: number
  }
}

export interface Position {
  platform: Platform
  marketId: string
  marketTitle: string
  quantity: number
  averagePrice: number
  currentPrice: number
  unrealizedPnl: number
}


