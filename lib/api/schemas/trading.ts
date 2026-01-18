import { z } from 'zod'
import {
  PlatformSchema,
  MarketIdSchema,
  TradeSideSchema,
  OrderTypeSchema,
  PositiveNumberSchema,
} from './common'

/**
 * Trading-related validation schemas
 */

// Trade order request
export const TradeOrderSchema = z.object({
  platform: PlatformSchema,
  marketId: MarketIdSchema,
  side: TradeSideSchema,
  quantity: PositiveNumberSchema,
  price: PositiveNumberSchema.optional(),
  orderType: OrderTypeSchema.default('market'),
}).refine(
  (data) => {
    // If order type is limit, price is required
    if (data.orderType === 'limit') {
      return data.price !== undefined && data.price > 0
    }
    return true
  },
  { message: 'Price is required for limit orders' }
)

// Portfolio positions query
export const PortfolioPositionsQuerySchema = z.object({
  platform: z.enum(['kalshi', 'polymarket', 'combined']).default('combined'),
})

// Portfolio value query
export const PortfolioValueQuerySchema = z.object({
  address: z.string()
    .trim()
    .min(1, 'Address is required')
    .max(100, 'Address too long')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
    .optional(),
})

// Trade history query
export const TradeHistoryQuerySchema = z.object({
  platform: z.enum(['kalshi', 'polymarket', 'combined']).default('combined'),
  timeRange: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
  marketId: MarketIdSchema.optional(),
})

// Portfolio history query
export const PortfolioHistoryQuerySchema = z.object({
  platform: z.enum(['kalshi', 'polymarket', 'combined']).default('combined'),
  timeRange: z.enum(['24h', '7d', '30d', '90d', 'all']).default('30d'),
})

// Portfolio snapshot body schema
export const PortfolioSnapshotSchema = z.object({
  platform: z.enum(['kalshi', 'polymarket', 'combined']),
  totalValue: z.number(),
  totalPnl: z.number(),
  totalExposure: z.number().optional(),
  positionCount: z.number().int().min(0),
  positions: z.array(z.object({
    ticker: z.string().optional(),
    marketId: MarketIdSchema,
    marketTitle: z.string().optional(),
    size: z.number(),
    entryPrice: z.number().optional(),
    currentPrice: z.number().optional(),
    realizedPnl: z.number().optional(),
    unrealizedPnl: z.number().optional(),
  })).optional(),
})
