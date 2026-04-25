export type FeatureTier = 'free' | 'pro' | 'business' | 'enterprise';
export type LegacyTier = FeatureTier | 'logged_in' | 'premium';

export interface Feature {
  key: string;
  name: string;
  tier: LegacyTier;
  description?: string;
}

export const FEATURES: Feature[] = [
  { key: 'breaking-alerts', name: 'Breaking News Alerts', tier: 'free' },
  { key: 'intelligence-findings', name: 'Intelligence Findings', tier: 'logged_in' },
  { key: 'watchlist', name: 'Custom Watchlist', tier: 'logged_in' },
  { key: 'ai-summaries', name: 'AI Summaries', tier: 'logged_in' },
  { key: 'prediction-markets', name: 'Prediction Markets', tier: 'logged_in' },
  { key: 'historical-playback', name: 'Historical Playback', tier: 'logged_in' },
  { key: 'custom-panels', name: 'Custom Panel Layouts', tier: 'logged_in' },
  { key: 'alert-rules', name: 'Alert Rules Engine', tier: 'logged_in' },
  { key: 'export-data', name: 'Export Data', tier: 'pro' },
  { key: 'api-access', name: 'API Access', tier: 'pro' },
  { key: 'marketplace', name: 'Data Marketplace', tier: 'pro' },
  { key: 'mcp-access', name: 'MCP Agent API', tier: 'pro' },
];

const FEATURE_TIER_ORDER: Record<FeatureTier, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

function normalizeFeatureTier(tier: LegacyTier): FeatureTier | 'logged_in' {
  if (tier === 'premium') return 'pro';
  if (tier === 'logged_in') return 'logged_in';
  return tier;
}

export function hasTierAccess(currentTier: FeatureTier, requiredTier: FeatureTier): boolean {
  return FEATURE_TIER_ORDER[currentTier] >= FEATURE_TIER_ORDER[requiredTier];
}

export function canAccessFeatureForState(
  featureKey: string,
  auth: { isLoggedIn: boolean; tier: FeatureTier },
): boolean {
  const feature = FEATURES.find(f => f.key === featureKey);
  if (!feature) return true;

  const requiredTier = normalizeFeatureTier(feature.tier);
  if (requiredTier === 'logged_in') {
    return auth.isLoggedIn;
  }
  if (requiredTier === 'free') {
    return true;
  }
  return auth.isLoggedIn && hasTierAccess(auth.tier, requiredTier);
}
