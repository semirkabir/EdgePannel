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
  buildEdgarUrl,
  fetchSecSubmissions,
  getRecentFilings,
  padCik,
  resolveSecCompany,
} from './sec-edgar';

const REDIS_CACHE_KEY_PREFIX = 'market:sec-filings:v2';
const REDIS_CACHE_TTL = 1800; // 30 minutes

export async function listSecFilings(
  _ctx: ServerContext,
  req: ListSecFilingsRequest,
): Promise<ListSecFilingsResponse> {
  const ticker = (req.ticker || '').toUpperCase().trim();
  if (!ticker) {
    return { filings: [], ticker: '', companyName: '' };
  }

  const limit = Math.min(Math.max(req.limit || 20, 1), 50);
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
    const recent = data ? getRecentFilings(data) : null;
    if (!recent?.form?.length) {
      return { filings: [], ticker, companyName: data?.name || resolved.name || ticker };
    }

    const filings: SecFiling[] = [];
    const maxEntries = Math.min(recent.form.length, 200);

    for (let i = 0; i < maxEntries && filings.length < 50; i++) {
      const form = recent.form[i] ?? '';
      if (filingTypeFilter.size > 0 && !filingTypeFilter.has(form)) continue;

      const accession = recent.accessionNumber?.[i] ?? '';
      const primaryDoc = recent.primaryDocument?.[i] ?? '';
      const description = recent.primaryDocDescription?.[i] ?? form;

      filings.push({
        accessionNumber: accession,
        filingType: form,
        filedAt: recent.filingDate?.[i] ?? '',
        title: description,
        url: primaryDoc
          ? buildEdgarUrl(cik, accession, primaryDoc)
          : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(form)}&dateb=&owner=include&count=10`,
        issuerName: data?.name || resolved.name || ticker,
        issuerCik: padCik(cik),
      });
    }

    return { filings, ticker, companyName: data?.name || resolved.name || ticker };
  });

  if (!result) {
    return { filings: [], ticker, companyName: '' };
  }

  let filings = result.filings;
  if (filingTypeFilter.size > 0) {
    filings = filings.filter(f => filingTypeFilter.has(f.filingType));
  }

  return {
    filings: filings.slice(0, limit),
    ticker: result.ticker,
    companyName: result.companyName,
  };
}
