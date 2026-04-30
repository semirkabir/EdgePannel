import test from 'node:test';
import assert from 'node:assert/strict';

import { createTradePolicySummary } from '../src/services/trade/intelligence.ts';
import { createSupplyChainSummary } from '../src/services/supply-chain/intelligence.ts';

test('trade policy summary derives pressure from tariffs, flows, and barriers', () => {
  const summary = createTradePolicySummary({
    restrictions: {
      restrictions: [{
        id: 'mx-2025',
        reportingCountry: 'Mexico',
        affectedCountry: 'All trading partners',
        productSector: 'All products',
        measureType: 'MFN Applied Tariff',
        description: 'Average tariff rate: 12.5%',
        status: 'high',
        notifiedAt: '2025',
        sourceUrl: 'https://stats.wto.org',
      }],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
    tariffs: {
      datapoints: [
        {
          reportingCountry: 'United States',
          partnerCountry: 'China',
          productSector: 'All products',
          year: 2024,
          tariffRate: 4.5,
          boundRate: 0,
          indicatorCode: 'TP_A_0010',
        },
        {
          reportingCountry: 'United States',
          partnerCountry: 'China',
          productSector: 'All products',
          year: 2025,
          tariffRate: 7.1,
          boundRate: 0,
          indicatorCode: 'TP_A_0010',
        },
      ],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
    flows: {
      flows: [{
        reportingCountry: 'United States',
        partnerCountry: 'China',
        year: 2025,
        exportValueUsd: 120000,
        importValueUsd: 180000,
        yoyExportChange: -12.4,
        yoyImportChange: -4.2,
        productSector: 'Total merchandise',
      }],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
    barriers: {
      barriers: [{
        id: 'ag-gap-2025',
        notifyingCountry: 'India',
        title: 'Agricultural tariff: 34.0% vs Non-agricultural: 9.0% (gap: +25.0pp)',
        measureType: 'High agricultural protection',
        productDescription: 'Agricultural vs Non-agricultural products',
        objective: 'Agricultural sector protection',
        status: 'high',
        dateDistributed: '2025',
        sourceUrl: 'https://stats.wto.org',
      }],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
  });

  assert.equal(summary.stats.highRestrictions, 1);
  assert.equal(summary.stats.highBarriers, 1);
  assert.equal(summary.stats.latestTariffRate, 7.1);
  assert.equal(summary.stats.tariffDelta, 2.5999999999999996);
  assert.equal(summary.stats.tradeBalanceUsd, -60000);
  assert.equal(summary.severity, 'watch');
  assert.ok(summary.insights.some((insight) => insight.id.startsWith('flow-')));
});

test('trade policy summary reports graceful unavailable state', () => {
  const summary = createTradePolicySummary({
    restrictions: { restrictions: [], fetchedAt: '', upstreamUnavailable: true },
    tariffs: { datapoints: [], fetchedAt: '', upstreamUnavailable: true },
    flows: { flows: [], fetchedAt: '', upstreamUnavailable: true },
    barriers: { barriers: [], fetchedAt: '', upstreamUnavailable: true },
  });

  assert.equal(summary.score, 0);
  assert.equal(summary.severity, 'normal');
  assert.equal(summary.stats.upstreamUnavailable, true);
  assert.equal(summary.headline, 'Trade policy data temporarily unavailable');
});

test('supply-chain summary combines chokepoints, freight, and mineral concentration', () => {
  const summary = createSupplyChainSummary({
    chokepoints: {
      chokepoints: [
        {
          id: 'hormuz',
          name: 'Strait of Hormuz',
          lat: 26.56,
          lon: 56.25,
          disruptionScore: 82,
          status: 'red',
          activeWarnings: 2,
          congestionLevel: 'high',
          affectedRoutes: ['Gulf Oil Exports'],
          description: 'Active warnings and vessel disruptions',
          aisDisruptions: 3,
        },
        {
          id: 'panama',
          name: 'Panama Canal',
          lat: 9.08,
          lon: -79.68,
          disruptionScore: 24,
          status: 'yellow',
          activeWarnings: 0,
          congestionLevel: 'low',
          affectedRoutes: ['Atlantic-Pacific Bulk'],
          description: 'Low congestion',
          aisDisruptions: 0,
        },
      ],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
    shipping: {
      indices: [{
        indexId: 'TSIFRGHT',
        name: 'Freight Transportation Services Index',
        currentValue: 140,
        previousValue: 100,
        changePct: 40,
        unit: 'index',
        history: [{ date: '2025-12-01', value: 100 }, { date: '2026-01-01', value: 140 }],
        spikeAlert: true,
      }],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
    minerals: {
      minerals: [{
        mineral: 'Gallium',
        topProducers: [{ country: 'China', countryCode: 'CN', productionTonnes: 600, sharePct: 94 }],
        hhi: 8900,
        riskRating: 'critical',
        globalProduction: 640,
        unit: 'tonnes',
      }],
      fetchedAt: '2026-01-01T00:00:00Z',
      upstreamUnavailable: false,
    },
  });

  assert.equal(summary.stats.redChokepoints, 1);
  assert.equal(summary.stats.yellowChokepoints, 1);
  assert.equal(summary.stats.shippingSpikeCount, 1);
  assert.equal(summary.stats.criticalMinerals, 1);
  assert.equal(summary.severity, 'critical');
  assert.ok(summary.insights.some((insight) => insight.id === 'chokepoint-hormuz'));
});

test('supply-chain summary reports graceful unavailable state', () => {
  const summary = createSupplyChainSummary({
    chokepoints: { chokepoints: [], fetchedAt: '', upstreamUnavailable: true },
    shipping: { indices: [], fetchedAt: '', upstreamUnavailable: true },
    minerals: { minerals: [], fetchedAt: '', upstreamUnavailable: true },
  });

  assert.equal(summary.score, 0);
  assert.equal(summary.severity, 'normal');
  assert.equal(summary.stats.upstreamUnavailable, true);
  assert.equal(summary.headline, 'Supply-chain upstreams temporarily unavailable');
});
