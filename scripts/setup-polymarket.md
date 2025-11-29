# Polymarket API Setup Guide

## Current Status

The application currently uses Polymarket's **public GraphQL Subgraph** for reading market data, which doesn't require authentication.

## For Market Data (Reading) - No Setup Needed ✅

The app can read Polymarket markets without any API key. This uses:
- **GraphQL Subgraph**: `https://api.thegraph.com/subgraphs/name/polymarket/polymarket`

## For Trading (Writing) - Requires API Access

To enable trading on Polymarket, you need official API access:

### Option 1: Official Polymarket API (If Available)
1. Contact Polymarket support
2. Request API access for trading
3. They may provide:
   - API key
   - Authentication token
   - Or other authentication method

### Option 2: Using CLOB API
Polymarket uses a CLOB (Central Limit Order Book) API for trading:
- Base URL: `https://clob.polymarket.com`
- Requires authentication (varies by implementation)

### How to Add API Key (When Available)

1. **In .env file** (for server-side proxy, if needed):
   ```env
   POLYMARKET_API_KEY=your_api_key_here
   ```

2. **In Application Settings** (for user-specific keys):
   - Log in to the app
   - Go to **Settings**
   - Enter your Polymarket API key
   - Click **"Save Polymarket API Key"**

## Current Implementation

The app will:
- ✅ **Read markets** from Polymarket (no API key needed)
- ✅ **Display markets** on the map
- ✅ **Show market details** and prices
- ⚠️ **Trading** requires official API access (contact Polymarket)

## Polymarket Resources

- **Documentation**: https://docs.polymarket.com
- **Subgraph Explorer**: https://thegraph.com/hosted-service/subgraph/polymarket/polymarket
- **Support**: Contact Polymarket for API access

## Note

Since Polymarket's official trading API may require special access, the application is designed to work with market data reading out of the box. Trading functionality will be available once you have official API credentials.

