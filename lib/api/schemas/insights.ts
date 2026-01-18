/**
 * Insights and Analytics Validation Schemas
 */

import { z } from 'zod'
import { PlatformSchema, PaginationSchema, TimeRangeSchema } from './common'

/**
 * Live Trades Query Schema
 */
export const LiveTradesQuerySchema = z
  .object({
    marketId: z.string().trim().optional(),
    platform: PlatformSchema.optional(),
    minSize: z.coerce.number().min(0).optional(),
    side: z.enum(['buy', 'sell', 'all']).optional(),
  })
  .merge(PaginationSchema)

/**
 * Market Stats Query Schema
 */
export const MarketStatsQuerySchema = z.object({
  platform: PlatformSchema.optional(),
  timeRange: TimeRangeSchema.optional(),
  category: z.string().trim().max(100).optional(),
  includeInactive: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
})

/**
 * Trade Analytics Query Schema
 */
export const TradeAnalyticsQuerySchema = z.object({
  marketId: z.string().trim(),
  platform: PlatformSchema,
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
})

/**
 * Market Snapshot Query Schema
 */
export const MarketSnapshotQuerySchema = z.object({
  marketIds: z
    .string()
    .transform((val) => val.split(',').map((id) => id.trim()))
    .pipe(z.array(z.string().min(1)).max(50)),
  platform: PlatformSchema,
})
