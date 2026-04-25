import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getFeaturedInstitutionResults,
  inferFilingCadence,
  mapHoldingIssuerToTicker,
  normalizeInstitutionName,
} from '../src/services/market/normalized-13f.ts';
import type { SecFilingEntry } from '../src/services/market/sec-filings.ts';

test('normalizeInstitutionName removes legal suffixes and punctuation noise', () => {
  assert.equal(
    normalizeInstitutionName('Citadel Advisors, LLC'),
    'citadel advisors',
  );
  assert.equal(
    normalizeInstitutionName('Berkshire Hathaway Inc.'),
    'berkshire hathaway',
  );
});

test('mapHoldingIssuerToTicker maps well-known issuers to tickers', () => {
  assert.equal(mapHoldingIssuerToTicker('APPLE INC'), 'AAPL');
  assert.equal(mapHoldingIssuerToTicker('Microsoft Corp'), 'MSFT');
  assert.equal(mapHoldingIssuerToTicker('Unknown Private Asset'), '');
});

test('inferFilingCadence detects quarterly cadence and amendments', () => {
  const quarterly = inferFilingCadence([
    { filedAt: '2026-02-14T00:00:00.000Z', filingType: '13F-HR' },
    { filedAt: '2025-11-14T00:00:00.000Z', filingType: '13F-HR/A' },
    { filedAt: '2025-08-14T00:00:00.000Z', filingType: '13F-HR' },
  ]);

  assert.equal(quarterly, 'Quarterly cadence with amendments');
});

test('getFeaturedInstitutionResults enriches notable filers with recent filing metadata', () => {
  const filings: SecFilingEntry[] = [
    {
      id: '1',
      title: '13F-HR - Berkshire Hathaway',
      filerName: 'Berkshire Hathaway',
      cik: '1067983',
      filingType: '13F-HR',
      filedAt: new Date('2026-02-14T00:00:00.000Z'),
      url: 'https://example.com/berkshire',
      description: '',
    },
    {
      id: '2',
      title: '13F-HR - Bridgewater Associates',
      filerName: 'Bridgewater Associates',
      cik: '1350694',
      filingType: '13F-HR',
      filedAt: new Date('2026-02-10T00:00:00.000Z'),
      url: 'https://example.com/bridgewater',
      description: '',
    },
  ];

  const featured = getFeaturedInstitutionResults(filings);
  const berkshire = featured.find(entry => entry.cik === '1067983');

  assert.ok(berkshire);
  assert.equal(berkshire?.name, 'Berkshire Hathaway');
  assert.equal(berkshire?.latestFilingType, '13F-HR');
  assert.equal(berkshire?.latestFilingDate, '2026-02-14T00:00:00.000Z');
});
