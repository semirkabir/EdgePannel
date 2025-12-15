# EdgePannel Architecture

## Vision: Unified Market Intelligence

EdgePannel is designed to be a unified intelligence platform for prediction markets, featuring:

1. **Pluggable Broker System**: Connect to any prediction market platform
2. **Extensible Data Sources**: Overlay real-world data on the interactive globe
3. **Unified Interface**: Trade, analyze, and visualize everything in one place

This document outlines the architectural principles and design patterns that enable this vision.

---

## Core Principles

### 1. Modularity
Every component should be independently replaceable without affecting the core system.

### 2. Extensibility
New brokers and data sources can be added without modifying existing code.

### 3. Type Safety
Strong TypeScript interfaces ensure consistency across all integrations.

### 4. Performance
Lazy loading, caching, and efficient data handling for smooth user experience.

---

## Pluggable Broker System

### Architecture Overview

The broker system uses a plugin architecture where each broker implements a standardized interface:

```typescript
// lib/brokers/types.ts

export interface Broker {
  // Identification
  id: string
  name: string
  displayName: string
  icon?: string

  // Authentication
  authenticate(credentials: BrokerCredentials): Promise<AuthResult>
  isAuthenticated(): boolean

  // Market Data
  fetchMarkets(filters?: MarketFilters): Promise<Market[]>
  fetchMarket(marketId: string): Promise<Market>
  searchMarkets(query: string): Promise<Market[]>

  // Trading
  placeOrder(order: OrderRequest): Promise<OrderResult>
  cancelOrder(orderId: string): Promise<void>
  getOrders(filters?: OrderFilters): Promise<Order[]>

  // Portfolio
  getPositions(): Promise<Position[]>
  getBalance(): Promise<Balance>
  getPortfolioValue(): Promise<number>

  // Real-time Data
  subscribe(channels: string[]): WebSocketConnection
  unsubscribe(channels: string[]): void

  // Metadata
  getSupportedFeatures(): BrokerFeature[]
  getRateLimits(): RateLimitInfo
}

export interface BrokerCredentials {
  [key: string]: string
}

export interface Market {
  id: string
  brokerId: string
  title: string
  description?: string
  outcomes: Outcome[]
  volume: number
  liquidity: number
  endDate: Date
  location?: GeographicLocation
  category?: string
  metadata?: Record<string, any>
}

export interface Order {
  id: string
  brokerId: string
  marketId: string
  side: 'buy' | 'sell'
  outcome: string
  price: number
  quantity: number
  status: OrderStatus
  timestamp: Date
}

export interface Position {
  id: string
  brokerId: string
  marketId: string
  outcome: string
  quantity: number
  averagePrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
}
```

### Current Broker Implementations

#### Polymarket (`lib/brokers/polymarket.ts`)
- GraphQL Subgraph for market data
- CLOB API for order placement
- WebSocket for user order updates
- Supports limit orders, market orders

#### Kalshi (`lib/brokers/kalshi.ts`)
- REST API with RSA-PSS authentication
- WebSocket for real-time market data
- Full order book depth
- Event-based market structure

### Adding a New Broker

To add a new broker (e.g., Cowswap):

1. **Create broker implementation**:
```typescript
// lib/brokers/cowswap.ts

import type { Broker, Market, Order, Position } from './types'

export class CowswapBroker implements Broker {
  id = 'cowswap'
  name = 'cowswap'
  displayName = 'Cowswap'

  private apiKey?: string

  async authenticate(credentials: BrokerCredentials): Promise<AuthResult> {
    this.apiKey = credentials.apiKey
    // Validate credentials
    const isValid = await this.validateApiKey(this.apiKey)
    return { success: isValid }
  }

  isAuthenticated(): boolean {
    return !!this.apiKey
  }

  async fetchMarkets(filters?: MarketFilters): Promise<Market[]> {
    // Implement Cowswap API call
    const response = await fetch('https://api.cowswap.io/markets', {
      headers: { 'X-API-Key': this.apiKey }
    })
    const data = await response.json()

    // Transform to standard Market format
    return data.markets.map(this.transformMarket)
  }

  private transformMarket(cowswapMarket: any): Market {
    return {
      id: cowswapMarket.id,
      brokerId: 'cowswap',
      title: cowswapMarket.question,
      description: cowswapMarket.description,
      outcomes: cowswapMarket.outcomes.map(o => ({
        id: o.id,
        name: o.name,
        price: o.price
      })),
      volume: cowswapMarket.volume,
      liquidity: cowswapMarket.liquidity,
      endDate: new Date(cowswapMarket.closeTime),
      location: this.extractLocation(cowswapMarket),
      category: cowswapMarket.category,
      metadata: { original: cowswapMarket }
    }
  }

  // Implement other required methods...
}
```

2. **Register the broker**:
```typescript
// lib/brokers/registry.ts

import { PolymarketBroker } from './polymarket'
import { KalshiBroker } from './kalshi'
import { CowswapBroker } from './cowswap'

export const brokerRegistry = {
  polymarket: new PolymarketBroker(),
  kalshi: new KalshiBroker(),
  cowswap: new CowswapBroker(),
}

export function getBroker(brokerId: string): Broker {
  return brokerRegistry[brokerId]
}

export function getAllBrokers(): Broker[] {
  return Object.values(brokerRegistry)
}
```

3. **Update UI to include new broker**:
```typescript
// components/settings/BrokerSettings.tsx

const availableBrokers = [
  { id: 'polymarket', name: 'Polymarket', icon: '/icons/polymarket.svg' },
  { id: 'kalshi', name: 'Kalshi', icon: '/icons/kalshi.svg' },
  { id: 'cowswap', name: 'Cowswap', icon: '/icons/cowswap.svg' },
]
```

---

## Extensible Data Source System

### Architecture Overview

Data sources provide overlays that can be visualized on the globe:

```typescript
// lib/data-sources/types.ts

export interface DataSource {
  // Identification
  id: string
  name: string
  displayName: string
  icon?: string
  category: DataCategory

  // Configuration
  configure(config: DataSourceConfig): void
  getConfig(): DataSourceConfig

  // Data Fetching
  fetchData(params?: FetchParams): Promise<DataPoint[]>
  subscribe?(callback: (data: DataPoint[]) => void): Subscription

  // Visualization
  visualize(globe: Globe, data: DataPoint[]): VisualizationResult
  clearVisualization(globe: Globe): void

  // Metadata
  getUpdateFrequency(): number // milliseconds
  getDataRetention(): number // milliseconds
  getSupportedFilters(): FilterOption[]
}

export interface DataPoint {
  id: string
  sourceId: string
  timestamp: Date
  location: GeographicLocation
  value: number | string | object
  metadata?: Record<string, any>
}

export interface GeographicLocation {
  lat: number
  lng: number
  altitude?: number
  name?: string
  country?: string
}

export interface VisualizationResult {
  type: 'points' | 'heatmap' | 'arcs' | 'custom'
  objects: any[] // Three.js objects
  cleanup: () => void
}

export type DataCategory =
  | 'weather'
  | 'news'
  | 'economic'
  | 'geopolitical'
  | 'natural'
  | 'custom'
```

### Example Data Source: NASA Weather

```typescript
// lib/data-sources/nasa-weather.ts

import type { DataSource, DataPoint, VisualizationResult } from './types'

export class NASAWeatherSource implements DataSource {
  id = 'nasa-weather'
  name = 'nasa-weather'
  displayName = 'NASA Weather Systems'
  category = 'weather'

  private apiKey?: string
  private config: DataSourceConfig = {
    showStorms: true,
    showTemperature: false,
    showPrecipitation: true
  }

  configure(config: DataSourceConfig): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): DataSourceConfig {
    return this.config
  }

  async fetchData(params?: FetchParams): Promise<DataPoint[]> {
    // Fetch from NASA API
    const response = await fetch(
      `https://api.nasa.gov/weather/storms?api_key=${this.apiKey}`
    )
    const storms = await response.json()

    return storms.map(storm => ({
      id: storm.id,
      sourceId: this.id,
      timestamp: new Date(storm.timestamp),
      location: {
        lat: storm.latitude,
        lng: storm.longitude,
        name: storm.name
      },
      value: storm.intensity,
      metadata: {
        category: storm.category,
        windSpeed: storm.windSpeed,
        pressure: storm.pressure
      }
    }))
  }

  visualize(globe: Globe, data: DataPoint[]): VisualizationResult {
    const objects: any[] = []

    // Create visual representations
    data.forEach(point => {
      if (this.config.showStorms) {
        // Add animated storm visualization
        const stormRing = this.createStormRing(point)
        globe.scene().add(stormRing)
        objects.push(stormRing)
      }

      if (this.config.showPrecipitation) {
        // Add precipitation overlay
        const precipitationArea = this.createPrecipitationArea(point)
        globe.scene().add(precipitationArea)
        objects.push(precipitationArea)
      }
    })

    return {
      type: 'custom',
      objects,
      cleanup: () => {
        objects.forEach(obj => globe.scene().remove(obj))
      }
    }
  }

  clearVisualization(globe: Globe): void {
    // Remove all visualizations
  }

  getUpdateFrequency(): number {
    return 600000 // 10 minutes
  }

  getDataRetention(): number {
    return 86400000 // 24 hours
  }

  getSupportedFilters(): FilterOption[] {
    return [
      { id: 'minIntensity', name: 'Minimum Intensity', type: 'number' },
      { id: 'stormType', name: 'Storm Type', type: 'select', options: ['hurricane', 'typhoon', 'cyclone'] }
    ]
  }

  private createStormRing(point: DataPoint): THREE.Object3D {
    // Create animated ring visualization
    // Implementation details...
    return new THREE.Object3D()
  }

  private createPrecipitationArea(point: DataPoint): THREE.Object3D {
    // Create precipitation visualization
    // Implementation details...
    return new THREE.Object3D()
  }
}
```

### Data Source Registry

```typescript
// lib/data-sources/registry.ts

import { GDELTNewsSource } from './gdelt'
import { NASAWeatherSource } from './nasa-weather'
import { MeteorSource } from './meteor'
import { EconomicIndicatorsSource } from './economic'

export const dataSourceRegistry = {
  'gdelt-news': new GDELTNewsSource(),
  'nasa-weather': new NASAWeatherSource(),
  'meteor': new MeteorSource(),
  'economic': new EconomicIndicatorsSource(),
}

export function getDataSource(sourceId: string): DataSource {
  return dataSourceRegistry[sourceId]
}

export function getAllDataSources(): DataSource[] {
  return Object.values(dataSourceRegistry)
}

export function getDataSourcesByCategory(category: DataCategory): DataSource[] {
  return Object.values(dataSourceRegistry).filter(
    source => source.category === category
  )
}
```

---

## Globe Visualization Integration

### Unified Globe Manager

```typescript
// lib/globe/manager.ts

export class GlobeManager {
  private globe: Globe
  private activeBrokers: Set<string> = new Set()
  private activeDataSources: Set<string> = new Set()
  private visualizations: Map<string, VisualizationResult> = new Map()

  constructor(globe: Globe) {
    this.globe = globe
  }

  // Broker Integration
  async addBrokerMarkets(brokerId: string): Promise<void> {
    const broker = getBroker(brokerId)
    const markets = await broker.fetchMarkets()

    // Add market points to globe
    const marketPoints = markets
      .filter(m => m.location)
      .map(m => ({
        lat: m.location!.lat,
        lng: m.location!.lng,
        size: Math.log(m.volume) / 10,
        color: this.getBrokerColor(brokerId),
        label: m.title,
        marketId: m.id,
        brokerId: m.brokerId
      }))

    this.globe.pointsData(marketPoints)
    this.activeBrokers.add(brokerId)
  }

  removeBrokerMarkets(brokerId: string): void {
    this.activeBrokers.delete(brokerId)
    // Re-render without this broker's markets
    this.refreshMarkets()
  }

  // Data Source Integration
  async addDataSource(sourceId: string): Promise<void> {
    const source = getDataSource(sourceId)
    const data = await source.fetchData()

    const visualization = source.visualize(this.globe, data)
    this.visualizations.set(sourceId, visualization)
    this.activeDataSources.add(sourceId)
  }

  removeDataSource(sourceId: string): void {
    const visualization = this.visualizations.get(sourceId)
    if (visualization) {
      visualization.cleanup()
      this.visualizations.delete(sourceId)
    }
    this.activeDataSources.delete(sourceId)
  }

  // Update and Refresh
  async refreshDataSource(sourceId: string): Promise<void> {
    this.removeDataSource(sourceId)
    await this.addDataSource(sourceId)
  }

  private async refreshMarkets(): Promise<void> {
    const allMarkets: any[] = []

    for (const brokerId of this.activeBrokers) {
      const broker = getBroker(brokerId)
      const markets = await broker.fetchMarkets()

      markets
        .filter(m => m.location)
        .forEach(m => {
          allMarkets.push({
            lat: m.location!.lat,
            lng: m.location!.lng,
            size: Math.log(m.volume) / 10,
            color: this.getBrokerColor(brokerId),
            label: m.title,
            marketId: m.id,
            brokerId: m.brokerId
          })
        })
    }

    this.globe.pointsData(allMarkets)
  }

  private getBrokerColor(brokerId: string): string {
    const colors: Record<string, string> = {
      polymarket: '#2196F3',
      kalshi: '#00ff7f',
      cowswap: '#FF6B6B',
    }
    return colors[brokerId] || '#FFFFFF'
  }
}
```

---

## Database Schema Extensions

### Broker Credentials

```sql
-- Store encrypted broker credentials per user
CREATE TABLE user_broker_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_id TEXT NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_id)
);

CREATE INDEX idx_user_broker_creds ON user_broker_credentials(user_id, broker_id);
```

### Data Source Configurations

```sql
-- Store user preferences for data sources
CREATE TABLE user_data_source_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  config JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_id)
);

CREATE INDEX idx_user_data_configs ON user_data_source_configs(user_id, source_id);
```

### Unified Market Data

```sql
-- Normalized market table supporting all brokers
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id TEXT NOT NULL,
  broker_market_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,
  location_name TEXT,
  category TEXT,
  volume DECIMAL,
  liquidity DECIMAL,
  end_date TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(broker_id, broker_market_id)
);

CREATE INDEX idx_markets_broker ON markets(broker_id);
CREATE INDEX idx_markets_location ON markets(location_lat, location_lng);
CREATE INDEX idx_markets_category ON markets(category);
```

---

## API Routes Structure

### Broker Endpoints

```
GET  /api/brokers                    # List all available brokers
GET  /api/brokers/:brokerId          # Get broker details
POST /api/brokers/:brokerId/auth     # Authenticate with broker
GET  /api/brokers/:brokerId/markets  # Get markets from broker
POST /api/brokers/:brokerId/orders   # Place order on broker
GET  /api/brokers/:brokerId/portfolio # Get portfolio from broker
```

### Data Source Endpoints

```
GET  /api/data-sources                    # List all data sources
GET  /api/data-sources/:sourceId          # Get data source details
POST /api/data-sources/:sourceId/enable   # Enable data source
POST /api/data-sources/:sourceId/disable  # Disable data source
GET  /api/data-sources/:sourceId/data     # Fetch data
POST /api/data-sources/:sourceId/config   # Update configuration
```

### Unified Endpoints

```
GET /api/markets                # Get markets from all active brokers
GET /api/portfolio              # Get unified portfolio
GET /api/globe/state            # Get current globe visualization state
```

---

## Future Enhancements

### 1. Plugin Marketplace
Allow third-party developers to create and distribute:
- Custom brokers
- Custom data sources
- Custom visualizations
- Custom analytics tools

### 2. Smart Routing
Automatically route orders to the broker with best execution:
- Compare prices across brokers
- Account for fees and slippage
- Execute multi-leg strategies

### 3. Advanced Analytics
- Cross-broker correlation analysis
- Sentiment analysis from data sources
- Predictive modeling using overlaid data
- Custom indicator builder

### 4. Community Features
- Share visualization configurations
- Collaborative market research
- Social trading features
- Strategy backtesting

---

## Contributing

To contribute a new broker or data source:

1. Implement the required interface
2. Add comprehensive tests
3. Update documentation
4. Submit a pull request

See `CONTRIBUTING.md` for detailed guidelines.

---

## License

MIT
