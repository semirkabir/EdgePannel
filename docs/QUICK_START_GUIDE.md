# Quick Start Guide - New Features

This guide provides quick access to the new features implemented in Sprint 2026-01-18.

## 1. Encryption Key Rotation

### Quick Setup

```bash
# 1. Add keys to .env
ENCRYPTION_KEY_V1=your-current-key
ENCRYPTION_KEY_V2=your-new-key
ENCRYPTION_KEY_CURRENT=v2

# 2. Test rotation (dry run)
npx tsx scripts/rotate-encryption-key.ts --dry-run

# 3. Execute rotation
CONFIRM_ROTATION=yes npx tsx scripts/rotate-encryption-key.ts --execute

# 4. Verify
npx tsx scripts/rotate-encryption-key.ts --verify
```

### When to Use
- Regular key rotation (every 90 days)
- Security incident response
- Compliance requirements
- Key compromise suspected

📖 **Full Guide:** [docs/ENCRYPTION_KEY_ROTATION.md](./ENCRYPTION_KEY_ROTATION.md)

---

## 2. Production Redis

### Quick Deploy

```bash
# 1. Set passwords in .env.production
REDIS_PASSWORD=your-secure-redis-password
POSTGRES_PASSWORD=your-secure-postgres-password
REDIS_MAX_MEMORY=1gb

# 2. Start production stack
docker-compose -f docker-compose.prod.yml up -d

# 3. Enable automated backups
docker-compose -f docker-compose.prod.yml --profile backup up -d

# 4. Check health
curl http://localhost:3000/api/health/redis
```

### Features
- ✅ AOF + RDB persistence
- ✅ Password authentication
- ✅ Automated daily backups
- ✅ 7-day retention
- ✅ Memory limits (1GB default)
- ✅ Disabled dangerous commands

📖 **Full Guide:** [docs/REDIS_PRODUCTION_DEPLOYMENT.md](./REDIS_PRODUCTION_DEPLOYMENT.md)

---

## 3. Cache Metrics

### Quick Access

```bash
# Get all cache metrics
curl http://localhost:3000/api/metrics/cache

# Response includes:
# - Hit/miss rates per cache
# - Average latency
# - Redis connection status
# - Memory usage
# - Operation counts
```

### Example Response

```json
{
  "success": true,
  "metrics": {
    "caches": {
      "market": {
        "hits": 1523,
        "misses": 342,
        "hitRate": 0.817,
        "avgLatencyMs": 2.3
      }
    },
    "redis": {
      "connected": true,
      "keyspaceHitRate": "0.932",
      "usedMemory": "245.6M"
    }
  },
  "aggregate": {
    "totalHits": 5234,
    "overallHitRate": 0.8365
  }
}
```

### Integration

```typescript
// In your code
import { cache } from '@/lib/cache/cache-manager'

// Get metrics snapshot
const metrics = cache.getMetricsSnapshot()
console.log(`Cache hit rate: ${metrics.hitRate * 100}%`)
```

---

## 4. API Validation

### Using New Schemas

```typescript
import { validateQuery } from '@/lib/api/validate'
import {
  KalshiFillsQuerySchema,
  LiveTradesQuerySchema,
  AdminStatsQuerySchema,
  // ... 40+ more schemas
} from '@/lib/api/schemas'

export async function GET(request: NextRequest) {
  // Validate and sanitize query parameters
  const params = validateQuery(KalshiFillsQuerySchema, request.nextUrl.searchParams)

  // params is now type-safe and validated
  // All security checks passed (XSS, injection, etc.)
}
```

### Available Schema Categories

1. **Portfolio** (`portfolio.ts`)
   - Kalshi fills, positions, settlements
   - Polymarket positions, value

2. **Insights** (`insights.ts`)
   - Live trades, market stats
   - Trade analytics, snapshots

3. **Admin** (`admin.ts`)
   - Stats, audit logs
   - User management, system settings

4. **Layers** (`layers.ts`)
   - Census, finance, news layers
   - Custom layer creation

5. **Conflicts** (`conflicts.ts`)
   - OSINT queries
   - Conflict event creation

📖 **Full Report:** [docs/VALIDATION_COVERAGE_REPORT.md](./VALIDATION_COVERAGE_REPORT.md)

---

## Common Tasks

### Check System Health

```bash
# Redis health
curl http://localhost:3000/api/health/redis

# Cache metrics
curl http://localhost:3000/api/metrics/cache

# Check encryption version
node -e "
const { getEncryptionVersion } = require('./lib/utils/encryption');
console.log(getEncryptionVersion(process.env.SAMPLE_ENCRYPTED_DATA));
"
```

### Backup Redis

```bash
# Manual backup
docker exec prediction_markets_redis_prod redis-cli -a $REDIS_PASSWORD BGSAVE

# Copy backup
docker cp prediction_markets_redis_prod:/data/dump.rdb ./backups/manual_$(date +%Y%m%d).rdb

# List automated backups
ls -lh backups/redis_backup_*.rdb
```

### Monitor Cache Performance

```bash
# Real-time metrics
watch -n 5 'curl -s http://localhost:3000/api/metrics/cache | jq ".aggregate"'

# Check Redis memory
docker exec prediction_markets_redis_prod redis-cli -a $REDIS_PASSWORD INFO memory | grep used_memory_human
```

### Validate API Endpoint

```typescript
// Example: Add validation to your endpoint
import { NextRequest, NextResponse } from 'next/server'
import { validateQuery } from '@/lib/api/validate'
import { YourSchema } from '@/lib/api/schemas'

export async function GET(request: NextRequest) {
  try {
    // This automatically validates and sanitizes
    const params = validateQuery(YourSchema, request.nextUrl.searchParams)

    // Use validated params safely
    const data = await fetchData(params)

    return NextResponse.json({ data })
  } catch (error) {
    // Validation errors return 400 with details
    if (error.code === 'VALIDATION_ERROR') {
      return NextResponse.json(
        { error: error.message, details: error.issues },
        { status: 400 }
      )
    }
    throw error
  }
}
```

---

## Environment Variables Reference

### Encryption Keys
```bash
ENCRYPTION_KEY_V1=<your-old-key>
ENCRYPTION_KEY_V2=<your-new-key>
ENCRYPTION_KEY_V3=<future-key>
ENCRYPTION_KEY_CURRENT=v2
```

### Redis Configuration
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>
REDIS_MAX_MEMORY=1gb
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}
```

### Database
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=webapp
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
```

---

## Troubleshooting

### Encryption Issues

**Problem:** "Decryption failed"
```bash
# Check key version
npx tsx scripts/rotate-encryption-key.ts --verify

# Verify environment variables
node -e "console.log('V1:', !!process.env.ENCRYPTION_KEY_V1, 'V2:', !!process.env.ENCRYPTION_KEY_V2)"
```

### Redis Connection Issues

**Problem:** "ECONNREFUSED"
```bash
# Check Redis is running
docker ps | grep redis

# Check logs
docker logs prediction_markets_redis_prod

# Test connection
docker exec prediction_markets_redis_prod redis-cli -a $REDIS_PASSWORD ping
```

### Cache Metrics Not Updating

**Problem:** Metrics showing zero
```bash
# Reset metrics
curl -X DELETE http://localhost:3000/api/metrics/cache

# Generate some cache activity
curl http://localhost:3000/api/markets/all

# Check metrics again
curl http://localhost:3000/api/metrics/cache
```

### Validation Errors

**Problem:** "VALIDATION_ERROR"
```typescript
// Check the error details
{
  "error": "Invalid query parameters",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "limit",
      "message": "Number must be less than or equal to 1000"
    }
  ]
}

// Fix: Adjust your request parameters
```

---

## Performance Tips

### Cache Optimization

```typescript
// Use appropriate TTL for your data
await cache.set('key', data, 30000)  // 30 seconds for volatile data
await marketCache.set('key', data, 300000)  // 5 minutes for market data
await sessionCache.set('key', data, 3600000)  // 1 hour for session data

// Monitor hit rates (aim for > 80%)
const metrics = cache.getMetricsSnapshot()
if (metrics.hitRate < 0.8) {
  // Consider increasing TTL or improving cache strategy
}
```

### Redis Memory Management

```bash
# Check memory usage
docker exec prediction_markets_redis_prod redis-cli -a $REDIS_PASSWORD INFO memory

# If memory is high:
# 1. Check eviction policy (should be allkeys-lru)
# 2. Review TTLs on keys
# 3. Consider increasing REDIS_MAX_MEMORY
# 4. Monitor for memory leaks
```

### Validation Performance

```typescript
// Schemas are compiled once, reuse them
import { MySchema } from '@/lib/api/schemas'  // ✅ Good

// Don't create schemas in hot paths
const schema = z.object({ ... })  // ❌ Avoid in request handlers
```

---

## Security Checklist

Before deploying to production:

### Encryption
- [ ] Set strong ENCRYPTION_KEY_V1 (32+ bytes)
- [ ] Generate new ENCRYPTION_KEY_V2
- [ ] Test rotation in staging
- [ ] Document key locations
- [ ] Set up key rotation schedule

### Redis
- [ ] Set strong REDIS_PASSWORD (32+ characters)
- [ ] Verify dangerous commands are disabled
- [ ] Test backup restoration
- [ ] Set up monitoring alerts
- [ ] Configure firewall rules

### Validation
- [ ] Review all schema definitions
- [ ] Test with malicious inputs
- [ ] Verify error messages don't leak info
- [ ] Check rate limiting integration
- [ ] Update API documentation

### Monitoring
- [ ] Set up cache metrics dashboard
- [ ] Configure alerting thresholds
- [ ] Test health check endpoints
- [ ] Document monitoring procedures
- [ ] Set up log aggregation

---

## Support

### Documentation
- 📖 [Encryption Key Rotation Guide](./ENCRYPTION_KEY_ROTATION.md)
- 📖 [Redis Production Deployment](./REDIS_PRODUCTION_DEPLOYMENT.md)
- 📖 [Validation Coverage Report](./VALIDATION_COVERAGE_REPORT.md)
- 📖 [Sprint Implementation Summary](./SPRINT_IMPLEMENTATION_SUMMARY.md)

### Quick Links
- **Encryption Script:** `scripts/rotate-encryption-key.ts`
- **Redis Config:** `docker-compose.prod.yml`
- **Metrics API:** `app/api/metrics/cache/route.ts`
- **Schemas:** `lib/api/schemas/`

### Getting Help

1. Check the relevant documentation guide
2. Review error messages and logs
3. Use the troubleshooting sections
4. Verify environment variables
5. Test in staging environment first

---

**Last Updated:** January 18, 2026
**Version:** 1.0.0
**Status:** Production-Ready ✅
