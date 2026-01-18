/**
 * Portfolio and Trading Validation Schemas
 */

import { z } from 'zod'
import { PlatformSchema, PaginationSchema } from './common'

/**
 * Kalshi Fills Query Schema
 */
export const KalshiFillsQuerySchema = z
  .object({
    ticker: z.string().trim().optional(),
    minCount: z.coerce.number().int().min(0).optional(),
    maxCount: z.coerce.number().int().min(0).optional(),
    status: z.enum(['filled', 'cancelled', 'all']).optional(),
  })
  .merge(PaginationSchema)

/**
 * Kalshi Positions Query Schema
 */
export const KalshiPositionsQuerySchema = z.object({
  settlementStatus: z.enum(['settled', 'unsettled', 'all']).optional(),
  ticker: z.string().trim().optional(),
})

/**
 * Kalshi Settlements Query Schema
 */
export const KalshiSettlementsQuerySchema = z
  .object({
    minTotal: z.coerce.number().min(0).optional(),
    maxTotal: z.coerce.number().optional(),
  })
  .merge(PaginationSchema)

/**
 * Polymarket Positions Query Schema
 */
export const PolymarketPositionsQuerySchema = z.object({
  marketId: z.string().trim().optional(),
  minSize: z.coerce.number().min(0).optional(),
  side: z.enum(['buy', 'sell', 'all']).optional(),
})

/**
 * Polymarket Value Query Schema
 */
export const PolymarketValueQuerySchema = z.object({
  platform: z.literal('polymarket').default('polymarket'),
})
