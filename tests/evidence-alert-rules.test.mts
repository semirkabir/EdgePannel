import { strict as assert } from 'node:assert';
import test from 'node:test';
import type { NewsItem } from '../src/types/index.ts';
import { buildSignalEvidenceFromNews } from '../src/services/evidence.ts';
import { evaluateAlertRule, normalizeAlertRule } from '../src/services/alert-rules.ts';

function item(partial: Partial<NewsItem>): NewsItem {
  return {
    source: 'Reuters',
    title: 'Oil pipeline disruption reported near Strait of Hormuz',
    link: 'https://example.com/story',
    pubDate: new Date('2026-04-27T12:00:00Z'),
    isAlert: false,
    tier: 1,
    ...partial,
  };
}

test('signal evidence scores corroborated tiered sources', () => {
  const evidence = buildSignalEvidenceFromNews([
    item({ source: 'Reuters', tier: 1 }),
    item({ source: 'AP', tier: 2, link: 'https://example.com/ap' }),
  ]);
  assert.equal(evidence.verificationState, 'corroborated');
  assert.equal(evidence.corroborationCount, 2);
  assert.ok(evidence.confidence >= 0.8);
});

test('signal evidence marks conflicting reports before corroboration', () => {
  const evidence = buildSignalEvidenceFromNews([
    item({ title: 'Officials deny oil pipeline disruption report', source: 'Reuters', tier: 1 }),
    item({ title: 'Conflicting reports emerge near Strait of Hormuz', source: 'AP', tier: 2 }),
  ]);
  assert.equal(evidence.verificationState, 'conflicting');
  assert.ok(evidence.confidence < 0.8);
});

test('alert rule matching requires keyword and evidence threshold', () => {
  const rule = normalizeAlertRule({
    name: 'Hormuz oil risk',
    keywords: ['oil', 'pipeline'],
    entities: ['Hormuz'],
    signalTypes: ['news', 'infrastructure'],
    threshold: 70,
    evidenceRequirement: 'corroborated',
  }, 1);
  const result = evaluateAlertRule(rule, [
    item({ source: 'Reuters', tier: 1 }),
    item({ source: 'AP', tier: 2, link: 'https://example.com/ap' }),
  ]);
  assert.equal(result.matched, true);
  assert.deepEqual(result.matchedKeywords, ['oil', 'pipeline']);
  assert.deepEqual(result.matchedEntities, ['Hormuz']);
});

test('rules default to match-any mode', () => {
  const rule = normalizeAlertRule({ keywords: ['oil'] }, 1);
  assert.equal(rule.matchMode, 'any');
  assert.equal(rule.zone, null);
});

test('match-all requires every keyword to be present', () => {
  const base = {
    name: 'Strict',
    keywords: ['oil', 'sanctions'],
    threshold: 1,
    evidenceRequirement: 'any' as const,
  };
  const items = [
    item({ source: 'Reuters', tier: 1 }),
    item({ source: 'AP', tier: 2, link: 'https://example.com/ap' }),
  ];

  // 'oil' appears in the fixture title, 'sanctions' does not.
  const strict = evaluateAlertRule(normalizeAlertRule({ ...base, matchMode: 'all' }, 1), items);
  assert.equal(strict.matched, false);
  assert.match(strict.reason, /missing: sanctions/);

  const loose = evaluateAlertRule(normalizeAlertRule({ ...base, matchMode: 'any' }, 1), items);
  assert.equal(loose.matched, true);
});

test('geofenced rules only consider items inside the drawn zone', () => {
  // ~2°-square box around (30N, 50E).
  const zone = {
    id: 'z1',
    name: 'Gulf box',
    ring: [[49, 29], [51, 29], [51, 31], [49, 31], [49, 29]] as Array<[number, number]>,
  };
  const rule = normalizeAlertRule({
    name: 'Zoned oil risk',
    keywords: ['oil'],
    zone,
    threshold: 1,
    evidenceRequirement: 'any',
  }, 1);

  const inside = evaluateAlertRule(rule, [
    item({ lat: 30, lon: 50, source: 'Reuters', tier: 1 }),
    item({ lat: 30.5, lon: 50.5, source: 'AP', tier: 2, link: 'https://example.com/ap' }),
  ]);
  assert.equal(inside.matched, true);
  assert.equal(inside.consideredCount, 2);
  assert.match(inside.reason, /inside Gulf box/);

  // Same headlines, but geolocated far outside the box.
  const outside = evaluateAlertRule(rule, [
    item({ lat: 10, lon: 10, source: 'Reuters', tier: 1 }),
    item({ lat: 12, lon: 12, source: 'AP', tier: 2, link: 'https://example.com/ap' }),
  ]);
  assert.equal(outside.matched, false);
  assert.equal(outside.consideredCount, 0);
  assert.match(outside.reason, /No geolocated items inside Gulf box/);

  // Items with no coordinates can't satisfy a geofence.
  const ungeocoded = evaluateAlertRule(rule, [item({ source: 'Reuters', tier: 1 })]);
  assert.equal(ungeocoded.matched, false);
  assert.equal(ungeocoded.consideredCount, 0);
});

test('a malformed zone degrades to no geofence rather than blocking matches', () => {
  const rule = normalizeAlertRule({
    keywords: ['oil'],
    // Too few points to form a polygon.
    zone: { id: 'bad', name: 'Bad', ring: [[1, 1], [2, 2]] as Array<[number, number]> },
    threshold: 1,
  }, 1);
  assert.equal(rule.zone, null);
  const result = evaluateAlertRule(rule, [item({ source: 'Reuters', tier: 1 })]);
  assert.equal(result.matched, true);
});
