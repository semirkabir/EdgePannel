import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateOptionGreeks, yearsToExpiry } from '../src/services/options/greeks';

test('Black-Scholes Greeks produce expected ATM call values', () => {
  const greeks = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 30 / 365,
    impliedVolatility: 0.2,
    riskFreeRate: 0.05,
    side: 'call',
  });

  assert.ok(greeks);
  assert.ok(greeks.delta > 0.51 && greeks.delta < 0.55, `delta ${greeks.delta}`);
  assert.ok(greeks.gamma > 0.06 && greeks.gamma < 0.08, `gamma ${greeks.gamma}`);
  assert.ok(greeks.theta < -0.03 && greeks.theta > -0.05, `theta ${greeks.theta}`);
  assert.ok(greeks.vega > 0.11 && greeks.vega < 0.12, `vega ${greeks.vega}`);
  assert.ok(greeks.rho > 0.03 && greeks.rho < 0.05, `rho ${greeks.rho}`);
});

test('put delta is negative and volatility accepts percent-style input', () => {
  const greeks = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 30 / 365,
    impliedVolatility: 20,
    riskFreeRate: 0.05,
    side: 'put',
  });

  assert.ok(greeks);
  assert.ok(greeks.delta < -0.45 && greeks.delta > -0.5, `delta ${greeks.delta}`);
});

test('yearsToExpiry floors same-day expiry to one trading day equivalent', () => {
  const years = yearsToExpiry('2026-05-10', new Date('2026-05-10T22:00:00.000Z'));
  assert.equal(years, 1 / 365);
});

test('deep ITM call has delta close to 1', () => {
  // S=150, K=100: ~50% in-the-money — d1 >> 0, N(d1) → 1
  const greeks = calculateOptionGreeks({
    underlyingPrice: 150,
    strikePrice: 100,
    yearsToExpiry: 30 / 365,
    impliedVolatility: 0.2,
    riskFreeRate: 0.05,
    side: 'call',
  });
  assert.ok(greeks);
  assert.ok(greeks.delta > 0.99, `expected delta near 1, got ${greeks.delta}`);
});

test('deep OTM call has delta close to 0', () => {
  // S=50, K=100: 50% out-of-the-money — d1 << 0, N(d1) → 0
  const greeks = calculateOptionGreeks({
    underlyingPrice: 50,
    strikePrice: 100,
    yearsToExpiry: 30 / 365,
    impliedVolatility: 0.2,
    riskFreeRate: 0.05,
    side: 'call',
  });
  assert.ok(greeks);
  assert.ok(greeks.delta < 0.01, `expected delta near 0, got ${greeks.delta}`);
});

test('long expiry ATM call theta is negative and smaller per day than short expiry', () => {
  const short = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 30 / 365,
    impliedVolatility: 0.2,
    riskFreeRate: 0.05,
    side: 'call',
  });
  const long = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 1,
    impliedVolatility: 0.2,
    riskFreeRate: 0.05,
    side: 'call',
  });
  assert.ok(short && long);
  assert.ok(long.theta < 0, `1y theta should be negative, got ${long.theta}`);
  // Theta decay accelerates as expiry approaches: |short theta| > |long theta|
  assert.ok(Math.abs(short.theta) > Math.abs(long.theta),
    `short-dated |theta| ${Math.abs(short.theta)} should exceed long-dated ${Math.abs(long.theta)}`);
});

test('dividend yield reduces call delta compared to no-dividend baseline', () => {
  const noDividend = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 1,
    impliedVolatility: 0.25,
    riskFreeRate: 0.05,
    dividendYield: 0,
    side: 'call',
  });
  const withDividend = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 1,
    impliedVolatility: 0.25,
    riskFreeRate: 0.05,
    dividendYield: 0.04,
    side: 'call',
  });
  assert.ok(noDividend && withDividend);
  assert.ok(withDividend.delta < noDividend.delta,
    `dividend should lower call delta: ${withDividend.delta} vs ${noDividend.delta}`);
});

test('returns null for invalid inputs', () => {
  const base = { strikePrice: 100, yearsToExpiry: 30 / 365, impliedVolatility: 0.2, riskFreeRate: 0.05, side: 'call' as const };
  assert.equal(calculateOptionGreeks({ ...base, underlyingPrice: 0 }), null, 'zero spot');
  assert.equal(calculateOptionGreeks({ ...base, underlyingPrice: -1 }), null, 'negative spot');
  assert.equal(calculateOptionGreeks({ ...base, underlyingPrice: 100, impliedVolatility: 0 }), null, 'zero IV');
  assert.equal(calculateOptionGreeks({ ...base, underlyingPrice: 100, impliedVolatility: -0.1 }), null, 'negative IV');
  assert.equal(calculateOptionGreeks({ ...base, underlyingPrice: 100, yearsToExpiry: 0 }), null, 'zero time');
});

test('put rho is negative', () => {
  // Rho for a put = -K * T * e^(-rT) * N(-d2) / 100, always negative
  const greeks = calculateOptionGreeks({
    underlyingPrice: 100,
    strikePrice: 100,
    yearsToExpiry: 1,
    impliedVolatility: 0.2,
    riskFreeRate: 0.05,
    side: 'put',
  });
  assert.ok(greeks);
  assert.ok(greeks.rho < 0, `put rho should be negative, got ${greeks.rho}`);
});
