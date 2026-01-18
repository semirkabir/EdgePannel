# Redis Caching Migration Guide

## Overview

This guide covers the migration from in-memory caching to Redis-backed caching to enable horizontal scaling across multiple application instances.

## What Changed

### 1. New Files Created

- **`lib/cache/redis-client.ts`**: Redis connection manager with automatic reconnection and error handling
- **`lib/cache/cache-manager.ts`**: Abstraction layer providing unified caching interface with Redis backend and in-memory fallback

### 2. Modified Files

- **`lib/api/polymarket-optimized.ts`**: Replaced in-memory Map with Redis-backed cache manager
- **`lib/middleware/rate-limit.ts`**: Implemented Redis-based sliding window rate limiting
- **`docker-compose.yml`**: Added Redis service container
- **`.env.example`**: Added Redis configuration variables

## Architecture

### Cache Manager

The cache manager provides a unified interface that:
- Uses Redis when available (production)
- Falls back to in-memory cache when Redis is unavailable (development/failover)
- Handles serialization/deserialization automatically
- Supports TTL (time-to-live) for all cache entries
- Provides batch operations (mget, mset)
- Implements atomic operations (increment)

### Rate Limiting

The rate limiter now uses:
- **Redis sorted sets** for sliding window algorithm (more accurate than fixed window)
- **In-memory fallback** when Redis is unavailable
- **Graceful degradation** with automatic fallback on errors

## Setup Instructions

### Local Development

1. **Start Redis with Docker Compose**:
   ```bash
   docker-compose up -d redis
   ```

2. **Verify Redis is running**:
   ```bash
   docker-compose ps
   redis-cli ping  # Should return PONG
   ```

3. **Add Redis configuration to `.env`**:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=0
   # REDIS_PASSWORD=  # Optional for local dev
   ```

4. **Install dependencies** (already in package.json):
   ```bash
   npm install
   ```

5. **Start the application**:
   ```bash
   npm run dev
   ```

The application will automatically connect to Redis on startup. If Redis is not available, it will log a warning and fall back to in-memory caching.

### Production Deployment

#### Option 1: Using Docker Compose (Recommended)

1. **Use provided `docker-compose.yml`**:
   - Redis service is already configured
   - Includes health checks and persistence
   - Connected via internal network

2. **Set environment variables**:
   ```env
   REDIS_URL=redis://redis:6379
   # Or individual settings:
   REDIS_HOST=redis
   REDIS_PORT=6379
   REDIS_DB=0
   REDIS_PASSWORD=your_secure_password
   ```

#### Option 2: External Redis Service

For managed Redis services (AWS ElastiCache, Redis Cloud, etc.):

1. **Get connection URL from provider**

2. **Set environment variable**:
   ```env
   REDIS_URL=redis://username:password@hostname:port/db
   ```

#### Option 3: Redis Cluster (Large Scale)

For high-availability deployments:

1. **Modify `lib/cache/redis-client.ts`** to use Redis Cluster:
   ```typescript
   import { Cluster } from 'ioredis'

   const cluster = new Cluster([
     { host: 'node1', port: 6379 },
     { host: 'node2', port: 6379 },
     { host: 'node3', port: 6379 }
   ])
   ```

## Configuration Options

### Redis Client Options

Configured in `lib/cache/redis-client.ts`:

- **`maxRetriesPerRequest`**: 3 (default)
- **`retryStrategy`**: Exponential backoff up to 2 seconds
- **`reconnectOnError`**: Auto-reconnect on specific errors
- **`enableReadyCheck`**: true (ensures connection before operations)

### Cache TTL Defaults

Configured in `lib/api/polymarket-optimized.ts`:

- **Market lists**: 10 seconds
- **Individual markets**: 30 seconds (default)
- **Batch prices**: 2 seconds
- **Order books**: 5 seconds
- **Comments**: 30 seconds (default)
- **Price history**: 60 seconds

Adjust these values based on your data freshness requirements.

### Rate Limiting Configuration

Configured via environment variables:

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000        # 1 minute window
RATE_LIMIT_MAX_PER_MINUTE=300     # Page requests
RATE_LIMIT_API_MAX_PER_MINUTE=2000 # API requests
```

## Monitoring

### Check Redis Connection Status

```typescript
import { getRedisInfo } from '@/lib/cache/redis-client'

const info = await getRedisInfo()
console.log(info)
// { available: true, connected: true, latency: 2 }
```

### Monitor Cache Hit/Miss Rates

Add logging to your cache operations:

```typescript
const value = await marketCache.get(key)
if (value) {
  console.log('[Cache] HIT:', key)
} else {
  console.log('[Cache] MISS:', key)
}
```

### Redis CLI Commands

Useful Redis commands for debugging:

```bash
# Connect to Redis
redis-cli

# Check keys
KEYS cache:*
KEYS market:*
KEYS rate_limit:*

# Check specific key
GET market:markets:https://gamma-api.polymarket.com/markets?limit=500...
TTL market:markets:...

# Clear all cache
FLUSHDB

# Monitor real-time commands
MONITOR

# Check memory usage
INFO memory

# Check stats
INFO stats
```

## Performance Considerations

### Memory Management

Redis is configured with:
- **`maxmemory 256mb`**: Limit memory usage
- **`maxmemory-policy allkeys-lru`**: Evict least recently used keys when memory limit reached

Adjust these in `docker-compose.yml` based on your needs:

```yaml
command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Persistence

Redis is configured with AOF (Append-Only File) persistence:
- Data is persisted to `/data` volume
- Survives container restarts
- Trade-off: Slight performance impact for durability

For higher performance with acceptable data loss risk:

```yaml
command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Connection Pooling

ioredis automatically manages connection pooling. For high-traffic scenarios, consider:

```typescript
// In redis-client.ts
const config = {
  // ... existing config
  lazyConnect: false,
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  // Add connection pool settings if needed
}
```

## Troubleshooting

### Redis Connection Failures

**Symptom**: Application logs show Redis connection errors

**Solution**:
1. Check Redis is running: `docker-compose ps`
2. Verify Redis is accessible: `redis-cli ping`
3. Check firewall rules
4. Verify connection string in `.env`

The application will automatically fall back to in-memory caching.

### High Memory Usage

**Symptom**: Redis memory usage growing unbounded

**Solution**:
1. Check cache TTLs are set correctly
2. Adjust `maxmemory` in docker-compose.yml
3. Monitor with: `redis-cli INFO memory`
4. Clear cache if needed: `redis-cli FLUSHDB`

### Rate Limiting Issues

**Symptom**: Legitimate requests getting rate limited

**Solution**:
1. Increase limits in environment variables
2. Check sorted set cardinality: `redis-cli ZCARD rate_limit:IP:bucket`
3. Manually reset: `redis-cli DEL rate_limit:IP:bucket`

### Cache Inconsistency

**Symptom**: Different instances returning different cached data

**Solution**:
1. Ensure all instances connect to same Redis
2. Check cache keys are consistent
3. Clear cache: `marketCache.clear()`

## Migration Checklist

- [ ] Install Redis (via docker-compose or external service)
- [ ] Update `.env` with Redis configuration
- [ ] Test Redis connection: `npm run dev`
- [ ] Verify cache is working (check logs)
- [ ] Monitor rate limiting behavior
- [ ] Test failover (stop Redis, verify in-memory fallback)
- [ ] Update production environment variables
- [ ] Deploy to production
- [ ] Monitor Redis metrics (memory, connections, ops/sec)

## Rollback Plan

If issues occur, you can quickly rollback:

1. **Remove Redis environment variables** from `.env`
2. **Restart application** - it will use in-memory cache
3. **No code changes needed** - fallback is automatic

## Additional Features

### Cache Warming

Warm the cache on startup for critical data:

```typescript
// In app initialization
import { marketCache } from '@/lib/cache/cache-manager'
import { polymarketClient } from '@/lib/api/polymarket-optimized'

async function warmCache() {
  const markets = await polymarketClient.fetchAllMarkets({ limit: 100 })
  console.log(`[Cache] Warmed with ${markets.markets.length} markets`)
}

warmCache()
```

### Cache Invalidation API

Add an admin endpoint to clear cache:

```typescript
// app/api/admin/cache/clear/route.ts
import { marketCache } from '@/lib/cache/cache-manager'

export async function POST(req: Request) {
  await marketCache.clear()
  return Response.json({ success: true, message: 'Cache cleared' })
}
```

### Cache Metrics Dashboard

Create a monitoring endpoint:

```typescript
// app/api/admin/cache/stats/route.ts
import { getRedisInfo } from '@/lib/cache/redis-client'

export async function GET(req: Request) {
  const info = await getRedisInfo()
  return Response.json(info)
}
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs redis`
2. Review Redis metrics: `redis-cli INFO`
3. Test connection: `redis-cli PING`
4. Verify environment variables are set correctly

## Next Steps

After successful migration, consider:

1. **Implement cache warming** for frequently accessed data
2. **Add cache metrics** to monitoring dashboard
3. **Tune TTL values** based on actual usage patterns
4. **Set up Redis monitoring** (RedisInsight, Prometheus, etc.)
5. **Configure Redis backups** for production
6. **Implement cache tags** for granular invalidation
7. **Add distributed locking** for critical operations
