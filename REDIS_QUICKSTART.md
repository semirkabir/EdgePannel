# Redis Quick Start Guide

Get Redis caching up and running in 5 minutes.

## 1. Start Redis

```bash
# Start Redis service
docker-compose up -d redis

# Verify it's running
docker-compose ps
redis-cli ping  # Should return PONG
```

## 2. Configure Environment

Add to your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

## 3. Start Development Server

```bash
npm run dev
```

That's it! The application will automatically connect to Redis on startup.

## 4. Verify It's Working

Check the logs:
```
[Redis] Connected successfully
[Redis] Client ready
```

Or visit the health check endpoint:
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

## 5. Use in Your Code

```typescript
import { marketCache } from '@/lib/cache/cache-manager'

// Get or fetch and cache
const markets = await marketCache.getOrSet(
  'all_markets',
  async () => {
    return await fetchMarketsFromAPI()
  },
  30000 // 30 second cache
)
```

## What If Redis Is Not Available?

No problem! The application automatically falls back to in-memory caching. You'll see a warning in the logs:

```
[Redis] Connection error: ECONNREFUSED
[Cache] Using in-memory fallback
```

Everything still works, just without the benefits of distributed caching.

## Common Commands

```bash
# Start Redis
docker-compose up -d redis

# Stop Redis
docker-compose stop redis

# View Redis logs
docker-compose logs -f redis

# Connect to Redis CLI
redis-cli

# Clear all cache
redis-cli FLUSHDB

# Monitor operations
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory
```

## Production Deployment

### Option 1: Docker Compose (Included)

Already configured in `docker-compose.yml`. Just deploy as-is.

### Option 2: Managed Redis

For managed services (AWS ElastiCache, Redis Cloud, etc.):

1. Get connection URL from provider
2. Set environment variable:
   ```env
   REDIS_URL=redis://username:password@hostname:port/db
   ```
3. Deploy application

## Next Steps

- Read [REDIS_MIGRATION_GUIDE.md](./REDIS_MIGRATION_GUIDE.md) for detailed documentation
- Review [lib/cache/README.md](./lib/cache/README.md) for API reference
- Check [lib/cache/example-usage.ts](./lib/cache/example-usage.ts) for usage patterns

## Troubleshooting

### "ECONNREFUSED" Error

Redis is not running. Start it:
```bash
docker-compose up -d redis
```

### "Port 6379 already in use"

Another Redis instance is running:
```bash
# Find process
lsof -i :6379

# Or change port in docker-compose.yml and .env
```

### Build Warnings About Edge Runtime

Expected and safe. ioredis only runs in Node.js middleware, not Edge Runtime.

## Support

Questions? Check the documentation:
- [REDIS_MIGRATION_SUMMARY.md](./REDIS_MIGRATION_SUMMARY.md) - Overview of changes
- [REDIS_MIGRATION_GUIDE.md](./REDIS_MIGRATION_GUIDE.md) - Complete guide
- [lib/cache/README.md](./lib/cache/README.md) - API documentation

---

**That's it! You're ready to use Redis caching.**
