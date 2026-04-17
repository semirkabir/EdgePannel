/**
 * CIA World Factbook data service (public domain).
 * Files are per-country JSON at /data/factbook/{iso2}.json, lazy-fetched and cached
 * for the session. Missing files resolve to null so UI can render an empty state.
 */

export interface FactbookLeaf {
  text?: string;
  note?: string;
  [extra: string]: unknown;
}

export type FactbookNode = FactbookLeaf | { [key: string]: FactbookNode | string };

export interface FactbookData {
  Introduction?: Record<string, FactbookNode>;
  Geography?: Record<string, FactbookNode>;
  'People and Society'?: Record<string, FactbookNode>;
  Government?: Record<string, FactbookNode>;
  Economy?: Record<string, FactbookNode>;
  Energy?: Record<string, FactbookNode>;
  Communications?: Record<string, FactbookNode>;
  Transportation?: Record<string, FactbookNode>;
  'Military and Security'?: Record<string, FactbookNode>;
  'Transnational Issues'?: Record<string, FactbookNode>;
  [extra: string]: unknown;
}

const cache = new Map<string, Promise<FactbookData | null>>();

export function loadFactbook(code: string): Promise<FactbookData | null> {
  const key = code.toLowerCase();
  let existing = cache.get(key);
  if (!existing) {
    existing = fetch(`/data/factbook/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<FactbookData>) : null))
      .catch(() => null);
    cache.set(key, existing);
  }
  return existing;
}

/** Read `section[path...].text` safely. Returns undefined when any step is missing. */
export function fbText(section: Record<string, FactbookNode> | undefined, ...path: string[]): string | undefined {
  if (!section) return undefined;
  let cur: unknown = section;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  if (!cur) return undefined;
  if (typeof cur === 'string') return cur;
  if (typeof cur === 'object' && 'text' in (cur as Record<string, unknown>)) {
    const t = (cur as Record<string, unknown>).text;
    return typeof t === 'string' ? t : undefined;
  }
  return undefined;
}

/** Read an object node (for iterating sub-keys). */
export function fbObj(
  section: Record<string, FactbookNode> | undefined,
  ...path: string[]
): Record<string, FactbookNode> | undefined {
  if (!section) return undefined;
  let cur: unknown = section;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur && typeof cur === 'object' && !('text' in (cur as Record<string, unknown>))
    ? (cur as Record<string, FactbookNode>)
    : undefined;
}

/** Extract a leading number (including decimals, commas, and scale words). Returns NaN if none. */
export function extractNumber(text: string | undefined): number {
  if (!text) return Number.NaN;
  const match = text.match(/[-+]?\d[\d,]*(?:\.\d+)?/);
  if (!match) return Number.NaN;
  const n = Number.parseFloat(match[0].replace(/,/g, ''));
  if (!Number.isFinite(n)) return Number.NaN;
  const lower = text.toLowerCase();
  if (/\btrillion\b/.test(lower)) return n * 1e12;
  if (/\bbillion\b/.test(lower)) return n * 1e9;
  if (/\bmillion\b/.test(lower)) return n * 1e6;
  return n;
}

/** Extract a percentage (first `%`-suffixed number) from a factbook string. NaN if none. */
export function extractPercent(text: string | undefined): number {
  if (!text) return Number.NaN;
  const match = text.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
  return match ? Number.parseFloat(match[1]!) : Number.NaN;
}

/** Extract the first 4-digit year from the string. Returns undefined if none. */
export function extractYear(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : undefined;
}

/** Strip "(2024 est.)" / "(2024)" / trailing year estimate clauses. */
export function stripYearTag(text: string | undefined): string {
  if (!text) return '';
  return text.replace(/\s*\((?:19|20)\d{2}(?:\s*est\.?)?\)\s*$/i, '').trim();
}

/** Take the value portion before the first parenthesis, for cases like "18.1% (male ...)". */
export function takeValue(text: string | undefined): string {
  if (!text) return '';
  const paren = text.indexOf('(');
  return (paren > 0 ? text.slice(0, paren) : text).trim();
}

/**
 * For sections that split a metric across year-suffixed keys (e.g.
 * `Real GDP (purchasing power parity) 2024`), find the latest-year entry's text.
 */
export function latestYearEntry(
  obj: Record<string, FactbookNode> | undefined,
  basename: string,
): { text: string | undefined; year: string | undefined } {
  if (!obj) return { text: undefined, year: undefined };
  let bestYear = -1;
  let bestText: string | undefined;
  for (const [key, val] of Object.entries(obj)) {
    if (!key.startsWith(basename)) continue;
    const m = key.match(/(\d{4})$/);
    if (!m) continue;
    const y = Number.parseInt(m[1]!, 10);
    const txt = typeof val === 'object' && val && 'text' in val ? (val as FactbookLeaf).text : undefined;
    if (y > bestYear && txt) {
      bestYear = y;
      bestText = txt;
    }
  }
  return { text: bestText, year: bestYear > 0 ? String(bestYear) : undefined };
}

/**
 * Parse a "Languages" / "Religions" / "Ethnic groups" string into labeled percents.
 * Input example: "English only 78.2%, Spanish 13.4%, Chinese 1.1%, other 7.3% (2017 est.)"
 */
export function parseLabeledPercents(text: string | undefined): Array<{ label: string; pct: number }> {
  if (!text) return [];
  const core = text.split('(')[0]!;
  const parts = core.split(/,(?![^(]*\))/g).map((s) => s.trim()).filter(Boolean);
  const out: Array<{ label: string; pct: number }> = [];
  for (const part of parts) {
    const m = part.match(/^(.*?)\s+(-?\d+(?:\.\d+)?)\s*%\s*$/);
    if (m) {
      out.push({ label: m[1]!.trim(), pct: Number.parseFloat(m[2]!) });
    }
  }
  return out;
}

/** Split a comma-separated string (resources, partners, commodities) into trimmed chips. */
export function splitList(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split('(')[0]!
    .split(/,(?![^(]*\))/g)
    .map((s) => s.trim())
    .filter(Boolean);
}
