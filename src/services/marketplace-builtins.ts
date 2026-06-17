import { FEEDS, INTEL_SOURCES, getSourcePropagandaRisk, getSourceTier, getSourceType } from '@/config/feeds';
import { SITE_VARIANT } from '@/config/variant';
import { DATA_SOURCE_METADATA, type DataSourceId } from './data-freshness';
import type { Feed } from '@/types';
import type { MarketplaceCatalogItem, MarketplaceManifest, MarketplaceVariant } from '@/types/marketplace';

const BUILT_IN_AUTHOR = 'worldmonitor';
const BUILT_IN_VERSION = '1.0.0';

interface BuiltInFeedSource {
  name: string;
  categories: Set<string>;
  urls: Set<string>;
  types: Set<string>;
  langs: Set<string>;
}

interface ExtraBuiltInProvider {
  name: string;
  sourceName: string;
  category: string;
  description: string;
  tags: string[];
  upstreams: string[];
  panelId?: string;
  dataSourceId?: DataSourceId;
}

const EXTRA_RUNTIME_SOURCE_IDS = new Set<DataSourceId>([
  'reliefweb',
  'who_gho',
  'airsigmet',
  'defillama',
  'global_indicators',
  'ioda',
  'open_meteo_aqi',
  'open_meteo_flood',
  'manifold',
  'opensanctions',
  'threatfox',
  'place_search',
]);

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'source';
}

function variant(): MarketplaceVariant {
  return SITE_VARIANT as MarketplaceVariant;
}

function flattenFeedUrls(url: Feed['url']): string[] {
  if (typeof url === 'string') return [url];
  return Object.values(url).filter(Boolean);
}

function describeFeedSource(source: BuiltInFeedSource): string {
  const categories = Array.from(source.categories).sort();
  const type = getSourceType(source.name);
  return `${source.name} is a built-in ${type} feed used by Worldmonitor for ${categories.join(', ')} coverage. It is managed through the Data Marketplace so users can remove it and install it again from Browse.`;
}

function marketplaceCatalogFromManifest(manifest: MarketplaceManifest): MarketplaceCatalogItem {
  return {
    id: manifest.id,
    slug: manifest.slug,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    category: manifest.category,
    tags: manifest.tags,
    surfaces: Object.entries(manifest.surfaces)
      .filter(([, config]) => Boolean(config))
      .map(([surface]) => surface as MarketplaceCatalogItem['surfaces'][number]),
    compatibility: manifest.compatibility,
    manifestUrl: `/marketplace/built-in/${manifest.slug}.json`,
    valueProposition: manifest.valueProposition,
    trust: manifest.trust,
    commercial: manifest.commercial,
  };
}

function buildFeedManifests(): MarketplaceManifest[] {
  const sources = new Map<string, BuiltInFeedSource>();
  const addFeed = (feed: Feed, category: string) => {
    const existing = sources.get(feed.name) ?? {
      name: feed.name,
      categories: new Set<string>(),
      urls: new Set<string>(),
      types: new Set<string>(),
      langs: new Set<string>(),
    };
    existing.categories.add(category);
    flattenFeedUrls(feed.url).forEach((url) => existing.urls.add(url));
    if (feed.type) existing.types.add(feed.type);
    if (feed.lang) existing.langs.add(feed.lang);
    sources.set(feed.name, existing);
  };

  for (const [category, feeds] of Object.entries(FEEDS)) {
    feeds.forEach((feed) => addFeed(feed, category));
  }
  INTEL_SOURCES.forEach((feed) => addFeed(feed, 'intel'));

  const usedSlugs = new Map<string, number>();
  return Array.from(sources.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((source) => {
      const baseSlug = `source-${slugify(source.name)}`;
      const seen = usedSlugs.get(baseSlug) ?? 0;
      usedSlugs.set(baseSlug, seen + 1);
      const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen + 1}`;
      const id = `worldmonitor-${slug}`;
      const categories = Array.from(source.categories).sort();
      const urls = Array.from(source.urls).sort();
      const types = Array.from(source.types).sort();
      const langs = Array.from(source.langs).sort();
      const sourceType = getSourceType(source.name);
      const risk = getSourcePropagandaRisk(source.name);
      const tier = getSourceTier(source.name);
      const description = describeFeedSource(source);
      const tags = Array.from(new Set([
        'built-in',
        'feed',
        'worldmonitor',
        sourceType,
        `tier-${tier}`,
        ...categories,
        ...types,
        ...langs.map((lang) => `lang-${lang}`),
      ])).filter(Boolean);

      return {
        id,
        slug,
        name: source.name,
        version: BUILT_IN_VERSION,
        author: BUILT_IN_AUTHOR,
        description,
        license: 'Configured source metadata; upstream content remains owned by the publisher.',
        category: categories[0] ?? 'feeds',
        tags,
        sourceType: 'catalog',
        visibility: 'public',
        compatibility: { variants: [variant()] },
        datasets: [{
          id: 'source-metadata',
          name: 'Source metadata',
          format: 'json',
          inlineData: [{
            id,
            name: source.name,
            kind: 'feed',
            sourceType,
            tier,
            propagandaRisk: risk.risk,
            stateAffiliated: risk.stateAffiliated ?? '',
            categories: categories.join(', '),
            tags,
            languages: langs.join(', ') || 'default',
            urls: urls.join('\n'),
            description,
          }],
          primaryIdField: 'id',
        }],
        surfaces: {
          search: {
            datasetId: 'source-metadata',
            titleField: 'name',
            subtitleField: 'categories',
            tagsField: 'tags',
          },
          panel: {
            datasetId: 'source-metadata',
            template: 'record-detail',
            titleField: 'name',
            subtitleField: 'categories',
            descriptionField: 'description',
            metrics: [
              { label: 'Type', field: 'sourceType' },
              { label: 'Tier', field: 'tier' },
              { label: 'Risk', field: 'propagandaRisk' },
              { label: 'Language', field: 'languages' },
            ],
          },
        },
        valueProposition: 'Built-in Worldmonitor coverage source that can be removed, restored, searched, and audited from the marketplace.',
        trust: {
          verificationLevel: tier <= 2 ? 'curated' : 'community',
          maintainer: BUILT_IN_AUTHOR,
          coverage: categories.join(', '),
          methodology: 'Generated from the app source registry at startup.',
          provenance: urls,
          knownGaps: risk.note ? [risk.note] : undefined,
        },
        commercial: {
          access: 'included',
          tier: 'free',
          priceLabel: 'Included',
        },
        builtIn: {
          kind: 'feed',
          sourceName: source.name,
        },
      } satisfies MarketplaceManifest;
    });
}

function buildRuntimeManifests(): MarketplaceManifest[] {
  return Object.entries(DATA_SOURCE_METADATA)
    .filter(([dataSourceId]) => !EXTRA_RUNTIME_SOURCE_IDS.has(dataSourceId as DataSourceId))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .map(([dataSourceId, meta]) => {
      const slug = `runtime-${slugify(dataSourceId)}`;
      const id = `worldmonitor-${slug}`;
      const category = meta.panelId ?? 'runtime';
      const description = `${meta.name} is a built-in Worldmonitor runtime data source used by the ${category} workspace surface. It is listed in the marketplace for visibility and reinstall workflows.`;
      const tags = ['built-in', 'runtime', 'worldmonitor', category, dataSourceId, meta.requiredForRisk ? 'risk-required' : 'optional'];
      return {
        id,
        slug,
        name: meta.name,
        version: BUILT_IN_VERSION,
        author: BUILT_IN_AUTHOR,
        description,
        license: 'Configured source metadata; upstream data remains governed by the source provider.',
        category,
        tags,
        sourceType: 'catalog',
        visibility: 'public',
        compatibility: { variants: [variant()] },
        datasets: [{
          id: 'source-metadata',
          name: 'Source metadata',
          format: 'json',
          inlineData: [{
            id,
            name: meta.name,
            kind: 'runtime',
            dataSourceId,
            panelId: meta.panelId ?? '',
            requiredForRisk: meta.requiredForRisk ? 'yes' : 'no',
            description,
            tags,
          }],
          primaryIdField: 'id',
        }],
        surfaces: {
          search: {
            datasetId: 'source-metadata',
            titleField: 'name',
            subtitleField: 'panelId',
            tagsField: 'tags',
          },
          panel: {
            datasetId: 'source-metadata',
            template: 'record-detail',
            titleField: 'name',
            subtitleField: 'panelId',
            descriptionField: 'description',
            metrics: [
              { label: 'Source ID', field: 'dataSourceId' },
              { label: 'Panel', field: 'panelId' },
              { label: 'Risk required', field: 'requiredForRisk' },
            ],
          },
        },
        valueProposition: 'Built-in Worldmonitor runtime source surfaced in the marketplace for source inventory and restore workflows.',
        trust: {
          verificationLevel: 'curated',
          maintainer: BUILT_IN_AUTHOR,
          coverage: category,
          methodology: 'Generated from the data freshness runtime registry at startup.',
        },
        commercial: {
          access: 'included',
          tier: 'free',
          priceLabel: 'Included',
        },
        builtIn: {
          kind: 'runtime',
          dataSourceId: dataSourceId as DataSourceId,
        },
      } satisfies MarketplaceManifest;
    });
}

const EXTRA_BUILT_IN_PROVIDERS: ExtraBuiltInProvider[] = [
  {
    name: 'ReliefWeb',
    sourceName: 'ReliefWeb',
    category: 'displacement',
    panelId: 'displacement',
    dataSourceId: 'reliefweb',
    description: 'ReliefWeb humanitarian updates enrich displacement analysis with official humanitarian situation reports and emergency updates.',
    tags: ['built-in', 'service', 'humanitarian', 'displacement', 'reliefweb', 'rss'],
    upstreams: ['https://reliefweb.int/updates/rss.xml'],
  },
  {
    name: 'WHO GHO',
    sourceName: 'WHO GHO',
    category: 'health',
    panelId: 'displacement',
    dataSourceId: 'who_gho',
    description: 'WHO Global Health Observatory indicators add outbreak and public-health context to displacement and country risk views.',
    tags: ['built-in', 'service', 'health', 'who', 'gho', 'outbreaks'],
    upstreams: ['https://ghoapi.azureedge.net/api'],
  },
  {
    name: 'Aviation SIGMET',
    sourceName: 'Aviation SIGMET',
    category: 'aviation',
    panelId: 'airline-intel',
    dataSourceId: 'airsigmet',
    description: 'Aviation SIGMETs from aviationweather.gov enrich airport delay and aviation risk panels with active weather hazards.',
    tags: ['built-in', 'service', 'aviation', 'weather', 'sigmet', 'faa'],
    upstreams: ['https://aviationweather.gov/api/data/airsigmet?format=json'],
  },
  {
    name: 'DefiLlama',
    sourceName: 'DefiLlama',
    category: 'markets',
    panelId: 'crypto',
    dataSourceId: 'defillama',
    description: 'DefiLlama protocol TVL data enriches the crypto market panel with DeFi liquidity and protocol concentration signals.',
    tags: ['built-in', 'service', 'defi', 'crypto', 'tvl', 'markets'],
    upstreams: ['https://api.llama.fi/protocols'],
  },
  {
    name: 'Global Indicators',
    sourceName: 'Global Indicators',
    category: 'economic',
    panelId: 'economic',
    dataSourceId: 'global_indicators',
    description: 'Global indicators combine Eurostat and US Treasury public data into compact macro context cards for the economic panel.',
    tags: ['built-in', 'service', 'economic', 'macro', 'eurostat', 'treasury'],
    upstreams: [
      'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data',
      'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
    ],
  },
  {
    name: 'CISA KEV',
    sourceName: 'CISA KEV',
    category: 'cyber',
    panelId: 'security',
    description: 'CISA Known Exploited Vulnerabilities data highlights actively exploited CVEs in the security news panel.',
    tags: ['built-in', 'service', 'cyber', 'cisa', 'kev', 'vulnerabilities'],
    upstreams: ['https://www.cisa.gov/known-exploited-vulnerabilities-catalog'],
  },
  {
    name: 'ThreatFox',
    sourceName: 'ThreatFox',
    category: 'cyber',
    panelId: 'map',
    dataSourceId: 'threatfox',
    description: 'ThreatFox malware IOCs from abuse.ch merge into the cyber threats map layer alongside URLhaus and other feeds.',
    tags: ['built-in', 'service', 'cyber', 'threatfox', 'ioc', 'malware'],
    upstreams: ['https://threatfox.abuse.ch/api/'],
  },
  {
    name: 'OpenSanctions',
    sourceName: 'OpenSanctions',
    category: 'sanctions',
    panelId: 'sanctions-tracker',
    dataSourceId: 'opensanctions',
    description: 'OpenSanctions EU, UN, and UK datasets enrich the sanctions tracker and async sanctions search beyond OFAC alone.',
    tags: ['built-in', 'service', 'sanctions', 'opensanctions', 'compliance'],
    upstreams: ['https://data.opensanctions.org/datasets/latest/'],
  },
  {
    name: 'Manifold',
    sourceName: 'Manifold',
    category: 'predictions',
    panelId: 'polymarket',
    dataSourceId: 'manifold',
    description: 'Manifold Markets geopolitical predictions merge into the prediction panel alongside Polymarket coverage.',
    tags: ['built-in', 'service', 'predictions', 'manifold', 'forecast'],
    upstreams: ['https://api.manifold.markets/v0/search-markets'],
  },
  {
    name: 'Place Search',
    sourceName: 'Place Search',
    category: 'search',
    panelId: 'search',
    dataSourceId: 'place_search',
    description: 'Nominatim and Wikidata power async place and entity search with map fly-to for geocoded results.',
    tags: ['built-in', 'service', 'search', 'nominatim', 'wikidata', 'geocoding'],
    upstreams: [
      'https://nominatim.openstreetmap.org/search',
      'https://www.wikidata.org/w/api.php',
    ],
  },
  {
    name: 'Open-Meteo AQI',
    sourceName: 'Open-Meteo AQI',
    category: 'climate',
    panelId: 'climate',
    dataSourceId: 'open_meteo_aqi',
    description: 'Open-Meteo air quality observations add physical AQI signals to the climate panel and map overlays.',
    tags: ['built-in', 'service', 'climate', 'aqi', 'air-quality', 'open-meteo'],
    upstreams: ['https://air-quality-api.open-meteo.com/v1/air-quality'],
  },
  {
    name: 'Open-Meteo Flood',
    sourceName: 'Open-Meteo Flood',
    category: 'natural',
    panelId: 'natural',
    dataSourceId: 'open_meteo_flood',
    description: 'Open-Meteo GloFAS river flood discharges enrich the natural events layer with hydrological hazard context.',
    tags: ['built-in', 'service', 'natural', 'flood', 'hydrology', 'open-meteo'],
    upstreams: ['https://flood-api.open-meteo.com/v1/flood'],
  },
  {
    name: 'IODA',
    sourceName: 'IODA',
    category: 'infrastructure',
    panelId: 'outages',
    dataSourceId: 'ioda',
    description: 'Georgia Tech IODA outage events merge with Cloudflare Radar for country-level internet disruption detection.',
    tags: ['built-in', 'service', 'infrastructure', 'outages', 'ioda', 'internet'],
    upstreams: ['https://api.ioda.inetintel.cc.gatech.edu/v2/outages/events'],
  },
];

function buildExtraProviderManifests(): MarketplaceManifest[] {
  return EXTRA_BUILT_IN_PROVIDERS.map((provider) => {
    const slug = `provider-${slugify(provider.sourceName)}`;
    const id = `worldmonitor-${slug}`;
    const description = `${provider.description} It is managed through the Data Marketplace so users can remove it and install it again from Browse.`;
    return {
      id,
      slug,
      name: provider.name,
      version: BUILT_IN_VERSION,
      author: BUILT_IN_AUTHOR,
      description,
      license: 'Configured source metadata; upstream data remains governed by the source provider.',
      category: provider.category,
      tags: provider.tags,
      sourceType: 'catalog',
      visibility: 'public',
      compatibility: { variants: [variant()] },
      datasets: [{
        id: 'source-metadata',
        name: 'Source metadata',
        format: 'json',
        inlineData: [{
          id,
          name: provider.name,
          kind: 'service',
          sourceName: provider.sourceName,
          panelId: provider.panelId ?? '',
          category: provider.category,
          upstreams: provider.upstreams.join('\n'),
          tags: provider.tags,
          description,
        }],
        primaryIdField: 'id',
      }],
      surfaces: {
        search: {
          datasetId: 'source-metadata',
          titleField: 'name',
          subtitleField: 'category',
          tagsField: 'tags',
        },
        panel: {
          datasetId: 'source-metadata',
          template: 'record-detail',
          titleField: 'name',
          subtitleField: 'category',
          descriptionField: 'description',
          metrics: [
            { label: 'Provider', field: 'sourceName' },
            { label: 'Panel', field: 'panelId' },
            { label: 'Category', field: 'category' },
          ],
        },
      },
      valueProposition: 'Built-in Worldmonitor service provider surfaced in the marketplace for source inventory and restore workflows.',
      trust: {
        verificationLevel: 'curated',
        maintainer: BUILT_IN_AUTHOR,
        coverage: provider.category,
        methodology: 'Generated from service-backed providers wired into the default app experience.',
        provenance: provider.upstreams,
      },
      commercial: {
        access: 'included',
        tier: 'free',
        priceLabel: 'Included',
      },
      builtIn: {
        kind: 'service',
        sourceName: provider.sourceName,
        ...(provider.dataSourceId ? { dataSourceId: provider.dataSourceId } : {}),
      },
    } satisfies MarketplaceManifest;
  });
}

export const BUILT_IN_MARKETPLACE_MANIFESTS: MarketplaceManifest[] = [
  ...buildFeedManifests(),
  ...buildRuntimeManifests(),
  ...buildExtraProviderManifests(),
];

export const BUILT_IN_MARKETPLACE_CATALOG: MarketplaceCatalogItem[] = BUILT_IN_MARKETPLACE_MANIFESTS.map(marketplaceCatalogFromManifest);

export const BUILT_IN_MARKETPLACE_MANIFESTS_BY_ID = new Map(
  BUILT_IN_MARKETPLACE_MANIFESTS.map((manifest) => [manifest.id, manifest]),
);

export function isBuiltInMarketplaceItem(itemId: string): boolean {
  return BUILT_IN_MARKETPLACE_MANIFESTS_BY_ID.has(itemId);
}
