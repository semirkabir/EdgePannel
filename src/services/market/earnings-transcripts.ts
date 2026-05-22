import { rssProxyUrl } from '@/utils';

export interface EarningsCallTranscript {
  quarter: string;    // "Q1 2025"
  filingDate: string; // "2025-01-30"
  reportDate: string; // "2024-12-31"
  indexUrl: string;   // EDGAR filing index page
  items: string;      // "2.02,7.01,9.01"
  kind: 'earnings' | 'transcript' | 'press-release' | 'filing';
  label: string;      // Human-readable e.g. "Earnings Release", "Press Release"
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

function classifyFiling(items: string): { kind: EarningsCallTranscript['kind']; label: string } {
  if (items.includes('2.02')) return { kind: 'earnings',      label: 'Earnings Release' };
  if (items.includes('7.01')) return { kind: 'transcript',    label: 'Earnings Transcript' };
  if (items.includes('8.01')) return { kind: 'press-release', label: 'Press Release' };
  if (items.includes('1.01')) return { kind: 'press-release', label: 'Material Agreement' };
  if (items.includes('5.02')) return { kind: 'filing',        label: 'Leadership Change' };
  if (items.includes('5.07')) return { kind: 'filing',        label: 'Shareholder Vote' };
  return { kind: 'filing', label: '8-K Filing' };
}

// Route both SEC calls through /api/rss-proxy to avoid browser CORS blocks.
async function proxyFetch(url: string): Promise<Response> {
  return fetch(rssProxyUrl(url));
}

async function resolveCik(ticker: string): Promise<string | null> {
  try {
    const url = `${EDGAR_BROWSE}?action=getcompany&CIK=${encodeURIComponent(ticker)}&type=8-K&dateb=&owner=include&count=1&search_text=&output=atom`;
    const resp = await proxyFetch(url);
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
    const resp = await proxyFetch(`${EDGAR_DATA}/submissions/CIK${padCik(cik)}.json`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { filings?: { recent?: SubmissionsRecent } };
    if (!data.filings?.recent) return [];
    recent = data.filings.recent;
  } catch {
    return [];
  }

  const forms = recent.form ?? [];
  const results: EarningsCallTranscript[] = [];

  for (let i = 0; i < forms.length && results.length < 12; i++) {
    if (forms[i] !== '8-K') continue;

    const items = recent.items?.[i] ?? '';
    const accession  = recent.accessionNumber?.[i] ?? '';
    const cleanAcc   = accession.replace(/-/g, '');
    const filingDate = recent.filingDate?.[i] ?? '';
    const reportDate = recent.reportDate?.[i] ?? '';
    const { kind, label } = classifyFiling(items);

    results.push({
      quarter:  inferQuarter(reportDate || filingDate),
      filingDate,
      reportDate,
      indexUrl: `${EDGAR_ARCHIVES}/${cik}/${cleanAcc}/${accession}-index.htm`,
      items,
      kind,
      label,
    });
  }

  return results;
}
