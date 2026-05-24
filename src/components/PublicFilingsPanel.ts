import { Panel } from './Panel';
import type { PopupType } from './MapPopup';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import {
  fetchCongressTrades,
  fetchInstitutionalHoldings,
  type CongressTrade,
} from '@/services/market/portfolio';
import {
  fetchSec13FFeed,
  filterFilings,
  sortFilings,
  CATEGORY_LABELS,
  getFilingTypeLabel,
  countByCategory,
  getSecFilingViewerUrl,
  getSecFilingAccessionNumber,
  type SecFilingEntry,
  type FilingsSort,
} from '@/services/market/sec-filings';
import {
  getFeaturedInstitutionResults,
  normalizeInstitutionName,
  searchInstitutions13F,
  type InstitutionSearchResult,
} from '@/services/market/normalized-13f';

type FirmFilter = 'all' | 'thirteen_filers';
type PeopleFilter = 'all' | 'public_figures' | 'politicians';
type FilingDateRange = '7d' | '30d' | 'quarter' | 'all';

export class PublicFilingsPanel extends Panel {
  private congressCache: CongressTrade[] | null = null;
  private filingsFilter = '';
  private featuredFilters: { firms: FirmFilter; people: PeopleFilter } = { firms: 'all', people: 'all' };
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // 13F expanded view state
  private expanded13F = false;
  private filingSearch = '';
  private filingTypeFilter = 'all';
  private filingDateRange: FilingDateRange = 'all';
  private filingSort: FilingsSort = 'newest';

  constructor() {
    super({
      id: 'public-filings',
      title: t('panels.publicFilings'),
    });
    void this.render();
  }

  public async render(): Promise<void> {
    this.showLoading();
    await this.renderContent();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.renderContent();
      }
    }, 60_000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
  }

  private async renderContent(): Promise<void> {
    try {
      await this.renderFilingsTab(this.content);
    } catch (err) {
      this.setContentNow(`<div class="pf-error">Error loading data: ${escapeHtml(String(err))}</div>`);
    }
  }

  private async renderFilingsTab(contentEl: HTMLElement): Promise<void> {
    if (!this.congressCache) {
      const resp = await fetchCongressTrades();
      this.congressCache = resp.trades;
    }

    this.startAutoRefresh();

    const formatRelativeTime = (value: string | Date): string => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return 'Just now';
      const diff = Math.max(0, Date.now() - date.getTime());
      const minutes = Math.floor(diff / 60_000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    };

    const formatFiledDate = (value: string | Date): string => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return 'Unknown';
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const secFeed = await fetchSec13FFeed();
    const query = this.filingsFilter.trim().toLowerCase();

    const featuredInstitutions = (query
      ? await searchInstitutions13F(this.filingsFilter, { recentFilings: secFeed, limit: 16 })
      : getFeaturedInstitutionResults(secFeed).slice(0, 8))
      .filter(inv => this.matchesFirmFilter(inv));

    let trades = [...this.congressCache];
    if (query) {
      trades = trades.filter(tr =>
        tr.politician.toLowerCase().includes(query) ||
        tr.ticker.toLowerCase().includes(query) ||
        tr.party.toLowerCase().includes(query) ||
        tr.assetDescription.toLowerCase().includes(query) ||
        tr.chamber.toLowerCase().includes(query) ||
        tr.state.toLowerCase().includes(query)
      );
    }
    if (this.featuredFilters.people === 'public_figures') {
      trades = [];
    }

    const institutionMatchSet = new Set(
      featuredInstitutions.map(inv => inv.cik || normalizeInstitutionName(inv.name)).filter(Boolean)
    );
    const tickerQueryMatches = featuredInstitutions.filter(inv => inv.matchReason === 'ticker');
    const selected13FFeedSource = tickerQueryMatches.length > 0
      ? secFeed.filter(entry =>
        institutionMatchSet.has(entry.cik) ||
        institutionMatchSet.has(normalizeInstitutionName(entry.filerName))
      )
      : secFeed;
    const skipTextFilter = tickerQueryMatches.length > 0;

    // Build the full 13F feed (apply global search only when no ticker-specific matches)
    let full13FFeed = (selected13FFeedSource.length > 0 ? selected13FFeedSource : secFeed)
      .filter(entry =>
        skipTextFilter ||
        !query ||
        entry.filerName.toLowerCase().includes(query) ||
        entry.cik.includes(query) ||
        entry.filingType.toLowerCase().includes(query)
      );

    // Fallback to institution holdings when feed is empty
    if (full13FFeed.length === 0) {
      const fallbackTargets = featuredInstitutions
        .slice(0, 6)
        .filter(inv => inv.cik)
        .map(inv => ({ cik: inv.cik, name: inv.name }));

      if (fallbackTargets.length > 0) {
        const fallbackHistory = await Promise.all(
          fallbackTargets.map(async (target) => {
            try {
              const historyResp = await fetchInstitutionalHoldings(target.cik);
              return (historyResp.filingHistory || []).map((entry): SecFilingEntry => ({
                id: entry.id,
                title: `${entry.filingType} - ${historyResp.name || target.name}`,
                filerName: historyResp.name || target.name,
                cik: target.cik,
                filingType: entry.filingType,
                filedAt: new Date(entry.acceptedAt || entry.filingDate || Date.now()),
                url: entry.url,
                description: '',
              }));
            } catch {
              return [];
            }
          }),
        );

        full13FFeed = fallbackHistory
          .flat()
          .filter(entry => !Number.isNaN(entry.filedAt.getTime()))
          .sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime());
      }
    }

    // Apply expanded-view filters
    let displayed13FFeed = filterFilings(full13FFeed, {
      type: this.filingTypeFilter,
      dateRange: this.filingDateRange,
      search: this.filingSearch,
    });
    displayed13FFeed = sortFilings(displayed13FFeed, this.filingSort);

    // When collapsed, show only top 6
    const collapsed13FFeed = full13FFeed
      .sort((a, b) => b.filedAt.getTime() - a.filedAt.getTime())
      .slice(0, 6);
    const active13FFeed = this.expanded13F ? displayed13FFeed : collapsed13FFeed;

    const liveCongressTrades = [...trades]
      .sort((a, b) =>
        `${b.disclosureDate}T23:59:59Z`.localeCompare(`${a.disclosureDate}T23:59:59Z`) ||
        b.transactionDate.localeCompare(a.transactionDate)
      )
      .slice(0, 6);

    // Compute category breakdown for chips
    const categoryCounts = countByCategory(full13FFeed);
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Build category breakdown chips HTML
    const categoryChips = topCategories.map(([cat, count]) => {
      const label = CATEGORY_LABELS[cat] ?? cat;
      const isActive = this.filingTypeFilter === cat;
      return `<button class="pf-chip pf-cat-chip${isActive ? ' pf-chip-active' : ''}" data-cat-filter="${escapeHtml(cat)}" title="${escapeHtml(label)}">${escapeHtml(label)} <span class="pf-cat-count">${count}</span></button>`;
    }).join('');

    const secFeedRows = active13FFeed.map((entry: SecFilingEntry) => {
      const ft = entry.filingType;
      const badgeClass = ft.includes('/A') || ft.includes('A ')
        ? 'pf-filing-type-amend'
        : ft.includes('NT')
          ? 'pf-filing-type-nt'
          : ft.includes('SC') || ft.includes('13D') || ft.includes('13G')
            ? 'pf-filing-type-ownership'
            : ft.includes('S-') || ft.includes('F-')
              ? 'pf-filing-type-registration'
              : ft.includes('424') || ft.includes('497')
                ? 'pf-filing-type-prospectus'
                : ft.includes('DEF') || ft.includes('PRE')
                  ? 'pf-filing-type-proxy'
                  : ft.includes('10-K') || ft.includes('10-Q') || ft.includes('20-F') || ft.includes('8-K')
                    ? 'pf-filing-type-periodic'
                    : ft.includes('N-') || ft.includes('NPORT') || ft.includes('N-CSR')
                      ? 'pf-filing-type-fund'
                      : 'pf-filing-type-hr';
      const filingLabel = getFilingTypeLabel(ft);
      const secUrl = getSecFilingViewerUrl(entry);
      const accessionNumber = getSecFilingAccessionNumber(entry);
      return `
        <div class="pf-filing-row">
          <span class="pf-filing-info">
            <span class="pf-filing-name">${escapeHtml(entry.filerName)}</span>
            <span class="pf-filing-cik">CIK ${escapeHtml(entry.cik || 'N/A')} \u00b7 ${escapeHtml(formatRelativeTime(entry.filedAt))}</span>
          </span>
          <span class="pf-filing-type-badge ${badgeClass}" title="${escapeHtml(filingLabel)}">${escapeHtml(ft)}</span>
          <span class="pf-filing-date">${escapeHtml(formatFiledDate(entry.filedAt))}</span>
          ${secUrl ? `<a class="pf-filing-link" href="${escapeHtml(secUrl)}" target="_blank" rel="noopener" title="View on SEC.gov">\u{1F4C4}</a>` : ''}
          <button class="pf-row-open-btn" type="button" title="Read filing" aria-label="Read filing" data-open-kind="secFiling" data-cik="${escapeHtml(entry.cik)}" data-name="${escapeHtml(entry.filerName)}" data-filing-type="${escapeHtml(entry.filingType)}" data-accession-number="${escapeHtml(accessionNumber)}" data-document-url="${escapeHtml(secUrl || entry.url)}" data-title="${escapeHtml(entry.title)}" data-filed-at="${escapeHtml(entry.filedAt.toISOString())}">\u2197</button>
          <button class="pf-entity-open-btn" type="button" title="Open filer details" aria-label="Open filer details" data-cik="${escapeHtml(entry.cik)}" data-name="${escapeHtml(entry.filerName)}">\u25CE</button>
        </div>
      `;
    }).join('');

    // Expanded-view filter toolbar HTML
    const categoryOptions = Object.entries(CATEGORY_LABELS)
      .filter(([key]) => key !== 'all')
      .map(([key, label]) =>
        `<option value="${escapeHtml(key)}"${this.filingTypeFilter === key ? ' selected' : ''}>${escapeHtml(label)}</option>`
      ).join('');

    const expandedToolbar = this.expanded13F ? `
      <div class="pf-13f-toolbar">
        <input type="text" class="pf-input pf-13f-search" id="pf-13f-search" placeholder="Search filer name, CIK, or filing type..." value="${escapeHtml(this.filingSearch)}" />
        <select class="pf-select pf-13f-type-select" id="pf-13f-type-filter">
          <option value="all"${this.filingTypeFilter === 'all' ? ' selected' : ''}>All Types</option>
          ${categoryOptions}
        </select>
        <select class="pf-select pf-13f-date-select" id="pf-13f-date-filter">
          <option value="all"${this.filingDateRange === 'all' ? ' selected' : ''}>All Time</option>
          <option value="7d"${this.filingDateRange === '7d' ? ' selected' : ''}>Last 7 Days</option>
          <option value="30d"${this.filingDateRange === '30d' ? ' selected' : ''}>Last 30 Days</option>
          <option value="quarter"${this.filingDateRange === 'quarter' ? ' selected' : ''}>Last Quarter</option>
        </select>
        <select class="pf-select pf-13f-sort-select" id="pf-13f-sort">
          <option value="newest"${this.filingSort === 'newest' ? ' selected' : ''}>Newest First</option>
          <option value="oldest"${this.filingSort === 'oldest' ? ' selected' : ''}>Oldest First</option>
          <option value="name"${this.filingSort === 'name' ? ' selected' : ''}>By Name</option>
        </select>
      </div>
    ` : '';

    const expandIcon = this.expanded13F ? '\u25B2' : '\u25BC';
    const expandLabel = this.expanded13F ? 'Collapse' : `Expand (${full13FFeed.length})`;

    const congressFeedRows = liveCongressTrades.map(trade => {
      const isPurchase = trade.transactionType.toLowerCase().includes('purchase');
      const isSale = trade.transactionType.toLowerCase().includes('sale');
      const typeBadgeClass = isPurchase ? 'pf-filing-type-hr' : isSale ? 'pf-filing-type-amend' : 'pf-filing-type-other';
      const typeLabel = isPurchase ? 'BUY' : isSale ? 'SELL' : trade.transactionType.toUpperCase();
      const companyLabel = trade.ticker || trade.assetDescription || trade.politician;
      const companyMeta = [trade.politician, trade.party, trade.chamber].filter(Boolean).join(' \u00b7 ');

      return `
        <div class="pf-filing-row pf-congress-filing-row">
          <span class="pf-filing-info">
            <span class="pf-filing-name">${escapeHtml(companyLabel)}</span>
            <span class="pf-filing-cik">${escapeHtml(companyMeta)}</span>
          </span>
          <span class="pf-filing-type-badge ${typeBadgeClass}">${escapeHtml(typeLabel)}</span>
          <span class="pf-filing-date">${escapeHtml(formatFiledDate(`${trade.disclosureDate}T23:59:59Z`))}</span>
          <button class="pf-row-open-btn" type="button" title="Open in right panel" aria-label="Open in right panel" data-open-kind="${trade.ticker ? 'company' : 'congressTrade'}" data-trade-idx="${escapeHtml(String(this.congressCache!.indexOf(trade)))}" data-ticker="${escapeHtml(trade.ticker)}" data-name="${escapeHtml(trade.assetDescription || trade.ticker || trade.politician)}">\u2197</button>
        </div>`;
    }).join('');

    contentEl.innerHTML = `
      <div class="pf-filter-bar">
        <input type="text" class="pf-input" id="pf-filings-filter" placeholder="Search people, firms, tickers, or parties..." value="${escapeHtml(this.filingsFilter)}" />
        <div class="pf-filter-chips-row">
          <div class="pf-filter-chip-group">
            <span class="pf-filter-chip-label">Firms</span>
            <button class="pf-chip${this.featuredFilters.firms === 'all' ? ' pf-chip-active' : ''}" data-filter-group="firms" data-value="all">All</button>
            <button class="pf-chip${this.featuredFilters.firms === 'thirteen_filers' ? ' pf-chip-active' : ''}" data-filter-group="firms" data-value="thirteen_filers">13F</button>
          </div>
          <div class="pf-filter-chip-group">
            <span class="pf-filter-chip-label">People</span>
            <button class="pf-chip${this.featuredFilters.people === 'all' ? ' pf-chip-active' : ''}" data-filter-group="people" data-value="all">All</button>
            <button class="pf-chip${this.featuredFilters.people === 'public_figures' ? ' pf-chip-active' : ''}" data-filter-group="people" data-value="public_figures">Public Figures</button>
            <button class="pf-chip${this.featuredFilters.people === 'politicians' ? ' pf-chip-active' : ''}" data-filter-group="people" data-value="politicians">Politicians</button>
          </div>
        </div>
      </div>
      <div class="pf-filings-grid">
        <div class="pf-section pf-inst-shell pf-13f-shell">
          <div class="pf-section-head">
            <div>
              <div class="pf-section-title">SEC Filings</div>
              <div class="pf-section-subtitle">${tickerQueryMatches.length > 0 ? `Recent SEC filings tied to ${escapeHtml(this.filingsFilter.trim().toUpperCase())}.` : 'Live SEC EDGAR filings, listed as they post.'}</div>
              ${this.expanded13F && categoryChips ? `<div class="pf-cat-chips-row">${categoryChips}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="pf-count">${active13FFeed.length} shown${this.expanded13F ? ` of ${full13FFeed.length}` : ''}</div>
              <button class="pf-expand-btn" type="button" id="pf-13f-expand" title="${this.expanded13F ? 'Collapse' : 'Expand all filings'}">${escapeHtml(expandIcon)} ${escapeHtml(expandLabel)}</button>
            </div>
          </div>
          ${expandedToolbar}
          <div class="pf-filings-list ${this.expanded13F ? 'pf-filings-list-expanded' : ''}">${secFeedRows || '<div class="pf-mini-empty">No recent SEC filings match the current filters.</div>'}</div>
        </div>
        <div class="pf-section pf-inst-shell pf-congress-shell">
          <div class="pf-section-head">
            <div>
              <div class="pf-section-title">Congress Filings</div>
              <div class="pf-section-subtitle">Live congressional trade disclosures, with direct jumps into the right panel.</div>
            </div>
            <div class="pf-count">${liveCongressTrades.length} live</div>
          </div>
          <div class="pf-congress-list pf-congress-feed">${congressFeedRows || '<div class="pf-mini-empty">No congressional filings match the current filters.</div>'}</div>
        </div>
      </div>
    `;

    const filterInput = contentEl.querySelector('#pf-filings-filter') as HTMLInputElement;
    let debounce: number | undefined;
    filterInput?.addEventListener('input', () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        this.filingsFilter = filterInput.value.trim();
        this.renderContent();
      }, 300);
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filterGroup = chip.dataset.filterGroup;
        const value = chip.dataset.value;
        if (!filterGroup || !value) return;

        if (filterGroup === 'firms') {
          this.featuredFilters.firms = value as FirmFilter;
        } else if (filterGroup === 'people') {
          this.featuredFilters.people = value as PeopleFilter;
        }

        void this.renderContent();
      });
    });

    // Category breakdown chip filters
    contentEl.querySelectorAll<HTMLElement>('.pf-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const catFilter = chip.dataset.catFilter;
        if (!catFilter) return;
        // Toggle: if already active, clear it
        this.filingTypeFilter = this.filingTypeFilter === catFilter ? 'all' : catFilter;
        void this.renderContent();
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-row-open-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const openKind = button.dataset.openKind;

        if (openKind === 'secFiling') {
          this.openEntityDetail('secFiling', {
            cik: button.dataset.cik || '',
            companyName: button.dataset.name || '',
            filingType: button.dataset.filingType || '',
            accessionNumber: button.dataset.accessionNumber || '',
            documentUrl: button.dataset.documentUrl || '',
            title: button.dataset.title || '',
            filedAt: button.dataset.filedAt || '',
          });
          return;
        }

        if (openKind === 'institution') {
          this.openEntityDetail('institution', {
            name: button.dataset.name || 'Institution',
            cik: button.dataset.cik || '',
          });
          return;
        }

        if (openKind === 'company') {
          const ticker = button.dataset.ticker;
          if (ticker) {
            this.openEntityDetail('company', {
              ticker,
              name: button.dataset.name || ticker,
            });
          }
          return;
        }

        const idx = parseInt(button.dataset.tradeIdx || '-1', 10);
        const trade = idx >= 0 ? this.congressCache?.[idx] : null;
        if (trade) {
          this.openEntityDetail('congressTrade', trade);
        }
      });
    });

    contentEl.querySelectorAll<HTMLElement>('.pf-entity-open-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEntityDetail('institution', {
          name: button.dataset.name || 'Institution',
          cik: button.dataset.cik || '',
        });
      });
    });

    // Expand / collapse 13F section
    const expandBtn = contentEl.querySelector('#pf-13f-expand') as HTMLButtonElement;
    expandBtn?.addEventListener('click', () => {
      this.expanded13F = !this.expanded13F;
      void this.renderContent();
    });

    // Expanded-view: filing search
    const filingSearchInput = contentEl.querySelector('#pf-13f-search') as HTMLInputElement;
    let filingDebounce: number | undefined;
    filingSearchInput?.addEventListener('input', () => {
      window.clearTimeout(filingDebounce);
      filingDebounce = window.setTimeout(() => {
        this.filingSearch = filingSearchInput.value.trim();
        void this.renderContent();
      }, 250);
    });

    // Expanded-view: type filter
    const typeSelect = contentEl.querySelector('#pf-13f-type-filter') as HTMLSelectElement;
    typeSelect?.addEventListener('change', () => {
      this.filingTypeFilter = typeSelect.value;
      void this.renderContent();
    });

    // Expanded-view: date range filter
    const dateSelect = contentEl.querySelector('#pf-13f-date-filter') as HTMLSelectElement;
    dateSelect?.addEventListener('change', () => {
      this.filingDateRange = dateSelect.value as FilingDateRange;
      void this.renderContent();
    });

    // Expanded-view: sort
    const sortSelect = contentEl.querySelector('#pf-13f-sort') as HTMLSelectElement;
    sortSelect?.addEventListener('change', () => {
      this.filingSort = sortSelect.value as FilingsSort;
      void this.renderContent();
    });
  }

  private matchesFirmFilter(_investor: InstitutionSearchResult): boolean {
    switch (this.featuredFilters.firms) {
      case 'all':
      case 'thirteen_filers':
      default:
        return true;
    }
  }

  private openEntityDetail(type: PopupType, data: unknown): void {
    document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
      detail: { type, data },
    }));

    const fallback = (window as any).__entityDetailPanel;
    fallback?.show?.(type, data);
  }

  public override destroy(): void {
    this.stopAutoRefresh();
    super.destroy();
  }
}
