import { fetchWithProxy } from '@/utils';

export interface SecFilingEntry {
  id: string;
  title: string;
  filerName: string;
  cik: string;
  filingType: string;
  filedAt: Date;
  url: string;
  description: string;
}

export type FilingsSort = 'newest' | 'oldest' | 'name';

export interface FilingsFilter {
  type: string;
  dateRange: '7d' | '30d' | 'quarter' | 'all';
  search: string;
}

const SEC_13F_ATOM_URL = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F&output=atom&count=100&owner=include';

const FILINGS_CACHE_TTL = 30 * 60 * 1000;
let filingsCache: { entries: SecFilingEntry[]; timestamp: number } | null = null;

function parseFilingType(title: string): string {
  const match = title.match(/^(\d+F[A-Z/0-9-]*)\s/i);
  return match ? match[1]! : (title.split(/\s/)[0] ?? '13F');
}

function extractCikFromId(id: string): string {
  const match = id.match(/CIK=(\d+)/i);
  return match ? match[1]! : '';
}

function extractCikFromSummary(summary: string): string {
  const match = summary.match(/CIK[:\s]*(\d+)/i);
  return match ? match[1]! : '';
}

function extractCikFromLink(link: string): string {
  const match = link.match(/\/data\/(\d{6,10})\//i);
  return match ? match[1]! : '';
}

function extractCikFromTitle(title: string): string {
  const match = title.match(/\((\d{6,10})\)/);
  return match ? match[1]! : '';
}

export async function fetchSec13FFeed(): Promise<SecFilingEntry[]> {
  if (filingsCache && Date.now() - filingsCache.timestamp < FILINGS_CACHE_TTL) {
    return filingsCache.entries;
  }

  try {
    const response = await fetchWithProxy(
      `/api/rss-proxy?url=${encodeURIComponent(SEC_13F_ATOM_URL)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML parse error');
    }

    const entries = doc.querySelectorAll('entry');
    const results: SecFilingEntry[] = [];

    for (const entry of entries) {
      const title = entry.querySelector('title')?.textContent?.trim() || '';
      const id = entry.querySelector('id')?.textContent?.trim() || '';
      const updated = entry.querySelector('updated')?.textContent?.trim() || '';
      const published = entry.querySelector('published')?.textContent?.trim() || '';
      const summary = entry.querySelector('summary')?.textContent?.trim() || '';

      let link = '';
      const linkEl = entry.querySelector('link[href]');
      if (linkEl) {
        link = linkEl.getAttribute('href') || '';
      } else {
        const linkText = entry.querySelector('link')?.textContent?.trim() || '';
        link = linkText;
      }

      const filingType = parseFilingType(title);
      const dateStr = published || updated;
      const filedAt = dateStr ? new Date(dateStr) : new Date();
      if (Number.isNaN(filedAt.getTime())) continue;

      let cik = extractCikFromId(id);
      if (!cik) cik = extractCikFromLink(link);
      if (!cik) cik = extractCikFromTitle(title);
      if (!cik) cik = extractCikFromSummary(summary);

      let filerName = title.replace(/^13F[A-Z/0-9-]*\s*-\s*/i, '').replace(/\s*\(\d{6,10}\)/g, '').replace(/\s*\(Filer\)/i, '').trim();
      if (!filerName) filerName = title;

      results.push({
        id: id || `filing-${Date.now()}-${results.length}`,
        title,
        filerName,
        cik,
        filingType,
        filedAt,
        url: link,
        description: summary,
      });
    }

    filingsCache = { entries: results, timestamp: Date.now() };
    return results;
  } catch (e) {
    console.error('[sec-filings] Failed to fetch 13F feed:', e);
    return filingsCache?.entries ?? [];
  }
}

export function filterFilings(entries: SecFilingEntry[], opts: FilingsFilter): SecFilingEntry[] {
  let filtered = [...entries];

  if (opts.type && opts.type !== 'all') {
    filtered = filtered.filter(e => e.filingType === opts.type);
  }

  if (opts.dateRange !== 'all') {
    const now = Date.now();
    let cutoff: number;
    switch (opts.dateRange) {
      case '7d': cutoff = now - 7 * 24 * 60 * 60 * 1000; break;
      case '30d': cutoff = now - 30 * 24 * 60 * 60 * 1000; break;
      case 'quarter': cutoff = now - 90 * 24 * 60 * 60 * 1000; break;
      default: cutoff = 0;
    }
    filtered = filtered.filter(e => e.filedAt.getTime() >= cutoff);
  }

  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter(e =>
      e.filerName.toLowerCase().includes(q) ||
      e.cik.includes(q) ||
      e.filingType.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export function sortFilings(entries: SecFilingEntry[], sortBy: FilingsSort): SecFilingEntry[] {
  const sorted = [...entries];
  switch (sortBy) {
    case 'newest':
      sorted.sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime());
      break;
    case 'oldest':
      sorted.sort((a, b) => a.filedAt.getTime() - b.filedAt.getTime());
      break;
    case 'name':
      sorted.sort((a, b) => a.filerName.localeCompare(b.filerName));
      break;
  }
  return sorted;
}