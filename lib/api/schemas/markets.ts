import { z } from 'zod'
import {
  ExtendedPlatformSchema,
  PaginationSchema,
  SearchQuerySchema,
  CategorySchema,
  ProbabilitySchema,
  MarketIdSchema,
  BoundingBoxSchema,
  ConfidenceSchema,
  BooleanSchema,
} from './common'

/**
 * Market-related validation schemas
 */

// Market search query parameters
export const MarketSearchQuerySchema = z.object({
  q: SearchQuerySchema,
  platform: ExtendedPlatformSchema.default('all'),
  category: CategorySchema,
  minProbability: ProbabilitySchema,
  maxProbability: ProbabilitySchema,
  sort: z.enum(['volume', 'liquidity', 'relevance']).optional(),
}).merge(PaginationSchema).refine(
  (data) => {
    if (data.minProbability !== undefined && data.maxProbability !== undefined) {
      return data.minProbability <= data.maxProbability
    }
    return true
  },
  { message: 'minProbability must be less than or equal to maxProbability' }
)

// Geotagged markets query parameters
export const GeotaggedMarketsQuerySchema = z.object({
  platform: ExtendedPlatformSchema.optional(),
  country: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  category: CategorySchema,
  tag: z.string().trim().max(100).optional(),
  confidence: ConfidenceSchema,
  search: SearchQuerySchema,
  groupByEvent: BooleanSchema.default(true),
  // Bounding box
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
}).merge(PaginationSchema).refine(
  (data) => {
    // If any bbox param is provided, all must be provided
    const hasAny = data.minLat !== undefined || data.maxLat !== undefined ||
                   data.minLng !== undefined || data.maxLng !== undefined
    const hasAll = data.minLat !== undefined && data.maxLat !== undefined &&
                   data.minLng !== undefined && data.maxLng !== undefined
    return !hasAny || hasAll
  },
  { message: 'Bounding box requires all four coordinates (minLat, maxLat, minLng, maxLng)' }
)

// Market by URL
export const MarketByUrlQuerySchema = z.object({
  url: z.string()
    .trim()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .refine(
      (url) => {
        // Only allow Kalshi and Polymarket URLs
        const hostname = new URL(url).hostname
        return hostname.includes('kalshi.com') || hostname.includes('polymarket.com')
      },
      { message: 'URL must be from kalshi.com or polymarket.com' }
    ),
})

// Market ID parameter
export const MarketIdParamSchema = z.object({
  marketId: MarketIdSchema,
})

// Markets activity query
export const MarketsActivityQuerySchema = z.object({
  platform: ExtendedPlatformSchema.optional(),
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  minVolume: z.coerce.number().min(0).optional(),
}).merge(PaginationSchema)

// Market events query
export const MarketEventsQuerySchema = z.object({
  platform: ExtendedPlatformSchema.optional(),
  active: BooleanSchema.optional(),
}).merge(PaginationSchema)

// Market history query
export const MarketHistoryQuerySchema = z.object({
  marketId: MarketIdSchema,
  platform: z.enum(['kalshi', 'polymarket']),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return data.from <= data.to
    }
    return true
  },
  { message: 'from date must be before or equal to to date' }
)

// Market candlesticks query
export const MarketCandlesticksQuerySchema = z.object({
  ticker: z.string().trim().min(1).max(100),
  interval: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d']).default('1h'),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
})

// Market comparison query
export const MarketCompareQuerySchema = z.object({
  markets: z.string()
    .transform((val) => val.split(',').map(s => s.trim()).filter(s => s.length > 0))
    .pipe(z.array(MarketIdSchema).min(2, 'At least 2 markets required').max(10, 'Maximum 10 markets allowed')),
  platform: ExtendedPlatformSchema.optional(),
})

// Related markets by tags
export const RelatedByTagsQuerySchema = z.object({
  marketId: MarketIdSchema,
  platform: z.enum(['kalshi', 'polymarket']),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

// Top holders query
export const TopHoldersQuerySchema = z.object({
  marketId: MarketIdSchema,
  platform: z.enum(['kalshi', 'polymarket']),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

// Open interest query
export const OpenInterestQuerySchema = z.object({
  platform: ExtendedPlatformSchema.optional(),
  category: CategorySchema,
  minVolume: z.coerce.number().min(0).optional(),
}).merge(PaginationSchema)

// Live volume query
export const LiveVolumeQuerySchema = z.object({
  platform: ExtendedPlatformSchema.optional(),
  interval: z.enum(['1m', '5m', '15m', '1h']).default('5m'),
})

// Market tags body schema
export const MarketTagsBodySchema = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).min(1).max(20),
})
