import type { AppContext, AppModule, CountryBriefSignals } from '@/app/app-context';
import type {
  CountryDeepDiveSignalDetails,
} from '@/components/CountryBriefPanel';
import { CountryDeepDivePanel } from '@/components/CountryDeepDivePanel';
import { reverseGeocode } from '@/utils/reverse-geocode';
import { getCountryAtCoordinates, isCoordinateInCountry, nameToCountryCode } from '@/services/country-geometry';
import { TIER1_COUNTRIES } from '@/services/country-instability';
import { getPreferredCountryScore } from '@/services/cached-risk-scores';
import { signalAggregator } from '@/services/signal-aggregator';
import { dataFreshness } from '@/services/data-freshness';
import { collectStoryData } from '@/services/story-data';
import { openStoryModal } from '@/components/StoryModal';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import type { StrategicPosturePanel } from '@/components/StrategicPosturePanel';
import type { NewsItem } from '@/types';
import type { CIIPanel } from '@/components';
import { getCountrySignals } from './signal-aggregator';
import {
  fetchCountryBrief,
  generateFallbackBrief,
  buildFallbackText,
  fetchWithRAGEnhancement,
} from './brief-fetcher';
import {
  buildMilitarySummary,
  buildCiiAvailability,
  buildEconomicIndicators,
  fetchCountryPredictions,
  mountCountryTimeline,
  refreshEconomicForPanel,
  refreshGovernance,
} from './data-loaders';
import {
  resolveCountryName,
  getCountrySearchTerms,
  getOtherCountryTerms,
  firstMentionPosition,
  COUNTRY_BOUNDS,
  COUNTRY_ALIASES,
  getCountryFlagEmoji,
} from './country-utils';
import { trackCountrySelected, trackCountryBriefOpened } from '@/services/analytics';
import { fetchCountryMacroData } from '@/services/economic';

export class CountryIntelManager implements AppModule {
  private ctx: AppContext;
  private briefRequestToken = 0;
  private unsubscribeNewsUpdates: (() => void) | null = null;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  init(): void {
    this.setupCountryIntel();
    this.unsubscribeNewsUpdates = this.ctx.eventBus.on('news:all-updated', () => {
      const page = this.ctx.countryBriefPage;
      const code = page?.getCode();
      const name = page?.getName();
      if (!page?.isVisible() || !code || !name || code === '__loading__' || code === '__error__') return;
      this.refreshNewsForPanel(code, name);
      page.updateSignalDetails?.(this.buildSignalDetails(code, name));
    });
  }

  destroy(): void {
    this.unsubscribeNewsUpdates?.();
    this.unsubscribeNewsUpdates = null;
    this.ctx.countryTimeline?.destroy();
    this.ctx.countryTimeline = null;
    this.ctx.countryBriefPage = null;
  }

  private setupCountryIntel(): void {
    if (!this.ctx.map) return;
    this.ctx.countryBriefPage = new CountryDeepDivePanel(this.ctx.map);
    this.ctx.map.onCountryClicked(async (countryClick) => {
      this.ctx.entityDetailPanel?.hide();
      if (countryClick.code && countryClick.name) {
        trackCountrySelected(countryClick.code, countryClick.name, 'map');
        this.openCountryBriefByCode(countryClick.code, countryClick.name);
      } else {
        this.openCountryBrief(countryClick.lat, countryClick.lon);
      }
    });

    this.ctx.countryBriefPage.onClose(() => {
      this.briefRequestToken++;
      (this.ctx.panels['cii'] as CIIPanel | undefined)?.setActiveCountry(null);
      this.ctx.map?.clearCountryHighlight();
      this.ctx.map?.setRenderPaused(false);
      this.ctx.countryTimeline?.destroy();
      this.ctx.countryTimeline = null;
    });

    this.ctx.countryBriefPage!.onMarketClick((market) => {
      this.ctx.entityDetailPanel?.show('predictionMarket', {
        title: market.title,
        slug: market.slug || '',
        category: 'geopolitics',
        volume: market.volume,
        endDate: market.endDate,
        closed: false,
        url: market.url,
      });
    });
  }

  async openCountryBrief(lat: number, lon: number): Promise<void> {
    if (!this.ctx.countryBriefPage) return;
    const token = ++this.briefRequestToken;
    this.ctx.countryBriefPage.showLoading();
    this.ctx.map?.setRenderPaused(true);

    const localGeo = getCountryAtCoordinates(lat, lon);
    if (localGeo) {
      if (token !== this.briefRequestToken) return;
      this.openCountryBriefByCode(localGeo.code, localGeo.name);
      return;
    }

    const geo = await reverseGeocode(lat, lon);
    if (token !== this.briefRequestToken) return;
    if (!geo) {
      if (this.ctx.countryBriefPage.showGeoError) {
        this.ctx.countryBriefPage.showGeoError(() => this.openCountryBrief(lat, lon));
      } else {
        this.ctx.countryBriefPage.hide();
        this.ctx.map?.setRenderPaused(false);
      }
      return;
    }

    this.openCountryBriefByCode(geo.code, geo.country);
  }

  async openCountryBriefByCode(code: string, country: string, opts?: { maximize?: boolean }): Promise<void> {
    if (!this.ctx.countryBriefPage) return;
    this.ctx.map?.setRenderPaused(true);
    trackCountryBriefOpened(code);

    const canonicalName = TIER1_COUNTRIES[code] || resolveCountryName(code);
    if (canonicalName !== code) country = canonicalName;

    const score = getPreferredCountryScore(code);
    const signals = getCountrySignals(this.ctx, code, country);

    this.ctx.countryBriefPage.show(country, code, score, signals);
    (this.ctx.panels['cii'] as CIIPanel | undefined)?.setActiveCountry(code);
    this.ctx.map?.highlightCountry(code);
    this.ctx.map?.fitCountry(code);

    if (opts?.maximize) {
      requestAnimationFrame(() => {
        const panel = this.ctx.countryBriefPage;
        if (panel?.isVisible() && panel.getCode() === code) {
          panel.maximize?.();
        }
      });
    }

    const ciiAvailability = buildCiiAvailability(code, score);
    if (!ciiAvailability.available) {
      this.ctx.countryBriefPage.updateScore?.(score, signals, ciiAvailability);
    }

    this.ctx.countryBriefPage.updateSignalDetails?.(this.buildSignalDetails(code, country));
    this.ctx.countryBriefPage.updateMilitaryActivity?.(buildMilitarySummary(this.ctx, code, country));
    this.ctx.countryBriefPage.updateEconomicIndicators?.(buildEconomicIndicators(code, score, null));

    fetchCountryMacroData(code).then((cards) => {
      if (this.ctx.countryBriefPage?.getCode() !== code) return;
      this.ctx.countryBriefPage.updateMacroCards?.(cards);
    });

    const marketClient = new MarketServiceClient('', { fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args) });
    const stockPromise = marketClient.getCountryStockIndex({ countryCode: code })
      .then((resp) => ({
        available: resp.available,
        code: resp.code,
        symbol: resp.symbol,
        indexName: resp.indexName,
        price: String(resp.price),
        weekChangePercent: String(resp.weekChangePercent),
        currency: resp.currency,
      }))
      .catch(() => ({ available: false as const, code: '', symbol: '', indexName: '', price: '0', weekChangePercent: '0', currency: '' }));

    stockPromise.then((stock) => {
      if (this.ctx.countryBriefPage?.getCode() !== code) return;
      this.ctx.countryBriefPage.updateStock(stock);
      this.ctx.countryBriefPage.updateEconomicIndicators?.(buildEconomicIndicators(code, score, stock));
    });

    fetchCountryPredictions(this.ctx, code, country);

    this.refreshNewsForPanel(code, country);

    this.ctx.countryBriefPage.updateInfrastructure(code);

    refreshGovernance(this.ctx, code);

    mountCountryTimeline(this.ctx, code, country);

    try {
      const context: Record<string, unknown> = {};
      if (score) {
        context.score = score.score;
        context.level = score.level;
        context.trend = score.trend;
        context.components = score.components;
        context.change24h = score.change24h;
      }
      Object.assign(context, signals);

      const countryCluster = signalAggregator.getCountryClusters().find((c) => c.country === code);
      if (countryCluster) {
        context.convergenceScore = countryCluster.convergenceScore;
        context.signalTypes = [...countryCluster.signalTypes];
      }

      const convergences = signalAggregator.getRegionalConvergence()
        .filter((r) => r.countries.includes(code));
      if (convergences.length) {
        context.regionalConvergence = convergences.map((r) => r.description);
      }

      if (this.ctx.intelligenceCache.advisories) {
        const countryAdvisories = this.ctx.intelligenceCache.advisories.filter(a => a.country === code);
        if (countryAdvisories.length > 0) {
          context.travelAdvisories = countryAdvisories.map(a => ({ source: a.source, level: a.level, title: a.title }));
        }
      }

      const { items: filteredNewsForBrief } = this.getFilteredNewsForCountry(code, country);
      const headlines = filteredNewsForBrief.slice(0, 15).map((n) => n.title);
      if (headlines.length) context.headlines = headlines;
      const briefHeadlines = (context.headlines as string[] | undefined) || [];

      const stockData = await stockPromise;
      if (stockData.available) {
        const pct = parseFloat(stockData.weekChangePercent);
        context.stockIndex = `${stockData.indexName}: ${stockData.price} (${pct >= 0 ? '+' : ''}${stockData.weekChangePercent}% week)`;
      }

      let briefText = '';
      try {
        const contextSnapshot = await fetchWithRAGEnhancement(
          code, country, score, signals, briefHeadlines, context
        );

        briefText = await fetchCountryBrief(this.ctx, code, contextSnapshot);
      } catch { /* server unreachable */ }

      if (briefText) {
        this.ctx.countryBriefPage?.updateBrief({ brief: briefText, country, code });
      } else {
        let fallbackBrief = await generateFallbackBrief(
          this.ctx, country, code, score, signals, briefHeadlines
        );

        if (fallbackBrief) {
          this.ctx.countryBriefPage?.updateBrief({ brief: fallbackBrief, country, code, fallback: true });
        } else {
          const fallbackText = buildFallbackText(country, code, score, signals, briefHeadlines, context);
          if (fallbackText.length > 0) {
            this.ctx.countryBriefPage?.updateBrief({ brief: fallbackText, country, code, fallback: true });
          } else {
            this.ctx.countryBriefPage?.updateBrief({ brief: '', country, code, error: 'No AI service available. Configure GROQ_API_KEY in Settings for full briefs.' });
          }
        }
      }
    } catch (err) {
      console.error('[CountryBrief] fetch error:', err);
      this.ctx.countryBriefPage?.updateBrief({ brief: '', country, code, error: 'Failed to generate brief' });
    }
  }

  refreshOpenBrief(): void {
    const page = this.ctx.countryBriefPage;
    if (!page?.isVisible()) return;
    const code = page.getCode();
    if (!code || code === '__loading__' || code === '__error__') return;
    const name = TIER1_COUNTRIES[code] ?? resolveCountryName(code);
    const score = getPreferredCountryScore(code);
    const signals = getCountrySignals(this.ctx, code, name);
    const ciiAvailability = buildCiiAvailability(code, score);
    page.updateScore?.(score, signals, ciiAvailability.available ? undefined : ciiAvailability);
    page.updateSignalDetails?.(this.buildSignalDetails(code, name));
    page.updateMilitaryActivity?.(buildMilitarySummary(this.ctx, code, name));
    mountCountryTimeline(this.ctx, code, name);
    this.refreshNewsForPanel(code, name);
    refreshEconomicForPanel(this.ctx, code, score);
    console.debug('[CountryBrief] Refreshed open brief', {
      code,
      score: score?.score ?? null,
      protests: signals.protests,
      militaryFlights: signals.militaryFlights,
      militaryVessels: signals.militaryVessels,
      conflictEvents: signals.conflictEvents,
      activeStrikes: signals.activeStrikes,
    });
  }

  private buildSignalDetails(code: string, country: string): CountryDeepDiveSignalDetails {
    const cluster = signalAggregator.getCountryClusters().find((entry) => entry.country === code);
    if (!cluster) {
      const signals = getCountrySignals(this.ctx, code, country);
      const { items } = this.getFilteredNewsForCountry(code, country);
      return {
        critical: signals.activeStrikes + signals.criticalNews,
        high: signals.protests + signals.militaryFlights + signals.militaryVessels + signals.cyberThreats,
        medium: signals.outages + signals.aisDisruptions + signals.aviationDisruptions + signals.gpsJammingHexes,
        low: signals.earthquakes + signals.temporalAnomalies + signals.satelliteFires,
        recentHigh: items
          .filter((item) => this.newsSeverityRank(item) >= 4)
          .slice(0, 3)
          .map((item) => ({
            type: item.threat?.category === 'cyber' ? 'CYBER' : 'OTHER',
            severity: this.toSignalSeverity(item),
            description: item.title,
            timestamp: new Date(item.pubDate),
          })),
      };
    }

    const details: CountryDeepDiveSignalDetails = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      recentHigh: [],
    };

    const rankedSignals = [...cluster.signals]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    for (const signal of rankedSignals) {
      const severity = this.normalizeSignalSeverity(signal.type, signal.severity);
      if (severity === 'critical') details.critical += 1;
      else if (severity === 'high') details.high += 1;
      else if (severity === 'medium') details.medium += 1;
      else details.low += 1;
    }

    details.recentHigh = rankedSignals
      .map((signal) => ({
        type: this.mapSignalType(signal.type),
        severity: this.normalizeSignalSeverity(signal.type, signal.severity),
        description: signal.title,
        timestamp: signal.timestamp,
      }))
      .filter((signal) => signal.severity === 'critical' || signal.severity === 'high')
      .slice(0, 3);

    return details;
  }

  private mapSignalType(type: string): CountryDeepDiveSignalDetails['recentHigh'][number]['type'] {
    if (type === 'military_flight' || type === 'military_vessel') return 'MILITARY';
    if (type === 'protest') return 'PROTEST';
    if (type === 'internet_outage') return 'OUTAGE';
    if (type === 'satellite_fire') return 'DISASTER';
    if (type === 'ais_disruption') return 'OUTAGE';
    if (type === 'active_strike') return 'MILITARY';
    if (type === 'temporal_anomaly') return 'CYBER';
    return 'OTHER';
  }

  private normalizeSignalSeverity(
    type: string,
    severity: 'low' | 'medium' | 'high',
  ): CountryDeepDiveSignalDetails['recentHigh'][number]['severity'] {
    if (type === 'active_strike' && severity === 'high') return 'critical';
    if (severity === 'high') return 'high';
    if (severity === 'medium') return 'medium';
    return 'low';
  }

  openCountryStory(code: string, name: string): void {
    if (!dataFreshness.hasSufficientData() || this.ctx.latestClusters.length === 0) {
      this.showToast('Data still loading — try again in a moment');
      return;
    }
    const posturePanel = this.ctx.panels['strategic-posture'] as StrategicPosturePanel | undefined;
    const postures = posturePanel?.getPostures() || [];
    const signals = getCountrySignals(this.ctx, code, name);
    const cluster = signalAggregator.getCountryClusters().find(c => c.country === code);
    const regional = signalAggregator.getRegionalConvergence().filter(r => r.countries.includes(code));
    const convergence = cluster ? {
      score: cluster.convergenceScore,
      signalTypes: [...cluster.signalTypes],
      regionalDescriptions: regional.map(r => r.description),
    } : null;
    const data = collectStoryData(code, name, this.ctx.latestClusters, postures, this.ctx.latestPredictions, signals, convergence);
    openStoryModal(data);
  }

  showToast(msg: string): void {
    document.querySelector('.toast-notification')?.remove();
    const el = document.createElement('div');
    el.className = 'toast-notification';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 3000);
  }

  getCountrySignals(code: string, country: string): CountryBriefSignals {
    return getCountrySignals(this.ctx, code, country);
  }

  getFilteredNewsForCountry(code: string, country: string): { items: NewsItem[]; hasDirectCoverage: boolean } {
    const searchTerms = getCountrySearchTerms(country, code);
    if (searchTerms.length === 0) return { items: [], hasDirectCoverage: false };

    const otherCountryTerms = getOtherCountryTerms(code);
    const allNews = this.getAllNews();

    const directItems = allNews
      .filter((n) => {
        const titleLower = n.title.toLowerCase();
        const ourPos = firstMentionPosition(titleLower, searchTerms);
        const otherPos = firstMentionPosition(titleLower, otherCountryTerms);
        return ourPos !== Infinity && (otherPos === Infinity || ourPos <= otherPos);
      })
      .sort((a, b) => {
        const severityDelta = this.newsSeverityRank(b) - this.newsSeverityRank(a);
        if (severityDelta !== 0) return severityDelta;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      });

    return { items: directItems.slice(0, 15), hasDirectCoverage: directItems.length > 0 };
  }

  private refreshNewsForPanel(code: string, country: string): void {
    const page = this.ctx.countryBriefPage;
    if (!page) return;
    const { items, hasDirectCoverage } = this.getFilteredNewsForCountry(code, country);
    const allNews = this.getAllNews();
    const panelItems = hasDirectCoverage
      ? items
      : [...allNews]
          .sort((a, b) => {
            const severityDelta = this.newsSeverityRank(b) - this.newsSeverityRank(a);
            if (severityDelta !== 0) return severityDelta;
            return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
          })
          .slice(0, 8);
    const availability: import('@/components/CountryBriefPanel').CardAvailability = hasDirectCoverage
      ? { available: true, source: 'News feeds', updatedAt: new Date() }
      : {
          available: false,
          reason: panelItems.length > 0
            ? 'No direct country-specific coverage found in current feeds. Showing latest high-priority headlines for context.'
            : 'No direct country-specific coverage found in current feeds.',
          source: 'News feeds',
          updatedAt: new Date(),
        };
    page.updateNews(panelItems, availability);
  }

  private getAllNews(): NewsItem[] {
    return this.ctx.newsStore.allNews.length > 0 ? this.ctx.newsStore.allNews : this.ctx.allNews;
  }

  private newsSeverityRank(item: NewsItem): number {
    const level = item.threat?.level;
    if (level === 'critical') return 5;
    if (level === 'high') return 4;
    if (level === 'medium') return 3;
    if (level === 'low') return 2;
    if (item.isAlert) return 4;
    return 1;
  }

  private toSignalSeverity(item: NewsItem): CountryDeepDiveSignalDetails['recentHigh'][number]['severity'] {
    const level = item.threat?.level;
    if (level === 'critical' || level === 'high' || level === 'medium' || level === 'low') return level;
    return item.isAlert ? 'high' : 'info';
  }

  matchesCountry(
    item: { country?: string; lat?: number; lon?: number },
    code: string,
    countryLower: string,
    hasGeoShape: boolean,
  ): boolean {
    if (item.country) {
      const raw = item.country.toLowerCase().trim();
      if (raw === countryLower) return true;
      if (item.country.length === 2 && item.country.toUpperCase() === code) return true;
      if (nameToCountryCode(raw) === code) return true;
    }
    if (hasGeoShape && item.lat != null && item.lon != null) {
      return this.isInCountry(item.lat, item.lon, code);
    }
    return false;
  }

  private isInCountry(lat: number, lon: number, code: string): boolean {
    const precise = isCoordinateInCountry(lat, lon, code);
    if (precise === true) return true;
    const b = COUNTRY_BOUNDS[code];
    if (!b) return false;
    return lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
  }

  static resolveCountryName(code: string): string {
    return resolveCountryName(code);
  }

  static getCountrySearchTerms(country: string, code: string): string[] {
    return getCountrySearchTerms(country, code);
  }

  static getOtherCountryTerms(code: string): string[] {
    return getOtherCountryTerms(code);
  }

  static firstMentionPosition(text: string, terms: string[]): number {
    return firstMentionPosition(text, terms);
  }

  static get COUNTRY_BOUNDS(): Record<string, { n: number; s: number; e: number; w: number }> {
    return COUNTRY_BOUNDS;
  }

  static get COUNTRY_ALIASES(): Record<string, string[]> {
    return COUNTRY_ALIASES;
  }

  static toFlagEmoji(code: string): string {
    return getCountryFlagEmoji(code);
  }
}

export { resolveCountryName, getCountrySearchTerms, getOtherCountryTerms, firstMentionPosition, COUNTRY_BOUNDS, COUNTRY_ALIASES, getCountryFlagEmoji };
