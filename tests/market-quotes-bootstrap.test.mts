import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterBootstrapQuotesForSymbols,
  mergeMarketQuotesForSymbols,
} from '../server/worldmonitor/market/v1/list-market-quotes';

describe('market quote bootstrap coverage', () => {
  it('does not treat partial bootstrap watchlist data as fully covered', () => {
    const bootstrap = {
      quotes: [
        { symbol: 'AAPL', name: 'AAPL', display: 'AAPL', price: 205, change: 1.1, sparkline: [] },
      ],
    };

    const result = filterBootstrapQuotesForSymbols(bootstrap, ['AAPL', 'PLTR']);

    assert.equal(result.fullyCovered, false);
    assert.deepEqual(result.quotes.map((quote) => quote.symbol), ['AAPL']);
  });

  it('merges partial bootstrap quotes with fresh quotes in request order', () => {
    const merged = mergeMarketQuotesForSymbols(
      ['AAPL', 'PLTR'],
      [{ symbol: 'AAPL', name: 'AAPL', display: 'AAPL', price: 205, change: 1.1, sparkline: [] }],
      [{ symbol: 'PLTR', name: 'PLTR', display: 'PLTR', price: 23, change: -0.5, sparkline: [] }],
    );

    assert.deepEqual(merged.map((quote) => quote.symbol), ['AAPL', 'PLTR']);
    assert.deepEqual(merged.map((quote) => quote.price), [205, 23]);
  });
});
