# Redis Cache Module

A production-ready Redis caching layer with automatic fallback to in-memory caching.

## Features

- **Redis Backend**: High-performance distributed caching
- **Automatic Fallback**: Seamlessly falls back to in-memory cache when Redis is unavailable
- **Type-Safe**: Full TypeScript support with generics
- **TTL Support**: Time-to-live for all cache entries
- **Batch Operations**: Efficient multi-get and multi-set operations
- **Atomic Operations**: Increment operations with race-condition protection
- **Connection Management**: Automatic reconnection and error handling
- **Multiple Namespaces**: Separate cache instances for different use cases

## Quick Start

### Basic Usage

```typescript
import { marketCache } from '@/lib/cache/cache-manager'

// Get or set pattern (recommended)
const market = await marketCache.getOrSet(
  'market:123',
  async () => {
    // Fetch from API only if cache miss
    return await fetchMarketFromAPI('123')
  },
  30000 // 30 second TTL
)
```

### Simple Operations

```typescript
// Set with TTL
await marketCache.set('key', data, 60000) // 60 seconds

// Get
const data = await marketCache.get<MyType>('key')

// Delete
await marketCache.delete('key')

// Check existence
const exists = await marketCache.has('key')

// Clear all
await marketCache.clear()
```

## Architecture

### Redis Client (`redis-client.ts`)

Singleton Redis connection manager with:
- Automatic connection initialization
- Reconnection with exponential backoff
- Health monitoring
- Graceful shutdown

```typescript
import { getRedisClient, isRedisAvailable, getRedisInfo } from '@/lib/cache/redis-client'

// Check if Redis is connected
if (isRedisAvailable()) {
  console.log('Redis is ready')
}

// Get connection metrics
const info = await getRedisInfo()
// { available: true, connected: true, latency: 2 }
```

### Cache Manager (`cache-manager.ts`)

High-level caching abstraction:

```typescript
import { CacheManager } from '@/lib/cache/cache-manager'

// Create custom cache manager
const myCache = new CacheManager('myapp')

// All operations automatically prefixed with 'myapp:'
await myCache.set('data', value, 30000)
```

### Pre-configured Instances

```typescript
import { cache, marketCache, apiCache, sessionCache } from '@/lib/cache'

// General purpose cache
await cache.set('key', value, 30000)

// Market data cache
await marketCache.set('market:123', market, 30000)

// API response cache
await apiCache.set('api:endpoint', response, 10000)

// Session cache
await sessionCache.set('session:abc', session, 3600000)
```

## Configuration

### Environment Variables

```env
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your_password

# Or use connection URL
REDIS_URL=redis://username:password@host:port/db
```

### Docker Compose

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

## API Reference

### CacheManager

#### `get<T>(key: string): Promise<T | null>`
Get value from cache.

```typescript
const market = await marketCache.get<Market>('market:123')
```

#### `set<T>(key: string, value: T, ttl?: number): Promise<void>`
Set value with optional TTL (default 30 seconds).

```typescript
await marketCache.set('market:123', market, 60000)
```

#### `getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>`
Get from cache or fetch and cache if missing.

```typescript
const market = await marketCache.getOrSet(
  'market:123',
  async () => await api.getMarket('123'),
  60000
)
```

#### `delete(key: string): Promise<void>`
Delete key from cache.

```typescript
await marketCache.delete('market:123')
```

#### `has(key: string): Promise<boolean>`
Check if key exists in cache.

```typescript
if (await marketCache.has('market:123')) {
  console.log('Market is cached')
}
```

#### `clear(): Promise<void>`
Clear all cache entries with this prefix.

```typescript
await marketCache.clear() // Clears all market:* keys
```

#### `mget<T>(keys: string[]): Promise<(T | null)[]>`
Get multiple keys at once.

```typescript
const markets = await marketCache.mget<Market>([
  'market:1',
  'market:2',
  'market:3'
])
```

#### `mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>`
Set multiple keys at once.

```typescript
await marketCache.mset([
  { key: 'market:1', value: market1, ttl: 30000 },
  { key: 'market:2', value: market2, ttl: 30000 }
])
```

#### `increment(key: string, amount?: number, ttl?: number): Promise<number>`
Atomically increment a numeric value.

```typescript
const views = await marketCache.increment('views:page:home', 1, 3600000)
console.log(`Total views: ${views}`)
```

#### `getTTL(key: string): Promise<number | null>`
Get remaining TTL in milliseconds.

```typescript
const ttl = await marketCache.getTTL('market:123')
console.log(`Expires in ${ttl}ms`)
```

### Redis Client

#### `getRedisClient(): Redis | null`
Get singleton Redis client instance.

#### `isRedisAvailable(): boolean`
Check if Redis is connected.

#### `pingRedis(): Promise<boolean>`
Ping Redis to verify connection.

#### `getRedisInfo(): Promise<{ available: boolean; connected: boolean; latency?: number }>`
Get connection status and metrics.

#### `closeRedisConnection(): Promise<void>`
Gracefully close Redis connection.

#### `resetRedisConnection(): void`
Reset connection state (for testing).

## Usage Examples

### Example 1: Polymarket Integration

```typescript
import { marketCache } from '@/lib/cache'

async function fetchMarkets() {
  return marketCache.getOrSet(
    'markets:all',
    async () => {
      const response = await fetch('https://api.polymarket.com/markets')
      return response.json()
    },
    10000 // 10 second cache
  )
}
```

### Example 2: API Response Caching

```typescript
import { apiCache } from '@/lib/cache'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  const cacheKey = `search:${query}`

  const results = await apiCache.getOrSet(
    cacheKey,
    async () => {
      // Expensive search operation
      return performSearch(query)
    },
    60000 // 1 minute cache
  )

  return Response.json(results)
}
```

### Example 3: Rate Limiting

```typescript
import { cache } from '@/lib/cache'

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate_limit:${userId}`
  const count = await cache.increment(key, 1, 60000) // 1 minute window

  return count <= 100 // Allow 100 requests per minute
}
```

### Example 4: Session Management

```typescript
import { sessionCache } from '@/lib/cache'

interface Session {
  userId: string
  email: string
  expiresAt: Date
}

async function getSession(sessionId: string): Promise<Session | null> {
  return sessionCache.get<Session>(`session:${sessionId}`)
}

async function setSession(sessionId: string, session: Session): Promise<void> {
  await sessionCache.set(`session:${sessionId}`, session, 3600000) // 1 hour
}
```

### Example 5: Batch Operations

```typescript
import { marketCache } from '@/lib/cache'

async function updateMultipleMarkets(markets: Market[]): Promise<void> {
  await marketCache.mset(
    markets.map(m => ({
      key: `market:${m.id}`,
      value: m,
      ttl: 30000
    }))
  )
}

async function getMultipleMarkets(ids: string[]): Promise<Market[]> {
  const keys = ids.map(id => `market:${id}`)
  const markets = await marketCache.mget<Market>(keys)
  return markets.filter(m => m !== null) as Market[]
}
```

## Performance Considerations

### Memory Usage

Redis is configured with:
- `maxmemory 256mb`: Limits total memory
- `maxmemory-policy allkeys-lru`: Evicts least recently used keys

Adjust in `docker-compose.yml`:

```yaml
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### TTL Guidelines

| Data Type | Recommended TTL | Reason |
|-----------|----------------|---------|
| Market prices | 2-5 seconds | Frequently changing |
| Market metadata | 30-60 seconds | Occasionally updated |
| User sessions | 1 hour | Moderate lifetime |
| Static content | 1+ hours | Rarely changes |
| API responses | Varies | Based on data freshness needs |

### Connection Pooling

ioredis automatically manages connection pooling. Default settings work for most cases.

For high-traffic scenarios:

```typescript
// In redis-client.ts
const config = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  // Add if needed:
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000
}
```

## Error Handling

The cache manager handles errors gracefully:

```typescript
// If Redis is down, automatically falls back to in-memory
const data = await marketCache.get('key') // Works with or without Redis

// Errors are logged but don't crash the application
// [Redis] Connection error: ECONNREFUSED
// [Cache] Redis get error: ... (falls back to memory)
```

Manual error handling:

```typescript
import { isRedisAvailable } from '@/lib/cache/redis-client'

if (!isRedisAvailable()) {
  console.warn('Redis unavailable, using in-memory cache')
  // Optionally notify monitoring system
}
```

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3000/api/health/redis
```

Response:
```json
{
  "service": "redis",
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": {
    "available": true,
    "connected": true,
    "latency": 2
  }
}
```

### Redis CLI Monitoring

```bash
# Connect to Redis
redis-cli

# Monitor all operations
MONITOR

# Check cache keys
KEYS market:*
KEYS cache:*

# Get key info
TYPE market:123
TTL market:123
GET market:123

# Check memory usage
INFO memory

# Check stats
INFO stats
```

### Application Metrics

Add logging to track cache performance:

```typescript
import { marketCache } from '@/lib/cache'

const startTime = Date.now()
const market = await marketCache.get('market:123')
const duration = Date.now() - startTime

if (market) {
  console.log(`Cache HIT: market:123 (${duration}ms)`)
} else {
  console.log(`Cache MISS: market:123 (${duration}ms)`)
}
```

## Testing

### Unit Tests

```typescript
import { CacheManager } from '@/lib/cache/cache-manager'

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = new CacheManager('test')
  })

  it('should cache and retrieve values', async () => {
    await cache.set('key', 'value', 30000)
    const result = await cache.get('key')
    expect(result).toBe('value')
  })

  it('should expire after TTL', async () => {
    await cache.set('key', 'value', 100) // 100ms TTL
    await new Promise(resolve => setTimeout(resolve, 150))
    const result = await cache.get('key')
    expect(result).toBeNull()
  })
})
```

### Integration Tests

```typescript
import { getRedisInfo, isRedisAvailable } from '@/lib/cache/redis-client'

describe('Redis Integration', () => {
  it('should connect to Redis', async () => {
    const available = isRedisAvailable()
    expect(available).toBe(true)
  })

  it('should have low latency', async () => {
    const info = await getRedisInfo()
    expect(info.latency).toBeLessThan(10) // < 10ms
  })
})
```

## Troubleshooting

### Redis Connection Failed

**Problem**: `[Redis] Connection error: ECONNREFUSED`

**Solutions**:
1. Check Redis is running: `docker-compose ps`
2. Verify port: `lsof -i :6379`
3. Check environment variables in `.env`
4. Try connecting manually: `redis-cli ping`

### High Memory Usage

**Problem**: Redis using too much memory

**Solutions**:
1. Check memory: `redis-cli INFO memory`
2. Adjust maxmemory in docker-compose.yml
3. Review cache TTLs (too long?)
4. Clear cache: `redis-cli FLUSHDB`

### Slow Cache Operations

**Problem**: Cache operations taking too long

**Solutions**:
1. Check Redis latency: `redis-cli --latency`
2. Monitor slow queries: `redis-cli --slowlog`
3. Verify network connection
4. Check if Redis is overloaded

### In-Memory Fallback Not Working

**Problem**: Application crashes when Redis is down

**Solutions**:
1. Verify error handling in cache manager
2. Check logs for error details
3. Ensure graceful fallback is implemented
4. Test with Redis stopped: `docker-compose stop redis`

## Best Practices

1. **Use get-or-set pattern**: Simplifies cache logic and reduces code
2. **Set appropriate TTLs**: Balance freshness vs performance
3. **Use batch operations**: More efficient for multiple keys
4. **Monitor cache hit rates**: Optimize based on actual usage
5. **Handle Redis failures**: Always have fallback strategy
6. **Use namespaces**: Separate concerns with different cache instances
7. **Clear cache on updates**: Invalidate when source data changes
8. **Log cache operations**: Track performance and debug issues

## Migration Guide

See [REDIS_MIGRATION_GUIDE.md](../../REDIS_MIGRATION_GUIDE.md) for complete migration instructions.

## More Examples

See [example-usage.ts](./example-usage.ts) for comprehensive usage examples.

## Support

For issues:
1. Check Docker logs: `docker-compose logs redis`
2. Test Redis: `redis-cli PING`
3. Check application logs for error messages
4. Verify environment variables are set correctly
