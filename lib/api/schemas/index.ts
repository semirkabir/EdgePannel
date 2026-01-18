/**
 * Centralized export of all API validation schemas
 *
 * Usage:
 *   import { MarketSearchQuerySchema, validateQuery } from '@/lib/api/schemas'
 *   const params = validateQuery(MarketSearchQuerySchema, searchParams)
 */

// Re-export common schemas
export * from './common'

// Re-export domain-specific schemas
export * from './markets'
export * from './trading'
export * from './user'
export * from './api-keys'
export * from './whales'
export * from './feeds'
export * from './portfolio'
export * from './insights'
export * from './admin'
export * from './layers'
export * from './conflicts'

// Re-export legacy schemas from schemas.ts for backward compatibility
export {
  PlatformSchema as LegacyPlatformSchema,
  TradeOrderSchema,
  ApiKeySchema as LegacyApiKeySchema,
  MarketSearchSchema,
  PaginationSchema as LegacyPaginationSchema,
  UserIdSchema,
  DateRangeSchema as LegacyDateRangeSchema,
  PortfolioSnapshotSchema as LegacyPortfolioSnapshotSchema,
  MarketUrlSchema,
  RegistrationSchema as LegacyRegistrationSchema,
  PasswordUpdateSchema as LegacyPasswordUpdateSchema,
  EmailUpdateSchema as LegacyEmailUpdateSchema,
  UserPreferencesSchema as LegacyUserPreferencesSchema,
} from '../schemas'
