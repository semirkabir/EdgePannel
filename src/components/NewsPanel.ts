import { Panel } from './Panel';
import { WindowedList } from './VirtualList';
import type { NewsItem, ClusteredEvent, DeviationLevel, RelatedAsset, RelatedAssetContext } from '@/types';
import { THREAT_PRIORITY } from '@/services/threat-classifier';
import { formatTime, getCSSColor } from '@/utils';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';
import { linkifyTickers } from '@/utils/ticker-linkify';
import { analysisWorker, enrichWithVelocityML, getClusterAssetContext, MAX_DISTANCE_KM, activityTracker, generateSummary, translateText } from '@/services';
import { getSourcePropagandaRisk, getSourceTier, getSourceType } from '@/config/feeds';
import { SITE_VARIANT } from '@/config';
import { t, getCurrentLanguage } from '@/services/i18n';
import { buildArticleLinkAttributes } from '@/services/article-open';
import { extractEntitiesFromTitle } from '@/services/entity-extraction';
import { getEntityIndex } from '@/services/entity-index';

/** Cap the number of company ticker tags shown per headline to avoid clutter. */
const MAX_COMPANY_TAGS = 2;

/** Threshold for enabling virtual scrolling */
const VIRTUAL_SCROLL_THRESHOLD = 15;

/** Summary cache TTL in milliseconds (10 minutes) */
const SUMMARY_CACHE_TTL = 10 * 60 * 1000;

/** Prepared cluster data for rendering */
interface PreparedCluster {
  cluster: ClusteredEvent;
  isNew: boolean;
  shouldHighlight: boolean;
  showNewTag: boolean;
}

export class NewsPanel extends Panel {
  private clusteredMode = true;
  private deviationEl: HTMLElement | null = null;
  private relatedAssetContext = new Map<string, RelatedAssetContext>();
  private onRelatedAssetClick?: (asset: RelatedAsset) => void;
  private onRelatedAssetsFocus?: (assets: RelatedAsset[], originLabel: string) => void;
  private onRelatedAssetsClear?: () => void;
  private isFirstRender = true;
  private windowedList: WindowedList<PreparedCluster> | null = null;
  private useVirtualScroll = true;
  private renderRequestId = 0;
  private boundScrollHandler: (() => void) | null = null;
  private boundClickHandler: (() => void) | null = null;
  private sortOrder: 'date' | 'title' | 'source' | 'relevance' = 'date';
  private sortDir: 'asc' | 'desc' = 'desc';
  private sortBtn: HTMLButtonElement | null = null;
  private sortDropdown: HTMLElement | null = null;
  private sortOptions = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'date', label: 'Date' },
    { key: 'title', label: 'Title' },
    { key: 'source', label: 'Source' },
  ] as const;

  // Panel summary feature
  private summaryBtn: HTMLButtonElement | null = null;
  private summaryContainer: HTMLElement | null = null;
  private currentHeadlines: string[] = [];
  private lastHeadlineSignature = '';
  private isSummarizing = false;
  private boundSourcesChangedHandler: (() => void) | null = null;

  constructor(id: string, title: string) {
    super({ id, title, showCount: true, trackActivity: true, showCopyButton: false });
    this.element.classList.add('news-panel');
    this.createDeviationIndicator();
    this.createSummarizeButton();
    this.createSortButton();
    this.setupActivityTracking();
    this.initWindowedList();

    this.boundSourcesChangedHandler = () => {
      this.reRender();
    };
    window.addEventListener('worldmonitor:sources-changed', this.boundSourcesChangedHandler);
  }

  private createSortButton(): void {
    const btn = document.createElement('button');
    btn.className = 'panel-sort-trigger';
    btn.title = 'Sort options';
    btn.setAttribute('aria-label', 'Sort news items');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `
      <span class="panel-sort-trigger-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="6" x2="19" y2="6"/>
          <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
          <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <line x1="5" y1="18" x2="19" y2="18"/>
          <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      </span>
    `;
    this.sortBtn = btn;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.sortDropdown) {
        this.sortDropdown.remove();
        this.sortDropdown = null;
        this.sortBtn?.setAttribute('aria-expanded', 'false');
      } else {
        this.openSortDropdown();
      }
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      if (this.sortDropdown) {
        this.sortDropdown.remove();
        this.sortDropdown = null;
        this.sortBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    this.header.appendChild(btn);
  }

  private openSortDropdown(): void {
    if (!this.sortBtn) return;

    const rect = this.sortBtn.getBoundingClientRect();
    const viewportPadding = 8;
    const dropdown = document.createElement('div');
    dropdown.className = 'panel-sort-dropdown';
    dropdown.innerHTML = `
      <div class="panel-sort-label">Sort by</div>
      ${this.sortOptions.map(opt => `
        <button class="panel-sort-option${this.sortOrder === opt.key ? ' active' : ''}" data-sort="${opt.key}">
          <span class="panel-sort-opt-left">
            <span>${opt.label}</span>
            ${opt.key === 'source' ? `
              <span class="panel-sort-arrow-btn" title="View/Edit Sources for this category">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            ` : ''}
          </span>
          <span class="panel-sort-check" aria-hidden="true">✓</span>
        </button>
      `).join('')}
    `;

    // Position below the button
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.zIndex = '10000';
    document.body.appendChild(dropdown);

    const dropdownRect = dropdown.getBoundingClientRect();
    const maxLeft = window.innerWidth - dropdownRect.width - viewportPadding;
    const clampedLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
    dropdown.style.left = `${clampedLeft}px`;

    const maxTop = window.innerHeight - dropdownRect.height - viewportPadding;
    if (rect.bottom + 4 > maxTop) {
      const aboveTop = Math.max(viewportPadding, rect.top - dropdownRect.height - 4);
      dropdown.style.top = `${aboveTop}px`;
    }

    this.sortDropdown = dropdown;
    this.sortBtn.setAttribute('aria-expanded', 'true');

    dropdown.addEventListener('click', (e) => e.stopPropagation());

    dropdown.querySelectorAll<HTMLElement>('.panel-sort-option[data-sort]').forEach(btn => {
      // Handle the arrow button specifically if present
      const arrowBtn = btn.querySelector('.panel-sort-arrow-btn');
      if (arrowBtn) {
        arrowBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('worldmonitor:open-sources', {
            detail: { panelId: this.panelId }
          }));
          dropdown.remove();
          this.sortDropdown = null;
          this.sortBtn?.setAttribute('aria-expanded', 'false');
        });
      }

      btn.addEventListener('click', () => {
        const key = btn.dataset.sort as 'date' | 'title' | 'source' | 'relevance';
        if (key && key !== this.sortOrder) {
          this.sortOrder = key;
          if (key === 'title' || key === 'source') this.sortDir = 'asc';
          else this.sortDir = 'desc';
          this.reRender();
        }
        dropdown.remove();
        this.sortDropdown = null;
        this.sortBtn?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  private reRender(): void {
    const stored = this._lastItems;
    if (stored?.length) this.renderNews(stored);
  }

  private getDisabledSources(): Set<string> {
    try {
      const stored = localStorage.getItem('worldmonitor-disabled-feeds');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  }

  private _lastItems: NewsItem[] | null = null;

  private initWindowedList(): void {
    this.windowedList = new WindowedList<PreparedCluster>(
      {
        container: this.content,
        chunkSize: 8, // Render 8 items per chunk
        bufferChunks: 1, // 1 chunk buffer above/below
      },
      (prepared) => this.renderClusterHtmlSafely(
        prepared.cluster,
        prepared.isNew,
        prepared.shouldHighlight,
        prepared.showNewTag
      ),
      () => this.bindRelatedAssetEvents()
    );
  }

  private setupActivityTracking(): void {
    // Register with activity tracker
    activityTracker.register(this.panelId);

    // Listen for new count changes
    activityTracker.onChange(this.panelId, (newCount) => {
      // Pulse if there are new items
      this.setNewBadge(newCount, newCount > 0);
    });

    // Mark as seen when panel content is scrolled
    this.boundScrollHandler = () => {
      activityTracker.markAsSeen(this.panelId);
    };
    this.content.addEventListener('scroll', this.boundScrollHandler);

    // Mark as seen on click anywhere in panel
    this.boundClickHandler = () => {
      activityTracker.markAsSeen(this.panelId);
    };
    this.element.addEventListener('click', this.boundClickHandler);
  }

  public setRelatedAssetHandlers(options: {
    onRelatedAssetClick?: (asset: RelatedAsset) => void;
    onRelatedAssetsFocus?: (assets: RelatedAsset[], originLabel: string) => void;
    onRelatedAssetsClear?: () => void;
  }): void {
    this.onRelatedAssetClick = options.onRelatedAssetClick;
    this.onRelatedAssetsFocus = options.onRelatedAssetsFocus;
    this.onRelatedAssetsClear = options.onRelatedAssetsClear;
  }

  private createDeviationIndicator(): void {
    const header = this.getElement().querySelector('.panel-header-left');
    if (header) {
      this.deviationEl = document.createElement('span');
      this.deviationEl.className = 'deviation-indicator';
      header.appendChild(this.deviationEl);
    }
  }

  private createSummarizeButton(): void {
    // Create summary container (inserted between header and content)
    this.summaryContainer = document.createElement('div');
    this.summaryContainer.className = 'panel-summary';
    this.summaryContainer.style.display = 'none';
    this.element.insertBefore(this.summaryContainer, this.content);

    // Event delegation: handle close button clicks inside summaryContainer
    // regardless of how many times innerHTML is replaced by showSummary()
    this.summaryContainer.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.panel-summary-close')) {
        this.hideSummary();
      }
    });

    // Create summarize button
    this.summaryBtn = document.createElement('button');
    this.summaryBtn.className = 'panel-summarize-btn';
    this.summaryBtn.type = 'button';
    this.summaryBtn.innerHTML = '<span class="panel-summarize-icon-wrap" aria-hidden="true">✨</span>';
    this.summaryBtn.title = 'Generate AI summary';
    this.summaryBtn.setAttribute('aria-label', 'Generate AI summary');
    this.summaryBtn.addEventListener('click', () => this.handleSummarize());

    const headerActions = this.header.querySelector('.panel-header-actions');
    const countEl = headerActions?.querySelector('.panel-count');
    if (headerActions && countEl) {
      headerActions.insertBefore(this.summaryBtn, countEl);
    } else if (headerActions) {
      headerActions.appendChild(this.summaryBtn);
    } else {
      this.header.appendChild(this.summaryBtn);
    }
  }

  private async handleSummarize(): Promise<void> {
    if (this.isSummarizing || !this.summaryContainer || !this.summaryBtn) return;
    if (this.currentHeadlines.length === 0) return;

    // Clear any previous error state
    this.clearSummaryButtonError();

    // Check cache first (include variant, version, and language)
    const currentLang = getCurrentLanguage();
    const cacheKey = `panel_summary_v3_${SITE_VARIANT}_${this.panelId}_${currentLang}`;
    const cached = this.getCachedSummary(cacheKey);
    if (cached) {
      this.showSummary(cached);
      return;
    }

    // Show loading state
    this.isSummarizing = true;
    this.summaryBtn.innerHTML = `<span class="panel-summarize-spinner" aria-hidden="true"></span><span class="panel-summarize-loading-text">${t('components.newsPanel.generatingSummary')}</span>`;
    this.summaryBtn.disabled = true;
    this.summaryContainer.style.display = 'block';
    this.summaryContainer.innerHTML = `<div class="panel-summary-loading">${t('components.newsPanel.generatingSummary')}</div>`;

    const sigAtStart = this.lastHeadlineSignature;

    try {
      const result = await generateSummary(this.currentHeadlines.slice(0, 8), undefined, this.panelId, currentLang);
      if (!this.element?.isConnected) return;
      if (this.lastHeadlineSignature !== sigAtStart) {
        this.hideSummary();
        return;
      }
      if (result?.summary) {
        this.setCachedSummary(cacheKey, result.summary);
        this.showSummary(result.summary);
      } else {
        this.summaryContainer.innerHTML = `<div class="panel-summary-error">${t('components.newsPanel.summaryError')}</div>`;
        setTimeout(() => this.hideSummary(), 3000);
        this.setSummaryButtonError();
      }
    } catch {
      if (!this.element?.isConnected) return;
      this.summaryContainer.innerHTML = `<div class="panel-summary-error">${t('components.newsPanel.summaryFailed')}</div>`;
      setTimeout(() => this.hideSummary(), 3000);
      this.setSummaryButtonError();
    } finally {
      this.isSummarizing = false;
      if (this.summaryBtn) {
        this.summaryBtn.disabled = false;
      }
    }
  }

  private setSummaryButtonError(): void {
    if (!this.summaryBtn) return;
    this.summaryBtn.classList.add('has-error');
    this.summaryBtn.title = 'Summary failed. Click to retry.';
    this.summaryBtn.setAttribute('aria-label', 'Summary failed. Click to retry.');
    this.summaryBtn.innerHTML = '<span class="panel-summarize-icon-wrap" aria-hidden="true">✨</span>';
  }

  private clearSummaryButtonError(): void {
    if (!this.summaryBtn) return;
    this.summaryBtn.classList.remove('has-error');
    this.summaryBtn.title = 'Generate AI summary';
    this.summaryBtn.setAttribute('aria-label', 'Generate AI summary');
    this.summaryBtn.innerHTML = '<span class="panel-summarize-icon-wrap" aria-hidden="true">✨</span>';
  }

  private async handleTranslate(element: HTMLElement, text: string): Promise<void> {
    const currentLang = getCurrentLanguage();
    if (currentLang === 'en') return; // Assume news is mostly English, no need to translate if UI is English (or add detection later)

    const titleEl = element.closest('.item')?.querySelector('.item-title') as HTMLElement;
    if (!titleEl) return;

    const originalText = titleEl.textContent || '';

    // Visual feedback
    element.innerHTML = '...';
    element.style.pointerEvents = 'none';

    try {
      const translated = await translateText(text, currentLang);
      if (!this.element?.isConnected) return;
      if (translated) {
        titleEl.textContent = translated;
        titleEl.dataset.original = originalText;
        element.innerHTML = '✓';
        element.title = 'Original: ' + originalText;
        element.classList.add('translated');
      } else {
        element.innerHTML = '文';
        // Shake animation or error state could be added here
      }
    } catch (e) {
      if (!this.element?.isConnected) return;
      console.error('Translation failed', e);
      element.innerHTML = '文';
    } finally {
      if (element.isConnected) {
        element.style.pointerEvents = 'auto';
      }
    }
  }

  private showSummary(summary: string): void {
    if (!this.summaryContainer || !this.element?.isConnected) return;
    this.summaryContainer.style.display = 'block';
    this.summaryContainer.innerHTML = `
      <div class="panel-summary-content">
        <span class="panel-summary-text">${escapeHtml(summary)}</span>
        <button class="panel-summary-close" title="${t('components.newsPanel.close')}" aria-label="${t('components.newsPanel.close')}">×</button>
      </div>
    `;
    // Close button click is handled via event delegation on summaryContainer (set up in constructor)
  }

  private hideSummary(): void {
    if (!this.summaryContainer) return;
    this.summaryContainer.style.display = 'none';
    this.summaryContainer.innerHTML = '';
  }

  private getHeadlineSignature(): string {
    return JSON.stringify(this.currentHeadlines.slice(0, 5).sort());
  }

  private updateHeadlineSignature(): void {
    const newSig = this.getHeadlineSignature();
    if (newSig !== this.lastHeadlineSignature) {
      this.lastHeadlineSignature = newSig;
      if (this.summaryContainer?.style.display === 'block') {
        this.hideSummary();
      }
      this.clearSummaryButtonError();
    }
  }

  private getCachedSummary(key: string): string | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (!parsed.headlineSignature) { localStorage.removeItem(key); return null; }
      if (parsed.headlineSignature !== this.lastHeadlineSignature) return null;
      if (Date.now() - parsed.timestamp > SUMMARY_CACHE_TTL) { localStorage.removeItem(key); return null; }
      return parsed.summary;
    } catch {
      return null;
    }
  }

  private setCachedSummary(key: string, summary: string): void {
    try {
      localStorage.setItem(key, JSON.stringify({
        headlineSignature: this.lastHeadlineSignature,
        summary,
        timestamp: Date.now(),
      }));
    } catch { /* storage full */ }
  }

  public setDeviation(zScore: number, percentChange: number, level: DeviationLevel): void {
    if (!this.deviationEl) return;

    if (level === 'normal') {
      this.deviationEl.textContent = '';
      this.deviationEl.className = 'deviation-indicator';
      return;
    }

    const arrow = zScore > 0 ? '↑' : '↓';
    const sign = percentChange > 0 ? '+' : '';
    this.deviationEl.textContent = `${arrow}${sign}${percentChange}%`;
    this.deviationEl.className = `deviation-indicator ${level}`;
    this.deviationEl.title = `z-score: ${zScore} (vs 7-day avg)`;
  }

  public renderNews(items: NewsItem[]): void {
    this._lastItems = items;

    const disabledSources = this.getDisabledSources();
    const filteredItems = items.filter(item => !disabledSources.has(item.source));

    if (filteredItems.length === 0) {
      this.renderRequestId += 1; // Cancel in-flight clustering from previous renders.
      this.setCount(0);
      this.setDataBadge('unavailable');
      this.showError(t('common.noNewsAvailable'));
      return;
    }

    // Always show flat items immediately for instant visual feedback,
    // then upgrade to clustered view in the background when ready.
    this.renderFlat(filteredItems);

    if (this.clusteredMode) {
      void this.renderClustersAsync(filteredItems);
    }
  }

  public renderFilteredEmpty(message: string): void {
    this.renderRequestId += 1; // Cancel in-flight clustering from previous renders.
    this.setCount(0);
    this.relatedAssetContext.clear();
    this.currentHeadlines = [];
    this.updateHeadlineSignature();
    this.setContent(`<div class="panel-empty">${escapeHtml(message)}</div>`);
  }

  private async renderClustersAsync(items: NewsItem[]): Promise<void> {
    const requestId = ++this.renderRequestId;

    try {
      const clusters = await analysisWorker.clusterNews(items);
      if (requestId !== this.renderRequestId) return;
      const enriched = await enrichWithVelocityML(clusters);
      this.renderClusters(enriched);
    } catch (error) {
      if (requestId !== this.renderRequestId) return;
      // Keep already-rendered flat list visible when clustering fails.
      console.warn('[NewsPanel] Failed to cluster news, keeping flat list:', error);
    }
  }

  private renderFlat(items: NewsItem[]): void {
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      switch (this.sortOrder) {
        case 'relevance':
          cmp = this.getNewsItemRelevanceScore(b) - this.getNewsItemRelevanceScore(a);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'source':
          cmp = a.source.localeCompare(b.source) || a.title.localeCompare(b.title);
          break;
        case 'date':
        default:
          cmp = b.pubDate.getTime() - a.pubDate.getTime();
          break;
      }
      return this.sortDir === 'desc' ? cmp : -cmp;
    });

    this.setCount(sorted.length);
    this.currentHeadlines = sorted
      .slice(0, 5)
      .map(item => item.title)
      .filter((title): title is string => typeof title === 'string' && title.trim().length > 0);

    this.updateHeadlineSignature();

    const html = sorted
      .map(
        (item) => {
          const articleAttrs = buildArticleLinkAttributes({
            url: item.link,
            title: item.title,
            source: item.source,
            publishedAt: item.pubDate,
          });
          let faviconHtml = '●';
          try {
            const url = new URL(item.link);
            faviconHtml = `<img src="https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32" class="source-icon" width="10" height="10" loading="lazy" alt="" onerror="this.style.display='none'" />`;
          } catch {}
          const tier = getSourceTier(item.source);
          const tierBadge = `<span class="tier-badge tier-${tier}">${faviconHtml}</span>`;

          return `
      <div class="item ${item.isAlert ? 'alert' : ''}" ${item.monitorColor ? `style="--item-accent: ${escapeHtml(item.monitorColor)}"` : ''}>
        <div class="item-source">
          ${tierBadge}
          ${escapeHtml(item.source)}
          ${item.lang && item.lang !== getCurrentLanguage() ? `<span class="lang-badge">${item.lang.toUpperCase()}</span>` : ''}
          ${item.isAlert ? '<span class="alert-tag">ALERT</span>' : ''}
          ${this.buildCompanyTagsHtml(item.title)}
        </div>
        <div class="item-title-row">
          <a class="item-title" href="${sanitizeUrl(item.link)}" target="_blank" rel="noopener" ${articleAttrs}>${escapeHtml(item.title)}</a>
          ${articleAttrs ? `<button class="item-expand-btn" type="button" aria-label="Open article in right panel" title="Open in right panel" ${articleAttrs}></button>` : ''}
        </div>
        <div class="item-time">
          ${formatTime(item.pubDate)}
          ${getCurrentLanguage() !== 'en' ? `<button class="item-translate-btn" title="Translate" data-text="${escapeHtml(item.title)}">文</button>` : ''}
        </div>
      </div>
    `;
        }
      )
      .join('');

    this.setContent(html);
  }

  private renderClusters(clusters: ClusteredEvent[]): void {
    const sorted = [...clusters].sort((a, b) => {
      let cmp = 0;
      switch (this.sortOrder) {
        case 'relevance':
          cmp = this.getClusterRelevanceScore(b) - this.getClusterRelevanceScore(a);
          break;
        case 'title':
          cmp = a.primaryTitle.localeCompare(b.primaryTitle);
          break;
        case 'source':
          cmp = a.primarySource.localeCompare(b.primarySource) || a.primaryTitle.localeCompare(b.primaryTitle);
          break;
        case 'date':
        default:
          cmp = b.lastUpdated.getTime() - a.lastUpdated.getTime();
          break;
      }

      return this.sortDir === 'desc' ? cmp : -cmp;
    });

    const totalItems = sorted.reduce((sum, c) => sum + c.sourceCount, 0);
    this.setCount(totalItems);
    this.relatedAssetContext.clear();

    // Store headlines for summarization (cap at 5 to reduce entity conflation in small models)
    this.currentHeadlines = sorted.slice(0, 5).map(c => c.primaryTitle);

    this.updateHeadlineSignature();

    const clusterIds = sorted.map(c => c.id);
    let newItemIds: Set<string>;

    if (this.isFirstRender) {
      // First render: mark all items as seen
      activityTracker.updateItems(this.panelId, clusterIds);
      activityTracker.markAsSeen(this.panelId);
      newItemIds = new Set();
      this.isFirstRender = false;
    } else {
      // Subsequent renders: track new items
      const newIds = activityTracker.updateItems(this.panelId, clusterIds);
      newItemIds = new Set(newIds);
    }

    // Prepare all clusters with their rendering data (defer HTML creation)
    const prepared: PreparedCluster[] = sorted.map(cluster => {
      const isNew = newItemIds.has(cluster.id);
      const shouldHighlight = activityTracker.shouldHighlight(this.panelId, cluster.id);
      const showNewTag = activityTracker.isNewItem(this.panelId, cluster.id) && isNew;

      return {
        cluster,
        isNew,
        shouldHighlight,
        showNewTag,
      };
    });

    // Use windowed rendering for large lists, direct render for small
    if (this.useVirtualScroll && sorted.length > VIRTUAL_SCROLL_THRESHOLD && this.windowedList) {
      this.windowedList.setItems(prepared);
    } else {
      // Direct render for small lists
      const html = prepared
        .map(p => this.renderClusterHtmlSafely(p.cluster, p.isNew, p.shouldHighlight, p.showNewTag))
        .join('');
      this.setContent(html);
      this.bindRelatedAssetEvents();
    }
  }

  private renderClusterHtmlSafely(
    cluster: ClusteredEvent,
    isNew: boolean,
    shouldHighlight: boolean,
    showNewTag: boolean
  ): string {
    try {
      return this.renderClusterHtml(cluster, isNew, shouldHighlight, showNewTag);
    } catch (error) {
      console.error('[NewsPanel] Failed to render cluster card:', error, cluster);
      const clusterId = typeof cluster?.id === 'string' ? cluster.id : 'unknown-cluster';
      return `
        <div class="item clustered item-render-error" data-cluster-id="${escapeHtml(clusterId)}">
          <div class="item-source">${t('common.error')}</div>
          <div class="item-title">Failed to display this cluster.</div>
        </div>
      `;
    }
  }

  /**
   * Render a single cluster to HTML string
   */
  private renderClusterHtml(
    cluster: ClusteredEvent,
    isNew: boolean,
    shouldHighlight: boolean,
    showNewTag: boolean
  ): string {
    const sourceBadge = cluster.sourceCount > 1
      ? `<span class="source-count">${t('components.newsPanel.sources', { count: String(cluster.sourceCount) })}</span>`
      : '';

    const velocity = cluster.velocity;
    const velocityBadge = velocity && velocity.level !== 'normal' && cluster.sourceCount > 1
      ? `<span class="velocity-badge ${velocity.level}">${velocity.trend === 'rising' ? '↑' : ''}+${velocity.sourcesPerHour}/hr</span>`
      : '';

    const sentimentIcon = velocity?.sentiment === 'negative' ? '⚠' : velocity?.sentiment === 'positive' ? '✓' : '';
    const sentimentBadge = sentimentIcon && Math.abs(velocity?.sentimentScore || 0) > 2
      ? `<span class="sentiment-badge ${velocity?.sentiment}">${sentimentIcon}</span>`
      : '';

    const newTag = showNewTag ? `<span class="new-tag">${t('common.new')}</span>` : '';
    const langBadge = cluster.lang && cluster.lang !== getCurrentLanguage()
      ? `<span class="lang-badge">${cluster.lang.toUpperCase()}</span>`
      : '';

    // Propaganda risk indicator for primary source
    const primaryPropRisk = getSourcePropagandaRisk(cluster.primarySource);
    const primaryPropBadge = primaryPropRisk.risk !== 'low'
      ? `<span class="propaganda-badge ${primaryPropRisk.risk}" title="${escapeHtml(primaryPropRisk.note || `State-affiliated: ${primaryPropRisk.stateAffiliated || 'Unknown'}`)}">${primaryPropRisk.risk === 'high' ? '⚠ State Media' : '! Caution'}</span>`
      : '';

    // Source credibility badge for primary source (T1=Wire, T2=Verified outlet)
    const primaryTier = getSourceTier(cluster.primarySource);
    const primaryType = getSourceType(cluster.primarySource);
    const tierLabel = primaryTier === 1 ? 'Wire' : ''; // Don't show "Major" - confusing with story importance
    
    let faviconHtml = '●';
    try {
      const url = new URL(cluster.primaryLink);
      faviconHtml = `<img src="https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32" class="source-icon" width="10" height="10" loading="lazy" alt="" onerror="this.style.display='none'" />`;
    } catch {}
    
    const tierIcon = primaryTier === 1 ? '★' : faviconHtml;
    const tierBadge = `<span class="tier-badge tier-${primaryTier}" title="${primaryType === 'wire' ? 'Wire Service - Highest reliability' : primaryType === 'gov' ? 'Official Government Source' : 'Verified News Outlet'}">${tierIcon}${tierLabel ? ` ${tierLabel}` : ''}</span>`;

    // Build "Also reported by" section for multi-source confirmation
    const otherSources = cluster.topSources.filter(s => s.name !== cluster.primarySource);
    const topSourcesHtml = otherSources.length > 0
      ? `<span class="also-reported">Also:</span>` + otherSources
        .map(s => {
          const propRisk = getSourcePropagandaRisk(s.name);
          const propBadge = propRisk.risk !== 'low'
            ? `<span class="propaganda-badge ${propRisk.risk}" title="${escapeHtml(propRisk.note || `State-affiliated: ${propRisk.stateAffiliated || 'Unknown'}`)}">${propRisk.risk === 'high' ? '⚠' : '!'}</span>`
            : '';
          return `<span class="top-source tier-${s.tier}">${escapeHtml(s.name)}${propBadge}</span>`;
        })
        .join('')
      : '';

    const assetContext = getClusterAssetContext(cluster);
    if (assetContext && assetContext.assets.length > 0) {
      this.relatedAssetContext.set(cluster.id, assetContext);
    }

    const relatedAssetsHtml = assetContext && assetContext.assets.length > 0
      ? `
        <div class="related-assets" data-cluster-id="${escapeHtml(cluster.id)}">
          <div class="related-assets-header">
            ${t('components.newsPanel.relatedAssetsNear', { location: escapeHtml(assetContext.origin.label) })}
            <span class="related-assets-range">(${MAX_DISTANCE_KM}km)</span>
          </div>
          <div class="related-assets-list">
            ${assetContext.assets.map(asset => `
              <button class="related-asset" data-cluster-id="${escapeHtml(cluster.id)}" data-asset-id="${escapeHtml(asset.id)}" data-asset-type="${escapeHtml(asset.type)}">
                <span class="related-asset-type">${escapeHtml(this.getLocalizedAssetLabel(asset.type))}</span>
                <span class="related-asset-name">${escapeHtml(asset.name)}</span>
                <span class="related-asset-distance">${Math.round(asset.distanceKm)}km</span>
              </button>
            `).join('')}
          </div>
        </div>
      `
      : '';

    // Category tag from threat classification
    const cat = cluster.threat?.category;
    const catLabel = cat && cat !== 'general' ? cat.charAt(0).toUpperCase() + cat.slice(1) : '';
    const threatVarMap: Record<string, string> = { critical: '--threat-critical', high: '--threat-high', medium: '--threat-medium', low: '--threat-low', info: '--threat-info' };
    const catColor = cluster.threat ? getCSSColor(threatVarMap[cluster.threat.level] || '--text-dim') : '';
    const categoryBadge = catLabel
      ? `<span class="category-tag" style="color:${catColor};border-color:${catColor}40;background:${catColor}20">${catLabel}</span>`
      : '';

    // Build class list for item
    const itemClasses = [
      'item',
      'clustered',
      cluster.isAlert ? 'alert' : '',
      shouldHighlight ? 'item-new-highlight' : '',
      isNew ? 'item-new' : '',
    ].filter(Boolean).join(' ');

    const articleAttrs = buildArticleLinkAttributes({
      url: cluster.primaryLink,
      title: cluster.primaryTitle,
      source: cluster.primarySource,
      publishedAt: cluster.lastUpdated,
    });

    return `
      <div class="${itemClasses}" ${cluster.monitorColor ? `style="--item-accent: ${escapeHtml(cluster.monitorColor)}"` : ''} data-cluster-id="${escapeHtml(cluster.id)}" data-news-id="${escapeHtml(cluster.primaryLink)}">
        <div class="item-source">
          ${tierBadge}
          ${escapeHtml(cluster.primarySource)}
          ${primaryPropBadge}
          ${langBadge}
          ${newTag}
          ${sourceBadge}
          ${velocityBadge}
          ${sentimentBadge}
          ${cluster.isAlert ? '<span class="alert-tag">ALERT</span>' : ''}
          ${categoryBadge}
          ${this.buildCompanyTagsHtml(cluster.primaryTitle)}
        </div>
        <div class="item-title-row">
          <a class="item-title" href="${sanitizeUrl(cluster.primaryLink)}" target="_blank" rel="noopener" ${articleAttrs}>${linkifyTickers(escapeHtml(cluster.primaryTitle))}</a>
          ${articleAttrs ? `<button class="item-expand-btn" type="button" aria-label="Open article in right panel" title="Open in right panel" ${articleAttrs}></button>` : ''}
        </div>
        <div class="cluster-meta">
          <span class="top-sources">${topSourcesHtml}</span>
          <span class="item-time">${formatTime(cluster.lastUpdated)}</span>
          ${getCurrentLanguage() !== 'en' ? `<button class="item-translate-btn" title="Translate" data-text="${escapeHtml(cluster.primaryTitle)}">文</button>` : ''}
        </div>
        ${relatedAssetsHtml}
      </div>
    `;
  }

  /**
   * Detect companies mentioned in a headline and render them as clickable
   * ticker tags (reuses the global .ticker-link delegation set up in
   * entity-intel.ts, so clicking opens the company detail panel for free).
   */
  private buildCompanyTagsHtml(title: string): string {
    const index = getEntityIndex();
    const companies = extractEntitiesFromTitle(title)
      .filter(entity => index.byId.get(entity.entityId)?.type === 'company')
      .slice(0, MAX_COMPANY_TAGS);

    if (companies.length === 0) return '';

    return companies
      .map(entity => {
        const ticker = escapeHtml(entity.entityId);
        const name = escapeHtml(entity.name);
        return `<span class="company-tag ticker-link" data-ticker="${ticker}" data-name="${name}" role="button" tabindex="0" title="${name}">${ticker}</span>`;
      })
      .join('');
  }

  private bindRelatedAssetEvents(): void {
    const containers = this.content.querySelectorAll<HTMLDivElement>('.related-assets');
    containers.forEach((container) => {
      const clusterId = container.dataset.clusterId;
      if (!clusterId) return;
      const context = this.relatedAssetContext.get(clusterId);
      if (!context) return;

      container.addEventListener('mouseenter', () => {
        this.onRelatedAssetsFocus?.(context.assets, context.origin.label);
      });

      container.addEventListener('mouseleave', () => {
        this.onRelatedAssetsClear?.();
      });
    });

    const assetButtons = this.content.querySelectorAll<HTMLButtonElement>('.related-asset');
    assetButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const clusterId = button.dataset.clusterId;
        const assetId = button.dataset.assetId;
        const assetType = button.dataset.assetType as RelatedAsset['type'] | undefined;
        if (!clusterId || !assetId || !assetType) return;
        const context = this.relatedAssetContext.get(clusterId);
        const asset = context?.assets.find(item => item.id === assetId && item.type === assetType);
        if (asset) {
          this.onRelatedAssetClick?.(asset);
        }
      });
    });

    // Translation buttons
    const translateBtns = this.content.querySelectorAll<HTMLElement>('.item-translate-btn');
    translateBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.dataset.text;
        if (text) this.handleTranslate(btn, text);
      });
    });
  }

  private getLocalizedAssetLabel(type: RelatedAsset['type']): string {
    const keyMap: Record<RelatedAsset['type'], string> = {
      pipeline: 'modals.countryBrief.infra.pipeline',
      cable: 'modals.countryBrief.infra.cable',
      datacenter: 'modals.countryBrief.infra.datacenter',
      base: 'modals.countryBrief.infra.base',
      nuclear: 'modals.countryBrief.infra.nuclear',
      irradiator: 'components.deckgl.layers.gammaIrradiators',
      spaceport: 'components.deckgl.layers.spaceports',
      waterway: 'components.deckgl.layers.strategicWaterways',
      economicCenter: 'components.deckgl.layers.economicCenters',
      aptGroup: 'components.deckgl.layers.aptGroups',
      mineral: 'components.deckgl.layers.criticalMinerals',
      startupHub: 'components.deckgl.layers.startupHubs',
      accelerator: 'components.deckgl.layers.accelerators',
      cloudRegion: 'components.deckgl.layers.cloudRegions',
      techHQ: 'components.deckgl.layers.techHQs',
      stockExchange: 'components.deckgl.layers.stockExchanges',
      financialCenter: 'components.deckgl.layers.financialCenters',
      centralBank: 'components.deckgl.layers.centralBanks',
      commodityHub: 'components.deckgl.layers.commodityHubs',
      miningSite: 'components.deckgl.layers.miningSites',
      processingPlant: 'components.deckgl.layers.processingPlants',
      commodityPort: 'components.deckgl.layers.commodityPorts',
    };
    return t(keyMap[type]);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.boundSourcesChangedHandler) {
      window.removeEventListener('worldmonitor:sources-changed', this.boundSourcesChangedHandler);
      this.boundSourcesChangedHandler = null;
    }

    // Clean up windowed list
    this.windowedList?.destroy();
    this.windowedList = null;

    // Remove activity tracking listeners
    if (this.boundScrollHandler) {
      this.content.removeEventListener('scroll', this.boundScrollHandler);
      this.boundScrollHandler = null;
    }
    if (this.boundClickHandler) {
      this.element.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }

    // Unregister from activity tracker
    activityTracker.unregister(this.panelId);

    // Call parent destroy
    super.destroy();
  }

  private getNewsItemRelevanceScore(item: NewsItem): number {
    const threatScore = THREAT_PRIORITY[item.threat?.level ?? 'info'] * 100;
    const alertScore = item.isAlert ? 60 : 0;
    const tierScore = Math.max(0, 6 - (item.tier ?? 5)) * 8;
    const ageHours = Math.max(0, (Date.now() - item.pubDate.getTime()) / (1000 * 60 * 60));
    const recencyScore = Math.max(0, 48 - ageHours);
    return threatScore + alertScore + tierScore + recencyScore;
  }

  private getClusterRelevanceScore(cluster: ClusteredEvent): number {
    const threatScore = THREAT_PRIORITY[cluster.threat?.level ?? 'info'] * 120;
    const alertScore = cluster.isAlert ? 60 : 0;
    const sourceScore = Math.min(cluster.sourceCount, 8) * 10;
    const velocityScore = Math.round(cluster.velocity?.sourcesPerHour ?? 0) * 6;
    const ageHours = Math.max(0, (Date.now() - cluster.lastUpdated.getTime()) / (1000 * 60 * 60));
    const recencyScore = Math.max(0, 48 - ageHours);
    return threatScore + alertScore + sourceScore + velocityScore + recencyScore;
  }
}
