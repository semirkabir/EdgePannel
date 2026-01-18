/**
 * Test Setup Configuration
 *
 * Global test setup and utilities
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })

// Set test environment
process.env.NODE_ENV = 'test'

// Mock environment variables for testing
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!'
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock Redis (disable for unit tests)
process.env.REDIS_URL = ''

// Disable rate limiting in tests
process.env.RATE_LIMIT_ENABLED = 'false'

// Global test timeout
const TEST_TIMEOUT = 10000

beforeAll(() => {
  // Set default timeout
  vi.setConfig({ testTimeout: TEST_TIMEOUT })

  console.log('[Test Setup] Initialized')
})

afterAll(() => {
  console.log('[Test Setup] Cleanup completed')
})

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks()
})

// Export test utilities
export const testUtils = {
  /**
   * Wait for async operations to complete
   */
  async waitFor(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  /**
   * Generate random test data
   */
  randomString(length = 10): string {
    return Math.random().toString(36).substring(2, 2 + length)
  },

  /**
   * Generate test encryption key
   */
  generateTestKey(): string {
    return 'test-key-' + this.randomString(20)
  },

  /**
   * Create mock request
   */
  createMockRequest(options: {
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: any
  } = {}): Request {
    const {
      method = 'GET',
      url = 'http://localhost:3000/api/test',
      headers = {},
      body
    } = options

    return new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    })
  },

  /**
   * Create mock NextRequest
   */
  createMockNextRequest(options: {
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: any
  } = {}): any {
    const {
      method = 'GET',
      url = 'http://localhost:3000/api/test',
      headers = {},
      body
    } = options

    return {
      method,
      url,
      headers: new Map(Object.entries(headers)),
      nextUrl: new URL(url),
      json: async () => body
    }
  }
}
