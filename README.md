# EdgePannel - Unified Prediction Market Intelligence

A next-generation prediction market intelligence platform featuring an interactive 3D globe visualization, multi-broker integration, and extensible data overlays. EdgePannel unifies prediction markets from multiple platforms into a single command center with real-time data, visual analytics, and a pluggable architecture designed for future expansion.

**One Platform. Every Market. Visualized Globally.**

## Vision

EdgePannel aims to become the definitive platform for prediction market intelligence by:

- **Unified Multi-Broker Interface**: Connect to any prediction market platform (Polymarket, Kalshi, Cowswap, and more) through a pluggable broker architecture
- **Extensible Data Ecosystem**: Integrate real-world data sources (NASA weather, Meteor data, news feeds, economic indicators) as visual overlays on the globe
- **Interactive Geospatial Visualization**: See how events and markets relate to their geographic locations in real-time
- **Future-Ready Architecture**: Built to accommodate new brokers and data sources without core modifications

## Current Features

- **Interactive 3D World Map**: Navigate a dark, futuristic globe showing prediction markets at their geographic locations
- **Multi-Platform Support**: Currently integrates with Polymarket and Kalshi prediction markets
- **Market Comparison**: Automatically identifies similar markets across platforms and highlights price discrepancies
- **Trading Interface**: Buy and sell directly on both platforms through the unified interface
- **Real-time Data**: Live market data with price history charts and WebSocket feeds
- **Portfolio Tracking**: Monitor positions and P&L across all connected platforms
- **Whale Tracking**: Identify and monitor large holders and trades
- **User Authentication**: Secure login with email/password and OAuth (Google, GitHub)

## Future Roadmap

### Pluggable Broker System
EdgePannel is designed with a pluggable architecture to support unlimited prediction market platforms:

- **Current Brokers**: Polymarket, Kalshi
- **Planned Brokers**: Cowswap, Augur, Gnosis, and any emerging prediction market platforms
- **Unified API**: Single interface for placing orders, fetching markets, and managing positions across all brokers

### Extensible Data Overlays
Visualize real-world data directly on the globe to enhance market intelligence:

- **Weather Data**: NASA weather systems, storm tracking, climate events
- **Geopolitical Events**: News feeds, conflict zones, political developments
- **Economic Indicators**: Regional GDP, unemployment, market indices
- **Custom Data Sources**: Plugin system for adding any external data source
- **Visual Effects**: Heat maps, particle systems, animated overlays that respond to data changes

### Enhanced Analytics
- Cross-platform arbitrage detection
- Historical performance tracking
- Advanced portfolio analytics
- Sentiment analysis integration
- Custom alert systems

## Tech Stack

- **Frontend**: Next.js 14 (App Router) with TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: NextAuth.js
- **Map Visualization**: react-globe.gl
- **Charts**: Recharts
- **Real-time**: WebSocket connections for live market data

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- API keys for Polymarket and/or Kalshi

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up your environment variables in `.env`:

```env
# Database
DATABASE_URL=your_postgresql_connection_string

# NextAuth
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=http://localhost:3000

# Encryption Key (for API key encryption)
ENCRYPTION_KEY=your_encryption_key

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Note**: User authentication uses NextAuth.js with Prisma for user management.

3. Set up the database:

```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Key Configuration

After logging in, navigate to Settings to configure your API keys:

### Polymarket
- Get your API key from your Polymarket account settings
- Enter it in the Settings page

### Kalshi
- Generate an Access Key ID and Private Key from your Kalshi account
- Enter both in the Settings page (Private Key should be in PEM format)

## Project Structure

```
/
├── app/
│   ├── (auth)/          # Authentication pages
│   ├── dashboard/       # Main dashboard and settings
│   └── api/             # API routes
├── components/
│   ├── map/             # Map visualization components
│   ├── panels/          # Sidebar and detail panels
│   ├── trading/         # Trading interface
│   ├── charts/          # Chart components
│   └── ui/              # Reusable UI components
├── lib/
│   ├── api/             # API clients (Polymarket, Kalshi)
│   ├── db/              # Database client
│   └── utils/            # Utility functions
└── types/                # TypeScript type definitions
```

## Architecture

### Pluggable Broker System
EdgePannel uses a modular broker architecture that allows seamless integration of new prediction market platforms:

```typescript
interface Broker {
  id: string
  name: string
  authenticate(credentials: BrokerCredentials): Promise<void>
  fetchMarkets(filters?: MarketFilters): Promise<Market[]>
  placeOrder(order: Order): Promise<OrderResult>
  getPositions(): Promise<Position[]>
  subscribe(events: string[]): WebSocket
}
```

### Current Broker Integrations

#### Kalshi
- RSA-PSS signature authentication
- Access Key ID and Private Key per user
- WebSocket support for real-time market data
- Full order book depth and trade history

#### Polymarket
- API key authentication
- GraphQL Subgraph for market data
- CLOB API for trading
- WebSocket for user order updates

### Future Data Source Integration
The platform is designed to support pluggable data overlays:

```typescript
interface DataSource {
  id: string
  name: string
  fetchData(params?: any): Promise<DataPoint[]>
  visualize(globe: Globe, data: DataPoint[]): void
}
```

Examples of planned integrations:
- NASA Earth Observation data
- Meteor shower tracking
- GDELT news events (already integrated)
- Economic indicators
- Weather systems

## Security

- User API keys are encrypted using AES encryption before storage
- All API routes are protected with NextAuth middleware
- Sensitive operations require authentication

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run database migrations
npx prisma migrate dev
```

## License

MIT



