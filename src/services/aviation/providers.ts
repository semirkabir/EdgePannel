/**
 * ADS-B provider metadata registry.
 *
 * Centralises provider names, license info, attribution strings, and URLs so
 * that the live aircraft layer, radar overlay, airspace controls, and settings
 * all display consistent, accurate provenance.
 *
 * License notes:
 *  - adsb.lol: ODbL 1.0 (Open Data Commons Open Database License)
 *  - airplanes.live: community-fed, attribution requested
 *  - OpenSky Network: CC-BY 4.0 for academic use, API ToS for commercial
 *  - Wingbits: proprietary enrichment (gated by WINGBITS_API_KEY)
 */

export interface ProviderMetadata {
  id: string;
  name: string;
  shortName: string;
  url: string;
  license: string;
  licenseUrl: string;
  description: string;
  isCommunity: boolean;
  requiresApiKey: boolean;
}

export const PROVIDER_REGISTRY: Record<string, ProviderMetadata> = {
  'adsb.lol': {
    id: 'adsb.lol',
    name: 'ADSB.lol',
    shortName: 'adsb.lol',
    url: 'https://adsb.lol',
    license: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    description: 'Community-fed ADS-B aggregator. Volunteer feeder data available to everyone under the Open Database License.',
    isCommunity: true,
    requiresApiKey: false,
  },
  'airplanes.live': {
    id: 'airplanes.live',
    name: 'Airplanes.live',
    shortName: 'airplanes.live',
    url: 'https://airplanes.live',
    license: 'Community (attribution requested)',
    licenseUrl: 'https://airplanes.live/credits',
    description: 'Community ADS-B feed. Attribution to the feeder network is requested.',
    isCommunity: true,
    requiresApiKey: false,
  },
  'opensky': {
    id: 'opensky',
    name: 'OpenSky Network',
    shortName: 'OpenSky',
    url: 'https://opensky-network.org',
    license: 'CC-BY 4.0 (academic)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    description: 'OpenSky Network ADS-B receiver network. Public rate-limited quota; OAuth credentials unlock higher limits.',
    isCommunity: false,
    requiresApiKey: true,
  },
  'wingbits': {
    id: 'wingbits',
    name: 'Wingbits',
    shortName: 'Wingbits',
    url: 'https://wingbits.com',
    license: 'Proprietary (API key required)',
    licenseUrl: 'https://wingbits.com/terms',
    description: 'Aircraft enrichment metadata — owner, operator, type, registration. Requires API key.',
    isCommunity: false,
    requiresApiKey: true,
  },
  'simulated': {
    id: 'simulated',
    name: 'Simulated (offline)',
    shortName: 'Simulated',
    url: '',
    license: 'N/A',
    licenseUrl: '',
    description: 'Simulated aircraft data — used when no live source is available.',
    isCommunity: false,
    requiresApiKey: false,
  },
  'unknown': {
    id: 'unknown',
    name: 'Unknown provider',
    shortName: 'Unknown',
    url: '',
    license: 'N/A',
    licenseUrl: '',
    description: 'Provider could not be determined.',
    isCommunity: false,
    requiresApiKey: false,
  },
};

/**
 * Resolve a provider ID (matching PositionSample.source or PositionSample.provider)
 * to its metadata. Falls back to 'unknown' for unrecognised strings.
 */
export function getProviderMetadata(providerId: string): ProviderMetadata {
  const normalized = (providerId || '').toLowerCase().trim();
  if (PROVIDER_REGISTRY[normalized]) return PROVIDER_REGISTRY[normalized]!;

  // Fuzzy matching for common variants
  if (normalized.includes('adsb.lol') || normalized.includes('adsblol')) return PROVIDER_REGISTRY['adsb.lol']!;
  if (normalized.includes('airplanes.live') || normalized.includes('airplaneslive')) return PROVIDER_REGISTRY['airplanes.live']!;
  if (normalized.includes('opensky')) return PROVIDER_REGISTRY['opensky']!;
  if (normalized.includes('wingbits')) return PROVIDER_REGISTRY['wingbits']!;
  if (normalized.includes('simulated') || normalized.includes('sim')) return PROVIDER_REGISTRY['simulated']!;

  return PROVIDER_REGISTRY['unknown']!;
}

/**
 * Return a short attribution string suitable for map overlays and UI footers.
 * E.g. "Data: ADSB.lol (ODbL 1.0)" or "Data: OpenSky Network (CC-BY 4.0)".
 */
export function getProviderAttribution(providerId: string): string {
  const meta = getProviderMetadata(providerId);
  if (meta.id === 'unknown' || meta.id === 'simulated') return '';
  return `Data: ${meta.name} (${meta.license})`;
}

/**
 * Return all community (free, no API key) providers for display in settings
 * when a user doesn't have OpenSky credentials.
 */
export function getCommunityProviders(): ProviderMetadata[] {
  return Object.values(PROVIDER_REGISTRY).filter(p => p.isCommunity);
}
