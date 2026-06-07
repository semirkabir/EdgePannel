import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessConsumerPriceConfidence,
  assessMacroForecastConfidence,
} from '../src/services/macro-data-confidence.ts';

describe('assessMacroForecastConfidence', () => {
  it('flags labor forecasts with source-aware caveats', () => {
    const assessment = assessMacroForecastConfidence({
      domain: 'market',
      title: 'Payroll gains keep Fed policy tight',
      scenario: 'CES payroll jobs keep rising while CPS employment stalls.',
      confidence: 0.62,
      calibration: { source: 'Polymarket', marketTitle: 'Fed cuts in 2026' },
    });

    assert.ok(assessment);
    assert.strictEqual(assessment.tier, 'fragile');
    assert.match(assessment.sourceLabel, /market-implied pricing/);
    assert.ok(assessment.caveats.some(caveat => caveat.includes('payroll jobs diverge')));
    assert.ok(assessment.caveats.some(caveat => caveat.includes('trader consensus')));
  });

  it('does not add caveats to non-macro forecasts', () => {
    const assessment = assessMacroForecastConfidence({
      domain: 'cyber',
      title: 'Regional malware campaign escalates',
      scenario: 'Multiple intrusions target telecom infrastructure.',
      confidence: 0.8,
    });

    assert.strictEqual(assessment, null);
  });
});

describe('assessConsumerPriceConfidence', () => {
  it('downgrades thin or stale retailer collection', () => {
    const assessment = assessConsumerPriceConfidence({
      coveragePct: 45,
      freshnessLagMin: 300,
      stalledCount: 2,
      parseSuccessRates: [0.9, 0.7],
    });

    assert.strictEqual(assessment.tier, 'fragile');
    assert.match(assessment.sourceLabel, /retailer collection/);
    assert.ok(assessment.caveats.some(caveat => caveat.includes('not official CPI')));
    assert.ok(assessment.caveats.some(caveat => caveat.includes('Low product coverage')));
  });

  it('keeps strong coverage distinct from official CPI precision', () => {
    const assessment = assessConsumerPriceConfidence({
      coveragePct: 95,
      freshnessLagMin: 25,
      stalledCount: 0,
      parseSuccessRates: [0.98, 0.96],
    });

    assert.strictEqual(assessment.tier, 'strong');
    assert.ok(assessment.caveats.some(caveat => caveat.includes('not official CPI')));
    assert.ok(assessment.caveats.some(caveat => caveat.includes('imputation mechanics')));
  });
});
