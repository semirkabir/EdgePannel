/**
 * Static sample of real sources for the landing-page feed ticker.
 * Names must exist in src/config/feeds.ts or map-layer-definitions.ts — this
 * strip is a truthful shop window, not marketing copy. Cadence strings are
 * the app's actual refresh intervals, rounded to friendly units.
 */

export type TickerCategory =
  | 'wire'
  | 'official'
  | 'hazards'
  | 'markets'
  | 'military'
  | 'infra'
  | 'osint';

export interface TickerFeed {
  name: string;
  category: TickerCategory;
  cadence: string;
}

/** Category → label shown under the feed name. */
export const TICKER_CATEGORY_LABELS: Record<TickerCategory, string> = {
  wire: 'Wires & press',
  official: 'Official & intl. orgs',
  hazards: 'Hazards & climate',
  markets: 'Markets & macro',
  military: 'Military & conflict',
  infra: 'Infrastructure & cyber',
  osint: 'OSINT & tracking',
};

export const TICKER_FEEDS: TickerFeed[] = [
  // Wire services & major outlets
  { name: 'Reuters', category: 'wire', cadence: '5m' },
  { name: 'AP News', category: 'wire', cadence: '5m' },
  { name: 'AFP', category: 'wire', cadence: '5m' },
  { name: 'Bloomberg', category: 'wire', cadence: '5m' },
  { name: 'BBC World', category: 'wire', cadence: '5m' },
  { name: 'Al Jazeera', category: 'wire', cadence: '5m' },
  { name: 'Financial Times', category: 'wire', cadence: '10m' },
  { name: 'Der Spiegel', category: 'wire', cadence: '10m' },
  { name: 'Le Monde', category: 'wire', cadence: '10m' },
  { name: 'Nikkei Asia', category: 'wire', cadence: '10m' },
  { name: 'Kyiv Independent', category: 'wire', cadence: '10m' },
  { name: 'Meduza', category: 'wire', cadence: '10m' },

  // Official & international organisations
  { name: 'White House', category: 'official', cadence: '15m' },
  { name: 'Pentagon', category: 'official', cadence: '15m' },
  { name: 'State Dept', category: 'official', cadence: '15m' },
  { name: 'UN News', category: 'official', cadence: '30m' },
  { name: 'IAEA', category: 'official', cadence: '30m' },
  { name: 'WHO', category: 'official', cadence: '30m' },
  { name: 'UNHCR', category: 'official', cadence: '1h' },
  { name: 'ECB Press', category: 'official', cadence: '30m' },
  { name: 'NATO News', category: 'official', cadence: '30m' },
  { name: 'Federal Reserve', category: 'official', cadence: '30m' },

  // Hazards & climate
  { name: 'USGS Earthquakes', category: 'hazards', cadence: '5m' },
  { name: 'GDACS Alerts', category: 'hazards', cadence: '15m' },
  { name: 'NHC Hurricanes', category: 'hazards', cadence: '15m' },
  { name: 'NASA FIRMS Fires', category: 'hazards', cadence: '15m' },
  { name: 'Tsunami Warnings', category: 'hazards', cadence: '5m' },
  { name: 'Volcano Activity', category: 'hazards', cadence: '30m' },
  { name: 'Severe Weather', category: 'hazards', cadence: '10m' },
  { name: 'Space Weather', category: 'hazards', cadence: '30m' },

  // Markets & macro
  { name: 'Live Indices', category: 'markets', cadence: '1m' },
  { name: 'Commodities', category: 'markets', cadence: '1m' },
  { name: 'Crypto', category: 'markets', cadence: '1m' },
  { name: 'Forex', category: 'markets', cadence: '5m' },
  { name: 'FRED Macro', category: 'markets', cadence: '1h' },
  { name: 'World Bank Data', category: 'markets', cadence: '1d' },
  { name: 'EIA Energy', category: 'markets', cadence: '1h' },
  { name: 'Polymarket Odds', category: 'markets', cadence: '5m' },

  // Military & conflict
  { name: 'OpenSky Military Air', category: 'military', cadence: '3m' },
  { name: 'Conflict Events', category: 'military', cadence: '30m' },
  { name: 'USNI Fleet Tracker', category: 'military', cadence: '1d' },
  { name: 'Missile Tests', category: 'military', cadence: '30m' },
  { name: 'Oryx OSINT', category: 'military', cadence: '1h' },
  { name: 'Defense Procurement', category: 'military', cadence: '1h' },
  { name: 'CSIS Missile Threat', category: 'military', cadence: '1h' },

  // Infrastructure & cyber
  { name: 'CISA Advisories', category: 'infra', cadence: '30m' },
  { name: 'Cloudflare Radar', category: 'infra', cadence: '15m' },
  { name: 'Internet Outages', category: 'infra', cadence: '10m' },
  { name: 'Submarine Cables', category: 'infra', cadence: '1d' },
  { name: 'Power Grid Status', category: 'infra', cadence: '15m' },
  { name: 'Pipeline Network', category: 'infra', cadence: '1d' },
  { name: 'Port Congestion', category: 'infra', cadence: '1h' },

  // OSINT & tracking
  { name: 'AIS Vessel Streams', category: 'osint', cadence: '5m' },
  { name: 'ADS-B Flights', category: 'osint', cadence: '3m' },
  { name: 'Satellite Passes', category: 'osint', cadence: '1h' },
  { name: 'Rocket Launches', category: 'osint', cadence: '1h' },
  { name: 'Live Webcams', category: 'osint', cadence: 'live' },
  { name: 'Wikipedia Trending', category: 'osint', cadence: '1h' },
  { name: 'Travel Advisories', category: 'osint', cadence: '6h' },
];
