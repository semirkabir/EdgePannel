import {
  NOTABLE_INVESTORS,
  fetchInstitutionalHoldings,
  type InstitutionalHolding,
  type InstitutionalHoldingsResponse,
  type NotableInvestor,
} from './portfolio';
import { fetchInstitutionalOwnership, type InstitutionalHolder } from './finnhub-extra';
import { fetchSec13FFeed, type SecFilingEntry } from './sec-filings';

export interface InstitutionSearchResult {
  name: string;
  cik: string;
  subtitle: string;
  matchReason: 'name' | 'cik' | 'ticker';
  latestFilingDate: string;
  latestFilingType: string;
  relatedTicker: string;
}

export interface InstitutionFilingHistoryEntry {
  id: string;
  institutionName: string;
  cik: string;
  filingType: string;
  filedAt: string;
  url: string;
  description: string;
  isAmendment: boolean;
}

export interface InstitutionHoldingMapped extends InstitutionalHolding {
  ticker: string;
  weightPct: number;
  valuePct: number;
  mappingSource: 'issuer_alias' | 'unmapped';
}

export interface CompanyInstitutionHolder {
  institutionName: string;
  cik: string;
  ticker: string;
  shares: number;
  percent: number;
  change: number;
  filingDate: string;
  latestFilingType: string;
  source: 'finnhub';
}

export interface NormalizedInstitutionProfile {
  name: string;
  cik: string;
  filingDate: string;
  filingCadence: string;
  holdings: InstitutionalHoldingsResponse['holdings'];
  mappedHoldings: InstitutionHoldingMapped[];
  filingHistory: InstitutionFilingHistoryEntry[];
  totalHoldings: number;
  totalValue: number;
  mappedValueCoverage: number;
}

interface InstitutionDirectoryEntry {
  name: string;
  cik: string;
  description: string;
  latestFilingDate: string;
  latestFilingType: string;
}

const HOLDER_CACHE_TTL = 15 * 60 * 1000;
const holderSearchCache = new Map<string, { ts: number; holders: CompanyInstitutionHolder[] }>();

const INSTITUTION_SUFFIXES = [
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'co',
  'company',
  'llc',
  'l l c',
  'lp',
  'l p',
  'ltd',
  'limited',
  'plc',
  'llp',
  'holdings',
];

const HOLDING_ISSUER_TICKERS: Record<string, string> = {
  'alphabet class a': 'GOOGL',
  'alphabet class c': 'GOOG',
  'alphabet inc': 'GOOGL',
  'amazon com': 'AMZN',
  'apple': 'AAPL',
  'berkshire hathaway cl b': 'BRK-B',
  'berkshire hathaway': 'BRK-B',
  'broadcom': 'AVGO',
  'costco wholesale': 'COST',
  'eli lilly': 'LLY',
  'jpmorgan chase': 'JPM',
  'mastercard': 'MA',
  'meta platforms': 'META',
  'microsoft': 'MSFT',
  'netflix': 'NFLX',
  'nvidia': 'NVDA',
  'oracle': 'ORCL',
  'procter gamble': 'PG',
  'salesforce': 'CRM',
  'taiwan semiconductor manufacturing': 'TSM',
  'tesla': 'TSLA',
  'unitedhealth group': 'UNH',
  'visa': 'V',
  'walmart': 'WMT',
  'wells fargo': 'WFC',
};

export function normalizeInstitutionName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = base.split(' ').filter(Boolean);
  const filtered = parts.filter(part => !INSTITUTION_SUFFIXES.includes(part));
  return filtered.join(' ').trim();
}

function normalizeIssuerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(class|cl|common|stock|shares|inc|corp|corporation|co|company|group|holdings|holding|plc|ltd)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapHoldingIssuerToTicker(issuer: string): string {
  const normalized = normalizeIssuerName(issuer);
  if (!normalized) return '';
  if (HOLDING_ISSUER_TICKERS[normalized]) return HOLDING_ISSUER_TICKERS[normalized]!;

  const entry = Object.entries(HOLDING_ISSUER_TICKERS).find(([alias]) =>
    normalized === alias || normalized.startsWith(alias + ' ') || alias.startsWith(normalized + ' ')
  );
  return entry?.[1] ?? '';
}

function isTickerQuery(query: string): boolean {
  return /^[A-Z]{1,5}([.-][A-Z])?$/.test(query.trim().toUpperCase());
}

export function inferFilingCadence(entries: Array<{ filedAt: string; filingType?: string }>): string {
  if (entries.length === 0) return 'No recent 13F history';
  if (entries.length === 1) return 'Latest filing only';

  const sorted = entries
    .map(entry => new Date(entry.filedAt))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  if (sorted.length < 2) return 'Latest filing only';

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i - 1]!.getTime() - sorted[i]!.getTime()) / 86400000);
  }
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const amended = entries.some(entry => (entry.filingType || '').includes('/A'));

  if (avgGap >= 70 && avgGap <= 120) {
    return amended ? 'Quarterly cadence with amendments' : 'Quarterly cadence';
  }
  if (avgGap >= 140 && avgGap <= 220) {
    return amended ? 'Semiannual cadence with amendments' : 'Semiannual cadence';
  }
  return amended ? 'Irregular cadence with amendments' : 'Irregular cadence';
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function buildInstitutionDirectory(recentFilings: SecFilingEntry[]): InstitutionDirectoryEntry[] {
  const byKey = new Map<string, InstitutionDirectoryEntry>();

  const upsert = (
    name: string,
    cik: string,
    description: string,
    latestFilingDate: string,
    latestFilingType: string,
  ): void => {
    const normalizedName = normalizeInstitutionName(name);
    const key = cik || normalizedName;
    if (!key) return;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { name, cik, description, latestFilingDate, latestFilingType });
      return;
    }

    const nextDate = latestFilingDate || existing.latestFilingDate;
    if (!existing.cik && cik) existing.cik = cik;
    if (!existing.description && description) existing.description = description;
    if (!existing.latestFilingDate || nextDate > existing.latestFilingDate) {
      existing.latestFilingDate = nextDate;
      existing.latestFilingType = latestFilingType || existing.latestFilingType;
      if (name) existing.name = name;
    }
  };

  for (const investor of NOTABLE_INVESTORS) {
    upsert(investor.name, investor.cik, investor.description, '', '');
  }

  for (const filing of recentFilings) {
    upsert(
      filing.filerName,
      filing.cik,
      '',
      filing.filedAt.toISOString(),
      filing.filingType,
    );
  }

  return Array.from(byKey.values()).sort((a, b) =>
    (b.latestFilingDate || '').localeCompare(a.latestFilingDate || '') || a.name.localeCompare(b.name)
  );
}

function findDirectoryMatch(
  name: string,
  recentFilings: SecFilingEntry[],
  directory: InstitutionDirectoryEntry[],
): InstitutionDirectoryEntry | null {
  const normalized = normalizeInstitutionName(name);
  if (!normalized) return null;

  const exact = directory.find(entry =>
    normalizeInstitutionName(entry.name) === normalized || normalizeInstitutionName(entry.description) === normalized
  );
  if (exact) return exact;

  const filingMatch = recentFilings.find(entry =>
    normalizeInstitutionName(entry.filerName) === normalized
  );
  if (!filingMatch) return null;

  return {
    name: filingMatch.filerName,
    cik: filingMatch.cik,
    description: '',
    latestFilingDate: filingMatch.filedAt.toISOString(),
    latestFilingType: filingMatch.filingType,
  };
}

function buildTickerSearchResults(
  ticker: string,
  rawHolders: InstitutionalHolder[],
  recentFilings: SecFilingEntry[],
  directory: InstitutionDirectoryEntry[],
): InstitutionSearchResult[] {
  const mapped = rawHolders.map(holder => {
    const match = findDirectoryMatch(holder.name, recentFilings, directory);
    return {
      name: match?.name || holder.name,
      cik: match?.cik || '',
      subtitle: `${ticker} holder${holder.percent ? ` · ${holder.percent.toFixed(2)}% of shares` : ''}`,
      matchReason: 'ticker' as const,
      latestFilingDate: holder.filingDate || match?.latestFilingDate || '',
      latestFilingType: match?.latestFilingType || '13F-HR',
      relatedTicker: ticker,
      shares: holder.share,
    };
  });

  return dedupeByKey(
    mapped
      .sort((a, b) =>
        (b.shares || 0) - (a.shares || 0) ||
        (b.latestFilingDate || '').localeCompare(a.latestFilingDate || '')
      )
      .map(({ shares: _shares, ...result }) => result),
    result => result.cik || normalizeInstitutionName(result.name),
  );
}

export async function searchInstitutions13F(
  query: string,
  opts: { limit?: number; recentFilings?: SecFilingEntry[] } = {},
): Promise<InstitutionSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const recentFilings = opts.recentFilings ?? await fetchSec13FFeed();
  const directory = buildInstitutionDirectory(recentFilings);
  const normalizedQuery = normalizeInstitutionName(trimmed);
  const cikQuery = trimmed.replace(/\D/g, '');
  const upperQuery = trimmed.toUpperCase();
  const isTicker = isTickerQuery(upperQuery);

  const matches = directory
    .filter(entry => {
      const entryName = normalizeInstitutionName(entry.name);
      const entryDesc = normalizeInstitutionName(entry.description);
      return (
        (!!cikQuery && entry.cik.includes(cikQuery)) ||
        (!!normalizedQuery && (
          entryName.includes(normalizedQuery) ||
          entryDesc.includes(normalizedQuery)
        ))
      );
    })
    .map((entry): InstitutionSearchResult => ({
      name: entry.name,
      cik: entry.cik,
      subtitle: entry.description || (entry.latestFilingDate ? 'Recent 13F filer' : 'Known filer'),
      matchReason: cikQuery && entry.cik.includes(cikQuery) ? 'cik' : 'name',
      latestFilingDate: entry.latestFilingDate,
      latestFilingType: entry.latestFilingType,
      relatedTicker: '',
    }));

  let tickerMatches: InstitutionSearchResult[] = [];
  if (isTicker) {
    const holders = await fetchCompanyInstitutionHolders13F(upperQuery, { recentFilings });
    tickerMatches = holders.map(holder => ({
      name: holder.institutionName,
      cik: holder.cik,
      subtitle: `${upperQuery} holder${holder.percent ? ` · ${holder.percent.toFixed(2)}% of shares` : ''}`,
      matchReason: 'ticker',
      latestFilingDate: holder.filingDate,
      latestFilingType: holder.latestFilingType,
      relatedTicker: upperQuery,
    }));
  }

  const combined = dedupeByKey(
    [...tickerMatches, ...matches],
    result => result.cik || normalizeInstitutionName(result.name),
  );

  combined.sort((a, b) => {
    const exactA = a.cik === cikQuery || normalizeInstitutionName(a.name) === normalizedQuery;
    const exactB = b.cik === cikQuery || normalizeInstitutionName(b.name) === normalizedQuery;
    if (exactA !== exactB) return exactA ? -1 : 1;
    if (a.matchReason !== b.matchReason) {
      const order = { ticker: 0, cik: 1, name: 2 } as const;
      return order[a.matchReason] - order[b.matchReason];
    }
    return (b.latestFilingDate || '').localeCompare(a.latestFilingDate || '') || a.name.localeCompare(b.name);
  });

  return combined.slice(0, opts.limit ?? 16);
}

export async function fetchInstitutionFilingHistory(
  cik: string,
  fallbackName = '',
  opts: { recentFilings?: SecFilingEntry[] } = {},
): Promise<InstitutionFilingHistoryEntry[]> {
  const recentFilings = opts.recentFilings ?? await fetchSec13FFeed();
  const normalizedFallback = normalizeInstitutionName(fallbackName);

  return dedupeByKey(
    recentFilings
      .filter(entry =>
        (!!cik && entry.cik === cik) ||
        (!!normalizedFallback && normalizeInstitutionName(entry.filerName) === normalizedFallback)
      )
      .sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime())
      .map(entry => ({
        id: entry.id,
        institutionName: entry.filerName,
        cik: entry.cik,
        filingType: entry.filingType,
        filedAt: entry.filedAt.toISOString(),
        url: entry.url,
        description: entry.description,
        isAmendment: entry.filingType.includes('/A'),
      })),
    entry => entry.id || `${entry.cik}:${entry.filedAt}:${entry.filingType}`,
  );
}

export async function fetchInstitution13FProfile(
  cik: string,
  fallbackName = '',
): Promise<NormalizedInstitutionProfile> {
  const recentFilings = await fetchSec13FFeed();

  let holdingsResp: InstitutionalHoldingsResponse;
  try {
    holdingsResp = await fetchInstitutionalHoldings(cik);
  } catch {
    holdingsResp = {
      name: fallbackName,
      cik,
      filingDate: '',
      filingHistory: [],
      holdings: [],
      totalHoldings: 0,
      totalValue: 0,
    };
  }

  const mappedHoldings = holdingsResp.holdings.map((holding) => {
    const ticker = mapHoldingIssuerToTicker(holding.issuer);
    const valuePct = holdingsResp.totalValue > 0 ? (holding.value / holdingsResp.totalValue) * 100 : 0;
    return {
      ...holding,
      ticker,
      weightPct: valuePct,
      valuePct,
      mappingSource: ticker ? 'issuer_alias' : 'unmapped',
    } satisfies InstitutionHoldingMapped;
  });

  const mappedValue = mappedHoldings.reduce((sum, holding) =>
    sum + (holding.ticker ? holding.value : 0), 0
  );
  const filingHistory = holdingsResp.filingHistory.length > 0
    ? holdingsResp.filingHistory.map((entry) => ({
      id: entry.id,
      institutionName: holdingsResp.name || fallbackName || 'Institution',
      cik,
      filingType: entry.filingType,
      filedAt: entry.acceptedAt || entry.filingDate,
      url: entry.url,
      description: '',
      isAmendment: entry.filingType.includes('/A'),
    }))
    : await fetchInstitutionFilingHistory(cik, holdingsResp.name || fallbackName, { recentFilings });

  return {
    name: holdingsResp.name || fallbackName || 'Institution',
    cik,
    filingDate: holdingsResp.filingDate,
    filingCadence: inferFilingCadence(filingHistory),
    holdings: holdingsResp.holdings,
    mappedHoldings,
    filingHistory,
    totalHoldings: holdingsResp.totalHoldings,
    totalValue: holdingsResp.totalValue,
    mappedValueCoverage: holdingsResp.totalValue > 0 ? (mappedValue / holdingsResp.totalValue) * 100 : 0,
  };
}

export async function fetchCompanyInstitutionHolders13F(
  ticker: string,
  opts: { recentFilings?: SecFilingEntry[] } = {},
): Promise<CompanyInstitutionHolder[]> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return [];

  const cached = holderSearchCache.get(symbol);
  if (cached && Date.now() - cached.ts < HOLDER_CACHE_TTL) {
    return cached.holders;
  }

  let rawHolders: InstitutionalHolder[] = [];
  try {
    rawHolders = await fetchInstitutionalOwnership(symbol);
  } catch {
    rawHolders = [];
  }

  const recentFilings = opts.recentFilings ?? await fetchSec13FFeed();
  const directory = buildInstitutionDirectory(recentFilings);
  const holders = buildTickerSearchResults(symbol, rawHolders, recentFilings, directory).map((result) => {
    const raw = rawHolders.find(holder =>
      normalizeInstitutionName(holder.name) === normalizeInstitutionName(result.name)
    );
    return {
      institutionName: result.name,
      cik: result.cik,
      ticker: symbol,
      shares: raw?.share ?? 0,
      percent: raw?.percent ?? 0,
      change: raw?.change ?? 0,
      filingDate: raw?.filingDate || result.latestFilingDate,
      latestFilingType: result.latestFilingType || '13F-HR',
      source: 'finnhub' as const,
    };
  });

  holderSearchCache.set(symbol, { ts: Date.now(), holders });
  return holders;
}

export function getFeaturedInstitutionResults(recentFilings: SecFilingEntry[]): InstitutionSearchResult[] {
  const directory = buildInstitutionDirectory(recentFilings);
  return NOTABLE_INVESTORS.map((investor: NotableInvestor) => {
    const match = directory.find(entry => entry.cik === investor.cik);
    return {
      name: investor.name,
      cik: investor.cik,
      subtitle: investor.description,
      matchReason: 'name' as const,
      latestFilingDate: match?.latestFilingDate || '',
      latestFilingType: match?.latestFilingType || '',
      relatedTicker: '',
    };
  });
}
