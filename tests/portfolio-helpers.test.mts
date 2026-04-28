import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addUserPosition,
  buildPortfolioSummary,
  buildPortfolioInsights,
  computeInstitutionStructure,
  computeLargestTradeDeltas,
  createPortfolio,
  estimateHoldingsFromTrades,
  getPortfolioStore,
  getPortfolioTransactions,
  getPortfolios,
  getUserPositions,
  groupTradesByQuarter,
  removeUserPosition,
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

function installLocalStorage(): () => void {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    },
  });

  return () => {
    if (previousDescriptor) Object.defineProperty(globalThis, 'localStorage', previousDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
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
    assert.equal(deltas[0]?.detail, 'Common Stock · x1');
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

  it('migrates legacy positions into the transaction-led portfolio store', () => {
    const restore = installLocalStorage();
    try {
      localStorage.setItem('wm-portfolio-v1', JSON.stringify([
        { symbol: 'AAPL', name: 'Apple Inc.', shares: 4, avgCost: 125, addedAt: '2025-01-10T00:00:00.000Z' },
      ]));

      const store = getPortfolioStore();
      const positions = getUserPositions();

      assert.equal(store.version, 2);
      assert.equal(store.portfolios[0]?.name, 'Default Portfolio');
      assert.equal(store.transactions.length, 1);
      assert.equal(store.transactions[0]?.type, 'BUY');
      assert.equal(positions[0]?.symbol, 'AAPL');
      assert.equal(positions[0]?.shares, 4);
      assert.equal(positions[0]?.avgCost, 125);
    } finally {
      restore();
    }
  });

  it('replays buys and full-position removals through the transaction ledger', () => {
    const restore = installLocalStorage();
    try {
      addUserPosition({ symbol: 'AAPL', name: 'Apple Inc.', shares: 10, avgCost: 100 });
      addUserPosition({ symbol: 'AAPL', name: 'Apple Inc.', shares: 5, avgCost: 160 });

      const beforeRemove = getUserPositions();
      assert.equal(beforeRemove.length, 1);
      assert.equal(beforeRemove[0]?.shares, 15);
      assert.equal(beforeRemove[0]?.avgCost, 120);

      removeUserPosition('AAPL');

      const transactions = getPortfolioTransactions();
      const sell = transactions.find(txn => txn.type === 'SELL');
      assert.equal(getUserPositions().length, 0);
      assert.equal(transactions.length, 3);
      assert.equal(sell?.quantity, 15);
    } finally {
      restore();
    }
  });

  it('builds portfolio summaries with risk metrics and snapshots', () => {
    const restore = installLocalStorage();
    try {
      const portfolio = createPortfolio('Asia Macro Book');
      addUserPosition({ symbol: 'AAPL', name: 'Apple Inc.', shares: 10, avgCost: 100 });
      addUserPosition({ symbol: 'MSFT', name: 'Microsoft Corp.', shares: 5, avgCost: 200 });

      const summary = buildPortfolioSummary(portfolio.id, [
        { symbol: 'AAPL', price: 120, change: 2 },
        { symbol: 'MSFT', price: 180, change: -1 },
      ]);
      const store = getPortfolioStore();

      assert.equal(getPortfolios().length, 2);
      assert.equal(summary.portfolio.name, 'Asia Macro Book');
      assert.equal(summary.totalMarketValue, 2100);
      assert.equal(summary.totalCostBasis, 2000);
      assert.equal(summary.totalPnl, 100);
      assert.equal(summary.totalDayChange, 15);
      assert.ok(summary.metrics.concentrationTop3 > 0);
      assert.ok(store.snapshots.some(snapshot => snapshot.portfolioId === portfolio.id));
    } finally {
      restore();
    }
  });
});
