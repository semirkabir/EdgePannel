import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapTemporalBaselineResponse } from '../src/services/temporal-baseline-core';

describe('temporal baseline response mapper', () => {
  it('maps generated anomaly responses into local anomaly shape', () => {
    const anomaly = mapTemporalBaselineResponse('news', 'global', 42, {
      anomaly: { zScore: 3.2, severity: 'critical', multiplier: 2.5 },
      baseline: { mean: 17.4, stdDev: 2, sampleCount: 30 },
      learning: false,
      sampleCount: 30,
      samplesNeeded: 14,
      error: '',
    });

    assert.equal(anomaly?.type, 'news');
    assert.equal(anomaly?.region, 'global');
    assert.equal(anomaly?.currentCount, 42);
    assert.equal(anomaly?.expectedCount, 17);
    assert.equal(anomaly?.zScore, 3.2);
    assert.equal(anomaly?.severity, 'critical');
    assert.match(anomaly?.message ?? '', /News velocity/);
  });

  it('returns null when the generated response has no anomaly', () => {
    const anomaly = mapTemporalBaselineResponse('news', 'global', 10, {
      learning: true,
      sampleCount: 3,
      samplesNeeded: 14,
      error: '',
    });

    assert.equal(anomaly, null);
  });
});
