import type {
  GetSecFilingAnalysisRequest,
  GetSecFilingAnalysisResponse,
  SecFilingEvent,
  SecFilingMetric,
  SecFilingSeries,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { cachedFetchJson } from '../../../_shared/redis';

export const SEC_USER_AGENT = 'EdgePannel/1.0 (contact@worldmonitor.io)';
export const SEC_UPSTREAM_TIMEOUT_MS = 10_000;
const SEC_DOCUMENT_MAX_CHARS = 2_000_000;

const SEC_CACHE_TTL = 60 * 60;
const TICKER_CACHE_TTL = 24 * 60 * 60;

export interface SecTickerDirectoryEntry {
  cik_str: number | string;
  ticker: string;
  title: string;
}

export interface SecResolvedCompany {
  cik: string;
  ticker: string;
  name: string;
}

export interface EdgarSubmissionsRecent {
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
  acceptanceDateTime?: string[];
  form?: string[];
  primaryDocument?: string[];
  primaryDocDescription?: string[];
  items?: string[];
  size?: number[];
}

export interface EdgarSubmissionsFile {
  name: string;
  filingCount?: number;
  filingFrom?: string;
  filingTo?: string;
}

export interface EdgarSubmissions {
  cik?: string | number;
  entityType?: string;
  name?: string;
  tickers?: string[];
  filings?: {
    recent?: EdgarSubmissionsRecent;
    files?: EdgarSubmissionsFile[];
  };
  recent?: EdgarSubmissionsRecent;
}

export interface EdgarFilingRecord {
  accessionNumber: string;
  filingType: string;
  filedAt: string;
  reportDate: string;
  acceptanceDateTime: string;
  title: string;
  primaryDocument: string;
  url: string;
  items: string;
}

interface CompanyFactEntry {
  val?: number;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  start?: string;
  end?: string;
  accn?: string;
}

interface CompanyFacts {
  cik?: number | string;
  entityName?: string;
  facts?: Record<string, Record<string, { label?: string; units?: Record<string, CompanyFactEntry[]> }>>;
}

interface MetricSpec {
  label: string;
  unit: 'USD' | 'shares';
  kind: string;
  concepts: string[];
}

export interface FormSpecificAnalysis {
  bullets: string[];
  metrics: SecFilingMetric[];
  events: SecFilingEvent[];
  fallbackReason: string;
}

const METRIC_SPECS: Record<string, MetricSpec> = {
  revenue: {
    label: 'Revenue',
    unit: 'USD',
    kind: 'income',
    concepts: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  },
  netIncome: {
    label: 'Net income',
    unit: 'USD',
    kind: 'income',
    concepts: ['NetIncomeLoss', 'ProfitLoss'],
  },
  operatingIncome: {
    label: 'Operating income',
    unit: 'USD',
    kind: 'income',
    concepts: ['OperatingIncomeLoss'],
  },
  assets: {
    label: 'Assets',
    unit: 'USD',
    kind: 'balance',
    concepts: ['Assets'],
  },
  liabilities: {
    label: 'Liabilities',
    unit: 'USD',
    kind: 'balance',
    concepts: ['Liabilities'],
  },
  equity: {
    label: 'Stockholders equity',
    unit: 'USD',
    kind: 'balance',
    concepts: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  },
  cash: {
    label: 'Cash and equivalents',
    unit: 'USD',
    kind: 'balance',
    concepts: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  },
  debt: {
    label: 'Debt',
    unit: 'USD',
    kind: 'balance',
    concepts: ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebtAndFinanceLeaseObligationsCurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent', 'LongTermDebt'],
  },
  rAndD: {
    label: 'R&D expense',
    unit: 'USD',
    kind: 'income',
    concepts: ['ResearchAndDevelopmentExpense'],
  },
  sharesDiluted: {
    label: 'Diluted shares',
    unit: 'shares',
    kind: 'capital',
    concepts: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingDiluted'],
  },
};

let tickerDirectoryMemory: Record<string, SecTickerDirectoryEntry> | null = null;

export function padCik(cik: string | number): string {
  return String(cik || '').replace(/\D/g, '').padStart(10, '0');
}

export function cleanAccession(accession: string): string {
  return String(accession || '').replace(/[^0-9]/g, '');
}

export function dashedAccession(accession: string): string {
  const clean = cleanAccession(accession);
  if (clean.length !== 18) return accession;
  return `${clean.slice(0, 10)}-${clean.slice(10, 12)}-${clean.slice(12)}`;
}

export function buildEdgarUrl(cik: string, accessionNumber: string, primaryDoc: string): string {
  const cleanedCik = String(Number(padCik(cik)));
  const cleanedAccession = cleanAccession(accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${cleanedCik}/${cleanedAccession}/${primaryDoc}`;
}

export function classifyFilingType(filingType: string): string {
  const form = filingType.trim().toUpperCase();
  if (['10-K', '10-K/A', '10-Q', '10-Q/A', '20-F', '20-F/A', '40-F', '40-F/A'].includes(form)) return 'periodic';
  if (form === '8-K' || form === '8-K/A' || form === '6-K' || form === '6-K/A') return 'current';
  if (/^(S|F)-[1348](\/A)?$/.test(form)) return 'registration';
  if (form.includes('DEF 14A') || form.includes('PRE 14A') || form.includes('DEFM 14A') || form.includes('PREM 14A') || form.includes('DEFA 14A')) return 'proxy';
  if (form.startsWith('SC 13') || ['13D', '13G', '13D/A', '13G/A'].includes(form)) return 'ownership';
  if (['3', '3/A', '4', '4/A', '5', '5/A'].includes(form)) return 'insider';
  if (form.startsWith('13F')) return 'institutional';
  if (form.startsWith('424') || form.startsWith('497') || form === 'FWP') return 'prospectus';
  if (form.startsWith('N-') || form.startsWith('NPORT') || form === '485BPOS' || form === '485APOS') return 'fund';
  return 'other';
}

export function getRecentFilings(submissions: EdgarSubmissions): EdgarSubmissionsRecent {
  return submissions.filings?.recent ?? submissions.recent ?? {};
}

export function recentToRecords(submissions: EdgarSubmissions, cik: string): EdgarFilingRecord[] {
  const recent = getRecentFilings(submissions);
  const forms = recent.form ?? [];
  const records: EdgarFilingRecord[] = [];

  for (let i = 0; i < forms.length; i++) {
    const accession = recent.accessionNumber?.[i] ?? '';
    const primaryDocument = recent.primaryDocument?.[i] ?? '';
    const filingType = forms[i] ?? '';
    const title = recent.primaryDocDescription?.[i] || filingType || 'SEC filing';
    records.push({
      accessionNumber: accession,
      filingType,
      filedAt: recent.filingDate?.[i] ?? '',
      reportDate: recent.reportDate?.[i] ?? '',
      acceptanceDateTime: recent.acceptanceDateTime?.[i] ?? '',
      title,
      primaryDocument,
      url: primaryDocument
        ? buildEdgarUrl(cik, accession, primaryDocument)
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cik)}&type=${encodeURIComponent(filingType)}&dateb=&owner=include&count=10`,
      items: recent.items?.[i] ?? '',
    });
  }

  return records;
}

async function secFetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': SEC_USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(SEC_UPSTREAM_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`SEC returned HTTP ${resp.status}`);
  return await resp.json() as T;
}

async function secFetchText(url: string): Promise<string> {
  const trimmed = String(url || '').trim();
  if (!/^https:\/\/(?:www\.)?sec\.gov\//i.test(trimmed)) return '';
  const resp = await fetch(trimmed, {
    headers: {
      'User-Agent': SEC_USER_AGENT,
      Accept: 'text/html,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(SEC_UPSTREAM_TIMEOUT_MS),
  });
  if (!resp.ok) return '';
  const text = await resp.text();
  return text.slice(0, SEC_DOCUMENT_MAX_CHARS);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeFilingText(raw: string): string {
  return decodeEntities(String(raw || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<ix:[^>]+>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function metric(
  id: string,
  label: string,
  value: number,
  formattedValue: string,
  unit: string,
  kind: string,
  filedAt = '',
): SecFilingMetric {
  return {
    id,
    label,
    value,
    formattedValue,
    unit,
    kind,
    yoy: 0,
    hasYoy: false,
    fiscalPeriod: '',
    filedAt,
  };
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPercentMetric(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export async function fetchTickerDirectory(): Promise<Record<string, SecTickerDirectoryEntry>> {
  if (tickerDirectoryMemory) return tickerDirectoryMemory;

  const directory = await cachedFetchJson<Record<string, SecTickerDirectoryEntry>>(
    'market:sec:ticker-directory:v1',
    TICKER_CACHE_TTL,
    () => secFetchJson<Record<string, SecTickerDirectoryEntry>>('https://www.sec.gov/files/company_tickers.json'),
  );
  tickerDirectoryMemory = directory ?? {};
  return tickerDirectoryMemory;
}

export async function resolveSecCompany(ticker: string, cik: string): Promise<SecResolvedCompany | null> {
  const paddedCik = padCik(cik);
  const hasCik = paddedCik.replace(/^0+/, '').length > 0;
  const symbol = ticker.trim().toUpperCase();

  if (!symbol && !hasCik) return null;

  const directory = await fetchTickerDirectory();
  for (const entry of Object.values(directory)) {
    const entryCik = padCik(entry.cik_str);
    const entryTicker = String(entry.ticker || '').toUpperCase();
    if ((symbol && entryTicker === symbol) || (hasCik && entryCik === paddedCik)) {
      return {
        cik: entryCik,
        ticker: entryTicker || symbol,
        name: entry.title || symbol || entryCik,
      };
    }
  }

  if (hasCik) return { cik: paddedCik, ticker: symbol, name: symbol || paddedCik };
  return null;
}

export async function fetchSecSubmissions(cik: string): Promise<EdgarSubmissions | null> {
  const padded = padCik(cik);
  if (!padded.replace(/^0+/, '')) return null;
  return await cachedFetchJson<EdgarSubmissions>(
    `market:sec-submissions:v1:${padded}`,
    SEC_CACHE_TTL,
    () => secFetchJson<EdgarSubmissions>(`https://data.sec.gov/submissions/CIK${padded}.json`),
  );
}

export async function fetchSecSubmissionFile(fileName: string): Promise<EdgarSubmissionsRecent | null> {
  const safeName = String(fileName || '').trim();
  if (!/^CIK\d{10}-submissions-\d{3}\.json$/i.test(safeName)) return null;
  return await cachedFetchJson<EdgarSubmissionsRecent>(
    `market:sec-submission-file:v1:${safeName}`,
    SEC_CACHE_TTL,
    () => secFetchJson<EdgarSubmissionsRecent>(`https://data.sec.gov/submissions/${safeName}`),
  );
}

export async function filingsToRecordsWithArchives(submissions: EdgarSubmissions, cik: string): Promise<EdgarFilingRecord[]> {
  const records = recentToRecords(submissions, cik);
  const files = submissions.filings?.files ?? [];

  for (const file of files) {
    try {
      const archived = await fetchSecSubmissionFile(file.name);
      if (archived) {
        records.push(...recentToRecords({ recent: archived }, cik));
      }
    } catch (err) {
      console.warn(`[SEC] Failed to load archived submissions file ${file.name}:`, err);
    }
  }

  records.sort((a, b) => b.filedAt.localeCompare(a.filedAt) || b.accessionNumber.localeCompare(a.accessionNumber));
  return records;
}

async function fetchCompanyFacts(cik: string): Promise<CompanyFacts | null> {
  const padded = padCik(cik);
  if (!padded.replace(/^0+/, '')) return null;
  return await cachedFetchJson<CompanyFacts>(
    `market:sec-companyfacts:v1:${padded}`,
    SEC_CACHE_TTL,
    () => secFetchJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`),
  );
}

export function findFilingRecord(
  records: EdgarFilingRecord[],
  accessionNumber: string,
  filingType: string,
): EdgarFilingRecord | null {
  const accession = cleanAccession(accessionNumber);
  if (accession) {
    const matched = records.find((record) => cleanAccession(record.accessionNumber) === accession);
    if (matched) return matched;
  }

  const form = filingType.trim().toUpperCase();
  if (form) {
    return records.find((record) => record.filingType.toUpperCase() === form) ?? null;
  }

  return records[0] ?? null;
}

function factEntries(facts: CompanyFacts | null, spec: MetricSpec): CompanyFactEntry[] {
  const usGaap = facts?.facts?.['us-gaap'] ?? {};
  for (const concept of spec.concepts) {
    const units = usGaap[concept]?.units;
    if (!units) continue;
    if (spec.unit === 'shares') return units.shares ?? units.Shares ?? [];
    return units.USD ?? units.usd ?? [];
  }
  return [];
}

function sortFacts(entries: CompanyFactEntry[]): CompanyFactEntry[] {
  return [...entries]
    .filter((entry) => Number.isFinite(entry.val) && entry.filed)
    .sort((a, b) =>
      String(b.filed ?? '').localeCompare(String(a.filed ?? '')) ||
      String(b.end ?? '').localeCompare(String(a.end ?? ''))
    );
}

function durationDays(entry: CompanyFactEntry): number | null {
  if (!entry.start || !entry.end) return null;
  const start = Date.parse(entry.start);
  const end = Date.parse(entry.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function isComparableDuration(a: CompanyFactEntry, b: CompanyFactEntry): boolean {
  const aDays = durationDays(a);
  const bDays = durationDays(b);
  if (aDays === null || bDays === null) return true;
  return (aDays <= 120) === (bDays <= 120);
}

function pickCurrentFact(entries: CompanyFactEntry[], filing: EdgarFilingRecord | null, requestedForm: string): CompanyFactEntry | null {
  const sorted = sortFacts(entries);
  const accession = cleanAccession(filing?.accessionNumber ?? '');
  const form = (filing?.filingType || requestedForm || '').toUpperCase();

  if (accession) {
    const direct = sorted.find((entry) => cleanAccession(entry.accn ?? '') === accession);
    if (direct) return direct;
  }

  if (form) {
    const byForm = sorted.filter((entry) => String(entry.form || '').toUpperCase() === form);
    if (byForm.length > 0) return byForm[0]!;
  }

  return sorted[0] ?? null;
}

function findPriorYear(entries: CompanyFactEntry[], current: CompanyFactEntry | null): CompanyFactEntry | null {
  if (!current?.fy) return null;
  const targetFy = Number(current.fy) - 1;
  const currentFp = String(current.fp || '');
  const currentForm = String(current.form || '').toUpperCase();
  return sortFacts(entries).find((entry) =>
    Number(entry.fy) === targetFy &&
    String(entry.fp || '') === currentFp &&
    (!currentForm || String(entry.form || '').toUpperCase() === currentForm) &&
    isComparableDuration(current, entry)
  ) ?? null;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'shares') {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fiscalPeriod(entry: CompanyFactEntry): string {
  return [entry.fp, entry.fy ? String(entry.fy) : ''].filter(Boolean).join(' ') || entry.form || '';
}

export function buildMetricsFromFacts(
  facts: CompanyFacts | null,
  filing: EdgarFilingRecord | null,
  requestedForm: string,
): SecFilingMetric[] {
  const metrics: SecFilingMetric[] = [];
  for (const [id, spec] of Object.entries(METRIC_SPECS)) {
    const entries = factEntries(facts, spec);
    const current = pickCurrentFact(entries, filing, requestedForm);
    if (!current || !Number.isFinite(current.val)) continue;

    const prior = findPriorYear(entries, current);
    const hasYoy = Boolean(prior?.val);
    const yoy = hasYoy ? (current.val! - prior!.val!) / Math.abs(prior!.val!) : 0;

    metrics.push({
      id,
      label: spec.label,
      value: current.val!,
      formattedValue: formatValue(current.val!, spec.unit),
      unit: spec.unit,
      kind: spec.kind,
      yoy,
      hasYoy,
      fiscalPeriod: fiscalPeriod(current),
      filedAt: current.filed ?? '',
    });
  }
  return metrics;
}

function buildSeriesFromFacts(facts: CompanyFacts | null): SecFilingSeries[] {
  return ['revenue', 'netIncome', 'cash', 'debt'].flatMap((id) => {
    const spec = METRIC_SPECS[id];
    if (!spec) return [];
    const entries = sortFacts(factEntries(facts, spec))
      .filter((entry) => Number.isFinite(entry.val) && entry.end)
      .reverse();

    const seen = new Set<string>();
    const points = [];
    for (const entry of entries) {
      const key = `${entry.end}:${entry.fp}:${entry.fy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({
        label: fiscalPeriod(entry) || entry.end || '',
        value: entry.val ?? 0,
        filedAt: entry.filed ?? '',
      });
    }

    const latest = points.slice(-6);
    return latest.length >= 2
      ? [{ id, label: spec.label, unit: spec.unit, points: latest }]
      : [];
  });
}

function addRatioMetrics(metrics: SecFilingMetric[]): SecFilingMetric[] {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const revenue = byId.get('revenue')?.value;
  const netIncome = byId.get('netIncome')?.value;
  const debt = byId.get('debt')?.value;
  const equity = byId.get('equity')?.value;
  const assets = byId.get('assets')?.value;
  const ratios: SecFilingMetric[] = [];

  if (revenue && Number.isFinite(netIncome)) {
    const value = netIncome! / revenue;
    ratios.push({
      id: 'netMargin',
      label: 'Net margin',
      value,
      formattedValue: `${(value * 100).toFixed(1)}%`,
      unit: 'ratio',
      kind: 'ratio',
      yoy: 0,
      hasYoy: false,
      fiscalPeriod: byId.get('revenue')?.fiscalPeriod ?? '',
      filedAt: byId.get('revenue')?.filedAt ?? '',
    });
  }

  if (equity && Number.isFinite(debt)) {
    const value = debt! / Math.abs(equity);
    ratios.push({
      id: 'debtEquity',
      label: 'Debt / equity',
      value,
      formattedValue: `${value.toFixed(2)}x`,
      unit: 'multiple',
      kind: 'ratio',
      yoy: 0,
      hasYoy: false,
      fiscalPeriod: byId.get('equity')?.fiscalPeriod ?? '',
      filedAt: byId.get('equity')?.filedAt ?? '',
    });
  }

  if (assets && Number.isFinite(debt)) {
    const value = debt! / Math.abs(assets);
    ratios.push({
      id: 'debtAssets',
      label: 'Debt / assets',
      value,
      formattedValue: `${value.toFixed(2)}x`,
      unit: 'multiple',
      kind: 'ratio',
      yoy: 0,
      hasYoy: false,
      fiscalPeriod: byId.get('assets')?.fiscalPeriod ?? '',
      filedAt: byId.get('assets')?.filedAt ?? '',
    });
  }

  return [...metrics, ...ratios];
}

function categoryDescription(category: string, form: string): string {
  switch (category) {
    case 'periodic': return `${form} is a periodic issuer report. Structured values come from SEC XBRL company facts.`;
    case 'current': return `${form} is a current-event report. The reader highlights the 8-K item codes, likely disclosure theme, timing, and available issuer facts.`;
    case 'registration': return `${form} is a securities registration statement. V1 surfaces offering context and available issuer facts.`;
    case 'proxy': return `${form} is a proxy disclosure. The reader extracts meeting, voting, governance, proposal, and compensation signals when available.`;
    case 'ownership': return `${form} is a beneficial-ownership disclosure. The reader extracts ownership size, voting/dispositive power, amendment intent, and activist/passive context.`;
    case 'insider': return `${form} is an insider ownership or transaction form. The reader extracts reporting-owner, transaction, price, value, and post-transaction ownership context.`;
    case 'institutional': return `${form} is an institutional holdings filing. Detailed 13F portfolio interpretation remains in the institution flow.`;
    case 'fund': return `${form} is a fund disclosure. V1 provides categorized source metadata.`;
    case 'prospectus': return `${form} is prospectus material. V1 provides categorized source metadata.`;
    default: return `${form || 'This filing'} is categorized from SEC metadata.`;
  }
}

const FORM_8K_ITEM_LABELS: Record<string, string> = {
  '1.01': 'Entry into a Material Definitive Agreement',
  '1.02': 'Termination of a Material Definitive Agreement',
  '1.03': 'Bankruptcy or Receivership',
  '1.04': 'Mine Safety - Reporting of Shutdowns and Patterns of Violations',
  '2.01': 'Completion of Acquisition or Disposition of Assets',
  '2.02': 'Results of Operations and Financial Condition',
  '2.03': 'Creation of a Direct Financial Obligation',
  '2.04': 'Triggering Events That Accelerate a Direct Financial Obligation',
  '2.05': 'Costs Associated with Exit or Disposal Activities',
  '2.06': 'Material Impairments',
  '3.01': 'Notice of Delisting or Failure to Satisfy Listing Rule',
  '3.02': 'Unregistered Sales of Equity Securities',
  '3.03': 'Material Modification to Rights of Security Holders',
  '4.01': 'Changes in Registrant Certifying Accountant',
  '4.02': 'Non-Reliance on Previously Issued Financial Statements',
  '5.01': 'Changes in Control',
  '5.02': 'Departure or Appointment of Directors or Officers',
  '5.03': 'Amendments to Articles or Bylaws',
  '5.07': 'Submission of Matters to a Vote of Security Holders',
  '7.01': 'Regulation FD Disclosure',
  '8.01': 'Other Events',
  '9.01': 'Financial Statements and Exhibits',
};

function extract8KItems(filing: EdgarFilingRecord | null, text: string): string[] {
  const fromMetadata = (filing?.items || '').match(/\d\.\d{2}/g) ?? [];
  const fromText = [...text.matchAll(/\bItem\s+(\d\.\d{2})\b/gi)].map((match) => match[1] ?? '');
  return unique([...fromMetadata, ...fromText].filter(Boolean));
}

function daysBetween(start: string, end: string): number | null {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

export function analyzeCurrentReport(form: string, filing: EdgarFilingRecord | null, text: string): FormSpecificAnalysis {
  const items = extract8KItems(filing, text);
  const events: SecFilingEvent[] = items.map((item) => ({
    label: `Item ${item}`,
    value: FORM_8K_ITEM_LABELS[item] ?? 'Unmapped current-report item',
    kind: 'disclosure',
  }));
  const metrics: SecFilingMetric[] = [];
  if (items.length > 0) {
    metrics.push(metric('currentReportItemCount', '8-K items', items.length, formatCount(items.length), 'count', 'disclosure', filing?.filedAt ?? ''));
  }

  const filingLag = filing?.reportDate && filing.filedAt ? daysBetween(filing.reportDate, filing.filedAt) : null;
  if (filingLag !== null) {
    metrics.push(metric('filingLagDays', 'Report-to-file lag', filingLag, `${filingLag} day${filingLag === 1 ? '' : 's'}`, 'days', 'timing', filing?.filedAt ?? ''));
    events.push({ label: 'Timing', value: `${filingLag} day${filingLag === 1 ? '' : 's'} from report date to filing date`, kind: 'timing' });
  }

  const interpretation = items.some((item) => item === '2.02')
    ? 'Earnings or operating results update'
    : items.some((item) => item === '5.02')
      ? 'Leadership or board change disclosure'
      : items.some((item) => item === '1.01' || item === '2.01')
        ? 'Transaction or material agreement disclosure'
        : items.some((item) => item === '5.07')
          ? 'Shareholder vote result disclosure'
          : items.some((item) => item === '7.01' || item === '8.01')
            ? 'Market update or other event disclosure'
            : 'Current-report event disclosure';
  events.push({ label: 'Interpretation', value: interpretation, kind: 'interpretation' });

  return {
    bullets: [
      `${form} reports a current event rather than a full periodic financial statement.`,
      items.length > 0
        ? `Detected ${items.length} 8-K item${items.length === 1 ? '' : 's'}: ${items.map((item) => `${item} (${FORM_8K_ITEM_LABELS[item] ?? 'unmapped'})`).join('; ')}.`
        : 'No 8-K item code was found in SEC metadata or the primary document.',
      `Reader focus: ${interpretation.toLowerCase()}.`,
    ],
    metrics,
    events,
    fallbackReason: items.length > 0 ? '' : 'No 8-K item codes were extracted from the filing document.',
  };
}

function countUniqueProposalMarkers(text: string): number {
  const proposalNumbers = [...text.matchAll(/\bProposal\s+(?:No\.?\s*)?(\d+)\b/gi)].map((match) => match[1] ?? '');
  if (proposalNumbers.length > 0) return unique(proposalNumbers).length;
  const titled = text.match(/\b(?:Election of Directors|Ratification of|Advisory Vote|Approval of|Shareholder Proposal)\b/gi) ?? [];
  return unique(titled.map((item) => item.toLowerCase())).length;
}

export function analyzeProxyFiling(form: string, text: string, filing: EdgarFilingRecord | null): FormSpecificAnalysis {
  const meetingDate = firstMatch(text, [
    /\b(?:annual|special)\s+meeting[^.]{0,180}?\b(?:on|held on|to be held on|will be held on)\s+([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})/i,
    /\b(?:date of meeting|meeting date)\s*[:\-]?\s*([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})/i,
  ]);
  const recordDate = firstMatch(text, [
    /\brecord date\s*(?:for[^.]{0,80})?\s*(?:is|was|:)?\s*([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4})/i,
  ]);
  const proposalCount = countUniqueProposalMarkers(text);
  const shareholderProposalCount = (text.match(/\bshareholder proposal\b/gi) ?? []).length;
  const hasSayOnPay = /\bsay[-\s]?on[-\s]?pay\b|advisory vote (?:to approve|on) (?:executive )?compensation/i.test(text);
  const hasDirectorElection = /\belection of directors\b|\belect(?:ion)?\s+\d+\s+director/i.test(text);
  const payRatio = firstMatch(text, [
    /\bpay ratio\b[^.]{0,240}?(\d+(?:\.\d+)?\s*(?:to|:)\s*1)/i,
    /\bratio of annual total compensation[^.]{0,240}?(\d+(?:\.\d+)?\s*(?:to|:)\s*1)/i,
  ]);

  const events: SecFilingEvent[] = [];
  if (meetingDate) events.push({ label: 'Meeting date', value: meetingDate, kind: 'date' });
  if (recordDate) events.push({ label: 'Record date', value: recordDate, kind: 'date' });
  if (hasDirectorElection) events.push({ label: 'Director vote', value: 'Director-election matter detected', kind: 'governance' });
  if (hasSayOnPay) events.push({ label: 'Compensation vote', value: 'Say-on-pay or executive-compensation advisory vote detected', kind: 'governance' });
  if (shareholderProposalCount > 0) events.push({ label: 'Shareholder proposals', value: `${shareholderProposalCount} textual mention${shareholderProposalCount === 1 ? '' : 's'} detected`, kind: 'governance' });
  if (payRatio) events.push({ label: 'Pay ratio', value: payRatio, kind: 'compensation' });

  const metrics: SecFilingMetric[] = [];
  if (proposalCount > 0) metrics.push(metric('proxyProposalCount', 'Detected proposals', proposalCount, formatCount(proposalCount), 'count', 'governance', filing?.filedAt ?? ''));
  if (shareholderProposalCount > 0) metrics.push(metric('shareholderProposalMentions', 'Shareholder proposal mentions', shareholderProposalCount, formatCount(shareholderProposalCount), 'count', 'governance', filing?.filedAt ?? ''));
  metrics.push(metric('sayOnPayDetected', 'Say-on-pay detected', hasSayOnPay ? 1 : 0, hasSayOnPay ? 'Yes' : 'No', 'boolean', 'governance', filing?.filedAt ?? ''));
  metrics.push(metric('directorElectionDetected', 'Director election detected', hasDirectorElection ? 1 : 0, hasDirectorElection ? 'Yes' : 'No', 'boolean', 'governance', filing?.filedAt ?? ''));

  return {
    bullets: [
      `${form} is proxy material for shareholder voting and governance decisions.`,
      meetingDate ? `Meeting date extracted as ${meetingDate}.` : 'Meeting date was not confidently extracted from the proxy text.',
      proposalCount > 0 ? `Detected ${proposalCount} proposal marker${proposalCount === 1 ? '' : 's'} in the proxy material.` : 'No numbered proposal markers were confidently detected.',
      [hasDirectorElection ? 'director elections' : '', hasSayOnPay ? 'say-on-pay' : '', shareholderProposalCount > 0 ? 'shareholder proposal language' : ''].filter(Boolean).join(', ')
        ? `Governance signals include ${[hasDirectorElection ? 'director elections' : '', hasSayOnPay ? 'say-on-pay' : '', shareholderProposalCount > 0 ? 'shareholder proposal language' : ''].filter(Boolean).join(', ')}.`
        : 'No major governance signal was confidently extracted from the proxy text.',
    ],
    metrics,
    events,
    fallbackReason: events.length > 0 || proposalCount > 0 ? '' : 'No proxy meeting, proposal, or governance signals were extracted.',
  };
}

function extractOwnershipNumber(text: string, label: string): number | null {
  const pattern = new RegExp(`${label}[^\\d]{0,160}([\\d,]+(?:\\.\\d+)?)`, 'i');
  const match = text.match(pattern);
  return match?.[1] ? parseNumber(match[1]) : null;
}

export function analyzeOwnershipFiling(form: string, text: string, filing: EdgarFilingRecord | null): FormSpecificAnalysis {
  const percent = firstMatch(text, [
    /\bpercent of class(?: represented by amount in row \(11\))?[^0-9]{0,120}(\d{1,3}(?:\.\d+)?)\s*%/i,
    /\b(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:the\s+)?(?:class|common stock|ordinary shares)/i,
  ]);
  const percentValue = percent ? parseNumber(percent) : null;
  const beneficialShares = extractOwnershipNumber(text, 'amount beneficially owned') ?? extractOwnershipNumber(text, 'aggregate amount beneficially owned');
  const soleVoting = extractOwnershipNumber(text, 'sole voting power');
  const sharedVoting = extractOwnershipNumber(text, 'shared voting power');
  const soleDispositive = extractOwnershipNumber(text, 'sole dispositive power');
  const sharedDispositive = extractOwnershipNumber(text, 'shared dispositive power');
  const purposeSnippet = firstMatch(text, [
    /\bItem\s+4\.?\s+Purpose of Transaction\s+(.{40,420}?)(?:\bItem\s+5\b|\bItem\s+6\b|$)/i,
  ]).replace(/\s+/g, ' ');
  const activistKeywords = /\b(change in control|board representation|strategic alternatives|undervalued|engage with management|nominate|proxy contest|extraordinary transaction)\b/i.test(text);
  const passive = form.includes('13G') && !activistKeywords;
  const amendment = form.includes('/A') || /\bamendment\b/i.test(filing?.title ?? '');

  const events: SecFilingEvent[] = [];
  events.push({ label: 'Schedule type', value: form.includes('13D') ? 'Schedule 13D activist/control-oriented ownership' : form.includes('13G') ? 'Schedule 13G passive/institutional ownership' : 'Beneficial ownership disclosure', kind: 'interpretation' });
  if (amendment) events.push({ label: 'Amendment', value: 'This appears to amend a prior beneficial-ownership filing', kind: 'disclosure' });
  if (percentValue !== null) events.push({ label: 'Percent of class', value: formatPercentMetric(percentValue), kind: 'ownership' });
  if (beneficialShares !== null) events.push({ label: 'Beneficially owned shares', value: formatCount(beneficialShares), kind: 'ownership' });
  if (purposeSnippet) events.push({ label: 'Purpose excerpt', value: purposeSnippet.slice(0, 280), kind: 'interpretation' });
  events.push({ label: 'Interpretation', value: passive ? 'Passive or institutional beneficial ownership signal' : activistKeywords || form.includes('13D') ? 'Potentially activist or control-oriented ownership signal' : 'Beneficial ownership position signal', kind: 'interpretation' });

  const metrics: SecFilingMetric[] = [];
  if (percentValue !== null) metrics.push(metric('beneficialOwnershipPercent', 'Beneficial ownership', percentValue, formatPercentMetric(percentValue), 'percent', 'ownership', filing?.filedAt ?? ''));
  if (beneficialShares !== null) metrics.push(metric('beneficialShares', 'Beneficial shares', beneficialShares, formatCount(beneficialShares), 'shares', 'ownership', filing?.filedAt ?? ''));
  if (soleVoting !== null) metrics.push(metric('soleVotingPower', 'Sole voting power', soleVoting, formatCount(soleVoting), 'shares', 'ownership', filing?.filedAt ?? ''));
  if (sharedVoting !== null) metrics.push(metric('sharedVotingPower', 'Shared voting power', sharedVoting, formatCount(sharedVoting), 'shares', 'ownership', filing?.filedAt ?? ''));
  if (soleDispositive !== null) metrics.push(metric('soleDispositivePower', 'Sole dispositive power', soleDispositive, formatCount(soleDispositive), 'shares', 'ownership', filing?.filedAt ?? ''));
  if (sharedDispositive !== null) metrics.push(metric('sharedDispositivePower', 'Shared dispositive power', sharedDispositive, formatCount(sharedDispositive), 'shares', 'ownership', filing?.filedAt ?? ''));

  return {
    bullets: [
      `${form} reports a beneficial ownership position, not issuer operating results.`,
      percentValue !== null ? `Extracted beneficial ownership of ${formatPercentMetric(percentValue)} of the class.` : 'Percent of class was not confidently extracted.',
      beneficialShares !== null ? `Extracted ${formatCount(beneficialShares)} beneficially owned shares.` : 'Beneficial share count was not confidently extracted.',
      passive ? 'Interpretation leans passive/institutional based on Schedule 13G context.' : 'Interpretation leans activist/control-sensitive when Schedule 13D or activism language is present.',
    ],
    metrics,
    events,
    fallbackReason: metrics.length > 0 ? '' : 'No beneficial ownership percentages, shares, or power rows were extracted.',
  };
}

function firstXmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, 'i'));
  return match?.[1] ? decodeEntities(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : '';
}

function xmlBlocks(raw: string, tag: string): string[] {
  return [...String(raw || '').matchAll(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi'))].map((match) => match[0]);
}

function transactionDirection(code: string): 'acquired' | 'disposed' | 'other' {
  const upper = code.toUpperCase();
  if (['P', 'A', 'M', 'F'].includes(upper)) return upper === 'F' ? 'disposed' : 'acquired';
  if (['S', 'D'].includes(upper)) return 'disposed';
  return 'other';
}

export function analyzeInsiderFiling(form: string, raw: string, filing: EdgarFilingRecord | null): FormSpecificAnalysis {
  const ownerName = firstXmlTag(raw, 'rptOwnerName');
  const ownerTitle = firstXmlTag(raw, 'officerTitle');
  const issuerSymbol = firstXmlTag(raw, 'issuerTradingSymbol');
  const txBlocks = xmlBlocks(raw, 'nonDerivativeTransaction');
  const ownershipBlocks = xmlBlocks(raw, 'nonDerivativeHolding');

  let acquiredShares = 0;
  let disposedShares = 0;
  let totalValue = 0;
  let pricedShares = 0;
  const codes: string[] = [];
  const txDates: string[] = [];
  let postTransactionShares: number | null = null;

  for (const block of txBlocks) {
    const code = firstXmlTag(block, 'transactionCode');
    const shares = parseNumber(firstXmlTag(block, 'transactionShares')) ?? 0;
    const price = parseNumber(firstXmlTag(block, 'transactionPricePerShare')) ?? 0;
    const date = firstXmlTag(block, 'transactionDate');
    const ownedAfter = parseNumber(firstXmlTag(block, 'sharesOwnedFollowingTransaction'));
    const direction = transactionDirection(code);
    if (code) codes.push(code.toUpperCase());
    if (date) txDates.push(date);
    if (ownedAfter !== null) postTransactionShares = ownedAfter;
    if (direction === 'acquired') acquiredShares += shares;
    if (direction === 'disposed') disposedShares += shares;
    if (shares > 0 && price > 0) {
      totalValue += shares * price;
      pricedShares += shares;
    }
  }

  if (postTransactionShares === null && ownershipBlocks.length > 0) {
    postTransactionShares = parseNumber(firstXmlTag(ownershipBlocks[0]!, 'sharesOwnedFollowingTransaction'));
  }

  const netShares = acquiredShares - disposedShares;
  const averagePrice = pricedShares > 0 ? totalValue / pricedShares : null;
  const events: SecFilingEvent[] = [];
  if (ownerName) events.push({ label: 'Reporting owner', value: ownerName, kind: 'person' });
  if (ownerTitle) events.push({ label: 'Relationship', value: ownerTitle, kind: 'role' });
  if (issuerSymbol) events.push({ label: 'Issuer symbol', value: issuerSymbol, kind: 'ticker' });
  if (txDates.length > 0) events.push({ label: 'Transaction date', value: unique(txDates).join(', '), kind: 'date' });
  if (codes.length > 0) events.push({ label: 'Transaction code', value: unique(codes).join(', '), kind: 'transaction' });
  events.push({
    label: 'Interpretation',
    value: txBlocks.length === 0
      ? form.startsWith('3') ? 'Initial insider ownership statement' : 'Insider ownership statement without parsed transaction rows'
      : netShares > 0 ? 'Net insider acquisition' : netShares < 0 ? 'Net insider disposition' : 'Offsetting or non-open-market insider activity',
    kind: 'interpretation',
  });

  const metrics: SecFilingMetric[] = [];
  metrics.push(metric('insiderTransactionCount', 'Transaction rows', txBlocks.length, formatCount(txBlocks.length), 'count', 'transaction', filing?.filedAt ?? ''));
  if (acquiredShares > 0) metrics.push(metric('insiderSharesAcquired', 'Shares acquired', acquiredShares, formatCount(acquiredShares), 'shares', 'transaction', filing?.filedAt ?? ''));
  if (disposedShares > 0) metrics.push(metric('insiderSharesDisposed', 'Shares disposed', disposedShares, formatCount(disposedShares), 'shares', 'transaction', filing?.filedAt ?? ''));
  if (netShares !== 0) metrics.push(metric('insiderNetShares', 'Net shares', netShares, formatCount(netShares), 'shares', 'transaction', filing?.filedAt ?? ''));
  if (averagePrice !== null) metrics.push(metric('insiderAveragePrice', 'Average price', averagePrice, `$${formatNumber(averagePrice)}`, 'USD/share', 'transaction', filing?.filedAt ?? ''));
  if (totalValue > 0) metrics.push(metric('insiderTransactionValue', 'Estimated value', totalValue, formatValue(totalValue, 'USD'), 'USD', 'transaction', filing?.filedAt ?? ''));
  if (postTransactionShares !== null) metrics.push(metric('postTransactionShares', 'Shares after transaction', postTransactionShares, formatCount(postTransactionShares), 'shares', 'ownership', filing?.filedAt ?? ''));

  return {
    bullets: [
      `${form} reports insider ownership or transactions for the issuer.`,
      ownerName ? `Reporting owner: ${ownerName}${ownerTitle ? ` (${ownerTitle})` : ''}.` : 'Reporting owner was not confidently extracted.',
      txBlocks.length > 0
        ? `Parsed ${txBlocks.length} transaction row${txBlocks.length === 1 ? '' : 's'} with net share change of ${formatCount(netShares)}.`
        : 'No non-derivative transaction rows were parsed; this may be an initial/annual ownership statement or a document-format limitation.',
      totalValue > 0 ? `Estimated reported transaction value is ${formatValue(totalValue, 'USD')}.` : 'Transaction value was not available because shares or price were missing.',
    ],
    metrics,
    events,
    fallbackReason: ownerName || txBlocks.length > 0 ? '' : 'No Form 3/4/5 owner or transaction rows were extracted.',
  };
}

function emptyFormAnalysis(): FormSpecificAnalysis {
  return { bullets: [], metrics: [], events: [], fallbackReason: '' };
}

function analyzeFormSpecific(
  category: string,
  form: string,
  filing: EdgarFilingRecord | null,
  rawText: string,
): FormSpecificAnalysis {
  const normalized = normalizeFilingText(rawText);
  switch (category) {
    case 'current':
      return analyzeCurrentReport(form, filing, normalized);
    case 'proxy':
      return analyzeProxyFiling(form, normalized, filing);
    case 'ownership':
      return analyzeOwnershipFiling(form, normalized, filing);
    case 'insider':
      return analyzeInsiderFiling(form, rawText, filing);
    default:
      return emptyFormAnalysis();
  }
}

function buildEvents(category: string, filing: EdgarFilingRecord | null, formEvents: SecFilingEvent[]): SecFilingEvent[] {
  const events: SecFilingEvent[] = [];
  events.push({ label: 'Form category', value: category, kind: 'category' });
  if (filing?.filedAt) events.push({ label: 'Filed', value: filing.filedAt, kind: 'date' });
  if (filing?.reportDate) events.push({ label: 'Report date', value: filing.reportDate, kind: 'date' });
  events.push(...formEvents);
  if (category === 'registration') events.push({ label: 'Reader focus', value: 'Offering, shelf, merger, or resale registration context', kind: 'interpretation' });
  return events;
}

/** Returns true for form categories where XBRL issuer facts are shown inline. */
function includesIssuerFacts(category: string): boolean {
  return category === 'periodic' || category === 'current' || category === 'registration' || category === 'proxy';
}

/** Returns true for form categories where the time-series visualization is shown. */
function includesSeries(category: string): boolean {
  return category === 'periodic';
}

function buildBullets(
  category: string,
  form: string,
  filing: EdgarFilingRecord | null,
  metrics: SecFilingMetric[],
  formBullets: string[],
): string[] {
  const bullets = [categoryDescription(category, form), ...formBullets];
  if (filing?.title) bullets.push(`Primary document: ${filing.title}.`);

  // Only surface financial fact bullets for forms where XBRL metrics are meaningful
  if (includesIssuerFacts(category)) {
    const revenue = metrics.find((metric) => metric.id === 'revenue');
    const netIncome = metrics.find((metric) => metric.id === 'netIncome');
    const cash = metrics.find((metric) => metric.id === 'cash');
    const debt = metrics.find((metric) => metric.id === 'debt');
    if (revenue) bullets.push(`Latest revenue fact is ${revenue.formattedValue}${revenue.fiscalPeriod ? ` for ${revenue.fiscalPeriod}` : ''}.`);
    if (netIncome) bullets.push(`Latest net income fact is ${netIncome.formattedValue}.`);
    if (cash && debt) bullets.push(`Balance sheet snapshot shows ${cash.formattedValue} cash versus ${debt.formattedValue} debt.`);
    if (metrics.length === 0) bullets.push('Structured SEC company facts were not available for this filing, so the reader is showing source metadata.');
  }

  return bullets;
}

export async function buildSecFilingAnalysis(req: GetSecFilingAnalysisRequest): Promise<GetSecFilingAnalysisResponse> {
  const resolved = await resolveSecCompany(req.ticker || '', req.cik || '');
  const cik = resolved?.cik || padCik(req.cik || '');
  const submissions = cik.replace(/^0+/, '') ? await fetchSecSubmissions(cik) : null;
  const records = submissions ? await filingsToRecordsWithArchives(submissions, cik) : [];
  const filing = findFilingRecord(records, req.accessionNumber || '', req.filingType || '');
  const form = (filing?.filingType || req.filingType || '').trim().toUpperCase();
  const category = classifyFilingType(form);
  const companyName = submissions?.name || resolved?.name || '';
  const ticker = resolved?.ticker || req.ticker || '';
  const facts = cik.replace(/^0+/, '') ? await fetchCompanyFacts(cik) : null;
  const shouldAnalyzeDocument = category === 'current' || category === 'proxy' || category === 'ownership' || category === 'insider';
  let documentText = '';
  if (shouldAnalyzeDocument) {
    try {
      documentText = await secFetchText(filing?.url || req.documentUrl || '');
    } catch (err) {
      console.warn('[SEC] Failed to load filing document for reader:', err);
    }
  }
  const formAnalysis = shouldAnalyzeDocument
    ? analyzeFormSpecific(category, form, filing, documentText)
    : emptyFormAnalysis();
  // Only pull XBRL financials for forms where they're genuinely relevant.
  // Insider (Form 4), institutional (13F), ownership (13G/D), fund, and
  // prospectus filings should not surface company-wide P&L/balance sheet data.
  const issuerMetrics = includesIssuerFacts(category)
    ? addRatioMetrics(buildMetricsFromFacts(facts, filing, form))
    : [];
  const metrics = [...formAnalysis.metrics, ...issuerMetrics];
  const series = includesSeries(category)
    ? buildSeriesFromFacts(facts)
    : [];
  const structured = metrics.length > 0 || series.length > 0 || formAnalysis.events.length > 0 || formAnalysis.bullets.length > 0;
  const fallbackReason = structured ? '' : formAnalysis.fallbackReason || 'No structured SEC filing details were extracted.';
  const accession = filing?.accessionNumber || dashedAccession(req.accessionNumber || '');
  const url = filing?.url || req.documentUrl || (cik ? `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(cik)}` : '');

  return {
    ticker,
    companyName,
    cik,
    accessionNumber: accession,
    filingType: form || 'Unknown',
    formCategory: category,
    filedAt: filing?.filedAt || '',
    title: filing?.title || form || 'SEC filing',
    url,
    summaryBullets: buildBullets(category, form, filing, metrics, formAnalysis.bullets),
    metrics,
    events: buildEvents(category, filing, formAnalysis.events),
    series,
    structured,
    fallbackReason,
  };
}
