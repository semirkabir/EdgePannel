# Automatic Market Indexing

This guide explains how to set up automatic hourly market indexing so new markets are automatically geocoded and added to the map.

## 🎯 Overview

The automatic indexing system:
- Fetches latest markets from Kalshi and Polymarket every hour
- Extracts location data from market titles
- Geocodes markets with GPS coordinates
- Updates the map with new markets automatically
- Skips already-indexed markets (no duplicates)

## 🚀 Setup Options

### Option 1: Vercel (Recommended) ⭐

**Best for:** Production deployments

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Add the cron secret:**
   ```bash
   vercel env add CRON_SECRET production
   ```
   When prompted, paste the value from your `.env` file:
   ```
   03826742e1191394e6120d215e606fb2b2fc8aa431acdab4c461a333
   ```

3. **Redeploy:**
   ```bash
   vercel --prod
   ```

4. **Done!** The cron will run automatically every hour.

**How it works:**
- `vercel.json` configures the cron schedule (every hour)
- Vercel's infrastructure automatically triggers the endpoint
- No server maintenance required

---

### Option 2: Local Scheduler (Development)

**Best for:** Local development or testing

1. **Start the scheduler:**
   ```bash
   npm run cron:start
   ```

2. **Keep it running:**
   - The scheduler runs in the background
   - Indexes markets immediately on startup
   - Then runs every hour automatically
   - Press `Ctrl+C` to stop

**Output example:**
```
🚀 Market Indexing Scheduler Started
⏰ Schedule: Every hour (0 * * * *)
🌐 Target: http://localhost:3000

[2025-12-14T10:00:00.000Z] 🔄 Starting automatic market indexing...
✅ Indexing complete!
   Total markets: 1000
   Indexed: 234
   Skipped: 700
   Failed: 0

   By Platform:
   - kalshi: 120 indexed, 350 skipped, 0 failed
   - polymarket: 114 indexed, 350 skipped, 0 failed
```

---

### Option 3: Self-Hosted with System Cron

**Best for:** Self-hosted production servers

1. **Get your CRON_SECRET from `.env`:**
   ```bash
   grep CRON_SECRET .env
   ```

2. **Add to system crontab:**
   ```bash
   crontab -e
   ```

3. **Add this line:**
   ```cron
   0 * * * * curl -H 'Authorization: Bearer YOUR_CRON_SECRET_HERE' http://localhost:3000/api/cron/index-markets
   ```

4. **Or use your production domain:**
   ```cron
   0 * * * * curl -H 'Authorization: Bearer YOUR_CRON_SECRET_HERE' https://your-domain.com/api/cron/index-markets
   ```

---

### Option 4: External Cron Service

**Best for:** Services like Railway, Render, Fly.io

Use services like:
- [EasyCron](https://www.easycron.com/)
- [cron-job.org](https://cron-job.org/)
- [Cronitor](https://cronitor.io/)

**Configuration:**
- **URL:** `https://your-domain.com/api/cron/index-markets`
- **Method:** GET
- **Header:** `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule:** `0 * * * *` (every hour)

---

## 🧪 Testing

### Test the cron endpoint manually:

```bash
npm run cron:test
```

**Or using curl:**
```bash
curl -H "Authorization: Bearer $(grep CRON_SECRET .env | cut -d '=' -f2)" \
  http://localhost:3000/api/cron/index-markets
```

**Expected response:**
```json
{
  "success": true,
  "timestamp": "2025-12-14T10:00:00.000Z",
  "results": {
    "total": 1000,
    "indexed": 234,
    "failed": 0,
    "skipped": 766,
    "platforms": {
      "kalshi": { "indexed": 120, "failed": 0, "skipped": 380 },
      "polymarket": { "indexed": 114, "failed": 0, "skipped": 386 }
    }
  }
}
```

---

## 📊 Monitoring

### Check indexing logs:

**Vercel:**
```bash
vercel logs --follow
```

**Local:**
- Logs appear in the terminal where `npm run cron:start` is running
- Check the admin dashboard: `http://localhost:3000/admin/index-markets`

---

## 🔒 Security

The cron endpoint is protected with a secret token:

- **Environment variable:** `CRON_SECRET`
- **Required header:** `Authorization: Bearer <secret>`
- Without valid auth, requests return `401 Unauthorized`

**Generated automatically** when you run `./scripts/setup-cron.sh`

---

## 🛠️ Configuration

### Change the schedule:

**Vercel** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/index-markets",
      "schedule": "0 */2 * * *"  // Every 2 hours
    }
  ]
}
```

**Local Scheduler** (`scripts/local-cron-scheduler.ts`):
```typescript
// Every 30 minutes
cron.schedule('*/30 * * * *', () => {
  runIndexing()
})

// Daily at midnight
cron.schedule('0 0 * * *', () => {
  runIndexing()
})
```

**Cron syntax:**
```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    └─── Day of week (0-7, Sunday=0 or 7)
│    │    │    └──────── Month (1-12)
│    │    └───────────── Day of month (1-31)
│    └────────────────── Hour (0-23)
└─────────────────────── Minute (0-59)
```

**Common schedules:**
- `0 * * * *` - Every hour
- `*/30 * * * *` - Every 30 minutes
- `0 */2 * * *` - Every 2 hours
- `0 0 * * *` - Daily at midnight

---

## ❓ Troubleshooting

### Cron not running on Vercel?

1. Check environment variables are set:
   ```bash
   vercel env ls
   ```

2. Verify `vercel.json` is in the root directory

3. Check logs:
   ```bash
   vercel logs --follow
   ```

### "Unauthorized" error?

- Make sure `CRON_SECRET` matches in `.env` and Vercel environment
- Verify the `Authorization` header format: `Bearer <secret>`

### Markets not appearing on map?

1. Check the admin dashboard: `/admin/index-markets`
2. Verify the database table exists (should auto-create)
3. Check that markets have valid location data
4. Look for errors in the logs

### No new markets being indexed?

- The system skips already-indexed markets (by design)
- Markets without location data are skipped
- Check if market titles contain geographic references

---

## 🎯 Summary

**For most users:**
1. Deploy to Vercel
2. Add `CRON_SECRET` to Vercel env
3. Done! Markets auto-index every hour

**For local development:**
1. Run `npm run cron:start`
2. Keep terminal open
3. Stops when you hit Ctrl+C

**Need help?** Check the logs or test manually with `npm run cron:test`
