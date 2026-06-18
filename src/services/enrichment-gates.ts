import type { InternetOutage } from '@/types';
import type { SanctionEntity } from '@/services/sanctions';
import type { DataSourceId } from '@/services/data-freshness';
import { isNamedSourceEnabled } from '@/services/source-control';

/** Canonical marketplace / disable-toggle names for enrichment providers. */
export const ENRICHMENT_SOURCES = {
  RELIEFWEB: 'ReliefWeb',
  WHO_GHO: 'WHO GHO',
  AIRSIGMET: 'Aviation SIGMET',
  DEFILLAMA: 'DefiLlama',
  GLOBAL_INDICATORS: 'Global Indicators',
  CISA_KEV: 'CISA KEV',
  THREATFOX: 'ThreatFox',
  OPENSANCTIONS: 'OpenSanctions',
  MANIFOLD: 'Manifold',
  PLACE_SEARCH: 'Place Search',
  OPEN_METEO_AQI: 'Open-Meteo AQI',
  OPEN_METEO_FLOOD: 'Open-Meteo Flood',
  IODA: 'IODA',
} as const;

export type EnrichmentSourceName = typeof ENRICHMENT_SOURCES[keyof typeof ENRICHMENT_SOURCES];

const ENRICHMENT_DATA_SOURCE_IDS: Partial<Record<EnrichmentSourceName, DataSourceId>> = {
  [ENRICHMENT_SOURCES.RELIEFWEB]: 'reliefweb',
  [ENRICHMENT_SOURCES.WHO_GHO]: 'who_gho',
  [ENRICHMENT_SOURCES.AIRSIGMET]: 'airsigmet',
  [ENRICHMENT_SOURCES.DEFILLAMA]: 'defillama',
  [ENRICHMENT_SOURCES.GLOBAL_INDICATORS]: 'global_indicators',
  [ENRICHMENT_SOURCES.CISA_KEV]: 'cisa_kev',
  [ENRICHMENT_SOURCES.THREATFOX]: 'threatfox',
  [ENRICHMENT_SOURCES.OPENSANCTIONS]: 'opensanctions',
  [ENRICHMENT_SOURCES.MANIFOLD]: 'manifold',
  [ENRICHMENT_SOURCES.PLACE_SEARCH]: 'place_search',
  [ENRICHMENT_SOURCES.OPEN_METEO_AQI]: 'open_meteo_aqi',
  [ENRICHMENT_SOURCES.OPEN_METEO_FLOOD]: 'open_meteo_flood',
  [ENRICHMENT_SOURCES.IODA]: 'ioda',
};

export function getEnrichmentDataSourceId(source: EnrichmentSourceName | string): DataSourceId | undefined {
  return ENRICHMENT_DATA_SOURCE_IDS[source as EnrichmentSourceName];
}

export function isEnrichmentEnabled(source: EnrichmentSourceName | string): boolean {
  return isNamedSourceEnabled(source);
}

export function filterIodaOutages(outages: InternetOutage[]): InternetOutage[] {
  if (isEnrichmentEnabled(ENRICHMENT_SOURCES.IODA)) return outages;
  return outages.filter((outage) => !outage.categories?.some((category) => /ioda/i.test(category)));
}

export function filterOpenMeteoFloodEvents<T extends { sourceName?: string; id?: string }>(events: T[]): T[] {
  if (isEnrichmentEnabled(ENRICHMENT_SOURCES.OPEN_METEO_FLOOD)) return events;
  return events.filter((event) => {
    const source = String(event.sourceName || '');
    const id = String(event.id || '');
    return !/open-meteo|glofas/i.test(source) && !id.startsWith('openmeteo-flood-');
  });
}

export function filterManifoldPredictions<T extends { url?: string }>(predictions: T[]): T[] {
  if (isEnrichmentEnabled(ENRICHMENT_SOURCES.MANIFOLD)) return predictions;
  return predictions.filter((prediction) => !(prediction.url || '').includes('manifold.markets'));
}

export function filterOpenSanctionsEntities(entities: SanctionEntity[]): SanctionEntity[] {
  if (isEnrichmentEnabled(ENRICHMENT_SOURCES.OPENSANCTIONS)) return entities;
  return entities.filter((entity) => {
    if (entity.opensanctionsId) return false;
    const source = (entity.source || '').toLowerCase();
    return source === 'ofac' || source.startsWith('ofac');
  });
}
