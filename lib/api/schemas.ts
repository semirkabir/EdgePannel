import { z } from 'zod'

/**
 * Common validation schemas for API routes
 */

// Platform enum
export const PlatformSchema = z.enum(['kalshi', 'polymarket'])

// Trade order schema
export const TradeOrderSchema = z.object({
  platform: PlatformSchema,
  marketId: z.string().min(1, 'Market ID is required'),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').optional(),
  orderType: z.enum(['market', 'limit']).optional(),
})

// API Key schemas
export const ApiKeySchema = z.object({
  platform: PlatformSchema,
  apiKey: z.string().min(1).optional(),
  accessKeyId: z.string().min(1).optional(),
  privateKey: z.string().min(1).optional(),
}).refine(
  (data) => {
    if (data.platform === 'polymarket') {
      return !!data.apiKey
    }
    if (data.platform === 'kalshi') {
      return !!data.accessKeyId && !!data.privateKey
    }
    return false
  },
  {
    message: 'Invalid API key combination for platform',
  }
)

// Market search schema
export const MarketSearchSchema = z.object({
  q: z.string().optional(),
  platform: z.enum(['kalshi', 'polymarket', 'all']).default('all'),
  category: z.string().optional(),
  minProbability: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxProbability: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(1000)).default('50'),
  cursor: z.string().optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
  sort: z.enum(['volume', 'probability', 'liquidity', 'relevance']).optional(),
})

// Pagination schema
export const PaginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(1000)).optional(),
  cursor: z.string().optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
})

// User ID schema
export const UserIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

// Date range schema
export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// Portfolio snapshot schema
export const PortfolioSnapshotSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(['kalshi', 'polymarket', 'combined']),
  totalValue: z.number(),
  totalPnl: z.number(),
  totalExposure: z.number().optional(),
  positionCount: z.number().int().min(0),
  positions: z.array(z.object({
    ticker: z.string().optional(),
    marketId: z.string().min(1),
    marketTitle: z.string().optional(),
    size: z.number(),
    entryPrice: z.number().optional(),
    currentPrice: z.number().optional(),
    realizedPnl: z.number().optional(),
    unrealizedPnl: z.number().optional(),
  })).optional(),
})

// Market fetch URL schema
export const MarketUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
})

// Strong password validation
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/

// Registration schema
export const RegistrationSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(strongPasswordRegex, 'Password must contain uppercase, lowercase, number, and special character'),
})

// Password update schema
export const PasswordUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(strongPasswordRegex, 'Password must contain uppercase, lowercase, number, and special character'),
})

// Email update schema
export const EmailUpdateSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
})

// User preferences schema
export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
  defaultPlatform: z.enum(['kalshi', 'polymarket', 'all']).optional(),
  defaultCurrency: z.string().length(3).optional(), // ISO 4217 currency code
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  autoRefresh: z.boolean().optional(),
  refreshInterval: z.number().int().min(5).max(300).optional(), // 5-300 seconds
  displaySettings: z.object({
    showProbabilities: z.boolean().optional(),
    showVolume: z.boolean().optional(),
    showLiquidity: z.boolean().optional(),
    compactMode: z.boolean().optional(),
  }).optional(),
  tradingPreferences: z.object({
    defaultOrderType: z.enum(['market', 'limit']).optional(),
    confirmTrades: z.boolean().optional(),
    slippageTolerance: z.number().min(0).max(100).optional(), // percentage
  }).optional(),
}).strict() // Reject unknown keys to prevent injection

