# Testing Guide

Comprehensive testing guide for the EdgePanel application.

## Table of Contents

- [Overview](#overview)
- [Test Setup](#test-setup)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)
- [Testing Best Practices](#testing-best-practices)

---

## Overview

The application uses **Vitest** as the testing framework, chosen for:

- Fast execution (ESM native)
- Compatible with Vite ecosystem
- Jest-compatible API
- Built-in coverage reporting
- Watch mode and UI

### Test Structure

```
tests/
├── setup.ts                    # Global test configuration
├── unit/                       # Unit tests
│   ├── encryption/
│   │   └── encryption.test.ts
│   ├── cache/
│   │   └── cache-manager.test.ts
│   └── middleware/
│       └── rate-limit.test.ts
└── integration/                # Integration tests
    └── api/
```

---

## Test Setup

### Installation

Install testing dependencies:

```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 @vitejs/plugin-react
```

Dependencies are already added to `package.json`.

### Configuration

Test configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70
      }
    }
  }
})
```

### Environment Setup

Test environment variables are set in `tests/setup.ts`:

```typescript
process.env.NODE_ENV = 'test'
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!'
process.env.REDIS_URL = '' // Disabled for unit tests
process.env.RATE_LIMIT_ENABLED = 'false'
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Watch Mode

Watch mode automatically reruns tests when files change:

```bash
npm run test:watch
```

Press `h` for help menu:
- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename
- `t` - Filter by test name
- `q` - Quit

### Coverage Report

Generate and view coverage:

```bash
npm run test:coverage
open coverage/index.html
```

### Visual UI

Run tests with visual interface:

```bash
npm run test:ui
```

Access at `http://localhost:51204/__vitest__/`

---

## Test Coverage

### Current Coverage

| Module | Coverage | Status |
|--------|----------|--------|
| Encryption | 90%+ | ✅ |
| Cache Manager | 85%+ | ✅ |
| Rate Limiter | 80%+ | ✅ |
| **Overall** | **70%+** | ✅ |

### Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 70,        // 70% of lines covered
    functions: 70,    // 70% of functions covered
    branches: 65,     // 65% of branches covered
    statements: 70    // 70% of statements covered
  }
}
```

Build will fail if thresholds are not met.

### Viewing Coverage

After running `npm run test:coverage`:

1. **Terminal Output**: Summary in console
2. **HTML Report**: `coverage/index.html`
3. **LCOV Report**: `coverage/lcov.info` (for CI tools)

---

## Writing Tests

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  describe('Specific functionality', () => {
    it('should do something', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe('expected')
    })
  })
})
```

### Encryption Module Tests

Location: `tests/unit/encryption/encryption.test.ts`

**Coverage:**
- Basic encryption/decryption
- IV uniqueness
- Auth tag verification
- Error handling
- Round-trip tests
- Edge cases

**Example:**

```typescript
import { encrypt, decrypt } from '@/lib/utils/encryption'

describe('Encryption', () => {
  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'Secret message'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('should generate unique IVs', () => {
    const encrypted1 = encrypt('test')
    const encrypted2 = encrypt('test')

    expect(encrypted1).not.toBe(encrypted2)
  })
})
```

### Cache Manager Tests

Location: `tests/unit/cache/cache-manager.test.ts`

**Coverage:**
- Get/set operations
- TTL expiration
- Prefix isolation
- getOrSet pattern
- Batch operations
- Increment operations

**Example:**

```typescript
import { CacheManager } from '@/lib/cache/cache-manager'

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = new CacheManager('test')
  })

  it('should set and get a value', async () => {
    await cache.set('key', 'value')
    const result = await cache.get('key')

    expect(result).toBe('value')
  })

  it('should expire after TTL', async () => {
    await cache.set('key', 'value', 100)

    await new Promise(resolve => setTimeout(resolve, 150))

    const result = await cache.get('key')
    expect(result).toBeNull()
  })
})
```

### Rate Limit Tests

Location: `tests/unit/middleware/rate-limit.test.ts`

**Coverage:**
- Request limiting
- IP-based tracking
- Path-based rules
- Configuration
- Memory fallback

**Example:**

```typescript
import { rateLimit } from '@/lib/middleware/rate-limit'

describe('Rate Limit', () => {
  it('should allow requests under limit', async () => {
    const req = createMockRequest({ ip: '1.2.3.4' })
    const result = await rateLimit(req)

    expect(result).toBeNull() // Allowed
  })

  it('should block requests over limit', async () => {
    // Exhaust limit
    for (let i = 0; i < 6; i++) {
      await rateLimit(createMockRequest({ ip: '1.2.3.5' }))
    }

    const result = await rateLimit(createMockRequest({ ip: '1.2.3.5' }))

    expect(result.status).toBe(429)
  })
})
```

---

## Testing Best Practices

### 1. Test Organization

**Good:**
```typescript
describe('CacheManager', () => {
  describe('set', () => {
    it('should store a value')
    it('should override existing value')
  })

  describe('get', () => {
    it('should retrieve a value')
    it('should return null for missing key')
  })
})
```

**Bad:**
```typescript
describe('CacheManager', () => {
  it('test 1')
  it('test 2')
  it('test 3')
}
```

### 2. Test Naming

**Good:**
```typescript
it('should return null for expired keys')
it('should throw error for invalid input')
it('should handle concurrent operations')
```

**Bad:**
```typescript
it('test cache')
it('works')
it('should work correctly')
```

### 3. AAA Pattern

Structure tests with Arrange-Act-Assert:

```typescript
it('should calculate total', () => {
  // Arrange
  const items = [1, 2, 3]

  // Act
  const total = calculateTotal(items)

  // Assert
  expect(total).toBe(6)
})
```

### 4. Test Independence

Each test should be independent:

```typescript
describe('Counter', () => {
  let counter: Counter

  beforeEach(() => {
    counter = new Counter() // Fresh instance
  })

  it('should start at zero', () => {
    expect(counter.value).toBe(0)
  })

  it('should increment', () => {
    counter.increment()
    expect(counter.value).toBe(1)
  })
})
```

### 5. Mock External Dependencies

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/cache/redis-client', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false)
}))
```

### 6. Test Edge Cases

Don't just test happy paths:

```typescript
describe('encrypt', () => {
  it('should handle empty string')
  it('should handle very long strings')
  it('should handle special characters')
  it('should handle unicode')
  it('should throw on null input')
})
```

### 7. Use Test Utilities

Location: `tests/setup.ts`

```typescript
import { testUtils } from '@/tests/setup'

// Wait for async operations
await testUtils.waitFor(100)

// Generate random data
const key = testUtils.randomString(20)

// Create mock requests
const req = testUtils.createMockRequest({
  method: 'POST',
  body: { data: 'test' }
})
```

### 8. Performance Tests

Test performance-critical code:

```typescript
it('should encrypt quickly', () => {
  const start = performance.now()

  encrypt('test')

  const duration = performance.now() - start
  expect(duration).toBeLessThan(10)
})
```

### 9. Cleanup

Always cleanup after tests:

```typescript
afterEach(async () => {
  await cache.clear()
  vi.clearAllMocks()
})
```

### 10. Descriptive Failures

Use descriptive expect messages:

```typescript
expect(result).toBe(expected) // Good enough

expect(result).toBe(expected)  // Better
// "Expected 5 but got 3"
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Troubleshooting

### Tests Fail in CI but Pass Locally

**Cause:** Environment differences

**Solution:**
- Check environment variables
- Ensure consistent Node.js version
- Clear `node_modules` and reinstall

### Timeouts

**Cause:** Async operations taking too long

**Solution:**
```typescript
it('should complete', async () => {
  // Increase timeout for this test
  vi.setConfig({ testTimeout: 10000 })

  await slowOperation()
}, 10000) // Timeout in ms
```

### Flaky Tests

**Cause:** Race conditions or timing issues

**Solution:**
- Use proper `await` for async operations
- Avoid `setTimeout` in tests
- Use test utilities for timing

### Mock Not Working

**Cause:** Mock defined after import

**Solution:**
```typescript
// Mock BEFORE importing module
vi.mock('@/lib/module')

// Then import
import { function } from '@/lib/module'
```

---

## Test Cheat Sheet

### Common Assertions

```typescript
// Equality
expect(value).toBe(5)
expect(value).toEqual({ key: 'value' })
expect(value).not.toBe(null)

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeDefined()
expect(value).toBeUndefined()

// Numbers
expect(value).toBeGreaterThan(5)
expect(value).toBeLessThan(10)
expect(value).toBeCloseTo(5.1, 1)

// Strings
expect(string).toContain('substring')
expect(string).toMatch(/regex/)

// Arrays
expect(array).toHaveLength(3)
expect(array).toContain(item)

// Objects
expect(object).toHaveProperty('key')
expect(object).toMatchObject({ key: 'value' })

// Exceptions
expect(() => fn()).toThrow()
expect(() => fn()).toThrow('error message')

// Async
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

### Lifecycle Hooks

```typescript
beforeAll(() => {
  // Runs once before all tests
})

afterAll(() => {
  // Runs once after all tests
})

beforeEach(() => {
  // Runs before each test
})

afterEach(() => {
  // Runs after each test
})
```

### Mocking

```typescript
// Mock module
vi.mock('@/lib/module')

// Mock function
const mockFn = vi.fn()
mockFn.mockReturnValue('value')
mockFn.mockResolvedValue('async value')
mockFn.mockRejectedValue(new Error('error'))

// Check calls
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledWith('arg')
expect(mockFn).toHaveBeenCalledTimes(2)

// Clear mocks
vi.clearAllMocks()
vi.resetAllMocks()
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Jest API (Vitest is compatible)](https://jestjs.io/docs/api)

---

**Last Updated**: 2026-01-18
