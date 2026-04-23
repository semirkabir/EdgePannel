import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPortfolioInsights,
  computeInstitutionStructure,
  computeLargestTradeDeltas,
  estimateHoldingsFromTrades,
  groupTradesByQuarter,
  type CongressTrade,
  type InstitutionalHolding,
} from '../src/services/market/portfolio';

function trade(overrides: Partial<CongressTrade>): CongressTrade {
  return {
    politician: 'Jane Doe',
    chamber: 'House',
    ticker: 'AAPL',
    assetDescription: 'Apple Inc.',
    transactionType: 'Purchase',
    transactionDate: '2025-01-15',
    disclosureDate: '2025-02-01',
    amount: '$1,001 - $15,000',
    party: 'I',
    district: '1',
    state: 'CA',
    ...overrides,
  };
}

describe('portfolio helper contracts', () => {
  it('groups trades by quarter with buys and sells aliases populated', () => {
    const grouped = groupTradesByQuarter([
      trade({ transactionDate: '2025-01-15', transactionType: 'Purchase' }),
      trade({ transactionDate: '2025-01-20', transactionType: 'Sale' }),
      trade({ transactionDate: '2025-02-05', transactionType: 'Purchase' }),
    ]);

    assert.equal(grouped.length, 2);
    assert.equal(grouped[0]?.quarter, '2025-01');
    assert.equal(grouped[0]?.buys, 1);
    assert.equal(grouped[0]?.sells, 1);
    assert.equal(grouped[0]?.totalBuys, 1);
    assert.equal(grouped[0]?.totalSells, 1);
  });

  it('estimates holdings with display-safe value and percentage fields', () => {
    const holdings = estimateHoldingsFromTrades([
      trade({ ticker: 'AAPL', assetDescription: 'Apple Inc.', amount: '$1,001 - $15,000' }),
      trade({ ticker: 'MSFT', assetDescription: 'Microsoft Corp.', amount: '$15,001 - $50,000' }),
    ]);

    assert.equal(holdings.length, 2);
    assert.equal(holdings[0]?.ticker, 'MSFT');
    assert.equal(holdings[0]?.name, 'Microsoft Corp.');
    assert.ok((holdings[0]?.estimatedValue ?? 0) > 0);
    assert.ok((holdings[0]?.percentage ?? 0) > 0);
  });

  it('computes institution sector allocation with percentage aliases', () => {
    const holdings: InstitutionalHolding[] = [
      { issuer: 'AAPL', title: 'Common Stock', cusip: 'x1', value: 75, shares: 10 },
      { issuer: 'JPM', title: 'Common Stock', cusip: 'x2', value: 25, shares: 5 },
    ];

    const structure = computeInstitutionStructure(holdings);
    assert.equal(structure[0]?.sector, 'Technology');
    assert.equal(structure[0]?.pct, 75);
    assert.equal(structure[0]?.percentage, 75);
  });

  it('builds institution deltas with renderer-facing labels and values', () => {
    const deltas = computeLargestTradeDeltas([
      { issuer: 'AAPL', title: 'Common Stock', cusip: 'x1', value: 75, shares: 10 },
      { issuer: 'JPM', title: 'Common Stock', cusip: 'x2', value: 25, shares: 5 },
    ]);

    assert.equal(deltas[0]?.label, 'AAPL');
    assert.equal(deltas[0]?.detail, 'Common Stock');
    assert.equal(deltas[0]?.estimatedValue, 75);
    assert.equal(deltas[0]?.percentage, 75);
  });

  it('builds insights for politician and institution inputs', () => {
    const politicianInsights = buildPortfolioInsights({
      kind: 'politician',
      trades: [trade({})],
      estimatedHoldings: estimateHoldingsFromTrades([trade({})]),
      quarterly: groupTradesByQuarter([trade({})]),
    });
    const institutionInsights = buildPortfolioInsights({
      kind: 'institution',
      holdings: [{ issuer: 'AAPL', title: 'Common Stock', cusip: 'x1', value: 75, shares: 10 }],
      structure: [{ sector: 'Technology', value: 75, pct: 100, percentage: 100 }],
      totalValue: 75,
    });

    assert.ok(politicianInsights.length > 0);
    assert.ok(institutionInsights.length > 0);
  });
});
