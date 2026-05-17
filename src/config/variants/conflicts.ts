// Conflicts variant — military, defense, and conflict zone intelligence
import type { PanelConfig, MapLayers } from '@/types';
import type { VariantConfig } from './base';

// Re-export base config
export * from './base';

// Re-export variant-aware feeds (CONFLICTS_FEEDS resolved via FEEDS export)
export * from '../feeds';
export * from '../geo';
export * from '../military';
export * from '../airports';
export * from '../entities';

const p1    = (name: string): PanelConfig                   => ({ name, enabled: true,  priority: 1 });
const p2    = (name: string): PanelConfig                   => ({ name, enabled: true,  priority: 2 });
const p1e   = (name: string): PanelConfig                   => ({ name, enabled: true,  priority: 1, premium: 'enhanced' });
const p2l   = (name: string): PanelConfig                   => ({ name, enabled: true,  priority: 2, premium: 'locked' });

// Panel configuration for conflicts & defense intelligence
export const DEFAULT_PANELS: Record<string, PanelConfig> = {
  map:                   p1('Conflicts Map'),
  'live-news':           p1('Conflict Headlines'),
  insights:              p1('AI Strategic Insights'),
  'strategic-posture':   p1e('AI Strategic Posture'),
  cii:                   p1e('Country Instability'),
  'strategic-risk':      p1e('Strategic Risk Overview'),
  'gdelt-intel':         p1e('Live Intelligence'),
  'ucdp-events':         p1('Conflict Events'),
  displacement:          p1('Displacement & Refugees'),
  cascade:               p1('Infrastructure Cascade'),
  middleeast:            p1('Middle East'),
  europe:                p1('Europe'),
  us:                    p1('United States'),
  politics:              p1('World News'),
  africa:                p1('Africa'),
  asia:                  p1('Asia-Pacific'),
  'telegram-intel':      p2l('Telegram Intel'),
  'security-advisories': p2('Security Advisories'),
  'oref-sirens':         p2l('Israel Sirens'),
  'live-webcams':        { name: 'Live Webcams', enabled: false, priority: 2 },
  energy:                p2('Energy & Resources'),
  'satellite-fires':     p2('Fires & Operational Risk'),
  climate:               p2('Climate Anomalies'),
  'airline-intel':       p2('Airline Intelligence'),
  polymarket:            p2('Conflict Predictions'),
  elections:             p2('Elections'),
  monitors:              p2('My Monitors'),
  'world-clock':         p2('World Clock'),
  marketplace:          { name: 'Marketplace Data', enabled: false, priority: 2 },
  // New panels for the conflicts variant
  'armed-conflict':      p1('Armed Conflicts'),
  defense:               p1('Defense & Military'),
  thinktanks:            p1('Think Tanks & Analysis'),
  crisis:                p1('Crisis Monitoring'),
  gov:                   p1('Government & Policy'),
  sanctions:             p2('Sanctions Watch'),
  humanrights:           p2('Human Rights & Justice'),
};

export const DEFAULT_MAP_LAYERS: MapLayers = {
  gpsJamming: true,
  conflicts: true,
  bases: true,
  cables: false,
  pipelines: false,
  hotspots: true,
  ais: true,
  nuclear: true,
  irradiators: false,
  sanctions: true,
  weather: true,
  economic: false,
  polymarketMarkets: false,
  waterways: true,
  outages: true,
  cyberThreats: false,
  datacenters: false,
  protests: false,
  flights: true,
  military: true,
  natural: false,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: true,
  displacement: true,
  climate: false,
  iranAttacks: true,
  ciiChoropleth: true,
  governanceChoropleth: false,
  dayNight: false,
  // Tech layers (disabled in conflicts variant)
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  // Finance layers (disabled in conflicts variant)
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  // Happy variant layers (disabled)
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
  // Commodity variant layers (disabled)
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
  aptGroups: false,
  gemRisk: false,
  democracy: false,
  elections: false,
};

export const MOBILE_DEFAULT_MAP_LAYERS: MapLayers = {
  gpsJamming: false,
  conflicts: true,
  bases: false,
  cables: false,
  pipelines: false,
  hotspots: true,
  ais: false,
  nuclear: false,
  irradiators: false,
  sanctions: true,
  weather: true,
  economic: false,
  polymarketMarkets: false,
  waterways: false,
  outages: true,
  cyberThreats: false,
  datacenters: false,
  protests: false,
  flights: false,
  military: true,
  natural: true,
  spaceports: false,
  minerals: false,
  fires: false,
  ucdpEvents: true,
  displacement: true,
  climate: false,
  iranAttacks: true,
  ciiChoropleth: false,
  governanceChoropleth: false,
  dayNight: false,
  // Tech layers (disabled)
  startupHubs: false,
  cloudRegions: false,
  accelerators: false,
  techHQs: false,
  techEvents: false,
  // Finance layers (disabled)
  stockExchanges: false,
  financialCenters: false,
  centralBanks: false,
  commodityHubs: false,
  gulfInvestments: false,
  // Happy variant layers (disabled)
  positiveEvents: false,
  kindness: false,
  happiness: false,
  speciesRecovery: false,
  renewableInstallations: false,
  tradeRoutes: false,
  // Commodity variant layers (disabled)
  miningSites: false,
  processingPlants: false,
  commodityPorts: false,
  aptGroups: false,
  gemRisk: false,
  democracy: false,
  elections: false,
};

export const VARIANT_CONFIG: VariantConfig = {
  name: 'conflicts',
  description: 'Military, defense, and conflict zone intelligence',
  panels: DEFAULT_PANELS,
  mapLayers: DEFAULT_MAP_LAYERS,
  mobileMapLayers: MOBILE_DEFAULT_MAP_LAYERS,
};
