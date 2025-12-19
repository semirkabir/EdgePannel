// Authentication configuration
// Authentication is ALWAYS enabled in production (cannot be disabled)
// In development, can be disabled via AUTH_ENABLED=true env var for testing purposes only
export const AUTH_ENABLED = process.env.NODE_ENV === 'production'
  ? true // Always true in production - no exceptions
  : (process.env.AUTH_ENABLED !== 'false') // Default to true in dev, must explicitly disable

// Mock user ID to use when auth is disabled (development only)
export const MOCK_USER_ID = 'test-user-001'

// Fail fast if someone tries to disable auth in production
if (process.env.NODE_ENV === 'production' && process.env.AUTH_ENABLED === 'false') {
  throw new Error('FATAL: Cannot disable authentication in production. Remove AUTH_ENABLED=false from environment.')
}












