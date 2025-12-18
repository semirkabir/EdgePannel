/**
 * Rate limiting configuration per endpoint
 * Defines different rate limits for different API routes
 */

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  perUser?: boolean // If true, rate limit per user ID instead of IP
}

/**
 * Rate limit configurations for different endpoint categories
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - very strict
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    perUser: false, // IP-based for auth
  },
  
  // Registration - strict
  registration: {
    maxRequests: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    perUser: false, // IP-based
  },
  
  // Trading endpoints - moderate
  trading: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    perUser: true, // Per-user for trading
  },
  
  // Market data - generous (read-only)
  markets: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    perUser: false,
  },
  
  // API key management - strict
  apiKeys: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    perUser: true,
  },
  
  // Analytics - moderate
  analytics: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
    perUser: true,
  },
  
  // Admin endpoints - very strict
  admin: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    perUser: true,
  },
  
  // Default for unconfigured endpoints
  default: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    perUser: false,
  },
}

/**
 * Get rate limit config for an endpoint
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  // Match endpoint path to config
  if (endpoint.includes('/auth/') || endpoint.includes('/login') || endpoint.includes('/signin')) {
    return RATE_LIMIT_CONFIGS.auth
  }
  if (endpoint.includes('/register')) {
    return RATE_LIMIT_CONFIGS.registration
  }
  if (endpoint.includes('/trading')) {
    return RATE_LIMIT_CONFIGS.trading
  }
  if (endpoint.includes('/markets')) {
    return RATE_LIMIT_CONFIGS.markets
  }
  if (endpoint.includes('/api-keys')) {
    return RATE_LIMIT_CONFIGS.apiKeys
  }
  if (endpoint.includes('/analytics')) {
    return RATE_LIMIT_CONFIGS.analytics
  }
  if (endpoint.includes('/admin')) {
    return RATE_LIMIT_CONFIGS.admin
  }
  
  return RATE_LIMIT_CONFIGS.default
}

