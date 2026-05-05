import type { FinancialReport } from './finnhub-extra';

export type FinancialFrequency = 'annual' | 'quarterly';
export type FinancialStatementKind = 'income' | 'balance' | 'cash';

export type FinancialMetricKey =
  | 'revenue'
  | 'costOfRevenue'
  | 'grossProfit'
  | 'operatingExpenses'
  | 'operatingIncome'
  | 'netIncome'
  | 'epsBasic'
  | 'epsDiluted'
  | 'assets'
  | 'currentAssets'
  | 'liabilities'
  | 'currentLiabilities'
  | 'equity'
  | 'debt'
  | 'cash'
  | 'operatingCashFlow'
  | 'investingCashFlow'
  | 'financingCashFlow'
  | 'capex'
  | 'freeCashFlow';

export interface NormalizedFinancialPeriod {
  id: string;
  label: string;
  year: number;
  quarter: number;
  form: string;
  endDate: string;
  filedDate: string;
  values: Partial<Record<FinancialMetricKey, number>>;
}

export interface FinancialDisplayRow {
  key: FinancialMetricKey;
  label: string;
  statement: FinancialStatementKind;
  values: Array<number | null>;
}

type RawLine = { concept: string; label: string; value: number; unit: string };

export const FINANCIAL_ROW_DEFS: Array<{ key: FinancialMetricKey; label: string; statement: FinancialStatementKind }> = [
  { key: 'revenue', label: 'Revenue', statement: 'income' },
  { key: 'costOfRevenue', label: 'Cost of revenue', statement: 'income' },
  { key: 'grossProfit', label: 'Gross profit', statement: 'income' },
  { key: 'operatingExpenses', label: 'Operating expenses', statement: 'income' },
  { key: 'operatingIncome', label: 'Operating income', statement: 'income' },
  { key: 'netIncome', label: 'Net income', statement: 'income' },
  { key: 'epsBasic', label: 'Basic EPS', statement: 'income' },
  { key: 'epsDiluted', label: 'Diluted EPS', statement: 'income' },
  { key: 'assets', label: 'Assets', statement: 'balance' },
  { key: 'currentAssets', label: 'Current assets', statement: 'balance' },
  { key: 'liabilities', label: 'Liabilities', statement: 'balance' },
  { key: 'currentLiabilities', label: 'Current liabilities', statement: 'balance' },
  { key: 'equity', label: 'Shareholders equity', statement: 'balance' },
  { key: 'debt', label: 'Debt', statement: 'balance' },
  { key: 'cash', label: 'Cash and equivalents', statement: 'balance' },
  { key: 'operatingCashFlow', label: 'Cash from operating activities', statement: 'cash' },
  { key: 'investingCashFlow', label: 'Cash from investing activities', statement: 'cash' },
  { key: 'financingCashFlow', label: 'Cash from financing activities', statement: 'cash' },
  { key: 'capex', label: 'Capital expenditures', statement: 'cash' },
  { key: 'freeCashFlow', label: 'Free cash flow', statement: 'cash' },
];

const CONCEPT_ALIASES: Record<FinancialMetricKey, string[]> = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'Revenue',
  ],
  costOfRevenue: [
    'CostOfRevenue',
    'CostOfGoodsAndServicesSold',
    'CostOfGoodsSold',
  ],
  grossProfit: ['GrossProfit'],
  operatingExpenses: ['OperatingExpenses', 'OperatingCostsAndExpenses'],
  operatingIncome: ['OperatingIncomeLoss', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  epsBasic: ['EarningsPerShareBasic'],
  epsDiluted: ['EarningsPerShareDiluted'],
  assets: ['Assets'],
  currentAssets: ['AssetsCurrent'],
  liabilities: ['Liabilities'],
  currentLiabilities: ['LiabilitiesCurrent'],
  equity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  debt: [
    'LongTermDebtAndFinanceLeaseObligations',
    'LongTermDebt',
    'ShortTermBorrowings',
    'DebtCurrent',
    'LongTermDebtCurrent',
    'LongTermDebtNoncurrent',
    'FinanceLeaseLiability',
  ],
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  investingCashFlow: ['NetCashProvidedByUsedInInvestingActivities'],
  financingCashFlow: ['NetCashProvidedByUsedInFinancingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'CapitalExpenditures'],
  freeCashFlow: [],
};

const LABEL_ALIASES: Record<FinancialMetricKey, string[]> = {
  revenue: ['revenue', 'sales revenue', 'net sales'],
  costOfRevenue: ['cost of revenue', 'cost of goods', 'cost of sales'],
  grossProfit: ['gross profit'],
  operatingExpenses: ['operating expenses', 'operating costs and expenses'],
  operatingIncome: ['operating income', 'operating income loss'],
  netIncome: ['net income', 'net income loss', 'profit loss'],
  epsBasic: ['earnings per share basic', 'basic eps'],
  epsDiluted: ['earnings per share diluted', 'diluted eps'],
  assets: ['assets', 'total assets'],
  currentAssets: ['current assets', 'assets current'],
  liabilities: ['liabilities', 'total liabilities'],
  currentLiabilities: ['current liabilities', 'liabilities current'],
  equity: ['stockholders equity', 'shareholders equity'],
  debt: ['debt', 'long term debt', 'short term borrowings'],
  cash: ['cash and cash equivalents', 'cash equivalents'],
  operatingCashFlow: ['net cash provided by used in operating activities', 'operating activities'],
  investingCashFlow: ['net cash provided by used in investing activities', 'investing activities'],
  financingCashFlow: ['net cash provided by used in financing activities', 'financing activities'],
  capex: ['payments to acquire property plant and equipment', 'capital expenditures'],
  freeCashFlow: ['free cash flow'],
};

function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function allLines(report: FinancialReport): RawLine[] {
  return [
    ...(report.report.ic ?? []),
    ...(report.report.bs ?? []),
    ...(report.report.cf ?? []),
  ].filter((line): line is RawLine => Number.isFinite(line.value));
}

function findValue(lines: RawLine[], key: FinancialMetricKey): number | undefined {
  const concepts = new Set(CONCEPT_ALIASES[key].map(normalizeToken));
  const exactConcept = lines.find((line) => concepts.has(normalizeToken(line.concept)));
  if (exactConcept) return exactConcept.value;

  const labelAliases = LABEL_ALIASES[key].map(normalizeLabel);
  const exactLabel = lines.find((line) => labelAliases.includes(normalizeLabel(line.label)));
  if (exactLabel) return exactLabel.value;

  const partialLabel = lines.find((line) => {
    const label = normalizeLabel(line.label);
    return labelAliases.some((alias) => label.includes(alias));
  });
  return partialLabel?.value;
}

function sumValues(lines: RawLine[], key: FinancialMetricKey): number | undefined {
  const concepts = new Set(CONCEPT_ALIASES[key].map(normalizeToken));
  const matches = lines.filter((line) => concepts.has(normalizeToken(line.concept)));
  if (matches.length === 0) return undefined;
  return matches.reduce((sum, line) => sum + line.value, 0);
}

function deriveValues(report: FinancialReport): Partial<Record<FinancialMetricKey, number>> {
  const lines = allLines(report);
  const values: Partial<Record<FinancialMetricKey, number>> = {};

  for (const def of FINANCIAL_ROW_DEFS) {
    const value = def.key === 'debt' ? sumValues(lines, def.key) : findValue(lines, def.key);
    if (value !== undefined) values[def.key] = value;
  }

  if (values.grossProfit === undefined && values.revenue !== undefined && values.costOfRevenue !== undefined) {
    values.grossProfit = values.revenue - Math.abs(values.costOfRevenue);
  }

  if (
    values.operatingIncome === undefined
    && values.grossProfit !== undefined
    && values.operatingExpenses !== undefined
  ) {
    values.operatingIncome = values.grossProfit - Math.abs(values.operatingExpenses);
  }

  if (values.freeCashFlow === undefined && values.operatingCashFlow !== undefined) {
    values.freeCashFlow = values.operatingCashFlow + (values.capex ?? 0);
  }

  return values;
}

function periodLabel(report: FinancialReport, frequency: FinancialFrequency): string {
  if (frequency === 'annual' || report.quarter === 0) return String(report.year);
  return `Q${report.quarter} '${String(report.year).slice(-2)}`;
}

export function normalizeFinancialReports(
  reports: FinancialReport[],
  frequency: FinancialFrequency,
): NormalizedFinancialPeriod[] {
  return reports
    .map((report) => ({
      id: report.accessNumber || `${report.symbol}:${report.year}:${report.quarter}:${report.form}`,
      label: periodLabel(report, frequency),
      year: report.year,
      quarter: report.quarter,
      form: report.form,
      endDate: report.endDate,
      filedDate: report.filedDate,
      values: deriveValues(report),
    }))
    .filter((period) => Object.keys(period.values).length > 0)
    .sort((a, b) =>
      (a.endDate || '').localeCompare(b.endDate || '')
      || a.year - b.year
      || a.quarter - b.quarter
    );
}

export function buildFinancialRows(
  periods: NormalizedFinancialPeriod[],
  statement: FinancialStatementKind,
): FinancialDisplayRow[] {
  return FINANCIAL_ROW_DEFS
    .filter((def) => def.statement === statement)
    .map((def) => ({
      ...def,
      values: periods.map((period) => period.values[def.key] ?? null),
    }))
    .filter((row) => row.values.some((value) => value !== null));
}

export function getLatestFinancialValue(
  periods: NormalizedFinancialPeriod[],
  key: FinancialMetricKey,
): number | undefined {
  for (let i = periods.length - 1; i >= 0; i -= 1) {
    const period = periods[i];
    const value = period?.values[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function ratio(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  return numerator / denominator;
}
