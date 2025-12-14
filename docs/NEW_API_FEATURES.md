# New API Features - Polymarket & Kalshi Integration

## Summary of Changes

This document describes all the new API endpoints and features that have been added to expand data extraction from Polymarket and Kalshi.

---

## 🔧 Critical Fixes

### ✅ Kalshi WebSocket URL Fixed
**File**: `lib/ws/kalshi-websocket.ts:33-35`

**Before**:
```typescript
❌ 'wss://api.kalshi.com/trade-api/v2/ws'
```

**After**:
```typescript
✅ 'wss://api.elections.kalshi.com/trade-api/ws/v2'  // Production
✅ 'wss://demo-api.kalshi.co/trade-api/ws/v2'       // Demo
```

---

## 📊 Kalshi - New Features

### 1. Portfolio & Positions API

**File**: `lib/api/kalshi.ts:172-332`

#### Get Positions
```typescript
const kalshi = new KalshiClient(credentials)

const { marketPositions, eventPositions, cursor } = await kalshi.getPositions({
  limit: 100,
  countFilter: 'position',
  ticker: 'KXHIGHNY-25'
})

// Returns:
// - position: number (negative=NO, positive=YES)
// - totalTraded: number (cents spent)
// - marketExposure: number (position cost)
// - realizedPnl: number (locked P&L)
// - feesPaid: number
```

#### Get Fills (Trade History)
```typescript
const { fills, cursor } = await kalshi.getFills({
  ticker: 'KXHIGHNY-25',
  minTs: Date.now() - 86400000, // Last 24 hours
  limit: 50
})

// Returns:
// - orderId, ticker, side, action
// - count, price, createdTime
// - isTaker, tradeId
```

#### Get Settlements (Historical Payouts)
```typescript
const { settlements, cursor } = await kalshi.getSettlements({
  ticker: 'KXHIGHNY-25',
  limit: 20
})

// Returns:
// - marketResult: 'yes' | 'no'
// - yesCount, noCount
// - revenue, settlementValue
// - settledTime, feesPaid
```

---

### 2. Market Data Enhancements

**File**: `lib/api/kalshi.ts:334-424`

#### Get Public Trades Feed
```typescript
const { trades, cursor } = await kalshi.getTrades({
  ticker: 'KXHIGHNY-25',
  limit: 100
})

// Returns real-time market tape:
// - yesPrice, noPrice, count
// - createdTime, takerSide
```

#### Get Full Order Book
```typescript
const { bids, asks } = await kalshi.getOrderBook('KXHIGHNY-25')

// Returns:
// - bids: [{ price, quantity }]
// - asks: [{ price, quantity }]
```

#### Get Exchange Status
```typescript
const { exchangeActive, tradingActive, estimatedResumeTime } =
  await kalshi.getExchangeStatus()

// Use for system status banner
```

---

### 3. Improved Candlesticks

**File**: `lib/api/kalshi.ts:603-675`

Now uses proper Kalshi API endpoint with correct data structure:

```typescript
const candlesticks = await kalshi.getCandlesticks('KXHIGHNY-25', '1h')

// Returns: [{ timestamp, open, high, low, close, volume }]
// Intervals: 1m, 5m, 1h, 6h, 1d
```

---

### 4. Enhanced WebSocket Channels

**File**: `lib/ws/kalshi-websocket.ts:113-247`

#### Subscribe to Multiple Channels
```typescript
const ws = new KalshiWebSocketClient(accessKeyId, privateKey)
await ws.connect()

// Subscribe to specific channels
ws.subscribe('KXHIGHNY-25', ['ticker', 'orderbook_delta', 'trade'])
```

#### User Channels (Authenticated)
```typescript
// Real-time order fills and position updates
ws.subscribeToUserChannels(['fill', 'market_positions'])

ws.onMessage((message) => {
  if (message.type === 'fill') {
    console.log('Order filled!', message.data)
  }
  if (message.type === 'market_positions') {
    console.log('Position updated!', message.data)
  }
})
```

#### Public Channels
```typescript
// Public trade feed and market lifecycle
ws.subscribeToPublicChannels(['trade', 'market_lifecycle_v2'], ['KXHIGHNY-25'])

ws.onMessage((message) => {
  if (message.type === 'trade') {
    console.log('New trade:', message.data)
  }
  if (message.type === 'market_lifecycle_v2') {
    console.log('Market status changed:', message.data)
  }
})
```

---

## 📈 Polymarket - New Features

### 1. Whale Tracking & Market Activity

**File**: `lib/api/polymarket.ts:510-591`

#### Get Top Holders (Whale Tracking)
```typescript
const polymarket = new PolymarketClient()

const holders = await polymarket.getHolders(conditionId, 100)

// Returns top 100 position holders:
// - address: wallet address
// - amount: position size
// - outcome: 'YES' or 'NO'
```

#### Get All Trades (Market Activity)
```typescript
const trades = await polymarket.getTrades({
  market: conditionId,
  limit: 100,
  takerOnly: true,
  side: 'BUY'
})

// Returns:
// - id, market, asset, side
// - size, price, timestamp
// - trader (wallet address)
```

---

### 2. User Portfolio Data

**File**: `lib/api/polymarket.ts:593-671`

#### Get User Positions
```typescript
const positions = await polymarket.getPositions(userAddress, {
  limit: 50,
  sortBy: 'PERCENTPNL',
  sortDirection: 'desc'
})

// Returns:
// - market, asset, size
// - currentValue, initialValue
// - cashPnl, percentPnl
// - avgEntryPrice
```

#### Get Portfolio Value
```typescript
const totalValue = await polymarket.getPortfolioValue(userAddress)

// Returns total USD value of all positions
```

---

### 3. Batch Operations (Rate Limit Optimization)

**File**: `lib/api/polymarket.ts:459-508`

#### Batch Order Books
```typescript
const books = await polymarket.getOrderBooks([
  'tokenId1',
  'tokenId2',
  'tokenId3'
])

// Single request instead of 3 separate calls
```

#### Batch Prices
```typescript
const prices = await polymarket.getPrices([
  'tokenId1',
  'tokenId2',
  'tokenId3'
])

// Returns: { tokenId1: { price, side }, ... }
```

---

### 4. Authenticated User WebSocket

**File**: `lib/ws/polymarket-user-websocket.ts`

Real-time order and trade updates:

```typescript
import { PolymarketUserWebSocketClient } from '@/lib/ws/polymarket-user-websocket'

const userWs = new PolymarketUserWebSocketClient(apiKey)
await userWs.connect()

// Listen to all events
userWs.onMessage((message) => {
  console.log('User event:', message.event_type, message)
})

// Filter by specific event type
userWs.onEvent('MATCHED', (message) => {
  console.log('Order matched!', message.order_id, message.price)
})

userWs.onEvent('CONFIRMED', (message) => {
  console.log('Order confirmed on blockchain!', message.order_id)
})

userWs.onEvent('FAILED', (message) => {
  console.error('Order failed:', message.order_id, message)
})
```

**Event Types**:
- `MATCHED`: Order matched (not yet mined)
- `MINED`: Transaction mined on blockchain
- `CONFIRMED`: Transaction confirmed
- `RETRYING`: Order placement retry
- `FAILED`: Order failed
- `PLACEMENT`: New order placed
- `UPDATE`: Order updated
- `CANCELLATION`: Order cancelled

---

## 🚀 Usage Examples

### Example 1: Portfolio Dashboard

```typescript
import { KalshiClient } from '@/lib/api/kalshi'
import { PolymarketClient } from '@/lib/api/polymarket'

async function getPortfolioDashboard(userAddress: string, credentials: any) {
  const kalshi = new KalshiClient(credentials)
  const polymarket = new PolymarketClient()

  // Get Kalshi positions
  const kalshiPositions = await kalshi.getPositions({ limit: 100 })

  // Get Polymarket positions
  const polymarketPositions = await polymarket.getPositions(userAddress)
  const polymarketValue = await polymarket.getPortfolioValue(userAddress)

  return {
    kalshi: {
      positions: kalshiPositions.marketPositions,
      totalPnl: kalshiPositions.marketPositions.reduce((sum, p) => sum + p.realizedPnl, 0)
    },
    polymarket: {
      positions: polymarketPositions,
      totalValue: polymarketValue
    }
  }
}
```

---

### Example 2: Whale Alerts

```typescript
async function getWhaleAlerts(conditionId: string) {
  const polymarket = new PolymarketClient()

  // Get top holders
  const holders = await polymarket.getHolders(conditionId, 20)

  // Get recent large trades
  const trades = await polymarket.getTrades({
    market: conditionId,
    limit: 50,
    takerOnly: true
  })

  // Filter large trades (>$10k)
  const whaleTrades = trades.filter(t => t.size * t.price > 10000)

  return {
    topHolders: holders.slice(0, 10),
    recentWhaleTrades: whaleTrades
  }
}
```

---

### Example 3: Real-Time Trading Dashboard

```typescript
async function setupRealtimeDashboard(tickers: string[], credentials: any) {
  const kalshi = new KalshiWebSocketClient(credentials.accessKeyId, credentials.privateKey)
  await kalshi.connect()

  // Subscribe to price updates and trades
  kalshi.subscribe(tickers, ['ticker', 'trade'])

  // Subscribe to user's fills and positions
  kalshi.subscribeToUserChannels(['fill', 'market_positions'])

  kalshi.onMessage((message) => {
    switch (message.type) {
      case 'ticker':
        // Update price display
        updatePriceDisplay(message.ticker, message.data)
        break
      case 'trade':
        // Update market tape
        addToMarketTape(message.data)
        break
      case 'fill':
        // Show fill notification
        showNotification('Order filled!', message.data)
        break
      case 'market_positions':
        // Update portfolio display
        updatePortfolio(message.data)
        break
    }
  })
}
```

---

### Example 4: Market Depth Visualization

```typescript
async function getMarketDepth(ticker: string, credentials: any) {
  const kalshi = new KalshiClient(credentials)

  const { bids, asks } = await kalshi.getOrderBook(ticker)

  // Calculate depth
  const bidDepth = bids.reduce((sum, level) => sum + (level.price * level.quantity), 0)
  const askDepth = asks.reduce((sum, level) => sum + (level.price * level.quantity), 0)

  return {
    bids,
    asks,
    spread: asks[0].price - bids[0].price,
    bidDepth,
    askDepth,
    imbalance: (bidDepth - askDepth) / (bidDepth + askDepth)
  }
}
```

---

### Example 5: Price Charts

```typescript
async function getPriceChart(ticker: string, interval: string, credentials: any) {
  const kalshi = new KalshiClient(credentials)

  const candlesticks = await kalshi.getCandlesticks(ticker, interval)

  return {
    labels: candlesticks.map(c => c.timestamp),
    prices: candlesticks.map(c => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }))
  }
}
```

---

## 📋 Available Channels Summary

### Kalshi WebSocket Channels

| Channel | Auth Required | Description |
|---------|--------------|-------------|
| `ticker` | No | Real-time price updates |
| `orderbook_delta` | No | Incremental orderbook updates |
| `trade` | No | Public trade executions |
| `fill` | Yes | User's order fills |
| `market_positions` | Yes | User's position updates |
| `market_lifecycle_v2` | No | Market status changes |

### Polymarket WebSocket Channels

**Market Channel** (`wss://ws-subscriptions-clob.polymarket.com/ws/market`):
- Real-time price updates
- Order book changes
- Last trade price

**User Channel** (`wss://ws-subscriptions-clob.polymarket.com/ws/user`):
- Order events (MATCHED, MINED, CONFIRMED)
- Order status (PLACEMENT, UPDATE, CANCELLATION)
- Trade events (FAILED, RETRYING)

---

## 🎯 Next Steps

1. **Create API Routes**: Add Next.js API routes for the new endpoints
2. **Build UI Components**: Portfolio dashboard, whale tracker, market depth
3. **Add Real-Time Hooks**: React hooks for WebSocket data
4. **Implement Alerts**: Whale alerts, price alerts, fill notifications
5. **Analytics Dashboard**: Historical P&L, trading statistics

---

## 📚 Related Files

- `lib/api/kalshi.ts` - Kalshi REST API client
- `lib/api/polymarket.ts` - Polymarket REST API client
- `lib/ws/kalshi-websocket.ts` - Kalshi WebSocket client
- `lib/ws/polymarket-websocket.ts` - Polymarket market WebSocket client
- `lib/ws/polymarket-user-websocket.ts` - Polymarket user WebSocket client (NEW)

---

## 🔗 Documentation References

- [Kalshi API Docs](https://docs.kalshi.com/)
- [Polymarket CLOB Docs](https://docs.polymarket.com/developers/CLOB/introduction)
- [Polymarket Data API Gist](https://gist.github.com/shaunlebron/0dd3338f7dea06b8e9f8724981bb13bf)
