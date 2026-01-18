# Redis Production Deployment Guide

## Overview

This guide covers deploying Redis in production with persistence, security, monitoring, and backup configurations.

## Architecture

### Production Configuration

- **Persistence:** AOF + RDB snapshots
- **Memory:** 1GB default (configurable)
- **Eviction:** allkeys-lru policy
- **Security:** Password authentication, disabled dangerous commands
- **Backups:** Automated daily backups with 7-day retention
- **Monitoring:** Health checks and metrics

## Quick Start

### 1. Environment Setup

Create or update `.env.production`:

```bash
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password-here
REDIS_MAX_MEMORY=1gb
REDIS_URL=redis://:your-secure-redis-password-here@redis:6379

# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-postgres-password-here
POSTGRES_DB=webapp
POSTGRES_PORT=5432
```

### 2. Generate Secure Password

```bash
# Generate a strong Redis password
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Start Production Stack

```bash
# Start main services
docker-compose -f docker-compose.prod.yml up -d

# Verify services are running
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs -f redis
```

### 4. Enable Backup Service (Optional)

```bash
# Start with backup profile
docker-compose -f docker-compose.prod.yml --profile backup up -d
```

## Configuration Details

### Memory Management

**maxmemory: 1gb**
- Limits Redis memory usage
- Prevents OOM (Out of Memory) situations
- Configurable via `REDIS_MAX_MEMORY` environment variable

**maxmemory-policy: allkeys-lru**
- Evicts least recently used keys when memory limit is reached
- Applies to all keys (not just those with TTL)
- Best for caching use cases

### Persistence Configuration

#### AOF (Append Only File)
```
appendonly yes                     # Enable AOF persistence
appendfsync everysec               # Sync to disk every second
auto-aof-rewrite-percentage 100    # Rewrite when 100% larger
auto-aof-rewrite-min-size 64mb     # Minimum size before rewrite
```

**Benefits:**
- Better durability (1-second data loss window)
- Automatic log compaction
- Human-readable backup format

#### RDB (Redis Database Snapshots)
```
save 900 1      # Save if 1 key changed in 15 minutes
save 300 10     # Save if 10 keys changed in 5 minutes
save 60 10000   # Save if 10,000 keys changed in 1 minute
```

**Benefits:**
- Point-in-time snapshots
- Compact binary format
- Fast restart times

### Security Configuration

#### Disabled Commands
These dangerous commands are disabled in production:

- **FLUSHALL:** Deletes all data from all databases
- **FLUSHDB:** Deletes all data from current database
- **CONFIG:** Allows runtime configuration changes
- **DEBUG:** Exposes internal debugging commands

**SHUTDOWN** is renamed to **SHUTDOWN_PROD_ONLY** for controlled shutdowns.

#### Password Authentication

```bash
# Authenticate with Redis CLI
docker exec -it prediction_markets_redis_prod redis-cli -a your-password

# Or using connection string
redis-cli -u redis://:your-password@localhost:6379
```

### Network Configuration

```yaml
networks:
  edgepannel_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

- Isolated network for service communication
- No external exposure except mapped ports
- Internal DNS resolution (services accessible by name)

## Health Checks

### Redis Health Check

```bash
# Manual health check
docker exec prediction_markets_redis_prod redis-cli -a your-password ping
# Should return: PONG

# Automated health check (configured in docker-compose)
# - Interval: 10 seconds
# - Timeout: 3 seconds
# - Retries: 5
# - Start period: 10 seconds
```

### Application Health Check Endpoint

Create a health check endpoint in your application:

```typescript
// app/api/health/redis/route.ts
import { NextResponse } from 'next/server'
import { getRedisClient, isRedisAvailable } from '@/lib/cache/redis-client'

export async function GET() {
  if (!isRedisAvailable()) {
    return NextResponse.json(
      { status: 'unhealthy', message: 'Redis not available' },
      { status: 503 }
    )
  }

  try {
    const redis = getRedisClient()
    await redis?.ping()

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
```

## Backup and Restore

### Automated Backups

The backup service automatically:
- Creates RDB snapshots daily
- Stores backups in `./backups/` directory
- Retains backups for 7 days
- Cleans up old backups automatically

```bash
# Enable backup service
docker-compose -f docker-compose.prod.yml --profile backup up -d

# Check backup logs
docker-compose -f docker-compose.prod.yml logs redis-backup

# List backups
ls -lh backups/redis_backup_*.rdb
```

### Manual Backup

```bash
# Create immediate backup
docker exec prediction_markets_redis_prod redis-cli -a your-password BGSAVE

# Wait for backup to complete
docker exec prediction_markets_redis_prod redis-cli -a your-password LASTSAVE

# Copy RDB file
docker cp prediction_markets_redis_prod:/data/dump.rdb ./backups/manual_backup_$(date +%Y%m%d).rdb
```

### Restore from Backup

```bash
# 1. Stop Redis
docker-compose -f docker-compose.prod.yml stop redis

# 2. Copy backup to data volume
docker run --rm -v prediction_markets_redis_prod:/data -v $(pwd)/backups:/backup alpine \
  cp /backup/redis_backup_YYYYMMDD_HHMMSS.rdb /data/dump.rdb

# 3. Start Redis
docker-compose -f docker-compose.prod.yml start redis

# 4. Verify data
docker exec prediction_markets_redis_prod redis-cli -a your-password DBSIZE
```

### AOF Recovery

If AOF is corrupted:

```bash
# Check AOF integrity
docker exec prediction_markets_redis_prod redis-check-aof /data/appendonly.aof

# Fix AOF if corrupted
docker exec prediction_markets_redis_prod redis-check-aof --fix /data/appendonly.aof
```

## Monitoring

### Key Metrics to Monitor

#### 1. Memory Usage

```bash
# Check memory usage
docker exec prediction_markets_redis_prod redis-cli -a your-password INFO memory

# Key metrics:
# - used_memory_human: Current memory usage
# - used_memory_peak_human: Peak memory usage
# - mem_fragmentation_ratio: Memory fragmentation
```

#### 2. Performance

```bash
# Check performance stats
docker exec prediction_markets_redis_prod redis-cli -a your-password INFO stats

# Key metrics:
# - total_commands_processed: Total commands processed
# - instantaneous_ops_per_sec: Current operations per second
# - keyspace_hits: Cache hit count
# - keyspace_misses: Cache miss count
```

#### 3. Persistence

```bash
# Check persistence status
docker exec prediction_markets_redis_prod redis-cli -a your-password INFO persistence

# Key metrics:
# - aof_enabled: AOF status
# - aof_last_write_status: Last AOF write status
# - rdb_last_save_time: Last RDB save timestamp
```

#### 4. Replication (if configured)

```bash
# Check replication status
docker exec prediction_markets_redis_prod redis-cli -a your-password INFO replication
```

### Prometheus Metrics (Optional)

Install Redis Exporter for Prometheus:

```yaml
# Add to docker-compose.prod.yml
redis-exporter:
  image: oliver006/redis_exporter:latest
  container_name: redis_exporter
  restart: unless-stopped
  environment:
    REDIS_ADDR: redis:6379
    REDIS_PASSWORD: ${REDIS_PASSWORD}
  ports:
    - "9121:9121"
  networks:
    - edgepannel_network
  depends_on:
    - redis
```

Access metrics at: `http://localhost:9121/metrics`

## Performance Tuning

### Connection Pooling

Update your Redis client configuration:

```typescript
// lib/cache/redis-client.ts
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,

  // Connection pool settings
  lazyConnect: false,
  keepAlive: 30000,

  // Retry strategy
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },

  // Reconnect on error
  reconnectOnError: (err) => {
    const targetError = 'READONLY'
    if (err.message.includes(targetError)) {
      return true
    }
    return false
  }
})
```

### Optimal Configuration for Different Workloads

#### Cache-Heavy Workload
```bash
REDIS_MAX_MEMORY=2gb
maxmemory-policy=allkeys-lru
```

#### Session Storage
```bash
REDIS_MAX_MEMORY=512mb
maxmemory-policy=volatile-lru
```

#### Queue/Job Processing
```bash
REDIS_MAX_MEMORY=1gb
maxmemory-policy=noeviction
```

## Scaling

### Vertical Scaling

Increase memory and resources:

```yaml
# docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 4gb
      cpus: '2.0'
    reservations:
      memory: 2gb
      cpus: '1.0'
```

Update environment:
```bash
REDIS_MAX_MEMORY=4gb
```

### Horizontal Scaling (Redis Cluster)

For high availability and sharding, consider Redis Cluster:

```yaml
# redis-cluster.yml (example)
services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

  redis-node-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

  redis-node-3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
```

## Troubleshooting

### Issue: Out of Memory

**Symptoms:**
- Redis stops accepting writes
- Error: `OOM command not allowed when used memory > 'maxmemory'`

**Solutions:**
1. Increase memory: `REDIS_MAX_MEMORY=2gb`
2. Review cache TTLs (reduce if too long)
3. Check for memory leaks in application
4. Enable eviction: Ensure `maxmemory-policy` is set

### Issue: Slow Performance

**Symptoms:**
- High latency on cache operations
- Application timeouts

**Diagnosis:**
```bash
# Check slow log
docker exec prediction_markets_redis_prod redis-cli -a your-password SLOWLOG GET 10

# Monitor commands in real-time
docker exec prediction_markets_redis_prod redis-cli -a your-password MONITOR
```

**Solutions:**
1. Avoid KEYS command (use SCAN instead)
2. Use pipelining for bulk operations
3. Optimize data structures
4. Add connection pooling

### Issue: Persistence Failures

**Symptoms:**
- Disk full errors
- AOF rewrite failures

**Solutions:**
```bash
# Check disk space
df -h

# Clean up old backups
find ./backups -name "redis_backup_*.rdb" -mtime +7 -delete

# Compact AOF
docker exec prediction_markets_redis_prod redis-cli -a your-password BGREWRITEAOF
```

### Issue: Connection Refused

**Symptoms:**
- Application cannot connect to Redis
- "ECONNREFUSED" errors

**Solutions:**
1. Check Redis is running: `docker ps`
2. Verify password: Check `REDIS_PASSWORD` in `.env`
3. Check network: `docker network inspect edgepannel_network`
4. Review logs: `docker-compose logs redis`

## Security Best Practices

### 1. Use Strong Passwords

```bash
# Generate strong password
openssl rand -base64 32 > redis_password.txt

# Never commit to git
echo "redis_password.txt" >> .gitignore
```

### 2. Network Isolation

```yaml
# Expose Redis only on localhost
ports:
  - "127.0.0.1:6379:6379"
```

### 3. TLS/SSL (Optional)

For highly sensitive environments:

```bash
# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout redis.key -out redis.crt

# Update Redis config
redis-server --tls-port 6380 \
  --tls-cert-file redis.crt \
  --tls-key-file redis.key \
  --tls-ca-cert-file ca.crt
```

### 4. Firewall Rules

```bash
# Allow only application server
ufw allow from 172.25.0.0/16 to any port 6379
ufw deny 6379
```

## Migration Checklist

Before deploying to production:

- [ ] Set strong `REDIS_PASSWORD`
- [ ] Configure `REDIS_MAX_MEMORY` based on workload
- [ ] Set up automated backups
- [ ] Test restore procedure
- [ ] Configure monitoring and alerts
- [ ] Review security settings
- [ ] Test application with production Redis
- [ ] Document access credentials securely
- [ ] Set up log rotation
- [ ] Configure firewall rules

## Maintenance

### Regular Tasks

**Daily:**
- Check health checks
- Monitor memory usage

**Weekly:**
- Review slow queries
- Verify backups are created
- Check disk space

**Monthly:**
- Rotate passwords
- Review security settings
- Update Redis version
- Clean up old backups

### Version Updates

```bash
# Pull new Redis image
docker pull redis:7-alpine

# Recreate container
docker-compose -f docker-compose.prod.yml up -d redis

# Verify version
docker exec prediction_markets_redis_prod redis-cli --version
```

## Support and Resources

### Official Documentation
- Redis Documentation: https://redis.io/docs/
- Redis CLI: https://redis.io/docs/ui/cli/
- Redis Security: https://redis.io/docs/management/security/

### Community
- Redis GitHub: https://github.com/redis/redis
- Redis Discord: https://discord.gg/redis
- Stack Overflow: [redis] tag

### Monitoring Tools
- RedisInsight: https://redis.com/redis-enterprise/redis-insight/
- Redis Commander: https://github.com/joeferner/redis-commander
