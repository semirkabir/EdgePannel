
# EdgePannel API Documentation

## Overview

The EdgePannel API provides access to aggregated prediction market data from multiple platforms (currently Polymarket and Kalshi).

## Authentication

Currently, the API is public for read-only access. Write operations require an authenticated session.

## Endpoints

### Markets

#### Get All Markets
`GET /api/markets`

Returns a paginated list of markets from all platforms.

**Parameters:**
- `limit` (optional): Number of markets to return (default: 100)
- `offset` (optional): Offset for pagination
- `platform` (optional): Filter by platform ('polymarket' | 'kalshi')
- `search` (optional): Search query

#### Get Market Details
`GET /api/markets/[id]`

Returns detailed information about a specific market.

### Events

#### Get Events
`GET /api/markets/events`

Returns grouped market events.

### Analytics

#### Get Market History
`GET /api/markets/history`

Returns price history for a market.

**Parameters:**
- `id`: Market ID
- `platform`: Platform name
- `interval`: Time interval ('1h', '6h', '1d')

## Data Models

### Market

```typescript
interface Market {
  id: string
  platform: 'polymarket' | 'kalshi'
  title: string
  description?: string
  price: number
  probability: number
  volume24h: number
  liquidity: number
  endDate?: Date
  outcomes: string[]
}
```

## Rate Limiting

- Public API: 60 requests per minute
- Authenticated: 1000 requests per minute
