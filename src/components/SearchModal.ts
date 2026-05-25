import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { trackSearchUsed } from '@/services/analytics';
import { getAllCommands, type Command } from '@/config/commands';
import { isMobileDevice } from '@/utils';
import { startSearchTicker, type SearchTickerPhraseProvider } from '@/utils/search-ticker';
import { describeCommandAction, getSearchResultActionLabel } from './search-ux';
import type { TrendingSearchItem } from '@/utils/live-search-trends';
import { getTrendingWindowLabel } from '@/services/trending-keywords';

interface CommandResult {
  command: Command;
  score: number;
}

const CATEGORY_KEYS: Record<string, string> = {
  navigate: 'commands.categories.navigate',
  layers: 'commands.categories.layers',
  panels: 'commands.categories.panels',
  view: 'commands.categories.view',
  actions: 'commands.categories.actions',
  country: 'commands.categories.country',
};

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function resolveCommandLabel(cmd: Command): string {
  const colonIdx = cmd.id.indexOf(':');
  if (colonIdx === -1) return cmd.label;
  const prefix = cmd.id.slice(0, colonIdx);
  const action = cmd.id.slice(colonIdx + 1);

  switch (prefix) {
    case 'nav':
      return `${t('commands.prefixes.map')}: ${t('commands.regions.' + action, { defaultValue: cmd.label })}`;
    case 'country-map':
      return `${t('commands.prefixes.map')}: ${cmd.label}`;
    case 'panel': {
      const panelName = t('panels.' + kebabToCamel(action), { defaultValue: cmd.label });
      return `${t('commands.prefixes.panel')}: ${panelName}`;
    }
    case 'country':
      return `${t('commands.prefixes.brief')}: ${cmd.label}`;
    default: {
      const i18nKey = `commands.labels.${cmd.id.replace(':', '.')}`;
      const resolved = t(i18nKey, { defaultValue: '' });
      return resolved || cmd.label;
    }
  }
}

function resolveCategoryLabel(cmd: Command): string {
  const key = CATEGORY_KEYS[cmd.category];
  return key ? t(key, { defaultValue: cmd.category }) : cmd.category;
}

export type SearchResultType = 'country' | 'news' | 'hotspot' | 'market' | 'prediction' | 'conflict' | 'base' | 'pipeline' | 'cable' | 'datacenter' | 'earthquake' | 'outage' | 'nuclear' | 'irradiator' | 'techcompany' | 'ailab' | 'startup' | 'techevent' | 'techhq' | 'accelerator' | 'exchange' | 'financialcenter' | 'centralbank' | 'commodityhub' | 'company' | 'marketplace' | 'sanction';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  data: unknown;
}

interface SearchableSource {
  type: SearchResultType;
  items: { id: string; title: string; subtitle?: string; searchText?: string; data: unknown }[];
}

interface AsyncSearchSource {
  type: SearchResultType;
  fetcher: (query: string) => Promise<SearchableSource['items']>;
  limit?: number;
}

const RECENT_SEARCHES_KEY = 'worldmonitor_recent_searches';
const SEARCH_POPULARITY_KEY = 'worldmonitor_search_popularity';
const MAX_RECENT = 8;
const MAX_RESULTS = 24;
const MAX_COMMANDS = 5;
const MAX_POPULAR_SEARCHES = 40;

interface SearchModalOptions {
  placeholder?: string;
  getTickerPhrases?: SearchTickerPhraseProvider;
  getTrendingSearches?: () => readonly TrendingSearchItem[];
}

export class SearchModal {
  private container: HTMLElement;
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private resultsList: HTMLElement | null = null;
  private chipsContainer: HTMLElement | null = null;
  private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private viewportHandler: (() => void) | null = null;
  private sources: SearchableSource[] = [];
  private asyncSources: AsyncSearchSource[] = [];
  private results: SearchResult[] = [];
  private renderedResults: SearchResult[] = []; // mirrors DOM render order (differs from results when grouped)
  private commandResults: CommandResult[] = [];
  private selectedIndex = 0;
  private recentSearches: string[] = [];
  private onSelect?: (result: SearchResult) => void;
  private onCommand?: (command: Command) => void;
  private activePanelIds: Set<string> = new Set();
  private quickActionIds: string[] = [];
  private isMobile: boolean;
  private asyncSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private asyncSearchVersion = 0;
  private modalTickerStop: (() => void) | null = null;
  private modalTickerEl: HTMLElement | null = null;
  private inputWrap: HTMLElement | null = null;
  private readonly getTickerPhrases?: SearchTickerPhraseProvider;
  private readonly getTrendingSearches?: () => readonly TrendingSearchItem[];

  constructor(container: HTMLElement, options?: SearchModalOptions) {
    this.container = container;
    this.isMobile = isMobileDevice();
    this.getTickerPhrases = options?.getTickerPhrases;
    this.getTrendingSearches = options?.getTrendingSearches;
    this.loadRecentSearches();
  }

  public registerSource(type: SearchResultType, items: SearchableSource['items']): void {
    const existingIndex = this.sources.findIndex(s => s.type === type);
    if (existingIndex >= 0) {
      this.sources[existingIndex] = { type, items };
    } else {
      this.sources.push({ type, items });
    }
  }

  public registerAsyncSource(type: SearchResultType, fetcher: (query: string) => Promise<SearchableSource['items']>, options?: { limit?: number }): void {
    const idx = this.asyncSources.findIndex(s => s.type === type);
    if (idx >= 0) {
      this.asyncSources[idx] = { type, fetcher, limit: options?.limit };
    } else {
      this.asyncSources.push({ type, fetcher, limit: options?.limit });
    }
  }

  public setOnSelect(callback: (result: SearchResult) => void): void {
    this.onSelect = callback;
  }

  public setOnCommand(callback: (command: Command) => void): void {
    this.onCommand = callback;
  }

  public setActivePanels(panelIds: string[]): void {
    this.activePanelIds = new Set(panelIds);
  }

  public setQuickActionIds(ids: string[]): void {
    this.quickActionIds = ids;
  }

  public open(): void {
    if (this.closeTimeoutId) {
      clearTimeout(this.closeTimeoutId);
      this.closeTimeoutId = null;
      this.overlay?.remove();
      this.overlay = null;
    }
    if (this.overlay) return;
    this.isMobile = isMobileDevice();
    this.createModal();
    this.startModalTicker();
    this.input?.focus();
    this.showRecentOrEmpty();
    if (this.isMobile) this.renderChips();
  }

  public openWithQuery(query: string): void {
    const normalized = query.trim();
    this.open();
    if (!this.input) return;
    this.input.value = normalized;
    this.syncInputTickerVisibility();
    if (normalized) {
      this.handleSearch();
    } else {
      this.showRecentOrEmpty();
    }
    this.input.focus();
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
  }

  public close(): void {
    this.stopModalTicker();
    if (this.viewportHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.viewportHandler);
      this.viewportHandler = null;
    }
    if (this.overlay) {
      this.overlay.classList.remove('open');
      const remove = () => {
        this.overlay?.remove();
        this.overlay = null;
        this.input = null;
        this.resultsList = null;
        this.chipsContainer = null;
        this.results = [];
        this.commandResults = [];
        this.selectedIndex = 0;
      };
      if (this.isMobile) {
        this.closeTimeoutId = setTimeout(() => {
          this.closeTimeoutId = null;
          remove();
        }, 300);
      } else {
        remove();
      }
    }
  }

  public isOpen(): boolean {
    return this.overlay !== null;
  }

  private createModal(): void {
    this.overlay = document.createElement('div');

    if (this.isMobile) {
      this.overlay.className = 'search-overlay search-mobile';
      this.overlay.setAttribute('role', 'dialog');
      this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.setAttribute('aria-label', 'Search');
      this.overlay.innerHTML = `
        <div class="search-sheet">
          <div class="search-sheet-handle"></div>
          <div class="search-sheet-header">
            <span class="search-sheet-icon">\u{1F50D}</span>
            <div class="search-input-wrap">
              <span class="search-input-ticker search-ticker" aria-hidden="true"><span class="search-ticker-text"></span></span>
              <input type="text" class="search-input" aria-label="Search dashboard" autofocus />
            </div>
            <button class="search-sheet-cancel" aria-label="Close">\u00D7</button>
          </div>
          <div class="search-command-row">
            <span><kbd>Enter</kbd> open</span>
            <span><kbd>\u2191\u2193</kbd> move</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
          <div class="search-sheet-chips"></div>
          <div class="search-results"></div>
        </div>
      `;

      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });

      this.overlay.querySelector('.search-sheet-cancel')?.addEventListener('click', () => this.close());

      this.chipsContainer = this.overlay.querySelector('.search-sheet-chips');

      this.container.appendChild(this.overlay);
      requestAnimationFrame(() => this.overlay?.classList.add('open'));

      const sheet = this.overlay.querySelector('.search-sheet') as HTMLElement | null;
      if (sheet && window.visualViewport) {
        const vv = window.visualViewport;
        this.viewportHandler = () => {
          if (!sheet.isConnected) return;
          sheet.style.maxHeight = `${vv.height * 0.85}px`;
        };
        vv.addEventListener('resize', this.viewportHandler);
      }
    } else {
      this.overlay.className = 'search-overlay';
      this.overlay.setAttribute('role', 'dialog');
      this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.setAttribute('aria-label', 'Search');
      this.overlay.innerHTML = `
        <div class="search-modal">
          <div class="search-header">
            <span class="search-icon">\u2325</span>
            <div class="search-input-wrap">
              <span class="search-input-ticker search-ticker" aria-hidden="true"><span class="search-ticker-text"></span></span>
              <input type="text" class="search-input" aria-label="Search dashboard" autofocus />
            </div>
            <kbd class="search-kbd">ESC</kbd>
          </div>
          <div class="search-command-row">
            <span><kbd>\u2191\u2193</kbd> ${t('modals.search.navigate')}</span>
            <span><kbd>\u21B5</kbd> ${t('modals.search.select')}</span>
            <span><kbd>esc</kbd> ${t('modals.search.close')}</span>
            <span><kbd>?</kbd> shortcuts</span>
          </div>
          <div class="search-results"></div>
          <div class="search-footer">
            <span>Search countries, layers, panels, and live entities</span>
          </div>
        </div>
      `;

      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });

      this.container.appendChild(this.overlay);
    }

    this.input = this.overlay.querySelector('.search-input');
    this.inputWrap = this.overlay.querySelector('.search-input-wrap');
    this.modalTickerEl = this.overlay.querySelector('.search-input-ticker .search-ticker-text');
    this.resultsList = this.overlay.querySelector('.search-results');

    this.syncInputTickerVisibility();
    this.input?.addEventListener('input', () => {
      this.syncInputTickerVisibility();
      this.handleSearch();
    });
    this.input?.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  private startModalTicker(): void {
    this.stopModalTicker();
    const headerPhrase = document.querySelector<HTMLElement>('.header-right .search-ticker-text')?.textContent?.trim();
    this.modalTickerStop = startSearchTicker(this.modalTickerEl, {
      initialPhrase: headerPhrase || undefined,
      getPhrases: this.getTickerPhrases,
    });
  }

  private stopModalTicker(): void {
    this.modalTickerStop?.();
    this.modalTickerStop = null;
  }

  private syncInputTickerVisibility(): void {
    if (!this.inputWrap || !this.input) return;
    const hasValue = this.input.value.trim().length > 0;
    this.inputWrap.classList.toggle('has-value', hasValue);

    const ticker = this.inputWrap.querySelector<HTMLElement>('.search-input-ticker');
    if (ticker) {
      ticker.hidden = hasValue;
    }

    if (hasValue) {
      this.stopModalTicker();
      if (this.modalTickerEl) this.modalTickerEl.textContent = '';
    } else if (this.overlay && !this.modalTickerStop) {
      this.startModalTicker();
    }
  }

  private matchCommands(query: string): CommandResult[] {
    if (query.length < 2) return [];
    const matched: CommandResult[] = [];
    for (const cmd of getAllCommands()) {
      if (cmd.id.startsWith('panel:') && this.activePanelIds.size > 0) {
        const panelId = cmd.id.slice(6);
        if (!this.activePanelIds.has(panelId)) continue;
      }
      const label = resolveCommandLabel(cmd).toLowerCase();
      const allTerms = [...cmd.keywords, label];
      let bestScore = 0;
      for (const term of allTerms) {
        if (term.includes(query) || (term.length >= 3 && query.includes(term))) {
          const isExact = term === query;
          const isPrefix = term.startsWith(query);
          const score = isExact ? 3 : isPrefix ? 2 : 1;
          if (score > bestScore) bestScore = score;
        }
      }
      if (bestScore > 0) {
        matched.push({ command: cmd, score: bestScore });
      }
    }
    return matched.sort((a, b) => b.score - a.score).slice(0, MAX_COMMANDS);
  }

  private handleSearch(): void {
    this.syncInputTickerVisibility();
    const query = this.input?.value.trim().toLowerCase() || '';

    if (!query) {
      this.commandResults = [];
      if (this.asyncSearchTimer) { clearTimeout(this.asyncSearchTimer); this.asyncSearchTimer = null; }
      this.asyncSearchVersion++;
      this.showRecentOrEmpty();
      if (this.isMobile) this.renderChips();
      return;
    }

    this.commandResults = this.matchCommands(query);

    const byType = new Map<SearchResultType, (SearchResult & { _score: number })[]>();

    for (const source of this.sources) {
      for (const item of source.items) {
        const titleLower = item.title.toLowerCase();
        const subtitleLower = item.subtitle?.toLowerCase() || '';
        const searchTextLower = item.searchText?.toLowerCase() || '';
        const searchableText = [titleLower, subtitleLower, searchTextLower].filter(Boolean).join(' ');
        const terms = searchableText.split(/\s+/).filter(Boolean);
        const normalizedQuery = query.replace(/[^a-z0-9]/g, '');
        const normalizedTerms = terms.map(term => term.replace(/[^a-z0-9]/g, '')).filter(Boolean);
        const matchesCompany = normalizedQuery.length > 0
          && (terms.some(term => term === query || term.startsWith(query))
            || normalizedTerms.some(term => term === normalizedQuery || term.startsWith(normalizedQuery)));
        const matchesSource = source.type === 'company'
          ? matchesCompany
          : searchableText.includes(query);

        if (matchesSource) {
          const isExact = terms.includes(query);
          const isPrefix = titleLower.startsWith(query)
            || subtitleLower.startsWith(query)
            || terms.some(term => term.startsWith(query));
          const result = {
            type: source.type,
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            data: item.data,
            _score: isExact ? 3 : isPrefix ? 2 : 1,
          } as SearchResult & { _score: number };

          if (!byType.has(source.type)) byType.set(source.type, []);
          byType.get(source.type)!.push(result);
        }
      }
    }

    const priority: SearchResultType[] = [
      'news', 'prediction', 'company', 'market', 'earthquake', 'outage',
      'conflict', 'hotspot', 'country',
      'sanction',
      'base', 'pipeline', 'cable', 'datacenter', 'nuclear', 'irradiator',
      'techcompany', 'ailab', 'startup', 'techevent', 'techhq', 'accelerator',
      'exchange', 'financialcenter', 'centralbank', 'commodityhub',
      'marketplace',
    ];

    const maxResults = this.isMobile ? 5 : MAX_RESULTS;
    this.results = [];
    for (const type of priority) {
      const matches = byType.get(type) || [];
      matches.sort((a, b) => b._score - a._score);
      const limit = this.isMobile ? (type === 'company' ? 3 : 2) : (type === 'news' ? 6 : type === 'prediction' ? 5 : type === 'company' ? 5 : type === 'country' ? 4 : 3);
      this.results.push(...matches.slice(0, limit));
      if (this.results.length >= maxResults) break;
    }
    this.results = this.results.slice(0, maxResults);

    trackSearchUsed(query.length, this.results.length + this.commandResults.length);
    this.selectedIndex = 0;
    this.renderResults();
    if (this.isMobile) this.renderChips(query);

    // Fire async sources (debounced) to augment results with live data
    this.scheduleAsyncSearch(query);
  }

  private showRecentOrEmpty(): void {
    this.results = [];
    this.selectedIndex = 0;

    if (this.recentSearches.length > 0) {
      this.renderRecent();
    } else {
      this.renderEmpty();
    }
  }

  private scheduleAsyncSearch(query: string): void {
    if (this.asyncSources.length === 0) return;
    if (this.asyncSearchTimer) clearTimeout(this.asyncSearchTimer);

    const version = ++this.asyncSearchVersion;
    this.asyncSearchTimer = setTimeout(() => {
      this.runAsyncSearch(query, version);
    }, 50);
  }

  private async runAsyncSearch(query: string, version: number): Promise<void> {
    const existingIds = new Set(this.results.map(r => r.id));
    let added = false;

    const fetches = this.asyncSources.map(async (source) => {
      try {
        const items = await source.fetcher(query);
        // Stale check — user may have typed more
        if (version !== this.asyncSearchVersion) return;

        const limit = source.limit ?? 5;
        for (const item of items.slice(0, limit)) {
          if (existingIds.has(item.id)) continue;
          // Also dedupe by title (static uses title as id, live prefixes with "live-")
          if (this.results.some(r => r.type === source.type && r.title === item.title)) continue;
          existingIds.add(item.id);
          this.results.push({ type: source.type, id: item.id, title: item.title, subtitle: item.subtitle, data: item.data });
          added = true;
        }
      } catch { /* async source failed, ignore */ }
    });

    await Promise.allSettled(fetches);
    if (version === this.asyncSearchVersion && added) {
      this.renderResults();
    }
  }

  private renderRecent(): void {
    if (!this.resultsList) return;

    const frag = document.createDocumentFragment();
    this.appendTrendingSearches(frag);
    frag.appendChild(this.makeSectionHeader(t('modals.search.recent'), this.makeClearRecentButton()));

    this.recentSearches.forEach((term, i) => {
      const item = document.createElement('div');
      item.className = `search-result-item recent${i === this.selectedIndex ? ' selected' : ''}`;
      item.dataset.recent = term;

      const icon = document.createElement('span');
      icon.className = 'search-result-icon';
      icon.textContent = '🕐';

      const title = document.createElement('span');
      title.className = 'search-result-title';
      title.textContent = term;

      item.appendChild(icon);
      item.appendChild(title);

      item.addEventListener('click', () => {
        if (this.input) this.input.value = term;
        this.handleSearch();
      });

      frag.appendChild(item);
    });

    this.resultsList.replaceChildren(frag);
  }

  private renderEmpty(): void {
    if (!this.resultsList) return;

    const tips: { icon: string; key: string; exampleKey: string }[] = [
      { icon: '\u{1F30D}', key: 'commands.tips.map',            exampleKey: 'commands.tips.mapExample' },
      { icon: '\u{1F4CB}', key: 'commands.tips.panel',          exampleKey: 'commands.tips.panelExample' },
      { icon: '\u{1F4C4}', key: 'commands.tips.brief',          exampleKey: 'commands.tips.briefExample' },
      { icon: '\u{1F6E1}\uFE0F', key: 'commands.tips.layers',   exampleKey: 'commands.tips.layersExample' },
      { icon: '\u23F1\uFE0F', key: 'commands.tips.time',        exampleKey: 'commands.tips.timeExample' },
      { icon: '\u2699\uFE0F', key: 'commands.tips.settings',    exampleKey: 'commands.tips.settingsExample' },
      { icon: '\u{1F3AF}',   key: 'commands.tips.prediction',   exampleKey: 'commands.tips.predictionExample' },
      { icon: '\u{1F6F0}\uFE0F', key: 'commands.tips.satellites', exampleKey: 'commands.tips.satellitesExample' },
      { icon: '\u26A1',      key: 'commands.tips.infrastructure', exampleKey: 'commands.tips.infrastructureExample' },
      { icon: '\u{1F3E6}',   key: 'commands.tips.entities',     exampleKey: 'commands.tips.entitiesExample' },
      { icon: '\u{1F4C8}',   key: 'commands.tips.company',      exampleKey: 'commands.tips.companyExample' },
      { icon: '\u{1F6A8}',   key: 'commands.tips.cyber',        exampleKey: 'commands.tips.cyberExample' },
    ];

    const shuffled = tips.sort(() => Math.random() - 0.5).slice(0, this.isMobile ? 3 : 6);

    const frag = document.createDocumentFragment();
    this.appendTrendingSearches(frag);
    frag.appendChild(this.makeSectionHeader(t('modals.search.empty')));

    shuffled.forEach((tip, i) => {
      const example = t(tip.exampleKey);
      const item = document.createElement('div');
      item.className = `search-result-item tip-item${i === 0 ? ' selected' : ''}`;
      item.dataset.tipExample = example;

      const icon = document.createElement('span');
      icon.className = 'search-result-icon';
      icon.textContent = tip.icon;

      const content = document.createElement('div');
      content.className = 'search-result-content';

      const title = document.createElement('div');
      title.className = 'search-result-title';
      title.textContent = t(tip.key);
      content.appendChild(title);

      const exampleEl = document.createElement('kbd');
      exampleEl.className = 'search-tip-example';
      exampleEl.textContent = example;

      item.append(icon, content, exampleEl);
      frag.appendChild(item);
    });

    this.resultsList.replaceChildren(frag);

    this.resultsList.querySelectorAll('.tip-item').forEach((el) => {
      el.addEventListener('click', () => {
        const example = (el as HTMLElement).dataset.tipExample || '';
        if (this.input) {
          this.input.value = example;
          this.handleSearch();
        }
      });
    });
  }

  private get totalResultCount(): number {
    return this.commandResults.length + this.results.length;
  }

  private getSectionLabel(type: SearchResultType): string {
    const labels: Partial<Record<SearchResultType, string>> = {
      news: 'News', prediction: 'Predictions', country: 'Countries',
      hotspot: 'Hotspots', conflict: 'Conflicts', market: 'Markets',
      base: 'Military Bases', pipeline: 'Pipelines', cable: 'Cables',
      datacenter: 'Data Centers', earthquake: 'Earthquakes', outage: 'Outages',
      nuclear: 'Nuclear', irradiator: 'Nuclear Sites', techcompany: 'Tech Companies',
      ailab: 'AI Labs', startup: 'Startups', techevent: 'Tech Events',
      techhq: 'Tech HQs', accelerator: 'Accelerators', exchange: 'Exchanges',
      financialcenter: 'Financial Centers', centralbank: 'Central Banks',
      commodityhub: 'Commodity Hubs',
      sanction: 'Sanctions',
      company: 'Companies & Indices',
      marketplace: 'Marketplace Data',
    };
    return labels[type] || type;
  }

  /** Appends highlighted text (plain text nodes + mark elements) into container. */
  private appendHighlighted(text: string, container: HTMLElement): void {
    const query = this.input?.value.trim() || '';
    if (!query) { container.textContent = text; return; }
    const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Split on captured match — odd indices are the matches
    const parts = text.split(new RegExp(`(${escapedQ})`, 'gi'));
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 1) {
        const mark = document.createElement('mark');
        mark.textContent = part;
        container.appendChild(mark);
      } else {
        container.appendChild(document.createTextNode(part));
      }
    });
  }

  private makeSectionHeader(label: string, action?: HTMLElement): HTMLElement {
    const hdr = document.createElement('div');
    hdr.className = 'search-section-header';
    const text = document.createElement('span');
    text.className = 'search-section-header-label';
    text.textContent = label;
    hdr.appendChild(text);
    if (action) hdr.appendChild(action);
    return hdr;
  }

  private makeClearRecentButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-clear-recent-btn';
    button.textContent = 'X';
    button.setAttribute('aria-label', 'Clear recent searches');
    button.title = 'Clear recent searches';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearRecentSearches();
    });
    return button;
  }

  private makeResultItem(index: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'search-result-item' + (index === this.selectedIndex ? ' selected' : '');
    row.dataset.index = String(index);
    return row;
  }

  private renderResults(): void {
    if (!this.resultsList) return;

    if (this.commandResults.length === 0 && this.results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      const icon = document.createElement('div');
      icon.className = 'search-empty-icon';
      icon.textContent = '\u2205';
      const msg = document.createElement('div');
      msg.textContent = t('modals.search.noResults');
      empty.appendChild(icon);
      empty.appendChild(msg);
      this.resultsList.replaceChildren(empty);
      return;
    }

    const icons: Record<SearchResultType, string> = {
      country: '\u{1F3F3}\uFE0F', news: '\u{1F4F0}', hotspot: '\u{1F4CD}',
      market: '\u{1F4C8}', prediction: '\u{1F3AF}', conflict: '\u2694\uFE0F',
      base: '\u{1F3DB}\uFE0F', pipeline: '\u{1F6E2}', cable: '\u{1F310}',
      datacenter: '\u{1F5A5}\uFE0F', earthquake: '\u{1F30D}', outage: '\u{1F4E1}',
      nuclear: '\u2622\uFE0F', irradiator: '\u269B\uFE0F', techcompany: '\u{1F3E2}',
      ailab: '\u{1F9E0}', startup: '\u{1F680}', techevent: '\u{1F4C5}',
      techhq: '\u{1F984}', accelerator: '\u{1F680}', exchange: '\u{1F3DB}\uFE0F',
      financialcenter: '\u{1F4B0}', centralbank: '\u{1F3E6}', commodityhub: '\u{1F4E6}',
      company: '\u{1F4C8}',
      marketplace: '\u{1F6D2}',
      sanction: '\u{1F6AB}',
    };

    const frag = document.createDocumentFragment();
    let globalIndex = 0;
    this.renderedResults = []; // rebuild in render order

    const addItem = (row: HTMLElement, idx: number) => {
      row.addEventListener('click', () => this.selectResult(idx));
      frag.appendChild(row);
    };

    // Commands section
    if (this.commandResults.length > 0) {
      frag.appendChild(this.makeSectionHeader(t('modals.search.commands')));
      for (const { command } of this.commandResults) {
        const row = this.makeResultItem(globalIndex);
        row.classList.add('command-item');
        row.dataset.command = command.id;

        const iconEl = document.createElement('span');
        iconEl.className = 'search-result-icon';
        iconEl.textContent = command.icon;

        const content = document.createElement('div');
        content.className = 'search-result-content';
        const titleEl = document.createElement('div');
        titleEl.className = 'search-result-title';
        titleEl.textContent = resolveCommandLabel(command);
        content.appendChild(titleEl);

        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'search-result-subtitle';
        subtitleEl.textContent = describeCommandAction(command);
        content.appendChild(subtitleEl);

        const typeEl = document.createElement('span');
        typeEl.className = 'search-result-type';
        typeEl.textContent = resolveCategoryLabel(command);

        row.appendChild(iconEl);
        row.appendChild(content);
        row.appendChild(typeEl);
        addItem(row, globalIndex++);
      }
    }

    // Results grouped by type with a section header per group
    const typeOrder: SearchResultType[] = [];
    const byType = new Map<SearchResultType, SearchResult[]>();
    for (const result of this.results) {
      if (!byType.has(result.type)) { typeOrder.push(result.type); byType.set(result.type, []); }
      byType.get(result.type)!.push(result);
    }

    for (const type of typeOrder) {
      frag.appendChild(this.makeSectionHeader(this.getSectionLabel(type)));
      for (const result of byType.get(type)!) {
        this.renderedResults.push(result); // track rendered order
        const row = this.makeResultItem(globalIndex);

        const iconEl = document.createElement('span');
        iconEl.className = 'search-result-icon';
        iconEl.textContent = icons[result.type];

        const content = document.createElement('div');
        content.className = 'search-result-content';

        const titleEl = document.createElement('div');
        titleEl.className = 'search-result-title';
        this.appendHighlighted(result.title, titleEl);
        content.appendChild(titleEl);

        if (result.subtitle) {
          const sub = document.createElement('div');
          sub.className = 'search-result-subtitle';
          sub.textContent = result.subtitle;
          content.appendChild(sub);
        } else {
          const sub = document.createElement('div');
          sub.className = 'search-result-subtitle';
          sub.textContent = getSearchResultActionLabel(result.type);
          content.appendChild(sub);
        }

        const actionEl = document.createElement('span');
        actionEl.className = 'search-result-action';
        actionEl.textContent = getSearchResultActionLabel(result.type);

        row.appendChild(iconEl);
        row.appendChild(content);
        row.appendChild(actionEl);
        addItem(row, globalIndex++);
      }
    }

    this.resultsList.replaceChildren(frag);
  }

  private renderChips(query?: string): void {
    if (!this.chipsContainer) return;
    if (query && query.length >= 1) {
      this.chipsContainer.innerHTML = '';
      return;
    }

    const chips: { label: string; value: string }[] = [];
    const commandsById = new Map(getAllCommands().map((cmd) => [cmd.id, cmd]));
    for (const id of this.quickActionIds) {
      const cmd = commandsById.get(id);
      if (!cmd) continue;
      chips.push({ label: resolveCommandLabel(cmd), value: resolveCommandLabel(cmd).toLowerCase() });
      if (chips.length >= 6) break;
    }

    this.chipsContainer.innerHTML = chips.map(c =>
      `<button class="search-chip" data-value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`
    ).join('');

    this.chipsContainer.querySelectorAll('.search-chip').forEach(el => {
      el.addEventListener('click', () => {
        const val = (el as HTMLElement).dataset.value || '';
        if (this.input) {
          this.input.value = val;
          this.handleSearch();
        }
      });
    });
  }


  private handleKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.moveSelection(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.moveSelection(-1);
        break;
      case 'Enter':
        e.preventDefault();
        this.selectResult(this.selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  private moveSelection(delta: number): void {
    const max = this.totalResultCount || this.recentSearches.length;
    if (max === 0) return;

    this.selectedIndex = (this.selectedIndex + delta + max) % max;
    this.updateSelection();
  }

  private updateSelection(): void {
    if (!this.resultsList) return;

    this.resultsList.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });

    const selected = this.resultsList.querySelector('.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }

  private selectResult(index: number): void {
    if (this.totalResultCount === 0 && this.recentSearches.length > 0) {
      const term = this.recentSearches[index];
      if (term && this.input) {
        this.input.value = term;
        this.handleSearch();
      }
      return;
    }

    if (index < this.commandResults.length) {
      const cmd = this.commandResults[index]?.command;
      if (cmd) {
        this.close();
        this.onCommand?.(cmd);
        return;
      }
    }

    const entityIndex = index - this.commandResults.length;
    const result = this.renderedResults[entityIndex];
    if (!result) return;

    this.saveRecentSearch(this.input?.value.trim() || '');
    this.close();
    this.onSelect?.(result);
  }

  private loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      this.recentSearches = stored ? JSON.parse(stored) : [];
    } catch {
      this.recentSearches = [];
    }
  }

  private saveRecentSearch(term: string): void {
    if (!term || term.length < 2) return;
    this.recordPopularSearch(term);

    this.recentSearches = [
      term,
      ...this.recentSearches.filter(t => t !== term)
    ].slice(0, MAX_RECENT);

    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(this.recentSearches));
    } catch {
      // Storage full, ignore
    }
  }

  private clearRecentSearches(): void {
    this.recentSearches = [];
    this.selectedIndex = 0;
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Storage unavailable, ignore
    }
    this.showRecentOrEmpty();
  }

  private appendTrendingSearches(parent: DocumentFragment): void {
    const trends = this.getTrendingSearchItems();
    if (trends.length === 0) return;

    const windowBadge = document.createElement('span');
    windowBadge.className = 'search-trending-window-badge';
    windowBadge.textContent = `last ${getTrendingWindowLabel()}`;
    parent.appendChild(this.makeSectionHeader('Trending', windowBadge));

    const viewport = document.createElement('div');
    viewport.className = 'search-trending-chips';

    // Single track — chips appear twice so translateX(-50%) loops seamlessly.
    // Both copies live in the same flex container so the gap between the last
    // chip of copy 1 and the first chip of copy 2 equals every other gap.
    const track = document.createElement('div');
    track.className = 'search-trending-chips-track';

    const makeChip = (trend: (typeof trends)[number], hidden = false): HTMLButtonElement => {
      const chip = document.createElement('button');
      chip.className = 'search-trending-chip';
      chip.type = 'button';
      chip.dataset.value = trend.query;
      if (trend.meta) chip.title = trend.meta;
      if (hidden) chip.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('span');
      icon.className = 'search-trending-chip-icon';
      icon.textContent = trend.icon;
      const label = document.createElement('span');
      label.textContent = trend.label;
      chip.append(icon, label);
      chip.addEventListener('click', () => {
        if (!this.input) return;
        this.input.value = trend.query;
        this.syncInputTickerVisibility();
        this.handleSearch();
      });
      return chip;
    };

    // Both copies are direct flex children of the track — uniform gap end-to-end.
    // Animation scrolls exactly -50% of track width (= one copy width), loops forever.
    trends.forEach(t => track.appendChild(makeChip(t)));
    trends.forEach(t => track.appendChild(makeChip(t, true /* aria-hidden duplicate */)));

    viewport.appendChild(track);
    parent.appendChild(viewport);
  }

  private getTrendingSearchItems(): TrendingSearchItem[] {
    const items: TrendingSearchItem[] = [];
    const add = (item: TrendingSearchItem) => {
      if (!item.query || !item.label) return;
      const key = item.query.toLowerCase();
      if (items.some(existing => existing.query.toLowerCase() === key || existing.label.toLowerCase() === item.label.toLowerCase())) return;
      items.push(item);
    };

    for (const item of this.getTrendingSearches?.() ?? []) add(item);
    for (const item of this.getLocalPopularSearchItems()) add(item);

    return items.slice(0, 8);
  }

  private getLocalPopularSearchItems(): TrendingSearchItem[] {
    try {
      const raw = localStorage.getItem(SEARCH_POPULARITY_KEY);
      const parsed = raw ? JSON.parse(raw) as Array<{ term?: string; count?: number; lastUsed?: number }> : [];
      return parsed
        .filter(entry => typeof entry.term === 'string' && entry.term.trim().length > 1)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
        .slice(0, 6)
        .map(entry => ({
          label: entry.term!.trim(),
          query: entry.term!.trim(),
          icon: '↗',
          meta: `${Math.max(1, entry.count ?? 1)} searches`,
        }));
    } catch {
      return [];
    }
  }

  private recordPopularSearch(term: string): void {
    const normalized = term.trim();
    if (normalized.length < 2) return;

    try {
      const raw = localStorage.getItem(SEARCH_POPULARITY_KEY);
      const parsed = raw ? JSON.parse(raw) as Array<{ term: string; count: number; lastUsed: number }> : [];
      const now = Date.now();
      const existing = parsed.find(entry => entry.term.toLowerCase() === normalized.toLowerCase());
      if (existing) {
        existing.term = normalized;
        existing.count = Math.max(1, existing.count) + 1;
        existing.lastUsed = now;
      } else {
        parsed.push({ term: normalized, count: 1, lastUsed: now });
      }

      const next = parsed
        .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
        .slice(0, MAX_POPULAR_SEARCHES);
      localStorage.setItem(SEARCH_POPULARITY_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable, ignore
    }
  }
}
