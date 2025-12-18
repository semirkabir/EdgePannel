// Authentication configuration
// Set to false to temporarily disable authentication checks (development only)
// In production, authentication should always be enabled
export const AUTH_ENABLED = process.env.NODE_ENV === 'production' ? true : (process.env.AUTH_ENABLED === 'true' || false)

// Mock user ID to use when auth is disabled (for testing only)
export const MOCK_USER_ID = 'test-user-001'

if (process.env.NODE_ENV === 'production' && !AUTH_ENABLED) {
  console.warn('⚠️  WARNING: Authentication is disabled in production! This is a security risk.')
}












