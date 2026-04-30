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
