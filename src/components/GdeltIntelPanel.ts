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
import { applyArticleLinkDataset } from '@/services/article-open';

export class GdeltIntelPanel extends Panel {
  private activeTopic: IntelTopic = getIntelTopics()[0]!;
  private topicData = new Map<string, TopicIntelligence>();
  private tabsEl: HTMLElement | null = null;
  private topics: IntelTopic[];
  private draggedTab: HTMLElement | null = null;

  constructor() {
    super({
      id: 'gdelt-intel',
      title: t('panels.gdeltIntel'),
      showCount: true,
      trackActivity: true,
      infoTooltip: t('components.gdeltIntel.infoTooltip'),
    });
    this.topics = getIntelTopics();
    this.createTabs();
    this.loadActiveTopic();
  }

  private createTabs(): void {
    this.tabsEl = h('div', { className: 'panel-tabs' },
      ...this.topics.map(topic => {
        const btn = h('button', {
          className: `panel-tab ${topic.id === this.activeTopic.id ? 'active' : ''}`,
          dataset: { topicId: topic.id },
          title: topic.description,
          onClick: () => this.selectTopic(topic),
        },
          h('span', { className: 'tab-icon' }, topic.icon),
          h('span', { className: 'tab-label' }, topic.name),
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
    // Update topics order based on new tab order
    const tabs = Array.from(this.tabsEl?.querySelectorAll('.panel-tab') ?? []) as HTMLElement[];
    this.topics = tabs.map(tab => {
      const id = tab.dataset.topicId!;
      return this.topics.find(t => t.id === id)!;
    });
    this.draggedTab = null;
  }

  private selectTopic(topic: IntelTopic): void {
    if (topic.id === this.activeTopic.id) return;

    this.activeTopic = topic;

    this.tabsEl?.querySelectorAll('.panel-tab').forEach(tab => {
      tab.classList.toggle('active', (tab as HTMLElement).dataset.topicId === topic.id);
    });

    const cached = this.topicData.get(topic.id);
    if (cached && Date.now() - cached.fetchedAt.getTime() < 5 * 60 * 1000) {
      this.renderArticles(cached.articles);
    } else {
      this.loadActiveTopic();
    }
  }

  private async loadActiveTopic(): Promise<void> {
    this.showLoading();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await fetchTopicIntelligence(this.activeTopic);
        if (!this.element?.isConnected) return;
        this.topicData.set(this.activeTopic.id, data);

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
        this.showError(t('common.failedIntelFeed'), () => this.loadActiveTopic());
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

  public async refresh(): Promise<void> {
    await this.loadActiveTopic();
  }

  public async refreshAll(): Promise<void> {
    this.topicData.clear();
    await this.loadActiveTopic();
  }
}
