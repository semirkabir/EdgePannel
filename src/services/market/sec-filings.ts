import { fetchWithProxy } from '@/utils/proxy';

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

// All EDGAR filing types we track, grouped by category
export const FILING_TYPE_CATEGORIES: Record<string, string[]> = {
  'insider': ['3', '4', '5'],
  'periodic': ['10-K', '10-Q', '10-D', '20-F'],
  'current': ['8-K', '8-K/A'],
  'institutional': ['13F-HR', '13F-NT', '13F-HR/A', '13F-NT/A'],
  'ownership': ['SC 13D', 'SC 13G', 'SC 13D/A', 'SC 13G/A', '13D', '13G'],
  'registration': ['S-1', 'S-3', 'S-4', 'S-8', 'F-1', 'F-3', 'F-4'],
  'prospectus': ['424B2', '424B3', '424B4', '424B5', '424B7', '424B8', '497'],
  'proxy': ['DEF 14A', 'PRE 14A', 'DEFM 14A', 'PREM 14A', 'DEFA 14A'],
  'foreign': ['6-K', '6-K/A', '40-F', '25'],
  'fund': ['N-1A', 'N-2', 'N-3', 'N-4', 'N-6', 'N-PX', 'N-CSR', '485BPOS', '485BXT'],
};

// Human-readable category labels
export const CATEGORY_LABELS: Record<string, string> = {
  'all': 'All Filings',
  'insider': 'Insider Trading',
  'periodic': 'Periodic Reports',
  'current': 'Current Reports',
  'institutional': 'Institutional',
  'ownership': 'Ownership',
  'registration': 'Registration',
  'prospectus': 'Prospectus',
  'proxy': 'Proxy',
  'foreign': 'Foreign Issuers',
  'fund': 'Funds',
};

// Human-readable labels for individual filing types
export const FILING_TYPE_LABELS: Record<string, string> = {
  '3': 'Initial Statement',
  '4': 'Insider Trade',
  '5': 'Annual Insider',
  '10-K': 'Annual Report',
  '10-Q': 'Quarterly Report',
  '10-D': 'ABS Periodic',
  '20-F': 'Foreign Annual',
  '8-K': 'Current Report',
  '8-K/A': 'Current Report (Amend)',
  '13F-HR': 'Holdings Report',
  '13F-NT': 'Holdings Notice',
  '13F-HR/A': 'Holdings Report (Amend)',
  '13F-NT/A': 'Holdings Notice (Amend)',
  '13F': '13F Filing',
  'SC 13D': 'Activist Position',
  'SC 13G': 'Passive Position',
  'SC 13D/A': 'Activist Position (Amend)',
  'SC 13G/A': 'Passive Position (Amend)',
  '13D': 'Beneficial Ownership',
  '13G': 'Passive Ownership',
  'S-1': 'IPO Registration',
  'S-3': 'Shelf Registration',
  'S-4': 'Merger Registration',
  'S-8': 'Employee Plan',
  'F-1': 'Foreign IPO',
  'F-3': 'Foreign Shelf',
  'F-4': 'Foreign Merger',
  '424B2': 'Prospectus (B2)',
  '424B3': 'Prospectus (B3)',
  '424B4': 'Prospectus',
  '424B5': 'Prospectus (B5)',
  '424B7': 'Prospectus (B7)',
  '424B8': 'Prospectus (B8)',
  '497': 'Fund Prospectus',
  'DEF 14A': 'Proxy Statement',
  'PRE 14A': 'Preliminary Proxy',
  'DEFM 14A': 'Merger Proxy',
  'PREM 14A': 'Prelim Merger Proxy',
  'DEFA 14A': 'Proxy Materials',
  '6-K': 'Foreign Current',
  '6-K/A': 'Foreign Current (Amend)',
  '40-F': 'Foreign Registration',
  '25': 'Delisting Notice',
  'N-1A': 'Fund Registration',
  'N-2': 'Closed-End Fund',
  'N-3': 'Separate Account',
  'N-4': 'Managed Account',
  'N-6': 'Life Insurance',
  'N-PX': 'Fund Proxy',
  'N-CSR': 'Fund Annual Report',
  '485BPOS': 'Fund Filing (POS)',
  '485BXT': 'Fund Filing (XT)',
  '485APOS': 'Fund Filing (APOS)',
  '497J': 'Fund Filing (J)',
  '497K': 'Fund Summary',
  'FWP': 'Free Writing Prospectus',
  'D': 'Reg D Offering',
  'D/A': 'Reg D Offering (Amend)',
  'C': 'Reg CF Offering',
  'C-U': 'Reg CF Update',
  'C-AR': 'Reg CF Annual',
  'C-TR': 'Reg CF Termination',
  'NPORT-P': 'Fund Portfolio',
  'N-CEN': 'Fund Annual Census',
};

// Per-category cache TTLs (ms) - high-frequency filings get shorter cache
export const CATEGORY_CACHE_TTL: Record<string, number> = {
  'insider': 5 * 60 * 1000,       // 5 min - Form 4s filed within 2 business days
  'current': 15 * 60 * 1000,      // 15 min - 8-Ks filed within 4 business days
  'periodic': 60 * 60 * 1000,     // 1 hour - 10-K/10-Q filed quarterly/annually
  'institutional': 30 * 60 * 1000, // 30 min - 13F filed quarterly
  'ownership': 15 * 60 * 1000,    // 15 min - SC 13D/G filed promptly
  'registration': 30 * 60 * 1000, // 30 min - S-1/S-3 filed during offerings
  'prospectus': 30 * 60 * 1000,   // 30 min - 424B filed during offerings
  'proxy': 60 * 60 * 1000,        // 1 hour - DEF 14A filed before meetings
  'foreign': 30 * 60 * 1000,      // 30 min - 6-K filed as needed
  'fund': 30 * 60 * 1000,         // 30 min - fund filings
};

const SEC_BROWSE_BASE = 'https://www.sec.gov/cgi-bin/browse-edgar';
const SEC_RATE_LIMIT_DELAY = 150; // ms between requests (SEC allows ~10 req/sec)
const SEC_BATCH_SIZE = 5; // fetch 5 at a time, then wait

// Per-category caches
const categoryCaches: Record<string, { entries: SecFilingEntry[]; timestamp: number }> = {};

function getCacheTtl(category: string): number {
  return CATEGORY_CACHE_TTL[category] ?? 30 * 60 * 1000;
}

function buildEdgarAtomUrl(type: string, count = 40): string {
  return `${SEC_BROWSE_BASE}?action=getcurrent&type=${encodeURIComponent(type)}&output=atom&count=${count}&owner=include`;
}

function parseFilingType(title: string): string {
  const match = title.match(/^(\d+[A-Z]?[A-Z/0-9-]*)\s/i) || title.match(/^([A-Z\/0-9-]+)\s*[-–]/i);
  if (match) return match[1]!.trim();
  return title.split(/\s/)[0] ?? 'Unknown';
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

function parseAtomEntries(text: string): SecFilingEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  if (doc.querySelector('parsererror')) return [];

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
      link = entry.querySelector('link')?.textContent?.trim() || '';
    }

    const filingType = parseFilingType(title);
    const dateStr = published || updated;
    const filedAt = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(filedAt.getTime())) continue;

    let cik = extractCikFromId(id);
    if (!cik) cik = extractCikFromLink(link);
    if (!cik) cik = extractCikFromTitle(title);
    if (!cik) cik = extractCikFromSummary(summary);

    // Strip filing type prefix from title to get cleaner filer name
    let filerName = title.replace(/^[\dA-Z/ -]+\s*[-–]\s*/i, '').replace(/\s*\(\d{6,10}\)/g, '').replace(/\s*\(Filer\)/i, '').trim();
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

  return results;
}

async function fetchFilingType(type: string): Promise<SecFilingEntry[]> {
  try {
    const url = buildEdgarAtomUrl(type, 40);
    const response = await fetchWithProxy(
      `/api/rss-proxy?url=${encodeURIComponent(url)}`
    );
    if (!response.ok) return [];
    const text = await response.text();
    return parseAtomEntries(text);
  } catch {
    return [];
  }
}

// Rate-limited batch fetch: process in groups of SEC_BATCH_SIZE with delay between groups
async function fetchAllTypesRateLimited(types: string[]): Promise<SecFilingEntry[][]> {
  const results: SecFilingEntry[][] = [];
  for (let i = 0; i < types.length; i += SEC_BATCH_SIZE) {
    const batch = types.slice(i, i + SEC_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchFilingType));
    results.push(...batchResults);
    // Delay between batches to respect SEC rate limit
    if (i + SEC_BATCH_SIZE < types.length) {
      await new Promise(resolve => setTimeout(resolve, SEC_RATE_LIMIT_DELAY));
    }
  }
  return results;
}

export async function fetchSecAllFilings(): Promise<SecFilingEntry[]> {
  const allEntries: SecFilingEntry[] = [];

  // Fetch each category independently with its own cache TTL
  for (const [category, types] of Object.entries(FILING_TYPE_CATEGORIES)) {
    const cached = categoryCaches[category];
    if (cached && Date.now() - cached.timestamp < getCacheTtl(category)) {
      allEntries.push(...cached.entries);
      continue;
    }

    // Fetch this category's types
    const results = await fetchAllTypesRateLimited(types);
    const categoryEntries = results.flat();

    // Deduplicate within category
    const seen = new Set<string>();
    const deduped: SecFilingEntry[] = [];
    for (const entry of categoryEntries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        deduped.push(entry);
      }
    }

    categoryCaches[category] = { entries: deduped, timestamp: Date.now() };
    allEntries.push(...deduped);
  }

  // Global deduplicate and sort
  const globalSeen = new Set<string>();
  const merged: SecFilingEntry[] = [];
  for (const entry of allEntries) {
    if (!globalSeen.has(entry.id)) {
      globalSeen.add(entry.id);
      merged.push(entry);
    }
  }

  merged.sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime());
  return merged;
}

// Backward-compatible alias
export const fetchSec13FFeed = fetchSecAllFilings;

export function filterFilings(entries: SecFilingEntry[], opts: FilingsFilter): SecFilingEntry[] {
  let filtered = [...entries];

  // Filter by category (e.g. 'insider', 'periodic') or exact type
  if (opts.type && opts.type !== 'all') {
    const categoryTypes = FILING_TYPE_CATEGORIES[opts.type];
    if (categoryTypes) {
      // Filter by category
      filtered = filtered.filter(e => categoryTypes.includes(e.filingType));
    } else {
      // Filter by exact filing type
      filtered = filtered.filter(e => e.filingType === opts.type);
    }
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

// Get human-readable label for a filing type
export function getFilingTypeLabel(filingType: string): string {
  return FILING_TYPE_LABELS[filingType] ?? filingType;
}

// Get the category key for a filing type
export function getFilingCategory(filingType: string): string | null {
  for (const [key, types] of Object.entries(FILING_TYPE_CATEGORIES)) {
    if (types.includes(filingType)) return key;
  }
  return null;
}

// Count entries by category for the breakdown chips
export function countByCategory(entries: SecFilingEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const cat = getFilingCategory(entry.filingType);
    if (cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return counts;
}

// Generate SEC filing viewer URL for a specific entry
export function getSecFilingViewerUrl(entry: SecFilingEntry): string {
  if (!entry.cik || !entry.id) return '';
  // Try to extract accession number from the ID
  const accessionMatch = entry.id.match(/(\d{10}-\d{2}-\d{6})/);
  if (accessionMatch) {
    const accession = accessionMatch[1];
    return `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${entry.cik}&accession_number=${accession}&xbrl_type=v`;
  }
  // Fallback to company filings page
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${entry.cik}&type=&dateb=&owner=include&count=40&search_action=getcompany`;
}

export function getSecFilingAccessionNumber(entry: SecFilingEntry): string {
  const idMatch = entry.id.match(/(\d{10}-\d{2}-\d{6})/);
  if (idMatch) return idMatch[1]!;
  const urlMatch = entry.url.match(/\/data\/\d+\/(\d{18})\//);
  if (!urlMatch) return '';
  const clean = urlMatch[1]!;
  return `${clean.slice(0, 10)}-${clean.slice(10, 12)}-${clean.slice(12)}`;
}
