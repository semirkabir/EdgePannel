import { rssProxyUrl } from '@/utils';

export interface EarningsCallTranscript {
  quarter: string;    // "Q1 2025"
  filingDate: string; // "2025-01-30"
  reportDate: string; // "2024-12-31"
  indexUrl: string;   // EDGAR filing index page
  items: string;      // "2.02,7.01,9.01"
  kind: 'earnings' | 'transcript' | 'press-release' | 'filing';
  label: string;      // Human-readable e.g. "Earnings Release", "Press Release"
  source: 'finnhub' | 'sec-edgar';
  transcriptId?: string;
  audioUrl?: string;
}

export interface EarningsCallTranscriptDetail {
  id: string;
  title: string;
  quarter: string;
  time: string;
  audioUrl?: string;
  participants: Array<{ name: string; description?: string; role?: string }>;
  transcript: Array<{ name: string; session?: string; speech: string[] }>;
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

interface FinnhubTranscriptSummary {
  id?: string;
  quarter?: number | string;
  symbol?: string;
  time?: string;
  title?: string;
  year?: number | string;
}

interface FinnhubTranscriptDetail {
  audio?: string;
  id?: string;
  participant?: Array<{ name?: string; description?: string; role?: string }>;
  quarter?: number | string;
  symbol?: string;
  time?: string;
  title?: string;
  transcript?: Array<{ name?: string; session?: string; speech?: string[] }>;
  year?: number | string;
}

async function fetchMarketData(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL('/api/market-data', window.location.origin);
  url.searchParams.set('endpoint', endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(error.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function normalizeFinnhubQuarter(quarter: number | string | undefined, year: number | string | undefined): string {
  const q = quarter ? `Q${String(quarter).replace(/^q/i, '')}` : '';
  return [q, year ? String(year) : ''].filter(Boolean).join(' ');
}

function normalizeFinnhubDate(time: string | undefined): string {
  if (!time) return '';
  const match = time.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? '';
}

async function fetchFinnhubTranscriptSummaries(ticker: string): Promise<EarningsCallTranscript[]> {
  const data = await fetchMarketData('earnings-transcripts-list', { symbol: ticker }) as {
    transcripts?: FinnhubTranscriptSummary[];
  };
  const transcripts = Array.isArray(data.transcripts) ? data.transcripts : [];

  return transcripts
    .filter((item) => item.id)
    .slice(0, 8)
    .map((item) => ({
      quarter: normalizeFinnhubQuarter(item.quarter, item.year),
      filingDate: normalizeFinnhubDate(item.time),
      reportDate: normalizeFinnhubDate(item.time),
      indexUrl: '',
      items: '',
      kind: 'transcript' as const,
      label: item.title || `${ticker.toUpperCase()} Earnings Call Transcript`,
      source: 'finnhub' as const,
      transcriptId: item.id,
    }));
}

export async function fetchEarningsCallTranscriptDetail(id: string): Promise<EarningsCallTranscriptDetail | null> {
  const data = await fetchMarketData('earnings-transcript', { id }) as FinnhubTranscriptDetail;
  if (!data?.id && !data?.transcript) return null;

  return {
    id: data.id || id,
    title: data.title || 'Earnings Call Transcript',
    quarter: normalizeFinnhubQuarter(data.quarter, data.year),
    time: data.time || '',
    audioUrl: data.audio || undefined,
    participants: (data.participant ?? [])
      .filter((participant) => participant.name)
      .map((participant) => ({
        name: participant.name!,
        description: participant.description,
        role: participant.role,
      })),
    transcript: (data.transcript ?? [])
      .filter((entry) => entry.name || entry.speech?.length)
      .map((entry) => ({
        name: entry.name || 'Speaker',
        session: entry.session,
        speech: Array.isArray(entry.speech) ? entry.speech : [],
      })),
  };
}

async function fetchSecEarningsCallFilings(ticker: string): Promise<EarningsCallTranscript[]> {
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
  const earningsFilings: EarningsCallTranscript[] = [];
  const otherFilings: EarningsCallTranscript[] = [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] !== '8-K') continue;

    const items = recent.items?.[i] ?? '';
    const accession  = recent.accessionNumber?.[i] ?? '';
    const cleanAcc   = accession.replace(/-/g, '');
    const filingDate = recent.filingDate?.[i] ?? '';
    const reportDate = recent.reportDate?.[i] ?? '';
    const { kind, label } = classifyFiling(items);

    const event: EarningsCallTranscript = {
      quarter:  inferQuarter(reportDate || filingDate),
      filingDate,
      reportDate,
      indexUrl: `${EDGAR_ARCHIVES}/${cik}/${cleanAcc}/${accession}-index.htm`,
      items,
      kind,
      label,
      source: 'sec-edgar',
    };

    if (kind === 'earnings' || kind === 'transcript') earningsFilings.push(event);
    else if (otherFilings.length < 8) otherFilings.push(event);

    if (earningsFilings.length >= 12) break;
  }

  return [...earningsFilings, ...otherFilings].slice(0, 12);
}

export async function fetchEarningsCallTranscripts(ticker: string): Promise<EarningsCallTranscript[]> {
  const [finnhub, sec] = await Promise.all([
    fetchFinnhubTranscriptSummaries(ticker).catch(() => []),
    fetchSecEarningsCallFilings(ticker).catch(() => []),
  ]);

  const seen = new Set<string>();
  return [...finnhub, ...sec].filter((event) => {
    const key = event.transcriptId || `${event.source}:${event.filingDate}:${event.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}
