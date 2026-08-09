/**
 * Pure data + formatting helpers for the data-source status panel.
 *
 * Extracted from EventHandlerManager to keep event-handlers.ts within its
 * size budget and to keep this presentation logic independently testable.
 */

import type { DataSourceId, DataSourceState } from '@/services/data-freshness';

/** Source ids delivered over a live WebSocket connection. */
export const WS_SOURCES = new Set(['ais', 'opensky', 'wingbits', 'polymarket', 'predictions']);

/** Source ids delivered via RSS / feed polling. */
export const RSS_SOURCES = new Set(['rss', 'gdelt_doc', 'pizzint', 'outages', 'cyber_threats', 'gpsjam', 'webcams', 'security_advisories']);

/** Maps a freshness status to the dropdown dot/badge severity class. */
export function getSourceDotClass(status: string, isWs: boolean): string {
  if (isWs) return 'live';
  if (status === 'error' || status === 'no_data') return 'error';
  if (status === 'very_stale') return 'error';
  if (status === 'stale') return 'stale';
  if (status === 'fresh') return 'fresh';
  return 'stale';
}

/** Human-readable relative age, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Badge label for a source row: LIVE / ERROR / NO DATA / relative age. */
export function getSourceLabel(
  source: { status: string; lastUpdate: Date | null; lastError: string | null },
  isWs: boolean,
): string {
  if (isWs) return 'LIVE';
  if (source.status === 'error') return 'ERROR';
  if (source.status === 'no_data' || !source.lastUpdate) return 'NO DATA';
  return timeAgo(source.lastUpdate);
}

// ─── Source catalog ─────────────────────────────────────────────────────────

export interface SourceCatalogEntry {
  /** Display category the feed is grouped under. */
  category: string;
  /** Upstream data provider / publisher. */
  provider: string;
  /** Provider homepage, for the row's external-link affordance. */
  url?: string;
}

/** Display order for catalog categories. Unlisted categories sort last. */
export const SOURCE_CATEGORY_ORDER = [
  'Financial Markets',
  'Prediction Markets',
  'Economy & Trade',
  'Energy',
  'News & Intelligence',
  'Conflict & Security',
  'Cyber',
  'Aviation',
  'Maritime',
  'Natural Hazards',
  'Climate & Environment',
  'Humanitarian & Health',
  'Infrastructure',
  'Reference',
] as const;

/**
 * Provider + category metadata for each tracked source.
 *
 * Provider names reflect the actual upstream publisher the app fetches from.
 * Sources absent from this map fall back to an "Other" grouping.
 */
export const SOURCE_CATALOG: Partial<Record<DataSourceId, SourceCatalogEntry>> = {
  // Financial Markets
  defillama:         { category: 'Financial Markets', provider: 'DefiLlama', url: 'https://defillama.com' },
  ecb_fx:            { category: 'Financial Markets', provider: 'European Central Bank', url: 'https://www.ecb.europa.eu' },

  // Prediction Markets
  polymarket:        { category: 'Prediction Markets', provider: 'Polymarket', url: 'https://polymarket.com' },
  predictions:       { category: 'Prediction Markets', provider: 'Polymarket', url: 'https://polymarket.com' },
  manifold:          { category: 'Prediction Markets', provider: 'Manifold Markets', url: 'https://manifold.markets' },

  // Economy & Trade
  economic:          { category: 'Economy & Trade', provider: 'FRED / St. Louis Fed', url: 'https://fred.stlouisfed.org' },
  bis:               { category: 'Economy & Trade', provider: 'Bank for Intl. Settlements', url: 'https://www.bis.org' },
  spending:          { category: 'Economy & Trade', provider: 'USAspending.gov', url: 'https://www.usaspending.gov' },
  global_indicators: { category: 'Economy & Trade', provider: 'Eurostat + US Treasury', url: 'https://ec.europa.eu/eurostat' },
  wto_trade:         { category: 'Economy & Trade', provider: 'World Trade Organization', url: 'https://www.wto.org' },
  supply_chain:      { category: 'Economy & Trade', provider: 'Supply chain composite' },
  sanctions:         { category: 'Economy & Trade', provider: 'Sanctions composite' },
  opensanctions:     { category: 'Economy & Trade', provider: 'OpenSanctions', url: 'https://www.opensanctions.org' },
  wgi:               { category: 'Economy & Trade', provider: 'World Bank (WGI)', url: 'https://info.worldbank.org/governance/wgi' },
  vdem:              { category: 'Economy & Trade', provider: 'V-Dem Institute', url: 'https://www.v-dem.net' },
  polity:            { category: 'Economy & Trade', provider: 'Center for Systemic Peace (Polity5)', url: 'https://www.systemicpeace.org/polityproject.html' },

  // Energy
  oil:               { category: 'Energy', provider: 'US Energy Information Admin.', url: 'https://www.eia.gov' },
  renewable_mix:     { category: 'Energy', provider: 'Grid generation composite' },

  // News & Intelligence
  rss:               { category: 'News & Intelligence', provider: 'Publisher RSS feeds' },
  gdelt:             { category: 'News & Intelligence', provider: 'The GDELT Project', url: 'https://www.gdeltproject.org' },
  gdelt_doc:         { category: 'News & Intelligence', provider: 'The GDELT Project', url: 'https://www.gdeltproject.org' },
  gdelt_events:      { category: 'News & Intelligence', provider: 'The GDELT Project', url: 'https://www.gdeltproject.org' },
  pizzint:           { category: 'News & Intelligence', provider: 'PizzINT' },

  // Conflict & Security
  acled:             { category: 'Conflict & Security', provider: 'ACLED', url: 'https://acleddata.com' },
  acled_conflict:    { category: 'Conflict & Security', provider: 'ACLED', url: 'https://acleddata.com' },
  ucdp:              { category: 'Conflict & Security', provider: 'Uppsala Conflict Data Program', url: 'https://ucdp.uu.se' },
  ucdp_events:       { category: 'Conflict & Security', provider: 'Uppsala Conflict Data Program', url: 'https://ucdp.uu.se' },
  hapi:              { category: 'Conflict & Security', provider: 'OCHA HDX HAPI', url: 'https://data.humdata.org' },
  security_advisories: { category: 'Conflict & Security', provider: 'Government travel advisories' },

  // Cyber
  cyber_threats:     { category: 'Cyber', provider: 'abuse.ch', url: 'https://abuse.ch' },
  threatfox:         { category: 'Cyber', provider: 'abuse.ch ThreatFox', url: 'https://threatfox.abuse.ch' },
  cisa_kev:          { category: 'Cyber', provider: 'CISA', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },

  // Aviation
  opensky:           { category: 'Aviation', provider: 'OpenSky Network', url: 'https://opensky-network.org' },
  wingbits:          { category: 'Aviation', provider: 'Wingbits', url: 'https://wingbits.com' },
  aircraft_live:     { category: 'Aviation', provider: 'ADS-B network' },
  airsigmet:         { category: 'Aviation', provider: 'NOAA Aviation Weather Center', url: 'https://aviationweather.gov' },
  gpsjam:            { category: 'Aviation', provider: 'GPSJam', url: 'https://gpsjam.org' },

  // Maritime
  ais:               { category: 'Maritime', provider: 'AISStream', url: 'https://aisstream.io' },

  // Natural Hazards
  usgs:              { category: 'Natural Hazards', provider: 'USGS', url: 'https://earthquake.usgs.gov' },
  firms:             { category: 'Natural Hazards', provider: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov' },
  weather:           { category: 'Natural Hazards', provider: 'NOAA / NWS', url: 'https://www.weather.gov' },
  open_meteo_flood:  { category: 'Natural Hazards', provider: 'Open-Meteo GloFAS', url: 'https://open-meteo.com' },
  webcams:           { category: 'Natural Hazards', provider: 'Windy', url: 'https://www.windy.com' },

  // Climate & Environment
  climate:           { category: 'Climate & Environment', provider: 'Open-Meteo', url: 'https://open-meteo.com' },
  open_meteo_aqi:    { category: 'Climate & Environment', provider: 'Open-Meteo', url: 'https://open-meteo.com' },
  solar_weather:     { category: 'Climate & Environment', provider: 'NOAA SWPC', url: 'https://www.swpc.noaa.gov' },

  // Humanitarian & Health
  unhcr:             { category: 'Humanitarian & Health', provider: 'UNHCR', url: 'https://www.unhcr.org' },
  reliefweb:         { category: 'Humanitarian & Health', provider: 'ReliefWeb (OCHA)', url: 'https://reliefweb.int' },
  who_gho:           { category: 'Humanitarian & Health', provider: 'World Health Organization', url: 'https://www.who.int/data/gho' },
  worldpop:          { category: 'Humanitarian & Health', provider: 'WorldPop', url: 'https://www.worldpop.org' },
  giving:            { category: 'Humanitarian & Health', provider: 'Global giving composite' },

  // Infrastructure
  outages:           { category: 'Infrastructure', provider: 'Internet outage monitors' },
  ioda:              { category: 'Infrastructure', provider: 'Georgia Tech IODA', url: 'https://ioda.inetintel.cc.gatech.edu' },

  // Reference
  place_search:      { category: 'Reference', provider: 'Nominatim + Wikidata', url: 'https://nominatim.openstreetmap.org' },
};

const FALLBACK_CATEGORY = 'Other Sources';

/** Catalog lookup with a safe fallback for sources not yet catalogued. */
export function getCatalogEntry(id: string): SourceCatalogEntry {
  return SOURCE_CATALOG[id as DataSourceId] ?? { category: FALLBACK_CATEGORY, provider: '' };
}

/** Transport label shown per row: LIVE socket, feed poll, or REST call. */
export function getTransportLabel(id: string): 'socket' | 'feed' | 'api' {
  if (WS_SOURCES.has(id)) return 'socket';
  if (RSS_SOURCES.has(id)) return 'feed';
  return 'api';
}

// ─── Summary counts ─────────────────────────────────────────────────────────

export interface SourceSummary {
  total: number;
  online: number;
  stale: number;
  degraded: number;
  error: number;
  noData: number;
  offline: number;
  providers: number;
  newestUpdate: Date | null;
}

/**
 * Roll up source states into the counts shown in the panel's stat tiles.
 * Statuses map 1:1 onto real `FreshnessStatus` values — nothing is inferred.
 */
export function summarizeSources(sources: DataSourceState[]): SourceSummary {
  const providers = new Set<string>();
  let newestUpdate: Date | null = null;
  const counts = { online: 0, stale: 0, degraded: 0, error: 0, noData: 0, offline: 0 };

  for (const source of sources) {
    const provider = getCatalogEntry(source.id).provider;
    if (provider) providers.add(provider);

    if (source.lastUpdate && (!newestUpdate || source.lastUpdate > newestUpdate)) {
      newestUpdate = source.lastUpdate;
    }

    // WebSocket sources that are connected read as online regardless of poll age.
    if (WS_SOURCES.has(source.id) && source.status !== 'error' && source.status !== 'disabled' && source.lastUpdate) {
      counts.online++;
      continue;
    }

    switch (source.status) {
      case 'fresh':      counts.online++;   break;
      case 'stale':      counts.stale++;    break;
      case 'very_stale': counts.degraded++; break;
      case 'error':      counts.error++;    break;
      case 'no_data':    counts.noData++;   break;
      case 'disabled':   counts.offline++;  break;
    }
  }

  return { total: sources.length, providers: providers.size, newestUpdate, ...counts };
}

/** Which stat tile a source belongs to, used for tile-click filtering. */
export function getSummaryBucket(source: DataSourceState): keyof Omit<SourceSummary, 'total' | 'providers' | 'newestUpdate'> {
  if (WS_SOURCES.has(source.id) && source.status !== 'error' && source.status !== 'disabled' && source.lastUpdate) {
    return 'online';
  }
  switch (source.status) {
    case 'fresh':      return 'online';
    case 'stale':      return 'stale';
    case 'very_stale': return 'degraded';
    case 'error':      return 'error';
    case 'disabled':   return 'offline';
    default:           return 'noData';
  }
}
