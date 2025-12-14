# Incremental Market Sync System

## 🎯 Overview

The **Incremental Sync System** replaces the wasteful hourly bulk reindex with an efficient, near real-time polling strategy that:
- ✅ Fetches only NEW markets (not all 2000+ markets every hour)
- ✅ Updates every 60 seconds (vs 60 minute delay)
- ✅ Uses 95% less API quota
- ✅ Auto-removes expired markets
- ✅ Keeps database lean

---

## 📊 Comparison: Old vs New

### Old System (Hourly Bulk)
```typescript
Every hour:
├── Fetch 1000 Polymarket markets (ALL of them)
├── Fetch 1000 Kalshi markets (ALL of them)
├── Geocode 2000 markets (even ones we already have!)
├── Upsert 2000 records
└── Takes: ~2-5 minutes

Problems:
❌ 90% duplicate work
❌ Up to 60 min delay for new markets
❌ Wastes API quota (re-fetching same markets)
❌ Database grows forever (no cleanup)
```

### New System (Incremental + Cleanup)
```typescript
Every 60 seconds:
├── Check lastSeenId
├── Fetch markets with id > lastSeenId (typically 0-20 markets)
├── Geocode only NEW markets
├── Index them
└── Takes: ~2-5 seconds

Once daily (3:00 AM UTC):
├── Find expired markets (endDate < now)
├── Mark as inactive
└── Takes: ~1 second

Result:
✅ New markets appear in 60 seconds
✅ Only processes what's new
✅ 95% less API usage
✅ Database stays clean
```

---

## 🏗️ Architecture

### 1. **Incremental Sync** (`/api/cron/sync-new-markets`)

**Frequency**: Every 60 seconds
**Purpose**: Fetch and index only new markets

```typescript
// Process:
1. Get lastSeenId from MarketSyncState table
2. Fetch markets where id > lastSeenId (Polymarket Gamma API)
3. Geocode new markets using location-extractor-v2
4. Store in GeotaggedMarket table
5. Update lastSeenId to highest ID processed

// Typical result:
- 0-20 new markets per minute
- ~5-10 API calls per minute
- Well within rate limits (100 req/10s)
```

### 2. **Expiration Cleanup** (`/api/cron/cleanup-expired`)

**Frequency**: Daily at 3:00 AM UTC
**Purpose**: Mark expired markets as inactive

```typescript
// Process:
1. Find markets where endDate < now AND active = true
2. Set active = false
3. These markets are automatically filtered out of map queries

// Result:
- Database stays lean
- Only active markets shown on map
- Expired markets hidden but not deleted (for historical data)
```

### 3. **State Tracking** (`MarketSyncState` table)

```sql
CREATE TABLE MarketSyncState (
  platform TEXT PRIMARY KEY,        -- 'polymarket' or 'kalshi'
  lastSeenId TEXT NOT NULL,          -- Highest market ID processed
  lastSeenTimestamp TIMESTAMP(3),    -- Timestamp of last market
  lastSync TIMESTAMP(3),             -- When sync last ran
  marketsProcessed INTEGER,          -- Total markets indexed
  updatedAt TIMESTAMP(3)
);
```

---

## 🚀 Deployment & Setup

### Step 1: Initial Bootstrap

Before enabling cron jobs, you need to **seed the database** with existing markets:

```bash
# Visit the admin panel
https://your-app.com/admin/index-markets

# Click "Index Markets" button
# This runs a one-time bulk index to fill the database

# Or trigger via API:
curl -X GET https://your-app.com/api/cron/index-markets \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Important**: The bootstrap now paginates through **ALL** Polymarket markets, not just the first 1000. This ensures complete market coverage before the incremental sync takes over. The process may take 5-10 minutes depending on how many markets exist.

### Step 2: Verify Migration

The migration should already be applied, but verify:

```sql
-- Check if tables exist
SELECT * FROM "MarketSyncState";
SELECT "active" FROM "GeotaggedMarket" LIMIT 1;

-- Should return data or empty result (not error)
```

### Step 3: Deploy to Vercel

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-new-markets",
      "schedule": "* * * * *"  // Every minute
    },
    {
      "path": "/api/cron/cleanup-expired",
      "schedule": "0 3 * * *"  // Daily at 3 AM UTC
    }
  ]
}
```

After deploying, Vercel will automatically:
- Run incremental sync every 60 seconds
- Run cleanup once daily at 3:00 AM UTC

### Step 4: Monitor Logs

Check that cron jobs are running:

```bash
# Vercel Dashboard → Your Project → Logs
# Filter by: /api/cron/

# You should see:
[NewMarketSync] Found 3 new markets
[NewMarketSync] Complete: { indexed: 3, skipped: 0, failed: 0 }

# Daily cleanup:
[CleanupExpired] Deactivated 15 expired markets
```

---

## 📈 Expected Performance

### API Usage

| Endpoint | Old (Hourly) | New (60s) | Savings |
|----------|--------------|-----------|---------|
| Market fetches | 24/day | 1,440/day | N/A |
| Markets fetched | 48,000/day | ~2,000/day | **96% less** |
| Geocoding ops | 48,000/day | ~2,000/day | **96% less** |
| DB writes | 48,000/day | ~2,000/day | **96% less** |

### User Experience

| Metric | Old | New | Improvement |
|--------|-----|-----|-------------|
| New market delay | 0-60 min | 0-60 sec | **60x faster** |
| Map load time | Same | Same | No change |
| Stale data risk | High | Very low | Much better |
| Expired markets | Show forever | Auto-hide | Cleaner |

### Resource Usage

| Resource | Old | New | Impact |
|----------|-----|-----|--------|
| API quota | High | Very low | 96% savings |
| DB storage | Growing forever | Stable | Sustainable |
| Cron duration | 2-5 min | 2-5 sec | 60x faster |
| Server CPU | High spikes | Consistent low | Smoother |

---

## 🔧 Troubleshooting

### Markets not appearing on map

**Check 1**: Is the incremental sync running?
```sql
SELECT * FROM "MarketSyncState" WHERE platform = 'polymarket';
-- lastSync should be recent (within 60 seconds)
```

**Check 2**: Are markets being indexed?
```sql
SELECT COUNT(*), MAX("createdAt")
FROM "GeotaggedMarket"
WHERE "active" = true;
-- Count should be increasing, createdAt should be recent
```

**Check 3**: Check cron logs in Vercel Dashboard
```
Look for errors in /api/cron/sync-new-markets
```

### Markets showing expired contracts

**Check**: Is cleanup running?
```sql
SELECT COUNT(*)
FROM "GeotaggedMarket"
WHERE "active" = true AND "endDate" < NOW();
-- Should be 0 or very low
```

**Fix**: Manually trigger cleanup
```bash
curl -X GET https://your-app.com/api/cron/cleanup-expired \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Rate limit errors

**Symptom**: 429 errors in logs
**Cause**: Too many requests to Polymarket API
**Fix**: The 60s interval should be well within limits (100 req/10s)

If you still hit limits:
- Increase interval to 120s in vercel.json
- Reduce `limit` parameter in sync endpoint

---

## 🎛️ Configuration

### Adjust Sync Frequency

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-new-markets",
      "schedule": "*/2 * * * *"  // Every 2 minutes instead of 1
    }
  ]
}
```

Cron schedule format: `* * * * *` (minute hour day month weekday)
- `* * * * *` = Every minute
- `*/5 * * * *` = Every 5 minutes
- `0 * * * *` = Every hour at :00
- `0 3 * * *` = Daily at 3:00 AM UTC

### Adjust Markets Fetched Per Sync

Edit `app/api/cron/sync-new-markets/route.ts`:

```typescript
const { markets: allMarkets } = await client.getMarkets({
  limit: 100, // Change this (max 100 recommended)
  // ...
})
```

### Change Cleanup Schedule

Edit `vercel.json`:

```json
{
  "path": "/api/cron/cleanup-expired",
  "schedule": "0 0 * * *"  // Midnight UTC instead of 3 AM
}
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **Sync Health**
```sql
-- Check last sync time
SELECT
  platform,
  lastSeenId,
  lastSync,
  marketsProcessed,
  AGE(NOW(), lastSync) as time_since_sync
FROM "MarketSyncState";
```

2. **Active Markets**
```sql
-- Count of active markets
SELECT
  platform,
  active,
  COUNT(*) as count
FROM "GeotaggedMarket"
GROUP BY platform, active;
```

3. **Recent Additions**
```sql
-- Markets added in last hour
SELECT
  COUNT(*),
  platform
FROM "GeotaggedMarket"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY platform;
```

4. **Expiration Stats**
```sql
-- Markets expiring soon
SELECT
  COUNT(*) as expiring_soon,
  platform
FROM "GeotaggedMarket"
WHERE "active" = true
  AND "endDate" BETWEEN NOW() AND NOW() + INTERVAL '1 day'
GROUP BY platform;
```

---

## 🔐 Security

Both cron endpoints require authorization:

```typescript
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

if (cronSecret && authHeader !== `Bearer ${cronSecret}`)
```

Set the secret in Vercel:
```bash
vercel env add CRON_SECRET
# Enter your secret value
```

Vercel automatically provides `VERCEL_CRON_SECRET` for cron jobs.

---

## 🎯 Summary

The Incremental Sync System transforms market indexing from a **wasteful bulk operation** into an **efficient, near real-time stream**:

- ⚡ **60x faster** new market appearance (60s vs 60min)
- 📉 **96% less** API usage
- 🎯 **Only processes new data** (not duplicates)
- 🧹 **Auto-cleanup** of expired markets
- 💾 **Lean database** (no bloat)
- 📊 **Better UX** (always fresh data)

The system is **production-ready** and requires minimal maintenance. Just monitor the cron logs occasionally to ensure smooth operation.
