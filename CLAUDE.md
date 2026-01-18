# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EdgePannel** is a unified prediction market intelligence platform that integrates multiple prediction market platforms (Polymarket, Kalshi) with an interactive 3D globe visualization, real-time data feeds, and geospatial market analysis. Built with Next.js 16, it features a pluggable broker architecture designed for extensibility.

**Tech Stack:**
- Next.js 16 (App Router) with TypeScript
- PostgreSQL (via Prisma ORM)
- NextAuth.js for authentication
- React 18 with Radix UI components
- Tailwind CSS for styling
- Docker for local PostgreSQL
- MapLibre GL / react-map-gl for map visualizations
- Three.js / React Three Fiber for 3D globe

## Development Commands

### Local Development Setup

```bash
# First-time setup (starts Docker DB, runs migrations, generates Prisma client)
npm run dev:setup

# Start development server (assumes DB is running)
npm run dev

# Reset database completely (clears all data)
npm run dev:reset
```

### Database Commands

```bash
# Generate Prisma client (run after schema changes)
npx prisma generate

# Create and apply migration
npx prisma migrate dev

# Push schema changes without migration (for rapid prototyping)
npx prisma db push

# Open Prisma Studio (database GUI at localhost:5555)
npm run db:studio
```

### Build & Deployment

```bash
# Build for production (generates Prisma client first)
npm run build

# Start production server (also starts cron scheduler)
npm start

# Run linter
npm run lint
```

### Background Jobs & Scripts

```bash
# Start local cron scheduler (for data sync tasks)
npm run cron:start

# Test cron job execution
npm run cron:test
```

### Docker Commands

```bash
# Start PostgreSQL container in background
docker-compose up -d

# Stop PostgreSQL container
docker-compose down

# Stop and remove all data
docker-compose down -v

# View database logs
docker-compose logs
```

## Architecture

### High-Level Structure

```
app/                    # Next.js App Router pages and API routes
├── (auth)/            # Authentication pages (login, register)
├── dashboard/         # Main dashboard, portfolio, settings
├── edge/              # Edge-specific views
├── admin/             # Admin panel
└── api/               # API endpoints
    ├── auth/          # NextAuth handlers
    ├── market-data/   # Market data endpoints (orderbook, trades)
    ├── insights/      # Analytics and live trade data
    └── layers/        # Map data layers (news, finance)

components/
├── map/               # Map and globe visualization components
├── panels/            # Sidebar and detail panels
├── trading/           # Trading interface components
├── charts/            # Chart components (Recharts)
├── portfolio/         # Portfolio tracking UI
├── whales/            # Whale tracking components
└── ui/                # Radix UI-based shared components

lib/
├── api/               # External API clients
│   ├── polymarket-optimized.ts    # Polymarket API client
│   ├── kalshi-optimized.ts        # Kalshi API client
│   └── market-aggregator.ts       # Multi-platform aggregation
├── db/                # Database client (Prisma)
├── auth/              # Authentication utilities
├── middleware/        # Custom middleware (security, rate limiting)
├── store/             # Zustand state management
├── services/          # Business logic services
└── utils/             # Shared utilities

prisma/
└── schema.prisma      # Database schema

scripts/               # Utility scripts for data sync, testing
```

### Key Architectural Patterns

#### Pluggable Broker Architecture

The platform uses a unified interface for prediction market brokers. Each broker implements a common pattern:

- **Polymarket**: GraphQL Subgraph for market data, CLOB API for trading, WebSocket for order updates
- **Kalshi**: REST API with RSA-PSS signature auth, WebSocket for real-time market data

API clients are in `lib/api/polymarket-optimized.ts` and `lib/api/kalshi-optimized.ts`. The aggregator in `lib/api/market-aggregator.ts` provides cross-platform market comparison and arbitrage detection.

#### Database Schema (Prisma)

**Core Models:**
- `User` - User accounts with NextAuth integration
- `Account` / `Session` - NextAuth OAuth accounts and sessions
- `ApiKey` - Encrypted API keys for Polymarket/Kalshi (per user, per platform)
- `Trade` - User trade history across platforms
- `Watchlist` - User watchlisted markets
- `GeotaggedMarket` - Markets with extracted geolocation data (lat/lng)
- `MarketPriceHistory` - Historical price data for charts
- `AuditLog` - Security audit logs (login, API key changes, trades)

API keys are encrypted using AES encryption (see `lib/api-key/encryption.ts`).

#### Authentication Flow

NextAuth.js handles authentication with multiple providers:
- Email/password (bcrypt hashing)
- OAuth (Google, GitHub)

Auth is controlled by `AUTH_ENABLED` flag in `lib/auth-config.ts`. Middleware in `middleware.ts` enforces auth on protected routes and includes rate limiting, bot detection, and security headers.

Protected routes: `/dashboard/*`, `/api/*` (except `/api/auth`, `/api/public`, `/api/cron`)

#### Map Data Layers

The globe visualization supports pluggable data overlays:
- **Geopolitical conflicts** (`lib/data/conflict-zones.ts`)
- **News events** (GDELT API integration)
- **Financial data** (stock exchanges, commodities, FRED economic data)

Map markers are rendered on a MapLibre GL map with custom layers for different data types. Market locations are extracted from market titles using NLP (see `lib/location/extractor.ts`).

#### WebSocket Connections

Real-time data is managed via WebSocket connections:
- Polymarket: User-specific order updates
- Kalshi: Market price updates

Connections are established in trading components and managed with connection pooling (see `lib/ws/`).

#### Cron Jobs & Background Tasks

Scheduled tasks run via `scripts/local-cron-scheduler.ts`:
- Market data sync (fetches new markets from platforms)
- Price history updates
- API key rotation reminders

In production, use `npm start` which runs both Next.js server and cron scheduler concurrently.

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/webapp

# NextAuth
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:3000

# Encryption (for API keys)
ENCRYPTION_KEY=<32-byte-hex-string>

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# External APIs (optional, for extended features)
GEMINI_API_KEY=<for-AI-features>
```

**Security Notes:**
- Never commit `.env` file
- API keys are encrypted before storing in database
- Use `scripts/generate-secrets.js` to generate secure keys

## Development Workflow

### Branch Strategy

- `main` - Daily development (does NOT auto-deploy)
- `production` - Production branch (auto-deploys to edgepannel.com via Dokploy)

**Workflow:**
1. Develop and test locally on `main` branch
2. When ready to deploy, merge `main` into `production` and push
3. Dokploy listens to `production` branch for deployments

See `QUICK_REFERENCE.md` for detailed git workflow.

### Path Aliases

TypeScript is configured with `@/*` alias mapping to project root:

```typescript
import { prisma } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
```

### API Route Patterns

API routes follow RESTful conventions:

- `GET /api/market-data/orderbook?marketId=X&platform=Y` - Fetch orderbook
- `GET /api/insights/market-stats` - Get market statistics
- `POST /api/trades` - Execute trade (protected)
- `GET /api/layers/news` - Get map layer data (news events)

Authentication is enforced via middleware. API routes return JSON responses with proper error handling.

### State Management

- **Zustand** for client-side state (`lib/store/`)
- **SWR** for data fetching with caching
- **React Context** for theme and user preferences

### Styling Conventions

- Tailwind CSS utility classes
- CSS variables for theming (defined in `app/globals.css`)
- Dark mode via `class` strategy (Tailwind config)
- Radix UI components in `components/ui/` (shadcn/ui based)

## Common Development Tasks

### Adding a New Broker Integration

1. Create new API client in `lib/api/<broker-name>.ts`
2. Implement common methods: `fetchMarkets()`, `placeOrder()`, `authenticate()`
3. Add broker enum to `types/index.ts`
4. Update `lib/api/market-aggregator.ts` to include new broker
5. Add API key model support in Prisma schema if needed
6. Create UI for API key configuration in `app/dashboard/settings/page.tsx`

### Adding a New Map Data Layer

1. Create data fetcher in `lib/data/<layer-name>.ts` or `lib/api/<source>.ts`
2. Create API route in `app/api/layers/<layer-name>/route.ts`
3. Add layer toggle in map component (`components/map/`)
4. Implement visualization logic (markers, polygons, etc.)

### Running Database Migrations

When modifying `prisma/schema.prisma`:

```bash
# Generate migration
npx prisma migrate dev --name descriptive_name

# Apply migration (if already created)
npx prisma migrate deploy
```

For rapid prototyping without migrations:

```bash
npx prisma db push
```

### Testing API Clients

Utility scripts in `scripts/` directory:

```bash
# Test Polymarket/Kalshi API connectivity
node scripts/test-api-clients.js

# Test database connection
node scripts/test-database-connection.js
```

## Security Considerations

- **API Key Encryption**: User API keys are encrypted with AES-256-GCM before storage
- **Rate Limiting**: Implemented in middleware (configurable limits per IP)
- **Bot Detection**: Anti-scraping middleware blocks suspicious user agents
- **Audit Logging**: All sensitive actions logged to `AuditLog` table
- **Security Headers**: CSP, HSTS, X-Frame-Options set via middleware
- **Input Validation**: Use Zod schemas for API request validation

Never commit sensitive credentials. Use environment variables for all secrets.

## Troubleshooting

### Database Connection Issues

```bash
# Restart Docker container
docker-compose down && docker-compose up -d

# Reset database
npm run dev:reset
```

### Prisma Client Issues

```bash
# Regenerate Prisma client
npx prisma generate

# Clear Next.js cache
rm -rf .next
```

### Build Errors

If build fails with module resolution errors:
1. Ensure `npx prisma generate` has been run
2. Check that all dependencies are installed (`npm install`)
3. Verify Node.js version is >= 20 (see `engines` in `package.json`)

### OAuth Issues (Local Development)

Ensure OAuth redirect URLs are configured:
- **Google**: Add `http://localhost:3000/api/auth/callback/google`
- **GitHub**: Add `http://localhost:3000/api/auth/callback/github`

## Performance Notes

- Market data is cached using `MarketCache` table with TTL
- SWR provides client-side caching and revalidation
- Next.js image optimization configured for external market images
- Use `npm run build` to verify production bundle size

## Project-Specific Patterns

### Market ID Format

Markets are uniquely identified by `<platform>-<externalId>`:
- Polymarket: `polymarket-123456`
- Kalshi: `kalshi-MARKETID`

### Geolocation Extraction

NLP-based location extraction from market titles:
- Uses `compromise` library for entity recognition
- Confidence levels: `high`, `medium`, `low`
- See `lib/location/extractor.ts`

### Price History Storage

Price snapshots stored in `MarketPriceHistory` with timestamps. Charts query this data with time-based filters.

---

**Key Files to Reference:**
- `prisma/schema.prisma` - Database schema
- `lib/api/market-aggregator.ts` - Multi-platform integration
- `middleware.ts` - Request handling pipeline
- `app/api/` - API route implementations
- `types/index.ts` - Shared TypeScript types
