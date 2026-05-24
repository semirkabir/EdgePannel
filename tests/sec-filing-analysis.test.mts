import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMetricsFromFacts,
  classifyFilingType,
  findFilingRecord,
  recentToRecords,
} from '../server/worldmonitor/market/v1/sec-edgar.ts';

test('classifies common SEC form families', () => {
  assert.equal(classifyFilingType('10-K'), 'periodic');
  assert.equal(classifyFilingType('10-Q'), 'periodic');
  assert.equal(classifyFilingType('8-K'), 'current');
  assert.equal(classifyFilingType('S-1'), 'registration');
  assert.equal(classifyFilingType('DEF 14A'), 'proxy');
  assert.equal(classifyFilingType('SC 13D'), 'ownership');
  assert.equal(classifyFilingType('4'), 'insider');
  assert.equal(classifyFilingType('X-UNKNOWN'), 'other');
});

test('parses SEC submissions recent filings from filings.recent', () => {
  const records = recentToRecords({
    name: 'Test Co',
    filings: {
      recent: {
        accessionNumber: ['0000000000-25-000001'],
        filingDate: ['2025-02-01'],
        reportDate: ['2024-12-31'],
        form: ['10-K'],
        primaryDocument: ['test-20241231.htm'],
        primaryDocDescription: ['Annual report'],
      },
    },
  }, '0000000000');

  assert.equal(records.length, 1);
  assert.equal(records[0]?.filingType, '10-K');
  assert.equal(records[0]?.title, 'Annual report');
  assert.match(records[0]?.url ?? '', /Archives\/edgar\/data\/0\/000000000025000001\/test-20241231\.htm$/);
});

test('finds filing records by accession before falling back to form type', () => {
  const records = recentToRecords({
    filings: {
      recent: {
        accessionNumber: ['0000000000-25-000001', '0000000000-25-000002'],
        filingDate: ['2025-02-01', '2025-05-01'],
        form: ['10-K', '8-K'],
        primaryDocument: ['annual.htm', 'current.htm'],
        primaryDocDescription: ['Annual report', 'Current report'],
      },
    },
  }, '0000000000');

  assert.equal(findFilingRecord(records, '000000000025000002', '10-K')?.filingType, '8-K');
  assert.equal(findFilingRecord(records, '', '10-K')?.accessionNumber, '0000000000-25-000001');
});

test('extracts SEC company facts and computes YoY metrics', () => {
  const facts = {
    facts: {
      'us-gaap': {
        Revenues: {
          units: {
            USD: [
              { val: 100, fy: 2023, fp: 'FY', form: '10-K', filed: '2024-02-01', start: '2023-01-01', end: '2023-12-31', accn: '0000000000-24-000001' },
              { val: 125, fy: 2024, fp: 'FY', form: '10-K', filed: '2025-02-01', start: '2024-01-01', end: '2024-12-31', accn: '0000000000-25-000001' },
            ],
          },
        },
        NetIncomeLoss: {
          units: {
            USD: [
              { val: 10, fy: 2024, fp: 'FY', form: '10-K', filed: '2025-02-01', start: '2024-01-01', end: '2024-12-31', accn: '0000000000-25-000001' },
            ],
          },
        },
      },
    },
  };

  const metrics = buildMetricsFromFacts(facts as any, {
    accessionNumber: '0000000000-25-000001',
    filingType: '10-K',
    filedAt: '2025-02-01',
    reportDate: '2024-12-31',
    acceptanceDateTime: '',
    title: 'Annual report',
    primaryDocument: 'annual.htm',
    url: 'https://example.com/annual.htm',
    items: '',
  }, '10-K');

  const revenue = metrics.find(metric => metric.id === 'revenue');
  const netIncome = metrics.find(metric => metric.id === 'netIncome');

  assert.equal(revenue?.value, 125);
  assert.equal(revenue?.hasYoy, true);
  assert.equal(revenue?.yoy, 0.25);
  assert.equal(netIncome?.formattedValue, '$10');
});
