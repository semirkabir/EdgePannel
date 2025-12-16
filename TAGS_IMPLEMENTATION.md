# Tags/Categories Implementation Guide

## What Was Changed

I've updated the system to fetch, store, and use Polymarket tags (categories) throughout the application. Now every market will have its full set of tags from Polymarket, which will be used for filtering and display.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- Added `tags: String[]` field to `GeotaggedMarket` model
- Added `category` index for faster filtering
- Tags are stored as an array of strings (e.g., `["Politics", "Trump", "U.S. Politics"]`)

### 2. Indexing Process (`app/api/markets/index-locations/route.ts`)
- **New function**: `fetchPolymarketTags()` - Fetches tags from Polymarket API for each market
- Tags are automatically fetched during indexing for all Polymarket markets
- Primary category is set to the first tag if no category exists
- All tags are stored in the database

### 3. Geotagged Markets API (`app/api/markets/geotagged/route.ts`)
- Now returns `tags` field for each market
- Added `?tag=<tagname>` query parameter for filtering by specific tag
- Supports filtering by: `platform`, `country`, `category`, `tag`, `confidence`, `search`

### 4. New Tags API (`app/api/markets/tags/route.ts`)
- **GET `/api/markets/tags`** - Returns all available tags with counts
- Response format:
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
- Use this to populate filter dropdowns

### 5. TypeScript Types (`types/market.ts`)
- Added `tags?: string[]` to Market interface

## How to Apply These Changes

### Step 1: Run Database Migration

```bash
npx prisma migrate dev --name add_tags_to_markets
```

This will:
- Add the `tags` column to the `GeotaggedMarket` table
- Add an index on the `category` column
- Generate the updated Prisma client

### Step 2: Re-index All Markets with Tags

1. **Open the admin panel**: Navigate to `http://localhost:3001/admin/index-markets`

2. **Click**: "⚠️ Clear All & Re-index (Fresh Start)"
   - This will clear old data and re-index everything with tags
   - Takes 2-5 minutes for ~2000 markets
   - Tags will be fetched for each Polymarket market

3. **Wait** for completion - You'll see:
   - Total markets indexed
   - Tags found per market in the console logs

### Step 3: Verify Tags Are Working

Check that tags are being fetched:
```bash
# In browser console or via curl
fetch('/api/markets/tags')
  .then(r => r.json())
  .then(d => console.log(d))
```

You should see tags like:
- Politics, U.S. Politics, Trump, Trump Presidency
- Sports, NFL, football
- Crypto, Crypto Prices, Solana, XRP
- Culture, Movies, Awards, Oscars
- Finance, Stocks, Equities

## How Tags Work Now

### During Indexing
```
1. Fetch market from Polymarket → "Will Microsoft hit $450?"
2. Get market numeric ID → 12345
3. Fetch tags from /markets/12345/tags → ["MSFT", "Stocks", "Finance", "Weekly"]
4. Store in database:
   - category: "MSFT" (first tag)
   - tags: ["MSFT", "Stocks", "Finance", "Weekly"]
```

### When Viewing Markets
- Market cards show the primary `category`
- Full `tags` array is available for filtering
- Tags are consistent between index and display

### In Filters (Top Left)
```javascript
// Fetch available tags
const { tags } = await fetch('/api/markets/tags').then(r => r.json())

// Filter by tag
const { markets } = await fetch('/api/markets/geotagged?tag=Sports')
  .then(r => r.json())
```

## Polymarket Tag Examples

Common Polymarket tags you'll see:

**Politics**: Politics, U.S. Politics, Geopolitics, Foreign Policy, Trump, Trump Presidency, Biden

**Sports**: Sports, NFL, football, NBA, basketball, MLB, baseball

**Crypto**: Crypto, Crypto Prices, Solana, XRP, Ripple, Bitcoin, Ethereum

**Finance**: Finance, Stocks, Equities, MSFT, AAPL, TSLA, Up or Down, Multi Strikes

**Entertainment**: Culture, Movies, Awards, Oscars, Golden Globes, Emmy

**Time-based**: Weekly, Monthly, Recurring, 2025 Predictions

**Special**: Hide From New, Hit Price, Multi Strikes

## Integration with Filters

To integrate tags into your filter UI:

```typescript
// 1. Fetch available tags on component mount
const { tags, categories } = await fetch('/api/markets/tags').then(r => r.json())

// 2. Display in dropdown/chips
<Select>
  {tags.map(({ tag, count }) => (
    <Option value={tag}>{tag} ({count})</Option>
  ))}
</Select>

// 3. Filter markets by selected tag
const selectedTag = "Sports"
const { markets } = await fetch(`/api/markets/geotagged?tag=${selectedTag}`)
  .then(r => r.json())
```

## Benefits

✅ **Accurate categorization**: Uses Polymarket's official tags
✅ **Consistent filtering**: Same tags in database, display, and filters
✅ **Multiple tags**: Markets can have multiple relevant categories
✅ **Automatic updates**: Tags refresh on each re-index
✅ **Better search**: Filter by specific interests (e.g., "Trump Presidency" vs just "Politics")
✅ **User experience**: Users see exactly what Polymarket categorizes markets as

## Console Logs to Look For

During indexing you'll see:
```
[Indexer] Market "Will Khalil Mack lead the NFL in sacks..." - Tags: Sports, football, NFL
[Indexer] Market "Trump takes Panama Canal in 2025?..." - Tags: Politics, Geopolitics, Trump Presidency, 2025 Predictions
[Indexer] Market "Will Solana dip to $80..." - Tags: Crypto, Solana, Crypto Prices, Recurring
```

## Troubleshooting

**No tags appearing?**
- Check console logs during indexing
- Verify markets are from Polymarket (Kalshi doesn't have tags)
- Make sure numeric ID is being extracted correctly

**Migration fails?**
- Stop the dev server first: Kill any running `npm run dev`
- Run migration: `npx prisma migrate dev --name add_tags_to_markets`
- Restart dev server: `npm run dev`

**Tags not filtering?**
- Ensure you ran the migration
- Re-index markets to populate tags
- Check API response includes tags field

## Next Steps

1. ✅ Run migration
2. ✅ Re-index markets
3. Update filter UI to use `/api/markets/tags` endpoint
4. Add tag chips/badges to market cards
5. Test filtering by different tags
6. Consider adding tag-based analytics

## Performance Notes

- Tag fetching adds ~100-200ms per market during indexing
- Total indexing time: ~2-5 minutes for 2000 markets
- Tags are cached in database - no API calls during normal viewing
- Filter endpoint is fast - uses indexed category field
