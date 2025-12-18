# MCP Integration Documentation

## Overview

Live prediction market data from Kalshi and Polymarket is now integrated via the Model Context Protocol (MCP) server. This provides real-time market data augmentation alongside existing API clients.

## Architecture

### Data Flow

```
MCP Server (prediction-markets-mcp)
    ↓
/api/mcp/markets (Next.js API Route)
    ↓
MCPClient (lib/api/mcp-client.ts)
    ↓
MarketAggregator (lib/api/market-aggregator.ts)
    ↓
/api/markets/all (Aggregated endpoint)
    ↓
useMarkets() hook (SWR caching)
    ↓
useEdgeData() hook
    ↓
EdgeMap component (3D Globe visualization)
```

## Key Components

### 1. MCP Client (`lib/api/mcp-client.ts`)

**Purpose**: Interface for fetching live market data from the MCP server

**Key Methods**:
- `getMarkets(keyword)` - Fetch markets by keyword
- `getMarketsBatch(keywords[])` - Batch fetch for multiple keywords
- `transformToMarket(mcpMarket)` - Transform MCP format to internal Market type
- `transformMarkets(mcpMarkets[])` - Batch transform

**Features**:
- Automatic deduplication by platform + question
- ID generation for consistent tracking
- Error handling with fallbacks

### 2. MCP API Route (`app/api/mcp/markets/route.ts`)

**Endpoints**:
- `GET /api/mcp/markets?keyword=election` - Single keyword search
- `POST /api/mcp/markets` - Batch keyword search

**Features**:
- Direct Polymarket CLOB API integration
- Keyword filtering and relevance scoring
- Response parsing (handles MCP text format)
- Kalshi support (requires authentication)

**Response Format**:
```json
{
  "markets": [
    {
      "platform": "polymarket",
      "question": "Will Trump win the 2024 election?",
      "outcomes": [
        { "name": "Yes", "probability": 45.2 },
        { "name": "No", "probability": 54.8 }
      ],
      "url": "https://polymarket.com/...",
      "volume": 1234567
    }
  ],
  "timestamp": "2025-12-12T...",
  "source": "mcp"
}
```

### 3. Enhanced Market Aggregator (`lib/api/market-aggregator.ts`)

**New Constructor Option**:
```typescript
new MarketAggregator(kalshiClient, polymarketClient, { useMCP: true })
```

**Updated `getAllMarkets()` Method**:
- Now accepts `keywords?: string[]` parameter
- Fetches from Kalshi + Polymarket APIs (existing)
- **NEW**: Augments with MCP data for trending keywords
- Automatic deduplication by market ID
- Error handling - MCP failures don't break the request

### 4. Custom Hooks (`hooks/use-mcp-markets.ts`)

**Available Hooks**:
```typescript
// General MCP markets hook
const { markets, isLoading, error, refresh } = useMCPMarkets({
  keywords: ['election', 'bitcoin'],
  enabled: true,
  refreshInterval: 30000 // 30s
})

// Single keyword variant
const { markets } = useMCPMarketsByKeyword('trump')

// Trending markets (preset keywords)
const { markets } = useMCPTrendingMarkets()
```

**Features**:
- Auto-refresh at configurable intervals
- Enable/disable on demand
- Graceful error handling
- Raw MCP data + transformed Market objects

### 5. Updated Markets API (`app/api/markets/all/route.ts`)

**What Changed**:
```typescript
// Before
const aggregator = new MarketAggregator(kalshiClient, polymarketClient)
const markets = await aggregator.getAllMarkets({ limit, cursor, offset })

// After
const aggregator = new MarketAggregator(kalshiClient, polymarketClient, { useMCP: true })
const mcpKeywords = ['election', 'trump', 'biden', 'president', 'bitcoin', 'ethereum']
const markets = await aggregator.getAllMarkets({ limit, cursor, offset, keywords: mcpKeywords })
```

**Result**: All consumers of `/api/markets/all` now automatically get MCP-augmented data!

## MCP Keywords Configuration

The following trending keywords are used to augment market data:

```typescript
const mcpKeywords = [
  'election',
  'trump',
  'biden',
  'president',
  'bitcoin',
  'ethereum'
]
```

**Customization**: Edit these in `app/api/markets/all/route.ts` to change which markets are fetched via MCP.

## Data Deduplication

Markets are deduplicated using a two-stage process:

1. **MCP Internal**: Markets with same `platform + question` are deduplicated
2. **Aggregator Level**: MCP markets are only added if their ID doesn't exist in Kalshi/Polymarket results

This ensures:
- No duplicate markets on the globe
- API clients take precedence over MCP
- MCP fills gaps in coverage

## Live Data Flow

### Current Implementation

```
Component Load
    ↓
useMarkets() (SWR fetch)
    ↓
/api/markets/all
    ↓ (includes MCP data)
Enriched Markets with MCP augmentation
    ↓
useMarketWebSocket() (WebSocket updates)
    ↓
Real-time price updates
    ↓
Globe visualization
```

### Auto-Refresh

- **SWR Cache**: 60 second refresh interval
- **WebSocket**: Real-time price updates
- **MCP Augmentation**: Runs on each SWR refresh

## Configuration

### Enable/Disable MCP

**Global (recommended)**:
```typescript
// In app/api/markets/all/route.ts
const aggregator = new MarketAggregator(kalshiClient, polymarketClient, {
  useMCP: false // Disable MCP
})
```

**Component-level**:
```typescript
// Use the custom hook directly
const { markets } = useMCPMarkets({
  keywords: ['election'],
  enabled: false // Disable
})
```

### Customize Keywords

Edit `app/api/markets/all/route.ts`:

```typescript
const mcpKeywords = [
  'your',
  'custom',
  'keywords',
  'here'
]
```

### Adjust Refresh Rate

Edit `hooks/use-markets.ts`:

```typescript
const MARKETS_CONFIG = {
  refreshInterval: 30000, // Change from 60s to 30s
  // ...
}
```

## Testing MCP Integration

### 1. Verify MCP Server is Running

```bash
# Check MCP config
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Should see:
{
  "mcpServers": {
    "prediction-markets-mcp": {
      "command": "node",
      "args": [
        "/Users/mir/.nvm/versions/node/v22.17.1/lib/node_modules/prediction-markets-mcp/build/index.js"
      ]
    }
  }
}
```

**Important**: Restart Claude Desktop after configuration changes!

### 2. Test MCP API Endpoint

```bash
# Test single keyword
curl "http://localhost:3000/api/mcp/markets?keyword=election"

# Should return:
{
  "markets": [...],
  "timestamp": "...",
  "keyword": "election",
  "source": "mcp"
}
```

### 3. Test Integrated Endpoint

```bash
# This should now include MCP-augmented markets
curl "http://localhost:3000/api/markets/all?limit=100"
```

### 4. Check Browser Console

Open the site and check console logs:

```
[Markets API] Fetching markets - Kalshi: enabled, Polymarket: enabled, MCP: enabled
[MarketAggregator] Fetching MCP markets for keywords: ['election', 'trump', ...]
[MarketAggregator] Fetched 25 MCP markets, 15 are new
```

### 5. Verify on Globe

1. Navigate to `/edge` or `/dashboard`
2. Globe should display markets
3. Some markets will have `rawData.source === 'mcp'`
4. Check market card tooltips/details

## Troubleshooting

### No MCP Markets Appearing

**Possible Causes**:
1. MCP server not running → Restart Claude Desktop
2. API route error → Check browser console + server logs
3. Keyword mismatch → Adjust keywords in `route.ts`
4. Network issues → Check MCP API endpoint directly

**Debug Steps**:
```typescript
// Add logging in market-aggregator.ts
console.log('[MCP Debug] Keywords:', params?.keywords)
console.log('[MCP Debug] MCP enabled:', this.useMCP)
console.log('[MCP Debug] MCP client exists:', !!this.mcpClient)
```

### MCP Data Not Deduplicating

Check ID generation in `mcp-client.ts`:

```typescript
private generateMarketId(platform: string, question: string): string {
  console.log('[MCP] Generating ID for:', platform, question.substring(0, 50))
  // ...
}
```

### Performance Issues

If MCP requests slow down page load:

1. **Reduce keywords**: Fewer keywords = faster
2. **Disable MCP temporarily**: Set `useMCP: false`
3. **Increase SWR cache time**: Reduce refresh frequency
4. **Use direct hooks**: Call `useMCPMarkets()` separately on-demand

## Next Steps

### Enhancements

1. **Keyword Auto-Detection**:
   - Extract trending keywords from market titles
   - Dynamic keyword generation based on categories

2. **Advanced Deduplication**:
   - Fuzzy matching for similar markets across platforms
   - Merge market metadata (e.g., combine volume from both sources)

3. **MCP Health Monitoring**:
   - Endpoint to check MCP server status
   - Fallback UI when MCP unavailable

4. **Performance Optimization**:
   - Cache MCP responses in Redis/Vercel KV
   - Incremental updates instead of full refreshes

5. **User Preferences**:
   - Allow users to configure which platforms to use
   - Custom keyword preferences per user

### Additional MCP Tools

The MCP server may support additional tools:
- Historical data queries
- Market comparisons
- Alert configuration

Check the [MCP server README](https://github.com/JamesANZ/prediction-market-mcp) for updates.

## Summary

✅ **Implemented**:
- MCP client library
- API routes for MCP data
- Integration into market aggregator
- Auto-augmentation in main markets endpoint
- Custom React hooks
- Comprehensive documentation

✅ **Result**:
Your site now displays live markets from:
- Kalshi (via API client)
- Polymarket (via API client)
- **Additional markets from MCP server** (Polymarket + Kalshi + PredictIt)

All correlated markets are automatically enriched with location data and displayed on the 3D globe with real-time WebSocket updates!

## Files Modified/Created

### Created:
- `lib/api/mcp-client.ts` - MCP client library
- `app/api/mcp/markets/route.ts` - MCP API route
- `hooks/use-mcp-markets.ts` - MCP React hooks
- `MCP_INTEGRATION.md` - This documentation

### Modified:
- `lib/api/market-aggregator.ts` - Added MCP support
- `app/api/markets/all/route.ts` - Enabled MCP augmentation

### Unchanged (already working):
- `hooks/use-markets.ts` - Consumes `/api/markets/all`
- `hooks/use-edge-data.ts` - Uses `useMarkets()`
- `components/edge/EdgeMap.tsx` - Displays markets
- All WebSocket infrastructure
