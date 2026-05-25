/**
 * RPC: ListSecFilings
 * Fetches recent SEC EDGAR filings for a company by ticker symbol.
 * Uses the SEC EDGAR submissions API (free, no API key required).
 */
import type {
  ServerContext,
  ListSecFilingsRequest,
  ListSecFilingsResponse,
  SecFiling,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { cachedFetchJson } from '../../../_shared/redis';
import { parseStringArray } from './_shared';
import {
  fetchSecSubmissions,
  type EdgarFilingRecord,
  filingsToRecordsWithArchives,
  padCik,
  resolveSecCompany,
} from './sec-edgar';

const REDIS_CACHE_KEY_PREFIX = 'market:sec-filings:v5';
const REDIS_CACHE_TTL = 1800; // 30 minutes
const MAX_FILINGS_PER_ISSUER = 10_000;
type SecFilingSort = 'newest' | 'oldest' | 'type';

function filingDateMs(record: EdgarFilingRecord | SecFiling): number {
  const ms = new Date(record.filedAt || '').getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeSort(value: string): SecFilingSort {
  return value === 'oldest' || value === 'type' ? value : 'newest';
}

function dateRangeCutoff(range: string): number {
  const now = Date.now();
  switch (range) {
    case '7d': return now - 7 * 24 * 60 * 60 * 1000;
    case '30d': return now - 30 * 24 * 60 * 60 * 1000;
    case '90d': return now - 90 * 24 * 60 * 60 * 1000;
    case '1y': return now - 365 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

function sortFilings(filings: SecFiling[], sort: SecFilingSort): SecFiling[] {
  const sorted = [...filings];
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => filingDateMs(a) - filingDateMs(b));
      break;
    case 'type':
      sorted.sort((a, b) => (a.filingType || '').localeCompare(b.filingType || '') || filingDateMs(b) - filingDateMs(a));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => filingDateMs(b) - filingDateMs(a));
      break;
  }
  return sorted;
}

export async function listSecFilings(
  _ctx: ServerContext,
  req: ListSecFilingsRequest,
): Promise<ListSecFilingsResponse> {
  const ticker = (req.ticker || '').toUpperCase().trim();
  if (!ticker) {
    return { filings: [], ticker: '', companyName: '', totalCount: 0, offset: 0, limit: 0 };
  }

  const limit = Math.min(Math.max(req.limit || 20, 1), MAX_FILINGS_PER_ISSUER);
  const offset = Math.max(req.offset || 0, 0);
  const sort = normalizeSort(req.sort || '');
  const search = (req.search || '').trim().toLowerCase();
  const cutoff = dateRangeCutoff(req.dateRange || '');
  const fromMs = req.fromDate ? new Date(`${req.fromDate}T00:00:00`).getTime() : 0;
  const toMs = req.toDate ? new Date(`${req.toDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  const filingTypesRaw = parseStringArray(req.filingTypes);
  const filingTypeFilter = new Set(filingTypesRaw.map(t => t.toUpperCase()));
  const cacheKey = `${REDIS_CACHE_KEY_PREFIX}:${ticker}`;

  const result = await cachedFetchJson<ListSecFilingsResponse>(cacheKey, REDIS_CACHE_TTL, async () => {
    const resolved = await resolveSecCompany(ticker, '');
    const cik = resolved?.cik;
    if (!cik) {
      console.warn(`[SEC] No CIK mapping for ticker: ${ticker}`);
      return null;
    }

    const data = await fetchSecSubmissions(cik);
    const records = data ? await filingsToRecordsWithArchives(data, cik) : [];
    if (records.length === 0) {
      return { filings: [], ticker, companyName: data?.name || resolved.name || ticker, totalCount: 0, offset: 0, limit: 0 };
    }

    const filings: SecFiling[] = records
      .slice(0, MAX_FILINGS_PER_ISSUER)
      .map((record) => ({
        accessionNumber: record.accessionNumber,
        filingType: record.filingType,
        filedAt: record.filedAt,
        title: record.title,
        url: record.url,
        issuerName: data?.name || resolved.name || ticker,
        issuerCik: padCik(cik),
      }));

    return { filings, ticker, companyName: data?.name || resolved.name || ticker, totalCount: filings.length, offset: 0, limit: filings.length };
  });

  if (!result) {
    return { filings: [], ticker, companyName: '', totalCount: 0, offset: 0, limit };
  }

  let filings = result.filings;
  if (filingTypeFilter.size > 0) {
    filings = filings.filter(f => filingTypeFilter.has(f.filingType.toUpperCase()));
  }
  if (cutoff) {
    filings = filings.filter(f => filingDateMs(f) >= cutoff);
  }
  if (fromMs) {
    filings = filings.filter(f => filingDateMs(f) >= fromMs);
  }
  if (Number.isFinite(toMs)) {
    filings = filings.filter(f => filingDateMs(f) <= toMs);
  }
  if (search) {
    filings = filings.filter(f => [
      f.title,
      f.filingType,
      f.accessionNumber,
      f.issuerName,
      f.issuerCik,
    ].some(value => (value || '').toLowerCase().includes(search)));
  }

  const sorted = sortFilings(filings, sort);
  const totalCount = sorted.length;

  return {
    filings: sorted.slice(offset, offset + limit),
    ticker: result.ticker,
    companyName: result.companyName,
    totalCount,
    offset,
    limit,
  };
}
