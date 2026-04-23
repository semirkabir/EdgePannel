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
    assert.equal(
      canAccessFeatureForState('historical-playback', { isLoggedIn: true, tier: 'free' }),
      true,
    );
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
