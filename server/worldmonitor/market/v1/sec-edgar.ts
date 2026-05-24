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

export interface EdgarSubmissions {
  cik?: string | number;
  entityType?: string;
  name?: string;
  tickers?: string[];
  filings?: {
    recent?: EdgarSubmissionsRecent;
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
  if (form.includes('DEF 14A') || form.includes('PRE 14A') || form.includes('DEFM 14A') || form.includes('PREM 14A')) return 'proxy';
  if (form.startsWith('SC 13') || form === '13D' || form === '13G') return 'ownership';
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
    case 'current': return `${form} is a current-event report. V1 surfaces event metadata and available issuer facts.`;
    case 'registration': return `${form} is a securities registration statement. V1 surfaces offering context and available issuer facts.`;
    case 'proxy': return `${form} is a proxy disclosure. V1 surfaces meeting/proxy metadata and issuer facts when available.`;
    case 'ownership': return `${form} is a beneficial-ownership disclosure. V1 surfaces ownership context and source metadata.`;
    case 'insider': return `${form} is an insider ownership or transaction form. V1 classifies the filing and links the source.`;
    case 'institutional': return `${form} is an institutional holdings filing. Detailed 13F portfolio interpretation remains in the institution flow.`;
    case 'fund': return `${form} is a fund disclosure. V1 provides categorized source metadata.`;
    case 'prospectus': return `${form} is prospectus material. V1 provides categorized source metadata.`;
    default: return `${form || 'This filing'} is categorized from SEC metadata.`;
  }
}

function buildEvents(category: string, filing: EdgarFilingRecord | null, form: string): SecFilingEvent[] {
  const events: SecFilingEvent[] = [];
  events.push({ label: 'Form category', value: category, kind: 'category' });
  if (filing?.filedAt) events.push({ label: 'Filed', value: filing.filedAt, kind: 'date' });
  if (filing?.reportDate) events.push({ label: 'Report date', value: filing.reportDate, kind: 'date' });
  if (filing?.items) events.push({ label: '8-K items', value: filing.items, kind: 'disclosure' });
  if (category === 'registration') events.push({ label: 'Reader focus', value: 'Offering, shelf, merger, or resale registration context', kind: 'interpretation' });
  if (category === 'proxy') events.push({ label: 'Reader focus', value: 'Shareholder meeting, voting, compensation, or transaction proxy context', kind: 'interpretation' });
  if (category === 'ownership') events.push({ label: 'Reader focus', value: 'Beneficial ownership position or amendment metadata', kind: 'interpretation' });
  if (category === 'insider') events.push({ label: 'Reader focus', value: form === '4' || form === '4/A' ? 'Insider transaction disclosure' : 'Insider ownership disclosure', kind: 'interpretation' });
  return events;
}

function buildBullets(
  category: string,
  form: string,
  filing: EdgarFilingRecord | null,
  metrics: SecFilingMetric[],
): string[] {
  const bullets = [categoryDescription(category, form)];
  if (filing?.title) bullets.push(`Primary document: ${filing.title}.`);
  const revenue = metrics.find((metric) => metric.id === 'revenue');
  const netIncome = metrics.find((metric) => metric.id === 'netIncome');
  const cash = metrics.find((metric) => metric.id === 'cash');
  const debt = metrics.find((metric) => metric.id === 'debt');
  if (revenue) bullets.push(`Latest revenue fact is ${revenue.formattedValue}${revenue.fiscalPeriod ? ` for ${revenue.fiscalPeriod}` : ''}.`);
  if (netIncome) bullets.push(`Latest net income fact is ${netIncome.formattedValue}.`);
  if (cash && debt) bullets.push(`Balance sheet snapshot shows ${cash.formattedValue} cash versus ${debt.formattedValue} debt.`);
  if (metrics.length === 0) bullets.push('Structured SEC company facts were not available for this filing, so the reader is showing source metadata.');
  return bullets;
}

export async function buildSecFilingAnalysis(req: GetSecFilingAnalysisRequest): Promise<GetSecFilingAnalysisResponse> {
  const resolved = await resolveSecCompany(req.ticker || '', req.cik || '');
  const cik = resolved?.cik || padCik(req.cik || '');
  const submissions = cik.replace(/^0+/, '') ? await fetchSecSubmissions(cik) : null;
  const records = submissions ? recentToRecords(submissions, cik) : [];
  const filing = findFilingRecord(records, req.accessionNumber || '', req.filingType || '');
  const form = (filing?.filingType || req.filingType || '').trim().toUpperCase();
  const category = classifyFilingType(form);
  const companyName = submissions?.name || resolved?.name || '';
  const ticker = resolved?.ticker || req.ticker || '';
  const facts = cik.replace(/^0+/, '') ? await fetchCompanyFacts(cik) : null;
  const metrics = addRatioMetrics(buildMetricsFromFacts(facts, filing, form));
  const series = buildSeriesFromFacts(facts);
  const structured = metrics.length > 0 || series.length > 0;
  const fallbackReason = structured ? '' : 'No SEC companyfacts metrics matched this filing.';
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
    summaryBullets: buildBullets(category, form, filing, metrics),
    metrics,
    events: buildEvents(category, filing, form),
    series,
    structured,
    fallbackReason,
  };
}
