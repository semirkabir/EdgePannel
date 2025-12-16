# Apply Tags Migration Manually (Supabase Dashboard)

Since we can't connect to the database from the command line, you can apply the migration directly through Supabase's SQL Editor.

## 🎯 Quick Method: Use Supabase SQL Editor

### Step 1: Open Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**

### Step 2: Copy and Run This SQL

Copy this entire SQL block and paste it into the SQL Editor:

```sql
-- Add tags field to GeotaggedMarket table
-- This migration adds support for storing multiple tags per market

-- Add tags column as an array of strings (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'GeotaggedMarket'
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE "GeotaggedMarket"
        ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

        RAISE NOTICE 'Added tags column';
    ELSE
        RAISE NOTICE 'Tags column already exists';
    END IF;
END $$;

-- Add index on category for faster filtering (if it doesn't exist)
CREATE INDEX IF NOT EXISTS "GeotaggedMarket_category_idx"
ON "GeotaggedMarket"("category");

-- Update any existing markets to have empty tags array
UPDATE "GeotaggedMarket"
SET "tags" = ARRAY[]::TEXT[]
WHERE "tags" IS NULL;

-- Verify the changes
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'GeotaggedMarket'
AND column_name IN ('tags', 'category')
ORDER BY column_name;
```

### Step 3: Click "Run"

The SQL will execute and you should see:
- ✅ Notice: "Added tags column" or "Tags column already exists"
- ✅ A table showing the column structure

### Step 4: Verify It Worked

Run this verification query:

```sql
-- Check if tags column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'GeotaggedMarket'
AND column_name = 'tags';

-- Check if index exists
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'GeotaggedMarket'
AND indexname = 'GeotaggedMarket_category_idx';
```

You should see:
- Row with `column_name: "tags"` and `data_type: "ARRAY"`
- Row with `indexname: "GeotaggedMarket_category_idx"`

---

## 📋 After Migration: Re-index Markets

Once the migration is applied:

1. **Go to**: http://localhost:3002/admin/index-markets

2. **Click**: "⚠️ Clear All & Re-index (Fresh Start)"

3. **Wait**: 2-5 minutes for indexing to complete

4. **Watch console logs** for:
   ```
   [Indexer] Market "Will Khalil Mack..." - Tags: Sports, football, NFL
   [Indexer] Market "Trump takes Panama..." - Tags: Politics, Geopolitics
   ```

---

## 🧪 Test It Works

After re-indexing, test in browser console at http://localhost:3002:

```javascript
// Test 1: Get all tags
fetch('/api/markets/tags')
  .then(r => r.json())
  .then(d => console.log('Available tags:', d.tags.slice(0, 10)))

// Test 2: Filter by tag
fetch('/api/markets/geotagged?tag=Sports&limit=5')
  .then(r => r.json())
  .then(d => console.log('Sports markets:', d.markets.map(m => m.title)))

// Test 3: Check a market has tags
fetch('/api/markets/geotagged?limit=1')
  .then(r => r.json())
  .then(d => console.log('Market tags:', d.markets[0]?.tags))
```

---

## 🔧 Troubleshooting

### "Column already exists" error
✅ **Good!** The migration was already applied. Skip to re-indexing.

### "Relation does not exist" error
❌ The GeotaggedMarket table doesn't exist yet. You need to:
1. Run initial Prisma migrations first
2. Or check if table name is different

### No tags showing after re-indexing
Check:
- Are you indexing **Polymarket** markets? (Kalshi doesn't have tags)
- Check server console for errors during indexing
- Verify `/api/markets/tags` endpoint exists and returns data

### Migration works but tags are empty
- You need to **re-index markets** - the migration just adds the column
- Tags are fetched from Polymarket API during indexing
- Each market takes ~100-200ms to fetch tags

---

## 🎯 Expected Result

After migration + re-indexing, your markets will have:

```json
{
  "id": "0x123...",
  "title": "Will Khalil Mack lead the NFL in sacks?",
  "category": "Sports",
  "tags": ["Sports", "football", "NFL"],
  "country": "United States",
  "latitude": 39.8283,
  "longitude": -98.5795
}
```

You can then:
- Filter by tag: `?tag=Sports`
- Display tags on market cards
- Populate filter dropdowns with available tags

---

## 📝 Alternative: Connection String Issues

If you're having connection issues in general:

1. **Check Supabase Project Status**: Make sure project isn't paused
2. **Verify Connection String**: Check `.env` has correct `DATABASE_URL`
3. **Network Issues**: Check firewall/VPN isn't blocking Supabase
4. **Connection Pooler**: Try using the direct connection string instead of pooler

To get connection string:
1. Supabase Dashboard → Project Settings → Database
2. Copy "Connection string"
3. Replace `[YOUR-PASSWORD]` with your actual password
4. Update `.env`

---

## ✅ Success Checklist

- [ ] Ran SQL in Supabase SQL Editor
- [ ] Verified tags column exists
- [ ] Verified category index exists
- [ ] Re-indexed markets via admin panel
- [ ] Console shows tag logs during indexing
- [ ] `/api/markets/tags` returns tag list
- [ ] Markets have tags in their data
- [ ] Filtering by tag works

Once all checked, tags implementation is complete! 🎉
