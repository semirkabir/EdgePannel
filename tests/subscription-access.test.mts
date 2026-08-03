import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessFeatureForState, hasTierAccess } from '../src/services/feature-entitlements';
import {
  PLAYBACK_WINDOW_FREE_MS,
  PLAYBACK_WINDOW_LOGGED_IN_MS,
  PLAYBACK_WINDOW_PRO_MS,
  getPlaybackWindowMsForAccess,
} from '../src/services/subscription-entitlements';

describe('feature entitlement checks', () => {
  it('treats paid tiers as ordered access levels', () => {
    assert.equal(hasTierAccess('business', 'pro'), true);
    assert.equal(hasTierAccess('pro', 'business'), false);
  });

  it('allows login-only features for authenticated free users', () => {
    // `watchlist` is cosmetic/convenience — free with an account, never paywalled.
    assert.equal(
      canAccessFeatureForState('watchlist', { isLoggedIn: true, tier: 'free' }),
      true,
    );
  });

  it('requires an account for login-only features', () => {
    assert.equal(
      canAccessFeatureForState('watchlist', { isLoggedIn: false, tier: 'free' }),
      false,
    );
  });

  it('paywalls historical playback at the entry paid tier', () => {
    // Moved from login-only to `enthusiast` in the 2026-07-24 freemium switch:
    // history/tracking is one of the three paywalled families.
    assert.equal(
      canAccessFeatureForState('historical-playback', { isLoggedIn: true, tier: 'free' }),
      false,
    );
    assert.equal(
      canAccessFeatureForState('historical-playback', { isLoggedIn: true, tier: 'enthusiast' }),
      true,
    );
  });

  it('maps legacy paid tiers up rather than denying access', () => {
    // Stored tiers from before the switch must never lose access.
    assert.equal(canAccessFeatureForState('marketplace', { isLoggedIn: true, tier: 'business' }), true);
    assert.equal(canAccessFeatureForState('ai-summaries', { isLoggedIn: true, tier: 'premium' }), true);
    // An unknown tier still fails closed.
    assert.equal(canAccessFeatureForState('marketplace', { isLoggedIn: true, tier: 'bogus' as never }), false);
  });

  it('blocks paid-only features for authenticated free users', () => {
    assert.equal(
      canAccessFeatureForState('marketplace', { isLoggedIn: true, tier: 'free' }),
      false,
    );
  });

  it('allows paid-only features once the tier is upgraded', () => {
    assert.equal(
      canAccessFeatureForState('marketplace', { isLoggedIn: true, tier: 'pro' }),
      true,
    );
  });
});

describe('playback entitlement windows', () => {
  it('uses the anonymous window for signed-out users', () => {
    assert.equal(getPlaybackWindowMsForAccess(false, false), PLAYBACK_WINDOW_FREE_MS);
  });

  it('uses the logged-in window for free accounts', () => {
    assert.equal(getPlaybackWindowMsForAccess(true, false), PLAYBACK_WINDOW_LOGGED_IN_MS);
  });

  it('uses the paid window for subscribers', () => {
    assert.equal(getPlaybackWindowMsForAccess(true, true), PLAYBACK_WINDOW_PRO_MS);
  });
});
