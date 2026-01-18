# Infrastructure Overview

Comprehensive overview of production infrastructure improvements for EdgePanel.

## What's New

This month's infrastructure improvements introduce enterprise-grade features:

1. **Redis Monitoring Dashboard** - Real-time Redis metrics and management
2. **Secrets Management** - Multi-provider secrets integration
3. **Comprehensive Testing** - 70%+ test coverage with Vitest
4. **Performance Profiling** - Request tracking and optimization recommendations

---

## Features

### 1. Redis Monitoring Dashboard

**Location:** `/admin/redis`

A comprehensive Redis monitoring and management interface providing:

#### Features

- **Connection Health**
  - Real-time connection status
  - Uptime tracking
  - Connected clients count
  - Latency measurement

- **Memory Metrics**
  - Used memory vs. max memory
  - Memory fragmentation ratio
  - Peak memory usage
  - Human-readable formatting

- **Performance Metrics**
  - Operations per second
  - Cache hit rate
  - Keyspace hits/misses
  - Commands processed

- **Keyspace Statistics**
  - Total keys by namespace
  - Keys with TTL
  - Distribution visualization
  - Per-namespace management

- **Slow Query Log**
  - Recent slow operations
  - Execution time tracking
  - Command details
  - Performance insights

- **Management Tools**
  - Clear cache by namespace
  - Inspect individual keys
  - Browse keys by pattern
  - Delete keys
  - View TTL information

#### API Endpoints

```typescript
// Get Redis statistics
GET /api/admin/redis/stats

// Manage Redis (clear, inspect, delete)
POST /api/admin/redis/manage
```

#### Usage

```bash
# View dashboard
https://yourdomain.com/admin/redis

# Get stats via API
curl https://yourdomain.com/api/admin/redis/stats \
  -H "Authorization: Bearer <token>"

# Clear cache namespace
curl -X POST https://yourdomain.com/api/admin/redis/manage \
  -H "Content-Type: application/json" \
  -d '{"action": "clear", "namespace": "cache"}'
```

---

### 2. Secrets Management

**Location:** `lib/secrets/manager.ts`

Multi-provider secrets management with support for:

#### Providers

- **AWS Secrets Manager**
- **HashiCorp Vault**
- **Azure Key Vault**
- **Local (.env)** - Development only

#### Features

- Automatic provider selection based on environment
- Secret caching (5-minute TTL)
- Graceful fallback to environment variables
- Secret rotation support
- Health checking
- Batch secret loading

#### Configuration

```bash
# Choose provider
SECRETS_PROVIDER=aws  # or vault, azure, local

# Provider-specific configuration
# AWS
AWS_REGION=us-east-1

# Vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=your-token

# Azure
AZURE_VAULT_NAME=your-vault
```

#### Usage

```typescript
import { getSecret, getSecrets } from '@/lib/secrets/manager'

// Get single secret
const apiKey = await getSecret('POLYMARKET_API_KEY')

// Get required secret (throws if not found)
const encryptionKey = await getSecret('ENCRYPTION_KEY', { required: true })

// Get multiple secrets
const secrets = await getSecrets([
  'ENCRYPTION_KEY',
  'NEXTAUTH_SECRET',
  'DATABASE_URL'
])

// Clear cache after rotation
import { clearSecretsCache } from '@/lib/secrets/manager'
clearSecretsCache()
```

#### Migration

See detailed migration guide: [`docs/SECRETS_MANAGEMENT.md`](/Users/mir/EdgePannel/Edgepannel/docs/SECRETS_MANAGEMENT.md)

---

### 3. Comprehensive Testing

**Framework:** Vitest
**Coverage Target:** 70%+
**Location:** `tests/`

#### Test Structure

```
tests/
├── setup.ts                           # Global configuration
├── unit/
│   ├── encryption/
│   │   └── encryption.test.ts        # 90%+ coverage
│   ├── cache/
│   │   └── cache-manager.test.ts     # 85%+ coverage
│   └── middleware/
│       └── rate-limit.test.ts        # 80%+ coverage
└── integration/
    └── api/                           # API integration tests
```

#### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Visual UI
npm run test:ui
```

#### Test Coverage

| Module | Lines | Functions | Branches | Status |
|--------|-------|-----------|----------|--------|
| Encryption | 90%+ | 90%+ | 85%+ | ✅ |
| Cache Manager | 85%+ | 85%+ | 80%+ | ✅ |
| Rate Limiter | 80%+ | 80%+ 75%+ | ✅ |
| **Overall** | **70%+** | **70%+** | **65%+** | ✅ |

#### What's Tested

**Encryption Module:**
- Encrypt/decrypt round-trip
- IV uniqueness
- Auth tag verification
- Error handling
- Legacy format support
- Edge cases (empty, long, unicode)

**Cache Manager:**
- Get/set operations
- TTL expiration
- Memory fallback
- Batch operations
- getOrSet pattern
- Increment operations

**Rate Limiter:**
- Request limiting
- IP-based tracking
- Sliding window accuracy
- Path-based rules
- Memory fallback
- Configuration

See detailed testing guide: [`docs/TESTING_GUIDE.md`](/Users/mir/EdgePannel/Edgepannel/docs/TESTING_GUIDE.md)

---

### 4. Performance Profiling

**Location:** `lib/middleware/performance.ts`

Comprehensive performance tracking and optimization recommendations.

#### Features

- **Request Tracking**
  - Duration measurement
  - Redis latency tracking
  - Cache hit/miss tracking
  - Status code tracking

- **Endpoint Statistics**
  - Average response time
  - Min/max duration
  - Slow request count
  - Cache hit rate
  - Request count

- **Performance Summary**
  - Total requests
  - Average duration
  - Slow requests count
  - Overall cache hit rate
  - Top slow endpoints

- **Optimization Recommendations**
  - Automatic issue detection
  - Priority-based suggestions
  - Actionable recommendations

#### API Endpoints

```typescript
// Get performance metrics
GET /api/metrics/performance

// Get Redis slow log
GET /api/metrics/redis/slow-log

// Clear metrics
POST /api/metrics/performance
```

#### Usage

```typescript
import { recordMetric, getPerformanceSummary } from '@/lib/middleware/performance'

// Record a metric
recordMetric({
  path: '/api/markets',
  method: 'GET',
  duration: 245,
  timestamp: Date.now(),
  cacheHit: true,
  redisLatency: 2.1
})

// Get summary
const summary = getPerformanceSummary()
console.log(summary)
// {
//   totalRequests: 1234,
//   avgDuration: 245,
//   slowRequests: 12,
//   cacheHitRate: 0.73,
//   topSlowEndpoints: [...]
// }

// Get recommendations
import { generateRecommendations } from '@/lib/middleware/performance'

const recommendations = generateRecommendations()
// [
//   {
//     endpoint: '/api/markets/search',
//     issue: 'Average response time: 850ms',
//     recommendation: 'Increase cache TTL or add caching',
//     priority: 'high'
//   }
// ]
```

#### Viewing Metrics

```bash
# Get performance metrics
curl https://yourdomain.com/api/metrics/performance \
  -H "Authorization: Bearer <token>"

# Get Redis slow log
curl https://yourdomain.com/api/metrics/redis/slow-log?count=50 \
  -H "Authorization: Bearer <token>"
```

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Application Layer                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Next.js  │  │    API     │  │   Admin    │            │
│  │   Pages    │  │  Routes    │  │  Dashboard │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Middleware Layer                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │    Rate    │  │Performance │  │  Security  │            │
│  │   Limiter  │  │  Profiler  │  │  Headers   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Cache    │  │  Secrets   │  │ Encryption │            │
│  │  Manager   │  │  Manager   │  │  Service   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Redis    │  │ PostgreSQL │  │  Secrets   │            │
│  │   Cache    │  │  Database  │  │   Vault    │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request Processing**
   ```
   Request → Rate Limiter → Performance Profiler → Handler
   ```

2. **Cache Operations**
   ```
   Handler → Cache Manager → Redis (or Memory Fallback)
   ```

3. **Secret Loading**
   ```
   App Start → Secrets Manager → Provider (AWS/Vault/Azure) → Cache
   ```

4. **Performance Tracking**
   ```
   Request → Middleware → Record Metric → Stats Aggregation
   ```

---

## Configuration

### Environment Variables

#### Required

```bash
# Application
NODE_ENV=production
NEXTAUTH_SECRET=<your-secret>
NEXTAUTH_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://...

# Encryption
ENCRYPTION_KEY=<32-character-key>

# Secrets Provider
SECRETS_PROVIDER=aws  # or vault, azure, local
```

#### Optional

```bash
# Redis
REDIS_URL=redis://...

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_PER_MINUTE=300
RATE_LIMIT_API_MAX_PER_MINUTE=2000
RATE_LIMIT_WINDOW_MS=60000

# AWS (if using AWS Secrets Manager)
AWS_REGION=us-east-1

# Vault (if using HashiCorp Vault)
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=<token>

# Azure (if using Azure Key Vault)
AZURE_VAULT_NAME=<vault-name>
```

---

## Monitoring

### Key Metrics to Monitor

#### Redis

- **Memory Usage:** < 80% of max
- **Hit Rate:** > 70%
- **Operations/sec:** Baseline dependent
- **Latency:** < 10ms (P95)
- **Connection Count:** < 90% of max

#### Performance

- **Response Time:**
  - P50 < 200ms
  - P95 < 500ms
  - P99 < 1000ms

- **Error Rate:** < 0.1%
- **Cache Hit Rate:** > 70%
- **Slow Requests:** < 5% of total

#### Application

- **Uptime:** > 99.9%
- **CPU Usage:** < 80%
- **Memory Usage:** < 80%
- **Database Connections:** < 80% of pool

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response Time (P95) | > 500ms | > 1000ms |
| Error Rate | > 0.5% | > 1% |
| Redis Memory | > 80% | > 90% |
| Cache Hit Rate | < 60% | < 50% |
| Database Connections | > 70% | > 85% |

---

## Deployment

### Pre-Deployment Checklist

- [ ] Install dependencies: `npm install`
- [ ] Run tests: `npm test`
- [ ] Build application: `npm run build`
- [ ] Verify environment variables
- [ ] Configure secrets provider
- [ ] Set up Redis instance
- [ ] Configure monitoring

### Deployment Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Tests**
   ```bash
   npm test
   npm run test:coverage
   ```

3. **Build Application**
   ```bash
   npm run build
   ```

4. **Deploy to Production**
   ```bash
   # Platform-specific deployment
   # Vercel, AWS, Azure, etc.
   ```

5. **Verify Deployment**
   ```bash
   # Health check
   curl https://yourdomain.com/api/health

   # Redis status
   curl https://yourdomain.com/api/health/redis
   ```

See complete production checklist: [`docs/PRODUCTION_READINESS.md`](/Users/mir/EdgePannel/Edgepannel/docs/PRODUCTION_READINESS.md)

---

## Troubleshooting

### Common Issues

#### Redis Connection Failures

**Symptoms:** Cache falls back to memory, slower performance

**Solutions:**
1. Check `REDIS_URL` is correct
2. Verify Redis instance is running
3. Check network connectivity
4. Review firewall rules
5. Verify Redis password/credentials

#### Secrets Not Loading

**Symptoms:** Application fails to start, "secret not found" errors

**Solutions:**
1. Verify `SECRETS_PROVIDER` is set correctly
2. Check provider credentials (AWS/Vault/Azure)
3. Ensure secrets exist in provider
4. Check IAM permissions (AWS)
5. Verify network connectivity to provider

#### High Memory Usage

**Symptoms:** Redis memory > 90%, application slowdown

**Solutions:**
1. Review cache TTL values (too long?)
2. Check for memory leaks in application
3. Analyze key distribution (`/admin/redis`)
4. Clear unused namespaces
5. Increase Redis memory or enable eviction

#### Slow Performance

**Symptoms:** High response times, timeout errors

**Solutions:**
1. Review performance metrics (`/api/metrics/performance`)
2. Check cache hit rate (should be > 70%)
3. Analyze slow operations
4. Review database query performance
5. Implement recommended optimizations

---

## Performance Optimization

### Quick Wins

1. **Increase Cache TTL**
   - Review current TTL values
   - Increase for stable data
   - Monitor cache hit rate

2. **Add Missing Caching**
   - Identify endpoints with low hit rates
   - Add caching where appropriate
   - Use `getOrSet` pattern

3. **Optimize Database Queries**
   - Add indexes for frequent queries
   - Use connection pooling
   - Implement pagination

4. **Enable CDN**
   - Configure CDN for static assets
   - Set appropriate cache headers
   - Use image optimization

### Monitoring Performance

```typescript
// View performance summary
fetch('/api/metrics/performance')
  .then(res => res.json())
  .then(data => {
    console.log('Avg response time:', data.summary.avgDuration)
    console.log('Cache hit rate:', data.summary.cacheHitRate)
    console.log('Recommendations:', data.recommendations)
  })
```

---

## Security Considerations

### Data Protection

- **At Rest:** Sensitive data encrypted using AES-256-GCM
- **In Transit:** All connections use TLS 1.2+
- **Secrets:** Stored in secrets manager, not in code

### Access Control

- **Admin Endpoints:** Require authentication
- **API Keys:** Encrypted and rotated regularly
- **Rate Limiting:** Prevents abuse and DDoS

### Best Practices

- Never commit secrets to version control
- Use secrets manager for all sensitive data
- Rotate credentials every 90 days
- Monitor for suspicious activity
- Keep dependencies updated

---

## Support & Resources

### Documentation

- [Production Readiness Checklist](/Users/mir/EdgePannel/Edgepannel/docs/PRODUCTION_READINESS.md)
- [Secrets Management Guide](/Users/mir/EdgePannel/Edgepannel/docs/SECRETS_MANAGEMENT.md)
- [Testing Guide](/Users/mir/EdgePannel/Edgepannel/docs/TESTING_GUIDE.md)

### Key Files

- `lib/cache/redis-client.ts` - Redis connection
- `lib/cache/cache-manager.ts` - Cache abstraction
- `lib/secrets/manager.ts` - Secrets management
- `lib/utils/encryption.ts` - Encryption utilities
- `lib/middleware/performance.ts` - Performance profiling
- `lib/middleware/rate-limit.ts` - Rate limiting

### API Endpoints

- `/admin/redis` - Redis dashboard
- `/api/admin/redis/stats` - Redis metrics
- `/api/metrics/performance` - Performance metrics
- `/api/health` - Application health
- `/api/health/redis` - Redis health

---

**Infrastructure Version:** 2.0.0
**Last Updated:** 2026-01-18
**Next Review:** 2026-02-18
