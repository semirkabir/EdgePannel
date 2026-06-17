import type { MapLayers, Monitor } from '@/types';
import type { MarketplaceVariant } from '@/types/marketplace';
import type { AlertRuleDraftInput } from '@/services/alert-rules';

export type MissionPackDomain =
  | 'geopolitics'
  | 'supply-chain'
  | 'markets'
  | 'infrastructure'
  | 'cyber';

export interface MissionPack {
  id: string;
  name: string;
  tagline: string;
  description: string;
  domain: MissionPackDomain;
  compatibleVariants: MarketplaceVariant[];
  datasetIds: string[];
  recommendedPanels: string[];
  recommendedLayers: Array<keyof MapLayers>;
  recommendedSources: string[];
  monitorTemplates: Array<Omit<Monitor, 'id' | 'color'>>;
  alertRuleTemplates: AlertRuleDraftInput[];
  questionsAnswered: string[];
  premiumUpsell?: string;
}

export const MISSION_PACKS: MissionPack[] = [
  {
    id: 'red-sea-shipping-risk',
    name: 'Red Sea Shipping Risk',
    tagline: 'Monitor corridor risk, rerouting pressure, and conflict spillover.',
    description: 'Combines maritime corridors, port congestion, conflict intensity, waterways, and live headlines into one shipping-risk workspace.',
    domain: 'supply-chain',
    compatibleVariants: ['full', 'finance', 'commodity', 'conflicts'],
    datasetIds: ['maritime-insurance-corridors', 'port-congestion-monitor', 'conflict-intensity-scores', 'energy-infrastructure-map'],
    recommendedPanels: ['live-news', 'strategic-risk', 'supply-chain', 'trade-flows', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['ais', 'tradeRoutes', 'waterways', 'conflicts', 'hotspots'],
    recommendedSources: ['Reuters World', 'Reuters Business', 'AP News', 'gCaptain', 'USNI News'],
    monitorTemplates: [
      { name: 'Red Sea Shipping', keywords: ['red sea', 'bab el-mandeb', 'suez', 'houthi', 'rerouting'] },
    ],
    alertRuleTemplates: [
      {
        name: 'Red Sea disruption',
        keywords: ['red sea', 'bab el-mandeb', 'suez', 'houthi', 'shipping'],
        region: 'mena',
        signalTypes: ['news', 'infrastructure', 'supply_chain'],
        threshold: 65,
        evidenceRequirement: 'corroborated',
      },
    ],
    questionsAnswered: [
      'Are shipping corridors becoming materially riskier?',
      'Are congestion and rerouting signals worsening together?',
      'Which conflict developments could affect commodity flows next?',
    ],
    premiumUpsell: 'Add commercial AIS, sanctions-risk, and commodity-flow feeds for dark-shipping and cargo exposure scoring.',
  },
  {
    id: 'critical-minerals-exposure',
    name: 'Critical Minerals Exposure',
    tagline: 'Track refining choke points, trade dependencies, and sovereign stress.',
    description: 'A cross-domain view for battery metals and strategic mineral supply chains.',
    domain: 'supply-chain',
    compatibleVariants: ['full', 'finance', 'commodity'],
    datasetIds: ['critical-mineral-refineries', 'sovereign-risk-index', 'port-congestion-monitor', 'energy-infrastructure-map'],
    recommendedPanels: ['supply-chain', 'trade-policy', 'trade-flows', 'commodities', 'monitors', 'marketplace'],
    recommendedLayers: ['minerals', 'miningSites', 'processingPlants', 'commodityPorts', 'tradeRoutes'],
    recommendedSources: ['Reuters Business', 'Financial Times', 'WTO Latest News', 'BIS Press Releases'],
    monitorTemplates: [
      { name: 'Critical Minerals', keywords: ['lithium', 'cobalt', 'rare earth', 'nickel', 'refinery'] },
    ],
    alertRuleTemplates: [
      {
        name: 'Critical minerals disruption',
        keywords: ['lithium', 'cobalt', 'rare earth', 'refinery', 'export restriction'],
        region: 'global',
        signalTypes: ['news', 'supply_chain', 'market'],
        threshold: 62,
        evidenceRequirement: 'corroborated',
      },
    ],
    questionsAnswered: [
      'Where are the most important refining choke points?',
      'Which countries combine strategic supply and rising sovereign risk?',
      'What could disrupt battery-metal flows next?',
    ],
    premiumUpsell: 'Add trade-flow, customs, and commercial supply-chain datasets for exposure scoring by company and corridor.',
  },
  {
    id: 'ai-defense-watch',
    name: 'AI Defense Watch',
    tagline: 'Follow defense autonomy, launch activity, and market beneficiaries.',
    description: 'Pairs defense-linked equities with satellite launches, cyber incidents, and policy signals.',
    domain: 'markets',
    compatibleVariants: ['full', 'tech', 'finance'],
    datasetIds: ['ai-defense-quote-board', 'satellite-launch-manifest', 'cyber-incident-tracker'],
    recommendedPanels: ['markets', 'watchlist', 'security-advisories', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['spaceports', 'aptGroups', 'cyberThreats'],
    recommendedSources: ['Reuters Business', 'Defense One', 'Breaking Defense', 'The War Zone', 'MIT Tech Review'],
    monitorTemplates: [
      { name: 'AI Defense', keywords: ['autonomy', 'defense ai', 'drone', 'satellite launch', 'c4isr'] },
    ],
    alertRuleTemplates: [
      {
        name: 'AI-defense catalyst',
        keywords: ['autonomy', 'drone', 'satellite launch', 'defense ai'],
        region: 'global',
        signalTypes: ['news', 'market', 'cyber'],
        threshold: 58,
        evidenceRequirement: 'any',
      },
    ],
    questionsAnswered: [
      'Which companies are exposed to AI-defense demand?',
      'Are launches or cyber events creating near-term catalysts?',
      'What technology themes are moving from policy to deployment?',
    ],
    premiumUpsell: 'Add commercial company, procurement, and satellite datasets for contract and capability tracking.',
  },
  {
    id: 'infrastructure-disruption',
    name: 'Infrastructure Disruption',
    tagline: 'Connect cables, pipelines, outages, conflict, and GPS interference.',
    description: 'A resilient-infrastructure watch desk for cross-domain disruptions.',
    domain: 'infrastructure',
    compatibleVariants: ['full', 'tech', 'conflicts', 'commodity'],
    datasetIds: ['undersea-cable-map', 'energy-infrastructure-map', 'conflict-intensity-scores'],
    recommendedPanels: ['cascade', 'strategic-risk', 'security-advisories', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['cables', 'pipelines', 'outages', 'gpsJamming', 'conflicts', 'hotspots'],
    recommendedSources: ['Reuters World', 'CISA', 'NCSC Threat Reports', 'CERT-EU Security Advisories', 'IODA'],
    monitorTemplates: [
      { name: 'Infrastructure disruption', keywords: ['cable cut', 'pipeline outage', 'gps jamming', 'internet outage'] },
    ],
    alertRuleTemplates: [
      {
        name: 'Infrastructure disruption',
        keywords: ['cable cut', 'pipeline outage', 'gps jamming', 'internet outage'],
        region: 'global',
        signalTypes: ['news', 'infrastructure', 'cyber'],
        threshold: 66,
        evidenceRequirement: 'corroborated',
      },
    ],
    questionsAnswered: [
      'Which disruptions are isolated versus systemic?',
      'Are infrastructure and conflict signals converging?',
      'Where should operators expect cascading risk?',
    ],
    premiumUpsell: 'Add commercial EO/SAR and outage telemetry to verify physical change and network impact faster.',
  },
  {
    id: 'sovereign-stress',
    name: 'Sovereign Stress',
    tagline: 'Watch debt, unrest, elections, and market pressure together.',
    description: 'A country-risk workspace spanning macro, politics, and instability signals.',
    domain: 'geopolitics',
    compatibleVariants: ['full', 'finance', 'conflicts'],
    datasetIds: ['sovereign-risk-index', 'conflict-intensity-scores'],
    recommendedPanels: ['cii', 'strategic-risk', 'economic', 'trade-policy', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['ciiChoropleth', 'governanceChoropleth', 'protests', 'conflicts', 'elections'],
    recommendedSources: ['Reuters World', 'Reuters Business', 'Financial Times', 'BIS Press Releases', 'ECB Press'],
    monitorTemplates: [
      { name: 'Sovereign Stress', keywords: ['debt restructuring', 'capital controls', 'default', 'mass protests'] },
    ],
    alertRuleTemplates: [
      {
        name: 'Sovereign stress escalation',
        keywords: ['default', 'debt restructuring', 'capital controls', 'mass protests'],
        region: 'global',
        signalTypes: ['news', 'market'],
        threshold: 64,
        evidenceRequirement: 'corroborated',
      },
    ],
    questionsAnswered: [
      'Which countries show simultaneous fiscal and political pressure?',
      'Where are protests turning into broader instability?',
      'Which sovereign risks could become market-moving?',
    ],
    premiumUpsell: 'Add premium sovereign, CDS, and political-risk datasets for more granular pricing and forecast layers.',
  },
  {
    id: 'humanitarian-health-watch',
    name: 'Humanitarian & Health Watch',
    tagline: 'Track displacement, humanitarian updates, and public-health signals together.',
    description: 'Combines UNHCR displacement flows with ReliefWeb situation reports, WHO GHO outbreak indicators, and crisis headlines.',
    domain: 'geopolitics',
    compatibleVariants: ['full', 'conflicts', 'finance'],
    datasetIds: ['conflict-intensity-scores', 'sovereign-risk-index'],
    recommendedPanels: ['displacement', 'live-news', 'climate', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['displacement', 'conflicts', 'hotspots'],
    recommendedSources: ['WHO', 'UNHCR', 'ReliefWeb', 'WHO GHO', 'IAEA'],
    monitorTemplates: [
      { name: 'Humanitarian crisis', keywords: ['humanitarian', 'displacement', 'refugee', 'idp', 'aid convoy'] },
      { name: 'Outbreak watch', keywords: ['measles', 'cholera', 'mpox', 'outbreak', 'epidemic'] },
    ],
    alertRuleTemplates: [
      {
        name: 'Humanitarian escalation',
        keywords: ['humanitarian', 'displacement', 'refugee', 'famine', 'aid access'],
        region: 'global',
        signalTypes: ['news', 'infrastructure'],
        threshold: 60,
        evidenceRequirement: 'corroborated',
      },
      {
        name: 'Public health alert',
        keywords: ['measles', 'cholera', 'outbreak', 'epidemic', 'who alert'],
        region: 'global',
        signalTypes: ['news', 'weather'],
        threshold: 58,
        evidenceRequirement: 'any',
      },
    ],
    questionsAnswered: [
      'Where are displacement and humanitarian pressures intensifying?',
      'Are outbreak indicators aligning with crisis headlines?',
      'Which regions need faster aid-access monitoring?',
    ],
    premiumUpsell: 'Add commercial health surveillance and logistics datasets for hospital capacity and supply-route visibility.',
  },
  {
    id: 'aviation-weather-desk',
    name: 'Aviation Weather Desk',
    tagline: 'Monitor flight activity, airport stress, and active aviation weather hazards.',
    description: 'Pairs live flight tracking with Aviation SIGMET hazards for operational weather and delay risk.',
    domain: 'infrastructure',
    compatibleVariants: ['full', 'tech', 'finance'],
    datasetIds: ['energy-infrastructure-map'],
    recommendedPanels: ['airline-intel', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['flights', 'weather'],
    recommendedSources: ['Aviation SIGMET'],
    monitorTemplates: [
      { name: 'Aviation weather', keywords: ['sigmet', 'turbulence', 'volcanic ash', 'icing', 'convective'] },
      { name: 'Airport disruption', keywords: ['ground stop', 'ground delay', 'airport closure', 'diversion'] },
    ],
    alertRuleTemplates: [
      {
        name: 'SIGMET hazard',
        keywords: ['sigmet', 'turbulence', 'volcanic ash', 'icing', 'thunderstorm'],
        region: 'global',
        signalTypes: ['weather', 'infrastructure'],
        threshold: 55,
        evidenceRequirement: 'any',
      },
      {
        name: 'Aviation disruption',
        keywords: ['ground stop', 'ground delay', 'airport closure', 'flight cancellation'],
        region: 'global',
        signalTypes: ['news', 'infrastructure'],
        threshold: 62,
        evidenceRequirement: 'corroborated',
      },
    ],
    questionsAnswered: [
      'Which corridors have active aviation weather hazards?',
      'Are SIGMETs clustering near high-traffic hubs?',
      'Where should operators expect delay or diversion risk?',
    ],
    premiumUpsell: 'Add commercial NOTAM, ATC flow, and fleet-position datasets for finer delay forecasting.',
  },
  {
    id: 'markets-defi-intel',
    name: 'Markets & DeFi Intel',
    tagline: 'Follow macro indicators, crypto liquidity, and prediction-market sentiment.',
    description: 'Combines DefiLlama protocol TVL, Global Indicators macro cards, Manifold forecasts, and market panels.',
    domain: 'markets',
    compatibleVariants: ['full', 'tech', 'finance'],
    datasetIds: ['ai-defense-quote-board'],
    recommendedPanels: ['crypto', 'economic', 'polymarket', 'markets', 'monitors', 'alert-rules', 'marketplace'],
    recommendedLayers: ['hotspots'],
    recommendedSources: ['DefiLlama', 'Global Indicators', 'Manifold'],
    monitorTemplates: [
      { name: 'DeFi liquidity', keywords: ['defi', 'tvl', 'stablecoin', 'liquidity', 'protocol exploit'] },
      { name: 'Macro & forecasts', keywords: ['rate cut', 'inflation', 'treasury yield', 'prediction market', 'recession'] },
    ],
    alertRuleTemplates: [
      {
        name: 'DeFi stress signal',
        keywords: ['defi', 'tvl', 'stablecoin depeg', 'protocol hack', 'liquidity crunch'],
        region: 'global',
        signalTypes: ['news', 'market'],
        threshold: 60,
        evidenceRequirement: 'corroborated',
      },
      {
        name: 'Macro shift watch',
        keywords: ['rate hike', 'rate cut', 'cpi', 'treasury', 'recession odds'],
        region: 'global',
        signalTypes: ['news', 'market'],
        threshold: 58,
        evidenceRequirement: 'any',
      },
    ],
    questionsAnswered: [
      'Is DeFi liquidity concentrating or draining from key protocols?',
      'Are macro indicators and prediction markets diverging?',
      'Which market themes are gaining forecast probability mass?',
    ],
    premiumUpsell: 'Add commercial fund-flow, on-chain, and institutional positioning datasets for sharper market timing.',
  },
];

export function getMissionPack(id: string): MissionPack | undefined {
  return MISSION_PACKS.find((pack) => pack.id === id);
}
