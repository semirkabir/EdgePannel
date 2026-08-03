import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { NewsItem } from '../src/types/index.ts';
import { normalizeAlertRule } from '../src/services/alert-rules.ts';
import {
  selectFiringRules,
  withinWindow,
  isInCooldown,
  deliveryPending,
  RECENCY_WINDOW_MS,
  type AlertRuleFireState,
} from '../src/services/alert-rule-policy.ts';

const NOW = new Date('2026-04-27T12:00:00Z').getTime();

function item(partial: Partial<NewsItem> = {}): NewsItem {
  return {
    source: 'Reuters',
    title: 'Oil pipeline disruption reported near Strait of Hormuz',
    link: 'https://example.com/story',
    pubDate: new Date(NOW),
    isAlert: false,
    tier: 1,
    ...partial,
  };
}

/** Two tier-1/2 sources so evidence reaches 'corroborated'. */
function corroboratedItems(): NewsItem[] {
  return [
    item({ source: 'Reuters', tier: 1 }),
    item({ source: 'AP', tier: 2, link: 'https://example.com/ap' }),
  ];
}

function rule(overrides: Parameters<typeof normalizeAlertRule>[0] = {}) {
  return normalizeAlertRule({
    id: 'r1',
    name: 'Hormuz oil risk',
    keywords: ['oil', 'pipeline'],
    threshold: 60,
    cooldownMinutes: 30,
    ...overrides,
  }, 1);
}

test('a matching active rule is selected', () => {
  const firing = selectFiringRules([rule()], corroboratedItems(), {}, NOW);
  assert.equal(firing.length, 1);
  assert.equal(firing[0]!.rule.id, 'r1');
  assert.ok(firing[0]!.match.matchedKeywords.includes('oil'));
});

test('paused rules never fire', () => {
  const firing = selectFiringRules([rule({ active: false })], corroboratedItems(), {}, NOW);
  assert.equal(firing.length, 0);
});

test('a rule with no keywords or entities is skipped rather than matching everything', () => {
  // This is the state a freshly created rule starts in.
  const firing = selectFiringRules([rule({ keywords: [] })], corroboratedItems(), {}, NOW);
  assert.equal(firing.length, 0);
});

test('items older than the recency window are not evidence', () => {
  const stale = [
    item({ source: 'Reuters', tier: 1, pubDate: new Date(NOW - RECENCY_WINDOW_MS - 60_000) }),
    item({ source: 'AP', tier: 2, pubDate: new Date(NOW - RECENCY_WINDOW_MS - 60_000) }),
  ];
  assert.equal(withinWindow(stale, NOW).length, 0);
  assert.equal(selectFiringRules([rule()], stale, {}, NOW).length, 0);
});

test('cooldown suppresses a re-fire and lapses once elapsed', () => {
  const r = rule({ cooldownMinutes: 30 });
  const firedAt = NOW - 10 * 60_000;
  const state: Record<string, AlertRuleFireState> = { r1: { lastFiredAt: firedAt, signature: 'oil' } };

  assert.equal(isInCooldown(r, state['r1'], NOW), true);
  assert.equal(selectFiringRules([r], corroboratedItems(), state, NOW).length, 0);

  const afterCooldown = firedAt + 31 * 60_000;
  const items = corroboratedItems().map(i => ({ ...i, pubDate: new Date(afterCooldown) }));
  assert.equal(isInCooldown(r, state['r1'], afterCooldown), false);
  assert.equal(selectFiringRules([r], items, state, afterCooldown).length, 1);
});

test('geofenced rule only fires on items inside the zone', () => {
  // Box around the Strait of Hormuz.
  const zone = {
    id: 'z1',
    name: 'Hormuz box',
    ring: [[55, 25], [58, 25], [58, 27], [55, 27], [55, 25]] as Array<[number, number]>,
  };
  const geofenced = rule({ zone, evidenceRequirement: 'any', threshold: 1 });

  const inside = selectFiringRules([geofenced], [
    item({ source: 'Reuters', tier: 1, lat: 26, lon: 56.5 }),
    item({ source: 'AP', tier: 2, lat: 26.2, lon: 56.8, link: 'https://example.com/ap' }),
  ], {}, NOW);
  assert.equal(inside.length, 1);

  const outside = selectFiringRules([geofenced], [
    item({ source: 'Reuters', tier: 1, lat: 10, lon: 10 }),
    item({ source: 'AP', tier: 2, lat: 11, lon: 11, link: 'https://example.com/ap' }),
  ], {}, NOW);
  assert.equal(outside.length, 0);
});

test('deliveryPending reports only the channels with no delivery path', () => {
  assert.deepEqual(deliveryPending(rule({ channels: ['banner', 'desktop', 'email', 'webhook'] })), []);
  assert.deepEqual(deliveryPending(rule({ channels: ['banner', 'telegram'] })), ['telegram']);
});
