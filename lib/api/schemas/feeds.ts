import { z } from 'zod'
import { PaginationSchema, BooleanSchema } from './common'

/**
 * Data feed validation schemas
 */

// GDELT news query
export const GdeltNewsQuerySchema = z.object({
  query: z.string().trim().min(1).max(500),
  country: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
  theme: z.string().trim().max(100).optional(),
  tone: z.enum(['positive', 'negative', 'neutral']).optional(),
  timespan: z.enum(['1h', '6h', '24h', '7d']).default('24h'),
}).merge(PaginationSchema)

// Crypto prices query
export const CryptoPricesQuerySchema = z.object({
  symbols: z.string()
    .transform((val) => val.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0))
    .pipe(z.array(z.string().min(1).max(10)).min(1).max(50))
    .optional(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/).default('USD'),
})

// Commodities prices query
export const CommoditiesQuerySchema = z.object({
  commodities: z.string()
    .transform((val) => val.split(',').map(s => s.trim()).filter(s => s.length > 0))
    .pipe(z.array(z.string().min(1).max(50)).max(20))
    .optional(),
  interval: z.enum(['1d', '1w', '1m']).default('1d'),
})

// FRED economic data query
export const FredDataQuerySchema = z.object({
  series: z.string().trim().min(1).max(100),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  frequency: z.enum(['d', 'w', 'm', 'q', 'sa', 'a']).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate
    }
    return true
  },
  { message: 'startDate must be before or equal to endDate' }
)

// Layoffs data query
export const LayoffsQuerySchema = z.object({
  company: z.string().trim().max(100).optional(),
  industry: z.string().trim().max(100).optional(),
  country: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
  minEmployees: z.coerce.number().int().min(0).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(PaginationSchema)

// Policy tracking query
export const PolicyQuerySchema = z.object({
  topic: z.string().trim().max(100).optional(),
  jurisdiction: z.string().trim().max(100).optional(),
  status: z.enum(['proposed', 'active', 'enacted', 'rejected']).optional(),
  date: z.coerce.date().optional(),
}).merge(PaginationSchema)

// USA Spending query
export const UsaSpendingQuerySchema = z.object({
  agency: z.string().trim().max(200).optional(),
  recipient: z.string().trim().max(200).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  fiscalYear: z.coerce.number().int().min(1990).max(2100).optional(),
  category: z.string().trim().max(100).optional(),
}).merge(PaginationSchema).refine(
  (data) => {
    if (data.minAmount !== undefined && data.maxAmount !== undefined) {
      return data.minAmount <= data.maxAmount
    }
    return true
  },
  { message: 'minAmount must be less than or equal to maxAmount' }
)
