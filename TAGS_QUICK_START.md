# Tags Implementation - Quick Start Guide

## ⚠️ Database Connection Required

The migration requires access to your Supabase database at:
`aws-1-us-east-2.pooler.supabase.com:5432`

**Before proceeding**, ensure you:
- Are connected to the internet
- Can access your Supabase instance
- Have your database credentials in `.env`

---

## 🚀 Quick Start (3 Steps)

### Step 1: Apply Database Migration

Run the migration script:
```bash
node scripts/apply-tags-migration.js
```

This will:
- Add `tags` column to `GeotaggedMarket` table
- Create index on `category` for faster filtering
- Verify the changes were applied

**Expected Output:**
```
✅ Migration applied successfully!
✅ Verified: tags column exists
✅ Verified: category index exists
```

### Step 2: Re-index All Markets

1. Open your browser to: **http://localhost:3002/admin/index-markets**

2. Click the red button: **"⚠️ Clear All & Re-index (Fresh Start)"**

3. Wait 2-5 minutes while it:
   - Fetches markets from Polymarket
   - Gets tags for each market via API
   - Stores everything in database

**Watch the console** for logs like:
```
[Indexer] Market "Will Khalil Mack lead..." - Tags: Sports, football, NFL
[Indexer] Market "Trump takes Panama..." - Tags: Politics, Geopolitics, Trump Presidency
```

### Step 3: Verify Tags Are Working

Test the tags API:
```bash
node scripts/test-tags.js
```

Or in your browser console at `http://localhost:3002`:
```javascript
// Get all available tags
fetch('/api/markets/tags')
  .then(r => r.json())
  .then(d => console.log(d))

// Get markets filtered by tag
fetch('/api/markets/geotagged?tag=Sports&limit=10')
  .then(r => r.json())
  .then(d => console.log(d.markets))
```

---

## 📁 Files Created/Modified

### New Files
- `app/api/markets/tags/route.ts` - API to get all available tags
- `scripts/apply-tags-migration.js` - Apply database migration
- `scripts/test-tags.js` - Test tags implementation
- `prisma/migrations/add_tags_to_markets.sql` - SQL migration
- `TAGS_IMPLEMENTATION.md` - Detailed documentation
- `TAGS_QUICK_START.md` - This file

### Modified Files
- `prisma/schema.prisma` - Added `tags` field
- `app/api/markets/index-locations/route.ts` - Fetches tags during indexing
- `app/api/markets/geotagged/route.ts` - Returns tags, supports tag filtering
- `types/market.ts` - Added `tags?: string[]` to Market interface

---

## 🔍 What Tags Look Like

After indexing, markets will have:

```typescript
{
  id: "0x123...",
  title: "Will Khalil Mack lead the NFL in sacks?",
  category: "Sports",  // Primary category (first tag)
  tags: ["Sports", "football", "NFL"],  // All tags
  // ... other fields
}
```

Common tag combinations:
- Politics: `["Politics", "U.S. Politics", "Trump", "Trump Presidency"]`
- Crypto: `["Crypto", "Solana", "Crypto Prices", "Recurring"]`
- Sports: `["Sports", "NFL", "football", "Awards"]`
- Finance: `["Stocks", "MSFT", "Up or Down", "Weekly"]`

---

## 🐛 Troubleshooting

### Migration fails with "can't reach database"
- Check internet connection
- Verify `.env` has correct `DATABASE_URL`
- Try connecting to Supabase dashboard to verify credentials

### Migration says "column already exists"
- This is okay! The migration is idempotent
- Skip to Step 2 (re-indexing)

### No tags showing after indexing
- Check console logs for errors
- Verify you're indexing **Polymarket** markets (Kalshi doesn't have tags)
- Make sure the dev server is running

### Tags API returns empty array
- Run the migration first
- Re-index markets to populate tags
- Check `/api/markets/tags` endpoint exists

### TypeScript errors about 'tags' field
- Restart your IDE/TypeScript server
- Run `npx prisma generate` again
- Check that `types/market.ts` includes `tags?: string[]`

---

## 📊 API Endpoints

### Get All Tags
```
GET /api/markets/tags
GET /api/markets/tags?platform=polymarket
```

Response:
```json
{
  "tags": [
    { "tag": "Politics", "count": 45 },
    { "tag": "Sports", "count": 32 },
    { "tag": "Crypto", "count": 28 }
  ],
  "categories": ["Politics", "Sports", "Crypto"],
  "total": 500
}
```

### Filter Markets by Tag
```
GET /api/markets/geotagged?tag=Sports
GET /api/markets/geotagged?tag=Crypto&limit=20
GET /api/markets/geotagged?category=Politics&tag=Trump
```

---

## 🎯 Integration Examples

### Populate Filter Dropdown

```typescript
import { useEffect, useState } from 'react'

function MarketFilters() {
  const [tags, setTags] = useState([])

  useEffect(() => {
    fetch('/api/markets/tags')
      .then(r => r.json())
      .then(data => setTags(data.tags))
  }, [])

  return (
    <select onChange={(e) => filterByTag(e.target.value)}>
      <option value="">All Categories</option>
      {tags.map(({ tag, count }) => (
        <option key={tag} value={tag}>
          {tag} ({count})
        </option>
      ))}
    </select>
  )
}
```

### Display Tags on Market Card

```typescript
function MarketCard({ market }) {
  return (
    <div>
      <h3>{market.title}</h3>
      <div className="tags">
        {market.tags?.map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>
    </div>
  )
}
```

---

## ⏱️ Performance

- **Indexing Time**: 2-5 minutes for ~2000 markets
- **Tag Fetch**: ~100-200ms per market during indexing
- **Runtime**: No API calls - tags cached in database
- **Filtering**: Fast - uses indexed category column

---

## ✅ Success Checklist

- [ ] Migration applied successfully
- [ ] Dev server running on http://localhost:3002
- [ ] Markets re-indexed with tags
- [ ] `/api/markets/tags` returns tag list
- [ ] Market cards show tags
- [ ] Filters work with tag selection
- [ ] Console shows tag logs during indexing

---

## 🆘 Still Having Issues?

1. Check the detailed guide: `TAGS_IMPLEMENTATION.md`
2. Verify all files were created correctly
3. Restart dev server: `npm run dev`
4. Clear browser cache
5. Check server console for errors

## 📝 Testing Checklist

Run this in your browser console at `http://localhost:3002`:

```javascript
// Test 1: Tags API
console.log('Test 1: Fetching tags...')
fetch('/api/markets/tags').then(r => r.json()).then(console.log)

// Test 2: Markets with specific tag
console.log('Test 2: Markets tagged "Sports"...')
fetch('/api/markets/geotagged?tag=Sports&limit=5').then(r => r.json()).then(console.log)

// Test 3: All tags from a market
console.log('Test 3: Checking market tags...')
fetch('/api/markets/geotagged?limit=1').then(r => r.json())
  .then(d => console.log('Market tags:', d.markets[0]?.tags))
```

All three tests should return data. If any fail, check the troubleshooting section above.
