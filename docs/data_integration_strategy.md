# Data Integration Strategy: Global Intelligence Terminal

## 1. News Layer: GDELT Project (Global Surveillance)
**Source:** GDELT (Global Database of Events, Language, and Tone)
**Implementation:**
- Use the **GDELT 2.0 GeoJSON API** (`https://api.gdeltproject.org/api/v2/geo/geo`).
- **Data Points:** Location, Tone (Sentiment), Source URL, Image URL.
- **Update Frequency:** Every 15 minutes.
- **Transformation:** Map GDELT feature properties to our internal `NewsEvent` schema.

## 2. Financial Layer: Multi-Source Aggregation
### A. Live Market Data (Equities/Futures)
**Source:** **Alpaca Markets** (User requested "Alpaca PY", will implement via **Alpaca Node SDK** or REST for direct Next.js integration to maintain single stack).
- **Data:** Real-time quotes for SPY, QQQ, GLD, USO (representing sectors).
- **Requirement:** User needs to provide `ALPACA_KEY_ID` and `ALPACA_SECRET_KEY`.

### B. Macroeconomic Context
**Source:** **Federal Reserve Economic Data (FRED)**
- **Data:** Interest Rates (FEDFUNDS), Inflation (CPI), Unemployment, GDP.
- **Implementation:** REST API fetch on server-side.
- **Requirement:** `FRED_API_KEY` (Free).

### C. Global Development
**Source:** **World Bank Data API**
- **Data:** Global indicators overlaid on specific countries (e.g., GDP Growth, Poverty Rates).
- **Implementation:** Direct fetch, cached daily.

### D. Corporate Intelligence
**Source:** **SEC EDGAR API**
- **Data:** Recent 8-K (Significant Events) filings mapped to Headquarters location.
- **Implementation:** RSS Feed parser or direct API query.

## 3. Alternative Data Layers (Proposed)
To enhance the "Global Intelligence" feel, we will add:

### A. Environmental / Risk
**Source:** **USGS Earthquake Hazards**
- **Data:** Live seismic activity (Mag 2.5+).
- **Why:** Relevant for supply chain disruption warnings.

### B. Crypto / De-Fi
**Source:** **CoinGecko (Free API)**
- **Data:** Bitcoin/ETH prices and top gainers mapped to "Global Internet" nodes (or visualized as a network layer).

### C. Logistics (Flight/Marine)
**Source:** **OpenSky Network** (Flights)
- **Data:** Live aircraft positions (can filter for cargo/significant flights).
- **Note:** Free tier is limited; might start with a specific region or "Major Hubs" view.

## 4. Implementation Architecture
All integrations will use a **Server-Side Adapter Pattern**:

`app/api/layers/[type]/route.ts` -> `lib/services/[ServiceName].ts` -> `External API`

This ensures:
1.  API Keys are hidden (server-side).
2.  CORS issues are handled.
3.  Data is normalized to GeoJSON before reaching the frontend `EdgeMap`.
