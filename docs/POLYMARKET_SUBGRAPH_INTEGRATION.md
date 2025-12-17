# Polymarket Subgraph Integration

This document describes the integration of Polymarket's Goldsky-hosted subgraphs into the EdgePanel project.

## Overview

Polymarket provides several GraphQL subgraphs hosted on Goldsky that offer real-time aggregate calculations and event indexing. These subgraphs provide more accurate and real-time data than the standard REST APIs.

**Subgraph Endpoints:**
- **Positions**: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn`
- **Activity**: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn`
- **Open Interest**: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/oi-subgraph/0.0.6/gn`
- **Orders**: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn`
- **PNL**: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn`

**Reference**: [Polymarket Subgraph Documentation](https://docs.polymarket.com/developers/subgraph/overview)

## Implemented Features

### 1. Open Interest (OI) Tracking ✅

**Files:**
- `lib/api/polymarket-subgraph.ts` - Subgraph client
- `app/api/markets/open-interest/route.ts` - API endpoint
- `hooks/use-open-interest.ts` - React hook

**Usage:**
```typescript
import { useOpenInterest } from '@/hooks/use-open-interest'

const { openInterest, isLoading } = useOpenInterest(marketId)

// Returns: { yesOI, noOI, totalOI, timestamp }
```

**Displayed in:**
- Right panel (MarketDetails) - Shows OI next to liquidity
- Hover box (MarketPopup) - Shows OI below volume

### 2. Live Volume (Already Implemented) ✅

Uses Polymarket Data API endpoint:
- `https://data-api.polymarket.com/live-volume?id={eventId}`

**Files:**
- `app/api/markets/live-volume/route.ts`
- `hooks/use-live-volume.ts`

### 3. Market Activity Tracking ✅

**Files:**
- `app/api/markets/activity/route.ts` - Single market activity
- `app/api/markets/recent-activity/route.ts` - Recent activity across all markets

**Usage:**
```typescript
// Get activity for a specific market
GET /api/markets/activity?marketId={conditionId}&limit=50&type=trade

// Get recent activity across all markets
GET /api/markets/recent-activity?limit=100&minAmount=1000
```

## Available Subgraph Features (Not Yet Implemented)

### 1. Enhanced Position Tracking

The **Positions subgraph** provides more detailed position data than the Data API:

```typescript
const client = new PolymarketSubgraphClient()
const positions = await client.getUserPositions(userAddress, {
  market: conditionId,
  limit: 50
})

// Returns: size, avgPrice, currentPrice, pnl, pnlPercent, timestamp
```

**Potential Use:**
- Replace or supplement current position tracking in `app/api/portfolio/polymarket/positions/route.ts`
- More accurate P&L calculations
- Real-time position updates

### 2. Enhanced Orderbook Data

The **Orders subgraph** provides orderbook data:

```typescript
const orderbook = await client.getOrderBook(marketId)

// Returns: { bids: [...], asks: [...] }
```

**Potential Use:**
- Display orderbook depth in MarketDetails
- Better price discovery
- Market depth visualization

### 3. PNL Tracking

The **PNL subgraph** provides aggregated profit & loss:

```typescript
const pnl = await client.getUserPNL(userAddress, {
  market: conditionId,
  startTime: timestamp,
  endTime: timestamp
})

// Returns: totalPnl, realizedPnl, unrealizedPnl, winRate, totalTrades
```

**Potential Use:**
- Enhanced portfolio analytics
- Win rate tracking
- Realized vs unrealized P&L breakdown

## Benefits Over Current Implementation

### Current (REST APIs):
- ✅ Simple to use
- ✅ Good for basic data
- ❌ May have rate limits
- ❌ Less real-time
- ❌ Limited aggregate calculations

### Subgraphs:
- ✅ Real-time updates
- ✅ Aggregate calculations (volume, OI, P&L)
- ✅ Better for complex queries
- ✅ Historical data indexing
- ✅ No rate limits (within reason)
- ❌ Requires GraphQL knowledge
- ❌ Slightly more complex setup

## Migration Path

### Phase 1: ✅ Complete
- Open Interest integration
- Live Volume integration
- Activity API routes

### Phase 2: Recommended Next Steps
1. **Enhance Portfolio Tracking**
   - Use Positions subgraph for more accurate position data
   - Add PNL subgraph for better analytics

2. **Orderbook Display**
   - Add orderbook visualization to MarketDetails
   - Use Orders subgraph for depth data

3. **Activity Feed**
   - Create activity feed component
   - Show recent trades/orders across markets
   - Filter by whale activity (large amounts)

4. **Analytics Dashboard**
   - Use PNL subgraph for user analytics
   - Win rate tracking
   - Performance metrics

## Example Queries

### Get Open Interest for Multiple Markets
```typescript
const client = new PolymarketSubgraphClient()
const oiData = await client.getMultipleOpenInterest([
  '0x123...',
  '0x456...',
  '0x789...'
])
```

### Get Recent Whale Activity
```typescript
const activities = await client.getRecentActivity({
  limit: 100,
  minAmount: '10000' // Only show trades > $10k
})
```

### Get User P&L Summary
```typescript
const pnl = await client.getUserPNL(userAddress, {
  startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
})
```

## Notes

- All subgraphs are publicly accessible (no auth required)
- Subgraphs update in real-time
- Data is indexed from on-chain events
- Subgraphs can be self-hosted if needed (see Polymarket GitHub)
- Goldsky provides GraphQL playgrounds for each subgraph

## References

- [Polymarket Subgraph Docs](https://docs.polymarket.com/developers/subgraph/overview)
- [Polymarket Subgraph GitHub](https://github.com/Polymarket/subgraph) (for self-hosting)
- [Goldsky GraphQL Playgrounds](https://docs.polymarket.com/developers/subgraph/overview#hosted-version)

