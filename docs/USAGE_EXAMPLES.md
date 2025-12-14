# Usage Examples

This guide provides comprehensive examples for using all the new API features, components, and hooks.

## Table of Contents

1. [Portfolio Management](#portfolio-management)
2. [Whale Tracking](#whale-tracking)
3. [Market Data Visualization](#market-data-visualization)
4. [Notifications](#notifications)
5. [Analytics & P&L Tracking](#analytics--pl-tracking)
6. [Real-time Data with WebSockets](#real-time-data-with-websockets)
7. [Complete Application Example](#complete-application-example)

---

## Portfolio Management

### Basic Portfolio Dashboard

```tsx
'use client'

import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard'

export default function PortfolioPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Portfolio</h1>

      <PortfolioDashboard
        polymarketAddress="0x1234..." // User's Polymarket wallet address
        kalshiCredentials={{
          accessKeyId: process.env.NEXT_PUBLIC_KALSHI_API_KEY_ID!,
          privateKey: process.env.KALSHI_PRIVATE_KEY!
        }}
      />
    </div>
  )
}
```

### Using the Portfolio API Hook

```tsx
'use client'

import { usePortfolioApi } from '@/hooks/use-portfolio-api'

export function MyPortfolioComponent() {
  const portfolio = usePortfolioApi({
    polymarketAddress: '0x1234...',
    refreshInterval: 30000 // Refresh every 30 seconds
  })

  if (portfolio.loading) {
    return <div>Loading portfolio...</div>
  }

  return (
    <div>
      <h2>Portfolio Summary</h2>

      {/* Combined Stats */}
      <div className="stats">
        <div>Total P&L: ${portfolio.combined.totalPnl.toFixed(2)}</div>
        <div>Total Value: ${portfolio.combined.totalValue.toFixed(2)}</div>
        <div>Positions: {portfolio.combined.positionCount}</div>
      </div>

      {/* Kalshi Positions */}
      <h3>Kalshi Positions</h3>
      {portfolio.kalshi.positions.map(position => (
        <div key={position.ticker}>
          <span>{position.ticker}</span>
          <span>Size: {position.position}</span>
          <span className={position.realizedPnl >= 0 ? 'text-green' : 'text-red'}>
            P&L: ${position.realizedPnl.toFixed(2)}
          </span>
        </div>
      ))}

      {/* Polymarket Positions */}
      <h3>Polymarket Positions</h3>
      {portfolio.polymarket.positions.map(position => (
        <div key={position.conditionId}>
          <span>{position.market?.question || position.conditionId}</span>
          <span>Size: {position.size}</span>
          <span>Value: ${position.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
```

### Saving Portfolio Snapshots

```tsx
'use client'

import { useEffect } from 'react'
import { usePortfolioApi } from '@/hooks/use-portfolio-api'
import { usePortfolioSnapshot } from '@/hooks/use-portfolio-snapshot'

export function AutoSavePortfolio({ userId }: { userId: string }) {
  const portfolio = usePortfolioApi()
  const { saveSnapshot, lastSaved } = usePortfolioSnapshot({
    autoSaveInterval: 300000, // Save every 5 minutes
    notifyOnSave: true
  })

  // Auto-save when portfolio data changes
  useEffect(() => {
    if (portfolio.combined.totalValue > 0) {
      saveSnapshot({
        userId,
        platform: 'combined',
        totalValue: portfolio.combined.totalValue,
        totalPnl: portfolio.combined.totalPnl,
        positionCount: portfolio.combined.positionCount,
        positions: [
          ...portfolio.kalshi.positions.map(p => ({
            marketId: p.ticker,
            ticker: p.ticker,
            size: p.position,
            realizedPnl: p.realizedPnl,
            unrealizedPnl: p.marketExposure
          })),
          ...portfolio.polymarket.positions.map(p => ({
            marketId: p.conditionId,
            marketTitle: p.market?.question,
            size: p.size,
            currentPrice: p.market?.lastPrice
          }))
        ]
      })
    }
  }, [portfolio.combined.totalValue, portfolio.combined.totalPnl])

  return (
    <div>
      {lastSaved && (
        <p className="text-sm text-gray-500">
          Last saved: {lastSaved.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
```

---

## Whale Tracking

### Basic Whale Tracker

```tsx
'use client'

import { WhaleTracker } from '@/components/whales/WhaleTracker'

export default function WhaleTrackerPage() {
  return (
    <div className="container mx-auto py-8">
      <WhaleTracker
        marketId="0x1234..." // Polymarket condition ID
        marketTitle="Will Bitcoin reach $100k?"
        minTradeSize={10000} // Track trades over $10k
        holderThreshold={5} // Alert on holders with >5%
      />
    </div>
  )
}
```

### Using the Whale Data Hook

```tsx
'use client'

import { useWhaleData } from '@/hooks/use-whale-data'
import { useNotifications } from '@/hooks/use-notifications'

export function CustomWhaleMonitor({ marketId }: { marketId: string }) {
  const {
    alerts,
    newAlertCount,
    holders,
    trades,
    clearAlerts
  } = useWhaleData({
    market: marketId,
    minTradeSize: 5000,
    refreshInterval: 10000,
    alertThreshold: {
      holderPercentage: 5,
      tradeValue: 5000
    }
  })

  const { notifyWhaleAlert } = useNotifications()

  // Show notification for new alerts
  useEffect(() => {
    if (newAlertCount > 0) {
      const latestAlert = alerts[alerts.length - 1]
      notifyWhaleAlert(latestAlert.data)
    }
  }, [newAlertCount])

  return (
    <div>
      <h2>Whale Activity</h2>

      {/* Top Holders */}
      <div>
        <h3>Top 10 Holders</h3>
        {holders.slice(0, 10).map(holder => (
          <div key={holder.address}>
            <span>{holder.address.slice(0, 6)}...</span>
            <span>{holder.percentage.toFixed(2)}%</span>
            <span>{holder.amount.toLocaleString()} shares</span>
          </div>
        ))}
      </div>

      {/* Recent Large Trades */}
      <div>
        <h3>Large Trades ({trades.length})</h3>
        {trades.slice(0, 20).map(trade => (
          <div key={trade.id}>
            <span>{trade.side}</span>
            <span>${trade.value.toLocaleString()}</span>
            <span>@ {trade.price.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Market Data Visualization

### Market Depth Chart

```tsx
'use client'

import { MarketDepth } from '@/components/market/MarketDepth'

export function MarketDepthExample() {
  return (
    <div>
      <h2>Order Book</h2>
      <MarketDepth
        ticker="KXBTC-24DEC31-T100000"
        platform="kalshi"
        refreshInterval={5000} // Update every 5 seconds
      />
    </div>
  )
}
```

### Trade Feed

```tsx
'use client'

import { TradeFeed } from '@/components/market/TradeFeed'

export function TradeFeedExample() {
  return (
    <div>
      <h2>Live Market Tape</h2>
      <TradeFeed
        ticker="KXBTC-24DEC31-T100000"
        platform="kalshi"
        maxTrades={100}
        autoScroll={true}
      />
    </div>
  )
}
```

---

## Notifications

### Setting Up Notifications

```tsx
'use client'

import { useNotifications } from '@/hooks/use-notifications'

export function NotificationExample() {
  const {
    notifications,
    unreadCount,
    notifySuccess,
    notifyError,
    notifyWhaleAlert,
    notifyOrderFill,
    markAllAsRead
  } = useNotifications({
    enableBrowserNotifications: true,
    enableToasts: true,
    maxNotifications: 100
  })

  // Example: Notify on order fill
  const handleOrderFilled = (order: any) => {
    notifyOrderFill({
      ticker: order.ticker,
      side: order.side,
      quantity: order.quantity,
      price: order.price
    })
  }

  // Example: Notify on whale trade
  const handleWhaleTrade = (trade: any) => {
    notifyWhaleAlert({
      type: 'trade',
      value: trade.value,
      side: trade.side,
      price: trade.price
    })
  }

  return (
    <div>
      <div className="notification-bell">
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </div>

      <div className="notification-list">
        {notifications.map(notif => (
          <div key={notif.id} className={notif.read ? 'read' : 'unread'}>
            <h4>{notif.title}</h4>
            <p>{notif.message}</p>
            <span>{notif.timestamp.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button onClick={markAllAsRead}>
        Mark All as Read
      </button>
    </div>
  )
}
```

---

## Analytics & P&L Tracking

### Portfolio Performance Chart

```tsx
'use client'

import { PortfolioChart } from '@/components/analytics/PortfolioChart'

export function PortfolioAnalytics({ userId }: { userId: string }) {
  return (
    <div>
      <h2>Portfolio Performance</h2>

      {/* Real data from Supabase */}
      <PortfolioChart
        userId={userId}
        platform="combined"
        timeRange="30d"
        useMockData={false} // Set to true for demo data
      />
    </div>
  )
}
```

### P&L History Visualization

```tsx
'use client'

import { PnLHistory } from '@/components/analytics/PnLHistory'

export function PnLAnalytics({ userId }: { userId: string }) {
  return (
    <div>
      <h2>Profit & Loss History</h2>

      <PnLHistory
        userId={userId}
        platform="combined"
      />
    </div>
  )
}
```

---

## Real-time Data with WebSockets

### Kalshi Real-time Updates

```tsx
'use client'

import { useKalshiRealtime } from '@/hooks/use-kalshi-realtime'

export function RealtimeMarketData() {
  const {
    connected,
    messages,
    lastMessage,
    subscribe,
    unsubscribe
  } = useKalshiRealtime({
    tickers: ['KXBTC-24DEC31-T100000'],
    channels: ['ticker', 'orderbook_delta', 'trade'],
    autoConnect: true,
    onMessage: (msg) => {
      console.log('Received message:', msg)
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
    }
  })

  return (
    <div>
      <div>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</div>

      {lastMessage && (
        <div>
          <h3>Latest Update</h3>
          <pre>{JSON.stringify(lastMessage, null, 2)}</pre>
        </div>
      )}

      <div>
        <h3>Recent Messages ({messages.length})</h3>
        {messages.slice(-10).map((msg, i) => (
          <div key={i}>
            <strong>{msg.type}</strong>: {msg.payload?.ticker || 'N/A'}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Polymarket User WebSocket

```tsx
'use client'

import { usePolymarketUserRealtime } from '@/hooks/use-polymarket-user-realtime'

export function PolymarketOrderUpdates() {
  const {
    connected,
    orders,
    recentEvents,
    onOrderEvent
  } = usePolymarketUserRealtime({
    apiKey: process.env.NEXT_PUBLIC_POLYMARKET_API_KEY!,
    autoConnect: true
  })

  // Subscribe to specific order events
  onOrderEvent('MATCHED', (msg) => {
    console.log('Order matched:', msg)
  })

  onOrderEvent('CONFIRMED', (msg) => {
    console.log('Order confirmed on-chain:', msg)
  })

  return (
    <div>
      <h2>Your Order Updates</h2>

      <div>
        {recentEvents.slice(0, 10).map((event, i) => (
          <div key={i}>
            <span>{event.eventType}</span>
            <span>{event.orderId}</span>
            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Complete Application Example

### Full Trading Dashboard

```tsx
'use client'

import { useState } from 'react'
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard'
import { WhaleTracker } from '@/components/whales/WhaleTracker'
import { MarketDepth } from '@/components/market/MarketDepth'
import { TradeFeed } from '@/components/market/TradeFeed'
import { PortfolioChart } from '@/components/analytics/PortfolioChart'
import { PnLHistory } from '@/components/analytics/PnLHistory'
import { useNotifications } from '@/hooks/use-notifications'
import { usePortfolioSnapshot } from '@/hooks/use-portfolio-snapshot'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TradingDashboard({
  userId,
  polymarketAddress,
  kalshiCredentials
}: {
  userId: string
  polymarketAddress: string
  kalshiCredentials: {
    accessKeyId: string
    privateKey: string
  }
}) {
  const [selectedMarket, setSelectedMarket] = useState<string>('')

  const notifications = useNotifications({
    enableBrowserNotifications: true,
    enableToasts: true
  })

  const snapshot = usePortfolioSnapshot({
    autoSaveInterval: 300000, // 5 minutes
    notifyOnSave: true
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Trading Dashboard</h1>

            {/* Notification Bell */}
            <div className="relative cursor-pointer">
              <span className="text-2xl">🔔</span>
              {notifications.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="whales">Whale Tracker</TabsTrigger>
            <TabsTrigger value="markets">Markets</TabsTrigger>
            <TabsTrigger value="trades">Trade Feed</TabsTrigger>
          </TabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            <PortfolioDashboard
              polymarketAddress={polymarketAddress}
              kalshiCredentials={kalshiCredentials}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <PortfolioChart
              userId={userId}
              platform="combined"
              timeRange="30d"
            />

            <PnLHistory
              userId={userId}
              platform="combined"
            />
          </TabsContent>

          {/* Whale Tracker Tab */}
          <TabsContent value="whales">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Enter market ID to track..."
                className="w-full px-4 py-2 border rounded"
                onChange={(e) => setSelectedMarket(e.target.value)}
              />
            </div>

            {selectedMarket && (
              <WhaleTracker
                marketId={selectedMarket}
                minTradeSize={10000}
                holderThreshold={5}
              />
            )}
          </TabsContent>

          {/* Markets Tab */}
          <TabsContent value="markets">
            <div className="grid gap-6 md:grid-cols-2">
              <MarketDepth
                ticker="KXBTC-24DEC31-T100000"
                platform="kalshi"
              />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Market Info</h3>
                {/* Add market info components here */}
              </div>
            </div>
          </TabsContent>

          {/* Trade Feed Tab */}
          <TabsContent value="trades">
            <TradeFeed
              platform="kalshi"
              maxTrades={100}
              autoScroll={true}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

---

## Environment Variables

Make sure to set these environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Kalshi
KALSHI_API_KEY_ID=your_kalshi_key_id
KALSHI_PRIVATE_KEY=your_kalshi_private_key

# Polymarket
NEXT_PUBLIC_POLYMARKET_API_KEY=your_polymarket_api_key
```

---

## Best Practices

1. **Error Handling**: Always wrap API calls in try-catch blocks
2. **Rate Limiting**: Respect API rate limits (adjust refresh intervals accordingly)
3. **Data Caching**: Use SWR's caching to minimize API calls
4. **Real-time Updates**: Use WebSockets for live data, REST APIs for historical data
5. **Performance**: Only fetch data you need, use pagination where available
6. **Security**: Never expose API keys in client-side code (use server-side routes)

---

For more details, see:
- [NEW_API_FEATURES.md](./NEW_API_FEATURES.md) - Complete API reference
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Detailed implementation guide
