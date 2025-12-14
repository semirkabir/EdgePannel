# Portfolio UI Integration Guide

## 🎯 How to Access Your Portfolio

The portfolio is now fully integrated into your EdgePanel UI! Here's how to access it:

### Step 1: Navigate from the Globe View

1. **Open EdgePanel** - Go to `/polyglobe` (this is your main dashboard)
2. **Click the Profile Icon** - Located in the top-right corner (User icon)
3. **Select "Portfolio"** - The first option in the dropdown menu (highlighted in blue with a Wallet icon 💼)

```
┌─────────────────────────────────────────────────┐
│  EdgePanel Globe View                    [👤]  │ <- Click here
│                                           ▼     │
│                                    ┌──────────┐ │
│                                    │💼 Portfolio│ <- Click this
│                                    │👤 Profile  │
│                                    │⚙️ Settings │
│                                    │────────────│
│                                    │🚪 Logout   │
│                                    └──────────┘ │
└─────────────────────────────────────────────────┘
```

### Step 2: Navigate Back to Globe

From any portfolio view, click the **"Back to Globe"** button in the top-left corner:

```
┌─────────────────────────────────────────────────┐
│  [← Back to Globe]  💼 Portfolio                │
│                                                  │
│  Your portfolio content here...                 │
└─────────────────────────────────────────────────┘
```

---

## 📊 Portfolio Features & Tabs

Once you're in the portfolio, you'll see **5 main tabs**:

### 1. 📁 Overview Tab

**What it shows:**
- Your complete portfolio across Kalshi and Polymarket
- Real-time position updates
- Total value, P&L, and exposure metrics
- Individual positions with entry/current prices
- Win rate and position count

**Components:**
- `PortfolioDashboard` - Main portfolio view with live WebSocket updates

**What you can do:**
- View all your positions in one place
- See real-time P&L updates
- Monitor total portfolio value
- Filter by platform (Kalshi/Polymarket/Combined)

---

### 2. 📈 Analytics Tab

**What it shows:**
- Historical portfolio performance charts
- P&L history and trends
- Daily/weekly/monthly performance
- Win/loss statistics
- Best/worst trading days

**Components:**
- `PortfolioChart` - Portfolio value over time with time range selector (24h, 7d, 30d, 90d, all)
- `PnLHistory` - Detailed P&L tracking with cumulative charts and daily breakdown

**What you can do:**
- Track portfolio performance over different time periods
- Analyze your trading patterns
- View cumulative P&L
- See your win rate and average win/loss
- Identify your best and worst trading days
- Calculate profit factor

**Data Source:**
- Fetches from Supabase `portfolio_snapshots` and `trade_history` tables
- Falls back to demo data if no history exists
- Shows "Live Data" or "Demo Data" badge

---

### 3. 🐋 Whale Tracker Tab

**What it shows:**
- Large position holders (top 10)
- Recent large trades over configurable threshold
- Real-time whale alerts
- Position concentration metrics

**Components:**
- `WhaleTracker` - Whale activity monitor with customizable thresholds

**What you can do:**
- Enter a Polymarket market ID to track
- Set minimum trade size (default $10,000)
- Set holder threshold percentage (default 5%)
- Receive real-time notifications for whale activity
- View top 10 holders with percentages
- See recent large trades

**How to use:**
1. Enter a market ID in the input field
2. Click "Track Market"
3. Or use demo examples: "BTC $100k Demo", "Elections Demo"
4. View whale alerts, top holders, and large trades in tabs

---

### 4. 📊 Market Depth Tab

**What it shows:**
- Live order book visualization
- Bid/ask depth charts
- Spread and imbalance metrics
- Order book levels with quantities

**Components:**
- `MarketDepth` - Real-time order book with depth visualization

**What you can do:**
- View order book for any ticker
- Select platform (Kalshi/Polymarket)
- See bid/ask spread percentage
- Monitor order book imbalance
- View depth chart
- Auto-refreshes every 5 seconds

**How to use:**
1. Enter a ticker symbol (e.g., `KXBTC-24DEC31-T100000`)
2. Select platform
3. Or use demo examples provided
4. View live order book updates

---

### 5. 📉 Trade Feed Tab

**What it shows:**
- Real-time market tape
- Recent trades with buy/sell indicators
- Trade statistics (volume, avg size, buy/sell ratio)
- Trade size distribution

**Components:**
- `TradeFeed` - Live market tape with analytics

**What you can do:**
- View last 100 trades
- See buy/sell volume ratio
- Monitor trade size distribution
- Pause/resume live updates
- Auto-scroll to latest trades

**Features:**
- Color-coded buy (green) / sell (red) indicators
- Total volume and trade count
- Average trade size
- Buy/sell volume bar
- Trade size histogram

---

## 🔧 Configuration & Setup

### Environment Variables Required

Make sure these are set in your `.env.local`:

```bash
# Supabase (for portfolio history)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Kalshi API (for positions and market data)
NEXT_PUBLIC_KALSHI_API_KEY_ID=your_key_id
KALSHI_PRIVATE_KEY=your_private_key

# Polymarket (for whale tracking)
NEXT_PUBLIC_POLYMARKET_API_KEY=your_api_key

# Demo/Test Accounts (optional)
NEXT_PUBLIC_DEMO_POLYMARKET_ADDRESS=0x1234...
```

### User Session Configuration

The portfolio page currently uses demo credentials. To personalize:

**Edit** `app/dashboard/portfolio/page.tsx`:

```tsx
// Current (Demo):
const userId = 'demo-user-123'
const polymarketAddress = process.env.NEXT_PUBLIC_DEMO_POLYMARKET_ADDRESS || ''

// Replace with real user session:
import { useSession } from 'next-auth/react'

export default function PortfolioPage() {
  const { data: session } = useSession()
  const userId = session?.user?.id || ''
  const polymarketAddress = session?.user?.polymarketAddress || ''
  // ...
}
```

---

## 📱 UI Layout & Design

### Header
- **Sticky top bar** with gradient background
- **Back to Globe** button (top-left)
- **Portfolio title** with icon
- **Quick stats** showing Total Value and 24h P&L

### Tab Navigation
- **5 tabs** with icons and labels
- **Blue highlight** for active tab
- **Responsive grid** layout

### Color Scheme
- **Background:** Dark gradient (gray-950 to gray-900)
- **Cards:** Semi-transparent dark (gray-900/50)
- **Borders:** White with 10% opacity
- **Accents:** Blue for actions, Green for gains, Red for losses
- **Text:** White for headings, Gray for secondary

### Responsive Design
- **Desktop:** Full tab layout with side-by-side components
- **Mobile:** Stacked layout with scrollable tabs

---

## 🚀 Quick Start Checklist

1. ✅ **Start your dev server**
   ```bash
   npm run dev
   ```

2. ✅ **Navigate to the globe**
   - Go to `http://localhost:3000/polyglobe`

3. ✅ **Access portfolio**
   - Click Profile icon (top-right)
   - Select "Portfolio"

4. ✅ **Explore features**
   - Overview: See your positions
   - Analytics: View performance charts
   - Whale Tracker: Monitor large trades
   - Market Depth: Check order books
   - Trade Feed: Watch live trades

5. ✅ **Test with demo data**
   - Use example tickers/markets provided
   - Or set `useMockData={true}` in PortfolioChart

---

## 🎨 Visual Flow

```
┌────────────────────────────────────────────────────┐
│                  POLYGLOBE (Main)                  │
│                                                     │
│  [Globe View with Markets]                         │
│                                                     │
│  Click Profile Icon → Select Portfolio             │
└──────────────────┬─────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────┐
│              PORTFOLIO PAGE                        │
│  ┌──────────────────────────────────────────────┐ │
│  │ [← Back] 💼 Portfolio      $10,234  +$145   │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │ [Overview] [Analytics] [Whales] [Depth] [Feed]│ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  Your Portfolio Content (Active Tab)         │ │
│  │  - Positions, Charts, Whale Alerts, etc.     │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## 🔄 Real-time Updates

### WebSocket Connections

The portfolio automatically connects to real-time data sources:

1. **Kalshi WebSocket** - For position updates and fills
   - Channels: `fill`, `market_positions`, `ticker`, `orderbook_delta`
   - Auto-reconnects on disconnect

2. **Polymarket User WebSocket** - For order updates
   - Events: `MATCHED`, `CONFIRMED`, `FAILED`
   - Authenticated with API key

3. **Notifications** - Browser push + toast
   - Whale trade alerts
   - Order fill notifications
   - Position updates

### Refresh Intervals

- **Portfolio positions:** 30 seconds (configurable)
- **Whale data:** 10 seconds
- **Market depth:** 5 seconds
- **Trade feed:** 3 seconds
- **Charts:** 1 minute

---

## 🐛 Troubleshooting

### Portfolio shows "Loading..."
- Check that API credentials are set in environment variables
- Verify Supabase connection
- Check browser console for errors

### "No data" in Analytics
- Portfolio history requires saved snapshots
- Set `useMockData={true}` to see demo data
- Use `usePortfolioSnapshot` hook to save snapshots

### Whale tracker not working
- Ensure you enter a valid Polymarket market ID
- Check that Polymarket API key is configured
- Try the demo market IDs first

### Market depth shows error
- Verify ticker symbol is correct for the platform
- Check API rate limits
- Ensure platform is selected correctly

---

## 📚 Related Documentation

- **Complete API Reference:** [NEW_API_FEATURES.md](./NEW_API_FEATURES.md)
- **Implementation Guide:** [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- **Usage Examples:** [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)
- **Completion Summary:** [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)

---

## 🎉 You're All Set!

Your portfolio is now fully integrated and accessible from the main globe view. Click the profile icon and select "Portfolio" to start tracking your positions, analyzing performance, and monitoring whale activity!

**Route:** `/dashboard/portfolio`

**Access:** Globe View → Profile Menu → Portfolio

**Features:** 5 tabs with real-time data, analytics, whale tracking, market depth, and trade feed

Enjoy your new portfolio dashboard! 🚀
