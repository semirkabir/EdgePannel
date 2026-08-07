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
  { name: 'Reuters World', category: 'wire', cadence: '5m' },
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

  // --- Second pass: more real names so the multi-row belt never repeats
  // itself on a wide screen. Cadences match the category peers above.
  { name: 'Guardian World', category: 'wire', cadence: '5m' },
  { name: 'DW News', category: 'wire', cadence: '10m' },
  { name: 'France 24', category: 'wire', cadence: '10m' },
  { name: 'Tagesschau', category: 'wire', cadence: '10m' },
  { name: 'South China Morning Post', category: 'wire', cadence: '10m' },
  { name: 'The Hindu', category: 'wire', cadence: '10m' },
  { name: 'Yonhap News', category: 'wire', cadence: '10m' },
  { name: 'Premium Times', category: 'wire', cadence: '10m' },

  { name: 'CISA', category: 'official', cadence: '30m' },
  { name: 'UK MOD', category: 'official', cadence: '30m' },
  { name: 'Council EU Press', category: 'official', cadence: '30m' },
  { name: 'WTO Latest News', category: 'official', cadence: '1h' },
  { name: 'OFAC Recent Actions', category: 'official', cadence: '1h' },

  { name: 'Carbon Brief', category: 'hazards', cadence: '1h' },
  { name: 'Global Forest Watch', category: 'hazards', cadence: '1h' },
  { name: 'Weather Alerts', category: 'hazards', cadence: '30m' },

  { name: 'CNBC', category: 'markets', cadence: '5m' },
  { name: 'MarketWatch', category: 'markets', cadence: '5m' },
  { name: 'SEC 13F Filings', category: 'markets', cadence: '1h' },
  { name: 'BIS Press Releases', category: 'markets', cadence: '1h' },

  { name: 'ISW', category: 'military', cadence: '1h' },
  { name: 'Janes', category: 'military', cadence: '1h' },
  { name: 'Breaking Defense', category: 'military', cadence: '30m' },
  { name: 'The War Zone', category: 'military', cadence: '30m' },
  { name: 'SIPRI', category: 'military', cadence: '1d' },

  { name: 'BleepingComputer', category: 'infra', cadence: '30m' },
  { name: 'Ransomware.live', category: 'infra', cadence: '30m' },
  { name: 'SANS ISC', category: 'infra', cadence: '30m' },
  { name: 'AWS Status', category: 'infra', cadence: '10m' },
  { name: 'AI Data Centers', category: 'infra', cadence: '1d' },

  { name: 'Bellingcat', category: 'osint', cadence: '1h' },
  { name: 'OCCRP', category: 'osint', cadence: '1h' },
  { name: 'DFRLab', category: 'osint', cadence: '1h' },
  { name: 'GPS Jamming', category: 'osint', cadence: '30m' },
  { name: 'Nav Warnings', category: 'osint', cadence: '1h' },
];

/**
 * How many belt rows the landing page renders. The feeds are dealt out
 * round-robin, so every row mixes categories instead of showing one block.
 */
export const TICKER_ROW_COUNT = 5;

/** Deal TICKER_FEEDS into `TICKER_ROW_COUNT` interleaved rows. */
export function tickerRows(): TickerFeed[][] {
  const rows: TickerFeed[][] = Array.from({ length: TICKER_ROW_COUNT }, () => []);
  TICKER_FEEDS.forEach((feed, i) => {
    (rows[i % TICKER_ROW_COUNT] as TickerFeed[]).push(feed);
  });
  return rows;
}
