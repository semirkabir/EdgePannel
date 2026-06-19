import { Panel } from './Panel';
import { sanitizeUrl } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { h, replaceChildren } from '@/utils/dom-utils';
import {
  getIntelTopics,
  fetchTopicIntelligence,
  formatArticleDate,
  extractDomain,
  type GdeltArticle,
  type IntelTopic,
  type TopicIntelligence,
} from '@/services/gdelt-intel';
import {
  EVENT_QUERIES,
  fetchEventsByCategory,
  formatEventDate,
  intensityLabel,
  type GdeltEvent,
  type GdeltEventQuery,
} from '@/services/gdelt-events';
import { applyArticleLinkDataset } from '@/services/article-open';

type TabMode = 'articles' | 'events';

interface TabEntry {
  id: string;
  label: string;
  icon: string;
  description: string;
  mode: TabMode;
  topic?: IntelTopic;
  eventQuery?: GdeltEventQuery;
}

export class GdeltIntelPanel extends Panel {
  private activeTab: TabEntry;
  private tabsEl: HTMLElement | null = null;
  private topicData = new Map<string, TopicIntelligence>();
  private eventData = new Map<string, GdeltEvent[]>();
  private topics: IntelTopic[];
  private draggedTab: HTMLElement | null = null;
  private tabs: TabEntry[] = [];

  constructor() {
    super({
      id: 'gdelt-intel',
      title: t('panels.gdeltIntel'),
      showCount: true,
      trackActivity: true,
      infoTooltip: t('components.gdeltIntel.infoTooltip'),
    });
    this.topics = getIntelTopics();
    this.buildTabList();
    this.activeTab = this.tabs[0]!;
    this.createTabs();
    this.loadActiveTab();
  }

  private buildTabList(): void {
    const entries: TabEntry[] = [];

    // GDELT Event Database categories (structured CAMEO events)
    for (const eq of EVENT_QUERIES) {
      entries.push({
        id: `event:${eq.id}`,
        label: eq.name,
        icon: eq.icon,
        description: eq.description,
        mode: 'events',
        eventQuery: eq,
      });
    }

    // GDELT DOC API topics (article search)
    for (const topic of this.topics) {
      entries.push({
        id: `topic:${topic.id}`,
        label: topic.name,
        icon: topic.icon,
        description: topic.description,
        mode: 'articles',
        topic,
      });
    }

    this.tabs = entries;
  }

  private createTabs(): void {
    this.tabsEl = h('div', { className: 'panel-tabs' },
      ...this.tabs.map(tab => {
        const btn = h('button', {
          className: `panel-tab ${tab.id === this.activeTab.id ? 'active' : ''}`,
          dataset: { tabId: tab.id },
          title: tab.description,
          onClick: () => this.selectTab(tab),
        },
          h('span', { className: 'tab-icon' }, tab.icon),
          h('span', { className: 'tab-label' }, tab.label),
        );
        btn.draggable = true;
        btn.addEventListener('dragstart', (e) => this.onDragStart(e as DragEvent));
        btn.addEventListener('dragover', (e) => this.onDragOver(e as DragEvent));
        btn.addEventListener('drop', (e) => this.onDrop(e as DragEvent));
        btn.addEventListener('dragend', () => this.onDragEnd());
        return btn;
      }),
    );

    this.element.insertBefore(this.tabsEl, this.content);
  }

  private onDragStart(e: DragEvent): void {
    this.draggedTab = e.target as HTMLElement;
    this.draggedTab.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.draggedTab.innerHTML);
    }
  }

  private onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const target = e.target as HTMLElement;
    if (target.classList.contains('panel-tab') && target !== this.draggedTab) {
      target.parentNode?.insertBefore(this.draggedTab!, target);
    }
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
  }

  private onDragEnd(): void {
    this.draggedTab?.classList.remove('dragging');
    // Update tab order based on new DOM order
    const tabEls = Array.from(this.tabsEl?.querySelectorAll('.panel-tab') ?? []) as HTMLElement[];
    const ordered: TabEntry[] = [];
    for (const el of tabEls) {
      const id = el.dataset.tabId!;
      const tab = this.tabs.find(t => t.id === id);
      if (tab) ordered.push(tab);
    }
    this.tabs = ordered;
    this.draggedTab = null;
  }

  private selectTab(tab: TabEntry): void {
    if (tab.id === this.activeTab.id) return;
    this.activeTab = tab;
    this.tabsEl?.querySelectorAll('.panel-tab').forEach(el => {
      el.classList.toggle('active', (el as HTMLElement).dataset.tabId === tab.id);
    });

    // Check cache first
    if (tab.mode === 'articles' && tab.topic) {
      const cached = this.topicData.get(tab.topic.id);
      if (cached && Date.now() - cached.fetchedAt.getTime() < 5 * 60 * 1000) {
        this.renderArticles(cached.articles);
        return;
      }
    } else if (tab.mode === 'events' && tab.eventQuery) {
      const cached = this.eventData.get(tab.eventQuery.id);
      if (cached && cached.length > 0) {
        this.renderEvents(cached);
        return;
      }
    }

    this.loadActiveTab();
  }

  private async loadActiveTab(): Promise<void> {
    if (this.activeTab.mode === 'events') {
      await this.loadEvents();
    } else {
      await this.loadArticles();
    }
  }

  // ── Events mode (GDELT 2.0 Event Database) ──────────────────────────

  private async loadEvents(): Promise<void> {
    this.showLoading();
    const eq = this.activeTab.eventQuery;
    if (!eq) return;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const events = await fetchEventsByCategory(eq.id, 40, '24h');
        if (!this.element?.isConnected) return;
        this.eventData.set(eq.id, events);
        this.renderEvents(events);
        this.setCount(events.length);
        return;
      } catch (error) {
        if (this.isAbortError(error)) return;
        if (!this.element?.isConnected) return;
        console.error(`[GdeltIntelPanel] Events load error (attempt ${attempt + 1}):`, error);
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 10_000));
          continue;
        }
        this.showError(t('common.failedIntelFeed'), () => this.loadEvents());
      }
    }
  }

  private renderEvents(events: GdeltEvent[]): void {
    this.setErrorState(false);
    if (events.length === 0) {
      replaceChildren(this.content, h('div', { className: 'empty-state' }, t('components.gdeltEvents.empty')));
      return;
    }

    replaceChildren(this.content,
      h('div', { className: 'gdelt-events-list' },
        ...events.map(ev => this.buildEventCard(ev)),
      ),
    );
  }

  private buildEventCard(ev: GdeltEvent): HTMLElement {
    const intensity = intensityLabel(ev.goldsteinScale);
    const timeAgo = formatEventDate(ev.date);
    const cardClass = `gdelt-event-card ${intensity.class}`;

    const headerParts: HTMLElement[] = [
      h('span', { className: 'gdelt-event-type' }, ev.eventDescription || ev.eventCode),
      h('span', { className: 'gdelt-event-time' }, timeAgo),
    ];

    const bodyParts: HTMLElement[] = [];

    // Actors
    if (ev.actor1Name) {
      const actorLine = ev.actor2Name
        ? `${ev.actor1Name} → ${ev.actor2Name}`
        : ev.actor1Name;
      bodyParts.push(h('div', { className: 'gdelt-event-actors' }, actorLine));
    }

    // Location
    if (ev.actionGeoFullName) {
      bodyParts.push(h('div', { className: 'gdelt-event-location' }, `📍 ${ev.actionGeoFullName}`));
    }

    // Metrics row
    const metricsRow = h('div', { className: 'gdelt-event-metrics' });
    metricsRow.append(h('span', { className: `gdelt-intensity-badge ${intensity.class}` }, intensity.label));
    metricsRow.append(h('span', { className: 'gdelt-metric' }, `Goldstein: ${ev.goldsteinScale.toFixed(1)}`));
    metricsRow.append(h('span', { className: 'gdelt-metric' }, `${ev.quadClassName}`));
    if (ev.numMentions > 0) {
      metricsRow.append(h('span', { className: 'gdelt-metric gdelt-mentions' }, `📰 ${ev.numMentions} mentions`));
    }
    if (ev.avgTone !== 0) {
      const toneClass = ev.avgTone < -3 ? 'tone-negative' : ev.avgTone > 3 ? 'tone-positive' : '';
      metricsRow.append(h('span', { className: `gdelt-metric ${toneClass}` }, `Tone: ${ev.avgTone.toFixed(1)}`));
    }
    bodyParts.push(metricsRow);

    return h('div', { className: cardClass },
      h('div', { className: 'gdelt-event-header' }, ...headerParts),
      h('div', { className: 'gdelt-event-body' }, ...bodyParts),
    );
  }

  // ── Articles mode (GDELT DOC API — existing) ────────────────────────

  private async loadArticles(): Promise<void> {
    this.showLoading();
    const topic = this.activeTab.topic;
    if (!topic) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await fetchTopicIntelligence(topic);
        if (!this.element?.isConnected) return;
        this.topicData.set(topic.id, data);

        if (!data.articles?.length && attempt < 2) {
          this.showRetrying(undefined, 15);
          await new Promise(r => setTimeout(r, 15_000));
          if (!this.element?.isConnected) return;
          continue;
        }

        this.renderArticles(data.articles ?? []);
        this.setCount(data.articles?.length ?? 0);
        return;
      } catch (error) {
        if (this.isAbortError(error)) return;
        if (!this.element?.isConnected) return;
        console.error(`[GdeltIntelPanel] Load error (attempt ${attempt + 1}):`, error);
        if (attempt < 2) {
          this.showRetrying(undefined, 15);
          await new Promise(r => setTimeout(r, 15_000));
          if (!this.element?.isConnected) return;
          continue;
        }
        this.showError(t('common.failedIntelFeed'), () => this.loadArticles());
      }
    }
  }

  private renderArticles(articles: GdeltArticle[]): void {
    this.setErrorState(false);
    if (articles.length === 0) {
      replaceChildren(this.content, h('div', { className: 'empty-state' }, t('components.gdelt.empty')));
      return;
    }

    replaceChildren(this.content,
      h('div', { className: 'gdelt-intel-articles' },
        ...articles.map(article => this.buildArticle(article)),
      ),
    );
  }

  private buildArticle(article: GdeltArticle): HTMLElement {
    const domain = article.source || extractDomain(article.url);
    const timeAgo = formatArticleDate(article.date);
    const toneClass = article.tone ? (article.tone < -2 ? 'tone-negative' : article.tone > 2 ? 'tone-positive' : '') : '';

    const link = h('a', {
      href: sanitizeUrl(article.url),
      target: '_blank',
      rel: 'noopener',
      className: `gdelt-intel-article ${toneClass}`.trim(),
    },
      h('div', { className: 'article-header' },
        h('span', { className: 'article-source' }, domain),
        h('span', { className: 'article-time' }, timeAgo),
      ),
      h('div', { className: 'article-title' }, article.title),
    );
    applyArticleLinkDataset(link, {
      url: article.url,
      title: article.title,
      source: domain,
      publishedAt: article.date,
    });
    return link;
  }

  // ── Public API ───────────────────────────────────────────────────────

  public async refresh(): Promise<void> {
    await this.loadActiveTab();
  }

  public async refreshAll(): Promise<void> {
    this.topicData.clear();
    this.eventData.clear();
    await this.loadActiveTab();
  }
}
