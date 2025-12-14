# Implementation Guide - New API Features

## 🎉 What Was Built

This guide covers all the new API routes, React hooks, and features that have been implemented for the EdgePanel prediction market platform.

---

## 📁 File Structure

```
EdgePannel/
├── app/api/
│   ├── portfolio/
│   │   ├── kalshi/
│   │   │   ├── positions/route.ts       ✅ NEW
│   │   │   ├── fills/route.ts           ✅ NEW
│   │   │   └── settlements/route.ts     ✅ NEW
│   │   └── polymarket/
│   │       ├── positions/route.ts       ✅ NEW
│   │       └── value/route.ts           ✅ NEW
│   ├── whales/
│   │   ├── holders/route.ts             ✅ NEW
│   │   └── trades/route.ts              ✅ NEW
│   └── market-data/
│       ├── orderbook/route.ts           ✅ NEW
│       ├── trades/route.ts              ✅ NEW
│       └── exchange-status/route.ts     ✅ NEW
├── hooks/
│   ├── use-kalshi-realtime.ts           ✅ NEW
│   ├── use-polymarket-user-realtime.ts  ✅ NEW
│   ├── use-portfolio-api.ts             ✅ NEW
│   └── use-whale-data.ts                ✅ NEW
├── lib/
│   ├── api/
│   │   ├── kalshi.ts                    📝 ENHANCED
│   │   └── polymarket.ts                📝 ENHANCED
│   └── ws/
│       ├── kalshi-websocket.ts          📝 ENHANCED
│       ├── polymarket-websocket.ts      (existing)
│       └── polymarket-user-websocket.ts ✅ NEW
└── docs/
    ├── NEW_API_FEATURES.md              ✅ NEW
    └── IMPLEMENTATION_GUIDE.md          ✅ NEW (this file)
```

---

## 🚀 API Routes

### Portfolio Routes

#### 1. GET /api/portfolio/kalshi/positions
Get all Kalshi positions with P&L data.

**Query Parameters:**
- `limit` (optional): Number of positions to return (default: 100)
- `cursor` (optional): Pagination cursor
- `ticker` (optional): Filter by specific ticker
- `eventTicker` (optional): Filter by event ticker

**Response:**
```json
{
  "marketPositions": [
    {
      "ticker": "KXHIGHNY-25",
      "position": 10,
      "totalTraded": 650,
      "marketExposure": 600,
      "realizedPnl": 50,
      "feesPaid": 5
    }
  ],
  "eventPositions": [...],
  "cursor": "next-page-cursor"
}
```

#### 2. GET /api/portfolio/kalshi/fills
Get trade execution history.

**Query Parameters:**
- `ticker`, `orderId`, `minTs`, `maxTs`, `limit`, `cursor`

**Response:**
```json
{
  "fills": [
    {
      "orderId": "order-123",
      "ticker": "KXHIGHNY-25",
      "side": "yes",
      "action": "buy",
      "count": 10,
      "price": 0.65,
      "createdTime": "2025-12-14T10:30:00Z",
      "isTaker": true,
      "tradeId": "trade-456"
    }
  ],
  "cursor": "next-page"
}
```

#### 3. GET /api/portfolio/kalshi/settlements
Get historical settlements from resolved markets.

#### 4. GET /api/portfolio/polymarket/positions
Get Polymarket positions for a wallet address.

**Query Parameters:**
- `address` (required): Wallet address
- `market`, `limit`, `sortBy`, `sortDirection`

#### 5. GET /api/portfolio/polymarket/value
Get total portfolio value for a wallet.

**Query Parameters:**
- `address` (required): Wallet address

---

### Whale Tracking Routes

#### 6. GET /api/whales/holders
Get top position holders for a market (whale tracking).

**Query Parameters:**
- `market` (required): Market condition ID
- `limit` (optional): Number of holders (default: 100)

**Response:**
```json
{
  "holders": [
    {
      "address": "0x123...",
      "amount": 50000,
      "outcome": "YES",
      "percentage": 12.5
    }
  ],
  "totalHolders": 85,
  "totalHoldings": 400000,
  "market": "0xabc..."
}
```

#### 7. GET /api/whales/trades
Get large trades (whale trades).

**Query Parameters:**
- `market`, `user`, `side`, `limit`, `offset`, `minSize`

**Response:**
```json
{
  "trades": [
    {
      "id": "trade-123",
      "market": "0xabc...",
      "side": "BUY",
      "size": 100,
      "price": 0.65,
      "value": 65,
      "timestamp": "2025-12-14T10:30:00Z",
      "trader": "0x123..."
    }
  ],
  "totalTrades": 45,
  "totalVolume": 125000
}
```

---

### Market Data Routes

#### 8. GET /api/market-data/orderbook
Get full order book depth for a market.

**Query Parameters:**
- `ticker` (required): Market ticker
- `platform` (optional): 'kalshi' (default)

**Response:**
```json
{
  "ticker": "KXHIGHNY-25",
  "platform": "kalshi",
  "bids": [
    { "price": 0.64, "quantity": 100 },
    { "price": 0.63, "quantity": 150 }
  ],
  "asks": [
    { "price": 0.66, "quantity": 120 },
    { "price": 0.67, "quantity": 200 }
  ],
  "metrics": {
    "spread": 0.02,
    "spreadPercent": 3.12,
    "bidDepth": 8500,
    "askDepth": 9200,
    "totalDepth": 17700,
    "imbalance": -0.04,
    "bidLevels": 15,
    "askLevels": 18
  }
}
```

#### 9. GET /api/market-data/trades
Get public trades feed (market tape).

**Query Parameters:**
- `ticker`, `platform`, `limit`, `cursor`

**Response:**
```json
{
  "platform": "kalshi",
  "ticker": "KXHIGHNY-25",
  "trades": [...],
  "stats": {
    "totalTrades": 156,
    "totalVolume": 45000,
    "avgTradeSize": 288,
    "buyVolume": 25000,
    "sellVolume": 20000
  }
}
```

#### 10. GET /api/market-data/exchange-status
Get Kalshi exchange status (trading active, maintenance).

**Response:**
```json
{
  "exchangeActive": true,
  "tradingActive": true,
  "estimatedResumeTime": null,
  "timestamp": "2025-12-14T10:30:00Z"
}
```

---

## 🎣 React Hooks

### 1. useKalshiRealtime
Real-time WebSocket connection for Kalshi markets.

```typescript
import { useKalshiRealtime } from '@/hooks/use-kalshi-realtime'

function MyComponent() {
  const { connected, lastMessage, subscribe } = useKalshiRealtime({
    tickers: ['KXHIGHNY-25', 'INXD-25JAN08'],
    channels: ['ticker', 'orderbook_delta', 'trade'],
    userChannels: ['fill', 'market_positions'],
    accessKeyId: process.env.NEXT_PUBLIC_KALSHI_API_KEY,
    privateKey: process.env.NEXT_PUBLIC_KALSHI_PRIVATE_KEY,
    autoConnect: true,
    onMessage: (message) => {
      console.log('New message:', message.type, message.data)
    }
  })

  return (
    <div>
      Status: {connected ? 'Connected' : 'Disconnected'}
      {lastMessage && (
        <div>Last: {lastMessage.type}</div>
      )}
    </div>
  )
}
```

**Available Channels:**
- `ticker` - Price updates
- `orderbook_delta` - Order book changes
- `trade` - Public trades
- `fill` - User order fills (requires auth)
- `market_positions` - User position updates (requires auth)
- `market_lifecycle_v2` - Market status changes

---

### 2. usePolymarketUserRealtime
Real-time order and trade updates from Polymarket.

```typescript
import { usePolymarketUserRealtime } from '@/hooks/use-polymarket-user-realtime'

function OrderTracker() {
  const { connected, lastMessage, orderEvents } = usePolymarketUserRealtime({
    apiKey: process.env.NEXT_PUBLIC_POLYMARKET_API_KEY,
    autoConnect: true,
    onEvent: {
      MATCHED: (msg) => toast.success('Order matched!'),
      CONFIRMED: (msg) => toast.success('Order confirmed!'),
      FAILED: (msg) => toast.error('Order failed'),
    }
  })

  return (
    <div>
      {Object.entries(orderEvents).map(([orderId, events]) => (
        <div key={orderId}>
          Order {orderId}: {events[events.length - 1].event_type}
        </div>
      ))}
    </div>
  )
}
```

**Event Types:**
- `MATCHED` - Order matched
- `MINED` - Transaction mined
- `CONFIRMED` - Transaction confirmed
- `RETRYING` - Retry attempt
- `FAILED` - Order failed
- `PLACEMENT` - New order placed
- `UPDATE` - Order updated
- `CANCELLATION` - Order cancelled

---

### 3. usePortfolioApi
Fetch portfolio data from both platforms.

```typescript
import { usePortfolioApi } from '@/hooks/use-portfolio-api'

function PortfolioDashboard() {
  const { kalshi, polymarket, combined, loading, refresh } = usePortfolioApi({
    polymarketAddress: '0x123...', // Optional
    refreshInterval: 30000 // 30 seconds
  })

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h2>Combined Portfolio</h2>
      <div>Total P&L: ${combined.totalPnl.toFixed(2)}</div>
      <div>Total Value: ${combined.totalValue.toFixed(2)}</div>
      <div>Positions: {combined.positionCount}</div>

      <h3>Kalshi</h3>
      <div>P&L: ${kalshi.totalPnl.toFixed(2)}</div>
      {kalshi.positions.map(p => (
        <div key={p.ticker}>
          {p.ticker}: {p.position} @ ${p.realizedPnl}
        </div>
      ))}

      <h3>Polymarket</h3>
      <div>Value: ${polymarket.totalValue.toFixed(2)}</div>
      {polymarket.positions.map(p => (
        <div key={p.market}>
          {p.market}: ${p.cashPnl.toFixed(2)}
        </div>
      ))}

      <button onClick={refresh}>Refresh</button>
    </div>
  )
}
```

---

### 4. useWhaleData
Track whale activity and large trades.

```typescript
import { useWhaleData } from '@/hooks/use-whale-data'

function WhaleTracker() {
  const {
    alerts,
    newAlertCount,
    holders,
    trades,
    loading,
    markAsSeen,
    getRecentAlerts
  } = useWhaleData({
    market: '0xabc...', // Market condition ID
    minTradeSize: 10000, // $10k minimum
    refreshInterval: 10000, // 10 seconds
    alertThreshold: {
      holderPercentage: 5, // Alert if >5% holdings
      tradeValue: 10000 // Alert if >$10k trade
    }
  })

  const recentAlerts = getRecentAlerts(5) // Last 5 minutes

  return (
    <div>
      <h2>Whale Alerts {newAlertCount > 0 && `(${newAlertCount} new)`}</h2>

      <button onClick={markAsSeen}>Mark as Seen</button>

      <h3>Top Holders</h3>
      {holders.map(h => (
        <div key={h.address}>
          {h.address.slice(0, 6)}...{h.address.slice(-4)}:
          {h.percentage.toFixed(2)}% ({h.outcome})
        </div>
      ))}

      <h3>Recent Large Trades</h3>
      {trades.map(t => (
        <div key={t.id}>
          ${t.value.toFixed(0)} {t.side} @ {t.price}
        </div>
      ))}

      <h3>Recent Alerts</h3>
      {recentAlerts.map((alert, i) => (
        <div key={i}>
          {alert.type === 'holder' ? 'Large holder' : 'Large trade'}
          - {alert.timestamp.toLocaleString()}
        </div>
      ))}
    </div>
  )
}
```

---

## 🔐 Environment Variables

Add these to your `.env.local`:

```bash
# Kalshi API (required for portfolio & authenticated endpoints)
KALSHI_API_KEY_ID=your-api-key-id
KALSHI_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----

# Polymarket API (optional - only for authenticated user channel)
POLYMARKET_API_KEY=your-polymarket-api-key
```

---

## 📊 Usage Examples

### Example 1: Real-Time Portfolio Dashboard

```typescript
'use client'

import { useKalshiRealtime } from '@/hooks/use-kalshi-realtime'
import { usePortfolioApi } from '@/hooks/use-portfolio-api'

export default function RealTimePortfolio() {
  const portfolio = usePortfolioApi({
    polymarketAddress: '0x123...',
    refreshInterval: 30000
  })

  const ws = useKalshiRealtime({
    userChannels: ['fill', 'market_positions'],
    accessKeyId: process.env.NEXT_PUBLIC_KALSHI_API_KEY!,
    privateKey: process.env.NEXT_PUBLIC_KALSHI_PRIVATE_KEY!,
    onMessage: (msg) => {
      if (msg.type === 'fill') {
        // Refresh portfolio when order fills
        portfolio.refresh()
      }
    }
  })

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <h1>Portfolio</h1>
        <div className={`w-2 h-2 rounded-full ${ws.connected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {portfolio.loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="border p-4 rounded">
              <div className="text-sm text-gray-500">Total P&L</div>
              <div className={`text-2xl font-bold ${
                portfolio.combined.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${portfolio.combined.totalPnl.toFixed(2)}
              </div>
            </div>
            <div className="border p-4 rounded">
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-2xl font-bold">
                ${portfolio.combined.totalValue.toFixed(2)}
              </div>
            </div>
            <div className="border p-4 rounded">
              <div className="text-sm text-gray-500">Positions</div>
              <div className="text-2xl font-bold">
                {portfolio.combined.positionCount}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border p-4 rounded">
              <h2 className="text-lg font-semibold mb-2">Kalshi</h2>
              {portfolio.kalshi.positions.map(p => (
                <div key={p.ticker} className="flex justify-between py-1">
                  <span>{p.ticker}</span>
                  <span className={p.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${p.realizedPnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border p-4 rounded">
              <h2 className="text-lg font-semibold mb-2">Polymarket</h2>
              {portfolio.polymarket.positions.map(p => (
                <div key={p.market} className="flex justify-between py-1">
                  <span className="truncate">{p.market.slice(0, 10)}...</span>
                  <span className={p.cashPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${p.cashPnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Example 2: Whale Alert System

```typescript
'use client'

import { useWhaleData } from '@/hooks/use-whale-data'
import { useEffect } from 'react'
import { toast } from 'sonner'

export default function WhaleAlerts({ marketId }: { marketId: string }) {
  const {
    alerts,
    newAlertCount,
    holders,
    trades,
    markAsSeen
  } = useWhaleData({
    market: marketId,
    minTradeSize: 10000,
    refreshInterval: 5000, // 5 seconds - aggressive
    alertThreshold: {
      holderPercentage: 3,
      tradeValue: 5000
    }
  })

  // Show toast notification for new alerts
  useEffect(() => {
    if (newAlertCount > 0) {
      const latestAlert = alerts[alerts.length - 1]
      if (latestAlert.type === 'trade') {
        const trade = latestAlert.data as any
        toast.warning(`🐋 Whale Trade: $${trade.value.toFixed(0)} ${trade.side}`)
      } else {
        const holder = latestAlert.data as any
        toast.info(`🐋 Large Holder: ${holder.percentage.toFixed(1)}% position`)
      }
    }
  }, [newAlertCount, alerts])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2>Whale Activity</h2>
        {newAlertCount > 0 && (
          <button
            onClick={markAsSeen}
            className="px-3 py-1 bg-blue-500 text-white rounded"
          >
            {newAlertCount} new alerts
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border p-4 rounded">
          <h3 className="font-semibold mb-2">Top Holders</h3>
          {holders.slice(0, 10).map((h, i) => (
            <div key={h.address} className="flex justify-between py-1 text-sm">
              <span>#{i + 1} {h.address.slice(0, 6)}...{h.address.slice(-4)}</span>
              <span className="font-semibold">{h.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        <div className="border p-4 rounded">
          <h3 className="font-semibold mb-2">Recent Large Trades</h3>
          {trades.slice(0, 10).map((t) => (
            <div key={t.id} className="flex justify-between py-1 text-sm">
              <span className={t.side === 'BUY' ? 'text-green-600' : 'text-red-600'}>
                {t.side} @ {t.price.toFixed(2)}
              </span>
              <span className="font-semibold">${t.value.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

### Example 3: Market Depth Visualization

```typescript
'use client'

import { useState, useEffect } from 'react'

export default function OrderBookDepth({ ticker }: { ticker: string }) {
  const [orderbook, setOrderbook] = useState<any>(null)

  useEffect(() => {
    async function fetchOrderbook() {
      const res = await fetch(`/api/market-data/orderbook?ticker=${ticker}&platform=kalshi`)
      const data = await res.json()
      setOrderbook(data)
    }

    fetchOrderbook()
    const interval = setInterval(fetchOrderbook, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [ticker])

  if (!orderbook) return <div>Loading...</div>

  const maxQuantity = Math.max(
    ...orderbook.bids.map((b: any) => b.quantity),
    ...orderbook.asks.map((a: any) => a.quantity)
  )

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Order Book: {ticker}</h2>

      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>Spread: {orderbook.metrics.spreadPercent.toFixed(2)}%</div>
        <div>Bid Depth: ${orderbook.metrics.bidDepth.toFixed(0)}</div>
        <div>Ask Depth: ${orderbook.metrics.askDepth.toFixed(0)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <h3 className="font-semibold text-green-600 mb-1">Bids</h3>
          {orderbook.bids.slice(0, 10).map((bid: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-16">{bid.price.toFixed(2)}</span>
              <div className="flex-1 bg-green-100 h-4 relative">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${(bid.quantity / maxQuantity) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right">{bid.quantity}</span>
            </div>
          ))}
        </div>

        <div>
          <h3 className="font-semibold text-red-600 mb-1">Asks</h3>
          {orderbook.asks.slice(0, 10).map((ask: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-16">{ask.price.toFixed(2)}</span>
              <div className="flex-1 bg-red-100 h-4 relative">
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(ask.quantity / maxQuantity) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right">{ask.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## 🗄️ Future Enhancements

### UI Components (To Build)
- `<PortfolioDashboard />` - Full portfolio management UI
- `<WhaleTracker />` - Whale activity monitoring panel
- `<MarketDepth />` - Visual order book depth chart
- `<TradeFeed />` - Live market tape component
- `<OrderNotifications />` - Toast notifications for fills

### Database Models (To Add)
```sql
-- Store historical portfolio snapshots
CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  platform TEXT,
  total_value DECIMAL,
  total_pnl DECIMAL,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store whale trade alerts
CREATE TABLE whale_alerts (
  id UUID PRIMARY KEY,
  market_id TEXT,
  alert_type TEXT, -- 'holder' | 'trade'
  trader_address TEXT,
  amount DECIMAL,
  value DECIMAL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_portfolio_snapshots_user_time ON portfolio_snapshots(user_id, created_at DESC);
CREATE INDEX idx_whale_alerts_market_time ON whale_alerts(market_id, created_at DESC);
```

---

## 📚 Related Documentation

- **NEW_API_FEATURES.md** - Detailed API endpoint documentation
- **Kalshi API Docs**: https://docs.kalshi.com/
- **Polymarket CLOB Docs**: https://docs.polymarket.com/developers/CLOB/introduction

---

## ✅ Testing Checklist

- [ ] Test portfolio API routes with valid credentials
- [ ] Test whale tracking with real market data
- [ ] Test WebSocket connections (authenticated & public)
- [ ] Test error handling when credentials are missing
- [ ] Test rate limiting and pagination
- [ ] Test real-time updates with live markets
- [ ] Test order book visualization
- [ ] Test whale alert thresholds

---

## 🎯 Quick Start

1. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Add your API keys
   ```

2. **Test portfolio API**
   ```bash
   curl http://localhost:3000/api/portfolio/kalshi/positions
   ```

3. **Use hooks in your components**
   ```typescript
   import { usePortfolioApi } from '@/hooks/use-portfolio-api'

   const portfolio = usePortfolioApi()
   ```

4. **Connect to real-time data**
   ```typescript
   import { useKalshiRealtime } from '@/hooks/use-kalshi-realtime'

   const ws = useKalshiRealtime({
     tickers: ['KXHIGHNY-25'],
     channels: ['ticker']
   })
   ```

---

Ready to build! 🚀
