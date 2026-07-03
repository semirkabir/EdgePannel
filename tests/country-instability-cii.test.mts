import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCII,
  clearCountryData,
  getPreviousScores,
  getTopUnstableCountries,
  ingestProtestsForCII,
  ingestConflictsForCII,
  resetHotspotActivity,
} from '../src/services/country-instability.ts';
import type { SocialUnrestEvent } from '../src/types';
import type { ConflictEvent } from '../src/services/conflict';

// ── Fixture builders ─────────────────────────────────────────────────────

function protest(country: string, i: number, over: Partial<SocialUnrestEvent> = {}): SocialUnrestEvent {
  return {
    id: `protest-${country}-${i}`,
    title: `Unrest event ${i}`,
    eventType: 'riot',
    country,
    lat: 50.45,
    lon: 30.52,
    time: new Date(),
    severity: 'high',
    fatalities: 2,
    sources: ['acled'],
    sourceType: 'acled',
    confidence: 'high',
    ...over,
  };
}

function conflict(country: string, i: number, over: Partial<ConflictEvent> = {}): ConflictEvent {
  return {
    id: `conflict-${country}-${i}`,
    eventType: 'battle',
    subEventType: 'armed_clash',
    country,
    location: 'Frontline',
    lat: 48.0,
    lon: 37.8,
    time: new Date(),
    fatalities: 10,
    actors: ['Actor A', 'Actor B'],
    source: 'acled',
    ...over,
  };
}

function scoreOf(country: string): number {
  const entry = calculateCII().find((s) => s.name === country || s.code === country);
  assert.ok(entry, `expected ${country} to appear in CII output`);
  return entry!.score;
}

function entryOf(country: string) {
  const entry = calculateCII().find((s) => s.name === country);
  assert.ok(entry, `expected ${country} to appear in CII output`);
  return entry!;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('calculateCII', () => {
  beforeEach(() => {
    // These live in module-level singletons and are NOT reset by clearCountryData,
    // so they must be cleared explicitly to keep tests independent.
    clearCountryData();
    resetHotspotActivity();
    getPreviousScores().clear();
  });

  it('zeroes the event-driven components when no live events are ingested', () => {
    const entry = entryOf('Ukraine');
    // unrest/conflict/security/information are purely event-driven; economic carries
    // a structural baseline, so it is not asserted to be zero here.
    assert.equal(entry.components.unrest, 0, 'unrest');
    assert.equal(entry.components.conflict, 0, 'conflict');
    assert.equal(entry.components.security, 0, 'security');
    assert.equal(entry.components.information, 0, 'information');
    assert.ok(entry.score >= 0 && entry.score <= 100, `baseline score in range, got ${entry.score}`);
  });

  it('raises a country above its frozen baseline once live events are ingested (regression: CII unfreeze)', () => {
    // Baseline-only score (the "frozen" fallback the panel was stuck on).
    const baselineScore = scoreOf('Ukraine');

    ingestProtestsForCII([0, 1, 2, 3, 4].map((i) => protest('Ukraine', i)));
    ingestConflictsForCII([0, 1, 2, 3, 4].map((i) => conflict('Ukraine', i)));

    const live = entryOf('Ukraine');
    assert.ok(
      live.score > baselineScore,
      `live score (${live.score}) should exceed baseline-only score (${baselineScore})`,
    );
    // The bug manifested as components stuck at 0 despite real-world events.
    assert.ok(live.components.unrest > 0, 'unrest component should reflect ingested protests');
    assert.ok(live.components.conflict > 0, 'conflict component should reflect ingested conflicts');
  });

  it('drops event-driven components back to zero when a fresh empty ingest arrives (regression: stale data)', () => {
    ingestProtestsForCII([protest('Ukraine', 0)]);
    ingestConflictsForCII([conflict('Ukraine', 0)]);
    const live = entryOf('Ukraine');
    assert.ok(live.components.unrest > 0 && live.components.conflict > 0, 'sanity: events populated components');

    // A subsequent ingest with no events must not leave stale event scores behind.
    ingestProtestsForCII([]);
    ingestConflictsForCII([]);
    const cleared = entryOf('Ukraine');
    assert.equal(cleared.components.unrest, 0, 'stale unrest cleared');
    assert.equal(cleared.components.conflict, 0, 'stale conflict cleared');
  });

  it('clamps scores to the 0–100 range under extreme event volume', () => {
    const protests = Array.from({ length: 500 }, (_, i) => protest('Ukraine', i, { fatalities: 50 }));
    const conflicts = Array.from({ length: 500 }, (_, i) => conflict('Ukraine', i, { fatalities: 500 }));
    ingestProtestsForCII(protests);
    ingestConflictsForCII(conflicts);

    for (const s of calculateCII()) {
      assert.ok(s.score >= 0 && s.score <= 100, `${s.name} score ${s.score} out of range`);
    }
  });

  it('reports change24h as the delta from the previous calculation', () => {
    // First calculation seeds previousScores; change24h is 0 on the first pass.
    const first = entryOf('Ukraine');
    assert.equal(first.change24h, 0, 'first pass has no prior score to diff against');
    const firstScore = first.score;

    ingestProtestsForCII([0, 1, 2, 3, 4].map((i) => protest('Ukraine', i)));
    ingestConflictsForCII([0, 1, 2, 3, 4].map((i) => conflict('Ukraine', i)));

    const second = entryOf('Ukraine');
    assert.equal(second.change24h, second.score - firstScore, 'change24h tracks the prior score');
    assert.ok(second.change24h > 0, 'ingesting events should produce a positive 24h change');
  });
});

describe('getTopUnstableCountries', () => {
  beforeEach(() => {
    // These live in module-level singletons and are NOT reset by clearCountryData,
    // so they must be cleared explicitly to keep tests independent.
    clearCountryData();
    resetHotspotActivity();
    getPreviousScores().clear();
  });

  it('returns at most `limit` entries sorted by descending score', () => {
    ingestConflictsForCII([0, 1, 2].map((i) => conflict('Ukraine', i)));

    const top = getTopUnstableCountries(5);
    assert.ok(top.length <= 5, 'respects the limit');
    for (let i = 1; i < top.length; i++) {
      assert.ok(top[i - 1]!.score >= top[i]!.score, 'sorted by descending score');
    }
  });
});
