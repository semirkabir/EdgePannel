/**
 * Rich "Sources & Status" panel shown from the header status indicator.
 *
 * Renders every tracked data source grouped by category, with live status
 * roll-up tiles, text search, and per-feed provider attribution. All values
 * come from `dataFreshness` — nothing here is synthesised.
 */

import { dataFreshness, type DataSourceState } from '@/services/data-freshness';
import {
  SOURCE_CATEGORY_ORDER,
  getCatalogEntry,
  getSourceDotClass,
  getSourceLabel,
  getSummaryBucket,
  getTransportLabel,
  summarizeSources,
  timeAgo,
  WS_SOURCES,
  type SourceSummary,
} from '@/app/source-status';

type BucketKey = ReturnType<typeof getSummaryBucket>;

interface TileDef {
  key: BucketKey | 'total';
  label: string;
  tone: string;
}

const TILES: TileDef[] = [
  { key: 'total',    label: 'Total',    tone: 'neutral' },
  { key: 'online',   label: 'Online',   tone: 'live' },
  { key: 'stale',    label: 'Stale',    tone: 'warn' },
  { key: 'degraded', label: 'Degraded', tone: 'warn' },
  { key: 'error',    label: 'Error',    tone: 'bad' },
  { key: 'noData',   label: 'No Data',  tone: 'dim' },
  { key: 'offline',  label: 'Offline',  tone: 'dim' },
];

const TRANSPORT_LABEL: Record<string, string> = {
  socket: 'Socket',
  feed: 'Feed',
  api: 'API',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class SourceStatusPanel {
  private root: HTMLElement;
  private listEl: HTMLElement;
  private subtitleEl: HTMLElement;
  private tileEls = new Map<TileDef['key'], HTMLElement>();
  private collapsed = new Set<string>();
  private query = '';
  private activeFilter: BucketKey | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.root = el('div', 'ss-panel');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Data sources and status');

    // ── Header ──────────────────────────────────────────────────────────
    const header = el('div', 'ss-header');
    header.append(el('div', 'ss-title', 'SOURCES & STATUS'));
    this.subtitleEl = el('div', 'ss-subtitle');
    header.append(this.subtitleEl);
    this.root.append(header);

    // ── Stat tiles ──────────────────────────────────────────────────────
    const tileRow = el('div', 'ss-tiles');
    for (const tile of TILES) {
      const btn = el('button', `ss-tile ss-tile-${tile.tone}`);
      btn.type = 'button';
      btn.append(el('span', 'ss-tile-value', '0'));
      btn.append(el('span', 'ss-tile-label', tile.label.toUpperCase()));
      btn.addEventListener('click', () => this.onTileClick(tile.key));
      this.tileEls.set(tile.key, btn);
      tileRow.append(btn);
    }
    this.root.append(tileRow);

    // ── Search ──────────────────────────────────────────────────────────
    const searchWrap = el('div', 'ss-search');
    searchWrap.append(el('span', 'ss-search-icon', '⌕'));
    const input = el('input', 'ss-search-input');
    input.type = 'search';
    input.placeholder = 'Search feeds, providers, categories...';
    input.setAttribute('aria-label', 'Search data sources');
    input.addEventListener('input', () => {
      this.query = input.value.trim().toLowerCase();
      this.renderList();
    });
    searchWrap.append(input);
    this.root.append(searchWrap);

    // ── Feed list ───────────────────────────────────────────────────────
    this.listEl = el('div', 'ss-list');
    this.root.append(this.listEl);

    // ── Footer ──────────────────────────────────────────────────────────
    this.root.append(el(
      'div',
      'ss-footer',
      'All data is sourced from publicly available APIs, RSS feeds, and open datasets.',
    ));

    this.render();
    this.unsubscribe = dataFreshness.subscribe(() => this.render());
  }

  public getElement(): HTMLElement {
    return this.root;
  }

  public destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.remove();
  }

  private onTileClick(key: TileDef['key']): void {
    if (key === 'total') {
      this.activeFilter = null;
    } else {
      this.activeFilter = this.activeFilter === key ? null : key;
    }
    this.syncTileActive();
    this.renderList();
  }

  private syncTileActive(): void {
    for (const [key, node] of this.tileEls) {
      const isActive = key === 'total' ? this.activeFilter === null : this.activeFilter === key;
      node.classList.toggle('is-active', isActive);
    }
  }

  private render(): void {
    const sources = dataFreshness.getAllSources();
    const summary = summarizeSources(sources);
    this.renderHeader(summary);
    this.syncTileActive();
    this.renderList(sources);
  }

  private renderHeader(summary: SourceSummary): void {
    for (const tile of TILES) {
      const node = this.tileEls.get(tile.key);
      const valueEl = node?.querySelector('.ss-tile-value');
      if (!valueEl) continue;
      valueEl.textContent = String(tile.key === 'total' ? summary.total : summary[tile.key]);
    }

    const feedWord = summary.total === 1 ? 'data feed' : 'data feeds';
    const providerWord = summary.providers === 1 ? 'provider' : 'providers';
    const stamp = summary.newestUpdate
      ? summary.newestUpdate.toLocaleTimeString(undefined, { hour12: false })
      : '—';
    this.subtitleEl.textContent =
      `${summary.total} ${feedWord} from ${summary.providers} ${providerWord} · Index updated ${stamp}`;
  }

  private renderList(sources = dataFreshness.getAllSources()): void {
    const matches = sources.filter(source => this.matchesFilters(source));
    this.listEl.replaceChildren();

    if (matches.length === 0) {
      this.listEl.append(el('div', 'ss-empty', 'No feeds match the current filter.'));
      return;
    }

    // Group into catalog categories, ordered by SOURCE_CATEGORY_ORDER.
    const byCategory = new Map<string, DataSourceState[]>();
    for (const source of matches) {
      const category = getCatalogEntry(source.id).category;
      const bucket = byCategory.get(category);
      if (bucket) bucket.push(source);
      else byCategory.set(category, [source]);
    }

    const order = SOURCE_CATEGORY_ORDER as readonly string[];
    const categories = Array.from(byCategory.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    for (const category of categories) {
      const rows = byCategory.get(category) ?? [];
      rows.sort((a, b) => a.name.localeCompare(b.name));
      this.listEl.append(this.buildCategorySection(category, rows));
    }
  }

  private matchesFilters(source: DataSourceState): boolean {
    if (this.activeFilter && getSummaryBucket(source) !== this.activeFilter) return false;
    if (!this.query) return true;
    const { category, provider } = getCatalogEntry(source.id);
    return (
      source.name.toLowerCase().includes(this.query) ||
      provider.toLowerCase().includes(this.query) ||
      category.toLowerCase().includes(this.query) ||
      source.id.toLowerCase().includes(this.query)
    );
  }

  private buildCategorySection(category: string, rows: DataSourceState[]): HTMLElement {
    const section = el('div', 'ss-section');
    const isCollapsed = this.collapsed.has(category);

    const head = el('button', 'ss-section-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(!isCollapsed));
    head.append(el('span', 'ss-section-caret', isCollapsed ? '▸' : '▾'));
    head.append(el('span', 'ss-section-title', category.toUpperCase()));
    head.append(el('span', 'ss-section-count', String(rows.length)));
    head.addEventListener('click', () => {
      if (this.collapsed.has(category)) this.collapsed.delete(category);
      else this.collapsed.add(category);
      this.renderList();
    });
    section.append(head);

    if (isCollapsed) return section;

    const body = el('div', 'ss-section-body');
    for (const source of rows) body.append(this.buildRow(source));
    section.append(body);
    return section;
  }

  private buildRow(source: DataSourceState): HTMLElement {
    const isWs = WS_SOURCES.has(source.id);
    const { provider, url } = getCatalogEntry(source.id);
    const severity = getSourceDotClass(source.status, isWs && !!source.lastUpdate);
    const transport = getTransportLabel(source.id);

    const row = el('div', 'ss-row');

    row.append(el('span', `ss-dot ss-dot-${severity}`));

    const main = el('div', 'ss-row-main');
    const topLine = el('div', 'ss-row-top');
    topLine.append(el('span', 'ss-row-name', source.name));
    topLine.append(el('span', `ss-chip ss-chip-${transport}`, TRANSPORT_LABEL[transport] ?? 'API'));
    if (source.requiredForRisk) {
      topLine.append(el('span', 'ss-chip ss-chip-core', 'Core'));
    }
    main.append(topLine);

    const meta = el('div', 'ss-row-meta');
    if (provider) meta.append(el('span', 'ss-row-provider', provider));
    if (source.lastUpdate) {
      meta.append(el('span', 'ss-row-age', timeAgo(source.lastUpdate)));
    }
    if (source.itemCount > 0) {
      meta.append(el('span', 'ss-row-count', `${source.itemCount.toLocaleString()} items`));
    }
    main.append(meta);
    row.append(main);

    const badge = el('span', `ss-badge ss-badge-${severity}`, getSourceLabel(source, isWs && !!source.lastUpdate));
    row.append(badge);

    if (url) {
      const link = el('a', 'ss-row-link', '↗');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = `Open ${provider}`;
      link.setAttribute('aria-label', `Open ${provider} in a new tab`);
      link.addEventListener('click', e => e.stopPropagation());
      row.append(link);
    } else {
      row.append(el('span', 'ss-row-link-spacer'));
    }

    if (source.lastError) row.title = source.lastError;
    return row;
  }
}
