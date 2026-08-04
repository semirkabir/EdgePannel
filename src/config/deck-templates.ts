import type { MarketplaceCommercialMetadata, MarketplaceVariant } from '@/types/marketplace';

/**
 * Starter presets for the Marketplace's "Decks" tab — pick a theme, get a
 * fresh named workspace with exactly that panel set, rather than building one
 * widget-by-widget. `map` is always kept enabled regardless of the list below.
 *
 * `author` + `commercial` mirror `MarketplaceManifest` so decks are a
 * purchasable/downloadable catalog item just like widgets and data sources —
 * built-in templates are simply an `author: 'World Monitor'` / `access:
 * 'included'` case, not a structurally different thing from a creator-sold deck.
 */
export interface DeckTemplate {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  author: string;
  commercial: MarketplaceCommercialMetadata;
  compatibleVariants: MarketplaceVariant[];
  recommendedPanels: string[];
}

const BUILT_IN: Pick<DeckTemplate, 'author' | 'commercial'> = {
  author: 'World Monitor',
  commercial: { access: 'included', tier: 'free' },
};

export const DECK_TEMPLATES: DeckTemplate[] = [
  {
    id: 'command-center',
    name: 'Command Center',
    icon: '🛰️',
    tagline: 'Full-spectrum situational awareness.',
    description: 'Live news, AI insights, instability index, and strategic risk alongside the world map.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'conflicts'],
    recommendedPanels: ['map', 'live-news', 'insights', 'strategic-posture', 'cii', 'strategic-risk', 'world-clock'],
  },
  {
    id: 'osint-social',
    name: 'OSINT & Social',
    icon: '🔎',
    tagline: 'Open-source intelligence, at a glance.',
    description: 'Live webcams, Telegram intel, live intelligence feeds, and monitors for open-source signal.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'conflicts'],
    recommendedPanels: ['map', 'live-webcams', 'telegram-intel', 'gdelt-intel', 'monitors', 'live-news'],
  },
  {
    id: 'markets-finance',
    name: 'Markets & Finance',
    icon: '📈',
    tagline: 'Real-time markets and trade flows.',
    description: 'Indices, commodities, macro signals, and trade-flow data in one view.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'finance', 'commodity'],
    recommendedPanels: ['map', 'markets', 'watchlist', 'commodities', 'macro-signals', 'trade-policy', 'economic'],
  },
  {
    id: 'war-conflict',
    name: 'War & Conflict',
    icon: '⚔️',
    tagline: 'Active conflicts and force posture.',
    description: 'Strategic risk, incident briefs, conflict event tracking, and security advisories.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'conflicts'],
    recommendedPanels: ['map', 'strategic-risk', 'incident-briefs', 'ucdp-events', 'security-advisories', 'monitors'],
  },
  {
    id: 'environment-climate',
    name: 'Environment & Climate',
    icon: '🌎',
    tagline: 'Severe weather, quakes, and climate trends.',
    description: 'Satellite fire detection and climate signals alongside the world map.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'commodity', 'conflicts'],
    recommendedPanels: ['map', 'satellite-fires', 'climate'],
  },
  {
    id: 'energy-resources',
    name: 'Energy & Resources',
    icon: '⚡',
    tagline: 'Oil, gas, and supply-chain intelligence.',
    description: 'Energy markets and global supply-chain data alongside the world map.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'commodity'],
    recommendedPanels: ['map', 'energy', 'supply-chain', 'commodities'],
  },
  {
    id: 'aviation-space',
    name: 'Aviation & Space',
    icon: '✈️',
    tagline: 'Flights and airspace intelligence.',
    description: 'Airline intelligence alongside the world map. Dedicated space-tracking widgets are still on the roadmap.',
    ...BUILT_IN,
    compatibleVariants: ['full', 'conflicts'],
    recommendedPanels: ['map', 'airline-intel', 'world-clock'],
  },
];
