# Polyglobe Polymarket Data Implementation Plan

## Executive Summary

This document outlines how [pizzint.watch/polyglobe](https://www.pizzint.watch/polyglobe) implements Polymarket data visualization on an interactive map, and provides a comprehensive plan to replicate this functionality in our project.

## Reference Site Analysis

### Technology Stack (pizzint.watch/polyglobe)

1. **Map Library**: MapLibre GL (via `react-map-gl/maplibre`)
2. **Map Tiles**: Protomaps (dark theme)
3. **Data Format**: GeoJSON FeatureCollection
4. **Data Source**: Polymarket markets with location inference
5. **Real-time Updates**: WebSocket or polling for live price updates
6. **UI Components**:
   - Market markers as circles on map
   - Popups on hover/click
   - Market cards in bottom-right corner
   - Search functionality
   - Filter toggles (Breaking, OSINT, Live, Fires, Frontline)

### Key Implementation Details

#### 1. Data Fetching
- **Source**: Polymarket CLOB API (`https://clob.polymarket.com/markets`)
- **Alternative**: Polymarket GraphQL Subgraph (`https://api.thegraph.com/subgraphs/name/polymarket/polymarket`)
- **Method**: Public API (no authentication required for market data)
- **Format**: JSON array of market objects

#### 2. Location Extraction
The reference site likely uses one or more of these approaches:

**A. Keyword-based Location Inference** (Most Likely)
- Parse market titles/descriptions for location keywords
- Match against a curated list of locations (cities, countries, regions)
- Use predefined coordinates for matched locations
- **Example**: "Xi Jinping out in 2025?" → matches "China" → Beijing coordinates

**B. Named Entity Recognition (NER)**
- Use NLP libraries to extract location entities
- Geocode extracted locations via APIs (Google Geocoding, Nominatim, etc.)
- More accurate but requires API calls

**C. Market Metadata**
- Some markets may have location tags/categories
- Check if Polymarket API provides location metadata

#### 3. GeoJSON Feature Structure

Each market is converted to a GeoJSON Point feature:

```typescript
{
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [longitude, latitude]  // Note: [lng, lat] order
  },
  properties: {
    id: string,
    market_id: string,
    title: string,
    slug: string,
    url: string,
    last_price: number,  // 0-1 probability
    volume: number,      // 24h volume
    image_url: string | null,
    is_open: boolean,
    description: string,
    price_movement: number  // Price change indicator
  }
}
```

#### 4. Map Rendering

**Layer Configuration**:
- **Type**: Circle layer
- **Radius**: Zoom-dependent (3px at zoom 0, 10px at zoom 10)
- **Color**: Based on price movement (blue for up, red for down)
- **Opacity**: 0.8
- **Stroke**: White border, 1px width

**Styling**:
```javascript
{
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['zoom'],
    0, 3,
    5, 6,
    10, 10
  ],
  'circle-color': [
    'case',
    ['>', ['get', 'price_movement'], 0], '#3b82f6',  // Blue for up
    ['<', ['get', 'price_movement'], 0], '#ef4444',  // Red for down
    '#3b82f6'  // Default blue
  ],
  'circle-opacity': 0.8,
  'circle-stroke-width': 1,
  'circle-stroke-color': '#ffffff'
}
```

#### 5. Market Cards Display

- **Position**: right corner
- **Layout**: Stacked cards (newest on top)
- **Content**:
  - Market title
  - Current price (in cents, e.g., "0.6¢")
  - Volume indicator
  - Action buttons (SELL Yes, BUY Yes)
  - Link to Polymarket

#### 6. Real-time Updates

- **Method**: WebSocket connection or polling
- **Frequency**: Every few seconds for price updates
- **Update Strategy**: Merge new prices into existing GeoJSON features
- **Visual Feedback**: Animate price changes, highlight updated markets

## Current Project Status

### ✅ Already Implemented

1. **Map Infrastructure**:
   - MapLibre GL integration (`react-map-gl/maplibre`)
   - Globe and Mercator projections
   - GeoJSON source/layer support
   - Popup components

2. **Data Fetching**:
   - Polymarket CLOB API client (`lib/api/polymarket.ts`)
   - Market aggregator (`lib/api/market-aggregator.ts`)
   - API routes (`app/api/markets/all/route.ts`)

3. **Location Inference**:
   - Keyword-based location matching (`lib/markets/enrich.ts`)
   - Location coordinates database (`lib/locations.ts`)
   - Location extraction from market titles/descriptions

4. **Data Transformation**:
   - Market enrichment pipeline
   - GeoJSON feature creation (`hooks/use-polyglobe-data.ts`)
   - WebSocket support for live updates

5. **UI Components**:
   - PolyglobeMap component
   - Filter controls
   - Search functionality
   - Market popups

### 🔄 Needs Enhancement

1. **Location Extraction**:
   - Expand location database
   - Improve keyword matching (fuzzy matching, synonyms)
   - Add geocoding fallback for unmatched locations
   - Consider NER for better accuracy

2. **Market Display**:
   - Add market cards in bottom-right corner
   - Improve popup styling to match reference
   - Add price movement indicators
   - Better visual hierarchy

3. **Real-time Updates**:
   - Optimize WebSocket connection
   - Add price change animations
   - Visual indicators for updated markets

4. **Data Quality**:
   - Filter markets without valid locations
   - Handle edge cases (markets with multiple locations)
   - Improve location accuracy

## Implementation Plan

### Phase 1: Enhanced Location Extraction

#### 1.1 Expand Location Database

**File**: `lib/locations.ts`

**Actions**:
- Add more cities, regions, and countries
- Add common location aliases (e.g., "US" → "United States")
- Add geopolitical regions (e.g., "Middle East", "Balkans")
- Add conflict zones and hotspots

**Example Additions**:
```typescript
'persian gulf': { lat: 27.0, lng: 51.0 },
'red sea': { lat: 20.0, lng: 38.0 },
'black sea': { lat: 43.0, lng: 34.0 },
'eastern ukraine': { lat: 48.0, lng: 37.0 },
'gaza strip': { lat: 31.5, lng: 34.5 },
```

#### 1.2 Improve Location Matching

**File**: `lib/markets/enrich.ts`

**Enhancements**:
- Case-insensitive matching
- Partial word matching (e.g., "Ukrainian" → "Ukraine")
- Multi-word location matching
- Priority system (cities before countries)
- Fuzzy matching for typos

**Implementation**:
```typescript
function inferLocation(market: Market): LocationInfo | undefined {
  const searchText = `${market.title} ${market.description || ''}`.toLowerCase()
  
  // Priority 1: Exact city matches
  // Priority 2: Region matches
  // Priority 3: Country matches
  // Priority 4: Fuzzy matches
  
  // Return best match with highest priority
}
```

#### 1.3 Add Geocoding Fallback

**New File**: `lib/markets/geocoding.ts`

**Purpose**: Use external geocoding API when keyword matching fails

**Options**:
- **Nominatim** (OpenStreetMap, free, no API key)
- **Google Geocoding API** (requires API key, more accurate)
- **Mapbox Geocoding** (requires API key)

**Implementation**:
```typescript
async function geocodeLocation(locationName: string): Promise<Coordinates | null> {
  // Try Nominatim first (free)
  // Fallback to other services if needed
  // Cache results to avoid repeated API calls
}
```

### Phase 2: Market Card Display

#### 2.1 Create Market Card Component

**New File**: `components/polyglobe/MarketCard.tsx`

**Features**:
- Compact card design
- Market title (truncated if long)
- Current price display (in cents)
- Volume indicator
- Price change indicator
- Action buttons (if trading enabled)
- Link to Polymarket

**Styling**:
- Dark theme with glassmorphism
- Border color based on price movement
- Hover effects
- Smooth animations

#### 2.2 Market Card Container

**New File**: `components/polyglobe/MarketCardStack.tsx`

**Features**:
- Stacked layout (newest on top)
- Scrollable container
- Auto-dismiss after time
- Click to focus on map
- Filter integration

**Position**: Bottom-right corner, above map controls

#### 2.3 Integration with Map

**File**: `components/polyglobe/PolyglobeMap.tsx`

**Changes**:
- Add MarketCardStack component
- Sync selected market between map and cards
- Highlight market on map when card is clicked

### Phase 3: Enhanced Visual Design

#### 3.1 Improve Market Markers

**File**: `components/polyglobe/PolyglobeMap.tsx`

**Enhancements**:
- Size based on volume (larger = more volume)
- Color intensity based on price movement
- Pulsing animation for breaking news
- Different styles for different categories

**Layer Updates**:
```typescript
const marketLayer = {
  'circle-radius': [
    'interpolate',
    ['linear'],
    ['get', 'volume'],  // Size by volume
    0, 4,
    10000, 12
  ],
  'circle-color': [
    'interpolate',
    ['linear'],
    ['get', 'price_movement'],
    -0.1, '#ef4444',  // Red for down
    0, '#3b82f6',     // Blue for neutral
    0.1, '#10b981'    // Green for up
  ]
}
```

#### 3.2 Enhanced Popups

**File**: `components/polyglobe/PolyglobeMap.tsx`

**Improvements**:
- Better typography
- Price chart (mini sparkline)
- Volume trend indicator
- Category badge
- Action buttons
- Share functionality

#### 3.3 Market Card Styling

**Design Elements**:
- Glassmorphism effect (backdrop blur)
- Colored left border (price movement indicator)
- Monospace font for prices
- Icon indicators (breaking, live, etc.)
- Smooth transitions

### Phase 4: Real-time Updates Optimization

#### 4.1 WebSocket Connection

**File**: `hooks/use-market-websocket.ts`

**Optimizations**:
- Batch updates (update multiple markets at once)
- Debounce rapid updates
- Connection retry logic
- Error handling and fallback to polling

#### 4.2 Price Change Animations

**New File**: `components/polyglobe/PriceChangeIndicator.tsx`

**Features**:
- Flash animation on price change
- Color transition (red → blue → green)
- Number animation (count up/down)
- Sound effect (optional)

#### 4.3 Update Strategy

**Implementation**:
1. Receive WebSocket update
2. Find matching market in GeoJSON features
3. Calculate price movement
4. Update feature properties
5. Trigger re-render with animation
6. Update market cards if visible

### Phase 5: Data Quality Improvements

#### 5.1 Market Filtering

**File**: `hooks/use-polyglobe-data.ts`

**Filters**:
- Only show markets with valid locations
- Filter by minimum volume (optional)
- Filter by category (optional)
- Filter by date (only recent markets)

#### 5.2 Location Validation

**New File**: `lib/markets/location-validator.ts`

**Checks**:
- Coordinates are valid (lat: -90 to 90, lng: -180 to 180)
- Location is on land (optional, requires reverse geocoding)
- Location matches market context (e.g., Ukraine market → Ukraine location)

#### 5.3 Duplicate Handling

**Logic**:
- Group markets by location
- If multiple markets at same location, show aggregated marker
- On click, show list of markets at that location

## Technical Implementation Details

### Data Flow

```
Polymarket API
    ↓
PolymarketClient.getMarkets()
    ↓
Market Aggregator
    ↓
Enrich Markets (add location, category)
    ↓
Convert to GeoJSON Features
    ↓
usePolyglobeData Hook
    ↓
PolyglobeMap Component
    ↓
MapLibre GL Rendering
```

### Key Files to Modify

1. **`lib/locations.ts`**: Expand location database
2. **`lib/markets/enrich.ts`**: Improve location inference
3. **`hooks/use-polyglobe-data.ts`**: Enhance GeoJSON feature creation
4. **`components/polyglobe/PolyglobeMap.tsx`**: Update map styling and add cards
5. **`components/polyglobe/MarketCard.tsx`**: New component
6. **`components/polyglobe/MarketCardStack.tsx`**: New component

### New Dependencies (if needed)

```json
{
  "dependencies": {
    "fuse.js": "^7.0.0",  // For fuzzy location matching
    "geolib": "^3.3.4"    // For coordinate calculations
  }
}
```

## Testing Strategy

### Unit Tests

1. **Location Inference**:
   - Test keyword matching
   - Test fuzzy matching
   - Test priority system
   - Test edge cases

2. **GeoJSON Conversion**:
   - Test feature structure
   - Test coordinate order
   - Test property mapping

3. **Market Filtering**:
   - Test location validation
   - Test volume filtering
   - Test category filtering

### Integration Tests

1. **Map Rendering**:
   - Test marker placement
   - Test popup display
   - Test interaction events

2. **Real-time Updates**:
   - Test WebSocket connection
   - Test price updates
   - Test animation triggers

### Manual Testing

1. **Visual Verification**:
   - Compare with reference site
   - Test on different screen sizes
   - Test with different data sets

2. **Performance**:
   - Test with 100+ markets
   - Test with rapid updates
   - Test map interactions

## Success Criteria

1. ✅ Markets display on map at correct locations
2. ✅ Market cards appear in bottom-right corner
3. ✅ Real-time price updates work smoothly
4. ✅ Location inference accuracy > 80%
5. ✅ Map performance is smooth with 100+ markets
6. ✅ Visual design matches reference site quality
7. ✅ All interactions work correctly

## Timeline Estimate

- **Phase 1** (Location Extraction): 2-3 days
- **Phase 2** (Market Cards): 2-3 days
- **Phase 3** (Visual Design): 2-3 days
- **Phase 4** (Real-time Updates): 1-2 days
- **Phase 5** (Data Quality): 1-2 days

**Total**: ~8-13 days

## Next Steps

1. Review and approve this plan
2. Prioritize phases based on requirements
3. Start with Phase 1 (Location Extraction) as foundation
4. Iterate based on feedback and testing

## References

- [Polymarket CLOB API](https://clob.polymarket.com)
- [Polymarket GraphQL Subgraph](https://api.thegraph.com/subgraphs/name/polymarket/polymarket)
- [MapLibre GL Documentation](https://maplibre.org/maplibre-gl-js-docs/)
- [React Map GL Documentation](https://visgl.github.io/react-map-gl/)
- [GeoJSON Specification](https://geojson.org/)
