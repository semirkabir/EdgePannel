import { z } from 'zod'

/**
 * Common reusable schemas for API validation
 */

// Platform enum
export const PlatformSchema = z.enum(['kalshi', 'polymarket'])

// Extended platform including 'all'
export const ExtendedPlatformSchema = z.enum(['kalshi', 'polymarket', 'all'])

// Pagination schema - coerce string params to numbers
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  offset: z.coerce.number().int().min(0).optional(),
  cursor: z.string().optional(),
})

// Bounding box for geospatial queries
export const BoundingBoxSchema = z.object({
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
}).refine(
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

// Date range schema
export const DateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate
    }
    return true
  },
  { message: 'Start date must be before or equal to end date' }
)

// Time range presets
export const TimeRangeSchema = z.enum(['24h', '7d', '30d', '90d', 'all'])

// Market ID schema - sanitize and validate
export const MarketIdSchema = z.string()
  .trim()
  .min(1, 'Market ID is required')
  .max(500, 'Market ID too long')

// Search query schema - sanitize input
export const SearchQuerySchema = z.string()
  .trim()
  .max(500, 'Search query too long')
  .optional()

// Category filter
export const CategorySchema = z.string()
  .trim()
  .max(100, 'Category name too long')
  .optional()

// Probability range validation
export const ProbabilitySchema = z.coerce.number()
  .min(0, 'Probability must be between 0 and 1')
  .max(1, 'Probability must be between 0 and 1')
  .optional()

// Sort order
export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc')

// Generic ID schema
export const IdSchema = z.string().uuid('Invalid UUID format')

// Email schema with sanitization
export const EmailSchema = z.string()
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .max(255, 'Email too long')

// Strong password validation
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/

export const PasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password too long')
  .regex(strongPasswordRegex, 'Password must contain uppercase, lowercase, number, and special character')

// URL validation with sanitization
export const UrlSchema = z.string()
  .trim()
  .url('Invalid URL format')
  .max(2048, 'URL too long')

// Trade side
export const TradeSideSchema = z.enum(['buy', 'sell'])

// Order type
export const OrderTypeSchema = z.enum(['market', 'limit'])

// Positive number validation
export const PositiveNumberSchema = z.coerce.number()
  .positive('Must be a positive number')

// Non-negative number validation
export const NonNegativeNumberSchema = z.coerce.number()
  .nonnegative('Must be a non-negative number')

// Boolean coercion from string query params
export const BooleanSchema = z.union([
  z.boolean(),
  z.string().transform((val) => val === 'true' || val === '1')
])

// Confidence level
export const ConfidenceSchema = z.enum(['high', 'medium', 'low']).optional()

// ISO country code
export const CountryCodeSchema = z.string()
  .length(2, 'Country code must be 2 characters')
  .regex(/^[A-Z]{2}$/, 'Invalid country code format')
  .optional()

// ISO currency code
export const CurrencyCodeSchema = z.string()
  .length(3, 'Currency code must be 3 characters')
  .regex(/^[A-Z]{3}$/, 'Invalid currency code format')
  .optional()
