import type { AppContext, AppModule } from '@/app/app-context';
import { enqueuePanelCall } from '@/app/pending-panel-data';
import type { NewsItem, MapLayers } from '@/types';
import type { TimeRange } from '@/components';
import { SITE_VARIANT, LAYER_TO_SOURCE } from '@/config';
import { isOutagesConfigured, isAisConfigured } from '@/services';
import { signalAggregator } from '@/services/signal-aggregator';
import { supplementalBus } from '@/services/supplemental-signal-bus';
import { consumeServerAnomalies, fetchLiveAnomalies } from '@/services/temporal-baseline';
import { createSupplementalAlert } from '@/services/cross-module-integration';
import { ingestTemporalAnomaliesForCII, hasIntelligenceSignalsLoaded, calculateCII } from '@/services/country-instability';
import { fetchCachedRiskScores, getPersistedLiveCountryScores, savePersistedLiveCountryScores } from '@/services/cached-risk-scores';
import { dataFreshness, type DataSourceId } from '@/services/data-freshness';
import { stopOrefPolling } from '@/services/oref-alerts';
import { debounce } from '@/utils';
import { isLocalDevTaskEnabled } from '@/services/local-dev-stability';
import { getAiFlowSettings } from '@/services/ai-flow-settings';
import { getCurrentLanguage } from '@/services/i18n';
import type { ListFeedDigestResponse } from '@/generated/client/worldmonitor/news/v1/service_client';
import type { NewsClusteringPipeline } from './news-clustering-pipeline';
import type { SignalPublisher } from './signal-publisher';
import type { DataRenderer } from './data-renderer';
import type { TheaterPostureSummary } from '@/services/military-surge';
import { MonitorPanel, CIIPanel, TechReadinessPanel } from '@/components';
import { fetchGivingSummary } from '@/services/giving';
import { fetchHappinessScores } from '@/services/happiness-data';
import { fetchRenewableInstallations } from '@/services/renewable-installations';
import { getPersistentCache, setPersistentCache } from '@/services/persistent-cache';
import { dataTaskScheduler } from './data-task-scheduler';

const NEWS_REFRESH_SWEEP_EVENT = 'wm:news-refresh-sweep';

export interface DataLoaderCallbacks {
  renderCriticalBanner: (postures: TheaterPostureSummary[]) => void;
  refreshOpenCountryBrief: () => void;
  newsPipeline?: NewsClusteringPipeline;
  signalPublisher?: SignalPublisher;
  dataRenderer?: DataRenderer;
}

export class DataLoaderManager implements AppModule {
  private ctx: AppContext;
  private callbacks: DataLoaderCallbacks;

  private mapFlashCache: Map<string, number> = new Map();
  private readonly MAP_FLASH_COOLDOWN_MS = 10 * 60 * 1000;
  private readonly applyTimeRangeFilterToNewsPanelsDebounced = debounce(() => {
    this.applyTimeRangeFilterToNewsPanels();
  }, 120);
  private readonly debouncedRefreshCiiAndBrief = debounce((...args: unknown[]) => {
    const [forceLocal = false] = args as [boolean?];
    this.refreshCiiAndBriefInternal(forceLocal);
  }, 500);

  private lastIntelligenceFetch: Record<string, number> = {};
  private readonly STATIC_DATA_STALENESS_MS = 60 * 60 * 1000;
  private readonly DYNAMIC_DATA_STALENESS_MS = 15 * 60 * 1000;

  public shouldFetchIntelligenceSource(source: string, isStatic = false): boolean {
    const lastFetch = this.lastIntelligenceFetch[source] ?? 0;
    const staleness = isStatic ? this.STATIC_DATA_STALENESS_MS : this.DYNAMIC_DATA_STALENESS_MS;
    return (Date.now() - lastFetch) >= staleness;
  }

  public markIntelligenceSourceFetched(source: string): void {
    this.lastIntelligenceFetch[source] = Date.now();
  }

  public updateSearchIndex: () => void = () => {};

  private callPanel(key: string, method: string, ...args: unknown[]): void {
    const panel = this.ctx.panels[key];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = panel as any;
    if (obj && typeof obj[method] === 'function') {
      obj[method](...args);
      return;
    }
    enqueuePanelCall(key, method, args);
  }

  private boundMarketWatchlistHandler: (() => void) | null = null;

  private digestBreaker = { state: 'closed' as 'closed' | 'open' | 'half-open', failures: 0, cooldownUntil: 0 };
  private readonly digestRequestTimeoutMs = 8000;
  private readonly digestBreakerCooldownMs = 5 * 60 * 1000;
  private readonly persistedDigestMaxAgeMs = 6 * 60 * 60 * 1000;
  private lastGoodDigest: ListFeedDigestResponse | null = null;
  private digestInFlight: Promise<ListFeedDigestResponse | null> | null = null;
  private digestFailureLogged = false;
  private supplementalListenersWired = false;

  constructor(ctx: AppContext, callbacks: DataLoaderCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  private isPanelEnabled(key: string): boolean {
    return this.ctx.panelSettings[key]?.enabled === true;
  }

  private isMapLayerEnabled(layer: keyof MapLayers): boolean {
    return this.ctx.mapLayers[layer] === true;
  }

  private isNewsPanelEnabled(category: string): boolean {
    return this.isPanelEnabled(category) || this.isPanelEnabled(`${category}-news`);
  }

  public hasActiveNewsConsumer(): boolean {
    return Object.keys(this.ctx.newsPanels).some((category) => this.isNewsPanelEnabled(category))
      || this.isPanelEnabled('insights')
      || this.isPanelEnabled('monitors')
      || this.isMapLayerEnabled('conflicts')
      || this.isMapLayerEnabled('hotspots')
      || (this.ctx.countryBriefPage?.isVisible?.() ?? false)
      || (this.ctx.findingPanel?.isVisible?.() ?? false);
  }

  public hasActiveMarketsConsumer(): boolean {
    return this.isPanelEnabled('markets')
      || this.isPanelEnabled('commodities')
      || this.isPanelEnabled('heatmap')
      || this.isPanelEnabled('crypto');
  }

  public hasActivePredictionConsumer(): boolean {
    return this.isPanelEnabled('polymarket')
      || (this.ctx.predictionBriefPage?.isVisible?.() ?? false);
  }

  public hasActiveEconomicConsumer(): boolean {
    return this.isPanelEnabled('economic');
  }

  public hasActiveTradePolicyConsumer(): boolean {
    return this.isPanelEnabled('trade-policy');
  }

  public hasActiveSupplyChainConsumer(): boolean {
    return this.isPanelEnabled('supply-chain');
  }

  public hasActiveSanctionsConsumer(): boolean {
    return this.isPanelEnabled('sanctions-tracker') || this.isMapLayerEnabled('sanctions');
  }

  public hasActiveSolarWeatherConsumer(): boolean {
    return this.isPanelEnabled('solar-weather');
  }

  public hasActiveFirmsConsumer(): boolean {
    return this.isPanelEnabled('satellite-fires') || this.isMapLayerEnabled('fires');
  }

  public hasActiveCiiConsumer(): boolean {
    return this.isPanelEnabled('cii')
      || this.isMapLayerEnabled('ciiChoropleth')
      || (this.ctx.countryBriefPage?.isVisible?.() ?? false);
  }

  public hasActiveIntelligenceConsumer(): boolean {
    return this.hasActiveCiiConsumer()
      || this.isPanelEnabled('strategic-posture')
      || this.isPanelEnabled('ucdp-events')
      || this.isPanelEnabled('population-exposure')
      || this.isPanelEnabled('oref-sirens')
      || this.isMapLayerEnabled('military')
      || this.isMapLayerEnabled('protests')
      || this.isMapLayerEnabled('ucdpEvents')
      || this.isMapLayerEnabled('displacement')
      || this.isMapLayerEnabled('climate')
      || this.isMapLayerEnabled('gpsJamming')
      || this.isMapLayerEnabled('iranAttacks')
      || (this.ctx.countryBriefPage?.isVisible?.() ?? false);
  }

  public hasActivePizzIntConsumer(): boolean {
    return !!this.ctx.pizzintIndicator;
  }

  init(): void {
    this.boundMarketWatchlistHandler = () => {
      void this.loadMarkets();
    };
    window.addEventListener('wm-market-watchlist-changed', this.boundMarketWatchlistHandler as EventListener);

    if (!this.supplementalListenersWired) {
      this.supplementalListenersWired = true;

      supplementalBus.onEmit((sourceId, signals) => {
        signalAggregator.ingestGeneric(sourceId, signals);
      });

      supplementalBus.onEmit((_sourceId, signals) => {
        signals
          .filter(signal => signal.severity === 'high' || signal.severity === 'critical')
          .slice(0, 12)
          .forEach(signal => {
            createSupplementalAlert(signal);
          });
      });
    }
  }

  destroy(): void {
    this.applyTimeRangeFilterToNewsPanelsDebounced.cancel();
    stopOrefPolling();
    if (this.boundMarketWatchlistHandler) {
      window.removeEventListener('wm-market-watchlist-changed', this.boundMarketWatchlistHandler as EventListener);
      this.boundMarketWatchlistHandler = null;
    }
  }

  private refreshCiiAndBriefInternal(forceLocal = false): void {
    (this.ctx.panels['cii'] as CIIPanel)?.refresh(forceLocal);
    this.callbacks.refreshOpenCountryBrief();
    const scores = calculateCII();
    if (hasIntelligenceSignalsLoaded() && scores.some((score) => score.score > 0)) {
      savePersistedLiveCountryScores(scores);
    }
    this.ctx.map?.setCIIScores(scores.map(s => ({ code: s.code, score: s.score, level: s.level })));
    this.ctx.map?.setLayerReady('ciiChoropleth', scores.length > 0);
  }

  private refreshCiiAndBrief(forceLocal = false): void {
    this.debouncedRefreshCiiAndBrief(forceLocal);
  }

  public async tryFetchDigest(): Promise<ListFeedDigestResponse | null> {
    if (this.digestInFlight) return this.digestInFlight;

    this.digestInFlight = this.tryFetchDigestInternal();
    try {
      return await this.digestInFlight;
    } finally {
      this.digestInFlight = null;
    }
  }

  private async tryFetchDigestInternal(): Promise<ListFeedDigestResponse | null> {
    const now = Date.now();

    if (this.digestBreaker.state === 'open') {
      if (now < this.digestBreaker.cooldownUntil) {
        return this.lastGoodDigest ?? await this.loadPersistedDigest();
      }
      this.digestBreaker.state = 'half-open';
    }

    try {
      const resp = await fetch(
        `/api/news/v1/list-feed-digest?variant=${SITE_VARIANT}&lang=${getCurrentLanguage()}`,
        { signal: AbortSignal.timeout(this.digestRequestTimeoutMs) },
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as ListFeedDigestResponse;
      const catCount = Object.keys(data.categories ?? {}).length;
      console.info(`[News] Digest fetched: ${catCount} categories`);
      this.lastGoodDigest = data;
      this.persistDigest(data);
      this.digestBreaker = { state: 'closed', failures: 0, cooldownUntil: 0 };
      this.digestFailureLogged = false;
      return data;
    } catch (e) {
      if (!this.digestFailureLogged) {
        console.warn('[News] Digest fetch failed, using fallback');
        this.digestFailureLogged = true;
      }
      this.digestBreaker.failures++;
      if (this.digestBreaker.failures >= 2) {
        this.digestBreaker.state = 'open';
        this.digestBreaker.cooldownUntil = now + this.digestBreakerCooldownMs;
      }
      return this.lastGoodDigest ?? await this.loadPersistedDigest();
    }
  }

  private persistDigest(data: ListFeedDigestResponse): void {
    setPersistentCache('digest:last-good', data).catch(() => {});
  }

  private async loadPersistedDigest(): Promise<ListFeedDigestResponse | null> {
    try {
      const envelope = await getPersistentCache<ListFeedDigestResponse>('digest:last-good');
      if (!envelope) return null;
      if (Date.now() - envelope.updatedAt > this.persistedDigestMaxAgeMs) return null;
      this.lastGoodDigest = envelope.data;
      return envelope.data;
    } catch { return null; }
  }

  async loadAllData(): Promise<void> {
    const runGuarded = (name: string, fn: () => Promise<void>, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> => dataTaskScheduler.schedule(name, async () => {
      if (this.ctx.isDestroyed || this.ctx.inFlight.has(name)) return;
      this.ctx.inFlight.add(name);
      try {
        await fn();
      } catch (e) {
        if (!this.ctx.isDestroyed) console.error(`[App] ${name} failed:`, e);
      } finally {
        this.ctx.inFlight.delete(name);
      }
    }, { priority });

    const tasks: Array<{ name: string; task: Promise<void> }> = [
      { name: 'news', task: runGuarded('news', () => this.loadNews(), 'high') },
    ];

    if (SITE_VARIANT !== 'happy') {
      if (isLocalDevTaskEnabled('markets') && this.hasActiveMarketsConsumer()) {
        tasks.push({ name: 'markets', task: runGuarded('markets', () => this.loadMarkets(), 'high') });
      }
    }

    if (SITE_VARIANT === 'happy') {
      tasks.push({
        name: 'happinessMap',
        task: runGuarded('happinessMap', async () => {
          const data = await fetchHappinessScores();
          this.ctx.map?.setHappinessScores(data);
        }),
      });
      tasks.push({
        name: 'renewableMap',
        task: runGuarded('renewableMap', async () => {
          const installations = await fetchRenewableInstallations();
          this.ctx.map?.setRenewableInstallations(installations);
        }),
      });
    }

    if (isLocalDevTaskEnabled('giving')) {
      tasks.push({
        name: 'giving',
        task: runGuarded('giving', async () => {
          const givingResult = await fetchGivingSummary();
          if (!givingResult.ok) {
            dataFreshness.recordError('giving', 'Giving data unavailable (retaining prior state)');
            return;
          }
          const data = givingResult.data;
          this.callPanel('giving', 'setData', data);
          if (data.platforms.length > 0) dataFreshness.recordUpdate('giving', data.platforms.length);
        }, 'low'),
      });
    }

    if (SITE_VARIANT === 'full' && this.hasActiveCiiConsumer()) {
      try {
        let hasStartupCiiRender = false;
        const persistedLiveScores = getPersistedLiveCountryScores().filter((score) => score.score > 0);
        if (persistedLiveScores.length > 0) {
          (this.ctx.panels['cii'] as CIIPanel)?.renderScores(persistedLiveScores);
          this.ctx.map?.setCIIScores(persistedLiveScores.map((s) => ({ code: s.code, score: s.score, level: s.level })));
          this.ctx.map?.setLayerReady('ciiChoropleth', true);
          hasStartupCiiRender = true;
          console.debug('[CII] Rendered persisted live local scores on startup', { count: persistedLiveScores.length });
        }
        const cached = await fetchCachedRiskScores().catch(() => null);
        if (!hasStartupCiiRender && cached && cached.cii.length > 0) {
          (this.ctx.panels['cii'] as CIIPanel)?.renderFromCached(cached);
          this.ctx.map?.setCIIScores(cached.cii.map(s => ({ code: s.code, score: s.score, level: s.level })));
          this.ctx.map?.setLayerReady('ciiChoropleth', true);
        }
      } catch { /* non-fatal */ }
    }

    if (SITE_VARIANT === 'tech') {
      tasks.push({ name: 'techReadiness', task: runGuarded('techReadiness', () => (this.ctx.panels['tech-readiness'] as TechReadinessPanel)?.refresh()) });
    }

    const progressEl = document.getElementById('loading-progress');
    const totalTasks = tasks.length;
    let completedTasks = 0;
    let progressDone = false;

    const dismissProgress = () => {
      if (progressDone || !progressEl) return;
      progressDone = true;
      progressEl.style.width = '100%';
      setTimeout(() => {
        progressEl.style.opacity = '0';
        progressEl.style.transition = 'width 0.4s ease, opacity 0.3s ease';
        setTimeout(() => progressEl.remove(), 300);
      }, 400);
    };

    const trackedTasks = tasks.map(t =>
      t.task.finally(() => {
        completedTasks++;
        if (progressEl && !progressDone) {
          progressEl.style.width = `${Math.round((completedTasks / totalTasks) * 100)}%`;
        }
        if (completedTasks >= totalTasks) dismissProgress();
      }),
    );

    const progressTimeout = setTimeout(dismissProgress, 15_000);

    await Promise.allSettled(trackedTasks);

    clearTimeout(progressTimeout);
    dismissProgress();

    this.updateSearchIndex();

    const bootstrapTemporal = consumeServerAnomalies();
    if (bootstrapTemporal.anomalies.length > 0 || bootstrapTemporal.trackedTypes.length > 0) {
      signalAggregator.ingestTemporalAnomalies(bootstrapTemporal.anomalies, bootstrapTemporal.trackedTypes);
      ingestTemporalAnomaliesForCII(bootstrapTemporal.anomalies);
      this.refreshCiiAndBrief();
    } else {
      if (isLocalDevTaskEnabled('temporalBaseline')) this.refreshTemporalBaseline().catch(() => {});
    }
  }

  async refreshTemporalBaseline(): Promise<void> {
    const { anomalies, trackedTypes } = await fetchLiveAnomalies();
    signalAggregator.ingestTemporalAnomalies(anomalies, trackedTypes);
    ingestTemporalAnomaliesForCII(anomalies);
    this.refreshCiiAndBrief();
  }

  async loadDataForLayer(layer: keyof MapLayers): Promise<void> {
    if (this.ctx.isDestroyed || this.ctx.inFlight.has(layer)) return;
    this.ctx.inFlight.add(layer);
    this.ctx.map?.setLayerLoading(layer, true);
    try {
      const sp = this.callbacks.signalPublisher;
      switch (layer) {
        case 'natural':
          await sp?.loadNatural?.();
          break;
        case 'fires':
          await sp?.loadFirmsData?.();
          break;
        case 'weather':
          await sp?.loadWeatherAlerts?.();
          break;
        case 'outages':
          await sp?.loadOutages?.();
          break;
        case 'cyberThreats':
          await sp?.loadCyberThreats?.();
          break;
        case 'ais':
          await sp?.loadAisSignals?.();
          break;
        case 'cables':
          await Promise.all([sp?.loadCableActivity?.(), sp?.loadCableHealth?.()]);
          break;
        case 'protests':
          await sp?.loadProtests?.();
          break;
        case 'flights':
          await sp?.loadFlightDelays?.();
          break;
        case 'military':
          await sp?.loadMilitary?.();
          break;
        case 'positiveEvents':
          await sp?.loadPositiveEvents?.();
          break;
        case 'kindness':
          sp?.loadKindnessData?.();
          break;
        case 'iranAttacks':
          await sp?.loadIranEvents?.();
          break;
        case 'ucdpEvents':
        case 'displacement':
        case 'climate':
        case 'gpsJamming':
          await sp?.loadIntelligenceSignals?.();
          break;
      }
    } finally {
      this.ctx.inFlight.delete(layer);
      this.ctx.map?.setLayerLoading(layer, false);
    }
  }

  async loadDataForPanel(panelKey: string): Promise<void> {
    if (this.isNewsPanelEnabled(panelKey) || this.ctx.newsPanels[panelKey]) {
      if (this.ctx.isDestroyed || this.ctx.inFlight.has('news')) return;
      this.ctx.inFlight.add('news');
      try {
        await this.loadNews();
      } catch (e) {
        if (!this.ctx.isDestroyed) console.error(`[App] news failed:`, e);
      } finally {
        this.ctx.inFlight.delete('news');
      }
      return;
    }

    switch (panelKey) {
      case 'insights':
      case 'monitors':
      case 'gdelt-intel':
      case 'deduction':
        if (this.ctx.isDestroyed || this.ctx.inFlight.has('news')) return;
        this.ctx.inFlight.add('news');
        try {
          await this.loadNews();
        } catch (e) {
          if (!this.ctx.isDestroyed) console.error(`[App] news failed:`, e);
        } finally {
          this.ctx.inFlight.delete('news');
        }
        return;
      case 'markets':
      case 'commodities':
      case 'heatmap':
      case 'crypto':
        if (this.ctx.isDestroyed || this.ctx.inFlight.has('markets')) return;
        this.ctx.inFlight.add('markets');
        try {
          await this.loadMarkets();
        } catch (e) {
          if (!this.ctx.isDestroyed) console.error(`[App] markets failed:`, e);
        } finally {
          this.ctx.inFlight.delete('markets');
        }
        return;
      case 'tech-readiness': {
        const panel = this.ctx.panels['tech-readiness'] as TechReadinessPanel | undefined;
        await panel?.refresh();
        return;
      }
      default:
        return;
    }
  }

  public flashMapForNews(items: NewsItem[]): void {
    if (!this.ctx.map || !this.ctx.initialLoadComplete) return;
    if (!getAiFlowSettings().mapNewsFlash) return;
    const now = Date.now();
    let freshItemCount = 0;

    for (const [key, timestamp] of this.mapFlashCache.entries()) {
      if (now - timestamp > this.MAP_FLASH_COOLDOWN_MS) {
        this.mapFlashCache.delete(key);
      }
    }

    for (const item of items) {
      const cacheKey = `${item.source}|${item.link || item.title}`;
      const lastSeen = this.mapFlashCache.get(cacheKey);
      if (lastSeen && now - lastSeen < this.MAP_FLASH_COOLDOWN_MS) {
        continue;
      }

      this.mapFlashCache.set(cacheKey, now);
      freshItemCount += 1;
    }

    if (freshItemCount > 0) {
      window.dispatchEvent(new CustomEvent(NEWS_REFRESH_SWEEP_EVENT, {
        detail: { count: Math.min(freshItemCount, 6) },
      }));
    }
  }

  getTimeRangeWindowMs(range: TimeRange): number {
    const ranges: Record<TimeRange, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '48h': 48 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    return ranges[range];
  }

  filterItemsByTimeRange(items: NewsItem[], range: TimeRange = this.ctx.currentTimeRange): NewsItem[] {
    if (range === 'all') return items;
    const cutoff = Date.now() - this.getTimeRangeWindowMs(range);
    return items.filter((item) => {
      const ts = item.pubDate instanceof Date ? item.pubDate.getTime() : new Date(item.pubDate).getTime();
      return Number.isFinite(ts) ? ts >= cutoff : true;
    });
  }

  getTimeRangeLabel(range: TimeRange = this.ctx.currentTimeRange): string {
    const labels: Record<TimeRange, string> = {
      '1h': 'the last hour',
      '6h': 'the last 6 hours',
      '24h': 'the last 24 hours',
      '48h': 'the last 48 hours',
      '7d': 'the last 7 days',
      'all': 'all time',
    };
    return labels[range];
  }

  renderNewsForCategory(category: string, items: NewsItem[]): void {
    this.ctx.newsByCategory[category] = items;
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
    Object.entries(this.ctx.newsByCategory).forEach(([category, items]) => {
      this.renderNewsForCategory(category, items);
    });
  }

  applyTimeRangeFilterDebounced(): void {
    this.applyTimeRangeFilterToNewsPanelsDebounced();
  }

  async loadNews(): Promise<void> {
    if (this.callbacks.newsPipeline) {
      await this.callbacks.newsPipeline.loadNews();
      return;
    }
  }

  async loadMarkets(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadMarkets(); return; }
  }

  async loadSecurityAdvisories(): Promise<void> {
    await this.callbacks.signalPublisher?.loadSecurityAdvisories?.();
  }

  async hydrateHappyPanelsFromCache(): Promise<void> {
    await this.callbacks.newsPipeline?.hydrateHappyPanelsFromCache?.();
  }

  async loadPredictions(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadPredictions(); return; }
  }

  async loadPizzInt(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadPizzInt(); return; }
  }

  async loadFredData(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadFredData(); return; }
  }

  async loadOilAnalytics(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadOilAnalytics(); return; }
  }

  async loadGovernmentSpending(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadGovernmentSpending(); return; }
  }

  async loadBisData(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadBisData(); return; }
  }

  async loadSanctions(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadSanctions(); return; }
  }

  async loadSolarWeather(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadSolarWeather(); return; }
  }

  async loadNatural(): Promise<void> {
    await this.callbacks.signalPublisher?.loadNatural?.();
  }

  async loadWeatherAlerts(): Promise<void> {
    await this.callbacks.signalPublisher?.loadWeatherAlerts?.();
  }

  async loadFirmsData(): Promise<void> {
    await this.callbacks.signalPublisher?.loadFirmsData?.();
  }

  async loadAisSignals(): Promise<void> {
    await this.callbacks.signalPublisher?.loadAisSignals?.();
  }

  async loadCableActivity(): Promise<void> {
    await this.callbacks.signalPublisher?.loadCableActivity?.();
  }

  async loadCableHealth(): Promise<void> {
    await this.callbacks.signalPublisher?.loadCableHealth?.();
  }

  async loadFlightDelays(): Promise<void> {
    await this.callbacks.signalPublisher?.loadFlightDelays?.();
  }

  async loadCyberThreats(): Promise<void> {
    await this.callbacks.signalPublisher?.loadCyberThreats?.();
  }

  async loadTradePolicy(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadTradePolicy(); return; }
  }

  async loadSupplyChain(): Promise<void> {
    if (this.callbacks.dataRenderer) { await this.callbacks.dataRenderer.loadSupplyChain(); return; }
  }

  async loadTelegramIntel(): Promise<void> {
    await this.callbacks.signalPublisher?.loadTelegramIntel?.();
  }

  async loadIntelligenceSignals(): Promise<void> {
    await this.callbacks.signalPublisher?.loadIntelligenceSignals?.();
  }

  async loadMilitary(): Promise<void> {
    await this.callbacks.signalPublisher?.loadMilitary?.();
  }

  async loadProtests(): Promise<void> {
    await this.callbacks.signalPublisher?.loadProtests?.();
  }

  async loadOutages(): Promise<void> {
    await this.callbacks.signalPublisher?.loadOutages?.();
  }

  async loadIranEvents(): Promise<void> {
    await this.callbacks.signalPublisher?.loadIranEvents?.();
  }

  async loadGovernanceBaselines(): Promise<void> {
    await this.callbacks.signalPublisher?.loadGovernanceBaselines?.();
  }

  async loadPositiveEvents(): Promise<void> {
    await this.callbacks.signalPublisher?.loadPositiveEvents?.();
  }

  async loadKindnessData(): Promise<void> {
    this.callbacks.signalPublisher?.loadKindnessData?.();
  }

  waitForAisData(): void {
    this.callbacks.signalPublisher?.waitForAisData?.();
  }

  updateMonitorResults(): void {
    const monitorPanel = this.ctx.panels['monitors'] as MonitorPanel;
    monitorPanel.renderResults(this.ctx.allNews);
  }

  syncDataFreshnessWithLayers(): void {
    for (const [layer, sourceIds] of Object.entries(LAYER_TO_SOURCE)) {
      const enabled = this.ctx.mapLayers[layer as keyof MapLayers] ?? false;
      for (const sourceId of sourceIds) {
        dataFreshness.setEnabled(sourceId as DataSourceId, enabled);
      }
    }

    if (!isAisConfigured()) {
      dataFreshness.setEnabled('ais', false);
    }
    if (isOutagesConfigured() === false) {
      dataFreshness.setEnabled('outages', false);
    }

    dataFreshness.setEnabled('sanctions', SITE_VARIANT !== 'happy');
    dataFreshness.setEnabled('solar_weather', SITE_VARIANT !== 'happy');
    dataFreshness.setEnabled('renewable_mix', SITE_VARIANT === 'happy');
  }
}
