import type { FinancialReport } from './finnhub-extra';

export type FinancialFrequency = 'annual' | 'quarterly';
export type FinancialStatementKind = 'income' | 'balance' | 'cash';
/** How to format a metric value in the table. */
export type FinancialFormatType = 'currency' | 'perShare' | 'shares';

export type FinancialMetricKey =
  // ── Income statement ───────────────────────────────────────────────────
  | 'revenue'
  | 'costOfRevenue'
  | 'depreciation'              // sub of costOfRevenue
  | 'grossProfit'
  | 'operatingExpenses'
  | 'researchAndDevelopment'    // sub of operatingExpenses
  | 'sgaExpenses'               // sub of operatingExpenses
  | 'totalOperatingExpenses'    // derived
  | 'operatingIncome'
  | 'nonOperatingIncome'
  | 'interestIncome'            // sub of nonOperatingIncome
  | 'interestExpense'           // sub of nonOperatingIncome
  | 'otherNonOperatingIncome'   // sub of nonOperatingIncome
  | 'unusualItems'              // sub of nonOperatingIncome (restructuring, impairment)
  | 'equityInEarnings'          // equity method investment income
  | 'pretaxIncome'
  | 'incomeTax'
  | 'netIncomeBeforeDisc'
  | 'discontinuedOperations'
  | 'netIncome'
  | 'nonControllingInterestIncome'
  | 'afterTaxOtherIncomeExpense'
  | 'preferredDividends'
  | 'dilutedNetIncomeAvailableToCommon'
  | 'epsBasic'
  | 'epsDiluted'
  | 'sharesBasic'
  | 'sharesDiluted'
  | 'ebitda'                    // derived
  | 'ebit'                      // derived = operatingIncome
  // ── Balance sheet ─────────────────────────────────────────────────────
  | 'assets'
  | 'currentAssets'
  | 'receivables'               // sub of currentAssets
  | 'shortTermInvestments'      // sub of currentAssets
  | 'inventories'               // sub of currentAssets
  | 'nonCurrentAssets'          // derived: assets − currentAssets
  | 'propertyPlantEquipment'    // sub of nonCurrentAssets
  | 'longTermInvestments'       // sub of nonCurrentAssets
  | 'goodwillAndIntangibles'    // sub of nonCurrentAssets (goodwill + intangibles)
  | 'liabilities'
  | 'currentLiabilities'
  | 'accountsPayable'           // sub of currentLiabilities
  | 'accruedLiabilities'        // sub of currentLiabilities
  | 'deferredRevenueCurrent'    // sub of currentLiabilities
  | 'shortTermDebt'             // sub of currentLiabilities
  | 'nonCurrentLiabilities'     // derived: liabilities − currentLiabilities
  | 'deferredRevenueNonCurrent' // sub of nonCurrentLiabilities
  | 'longTermDebt'              // sub of nonCurrentLiabilities
  | 'equity'
  | 'commonEquity'              // sub of equity
  | 'additionalPaidInCapital'   // sub of commonEquity
  | 'retainedEarnings'          // sub of commonEquity
  | 'treasuryStock'             // sub of commonEquity
  | 'minorityInterest'          // sub of equity
  | 'totalLiabilitiesEquity'    // derived: liabilities + equity (= assets check)
  | 'workingCapital'            // derived: currentAssets - currentLiabilities
  | 'debt'
  | 'netDebt'                   // derived: debt − cash
  | 'cash'
  // ── Cash flow ─────────────────────────────────────────────────────────
  | 'operatingCashFlow'
  | 'daCashFlow'                // sub of operatingCashFlow — D&A add-back
  | 'stockBasedCompensation'    // sub of operatingCashFlow
  | 'changesInWorkingCapital'   // sub of operatingCashFlow
  | 'otherOperatingActivities'  // sub of operatingCashFlow
  | 'investingCashFlow'
  | 'acquisitions'              // sub of investingCashFlow
  | 'purchaseSaleInvestments'   // sub of investingCashFlow
  | 'capex'                     // sub of investingCashFlow
  | 'otherInvestingActivities'  // sub of investingCashFlow
  | 'financingCashFlow'
  | 'issuanceRetirementStock'   // sub of financingCashFlow
  | 'issuanceRetirementDebt'    // sub of financingCashFlow
  | 'dividendsPaid'             // sub of financingCashFlow
  | 'otherFinancingActivities'  // sub of financingCashFlow
  | 'netChangeInCash'           // derived or direct
  | 'cashAtEndOfPeriod'
  | 'freeCashFlow';             // derived

export interface FinancialRowDef {
  key: FinancialMetricKey;
  label: string;
  statement: FinancialStatementKind;
  /** 0 = top-level, 1 = first indent, 2 = second indent */
  indent: number;
  /** Whether this row has children and shows a ▼/▶ chevron */
  isParent?: boolean;
  /** Key of this row's immediate parent (used for collapse + visual hierarchy) */
  parentKey?: FinancialMetricKey;
  /** Bold + amber-tinted background stripe */
  highlight?: boolean;
  /** Value computed from other keys, not looked up in raw data */
  derived?: boolean;
  /** How to display the numeric value. Default: 'currency' */
  format?: FinancialFormatType;
}

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

export interface FinancialDisplayRow extends FinancialRowDef {
  values: Array<number | null>;
}

type RawLine = { concept: string; label: string; value: number; unit: string };

// ─── Row definitions ──────────────────────────────────────────────────────────

export const FINANCIAL_ROW_DEFS: FinancialRowDef[] = [
  // ── Income statement ─────────────────────────────────────────────────
  { key: 'revenue',                label: 'Total revenue',                   statement: 'income',  indent: 0, highlight: true },
  { key: 'costOfRevenue',          label: 'Cost of goods sold',              statement: 'income',  indent: 0, isParent: true },
  { key: 'depreciation',           label: 'Depreciation and amortization',   statement: 'income',  indent: 1, parentKey: 'costOfRevenue' },
  { key: 'grossProfit',            label: 'Gross profit',                    statement: 'income',  indent: 0, highlight: true },
  { key: 'operatingExpenses',      label: 'Operating expenses (excl. COGS)', statement: 'income',  indent: 0, isParent: true },
  { key: 'researchAndDevelopment', label: 'Research and development',        statement: 'income',  indent: 1, parentKey: 'operatingExpenses' },
  { key: 'sgaExpenses',            label: 'Selling/general/admin expenses',  statement: 'income',  indent: 1, parentKey: 'operatingExpenses' },
  { key: 'totalOperatingExpenses', label: 'Total operating expenses',        statement: 'income',  indent: 0, derived: true },
  { key: 'operatingIncome',        label: 'Operating income',                statement: 'income',  indent: 0, highlight: true },
  { key: 'nonOperatingIncome',     label: 'Non-operating income (total)',    statement: 'income',  indent: 0, isParent: true },
  { key: 'interestIncome',         label: 'Interest income',                 statement: 'income',  indent: 1, parentKey: 'nonOperatingIncome' },
  { key: 'interestExpense',        label: 'Interest expense',                statement: 'income',  indent: 1, parentKey: 'nonOperatingIncome' },
  { key: 'otherNonOperatingIncome', label: 'Other non-operating income',     statement: 'income',  indent: 1, parentKey: 'nonOperatingIncome' },
  { key: 'unusualItems',           label: 'Unusual/non-recurring items',     statement: 'income',  indent: 1, parentKey: 'nonOperatingIncome' },
  { key: 'equityInEarnings',       label: 'Equity in earnings',              statement: 'income',  indent: 0 },
  { key: 'pretaxIncome',           label: 'Pretax income',                   statement: 'income',  indent: 0, highlight: true },
  { key: 'incomeTax',              label: 'Taxes',                           statement: 'income',  indent: 0 },
  { key: 'netIncomeBeforeDisc',    label: 'Net income before discont. ops.', statement: 'income',  indent: 0 },
  { key: 'discontinuedOperations', label: 'Discontinued operations',         statement: 'income',  indent: 0 },
  { key: 'netIncome',              label: 'Net income',                      statement: 'income',  indent: 0, highlight: true },
  { key: 'nonControllingInterestIncome', label: 'Non-controlling interest',  statement: 'income',  indent: 0 },
  { key: 'afterTaxOtherIncomeExpense', label: 'After-tax other income/expense', statement: 'income', indent: 0 },
  { key: 'preferredDividends',      label: 'Preferred dividends',             statement: 'income',  indent: 0 },
  { key: 'dilutedNetIncomeAvailableToCommon', label: 'Diluted net income available to common', statement: 'income', indent: 0, highlight: true, derived: true },
  { key: 'epsBasic',               label: 'Basic EPS',                       statement: 'income',  indent: 0, format: 'perShare' },
  { key: 'epsDiluted',             label: 'Diluted EPS',                     statement: 'income',  indent: 0, format: 'perShare' },
  { key: 'sharesBasic',            label: 'Avg. basic shares outstanding',   statement: 'income',  indent: 0, format: 'shares' },
  { key: 'sharesDiluted',          label: 'Diluted shares outstanding',      statement: 'income',  indent: 0, format: 'shares' },
  { key: 'ebitda',                 label: 'EBITDA',                          statement: 'income',  indent: 0, highlight: true, derived: true },
  { key: 'ebit',                   label: 'EBIT',                            statement: 'income',  indent: 0, derived: true },

  // ── Balance sheet ────────────────────────────────────────────────────
  { key: 'assets',                 label: 'Total assets',                    statement: 'balance', indent: 0, isParent: true, highlight: true },
  { key: 'currentAssets',          label: 'Total current assets',            statement: 'balance', indent: 1, isParent: true, parentKey: 'assets' },
  { key: 'receivables',            label: 'Total receivables',               statement: 'balance', indent: 2, parentKey: 'currentAssets' },
  { key: 'shortTermInvestments',   label: 'Short-term investments',          statement: 'balance', indent: 2, parentKey: 'currentAssets' },
  { key: 'inventories',            label: 'Inventories',                     statement: 'balance', indent: 2, parentKey: 'currentAssets' },
  { key: 'nonCurrentAssets',       label: 'Total non-current assets',        statement: 'balance', indent: 1, isParent: true, parentKey: 'assets', derived: true },
  { key: 'propertyPlantEquipment', label: 'Property, plant & equipment',     statement: 'balance', indent: 2, parentKey: 'nonCurrentAssets' },
  { key: 'longTermInvestments',    label: 'Long-term investments',           statement: 'balance', indent: 2, parentKey: 'nonCurrentAssets' },
  { key: 'goodwillAndIntangibles', label: 'Goodwill and intangibles',        statement: 'balance', indent: 2, parentKey: 'nonCurrentAssets' },
  { key: 'liabilities',            label: 'Total liabilities',               statement: 'balance', indent: 0, isParent: true, highlight: true },
  { key: 'currentLiabilities',     label: 'Total current liabilities',       statement: 'balance', indent: 1, isParent: true, parentKey: 'liabilities' },
  { key: 'accountsPayable',        label: 'Accounts payable',                statement: 'balance', indent: 2, parentKey: 'currentLiabilities' },
  { key: 'accruedLiabilities',     label: 'Accrued liabilities',             statement: 'balance', indent: 2, parentKey: 'currentLiabilities' },
  { key: 'deferredRevenueCurrent', label: 'Deferred revenue (current)',      statement: 'balance', indent: 2, parentKey: 'currentLiabilities' },
  { key: 'shortTermDebt',          label: 'Short-term debt',                 statement: 'balance', indent: 2, parentKey: 'currentLiabilities' },
  { key: 'nonCurrentLiabilities',  label: 'Total non-current liabilities',   statement: 'balance', indent: 1, isParent: true, parentKey: 'liabilities', derived: true },
  { key: 'deferredRevenueNonCurrent', label: 'Deferred revenue (long-term)', statement: 'balance', indent: 2, parentKey: 'nonCurrentLiabilities' },
  { key: 'longTermDebt',           label: 'Long-term debt',                  statement: 'balance', indent: 2, parentKey: 'nonCurrentLiabilities' },
  { key: 'equity',                 label: 'Total equity',                    statement: 'balance', indent: 0, isParent: true, highlight: true },
  { key: 'commonEquity',           label: 'Common equity (total)',           statement: 'balance', indent: 1, isParent: true, parentKey: 'equity' },
  { key: 'additionalPaidInCapital', label: 'Additional paid-in capital',      statement: 'balance', indent: 2, parentKey: 'commonEquity' },
  { key: 'retainedEarnings',       label: 'Retained earnings',               statement: 'balance', indent: 2, parentKey: 'commonEquity' },
  { key: 'treasuryStock',          label: 'Treasury stock',                  statement: 'balance', indent: 2, parentKey: 'commonEquity' },
  { key: 'minorityInterest',       label: 'Minority interest',               statement: 'balance', indent: 1, parentKey: 'equity' },
  { key: 'totalLiabilitiesEquity', label: 'Total liabilities & equity',      statement: 'balance', indent: 0, derived: true },
  { key: 'workingCapital',         label: 'Working capital',                 statement: 'balance', indent: 0, highlight: true, derived: true },
  { key: 'debt',                   label: 'Total debt',                      statement: 'balance', indent: 0 },
  { key: 'netDebt',                label: 'Net debt',                        statement: 'balance', indent: 0, derived: true },
  { key: 'cash',                   label: 'Cash and equivalents',            statement: 'balance', indent: 0 },

  // ── Cash flow ────────────────────────────────────────────────────────
  { key: 'operatingCashFlow',      label: 'Cash from operating activities',  statement: 'cash',    indent: 0, isParent: true, highlight: true },
  { key: 'netIncome',              label: 'Net income',                      statement: 'cash',    indent: 1, parentKey: 'operatingCashFlow' },
  { key: 'daCashFlow',             label: 'Depreciation and amortization',   statement: 'cash',    indent: 1, parentKey: 'operatingCashFlow' },
  { key: 'stockBasedCompensation', label: 'Stock-based compensation',        statement: 'cash',    indent: 1, parentKey: 'operatingCashFlow' },
  { key: 'changesInWorkingCapital', label: 'Changes in working capital',     statement: 'cash',    indent: 1, parentKey: 'operatingCashFlow' },
  { key: 'otherOperatingActivities', label: 'Other operating activities',     statement: 'cash',    indent: 1, parentKey: 'operatingCashFlow' },
  { key: 'investingCashFlow',      label: 'Cash from investing activities',  statement: 'cash',    indent: 0, isParent: true, highlight: true },
  { key: 'acquisitions',           label: 'Acquisitions (net of cash)',      statement: 'cash',    indent: 1, parentKey: 'investingCashFlow' },
  { key: 'purchaseSaleInvestments', label: 'Purchase/sale of investments',   statement: 'cash',    indent: 1, parentKey: 'investingCashFlow' },
  { key: 'capex',                  label: 'Capital expenditures',            statement: 'cash',    indent: 1, parentKey: 'investingCashFlow' },
  { key: 'otherInvestingActivities', label: 'Other investing activities',     statement: 'cash',    indent: 1, parentKey: 'investingCashFlow' },
  { key: 'financingCashFlow',      label: 'Cash from financing activities',  statement: 'cash',    indent: 0, isParent: true, highlight: true },
  { key: 'issuanceRetirementStock', label: 'Issuance/retirement of stock',   statement: 'cash',    indent: 1, parentKey: 'financingCashFlow' },
  { key: 'issuanceRetirementDebt', label: 'Issuance/retirement of debt',     statement: 'cash',    indent: 1, parentKey: 'financingCashFlow' },
  { key: 'dividendsPaid',          label: 'Total cash dividends paid',       statement: 'cash',    indent: 1, parentKey: 'financingCashFlow' },
  { key: 'otherFinancingActivities', label: 'Other financing activities',     statement: 'cash',    indent: 1, parentKey: 'financingCashFlow' },
  { key: 'netChangeInCash',        label: 'Net change in cash',              statement: 'cash',    indent: 0, highlight: true },
  { key: 'cashAtEndOfPeriod',      label: 'Cash at end of period',           statement: 'cash',    indent: 0, highlight: true },
  { key: 'freeCashFlow',           label: 'Free cash flow',                  statement: 'cash',    indent: 0, highlight: true, derived: true },
];

// ─── XBRL concept aliases (highest-priority first within each list) ────────────

const CONCEPT_ALIASES: Record<FinancialMetricKey, string[]> = {
  // Income
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
  depreciation: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'Depreciation',
    'AmortizationOfIntangibleAssets',
  ],
  grossProfit: ['GrossProfit'],
  operatingExpenses: [
    'OperatingExpenses',
    'OperatingCostsAndExpenses',
  ],
  researchAndDevelopment: [
    'ResearchAndDevelopmentExpense',
    'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
  ],
  sgaExpenses: [
    'SellingGeneralAndAdministrativeExpense',
    'GeneralAndAdministrativeExpense',
    'SellingAndMarketingExpense',
  ],
  totalOperatingExpenses: [
    'CostsAndExpenses',
  ],
  operatingIncome: ['OperatingIncomeLoss'],
  nonOperatingIncome: [
    'NonoperatingIncomeExpense',
    'OtherNonoperatingIncomeExpense',
  ],
  interestIncome: [
    'InterestIncomeNonOperating',
    'InvestmentIncomeInterest',
    'InterestIncomeExpenseNonOperatingNet',
    'InterestAndDividendIncomeOperating',
  ],
  interestExpense: [
    'InterestExpense',
    'InterestExpenseDebt',
    'InterestAndDebtExpense',
    'InterestExpenseIncludingCapitalizedInterest',
  ],
  otherNonOperatingIncome: [
    'OtherNonoperatingIncomeExpense',
    'NonoperatingIncomeExpense',
    'OtherIncomeExpenseNet',
  ],
  unusualItems: [
    'RestructuringCharges',
    'GoodwillImpairmentLoss',
    'ImpairmentOfIntangibleAssetsExcludingGoodwill',
    'GainLossOnDispositionOfBusiness',
    'OtherNonrecurringIncomeExpense',
  ],
  equityInEarnings: [
    'IncomeLossFromEquityMethodInvestments',
    'EquityMethodInvestmentRealizedGainLossOnDisposal',
  ],
  pretaxIncome: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ],
  incomeTax: ['IncomeTaxExpenseBenefit'],
  netIncomeBeforeDisc: [
    'IncomeLossFromContinuingOperations',
    'IncomeLossFromContinuingOperationsIncludingPortionAttributableToNoncontrollingInterest',
  ],
  discontinuedOperations: [
    'IncomeLossFromDiscontinuedOperationsNetOfTax',
    'DiscontinuedOperationGainLossOnDisposalOfDiscontinuedOperationNetOfTax',
  ],
  netIncome: [
    'NetIncomeLoss',
    'ProfitLoss',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
  ],
  nonControllingInterestIncome: [
    'NetIncomeLossAttributableToNoncontrollingInterest',
    'NetIncomeLossAttributableToNonredeemableNoncontrollingInterest',
    'NetIncomeLossAttributableToRedeemableNoncontrollingInterest',
  ],
  afterTaxOtherIncomeExpense: [
    'OtherComprehensiveIncomeLossNetOfTax',
    'OtherComprehensiveIncomeLossNetOfTaxPortionAttributableToParent',
    'ComprehensiveIncomeNetOfTax',
  ],
  preferredDividends: [
    'PreferredStockDividendsAndOtherAdjustments',
    'PreferredStockDividendsIncomeStatementImpact',
    'DividendsPreferredStock',
  ],
  dilutedNetIncomeAvailableToCommon: [
    'NetIncomeLossAvailableToCommonStockholdersDiluted',
    'NetIncomeLossAvailableToCommonStockholdersBasic',
  ],
  epsBasic: ['EarningsPerShareBasic'],
  epsDiluted: ['EarningsPerShareDiluted'],
  sharesBasic: ['WeightedAverageNumberOfSharesOutstandingBasic'],
  sharesDiluted: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
  ebitda: [],  // derived
  ebit: [],    // derived
  // Balance sheet
  assets: ['Assets'],
  currentAssets: ['AssetsCurrent'],
  receivables: [
    'AccountsReceivableNetCurrent',
    'ReceivablesNetCurrent',
    'AccountsAndOtherReceivablesNetCurrent',
  ],
  shortTermInvestments: [
    'ShortTermInvestments',
    'MarketableSecuritiesCurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
  ],
  inventories: ['InventoryNet', 'Inventories'],
  nonCurrentAssets: ['AssetsNoncurrent'],
  propertyPlantEquipment: ['PropertyPlantAndEquipmentNet'],
  longTermInvestments: [
    'LongTermInvestments',
    'MarketableSecuritiesNoncurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesNoncurrent',
    'DebtSecuritiesAvailableForSaleExcludingAccruedInterestNoncurrent',
    'EquitySecuritiesFvNiNoncurrent',
  ],
  goodwillAndIntangibles: [
    'IntangibleAssetsNetIncludingGoodwill',
    'Goodwill',  // fallback; combined with intangibles in deriveValues
  ],
  liabilities: ['Liabilities'],
  currentLiabilities: ['LiabilitiesCurrent'],
  accountsPayable: ['AccountsPayableCurrent', 'AccountsPayable'],
  accruedLiabilities: [
    'AccruedLiabilitiesCurrent',
    'AccruedExpensesCurrent',
    'AccruedIncomeTaxesCurrent',
    'AccruedEmployeeBenefitsCurrent',
  ],
  deferredRevenueCurrent: [
    'ContractWithCustomerLiabilityCurrent',
    'DeferredRevenueCurrent',
    'UnearnedRevenueCurrent',
  ],
  shortTermDebt: [
    'ShortTermBorrowings',
    'LongTermDebtCurrent',
    'DebtCurrent',
    'NotesPayableCurrent',
  ],
  nonCurrentLiabilities: ['LiabilitiesNoncurrent'],
  deferredRevenueNonCurrent: [
    'ContractWithCustomerLiabilityNoncurrent',
    'DeferredRevenueNoncurrent',
    'UnearnedRevenueNoncurrent',
  ],
  longTermDebt: [
    'LongTermDebtNoncurrent',
    'LongTermDebtAndCapitalLeaseObligationsNoncurrent',
  ],
  equity: [
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'StockholdersEquity',
  ],
  commonEquity: [
    'StockholdersEquity',
    'CommonStockholdersEquity',
  ],
  additionalPaidInCapital: [
    'AdditionalPaidInCapital',
    'AdditionalPaidInCapitalCommonStock',
    'CommonStocksIncludingAdditionalPaidInCapital',
  ],
  retainedEarnings: ['RetainedEarningsAccumulatedDeficit', 'RetainedEarnings'],
  treasuryStock: [
    'TreasuryStockValue',
    'TreasuryStockCommonValue',
    'TreasuryStockPreferredValue',
  ],
  minorityInterest: [
    'MinorityInterest',
    'NoncontrollingInterestNetOfTax',
  ],
  totalLiabilitiesEquity: [], // derived
  workingCapital: [], // derived
  debt: [
    'DebtLongtermAndShorttermCombinedAmount',
    'LongTermDebtAndFinanceLeaseObligations',
    'LongTermDebt',
  ],
  netDebt: [],  // derived
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
  // Cash flow
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  daCashFlow: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAndAmortization',
    'Depreciation',
  ],
  stockBasedCompensation: [
    'ShareBasedCompensation',
    'AllocatedShareBasedCompensationExpense',
    'StockBasedCompensation',
  ],
  changesInWorkingCapital: [
    'IncreaseDecreaseInOperatingCapital',
    'IncreaseDecreaseInOperatingLiabilities',
  ],
  otherOperatingActivities: [
    'OtherOperatingActivitiesCashFlowStatement',
    'OtherNoncashIncomeExpense',
    'OtherNoncashExpense',
  ],
  investingCashFlow: ['NetCashProvidedByUsedInInvestingActivities'],
  acquisitions: [
    'PaymentsToAcquireBusinessesNetOfCashAcquired',
    'PaymentsToAcquireBusinessesGross',
  ],
  purchaseSaleInvestments: [
    'PaymentsForProceedsFromInvestments',
    'PaymentsToAcquireMarketableSecurities',
    'PaymentsToAcquireInvestments',
  ],
  capex: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'CapitalExpenditures',
  ],
  otherInvestingActivities: [
    'OtherInvestingActivitiesCashFlowStatement',
    'PaymentsForProceedsFromOtherInvestingActivities',
    'PaymentsToAcquireOtherInvestments',
  ],
  financingCashFlow: ['NetCashProvidedByUsedInFinancingActivities'],
  issuanceRetirementStock: [
    'ProceedsFromIssuanceOfCommonStock',
    'PaymentsForRepurchaseOfCommonStock',
    'ProceedsFromRepurchaseOfEquity',
  ],
  issuanceRetirementDebt: [
    'ProceedsFromIssuanceOfLongTermDebt',
    'RepaymentsOfLongTermDebt',
    'ProceedsFromRepaymentsOfShortTermDebt',
  ],
  dividendsPaid: [
    'PaymentsOfDividends',
    'PaymentsOfDividendsCommonStock',
  ],
  otherFinancingActivities: [
    'OtherFinancingActivitiesCashFlowStatement',
    'PaymentsForProceedsFromOtherFinancingActivities',
  ],
  netChangeInCash: [
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect',
    'CashAndCashEquivalentsPeriodIncreaseDecrease',
  ],
  cashAtEndOfPeriod: [
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
    'CashAndCashEquivalentsAtCarryingValue',
  ],
  freeCashFlow: [],  // derived
};

// ─── Label aliases (fuzzy fallback when concept lookup fails) ─────────────────

const LABEL_ALIASES: Record<FinancialMetricKey, string[]> = {
  revenue: ['revenue', 'net sales', 'sales revenue', 'total revenue'],
  costOfRevenue: ['cost of revenue', 'cost of goods', 'cost of sales'],
  depreciation: ['depreciation', 'amortization', 'depreciation and amortization'],
  grossProfit: ['gross profit'],
  operatingExpenses: ['operating expenses', 'operating costs'],
  researchAndDevelopment: ['research and development', 'r&d', 'research development'],
  sgaExpenses: ['selling general and administrative', 'general and administrative'],
  totalOperatingExpenses: ['total operating expenses', 'costs and expenses', 'total costs and expenses'],
  operatingIncome: ['operating income', 'operating income loss'],
  nonOperatingIncome: ['non-operating income', 'nonoperating income'],
  interestIncome: ['interest income', 'interest and dividend income', 'investment income interest'],
  interestExpense: ['interest expense'],
  otherNonOperatingIncome: ['other non-operating income', 'other nonoperating income', 'other income expense'],
  unusualItems: ['unusual items', 'restructuring charges', 'non-recurring items', 'impairment charges'],
  equityInEarnings: ['equity in earnings', 'income from equity method'],
  pretaxIncome: ['pretax income', 'income before taxes', 'income before income taxes'],
  incomeTax: ['income tax', 'tax expense', 'provision for income taxes'],
  netIncomeBeforeDisc: ['income from continuing operations'],
  discontinuedOperations: ['discontinued operations', 'income from discontinued operations'],
  netIncome: ['net income', 'net income loss', 'profit loss', 'net earnings'],
  nonControllingInterestIncome: ['non-controlling interest', 'noncontrolling interest', 'minority interest'],
  afterTaxOtherIncomeExpense: ['after-tax other income', 'after tax other income', 'other comprehensive income'],
  preferredDividends: ['preferred dividends', 'preferred stock dividends'],
  dilutedNetIncomeAvailableToCommon: ['diluted net income available to common', 'net income available to common stockholders diluted'],
  epsBasic: ['earnings per share basic', 'basic eps'],
  epsDiluted: ['earnings per share diluted', 'diluted eps'],
  sharesBasic: ['weighted average shares basic', 'basic shares outstanding'],
  sharesDiluted: ['diluted shares outstanding', 'weighted average diluted'],
  ebitda: ['ebitda'],
  ebit: ['ebit', 'earnings before interest and taxes'],
  assets: ['total assets', 'assets'],
  currentAssets: ['current assets', 'total current assets'],
  receivables: ['accounts receivable', 'receivables', 'trade receivables'],
  shortTermInvestments: ['short-term investments', 'marketable securities current', 'short term investments'],
  inventories: ['inventories', 'inventory'],
  nonCurrentAssets: ['non-current assets', 'noncurrent assets', 'long-term assets'],
  propertyPlantEquipment: ['property plant and equipment', 'pp&e', 'property and equipment net'],
  longTermInvestments: ['long-term investments', 'long term investments', 'marketable securities noncurrent'],
  goodwillAndIntangibles: ['goodwill and intangibles', 'goodwill', 'intangible assets'],
  liabilities: ['total liabilities', 'liabilities'],
  currentLiabilities: ['current liabilities', 'total current liabilities'],
  accountsPayable: ['accounts payable'],
  accruedLiabilities: ['accrued liabilities', 'accrued expenses'],
  deferredRevenueCurrent: ['deferred revenue current', 'current deferred revenue', 'unearned revenue current'],
  shortTermDebt: ['short-term borrowings', 'current portion of long-term debt', 'notes payable current', 'short term debt'],
  nonCurrentLiabilities: ['non-current liabilities', 'noncurrent liabilities', 'long-term liabilities'],
  deferredRevenueNonCurrent: ['deferred revenue non-current', 'deferred revenue noncurrent', 'long-term deferred revenue', 'unearned revenue noncurrent'],
  longTermDebt: ['long-term debt noncurrent', 'long term debt noncurrent'],
  equity: ['total equity', 'stockholders equity', 'shareholders equity'],
  commonEquity: ['common equity', 'common stockholders equity'],
  additionalPaidInCapital: ['additional paid-in capital', 'additional paid in capital', 'capital in excess of par value'],
  retainedEarnings: ['retained earnings', 'accumulated deficit'],
  treasuryStock: ['treasury stock'],
  minorityInterest: ['minority interest', 'noncontrolling interest'],
  totalLiabilitiesEquity: ['total liabilities and equity', 'total liabilities and stockholders equity'],
  workingCapital: ['working capital'],
  debt: ['total debt', 'long term debt and finance lease', 'long term debt'],
  netDebt: ['net debt'],
  cash: ['cash and cash equivalents', 'cash equivalents'],
  operatingCashFlow: ['cash from operating activities', 'net cash from operating'],
  daCashFlow: ['depreciation', 'amortization', 'depreciation and amortization'],
  stockBasedCompensation: ['stock based compensation', 'share based compensation'],
  changesInWorkingCapital: ['changes in working capital', 'change in working capital'],
  otherOperatingActivities: ['other operating activities', 'other noncash income expense'],
  investingCashFlow: ['cash from investing activities', 'net cash from investing'],
  acquisitions: ['acquisitions', 'payments to acquire businesses'],
  purchaseSaleInvestments: ['purchase of investments', 'sale of investments', 'marketable securities net'],
  capex: ['capital expenditures', 'payments to acquire property plant'],
  otherInvestingActivities: ['other investing activities'],
  financingCashFlow: ['cash from financing activities', 'net cash from financing'],
  issuanceRetirementStock: ['issuance of stock', 'repurchase of stock'],
  issuanceRetirementDebt: ['issuance of debt', 'repayment of debt'],
  dividendsPaid: ['dividends paid', 'payments of dividends'],
  otherFinancingActivities: ['other financing activities'],
  netChangeInCash: ['net change in cash', 'increase decrease in cash', 'net increase decrease in cash'],
  cashAtEndOfPeriod: ['cash at end of period', 'cash and cash equivalents at end of period'],
  freeCashFlow: ['free cash flow'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function allLines(report: FinancialReport): RawLine[] {
  return [
    ...(report.report.ic ?? []),
    ...(report.report.bs ?? []),
    ...(report.report.cf ?? []),
  ].filter((line): line is RawLine => Number.isFinite(line.value));
}

function findValue(lines: RawLine[], key: FinancialMetricKey): number | undefined {
  // Priority: concept exact match (in alias order)
  for (const concept of CONCEPT_ALIASES[key]) {
    const hit = lines.find((l) => normalizeToken(l.concept) === normalizeToken(concept));
    if (hit) return hit.value;
  }
  // Fallback: label matching
  const labelAliases = LABEL_ALIASES[key].map(normalizeLabel);
  const exact = lines.find((l) => labelAliases.includes(normalizeLabel(l.label)));
  if (exact) return exact.value;
  const partial = lines.find((l) => {
    const label = normalizeLabel(l.label);
    return labelAliases.some((alias) => label.includes(alias));
  });
  return partial?.value;
}

function sumConcepts(lines: RawLine[], concepts: string[]): number | undefined {
  const tokens = new Set(concepts.map(normalizeToken));
  const matches = lines.filter((l) => tokens.has(normalizeToken(l.concept)));
  if (matches.length === 0) return undefined;
  return matches.reduce((acc, l) => acc + l.value, 0);
}

function deriveValues(report: FinancialReport): Partial<Record<FinancialMetricKey, number>> {
  const lines = allLines(report);
  const incomeLines = (report.report.ic ?? []).filter((line): line is RawLine => Number.isFinite(line.value));
  const balanceLines = (report.report.bs ?? []).filter((line): line is RawLine => Number.isFinite(line.value));
  const cashFlowLines = (report.report.cf ?? []).filter((line): line is RawLine => Number.isFinite(line.value));
  const v: Partial<Record<FinancialMetricKey, number>> = {};

  const linesForKey = (key: FinancialMetricKey): RawLine[] => {
    const statements = new Set(FINANCIAL_ROW_DEFS.filter((def) => def.key === key).map((def) => def.statement));
    if (statements.size !== 1) return lines;
    if (statements.has('income')) return incomeLines;
    if (statements.has('balance')) return balanceLines;
    return cashFlowLines;
  };

  // ── Raw lookups ──────────────────────────────────────────────────────────
  const singleKeys: FinancialMetricKey[] = [
    'revenue', 'costOfRevenue', 'depreciation', 'grossProfit', 'operatingExpenses',
    'researchAndDevelopment', 'sgaExpenses', 'totalOperatingExpenses',
    'operatingIncome', 'nonOperatingIncome', 'interestIncome', 'interestExpense',
    'otherNonOperatingIncome', 'unusualItems',
    'equityInEarnings', 'pretaxIncome', 'incomeTax', 'netIncomeBeforeDisc',
    'discontinuedOperations', 'netIncome', 'nonControllingInterestIncome',
    'afterTaxOtherIncomeExpense', 'preferredDividends', 'dilutedNetIncomeAvailableToCommon',
    'epsBasic', 'epsDiluted',
    'sharesBasic', 'sharesDiluted',
    'assets', 'currentAssets', 'receivables', 'shortTermInvestments', 'inventories',
    'nonCurrentAssets', 'propertyPlantEquipment', 'longTermInvestments',
    'liabilities', 'currentLiabilities', 'accountsPayable', 'accruedLiabilities',
    'deferredRevenueCurrent', 'shortTermDebt',
    'nonCurrentLiabilities', 'deferredRevenueNonCurrent', 'longTermDebt',
    'equity', 'commonEquity', 'additionalPaidInCapital', 'retainedEarnings',
    'treasuryStock', 'minorityInterest',
    'debt', 'cash', 'workingCapital',
    'operatingCashFlow', 'daCashFlow', 'stockBasedCompensation', 'changesInWorkingCapital',
    'otherOperatingActivities',
    'investingCashFlow', 'acquisitions', 'capex', 'otherInvestingActivities',
    'financingCashFlow', 'issuanceRetirementStock', 'issuanceRetirementDebt', 'dividendsPaid',
    'otherFinancingActivities', 'netChangeInCash', 'cashAtEndOfPeriod',
  ];
  for (const key of singleKeys) {
    const val = findValue(linesForKey(key), key);
    if (val !== undefined) v[key] = val;
  }

  // purchaseSaleInvestments: sum of purchase (negative) + sale (positive) concepts
  const psiNet = sumConcepts(cashFlowLines, [
    'PaymentsForProceedsFromInvestments',
    'PaymentsToAcquireMarketableSecurities',
    'PaymentsToAcquireInvestments',
    'ProceedsFromSaleAndMaturityOfMarketableSecurities',
    'ProceedsFromSaleOfInvestments',
  ]);
  if (psiNet !== undefined) v.purchaseSaleInvestments = psiNet;
  else {
    const direct = findValue(cashFlowLines, 'purchaseSaleInvestments');
    if (direct !== undefined) v.purchaseSaleInvestments = direct;
  }

  // Goodwill + Intangibles: try combined concept, then sum Goodwill + IntangibleAssets
  if (v.goodwillAndIntangibles === undefined) {
    const gw = balanceLines.find((l) => normalizeToken(l.concept) === normalizeToken('Goodwill'))?.value ?? 0;
    const ia = balanceLines.find((l) =>
      normalizeToken(l.concept) === normalizeToken('IntangibleAssetsNetExcludingGoodwill') ||
      normalizeToken(l.concept) === normalizeToken('FiniteLivedIntangibleAssetsNet') ||
      normalizeToken(l.concept) === normalizeToken('IndefiniteLivedIntangibleAssetsExcludingGoodwill')
    )?.value ?? 0;
    if (gw > 0 || ia > 0) v.goodwillAndIntangibles = gw + ia;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  // Gross profit
  if (v.grossProfit === undefined && v.revenue !== undefined && v.costOfRevenue !== undefined) {
    v.grossProfit = v.revenue - Math.abs(v.costOfRevenue);
  }
  // Total operating expenses = COGS + opex (+ R&D if separately reported)
  if (v.totalOperatingExpenses === undefined) {
    const cogs = v.costOfRevenue !== undefined ? Math.abs(v.costOfRevenue) : undefined;
    const opex = v.operatingExpenses !== undefined ? Math.abs(v.operatingExpenses) : undefined;
    const rnd = v.researchAndDevelopment !== undefined ? Math.abs(v.researchAndDevelopment) : 0;
    if (cogs !== undefined && opex !== undefined) {
      v.totalOperatingExpenses = cogs + opex + rnd;
    }
  }
  // Operating income
  if (v.operatingIncome === undefined && v.grossProfit !== undefined && v.operatingExpenses !== undefined) {
    v.operatingIncome = v.grossProfit - Math.abs(v.operatingExpenses);
  }
  // EBITDA: operatingIncome + D&A
  if (v.ebitda === undefined) {
    if (v.operatingIncome !== undefined && v.depreciation !== undefined) {
      v.ebitda = v.operatingIncome + Math.abs(v.depreciation);
    } else if (
      v.netIncome !== undefined && v.incomeTax !== undefined &&
      v.interestExpense !== undefined && v.depreciation !== undefined
    ) {
      v.ebitda = v.netIncome + Math.abs(v.incomeTax) + Math.abs(v.interestExpense) + Math.abs(v.depreciation);
    }
  }
  // EBIT
  if (v.ebit === undefined) {
    v.ebit = v.operatingIncome;
  }
  // EPS numerator available to common stockholders.
  if (v.dilutedNetIncomeAvailableToCommon === undefined && v.netIncome !== undefined) {
    v.dilutedNetIncomeAvailableToCommon =
      v.netIncome - Math.abs(v.preferredDividends ?? 0) - (v.nonControllingInterestIncome ?? 0);
  }
  // Non-current assets
  if (v.nonCurrentAssets === undefined && v.assets !== undefined && v.currentAssets !== undefined) {
    v.nonCurrentAssets = v.assets - v.currentAssets;
  }
  // Non-current liabilities
  if (v.nonCurrentLiabilities === undefined && v.liabilities !== undefined && v.currentLiabilities !== undefined) {
    v.nonCurrentLiabilities = v.liabilities - v.currentLiabilities;
  }
  // Total liabilities & equity (= assets as check)
  if (v.totalLiabilitiesEquity === undefined && v.liabilities !== undefined && v.equity !== undefined) {
    v.totalLiabilitiesEquity = v.liabilities + v.equity;
  }
  // Working capital
  if (v.workingCapital === undefined && v.currentAssets !== undefined && v.currentLiabilities !== undefined) {
    v.workingCapital = v.currentAssets - v.currentLiabilities;
  }
  // Total debt fallback: longTermDebt + shortTermDebt
  if (v.debt === undefined && v.longTermDebt !== undefined) {
    v.debt = v.longTermDebt + (v.shortTermDebt ?? 0);
  }
  // Net debt
  if (v.netDebt === undefined && v.debt !== undefined && v.cash !== undefined) {
    v.netDebt = v.debt - v.cash;
  }
  // Free cash flow
  if (v.freeCashFlow === undefined && v.operatingCashFlow !== undefined) {
    v.freeCashFlow = v.operatingCashFlow + (v.capex ?? 0);
  }
  // Operating/investing/financing catch-alls reconcile visible sub-lines to section totals.
  if (v.otherOperatingActivities === undefined && v.operatingCashFlow !== undefined) {
    const visibleOperating = [
      v.netIncome,
      v.daCashFlow,
      v.stockBasedCompensation,
      v.changesInWorkingCapital,
    ];
    if (visibleOperating.some((value) => value !== undefined)) {
      v.otherOperatingActivities =
        v.operatingCashFlow - visibleOperating.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    }
  }
  if (v.otherInvestingActivities === undefined && v.investingCashFlow !== undefined) {
    const visibleInvesting = [v.acquisitions, v.purchaseSaleInvestments, v.capex];
    if (visibleInvesting.some((value) => value !== undefined)) {
      v.otherInvestingActivities =
        v.investingCashFlow - visibleInvesting.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    }
  }
  if (v.otherFinancingActivities === undefined && v.financingCashFlow !== undefined) {
    const visibleFinancing = [
      v.issuanceRetirementStock,
      v.issuanceRetirementDebt,
      v.dividendsPaid,
    ];
    if (visibleFinancing.some((value) => value !== undefined)) {
      v.otherFinancingActivities =
        v.financingCashFlow - visibleFinancing.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    }
  }
  // Net change in cash
  if (v.netChangeInCash === undefined &&
      v.operatingCashFlow !== undefined && v.investingCashFlow !== undefined && v.financingCashFlow !== undefined) {
    v.netChangeInCash = v.operatingCashFlow + v.investingCashFlow + v.financingCashFlow;
  }
  // Prefer statement-period cash ending balance; fall back to the balance sheet cash value for the same filing.
  if (v.cashAtEndOfPeriod === undefined && v.cash !== undefined) {
    v.cashAtEndOfPeriod = v.cash;
  }

  return v;
}

function periodLabel(report: FinancialReport, frequency: FinancialFrequency): string {
  if (frequency === 'annual' || report.quarter === 0) return String(report.year);
  return `Q${report.quarter} '${String(report.year).slice(-2)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

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
      || a.quarter - b.quarter,
    );
}

export interface BuildFinancialRowsOpts {
  /** Parent keys in this set will have their immediate child rows hidden */
  collapsedParents?: Set<FinancialMetricKey>;
  /** Case-insensitive label filter */
  searchTerm?: string;
}

export function buildFinancialRows(
  periods: NormalizedFinancialPeriod[],
  statement: FinancialStatementKind,
  opts: BuildFinancialRowsOpts = {},
): FinancialDisplayRow[] {
  const collapsed = opts.collapsedParents ?? new Set<FinancialMetricKey>();
  const search = (opts.searchTerm ?? '').toLowerCase().trim();

  // Build a quick lookup: key → def (for grandparent checks)
  const defByKey = new Map<FinancialMetricKey, FinancialRowDef>();
  for (const def of FINANCIAL_ROW_DEFS) defByKey.set(def.key, def);

  return FINANCIAL_ROW_DEFS
    .filter((def) => def.statement === statement)
    .filter((def) => {
      if (!def.parentKey) return true;
      // Hide if direct parent is collapsed
      if (collapsed.has(def.parentKey)) return false;
      // Hide if grandparent is collapsed (handles indent-2 rows)
      const parentDef = defByKey.get(def.parentKey);
      if (parentDef?.parentKey && collapsed.has(parentDef.parentKey)) return false;
      return true;
    })
    .map((def) => ({
      ...def,
      values: periods.map((period) => period.values[def.key] ?? null),
    }))
    .filter((row) => {
      // Always show parent rows (they may have collapsed children)
      if (row.isParent) return true;
      // Drop rows with no data across all periods
      if (row.values.every((v) => v === null)) return false;
      // Label search filter
      if (search && !row.label.toLowerCase().includes(search)) return false;
      return true;
    });
}

export function getLatestFinancialValue(
  periods: NormalizedFinancialPeriod[],
  key: FinancialMetricKey,
): number | undefined {
  for (let i = periods.length - 1; i >= 0; i -= 1) {
    const value = periods[i]?.values[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function ratio(
  numerator: number | undefined,
  denominator: number | undefined,
): number | undefined {
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  return numerator / denominator;
}
