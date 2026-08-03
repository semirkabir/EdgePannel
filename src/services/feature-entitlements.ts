// Tier ladder. `free` is the anonymous/no-cost default (shown as "Hobbyist");
// the four paid tiers ascend from there. Keep this list, its order, and the
// legacy alias map in sync with api/_subscription.js.
export type FeatureTier = 'free' | 'enthusiast' | 'analyst' | 'strategist' | 'maximalist';
// `logged_in` = free but requires an account. `premium`/`pro`/`business`/
// `enterprise` are legacy values kept so old stored tiers and old feature
// declarations still resolve.
export type LegacyTier = FeatureTier | 'logged_in' | 'premium' | 'pro' | 'business' | 'enterprise';

export interface Feature {
  key: string;
  name: string;
  tier: LegacyTier;
  description?: string;
}

// Single source of truth for what unlocks where. The settings modal and the
// marketing /pricing page both read this so the ladder can never drift between
// them. Data feeds, map layers, lenses, the globe and ⌘K commander are NOT
// listed here — they are always free for everyone, with or without an account.
export const FEATURES: Feature[] = [
  // Free, no account
  { key: 'breaking-alerts', name: 'Breaking News Alerts', tier: 'free' },

  // Free, requires an account (cosmetic & convenience — never paywalled)
  { key: 'intelligence-findings', name: 'Intelligence Findings', tier: 'logged_in' },
  { key: 'watchlist', name: 'Custom Watchlist', tier: 'logged_in' },
  { key: 'prediction-markets', name: 'Prediction Markets', tier: 'logged_in' },
  { key: 'custom-panels', name: 'Custom Panel Layouts', tier: 'logged_in' },
  { key: 'premium-themes', name: 'Premium Themes', tier: 'logged_in' },

  // Enthusiast — entry paid tier
  { key: 'ai-summaries', name: 'AI Summaries', tier: 'enthusiast' },
  { key: 'country-pulse', name: 'Country-Level Instability Scores', tier: 'enthusiast' },
  { key: 'historical-playback', name: '30-Day Historical Playback', tier: 'enthusiast' },
  { key: 'alert-rules', name: 'Custom Alert Rules', tier: 'enthusiast' },

  // Analyst — the popular tier; also home to the former "pro" power features
  { key: 'ai-analyst-chat', name: 'AI Analyst Chat', tier: 'analyst' },
  { key: 'situation-reports', name: 'AI Situation Reports', tier: 'analyst' },
  { key: 'object-tracking', name: 'Live Object Tracking', tier: 'analyst' },
  { key: 'realtime-alerts', name: 'Real-Time Alert Checks', tier: 'analyst' },
  { key: 'webhook-alerts', name: 'Webhook Alert Delivery', tier: 'analyst' },
  { key: 'export-data', name: 'Export Data', tier: 'analyst' },
  { key: 'api-access', name: 'API Access', tier: 'analyst' },
  { key: 'marketplace', name: 'Data Marketplace', tier: 'analyst' },
  { key: 'mcp-access', name: 'MCP Agent API', tier: 'analyst' },

  // Strategist — heavier monitoring + premium AI
  { key: 'ai-model-selection', name: 'Premium AI Models', tier: 'strategist' },
  { key: 'area-monitors', name: 'Area Monitors', tier: 'strategist' },
];

const FEATURE_TIER_ORDER: Record<FeatureTier, number> = {
  free: 0,
  enthusiast: 1,
  analyst: 2,
  strategist: 3,
  maximalist: 4,
};

/** Legacy stored/declared tiers → current tier ids. Never downgrades access. */
const LEGACY_TIER_ALIASES: Record<string, FeatureTier> = {
  premium: 'enthusiast',
  pro: 'analyst',
  business: 'strategist',
  enterprise: 'maximalist',
};

/** Map any historical tier value onto a current FeatureTier. */
export function canonicalizeTier(value: unknown): FeatureTier {
  if (typeof value !== 'string') return 'free';
  if (value in FEATURE_TIER_ORDER) return value as FeatureTier;
  return LEGACY_TIER_ALIASES[value] ?? 'free';
}

function normalizeFeatureTier(tier: LegacyTier): FeatureTier | 'logged_in' {
  if (tier === 'logged_in') return 'logged_in';
  return canonicalizeTier(tier);
}

/**
 * Both arguments are canonicalized first, so a legacy tier value (`pro`,
 * `business`, …) compares correctly instead of falling through to
 * `undefined >= undefined` — which would deny a legacy subscriber everything,
 * the exact opposite of the "legacy tiers map UP" guarantee above. Unknown
 * strings still canonicalize to `free` and so fail closed.
 */
export function hasTierAccess(currentTier: LegacyTier, requiredTier: LegacyTier): boolean {
  return FEATURE_TIER_ORDER[canonicalizeTier(currentTier)]
    >= FEATURE_TIER_ORDER[canonicalizeTier(requiredTier)];
}

export function canAccessFeatureForState(
  featureKey: string,
  auth: { isLoggedIn: boolean; tier: LegacyTier },
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
