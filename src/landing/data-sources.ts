/**
 * /data-sources — the full, filterable catalog behind the landing-page belt.
 * The list is generated from the app's own feed and layer configs (see
 * scripts/generate-source-catalog.mjs), so it can't drift into marketing copy.
 */

import {
  CATALOG,
  CATALOG_FEED_COUNT,
  CATALOG_LAYER_COUNT,
  SOURCE_GROUPS,
  type CatalogEntry,
  type SourceGroup,
} from './source-catalog';

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Fold accents so "El País" is reachable by typing "el pais". */
const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const HAYSTACK = new WeakMap<object, string>();
const searchKey = (entry: CatalogEntry): string => {
  const cached = HAYSTACK.get(entry);
  if (cached) return cached;
  const label = SOURCE_GROUPS.find((g) => g.id === entry[1])?.label ?? '';
  const key = normalize(`${entry[0]} ${label}`);
  HAYSTACK.set(entry, key);
  return key;
};

function card(entry: CatalogEntry): string {
  const [name, group, kind] = entry;
  return (
    `<li class="lp-src" data-cat="${group}">`
    + `<span class="lp-src-dot" aria-hidden="true"></span>`
    + `<span class="lp-src-name">${escapeHtml(name)}</span>`
    + `<span class="lp-src-kind" data-kind="${kind}">${kind === 'layer' ? 'layer' : 'feed'}</span>`
    + `</li>`
  );
}

function render(entries: CatalogEntry[], results: HTMLElement, empty: HTMLElement): void {
  if (!entries.length) {
    results.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const byGroup = new Map<SourceGroup, CatalogEntry[]>();
  for (const entry of entries) {
    const bucket = byGroup.get(entry[1]);
    if (bucket) bucket.push(entry);
    else byGroup.set(entry[1], [entry]);
  }
  results.innerHTML = SOURCE_GROUPS.filter((g) => byGroup.has(g.id))
    .map((g) => {
      const rows = byGroup.get(g.id) as CatalogEntry[];
      return (
        `<section class="lp-src-group" data-cat="${g.id}">`
        + `<header class="lp-src-group-head">`
        + `<h2>${escapeHtml(g.label)}</h2>`
        + `<span class="lp-src-count">${rows.length}</span>`
        + `<p>${escapeHtml(g.blurb)}</p>`
        + `</header>`
        + `<ul class="lp-src-grid">${rows.map(card).join('')}</ul>`
        + `</section>`
      );
    })
    .join('');
}

export function initDataSources(): void {
  const root = document.getElementById('data-sources');
  if (!root) return;
  const results = root.querySelector<HTMLElement>('[data-slot="results"]');
  const empty = root.querySelector<HTMLElement>('[data-slot="empty"]');
  const chipBar = root.querySelector<HTMLElement>('[data-slot="chips"]');
  const search = root.querySelector<HTMLInputElement>('[data-slot="search"]');
  const summary = root.querySelector<HTMLElement>('[data-slot="summary"]');
  if (!results || !empty || !chipBar || !search || !summary) return;

  // Counts come from the catalog itself rather than hard-coded markup.
  root.querySelectorAll<HTMLElement>('[data-stat]').forEach((el) => {
    const value = {
      total: CATALOG.length,
      feeds: CATALOG_FEED_COUNT,
      layers: CATALOG_LAYER_COUNT,
      groups: SOURCE_GROUPS.length,
    }[el.dataset.stat ?? ''];
    if (value !== undefined) el.textContent = String(value);
  });

  chipBar.innerHTML = [
    `<button type="button" class="lp-chip lp-chip-on" data-group="all">All <span>${CATALOG.length}</span></button>`,
    ...SOURCE_GROUPS.map((g) => {
      const n = CATALOG.filter((e) => e[1] === g.id).length;
      return `<button type="button" class="lp-chip" data-group="${g.id}">${escapeHtml(g.label)} <span>${n}</span></button>`;
    }),
  ].join('');

  let group: SourceGroup | 'all' = 'all';
  let query = '';

  const apply = (): void => {
    const q = normalize(query.trim());
    const entries = CATALOG.filter(
      (e) => (group === 'all' || e[1] === group) && (!q || searchKey(e).includes(q))
    );
    render(entries, results, empty);
    summary.textContent =
      entries.length === CATALOG.length
        ? `Showing all ${CATALOG.length} sources`
        : `Showing ${entries.length} of ${CATALOG.length} sources`;
  };

  chipBar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-group]');
    if (!btn) return;
    group = (btn.dataset.group as SourceGroup | 'all') ?? 'all';
    chipBar.querySelectorAll('.lp-chip').forEach((c) => {
      c.classList.toggle('lp-chip-on', c === btn);
    });
    apply();
  });

  let debounce = 0;
  search.addEventListener('input', () => {
    query = search.value;
    window.clearTimeout(debounce);
    debounce = window.setTimeout(apply, 120);
  });

  apply();
}
