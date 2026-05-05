import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFinancialRows,
  getLatestFinancialValue,
  normalizeFinancialReports,
  ratio,
} from '../src/services/market/company-financials.ts';
import type { FinancialReport } from '../src/services/market/finnhub-extra.ts';

function report(overrides: Partial<FinancialReport>): FinancialReport {
  return {
    accessNumber: 'acc',
    symbol: 'TST',
    cik: '1',
    year: 2025,
    quarter: 1,
    form: '10-Q',
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    filedDate: '2025-04-20',
    report: {},
    ...overrides,
  };
}

test('normalizes alternate XBRL concepts and derives gross profit', () => {
  const periods = normalizeFinancialReports([
    report({
      report: {
        ic: [
          { concept: 'RevenueFromContractWithCustomerExcludingAssessedTax', label: 'Revenue', value: 100, unit: 'USD' },
          { concept: 'CostOfGoodsAndServicesSold', label: 'Cost of Goods and Services Sold', value: 40, unit: 'USD' },
          { concept: 'NetIncomeLoss', label: 'Net Income', value: 12, unit: 'USD' },
        ],
      },
    }),
  ], 'quarterly');

  assert.equal(periods.length, 1);
  assert.equal(periods[0]?.values.revenue, 100);
  assert.equal(periods[0]?.values.costOfRevenue, 40);
  assert.equal(periods[0]?.values.grossProfit, 60);
  assert.equal(periods[0]?.values.netIncome, 12);
});

test('builds rows with missing values preserved as nulls', () => {
  const periods = normalizeFinancialReports([
    report({
      accessNumber: 'old',
      endDate: '2025-03-31',
      report: {
        ic: [{ concept: 'Revenues', label: 'Revenue', value: 100, unit: 'USD' }],
      },
    }),
    report({
      accessNumber: 'new',
      quarter: 2,
      endDate: '2025-06-30',
      report: {
        ic: [
          { concept: 'Revenues', label: 'Revenue', value: 120, unit: 'USD' },
          { concept: 'OperatingIncomeLoss', label: 'Operating Income', value: 20, unit: 'USD' },
        ],
      },
    }),
  ], 'quarterly');

  const rows = buildFinancialRows(periods, 'income');
  const operatingIncome = rows.find((rowItem) => rowItem.key === 'operatingIncome');

  assert.deepEqual(periods.map((period) => period.label), ["Q1 '25", "Q2 '25"]);
  assert.deepEqual(operatingIncome?.values, [null, 20]);
});

test('derives cash flow and latest value helpers without inventing missing data', () => {
  const periods = normalizeFinancialReports([
    report({
      report: {
        cf: [
          { concept: 'NetCashProvidedByUsedInOperatingActivities', label: 'Cash from operating activities', value: 50, unit: 'USD' },
          { concept: 'PaymentsToAcquirePropertyPlantAndEquipment', label: 'Capital expenditures', value: -12, unit: 'USD' },
        ],
      },
    }),
  ], 'quarterly');

  assert.equal(getLatestFinancialValue(periods, 'freeCashFlow'), 38);
  assert.equal(getLatestFinancialValue(periods, 'assets'), undefined);
  assert.equal(ratio(10, 2), 5);
  assert.equal(ratio(10, 0), undefined);
});
