import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeCurrentReport,
  analyzeHoldingsFiling,
  analyzeInsiderFiling,
  analyzeOwnershipFiling,
  analyzeProxyFiling,
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
  assert.equal(classifyFilingType('DEFA 14A'), 'proxy');
  assert.equal(classifyFilingType('SC 13D'), 'ownership');
  assert.equal(classifyFilingType('13D/A'), 'ownership');
  assert.equal(classifyFilingType('4'), 'insider');
  assert.equal(classifyFilingType('13F-HR'), 'institutional');
  assert.equal(classifyFilingType('NPORT-P'), 'fund');
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

test('extracts 8-K item interpretation and timing metrics', () => {
  const analysis = analyzeCurrentReport('8-K', {
    accessionNumber: '0000000000-25-000002',
    filingType: '8-K',
    filedAt: '2025-05-03',
    reportDate: '2025-05-01',
    acceptanceDateTime: '',
    title: 'Current report',
    primaryDocument: 'current.htm',
    url: 'https://www.sec.gov/Archives/edgar/data/0/000000000025000002/current.htm',
    items: '2.02,9.01',
  }, 'Item 2.02 Results of Operations and Financial Condition Item 9.01 Financial Statements and Exhibits');

  assert.equal(analysis.metrics.find(metric => metric.id === 'currentReportItemCount')?.value, 2);
  assert.equal(analysis.metrics.find(metric => metric.id === 'filingLagDays')?.value, 2);
  assert.ok(analysis.events.some(event => event.label === 'Item 2.02' && event.value.includes('Results of Operations')));
  assert.ok(analysis.bullets.some(bullet => bullet.includes('Detected 2 8-K items')));
});

test('extracts proxy meeting and governance signals', () => {
  const text = [
    'The annual meeting will be held on May 15, 2025.',
    'The record date is March 31, 2025.',
    'Proposal No. 1 Election of Directors.',
    'Proposal No. 2 Advisory vote to approve executive compensation.',
    'This say-on-pay vote is advisory.',
    'Shareholder Proposal regarding governance.',
  ].join(' ');

  const analysis = analyzeProxyFiling('DEF 14A', text, null);

  assert.equal(analysis.events.find(event => event.label === 'Meeting date')?.value, 'May 15, 2025');
  assert.equal(analysis.metrics.find(metric => metric.id === 'proxyProposalCount')?.value, 2);
  assert.equal(analysis.metrics.find(metric => metric.id === 'sayOnPayDetected')?.formattedValue, 'Yes');
  assert.ok(analysis.events.some(event => event.label === 'Director vote'));
});

test('extracts beneficial ownership metrics from Schedule 13D/G text', () => {
  const text = [
    'Item 4. Purpose of Transaction The Reporting Persons may engage with management regarding strategic alternatives. Item 5.',
    'Amount beneficially owned 1,234,567',
    'Percent of class represented by amount in row (11) 7.5%',
    'Sole voting power 100,000',
    'Shared voting power 1,134,567',
  ].join(' ');

  const analysis = analyzeOwnershipFiling('SC 13D', text, null);

  assert.equal(analysis.metrics.find(metric => metric.id === 'beneficialOwnershipPercent')?.value, 7.5);
  assert.equal(analysis.metrics.find(metric => metric.id === 'beneficialShares')?.value, 1234567);
  assert.ok(analysis.events.some(event => event.label === 'Purpose excerpt'));
  assert.ok(analysis.events.some(event => event.value.includes('activist')));
});

test('extracts insider Form 4 transaction rows from XML', () => {
  const xml = `
    <ownershipDocument>
      <issuer><issuerTradingSymbol>TEST</issuerTradingSymbol></issuer>
      <reportingOwner>
        <reportingOwnerId><rptOwnerName>Jane Officer</rptOwnerName></reportingOwnerId>
        <reportingOwnerRelationship><officerTitle>Chief Financial Officer</officerTitle></reportingOwnerRelationship>
      </reportingOwner>
      <nonDerivativeTable>
        <nonDerivativeTransaction>
          <transactionDate><value>2025-05-01</value></transactionDate>
          <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
          <transactionAmounts>
            <transactionShares><value>100</value></transactionShares>
            <transactionPricePerShare><value>12.50</value></transactionPricePerShare>
          </transactionAmounts>
          <postTransactionAmounts><sharesOwnedFollowingTransaction><value>1100</value></sharesOwnedFollowingTransaction></postTransactionAmounts>
        </nonDerivativeTransaction>
        <nonDerivativeTransaction>
          <transactionDate><value>2025-05-02</value></transactionDate>
          <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
          <transactionAmounts>
            <transactionShares><value>40</value></transactionShares>
            <transactionPricePerShare><value>15</value></transactionPricePerShare>
          </transactionAmounts>
        </nonDerivativeTransaction>
      </nonDerivativeTable>
    </ownershipDocument>`;

  const analysis = analyzeInsiderFiling('4', xml, null);

  assert.equal(analysis.events.find(event => event.label === 'Reporting owner')?.value, 'Jane Officer');
  assert.equal(analysis.metrics.find(metric => metric.id === 'insiderTransactionCount')?.value, 2);
  assert.equal(analysis.metrics.find(metric => metric.id === 'insiderNetShares')?.value, 60);
  assert.equal(analysis.metrics.find(metric => metric.id === 'insiderTransactionValue')?.value, 1850);
  assert.equal(analysis.metrics.find(metric => metric.id === 'postTransactionShares')?.value, 1100);
});

test('extracts holdings context from 13F information tables', () => {
  const xml = `
    <informationTable>
      <infoTable>
        <nameOfIssuer>Alpha Corp</nameOfIssuer>
        <titleOfClass>COM</titleOfClass>
        <cusip>000000001</cusip>
        <value>1500</value>
        <shrsOrPrnAmt><sshPrnamt>10000</sshPrnamt></shrsOrPrnAmt>
      </infoTable>
      <infoTable>
        <nameOfIssuer>Beta Inc</nameOfIssuer>
        <titleOfClass>COM</titleOfClass>
        <cusip>000000002</cusip>
        <value>250</value>
        <shrsOrPrnAmt><sshPrnamt>5000</sshPrnamt></shrsOrPrnAmt>
      </infoTable>
    </informationTable>`;

  const analysis = analyzeHoldingsFiling('13F-HR', xml, {
    accessionNumber: '0000000000-25-000003',
    filingType: '13F-HR',
    filedAt: '2025-05-15',
    reportDate: '2025-03-31',
    acceptanceDateTime: '',
    title: '13F holdings report',
    primaryDocument: 'primary.xml',
    url: 'https://www.sec.gov/Archives/edgar/data/0/000000000025000003/primary.xml',
    items: '',
  });

  assert.equal(analysis.metrics.find(metric => metric.id === 'reportedHoldingCount')?.value, 2);
  assert.equal(analysis.metrics.find(metric => metric.id === 'reportedHoldingsValue')?.value, 1750000);
  assert.equal(analysis.metrics.find(metric => metric.id === 'reportedShareUnits')?.value, 15000);
  assert.ok(analysis.events.some(event => event.kind === 'holding' && event.label === 'Alpha Corp'));
  assert.equal(analysis.fallbackReason, '');
});

test('extracts holdings context from fund portfolio XML', () => {
  const xml = `
    <edgarSubmission>
      <formData>
        <invstOrSecs>
          <invstOrSec>
            <name>Gamma Fund Holding</name>
            <title>Common Stock</title>
            <cusip>000000003</cusip>
            <balance>1200</balance>
            <valUSD>45000</valUSD>
            <pctVal>4.5</pctVal>
          </invstOrSec>
        </invstOrSecs>
      </formData>
    </edgarSubmission>`;

  const analysis = analyzeHoldingsFiling('NPORT-P', xml, null);

  assert.equal(analysis.metrics.find(metric => metric.id === 'reportedHoldingCount')?.value, 1);
  assert.equal(analysis.metrics.find(metric => metric.id === 'reportedHoldingsValue')?.value, 45000);
  assert.ok(analysis.events.some(event => event.kind === 'holding' && event.value.includes('4.50% of net assets')));
  assert.equal(analysis.fallbackReason, '');
});
