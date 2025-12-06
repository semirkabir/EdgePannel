# Prediction Markets Map Platform

A Next.js application featuring an interactive world map that displays prediction markets from Polymarket and Kalshi, with real-time data visualization, market comparison, and integrated trading capabilities.

## Features

- **Interactive 3D World Map**: Navigate a dark, futuristic globe showing prediction markets at their geographic locations
- **Multi-Platform Support**: Integrates with both Polymarket and Kalshi prediction markets
- **Market Comparison**: Automatically identifies similar markets across platforms and highlights price discrepancies
- **Trading Interface**: Buy and sell directly on both platforms through the unified interface
- **Real-time Data**: Live market data with price history charts
- **User Authentication**: Secure login with email/password and OAuth (Google, GitHub)

## Tech Stack

- **Frontend**: Next.js 14 (App Router) with TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: NextAuth.js
- **Map Visualization**: react-globe.gl
- **Charts**: Recharts

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

## API Integration

### Kalshi API
- Uses RSA-PSS signature authentication
- Requires Access Key ID and Private Key per user
- Supports WebSocket for real-time updates (to be implemented)

### Polymarket API
- Uses API key authentication
- Accesses market data via GraphQL Subgraph
- Trading via CLOB API

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


