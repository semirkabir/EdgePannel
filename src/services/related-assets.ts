import type { ClusteredEvent, RelatedAsset, AssetType, RelatedAssetContext, MapLayers } from '@/types';
import { tokenizeForMatch, matchKeyword } from '@/utils/keyword-match';
import { t } from '@/services/i18n';
import { haversineKm } from '@/utils/geo';
import { getCountryCentroid, isCoordinateInCountry, nameToCountryCode } from '@/services/country-geometry';
import {
  INTEL_HOTSPOTS,
  CONFLICT_ZONES,
  MILITARY_BASES,
  UNDERSEA_CABLES,
  NUCLEAR_FACILITIES,
  AI_DATA_CENTERS,
  PIPELINES,
  GAMMA_IRRADIATORS,
  SPACEPORTS,
  STRATEGIC_WATERWAYS,
  ECONOMIC_CENTERS,
  APT_GROUPS,
  CRITICAL_MINERALS,
  STARTUP_HUBS,
  ACCELERATORS,
  TECH_HQS,
  CLOUD_REGIONS,
  STOCK_EXCHANGES,
  FINANCIAL_CENTERS,
  CENTRAL_BANKS,
  COMMODITY_HUBS,
  MINING_SITES,
  PROCESSING_PLANTS,
  COMMODITY_PORTS,
  SITE_VARIANT,
} from '@/config';
import { getLayersForVariant, type MapVariant } from '@/config/map-layer-definitions';

const MAX_DISTANCE_KM = 300;
const MAX_ASSETS_PER_TYPE = 3;
const MAX_ASSETS_TOTAL = 3;

interface AssetOrigin {
  lat: number;
  lon: number;
  label: string;
}

type AssetIndexEntry = { id: string; name: string; lat: number; lon: number };
type AssetSourceItem = { lat: number; lon: number; country?: unknown };

interface AssetDefinition {
  type: AssetType;
  layer: keyof MapLayers;
  keywords: string[];
  buildIndex: () => AssetIndexEntry[];
  buildCountryIndex?: (countryCode: string) => AssetIndexEntry[];
  priority: number;
}

function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (raw.length === 2) return raw.toUpperCase();
  return nameToCountryCode(raw.toLowerCase())?.toUpperCase() ?? null;
}

function pointAsset<T extends { lat: number; lon: number }>(
  id: keyof T,
  name: keyof T | ((item: T) => string),
): (item: T) => AssetIndexEntry {
  return (item) => ({
    id: String(item[id]),
    name: typeof name === 'function' ? name(item) : String(item[name]),
    lat: Number(item.lat),
    lon: Number(item.lon),
  });
}

function isCoordinateInsideCountry(lat: number, lon: number, countryCode: string): boolean {
  return isCoordinateInCountry(lat, lon, countryCode) === true;
}

function countryPointAssets<T extends AssetSourceItem>(
  items: T[],
  mapper: (item: T) => AssetIndexEntry,
  countryCode: string,
): AssetIndexEntry[] {
  return items
    .filter((item) => normalizeCountry(item.country) === countryCode || isCoordinateInsideCountry(Number(item.lat), Number(item.lon), countryCode))
    .map(mapper);
}

function isMilitaryBaseInCountry(base: typeof MILITARY_BASES[number], countryCode: string): boolean {
  const hostCode = base.country ? normalizeCountry(base.country) : null;
  if (hostCode === countryCode) return true;
  return isCoordinateInsideCountry(base.lat, base.lon, countryCode);
}

function isCableInCountry(cable: typeof UNDERSEA_CABLES[number], countryCode: string): boolean {
  if (cable.landingPoints?.some((point) => normalizeCountry(point.country) === countryCode)) return true;
  if (cable.countriesServed?.some((country) => normalizeCountry(country.country) === countryCode)) return true;
  return cable.points.some(([lon, lat]) => isCoordinateInsideCountry(lat, lon, countryCode));
}

function isPipelineInCountry(pipeline: typeof PIPELINES[number], countryCode: string): boolean {
  return pipeline.points.some(([lon, lat]) => isCoordinateInsideCountry(lat, lon, countryCode));
}

function midpoint(points: [number, number][]): { lat: number; lon: number } | null {
  if (points.length === 0) return null;
  const mid = points[Math.floor(points.length / 2)] as [number, number];
  return { lon: mid[0], lat: mid[1] };
}

function pipelineIndex(countryCode?: string): AssetIndexEntry[] {
  return PIPELINES
    .filter((pipeline) => !countryCode || isPipelineInCountry(pipeline, countryCode))
    .map((pipeline) => {
      const mid = midpoint(pipeline.points);
      return mid ? { id: pipeline.id, name: pipeline.name, lat: mid.lat, lon: mid.lon } : null;
    })
    .filter((asset): asset is AssetIndexEntry => !!asset);
}

function cableIndex(countryCode?: string): AssetIndexEntry[] {
  return UNDERSEA_CABLES
    .filter((cable) => !countryCode || isCableInCountry(cable, countryCode))
    .map((cable) => {
      const landingPoint = countryCode
        ? cable.landingPoints?.find((point) => normalizeCountry(point.country) === countryCode)
        : null;
      if (landingPoint) return { id: cable.id, name: cable.name, lat: landingPoint.lat, lon: landingPoint.lon };
      const mid = midpoint(cable.points);
      return mid ? { id: cable.id, name: cable.name, lat: mid.lat, lon: mid.lon } : null;
    })
    .filter((asset): asset is AssetIndexEntry => !!asset);
}

const ASSET_DEFINITIONS: AssetDefinition[] = [
  { type: 'pipeline', layer: 'pipelines', priority: 10, keywords: ['oil pipeline', 'gas pipeline', 'fuel pipeline', 'pipeline leak', 'pipeline spill', 'pipeline explosion', 'pipeline sabotage'], buildIndex: () => pipelineIndex(), buildCountryIndex: pipelineIndex },
  { type: 'cable', layer: 'cables', priority: 10, keywords: ['undersea cable', 'subsea cable', 'fiber cable', 'fiber optic cable', 'internet cable', 'cable cut', 'cable outage'], buildIndex: () => cableIndex(), buildCountryIndex: cableIndex },
  { type: 'datacenter', layer: 'datacenters', priority: 10, keywords: ['datacenter', 'data center', 'server farm', 'colocation', 'hyperscale', 'ai data center', 'data centre'], buildIndex: () => AI_DATA_CENTERS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(AI_DATA_CENTERS, pointAsset('id', 'name'), code) },
  { type: 'base', layer: 'bases', priority: 10, keywords: ['military base', 'airbase', 'air base', 'naval base', 'army base', 'garrison', 'military installation'], buildIndex: () => MILITARY_BASES.map(pointAsset('id', 'name')), buildCountryIndex: (code) => MILITARY_BASES.filter((base) => isMilitaryBaseInCountry(base, code)).map(pointAsset('id', 'name')) },
  { type: 'nuclear', layer: 'nuclear', priority: 10, keywords: ['nuclear plant', 'nuclear power plant', 'nuclear facility', 'nuclear reactor', 'reactor', 'uranium enrichment', 'nuclear site'], buildIndex: () => NUCLEAR_FACILITIES.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(NUCLEAR_FACILITIES, pointAsset('id', 'name'), code) },
  { type: 'irradiator', layer: 'irradiators', priority: 7, keywords: ['gamma irradiator', 'irradiation facility', 'cobalt-60', 'radiological source', 'sterilization facility'], buildIndex: () => GAMMA_IRRADIATORS.map(site => ({ id: site.id, name: site.city, lat: site.lat, lon: site.lon })), buildCountryIndex: (code) => GAMMA_IRRADIATORS.filter((site) => normalizeCountry(site.country) === code || isCoordinateInsideCountry(site.lat, site.lon, code)).map(site => ({ id: site.id, name: site.city, lat: site.lat, lon: site.lon })) },
  { type: 'spaceport', layer: 'spaceports', priority: 8, keywords: ['spaceport', 'launch pad', 'launch site', 'rocket launch', 'satellite launch', 'cosmodrome'], buildIndex: () => SPACEPORTS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(SPACEPORTS, pointAsset('id', 'name'), code) },
  { type: 'waterway', layer: 'waterways', priority: 8, keywords: ['shipping lane', 'strait', 'canal', 'waterway', 'chokepoint', 'maritime chokepoint', 'suez canal', 'panama canal', 'strait of hormuz', 'taiwan strait', 'bab el-mandeb'], buildIndex: () => STRATEGIC_WATERWAYS.map(pointAsset('id', 'name')) },
  { type: 'economicCenter', layer: 'economic', priority: 5, keywords: ['economic center', 'economic hub', 'business district', 'commercial hub'], buildIndex: () => ECONOMIC_CENTERS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(ECONOMIC_CENTERS, pointAsset('id', 'name'), code) },
  { type: 'aptGroup', layer: 'aptGroups', priority: 9, keywords: ['apt group', 'state-sponsored hacking', 'cyber espionage', 'ransomware group', 'lazarus', 'fancy bear', 'cozy bear', 'apt28', 'apt29', 'apt41'], buildIndex: () => APT_GROUPS.map(pointAsset('id', 'name')) },
  { type: 'mineral', layer: 'minerals', priority: 8, keywords: ['critical mineral', 'rare earth', 'lithium', 'cobalt', 'nickel', 'copper', 'uranium mine', 'mineral project'], buildIndex: () => CRITICAL_MINERALS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(CRITICAL_MINERALS, pointAsset('id', 'name'), code) },
  { type: 'startupHub', layer: 'startupHubs', priority: 5, keywords: ['startup hub', 'startup ecosystem', 'venture capital hub', 'tech startup hub', 'unicorn hub'], buildIndex: () => STARTUP_HUBS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(STARTUP_HUBS, pointAsset('id', 'name'), code) },
  { type: 'accelerator', layer: 'accelerators', priority: 5, keywords: ['startup accelerator', 'incubator', 'venture studio', 'y combinator', 'techstars', 'accelerator program'], buildIndex: () => ACCELERATORS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(ACCELERATORS, pointAsset('id', 'name'), code) },
  { type: 'cloudRegion', layer: 'cloudRegions', priority: 8, keywords: ['cloud region', 'aws region', 'azure region', 'gcp region', 'google cloud region', 'cloudflare region', 'availability zone'], buildIndex: () => CLOUD_REGIONS.map(pointAsset('id', (region) => `${String(region.provider).toUpperCase()} ${String(region.name)}`)), buildCountryIndex: (code) => countryPointAssets(CLOUD_REGIONS, pointAsset('id', (region) => `${String(region.provider).toUpperCase()} ${String(region.name)}`), code) },
  { type: 'techHQ', layer: 'techHQs', priority: 6, keywords: ['tech headquarters', 'corporate headquarters', 'company headquarters', 'tech hq', 'headquarters'], buildIndex: () => TECH_HQS.map(pointAsset('id', 'company')), buildCountryIndex: (code) => countryPointAssets(TECH_HQS, pointAsset('id', 'company'), code) },
  { type: 'stockExchange', layer: 'stockExchanges', priority: 9, keywords: ['stock exchange', 'securities exchange', 'equities exchange', 'ipo exchange', 'trading halt', 'market halt'], buildIndex: () => STOCK_EXCHANGES.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(STOCK_EXCHANGES, pointAsset('id', 'name'), code) },
  { type: 'financialCenter', layer: 'financialCenters', priority: 6, keywords: ['financial center', 'financial centre', 'banking hub', 'offshore banking', 'wealth management hub'], buildIndex: () => FINANCIAL_CENTERS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(FINANCIAL_CENTERS, pointAsset('id', 'name'), code) },
  { type: 'centralBank', layer: 'centralBanks', priority: 9, keywords: ['central bank', 'federal reserve', 'rate decision', 'monetary policy', 'policy rate', 'interest rate decision', 'ecb', 'bank of japan', 'bank of england'], buildIndex: () => CENTRAL_BANKS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(CENTRAL_BANKS, pointAsset('id', 'name'), code) },
  { type: 'commodityHub', layer: 'commodityHubs', priority: 8, keywords: ['commodity hub', 'commodity exchange', 'futures exchange', 'oil hub', 'gas hub', 'metals exchange', 'energy corridor'], buildIndex: () => COMMODITY_HUBS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(COMMODITY_HUBS, pointAsset('id', 'name'), code) },
  { type: 'miningSite', layer: 'miningSites', priority: 9, keywords: ['mine site', 'mining site', 'gold mine', 'copper mine', 'lithium mine', 'cobalt mine', 'nickel mine', 'iron ore mine', 'uranium mine'], buildIndex: () => MINING_SITES.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(MINING_SITES, pointAsset('id', 'name'), code) },
  { type: 'processingPlant', layer: 'processingPlants', priority: 8, keywords: ['processing plant', 'smelter', 'refinery', 'mineral processing', 'separation plant', 'rare earth processing'], buildIndex: () => PROCESSING_PLANTS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(PROCESSING_PLANTS, pointAsset('id', 'name'), code) },
  { type: 'commodityPort', layer: 'commodityPorts', priority: 8, keywords: ['commodity port', 'ore terminal', 'coal terminal', 'lng terminal', 'export terminal', 'bulk terminal', 'mineral port'], buildIndex: () => COMMODITY_PORTS.map(pointAsset('id', 'name')), buildCountryIndex: (code) => countryPointAssets(COMMODITY_PORTS, pointAsset('id', 'name'), code) },
];

const ASSET_DEFINITION_BY_TYPE = new Map(ASSET_DEFINITIONS.map((definition) => [definition.type, definition]));

function enabledLayerKeys(): Set<keyof MapLayers> {
  return new Set(getLayersForVariant((SITE_VARIANT || 'full') as MapVariant, 'flat').map((layer) => layer.key));
}

function detectAssetTypes(titles: string[]): AssetType[] {
  const tokenized = titles.map(t => tokenizeForMatch(t));
  const availableLayers = enabledLayerKeys();
  return ASSET_DEFINITIONS
    .filter((definition) => availableLayers.has(definition.layer))
    .filter((definition) => tokenized.some(tokens => definition.keywords.some(keyword => matchKeyword(tokens, keyword))))
    .sort((a, b) => b.priority - a.priority)
    .map((definition) => definition.type);
}

function countKeywordMatches(titles: string[], keywords: string[]): number {
  const tokenized = titles.map(t => tokenizeForMatch(t));
  return keywords.reduce((count, keyword) => {
    return count + tokenized.filter(tokens => matchKeyword(tokens, keyword)).length;
  }, 0);
}

function inferOrigin(cluster: ClusteredEvent, titles: string[]): AssetOrigin | null {
  if (typeof cluster.lat === 'number' && typeof cluster.lon === 'number') {
    return { lat: cluster.lat, lon: cluster.lon, label: cluster.primarySource || 'article location' };
  }

  const geocodedItem = cluster.allItems.find(item => typeof item.lat === 'number' && typeof item.lon === 'number');
  if (geocodedItem && typeof geocodedItem.lat === 'number' && typeof geocodedItem.lon === 'number') {
    return { lat: geocodedItem.lat, lon: geocodedItem.lon, label: geocodedItem.locationName || geocodedItem.source || 'article location' };
  }

  const hotspotCandidates = INTEL_HOTSPOTS.map((hotspot) => ({
    label: hotspot.name,
    lat: hotspot.lat,
    lon: hotspot.lon,
    score: countKeywordMatches(titles, hotspot.keywords),
  })).filter(candidate => candidate.score > 0);

  const conflictCandidates = CONFLICT_ZONES.map((conflict) => ({
    label: conflict.name,
    lat: conflict.center[1],
    lon: conflict.center[0],
    score: countKeywordMatches(titles, conflict.keywords ?? []),
  })).filter(candidate => candidate.score > 0);

  const allCandidates = [...hotspotCandidates, ...conflictCandidates];
  if (allCandidates.length === 0) return null;

  return allCandidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function buildAssetIndex(type: AssetType): AssetIndexEntry[] {
  return ASSET_DEFINITION_BY_TYPE.get(type)?.buildIndex() ?? [];
}

function buildCountryAssetIndex(countryCode: string, type: AssetType): AssetIndexEntry[] {
  return ASSET_DEFINITION_BY_TYPE.get(type)?.buildCountryIndex?.(countryCode) ?? [];
}

function findNearbyAssets(origin: AssetOrigin, types: AssetType[]): RelatedAsset[] {
  const results: RelatedAsset[] = [];

  types.forEach((type) => {
    const candidates = buildAssetIndex(type)
      .map((asset) => ({
        ...asset,
        distanceKm: haversineKm(origin.lat, origin.lon, asset.lat, asset.lon),
      }))
      .filter(asset => asset.distanceKm <= MAX_DISTANCE_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_ASSETS_PER_TYPE);

    candidates.forEach(candidate => {
      results.push({
        id: candidate.id,
        name: candidate.name,
        type,
        distanceKm: candidate.distanceKm,
      });
    });
  });

  return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_ASSETS_TOTAL);
}

export function getClusterAssetContext(cluster: ClusteredEvent): RelatedAssetContext | null {
  const titles = cluster.allItems.map(item => item.title);
  const types = detectAssetTypes(titles);
  if (types.length === 0) return null;

  const origin = inferOrigin(cluster, titles);
  if (!origin) return null;

  const assets = findNearbyAssets(origin, types);
  return { origin, assets, types };
}

export function getAssetLabel(type: AssetType): string {
  return t(`components.relatedAssets.${type}`);
}

export function getNearbyInfrastructure(
  lat: number, lon: number, types: AssetType[]
): RelatedAsset[] {
  return findNearbyAssets({ lat, lon, label: 'country-centroid' }, types);
}

export function getCountryInfrastructure(countryCode: string, types: AssetType[]): RelatedAsset[] {
  const centroid = getCountryCentroid(countryCode);

  return types.flatMap((type) => {
    const assets = buildCountryAssetIndex(countryCode, type)
      .map((asset) => ({
        id: asset.id,
        name: asset.name,
        type,
        distanceKm: centroid ? haversineKm(centroid.lat, centroid.lon, asset.lat, asset.lon) : 0,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return assets;
  });
}

export { MAX_DISTANCE_KM };
