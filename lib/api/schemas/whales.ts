import { z } from 'zod'
import {
  MarketIdSchema,
  TradeSideSchema,
  PaginationSchema,
  PositiveNumberSchema,
} from './common'

/**
 * Whale tracking validation schemas
 */

// Whale trades query
export const WhaleTradesQuerySchema = z.object({
  market: MarketIdSchema.optional(),
  user: z.string().trim().max(100).optional(),
  side: TradeSideSchema.optional(),
  minSize: z.coerce.number().min(0).default(1000),
}).merge(PaginationSchema)

// Whale holders query
export const WhaleHoldersQuerySchema = z.object({
  marketId: MarketIdSchema.optional(),
  minPosition: z.coerce.number().min(0).default(1000),
}).merge(PaginationSchema)

// Whale activity query
export const WhaleActivityQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  minTradeSize: z.coerce.number().min(0).default(1000),
  platform: z.enum(['kalshi', 'polymarket', 'all']).default('all'),
}).merge(PaginationSchema)
