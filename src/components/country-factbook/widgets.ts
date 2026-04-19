/**
 * Shared UI primitives for the country factbook tabs. Each function returns
 * an HTMLElement with `.cdp-fb-*` class names; styling lives in main.css.
 * Inputs are sanitized — we use textContent everywhere. Rich factbook "note"
 * strings contain HTML, so those are stripped before rendering.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Strip the limited HTML that factbook "note" strings use (<b>, <strong>, <em>, <br>). */
export function stripNoteHtml(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+\n/g, '\n')
    .trim();
}

export interface StatTileOpts {
  year?: string;
  hint?: string;
}

/**
 * Shorten verbose unit suffixes that CIA Factbook values embed in their text.
 * Applied before rendering in small stat tiles so they don't overflow.
 *   "23.2% of total population"         → "23.2%"
 *   "29.08 births/1,000 population"     → "29.08/1K"
 *   "0.14 physicians/1,000 population"  → "0.14/1K"
 *   "195 deaths/100,000 live births"    → "195/100K"
 */
export function abbreviateStat(val: string | undefined): string | undefined {
  if (!val) return val;
  const s = val
    .replace(/\s+of\s+total\s+population\b/gi, '')
    .replace(/\s+\w+\/1,000\s+population\b/gi, '/1K')
    .replace(/\/1,000\s+population\b/gi, '/1K')
    .replace(/\s+\w+\/100,000\s+live\s+births\b/gi, '/100K')
    .replace(/\/100,000\s+live\s+births\b/gi, '/100K')
    .replace(/\s+\w+\/100,000\s+population\b/gi, '/100K')
    .replace(/\/100,000\s+population\b/gi, '/100K')
    .trim();
  return s || val;
}

export function statTile(label: string, value: string | undefined, opts: StatTileOpts = {}): HTMLElement {
  const tile = el('div', 'cdp-fb-tile');
  const valueEl = el('div', 'cdp-fb-tile-value', value && value.trim() ? value : '—');
  const labelEl = el('div', 'cdp-fb-tile-label', label);
  tile.append(valueEl, labelEl);
  if (opts.year) {
    tile.append(el('div', 'cdp-fb-tile-year', opts.year));
  }
  if (opts.hint) {
    tile.title = opts.hint;
  }
  return tile;
}

export function tileGrid(cols: 2 | 3, tiles: Array<HTMLElement | null>): HTMLElement {
  const wrap = el('div', `cdp-fb-grid cdp-fb-grid-${cols}`);
  for (const t of tiles) if (t) wrap.append(t);
  return wrap;
}

export interface StackSegment {
  label: string;
  pct: number;
  color: string;
}

export type ChipTone = 'default' | 'info' | 'success' | 'warn' | 'danger' | 'neutral';

export interface ChipSpec {
  label: string;
  icon?: string;
  title?: string;
  tone?: ChipTone;
}

/**
 * Horizontal stacked bar. Percentages are rendered proportionally to their sum
 * (so 58.9 + 18.2 + 9.9 + ... renders correctly even without hitting 100 exactly).
 */
export function stackedBar(segments: StackSegment[]): HTMLElement {
  const wrap = el('div', 'cdp-fb-stack-wrap');
  const bar = el('div', 'cdp-fb-stack');
  const total = segments.reduce((sum, s) => sum + (Number.isFinite(s.pct) ? Math.max(0, s.pct) : 0), 0) || 1;
  for (const seg of segments) {
    if (!Number.isFinite(seg.pct) || seg.pct <= 0) continue;
    const span = el('span', 'cdp-fb-stack-seg');
    span.style.width = `${(seg.pct / total) * 100}%`;
    span.style.background = seg.color;
    span.title = `${seg.label}: ${seg.pct.toFixed(1)}%`;
    bar.append(span);
  }
  wrap.append(bar);

  const legend = el('div', 'cdp-fb-stack-legend');
  for (const seg of segments) {
    if (!Number.isFinite(seg.pct)) continue;
    const item = el('span', 'cdp-fb-legend-item');
    const dot = el('span', 'cdp-fb-legend-dot');
    dot.style.background = seg.color;
    const labelEl = el('span', 'cdp-fb-legend-label', seg.label);
    const pctEl = el('span', 'cdp-fb-legend-pct', `${seg.pct.toFixed(1)}%`);
    item.append(dot, labelEl, pctEl);
    legend.append(item);
  }
  wrap.append(legend);
  return wrap;
}

export function labeledBars(rows: Array<{ label: string; pct: number }>, max = 8): HTMLElement {
  const wrap = el('div', 'cdp-fb-bars');
  const visible = rows.slice(0, max);
  const peak = Math.max(...visible.map((r) => r.pct), 1);
  for (const row of visible) {
    const r = el('div', 'cdp-fb-bar-row');
    const lbl = el('span', 'cdp-fb-bar-label', row.label);
    const track = el('div', 'cdp-fb-bar-track');
    const fill = el('div', 'cdp-fb-bar-fill');
    fill.style.width = `${Math.max(2, (row.pct / peak) * 100)}%`;
    track.append(fill);
    const val = el('span', 'cdp-fb-bar-val', `${row.pct.toFixed(1)}%`);
    r.append(lbl, track, val);
    wrap.append(r);
  }
  return wrap;
}

function chipToneClass(base: string, tone: ChipTone | undefined): string {
  const resolved = tone && tone !== 'default' ? ` ${base}-${tone}` : '';
  return `${base}${resolved}`;
}

function makeChip(spec: ChipSpec, className = 'cdp-fb-chip'): HTMLElement {
  const chip = el('span', chipToneClass(className, spec.tone));
  if (spec.title) chip.title = spec.title;
  if (spec.icon) chip.append(el('span', 'cdp-fb-chip-icon', spec.icon));
  chip.append(el('span', 'cdp-fb-chip-label', spec.label));
  return chip;
}

export function chipRow(items: Array<string | ChipSpec>, emptyLabel?: string): HTMLElement {
  const wrap = el('div', 'cdp-fb-chips');
  if (items.length === 0) {
    if (emptyLabel) wrap.append(el('span', 'cdp-fb-chip-muted', emptyLabel));
    return wrap;
  }
  for (const item of items) {
    wrap.append(typeof item === 'string' ? makeChip({ label: item }) : makeChip(item));
  }
  return wrap;
}

export function badge(spec: string | ChipSpec): HTMLElement {
  return typeof spec === 'string' ? makeChip({ label: spec }, 'cdp-fb-badge') : makeChip(spec, 'cdp-fb-badge');
}

export function badgeRow(items: Array<string | ChipSpec | null | undefined>): HTMLElement {
  const wrap = el('div', 'cdp-fb-badges');
  for (const item of items) {
    if (!item) continue;
    wrap.append(badge(item));
  }
  return wrap;
}

export function personCard(role: string, nameLine: string | undefined): HTMLElement {
  const wrap = el('div', 'cdp-fb-person');
  const head = el('div', 'cdp-fb-person-role', role);
  const body = el('div', 'cdp-fb-person-name', nameLine && nameLine.trim() ? nameLine : 'Not available');
  wrap.append(head, body);
  return wrap;
}

export type Severity = 'info' | 'warn' | 'danger';

export function calloutCard(title: string, body: string | undefined, severity: Severity = 'info'): HTMLElement {
  const wrap = el('div', `cdp-fb-callout cdp-fb-callout-${severity}`);
  wrap.append(el('div', 'cdp-fb-callout-title', title));
  wrap.append(el('div', 'cdp-fb-callout-body', body && body.trim() ? body : 'Not available'));
  return wrap;
}

export function collapsible(summary: string, bodyNode: HTMLElement, openByDefault = false): HTMLElement {
  const details = document.createElement('details');
  details.className = 'cdp-fb-details';
  if (openByDefault) details.open = true;
  const sum = document.createElement('summary');
  sum.className = 'cdp-fb-summary';
  sum.textContent = summary;
  details.append(sum, bodyNode);
  return details;
}

export function prose(text: string | undefined, className = 'cdp-fb-prose'): HTMLElement | null {
  if (!text || !text.trim()) return null;
  const cleaned = stripNoteHtml(text);
  if (!cleaned) return null;
  const p = el('div', className);
  p.textContent = cleaned;
  return p;
}

export function sectionCard(title: string, body: HTMLElement | null): HTMLElement | null {
  if (!body) return null;
  const card = el('section', 'cdp-card cdp-fb-card');
  card.append(el('h3', 'cdp-card-title', title));
  const cardBody = el('div', 'cdp-card-body');
  cardBody.append(body);
  card.append(cardBody);
  return card;
}

export function emptyMessage(text: string): HTMLElement {
  return el('div', 'cdp-empty', text);
}

/** Combine multiple possible subsections into one card body; null if all are empty. */
export function combine(children: Array<HTMLElement | null>): HTMLElement | null {
  const valid = children.filter((c): c is HTMLElement => !!c);
  if (valid.length === 0) return null;
  const wrap = el('div', 'cdp-fb-stack-v');
  for (const c of valid) wrap.append(c);
  return wrap;
}

/** Hue palette for stacked bars — consistent across panels. */
export const PALETTE = {
  fossil: '#ef4444',
  nuclear: '#a855f7',
  hydro: '#06b6d4',
  solar: '#eab308',
  wind: '#22c55e',
  geothermal: '#f97316',
  biomass: '#84cc16',
  other: '#6b7280',
  agriculture: '#84cc16',
  industry: '#f59e0b',
  services: '#3b82f6',
  youth: '#22c55e',
  working: '#3b82f6',
  elder: '#f97316',
} as const;
