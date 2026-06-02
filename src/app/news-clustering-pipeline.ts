import type { AppContext } from '@/app/app-context';
import type { NewsItem, MapLayers } from '@/types';
import type { TimeRange } from '@/components';
import { getTimeRangeLabel as formatTimeRangeLabel, getTimeRangeWindowMs as resolveTimeRangeWindowMs } from '@/utils/time-range';
import type { HappyContentCategory } from '@/services/positive-classifier';
import type { PositiveGeoEvent } from '@/services/positive-events-geo';
import {
  FEEDS,
  INTEL_SOURCES,
  SITE_VARIANT,
} from '@/config';
import {
  fetchCategoryFeeds,
  getFeedFailures,
} from '@/services';
import { checkBatchForBreakingAlerts } from '@/services/breaking-news-alerts';
import { mlWorker } from '@/services/ml-worker';
import { clusterNewsHybrid } from '@/services/clustering';
import { ingestHeadlines } from '@/services/trending-keywords';
import { classifyWithAI } from '@/services/threat-classifier';
import { canQueueAiClassification, AI_CLASSIFY_MAX_PER_FEED } from '@/services/ai-classify-queue';
import { classifyNewsItem } from '@/services/positive-classifier';
import { filterBySentiment } from '@/services/sentiment-gate';
import { fetchAllPositiveTopicIntelligence } from '@/services/gdelt-intel';
import { fetchPositiveGeoEvents, geocodePositiveNewsItems } from '@/services/positive-events-geo';
import { fetchKindnessData } from '@/services/kindness-data';
import { fetchConservationWins } from '@/services/conservation-data';
import { fetchRenewableEnergyData, fetchEnergyCapacity } from '@/services/renewable-energy-data';
import { fetchRenewableInstallations } from '@/services/renewable-installations';
import { fetchHappinessScores } from '@/services/happiness-data';
import { fetchGivingSummary } from '@/services/giving';
import { fetchProgressData } from '@/services/progress-data';
import { checkMilestones } from '@/services/celebration';
import { getPersistentCache, setPersistentCache } from '@/services/persistent-cache';
import { dataFreshness } from '@/services/data-freshness';
import { updateBaseline, calculateDeviation } from '@/services/storage';
import { t } from '@/services/i18n';
import { getHydratedData } from '@/services/bootstrap';
import { isFeatureEnabled } from '@/services/runtime-config';
import { debounce } from '@/utils';
import type { ListFeedDigestResponse } from '@/generated/client/worldmonitor/news/v1/service_client';
import type { NewsItem as ProtoNewsItem, ThreatLevel as ProtoThreatLevel } from '@/generated/client/worldmonitor/news/v1/service_client';
import type { ThreatLevel as ClientThreatLevel } from '@/services/threat-classifier';

const PROTO_TO_CLIENT_LEVEL: Record<ProtoThreatLevel, ClientThreatLevel> = {
  THREAT_LEVEL_UNSPECIFIED: 'info',
  THREAT_LEVEL_LOW: 'low',
  THREAT_LEVEL_MEDIUM: 'medium',
  THREAT_LEVEL_HIGH: 'high',
  THREAT_LEVEL_CRITICAL: 'critical',
};

function protoItemToNewsItem(p: ProtoNewsItem): NewsItem {
  const level = PROTO_TO_CLIENT_LEVEL[p.threat?.level ?? 'THREAT_LEVEL_UNSPECIFIED'];
  return {
    source: p.source,
    title: p.title,
    link: p.link,
    pubDate: new Date(p.publishedAt),
    isAlert: p.isAlert,
    threat: p.threat ? {
      level,
      category: p.threat.category as import('@/services/threat-classifier').EventCategory,
      confidence: p.threat.confidence,
      source: (p.threat.source || 'keyword') as 'keyword' | 'ml' | 'llm',
    } : undefined,
    ...(p.locationName && { locationName: p.locationName }),
    ...(p.location && { lat: p.location.latitude, lon: p.location.longitude }),
  };
}

export interface NewsClusteringPipelineDeps {
  callPanel: (key: string, method: string, ...args: unknown[]) => void;
  flashMapForNews: (items: NewsItem[]) => void;
  updateSearchIndex: () => void;
  refreshCiiAndBrief: (forceLocal?: boolean) => void;
  tryFetchDigest?: () => Promise<ListFeedDigestResponse | null>;
}

export class NewsClusteringPipeline {
  private ctx: AppContext;
  private deps: NewsClusteringPipelineDeps;
  private readonly applyTimeRangeFilterToNewsPanelsDebounced: ReturnType<typeof debounce>;

  constructor(ctx: AppContext, deps: NewsClusteringPipelineDeps) {
    this.ctx = ctx;
    this.deps = deps;
    this.applyTimeRangeFilterToNewsPanelsDebounced = debounce(() => {
      this.applyTimeRangeFilterToNewsPanels();
    }, 120);
  }

  destroy(): void {
    (this.applyTimeRangeFilterToNewsPanelsDebounced as ReturnType<typeof debounce> & { cancel?: () => void }).cancel?.();
  }

  getTimeRangeWindowMs(range: TimeRange): number {
    return resolveTimeRangeWindowMs(range);
  }

  filterItemsByTimeRange(items: NewsItem[], range: TimeRange = this.ctx.uiStore.currentTimeRange): NewsItem[] {
    if (range === 'all') return items;
    const cutoff = Date.now() - this.getTimeRangeWindowMs(range);
    return items.filter((item) => {
      const ts = item.pubDate instanceof Date ? item.pubDate.getTime() : new Date(item.pubDate).getTime();
      return Number.isFinite(ts) ? ts >= cutoff : true;
    });
  }

  getTimeRangeLabel(range: TimeRange = this.ctx.uiStore.currentTimeRange): string {
    return formatTimeRangeLabel(range);
  }

  renderNewsForCategory(category: string, items: NewsItem[]): void {
    this.ctx.newsStore.setNewsByCategory(category, items);
    const panel = this.ctx.newsPanels[category];
    if (!panel) return;
    const filteredItems = this.filterItemsByTimeRange(items);
    if (filteredItems.length === 0 && items.length > 0) {
      panel.renderFilteredEmpty(`No items in ${this.getTimeRangeLabel()}`);
      return;
    }
    panel.renderNews(filteredItems);
  }

  applyTimeRangeFilterToNewsPanels(): void {
    Object.entries(this.ctx.newsStore.newsByCategory).forEach(([category, items]) => {
      this.renderNewsForCategory(category, items);
    });
  }

  applyTimeRangeFilterDebounced(): void {
    (this.applyTimeRangeFilterToNewsPanelsDebounced as ReturnType<typeof debounce> & { (): void })();
  }

  private getStaleNewsItems(category: string): NewsItem[] {
    const staleItems = this.ctx.newsStore.newsByCategory[category];
    if (!Array.isArray(staleItems) || staleItems.length === 0) return [];
    return [...staleItems].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  }

  private selectLimitedFeeds<T>(feeds: T[], maxFeeds: number): T[] {
    if (feeds.length <= maxFeeds) return feeds;
    return feeds.slice(0, maxFeeds);
  }

  private isPanelEnabled(key: string): boolean {
    return this.ctx.panelSettings[key]?.enabled === true;
  }

  private isMapLayerEnabled(layer: keyof MapLayers): boolean {
    return this.ctx.uiStore.mapLayers[layer] === true;
  }

  private isNewsPanelEnabled(category: string): boolean {
    return this.isPanelEnabled(category) || this.isPanelEnabled(`${category}-news`);
  }

  hasActiveNewsConsumer(): boolean {
    return Object.keys(this.ctx.newsPanels).some((category) => this.isNewsPanelEnabled(category))
      || this.isPanelEnabled('insights')
      || this.isPanelEnabled('monitors')
      || this.isMapLayerEnabled('conflicts')
      || this.isMapLayerEnabled('hotspots')
      || (this.ctx.countryBriefPage?.isVisible?.() ?? false)
      || (this.ctx.findingPanel?.isVisible?.() ?? false);
  }

  private async loadNewsCategory(category: string, feeds: typeof FEEDS.politics, digest?: ListFeedDigestResponse | null): Promise<NewsItem[]> {
    try {
      const panel = this.ctx.newsPanels[category];

      // Merge custom feeds for this category (type 'rss' or 'x')
      const customFeedsForCategory = (this.ctx.uiStore.customFeeds || [])
        .filter(f => f.category === category && (f.type === 'rss' || f.type === 'x'))
        .map(f => ({ name: f.name, url: f.url }));

      const allFeeds = [...(feeds ?? []), ...customFeedsForCategory];
      const enabledFeeds = allFeeds.filter(f => !this.ctx.uiStore.disabledSources.has(f.name));
      if (enabledFeeds.length === 0) {
        delete this.ctx.newsStore.newsByCategory[category];
        if (panel) panel.showError(t('common.allSourcesDisabled'));
        this.ctx.statusPanel?.updateFeed(category.charAt(0).toUpperCase() + category.slice(1), {
          status: 'ok',
          itemCount: 0,
        });
        return [];
      }
      const enabledNames = new Set(enabledFeeds.map(f => f.name));

      if (digest?.categories && category in digest.categories) {
        let items = (digest.categories[category]?.items ?? [])
          .map(protoItemToNewsItem)
          .filter(i => enabledNames.has(i.source));

        ingestHeadlines(items.map(i => ({ title: i.title, pubDate: i.pubDate, source: i.source, link: i.link, imageUrl: i.imageUrl })));

        const aiCandidates = items
          .filter(i => i.threat?.source === 'keyword')
          .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
          .slice(0, AI_CLASSIFY_MAX_PER_FEED);
        for (const item of aiCandidates) {
          if (!canQueueAiClassification(item.title)) continue;
          classifyWithAI(item.title, SITE_VARIANT).then(ai => {
            if (ai && item.threat && ai.confidence > item.threat.confidence) {
              item.threat = ai;
              item.isAlert = ai.level === 'critical' || ai.level === 'high';
            }
          }).catch(() => {});
        }

        checkBatchForBreakingAlerts(items);
        this.deps.flashMapForNews(items);
        this.renderNewsForCategory(category, items);

        this.ctx.statusPanel?.updateFeed(category.charAt(0).toUpperCase() + category.slice(1), {
          status: 'ok',
          itemCount: items.length,
        });

        if (panel) {
          try {
            const baseline = await updateBaseline(`news:${category}`, items.length);
            const deviation = calculateDeviation(items.length, baseline);
            panel.setDeviation(deviation.zScore, deviation.percentChange, deviation.level);
          } catch (e) { console.warn(`[Baseline] news:${category} write failed:`, e); }
        }

        return items;
      }

      const renderIntervalMs = 100;
      let lastRenderTime = 0;
      let renderTimeout: ReturnType<typeof setTimeout> | null = null;
      let pendingItems: NewsItem[] | null = null;

      const flushPendingRender = () => {
        if (!pendingItems) return;
        this.renderNewsForCategory(category, pendingItems);
        pendingItems = null;
        lastRenderTime = Date.now();
      };

      const scheduleRender = (partialItems: NewsItem[]) => {
        if (!panel) return;
        pendingItems = partialItems;
        const elapsed = Date.now() - lastRenderTime;
        if (elapsed >= renderIntervalMs) {
          if (renderTimeout) {
            clearTimeout(renderTimeout);
            renderTimeout = null;
          }
          flushPendingRender();
          return;
        }

        if (!renderTimeout) {
          renderTimeout = setTimeout(() => {
            renderTimeout = null;
            flushPendingRender();
          }, renderIntervalMs - elapsed);
        }
      };

      const staleItems = this.getStaleNewsItems(category).filter(i => enabledNames.has(i.source));
      if (staleItems.length > 0) {
        console.warn(`[News] Digest missing for "${category}", serving stale headlines (${staleItems.length})`);
        this.renderNewsForCategory(category, staleItems);
        this.ctx.statusPanel?.updateFeed(category.charAt(0).toUpperCase() + category.slice(1), {
          status: 'ok',
          itemCount: staleItems.length,
        });
        return staleItems;
      }

      const perFeedFallbackEnabled = isFeatureEnabled('newsPerFeedFallback');
      if (!perFeedFallbackEnabled) {
        console.warn(`[News] Digest missing for "${category}", limited per-feed fallback disabled`);
        this.renderNewsForCategory(category, []);
        this.ctx.statusPanel?.updateFeed(category.charAt(0).toUpperCase() + category.slice(1), {
          status: 'error',
          errorMessage: 'Digest unavailable',
        });
        return [];
      }

      const perFeedFallbackCategoryFeedLimit = 3;
      const perFeedFallbackBatchSize = 2;
      const fallbackFeeds = this.selectLimitedFeeds(enabledFeeds, perFeedFallbackCategoryFeedLimit);
      if (fallbackFeeds.length < enabledFeeds.length) {
        console.warn(`[News] Digest missing for "${category}", using limited per-feed fallback (${fallbackFeeds.length}/${enabledFeeds.length} feeds)`);
      } else {
        console.warn(`[News] Digest missing for "${category}", using per-feed fallback (${fallbackFeeds.length} feeds)`);
      }

      const items = await fetchCategoryFeeds(fallbackFeeds, {
        batchSize: perFeedFallbackBatchSize,
        onBatch: (partialItems) => {
          scheduleRender(partialItems);
          this.deps.flashMapForNews(partialItems);
          checkBatchForBreakingAlerts(partialItems);
        },
      });

      this.renderNewsForCategory(category, items);
      if (panel) {
        if (renderTimeout) {
          clearTimeout(renderTimeout);
          renderTimeout = null;
          pendingItems = null;
        }

        if (items.length === 0) {
          const failures = getFeedFailures();
          const failedFeeds = fallbackFeeds.filter(f => failures.has(f.name));
          if (failedFeeds.length > 0) {
            const names = failedFeeds.map(f => f.name).join(', ');
            panel.showError(`${t('common.noNewsAvailable')} (${names} failed)`);
          }
        }

        try {
          const baseline = await updateBaseline(`news:${category}`, items.length);
          const deviation = calculateDeviation(items.length, baseline);
          panel.setDeviation(deviation.zScore, deviation.percentChange, deviation.level);
        } catch (e) { console.warn(`[Baseline] news:${category} write failed:`, e); }
      }

      this.ctx.statusPanel?.updateFeed(category.charAt(0).toUpperCase() + category.slice(1), {
        status: 'ok',
        itemCount: items.length,
      });
      this.ctx.statusPanel?.updateApi('RSS2JSON', { status: 'ok' });

      return items;
    } catch (error) {
      this.ctx.statusPanel?.updateFeed(category.charAt(0).toUpperCase() + category.slice(1), {
        status: 'error',
        errorMessage: String(error),
      });
      this.ctx.statusPanel?.updateApi('RSS2JSON', { status: 'error' });
      delete this.ctx.newsStore.newsByCategory[category];
      return [];
    }
  }

  async loadNews(): Promise<void> {
    if (SITE_VARIANT === 'happy') {
      this.ctx.newsStore.setHappyAllItems([]);
    }

    const digestPromise = this.deps.tryFetchDigest?.();

    const categories = Object.entries(FEEDS)
      .filter((entry): entry is [string, typeof FEEDS[keyof typeof FEEDS]] => Array.isArray(entry[1]) && entry[1].length > 0)
      .map(([key, feeds]) => ({ key, feeds }));

    const digest = await digestPromise;

    const maxCategoryConcurrency = SITE_VARIANT === 'tech' ? 4 : 5;
    const categoryConcurrency = Math.max(1, Math.min(maxCategoryConcurrency, categories.length));
    const categoryResults: PromiseSettledResult<NewsItem[]>[] = [];
    for (let i = 0; i < categories.length; i += categoryConcurrency) {
      const chunk = categories.slice(i, i + categoryConcurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map(({ key, feeds }) => this.loadNewsCategory(key, feeds, digest))
      );
      categoryResults.push(...chunkResults);
    }

    const collectedNews: NewsItem[] = [];
    categoryResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const items = result.value;
        if (SITE_VARIANT === 'happy') {
          for (const item of items) {
            item.happyCategory = classifyNewsItem(item.source, item.title);
          }
          this.ctx.newsStore.setHappyAllItems(this.ctx.newsStore.happyAllItems.concat(items));
        }
        // Exclude secFilings from clustering/insights — they are regulatory form
        // submissions, not news stories, and have their own dedicated panel flow.
        if (categories[idx]?.key !== 'secFilings') {
          collectedNews.push(...items);
        }
      } else {
        console.error(`[App] News category ${categories[idx]?.key} failed:`, result.reason);
      }
    });

    if (SITE_VARIANT === 'full') {
      const perFeedFallbackIntelFeedLimit = 6;
      const perFeedFallbackBatchSize = 2;
      const enabledIntelSources = INTEL_SOURCES.filter(f => !this.ctx.uiStore.disabledSources.has(f.name));
      const enabledIntelNames = new Set(enabledIntelSources.map(f => f.name));
      const intelPanel = this.ctx.newsPanels['intel'];
      if (enabledIntelSources.length === 0) {
        delete this.ctx.newsStore.newsByCategory['intel'];
        if (intelPanel) intelPanel.showError(t('common.allIntelSourcesDisabled'));
        this.ctx.statusPanel?.updateFeed('Intel', { status: 'ok', itemCount: 0 });
      } else if (digest?.categories && 'intel' in digest.categories) {
        const intel = (digest.categories['intel']?.items ?? [])
          .map(protoItemToNewsItem)
          .filter((i: NewsItem) => enabledIntelNames.has(i.source));
        checkBatchForBreakingAlerts(intel);
        this.renderNewsForCategory('intel', intel);
        if (intelPanel) {
          try {
            const baseline = await updateBaseline('news:intel', intel.length);
            const deviation = calculateDeviation(intel.length, baseline);
            intelPanel.setDeviation(deviation.zScore, deviation.percentChange, deviation.level);
          } catch (e) { console.warn('[Baseline] news:intel write failed:', e); }
        }
        this.ctx.statusPanel?.updateFeed('Intel', { status: 'ok', itemCount: intel.length });
        collectedNews.push(...intel);
        this.deps.flashMapForNews(intel);
      } else {
        const staleIntel = this.getStaleNewsItems('intel').filter(i => enabledIntelNames.has(i.source));
        if (staleIntel.length > 0) {
          console.warn(`[News] Intel digest missing, serving stale headlines (${staleIntel.length})`);
          this.renderNewsForCategory('intel', staleIntel);
          if (intelPanel) {
            try {
              const baseline = await updateBaseline('news:intel', staleIntel.length);
              const deviation = calculateDeviation(staleIntel.length, baseline);
              intelPanel.setDeviation(deviation.zScore, deviation.percentChange, deviation.level);
            } catch (e) { console.warn('[Baseline] news:intel write failed:', e); }
          }
          this.ctx.statusPanel?.updateFeed('Intel', { status: 'ok', itemCount: staleIntel.length });
          collectedNews.push(...staleIntel);
        } else if (!isFeatureEnabled('newsPerFeedFallback')) {
          console.warn('[News] Intel digest missing, limited per-feed fallback disabled');
          delete this.ctx.newsStore.newsByCategory['intel'];
          this.ctx.statusPanel?.updateFeed('Intel', { status: 'error', errorMessage: 'Digest unavailable' });
        } else {
          const fallbackIntelFeeds = this.selectLimitedFeeds(enabledIntelSources, perFeedFallbackIntelFeedLimit);
          if (fallbackIntelFeeds.length < enabledIntelSources.length) {
            console.warn(`[News] Intel digest missing, using limited per-feed fallback (${fallbackIntelFeeds.length}/${enabledIntelSources.length} feeds)`);
          }

          const intelResult = await Promise.allSettled([
            fetchCategoryFeeds(fallbackIntelFeeds, { batchSize: perFeedFallbackBatchSize }),
          ]);
          if (intelResult[0]?.status === 'fulfilled') {
            const intel = intelResult[0].value;
            checkBatchForBreakingAlerts(intel);
            this.renderNewsForCategory('intel', intel);
            if (intelPanel) {
              try {
                const baseline = await updateBaseline('news:intel', intel.length);
                const deviation = calculateDeviation(intel.length, baseline);
                intelPanel.setDeviation(deviation.zScore, deviation.percentChange, deviation.level);
              } catch (e) { console.warn('[Baseline] news:intel write failed:', e); }
            }
            this.ctx.statusPanel?.updateFeed('Intel', { status: 'ok', itemCount: intel.length });
            collectedNews.push(...intel);
            this.deps.flashMapForNews(intel);
          } else {
            delete this.ctx.newsStore.newsByCategory['intel'];
            console.error('[App] Intel feed failed:', intelResult[0]?.reason);
          }
        }
      }
    }

    this.ctx.newsStore.setAllNews(collectedNews);
    this.ctx.uiStore.setInitialLoadComplete(true);

    this.ctx.mapStore.map?.updateHotspotActivity(this.ctx.newsStore.allNews);

    this.deps.callPanel('monitors', 'renderResults', this.ctx.newsStore.allNews);

    try {
      this.ctx.intelligenceStore.setClusters(mlWorker.isAvailable
        ? await clusterNewsHybrid(this.ctx.newsStore.allNews)
        : await (await import('@/services/analysis-worker')).analysisWorker.clusterNews(this.ctx.newsStore.allNews));

      const insightsPanel = this.ctx.panels['insights'] as import('@/components').InsightsPanel | undefined;
      insightsPanel?.updateInsights(this.ctx.intelligenceStore.latestClusters);

      const geoLocated = this.ctx.intelligenceStore.latestClusters
        .filter((c): c is typeof c & { lat: number; lon: number } => c.lat != null && c.lon != null)
        .map(c => ({
          lat: c.lat,
          lon: c.lon,
          title: c.primaryTitle,
          threatLevel: c.threat?.level ?? 'info',
          timestamp: c.lastUpdated,
        }));
      if (geoLocated.length > 0) {
        this.ctx.mapStore.map?.setNewsLocations(geoLocated);
      }
    } catch (error) {
      console.error('[App] Clustering failed, clusters unchanged:', error);
      const insightsPanel = this.ctx.panels['insights'] as import('@/components').InsightsPanel | undefined;
      insightsPanel?.updateInsights([]);
    }

    if (SITE_VARIANT === 'happy') {
      await this.loadHappySupplementaryAndRender();
      await Promise.allSettled([
        this.ctx.uiStore.mapLayers.positiveEvents ? this.loadPositiveEvents() : Promise.resolve(),
        this.ctx.uiStore.mapLayers.kindness ? Promise.resolve(this.loadKindnessData()) : Promise.resolve(),
      ]);
    }
  }

  private async loadHappySupplementaryAndRender(): Promise<void> {
    const curated = [...this.ctx.newsStore.happyAllItems];
    this.deps.callPanel('positive-feed', 'renderPositiveNews', curated);

    let supplementary: NewsItem[] = [];
    try {
      const gdeltTopics = await fetchAllPositiveTopicIntelligence();
      const gdeltItems: NewsItem[] = gdeltTopics.flatMap(topic =>
        topic.articles.map(article => ({
          source: 'GDELT',
          title: article.title,
          link: article.url,
          pubDate: article.date ? new Date(article.date) : new Date(),
          isAlert: false,
          imageUrl: article.image || undefined,
          happyCategory: classifyNewsItem('GDELT', article.title),
        }))
      );

      supplementary = await filterBySentiment(gdeltItems);
    } catch (err) {
      console.warn('[App] Happy supplementary pipeline failed, using curated only:', err);
    }

    if (supplementary.length > 0) {
      const merged = [...curated, ...supplementary];
      merged.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
      this.deps.callPanel('positive-feed', 'renderPositiveNews', merged);
    }

    const scienceSources = ['GNN Science', 'ScienceDaily', 'Nature News', 'Live Science', 'New Scientist', 'Singularity Hub', 'Human Progress', 'Greater Good (Berkeley)'];
    const scienceItems = this.ctx.newsStore.happyAllItems.filter(item =>
      scienceSources.includes(item.source) || item.happyCategory === 'science-health'
    );
    this.deps.callPanel('breakthroughs', 'setItems', scienceItems);

    const heroItem = this.ctx.newsStore.happyAllItems
      .filter(item => item.happyCategory === 'humanity-kindness')
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())[0];
    this.deps.callPanel('spotlight', 'setHeroStory', heroItem);

    const digestItems = [...this.ctx.newsStore.happyAllItems]
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
      .slice(0, 5);
    this.deps.callPanel('digest', 'setStories', digestItems);

    setPersistentCache(
      'happy-all-items',
      this.ctx.newsStore.happyAllItems.map(item => ({ ...item, pubDate: item.pubDate.getTime() }))
    ).catch(() => {});
  }

  private static readonly HAPPY_ITEMS_CACHE_KEY = 'happy-all-items';

  async hydrateHappyPanelsFromCache(): Promise<void> {
    try {
      type CachedItem = Omit<NewsItem, 'pubDate'> & { pubDate: number };
      const entry = await getPersistentCache<CachedItem[]>(NewsClusteringPipeline.HAPPY_ITEMS_CACHE_KEY);
      if (!entry || !entry.data || entry.data.length === 0) return;
      if (Date.now() - entry.updatedAt > 24 * 60 * 60 * 1000) return;

      const items: NewsItem[] = entry.data.map(item => ({
        ...item,
        pubDate: new Date(item.pubDate),
      }));

      const scienceSources = ['GNN Science', 'ScienceDaily', 'Nature News', 'Live Science', 'New Scientist', 'Singularity Hub', 'Human Progress', 'Greater Good (Berkeley)'];
      this.deps.callPanel('breakthroughs', 'setItems',
        items.filter(item => scienceSources.includes(item.source) || item.happyCategory === 'science-health')
      );
      this.deps.callPanel('spotlight', 'setHeroStory',
        items.filter(item => item.happyCategory === 'humanity-kindness')
          .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())[0]
      );
      this.deps.callPanel('digest', 'setStories',
        [...items].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime()).slice(0, 5)
      );
      this.deps.callPanel('positive-feed', 'renderPositiveNews', items);
    } catch (err) {
      console.warn('[App] Happy panel cache hydration failed:', err);
    }
  }

  private async loadPositiveEvents(): Promise<void> {
    const hydrated = getHydratedData('positiveGeoEvents') as { events?: Array<{ latitude: number; longitude: number; name: string; category: string; count: number; timestamp: number }> } | undefined;
    let gdeltEvents: PositiveGeoEvent[];
    if (hydrated?.events?.length) {
      gdeltEvents = hydrated.events.map(e => ({
        lat: e.latitude, lon: e.longitude, name: e.name,
        category: (e.category || 'humanity-kindness') as HappyContentCategory,
        count: e.count, timestamp: e.timestamp,
      }));
    } else {
      gdeltEvents = await fetchPositiveGeoEvents();
    }
    const rssEvents = geocodePositiveNewsItems(
      this.ctx.newsStore.happyAllItems.map(item => ({
        title: item.title,
        category: item.happyCategory,
      }))
    );
    const seen = new Set<string>();
    const merged = [...gdeltEvents, ...rssEvents].filter(e => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });
    this.ctx.mapStore.map?.setPositiveEvents(merged);
  }

  private loadKindnessData(): void {
    const kindnessItems = fetchKindnessData(
      this.ctx.newsStore.happyAllItems.map(item => ({
        title: item.title,
        happyCategory: item.happyCategory,
      }))
    );
    this.ctx.mapStore.map?.setKindnessData(kindnessItems);
  }

  async loadProgressData(): Promise<void> {
    const datasets = await fetchProgressData();
    this.deps.callPanel('progress', 'setData', datasets);
  }

  async loadSpeciesData(): Promise<void> {
    const species = await fetchConservationWins();
    this.deps.callPanel('species', 'setData', species);
    this.ctx.mapStore.map?.setSpeciesRecoveryZones(species);
    if (SITE_VARIANT === 'happy' && species.length > 0) {
      checkMilestones({
        speciesRecoveries: species.map(s => ({ name: s.commonName, status: s.recoveryStatus })),
        newSpeciesCount: species.length,
      });
    }
  }

  async loadRenewableData(): Promise<void> {
    const data = await fetchRenewableEnergyData();
    this.deps.callPanel('renewable', 'setData', data);
    if (data.gridCarbon?.status === 'unavailable') {
      dataFreshness.recordError('renewable_mix', data.gridCarbon.message ?? 'Grid carbon snapshot unavailable');
    } else if (data.gridCarbon) {
      dataFreshness.recordUpdate('renewable_mix', 1);
    }
    if (SITE_VARIANT === 'happy' && data?.globalPercentage) {
      checkMilestones({
        renewablePercent: data.globalPercentage,
      });
    }
    try {
      const capacity = await fetchEnergyCapacity();
      this.deps.callPanel('renewable', 'setCapacityData', capacity);
    } catch {
      // EIA failure does not break the existing World Bank gauge
    }
  }

  async loadHappinessMap(): Promise<void> {
    const data = await fetchHappinessScores();
    this.ctx.mapStore.map?.setHappinessScores(data);
  }

  async loadRenewableMap(): Promise<void> {
    const installations = await fetchRenewableInstallations();
    this.ctx.mapStore.map?.setRenewableInstallations(installations);
  }

  async loadGivingData(): Promise<void> {
    const givingResult = await fetchGivingSummary();
    if (!givingResult.ok) {
      dataFreshness.recordError('giving', 'Giving data unavailable (retaining prior state)');
      return;
    }
    const data = givingResult.data;
    this.deps.callPanel('giving', 'setData', data);
    if (data.platforms.length > 0) dataFreshness.recordUpdate('giving', data.platforms.length);
  }
}
