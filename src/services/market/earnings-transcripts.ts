import { fetchWithProxy } from '@/utils';

export interface EarningsCallTranscript {
  quarter: string;    // "Q1 2025"
  filingDate: string; // "2025-01-30"
  reportDate: string; // "2024-12-31"
  indexUrl: string;   // EDGAR filing index page
  items: string;      // "2.02,7.01,9.01"
}

const EDGAR_BROWSE   = 'https://www.sec.gov/cgi-bin/browse-edgar';
const EDGAR_DATA     = 'https://data.sec.gov';
const EDGAR_ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';

function padCik(cik: string): string {
  return cik.padStart(10, '0');
}

function inferQuarter(reportDate: string): string {
  const d = new Date(reportDate);
  if (isNaN(d.getTime())) return '';
  const m = d.getMonth() + 1;
  const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
  return `${q} ${d.getFullYear()}`;
}

async function resolveCik(ticker: string): Promise<string | null> {
  try {
    const url = `${EDGAR_BROWSE}?action=getcompany&CIK=${encodeURIComponent(ticker)}&type=8-K&dateb=&owner=include&count=1&search_text=&output=atom`;
    const resp = await fetchWithProxy(url);
    if (!resp.ok) return null;
    const text = await resp.text();
    const m = text.match(/\/Archives\/edgar\/data\/(\d+)\//);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

interface SubmissionsRecent {
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
  form?: string[];
  items?: string[];
}

export async function fetchEarningsCallTranscripts(ticker: string): Promise<EarningsCallTranscript[]> {
  const cik = await resolveCik(ticker);
  if (!cik) return [];

  let recent: SubmissionsRecent;
  try {
    const resp = await fetchWithProxy(`${EDGAR_DATA}/submissions/CIK${padCik(cik)}.json`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { filings?: { recent?: SubmissionsRecent } };
    if (!data.filings?.recent) return [];
    recent = data.filings.recent;
  } catch {
    return [];
  }

  const forms = recent.form ?? [];
  const results: EarningsCallTranscript[] = [];

  for (let i = 0; i < forms.length && results.length < 8; i++) {
    if (forms[i] !== '8-K') continue;

    const items = recent.items?.[i] ?? '';
    // Earnings 8-Ks file Item 2.02 (Results of Operations) or 7.01 (Reg FD / transcript)
    if (!items.includes('2.02') && !items.includes('7.01')) continue;

    const accession = recent.accessionNumber?.[i] ?? '';
    const cleanAcc  = accession.replace(/-/g, '');
    const filingDate = recent.filingDate?.[i] ?? '';
    const reportDate = recent.reportDate?.[i] ?? '';

    results.push({
      quarter:    inferQuarter(reportDate || filingDate),
      filingDate,
      reportDate,
      indexUrl:   `${EDGAR_ARCHIVES}/${cik}/${cleanAcc}/${accession}-index.htm`,
      items,
    });
  }

  return results;
}
