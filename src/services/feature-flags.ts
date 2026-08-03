/**
 * Feature tier management.
 *
 * Integrates with the user-auth system to check tier-based feature access.
 * The tier is stored in Convex and Redis (user:{uid}:tier).
 */

import { isLoggedIn, getCurrentAuthState } from './user-auth';
import {
  FEATURES,
  canAccessFeatureForState,
  hasTierAccess,
  type FeatureTier,
  type LegacyTier,
} from './feature-entitlements';

export { FEATURES, canAccessFeatureForState, hasTierAccess };
export type { FeatureTier, LegacyTier } from './feature-entitlements';

/** Resolve the user's current tier from the auth system. */
export async function getUserTier(): Promise<FeatureTier> {
  return getCurrentAuthState().tier;
}

export function hasPaidSubscription(): boolean {
  const { tier } = getCurrentAuthState();
  return hasTierAccess(tier, 'enthusiast');
}

export function canAccessFeature(featureKey: string): boolean {
  const { tier } = getCurrentAuthState();
  return canAccessFeatureForState(featureKey, { isLoggedIn: isLoggedIn(), tier });
}

export function getFeatureTier(featureKey: string): LegacyTier {
  const feature = FEATURES.find(f => f.key === featureKey);
  return feature?.tier ?? 'free';
}

export function requireFeature(featureKey: string): boolean {
  return canAccessFeature(featureKey);
}
