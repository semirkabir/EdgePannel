import type { CountryBriefSignals } from '@/app/app-context';
import { getSourcePropagandaRisk, getSourceTier } from '@/config/feeds';
import { getCountryCentroid, ME_STRIKE_BOUNDS } from '@/services/country-geometry';
import type { CountryScore } from '@/services/country-instability';
import { t } from '@/services/i18n';
import { getCountryInfrastructure, getNearbyInfrastructure } from '@/services/related-assets';
import type { PredictionMarket } from '@/services/prediction';
import type { AssetType, NewsItem, RelatedAsset, MapLayers } from '@/types';
import { sanitizeUrl, escapeHtml } from '@/utils/sanitize';
import { getCSSColor } from '@/utils';
import { getRegimeTypeColor, type CountryGovernanceData } from '@/services/data360';
import { applyArticleLinkDataset } from '@/services/article-open';
import { PORTS } from '@/config/ports';
import { haversineKm } from '@/utils/geo';
import type {
  CardAvailability,
  CountryBriefPanel,
  CountryDeepDiveSignalItem,
  CountryDeepDiveSignalDetails,
  CountryDeepDiveMilitarySummary,
  CountryDeepDiveEconomicIndicator,
  MacroEconomicCardData,
  CountryIntelData,
  StockIndexData,
} from './CountryBriefPanel';
import type { MapContainer } from './MapContainer';
import { loadFactbook, type FactbookData } from '@/services/factbook';
import { FACTBOOK_TABS, renderFactbookTab, type TabId } from './country-factbook';

type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
type TrendDirection = 'up' | 'down' | 'flat';

type CountryInfraAssetType = 'pipeline' | 'cable' | 'datacenter' | 'base' | 'nuclear';

const INFRA_TYPES: CountryInfraAssetType[] = ['pipeline', 'cable', 'datacenter', 'base', 'nuclear'];

const INFRA_ICONS: Record<CountryInfraAssetType, string> = {
  pipeline: '🛢️',
  cable: '🌐',
  datacenter: '🖥️',
  base: '🛡️',
  nuclear: '☢️',
};

const ASSET_LAYER_MAP: Record<CountryInfraAssetType, keyof MapLayers> = {
  pipeline: 'pipelines',
  cable: 'cables',
  datacenter: 'datacenters',
  base: 'bases',
  nuclear: 'nuclear',
};

const SEVERITY_ORDER: Record<ThreatLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export class CountryDeepDivePanel implements CountryBriefPanel {
  private panel: HTMLElement;
  private content: HTMLElement;
  private closeButton: HTMLButtonElement;
  private currentCode: string | null = null;
  private currentName: string | null = null;
  private isMaximizedState = false;
  private onCloseCallback?: () => void;
  private onStateChangeCallback?: (state: { visible: boolean; maximized: boolean }) => void;
  private onMarketClickCallback?: (market: PredictionMarket) => void;
  private map: MapContainer | null;
  private abortController: AbortController = new AbortController();
  private lastFocusedElement: HTMLElement | null = null;
  private economicIndicators: CountryDeepDiveEconomicIndicator[] = [];
  private infrastructureByType = new Map<AssetType, RelatedAsset[]>();
  private activeInfraLayer: CountryInfraAssetType | null = null;
  private maximizeButton: HTMLButtonElement | null = null;
  private currentHeadlineCount = 0;
  private currentMarkets: PredictionMarket[] = [];

  private signalsBody: HTMLElement | null = null;
  private signalBreakdownBody: HTMLElement | null = null;
  private signalRecentBody: HTMLElement | null = null;
  private newsBody: HTMLElement | null = null;
  private militaryBody: HTMLElement | null = null;
  private infrastructureBody: HTMLElement | null = null;
  private economicBody: HTMLElement | null = null;
  private macroCards: MacroEconomicCardData[] = [];
  private marketsBody: HTMLElement | null = null;
  private governanceBody: HTMLElement | null = null;
  private riskProfileBody: HTMLElement | null = null;
  private briefBody: HTMLElement | null = null;
  private timelineBody: HTMLElement | null = null;
  private scoreCard: HTMLElement | null = null;
  private activeTab: TabId = '' as TabId;  // '' sentinel forces first setActiveTab call to paint
  private tabButtons = new Map<TabId, HTMLButtonElement>();
  private tabPanes = new Map<TabId, HTMLElement>();
  private factbookLoadedFor: string | null = null;
  private factbookData: FactbookData | null = null;

  private readonly handleGlobalKeydown = (event: KeyboardEvent): void => {
    if (!this.panel.classList.contains('active')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.isMaximizedState) {
        this.minimize();
      } else {
        this.hide();
      }
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const current = document.activeElement as HTMLElement | null;
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  constructor(map: MapContainer | null = null) {
    this.map = map;
    this.panel = this.getOrCreatePanel();

    const content = this.panel.querySelector<HTMLElement>('#deep-dive-content');
    const closeButton = this.panel.querySelector<HTMLButtonElement>('#deep-dive-close');
    if (!content || !closeButton) {
      throw new Error('Country deep-dive panel structure is invalid');
    }
    this.content = content;
    this.closeButton = closeButton;

    this.setupScrollButtons();
    this.closeButton.addEventListener('click', () => this.hide());

    this.panel.addEventListener('click', (e) => {
      if (this.isMaximizedState && !(e.target as HTMLElement).closest('.panel-content')) {
        this.minimize();
      }
    });
  }

  public setMap(map: MapContainer | null): void {
    this.map = map;
  }


  public get signal(): AbortSignal {
    return this.abortController.signal;
  }

  public showLoading(): void {
    this.currentCode = '__loading__';
    this.currentName = null;
    this.renderLoading();
    this.open();
  }

  public showGeoError(onRetry: () => void): void {
    this.currentCode = '__error__';
    this.currentName = null;
    this.content.replaceChildren();

    const wrapper = this.el('div', 'cdp-geo-error');
    wrapper.append(
      this.el('div', 'cdp-geo-error-icon', '\u26A0\uFE0F'),
      this.el('div', 'cdp-geo-error-msg', t('countryBrief.geocodeFailed')),
    );

    const actions = this.el('div', 'cdp-geo-error-actions');

    const retryBtn = this.el('button', 'cdp-geo-error-retry', t('countryBrief.retryBtn')) as HTMLButtonElement;
    retryBtn.type = 'button';
    retryBtn.addEventListener('click', () => onRetry(), { once: true });

    const closeBtn = this.el('button', 'cdp-geo-error-close', t('countryBrief.closeBtn')) as HTMLButtonElement;
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.hide(), { once: true });

    actions.append(retryBtn, closeBtn);
    wrapper.append(actions);
    this.content.append(wrapper);
  }

  public show(country: string, code: string, score: CountryScore | null, signals: CountryBriefSignals): void {
    this.abortController.abort();
    this.abortController = new AbortController();
    this.currentCode = code;
    this.currentName = country;
    this.economicIndicators = [];
    this.macroCards = [];
    this.infrastructureByType.clear();
    this.activeInfraLayer = null;
    this.currentHeadlineCount = 0;
    this.currentMarkets = [];
    this.activeTab = '' as TabId;  // reset so next setActiveTab('overview') isn't swallowed by the guard
    this.tabButtons.clear();
    this.tabPanes.clear();
    this.factbookLoadedFor = null;
    this.factbookData = null;
    this.renderSkeleton(country, code, score, signals);
    this.open();
  }

  public hide(): void {
    if (this.isMaximizedState) {
      this.isMaximizedState = false;
      this.panel.classList.remove('maximized');
      if (this.maximizeButton) this.maximizeButton.textContent = '\u26F6';
    }
    this.abortController.abort();
    this.close();
    this.currentCode = null;
    this.currentName = null;
    this.economicIndicators = [];
    this.macroCards = [];
    this.currentHeadlineCount = 0;
    this.currentMarkets = [];
    this.onCloseCallback?.();
    this.onStateChangeCallback?.({ visible: false, maximized: false });
  }

  public onClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public onStateChange(cb: (state: { visible: boolean; maximized: boolean }) => void): void {
    this.onStateChangeCallback = cb;
  }

  public maximize(): void {
    if (this.isMaximizedState) return;
    this.isMaximizedState = true;
    this.panel.classList.add('maximized');
    if (this.maximizeButton) this.maximizeButton.textContent = '\u229F';
    this.onStateChangeCallback?.({ visible: true, maximized: true });
  }

  public minimize(): void {
    if (!this.isMaximizedState) return;
    this.isMaximizedState = false;
    this.panel.classList.remove('maximized');
    if (this.maximizeButton) this.maximizeButton.textContent = '\u26F6';
    this.onStateChangeCallback?.({ visible: true, maximized: false });
  }

  public getIsMaximized(): boolean {
    return this.isMaximizedState;
  }

  public isVisible(): boolean {
    return this.panel.classList.contains('active');
  }

  public getCode(): string | null {
    return this.currentCode;
  }

  public getName(): string | null {
    return this.currentName;
  }

  public getTimelineMount(): HTMLElement | null {
    return this.timelineBody;
  }

  public updateSignalDetails(details: CountryDeepDiveSignalDetails): void {
    if (!this.signalBreakdownBody || !this.signalRecentBody) return;
    this.renderSignalBreakdown(details);
    this.renderRecentSignals(details.recentHigh);
  }

  public updateNews(headlines: NewsItem[], availability?: CardAvailability): void {
    if (!this.newsBody) return;
    this.newsBody.replaceChildren();

    const items = [...headlines]
      .sort((a, b) => {
        const sa = SEVERITY_ORDER[this.toThreatLevel(a.threat?.level)];
        const sb = SEVERITY_ORDER[this.toThreatLevel(b.threat?.level)];
        if (sb !== sa) return sb - sa;
        return this.toTimestamp(b.pubDate) - this.toTimestamp(a.pubDate);
      })
      .slice(0, 15);

    this.currentHeadlineCount = items.length;

    if (items.length === 0) {
      // Prefer the explicit reason over the generic key when the caller signals unavailability
      const emptyText = (availability && !availability.available && availability.reason)
        ? availability.reason
        : t('countryBrief.noNews');
      this.newsBody.append(this.makeEmpty(emptyText));
      return;
    }

    if (availability && !availability.available && availability.reason) {
      const note = this.el('div', 'cdp-news-context-note', availability.reason);
      this.newsBody.append(note);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const row = this.el('a', 'cdp-news-item');
      row.id = `cdp-news-${i + 1}`;
      const href = sanitizeUrl(item.link);
      if (href) {
        row.setAttribute('href', href);
        row.setAttribute('target', '_blank');
        row.setAttribute('rel', 'noopener');
        applyArticleLinkDataset(row, {
          url: href,
          title: item.title,
          source: item.source,
          publishedAt: item.pubDate,
        });
      } else {
        row.removeAttribute('href');
      }

      const top = this.el('div', 'cdp-news-top');
      const tier = item.tier ?? getSourceTier(item.source);
      top.append(this.badge(`Tier ${tier}`, `cdp-tier-badge tier-${Math.max(1, Math.min(4, tier))}`));

      const severity = this.toThreatLevel(item.threat?.level);
      const levelKey = severity === 'info' ? 'low' : severity === 'medium' ? 'moderate' : severity;
      const severityLabel = t(`countryBrief.levels.${levelKey}`);
      top.append(this.badge(severityLabel.toUpperCase(), `cdp-severity-badge sev-${severity}`));

      const risk = getSourcePropagandaRisk(item.source);
      if (risk.stateAffiliated) {
        top.append(this.badge(`State-affiliated: ${risk.stateAffiliated}`, 'cdp-state-badge'));
      }

      const title = this.el('div', 'cdp-news-title', this.decodeEntities(item.title));
      const meta = this.el('div', 'cdp-news-meta', `${item.source} • ${this.formatRelativeTime(item.pubDate)}`);
      row.append(top, title, meta);

      if (i >= 5) {
        const wrapper = this.el('div', 'cdp-expanded-only');
        wrapper.append(row);
        this.newsBody.append(wrapper);
      } else {
        this.newsBody.append(row);
      }
    }
  }

  public updateMilitaryActivity(summary: CountryDeepDiveMilitarySummary): void {
    if (!this.militaryBody) return;
    this.militaryBody.replaceChildren();

    const stats = this.el('div', 'cdp-military-grid');
    stats.append(
      this.metric(t('countryBrief.ownFlights'), String(summary.ownFlights), 'cdp-chip-neutral'),
      this.metric(t('countryBrief.foreignFlights'), String(summary.foreignFlights), summary.foreignFlights > 0 ? 'cdp-chip-danger' : 'cdp-chip-neutral'),
      this.metric(t('countryBrief.navalVessels'), String(summary.nearbyVessels), 'cdp-chip-neutral'),
      this.metric(t('countryBrief.foreignPresence'), summary.foreignPresence ? t('countryBrief.detected') : t('countryBrief.notDetected'), summary.foreignPresence ? 'cdp-chip-danger' : 'cdp-chip-success'),
    );
    this.militaryBody.append(stats);

    const basesTitle = this.el('div', 'cdp-subtitle', t('countryBrief.nearestBases'));
    this.militaryBody.append(basesTitle);

    if (summary.nearestBases.length === 0) {
      this.militaryBody.append(this.makeEmpty(t('countryBrief.noBasesNearby')));
      return;
    }

    const list = this.el('ul', 'cdp-base-list');
    for (const base of summary.nearestBases.slice(0, 3)) {
      const item = this.el('li', 'cdp-base-item');
      const left = this.el('span', 'cdp-base-name', base.name);
      const right = this.el('span', 'cdp-base-distance', `${Math.round(base.distanceKm)} km`);
      item.append(left, right);
      list.append(item);
    }
    this.militaryBody.append(list);
  }

  public updateInfrastructure(countryCode: string): void {
    if (!this.infrastructureBody) return;
    this.infrastructureBody.replaceChildren();

    const centroid = getCountryCentroid(countryCode, ME_STRIKE_BOUNDS);
    if (!centroid) {
      this.infrastructureBody.append(this.makeEmpty(t('countryBrief.noGeometry')));
      return;
    }

    const inCountryAssets = getCountryInfrastructure(countryCode, INFRA_TYPES);
    const usingNearbyFallback = inCountryAssets.length === 0;
    const resolvedAssets = usingNearbyFallback
      ? getNearbyInfrastructure(centroid.lat, centroid.lon, INFRA_TYPES)
      : inCountryAssets;
    if (resolvedAssets.length === 0) {
      this.infrastructureBody.append(this.makeEmpty(t('countryBrief.noInfrastructure')));
      return;
    }

    // Indicate when showing centroid-nearby assets rather than in-country inventory
    if (usingNearbyFallback) {
      const nearbyNote = this.el('div', 'cdp-infra-nearby-note', '📍 Nearby infrastructure (no direct country match)');
      this.infrastructureBody.append(nearbyNote);
    }

    this.infrastructureByType.clear();
    for (const type of INFRA_TYPES) {
      const matches = resolvedAssets.filter((asset) => asset.type === type);
      this.infrastructureByType.set(type, matches);
    }

    const grid = this.el('div', 'cdp-infra-grid');
    for (const type of INFRA_TYPES) {
      const list = this.infrastructureByType.get(type) ?? [];
      if (list.length === 0) continue;
      const card = this.el('button', 'cdp-infra-card');
      card.setAttribute('type', 'button');
      card.addEventListener('click', () => this.highlightInfrastructure(type));

      const icon = this.el('span', 'cdp-infra-icon', INFRA_ICONS[type]);
      const label = this.el('span', 'cdp-infra-label', t(`countryBrief.infra.${type}`));
      const count = this.el('span', 'cdp-infra-count', String(list.length));
      card.append(icon, label, count);
      grid.append(card);
    }
    this.infrastructureBody.append(grid);

    const expandedDetails = this.el('div', 'cdp-expanded-only');
    for (const type of INFRA_TYPES) {
      const list = this.infrastructureByType.get(type) ?? [];
      if (list.length === 0) continue;
      const typeLabel = this.el('div', 'cdp-subtitle', `${INFRA_ICONS[type]} ${t(`countryBrief.infra.${type}`)}`);
      expandedDetails.append(typeLabel);
      const ul = this.el('ul', 'cdp-base-list');
      for (const asset of list.slice(0, 5)) {
        const li = this.el('li', 'cdp-base-item');
        li.append(
          this.el('span', 'cdp-base-name', asset.name),
          this.el('span', 'cdp-base-distance', `${Math.round(asset.distanceKm)} km`),
        );
        ul.append(li);
      }
      expandedDetails.append(ul);
    }

    const nearbyPorts = PORTS
      .map((port) => ({
        ...port,
        distanceKm: haversineKm(centroid.lat, centroid.lon, port.lat, port.lon),
      }))
      .filter((port) => port.distanceKm <= 1500)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);

    if (nearbyPorts.length > 0) {
      const portsTitle = this.el('div', 'cdp-subtitle', `\u2693 ${t('countryBrief.nearbyPorts')}`);
      expandedDetails.append(portsTitle);
      const portList = this.el('ul', 'cdp-base-list');
      for (const port of nearbyPorts) {
        const li = this.el('li', 'cdp-base-item');
        li.append(
          this.el('span', 'cdp-base-name', `${port.name} (${port.type})`),
          this.el('span', 'cdp-base-distance', `${Math.round(port.distanceKm)} km`),
        );
        portList.append(li);
      }
      expandedDetails.append(portList);
    }

    this.infrastructureBody.append(expandedDetails);
  }

  public updateEconomicIndicators(indicators: CountryDeepDiveEconomicIndicator[]): void {
    this.economicIndicators = indicators;
    if (this.macroCards.length > 0) {
      this.renderEconomicIndicators();
    }
  }

  public updateScore(score: CountryScore | null, signals: CountryBriefSignals, ciiAvailability?: CardAvailability): void {
    if (!this.scoreCard) return;
    // Partial DOM update: score number, level color, trend, component bars only
    const top = this.scoreCard.firstElementChild as HTMLElement | null;
    while (this.scoreCard.childElementCount > 1) {
      this.scoreCard.lastElementChild?.remove();
    }
    if (top) {
      const updatedEl = top.querySelector('.cdp-updated');
      const updatedLabel = ciiAvailability?.updatedAt
        ? `Updated ${this.shortDate(ciiAvailability.updatedAt)}`
        : score?.lastUpdated
          ? `Updated ${this.shortDate(score.lastUpdated)}`
          : `Updated ${this.shortDate(new Date())}`;
      if (updatedEl) updatedEl.textContent = updatedLabel;
    }
    if (score) {
      const band = this.ciiBand(score.score);
      const scoreRow = this.el('div', 'cdp-score-row');
      const value = this.el('div', `cdp-score-value cii-${band}`, `${score.score}/100`);
      const trend = this.el('div', 'cdp-trend', `${this.trendArrow(score.trend)} ${score.trend}`);
      scoreRow.append(value, trend);
      this.scoreCard.append(scoreRow);
      this.scoreCard.append(this.renderComponentBars(score.components));
    } else {
      const reason = ciiAvailability?.reason ?? t('countryBrief.ciiUnavailable');
      const emptyEl = this.makeEmpty(reason);
      if (ciiAvailability?.source) {
        emptyEl.title = `Source: ${ciiAvailability.source}`;
      }
      this.scoreCard.append(emptyEl);
    }

    this.renderInitialSignals(signals);
  }

  public updateStock(data: StockIndexData): void {
    if (!data.available) {
      this.renderEconomicIndicators();
      return;
    }

    const delta = Number.parseFloat(data.weekChangePercent);
    const trend: TrendDirection = Number.isFinite(delta)
      ? delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
      : 'flat';

    const base = this.economicIndicators.filter((item) => item.label !== 'Stock Index');
    base.unshift({
      label: 'Stock Index',
      value: `${data.indexName}: ${data.price} ${data.currency}`,
      trend,
      source: 'Market Service',
    });
    this.economicIndicators = base.slice(0, 3);
    this.renderEconomicIndicators();
  }

  public updateMarkets(markets: PredictionMarket[], availability?: CardAvailability): void {
    if (!this.marketsBody) return;
    this.marketsBody.replaceChildren();
    this.currentMarkets = markets.slice(0, 5);

    if (markets.length === 0) {
      const emptyText = (availability && !availability.available && availability.reason)
        ? availability.reason
        : t('countryBrief.noMarkets');
      this.marketsBody.append(this.makeEmpty(emptyText));
      return;
    }

    for (const market of markets.slice(0, 5)) {
      const item = this.el('div', 'cdp-market-item');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', () => this.openPredictionMarketDetail(market));
      item.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.openPredictionMarketDetail(market);
      });

      const top = this.el('div', 'cdp-market-top');
      const title = this.el('div', 'cdp-market-title', market.title);
      top.append(title);

      const prob = this.el('div', 'cdp-market-prob', `Probability: ${Math.round(market.yesPrice)}%`);
      const meta = this.el('div', 'cdp-market-meta', market.endDate ? `Ends ${this.shortDate(market.endDate)}` : 'Active');
      item.append(top, prob, meta);

      const expanded = this.el('div', 'cdp-expanded-only');
      if (market.volume != null) {
        expanded.append(this.el('div', 'cdp-market-volume', `Volume: $${market.volume.toLocaleString()}`));
      }
      const yesPercent = Math.round(market.yesPrice);
      const noPercent = 100 - yesPercent;
      const bar = this.el('div', 'cdp-market-bar');
      const barYes = this.el('div', 'cdp-market-bar-yes');
      barYes.style.width = `${yesPercent}%`;
      const barNo = this.el('div', 'cdp-market-bar-no');
      barNo.style.width = `${noPercent}%`;
      bar.append(barYes, barNo);
      expanded.append(bar);
      item.append(expanded);

      this.marketsBody.append(item);
    }
  }

  public updateBrief(data: CountryIntelData): void {
    if (!this.briefBody || data.code !== this.currentCode) return;
    this.briefBody.replaceChildren();

    if (data.error || data.skipped || !data.brief) {
      this.briefBody.append(this.makeEmpty(data.error || data.reason || t('countryBrief.assessmentUnavailable')));
      return;
    }

    const summary = this.summarizeBrief(data.brief);
    const text = this.el('p', 'cdp-assessment-text', summary);

    const metaTokens: string[] = [];
    if (data.cached) metaTokens.push('Cached');
    if (data.fallback) metaTokens.push('Fallback');
    if (data.generatedAt) metaTokens.push(`Updated ${new Date(data.generatedAt).toLocaleTimeString()}`);
    const meta = this.el('div', 'cdp-assessment-meta', metaTokens.join(' • '));
    this.briefBody.append(text, meta);

    const expandedBrief = this.el('div', 'cdp-expanded-only');
    const fullText = this.el('div', 'cdp-assessment-text');
    fullText.innerHTML = this.formatBrief(data.brief, this.currentHeadlineCount);
    expandedBrief.append(fullText);
    this.briefBody.append(expandedBrief);
  }

  private renderLoading(): void {
    this.scoreCard = null;
    this.content.replaceChildren();
    const loading = this.el('div', 'cdp-loading');
    loading.append(
      this.el('div', 'cdp-loading-title', t('countryBrief.identifying')),
      this.el('div', 'cdp-loading-line'),
      this.el('div', 'cdp-loading-line cdp-loading-line-short'),
    );
    this.content.append(loading);
  }

  private renderSkeleton(country: string, code: string, score: CountryScore | null, signals: CountryBriefSignals): void {
    this.content.replaceChildren();

    const shell = this.el('div', 'cdp-shell');
    const header = this.el('header', 'cdp-header');
    const left = this.el('div', 'cdp-header-left');
    const flag = this.el('span', 'cdp-flag');
    const flagImg = document.createElement('img');
    flagImg.className = 'cdp-flag-img';
    flagImg.src = `https://flagcdn.com/${code.toLowerCase()}.svg`;
    flagImg.alt = code.toUpperCase();
    flagImg.referrerPolicy = 'no-referrer';
    flagImg.onerror = () => { flag.textContent = code.toUpperCase(); flagImg.remove(); };
    flag.append(flagImg);
    const titleWrap = this.el('div', 'cdp-title-wrap');
    const name = this.el('h2', 'cdp-country-name', country);
    const subtitle = this.el('div', 'cdp-country-subtitle', `${code.toUpperCase()} • Country Brief`);
    titleWrap.append(name, subtitle);
    left.append(flag, titleWrap);

    const right = this.el('div', 'cdp-header-right');

    const maxBtn = this.el('button', 'cdp-maximize-btn', '\u26F6') as HTMLButtonElement;
    maxBtn.setAttribute('type', 'button');
    maxBtn.setAttribute('aria-label', 'Toggle maximize');
    maxBtn.addEventListener('click', () => {
      if (this.isMaximizedState) this.minimize();
      else this.maximize();
    });
    this.maximizeButton = maxBtn;

    const shareBtn = this.el('button', 'cdp-action-btn cdp-share-btn') as HTMLButtonElement;
    shareBtn.setAttribute('type', 'button');
    shareBtn.setAttribute('aria-label', t('components.countryBrief.shareLink'));
    shareBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
    shareBtn.addEventListener('click', () => {
      if (!this.currentCode || !this.currentName) return;
      const url = `${window.location.origin}/?c=${this.currentCode}`;
      navigator.clipboard.writeText(url).then(() => {
        const orig = shareBtn.innerHTML;
        shareBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => { shareBtn.innerHTML = orig; }, 1500);
      }).catch(() => {});
    });

    right.append(shareBtn, maxBtn);
    header.append(left, right);

    const scoreCard = this.el('section', 'cdp-card cdp-score-card');
    this.scoreCard = scoreCard;
    const top = this.el('div', 'cdp-score-top');
    const label = this.el('span', 'cdp-score-label', t('countryBrief.instabilityIndex'));
    label.setAttribute('title', '40% baseline risk + 60% live signals. Live signals blend unrest (25%), conflict (30%), security (20%), and information (25%), with event floors and regional boosts.');
    const updated = this.el('span', 'cdp-updated', `Updated ${this.shortDate(score?.lastUpdated ?? new Date())}`);
    top.append(label, updated);
    scoreCard.append(top);

    if (score) {
      const band = this.ciiBand(score.score);
      const scoreRow = this.el('div', 'cdp-score-row');
      const value = this.el('div', `cdp-score-value cii-${band}`, `${score.score}/100`);
      const trend = this.el('div', 'cdp-trend', `${this.trendArrow(score.trend)} ${score.trend}`);
      scoreRow.append(value, trend);
      scoreCard.append(scoreRow);
      scoreCard.append(this.renderComponentBars(score.components));
    } else {
      scoreCard.append(this.makeEmpty(t('countryBrief.ciiUnavailable')));
    }

    const bodyGrid = this.el('div', 'cdp-grid');
    const [signalsCard, signalBody] = this.sectionCard(t('countryBrief.activeSignals'));
    const [timelineCard, timelineBody] = this.sectionCard(t('countryBrief.timeline'));
    const [newsCard, newsBody] = this.sectionCard(t('countryBrief.topNews'));
    const [militaryCard, militaryBody] = this.sectionCard(t('countryBrief.militaryActivity'));
    const [infraCard, infraBody] = this.sectionCard(t('countryBrief.infrastructure'));
    const [economicCard, economicBody] = this.sectionCard(t('countryBrief.economicIndicators'));
    const [marketsCard, marketsBody] = this.sectionCard(t('countryBrief.predictionMarkets'), {
      onClick: () => {
        if (this.openDashboardPanel('polymarket')) return;
        const leadMarket = this.currentMarkets[0];
        if (leadMarket) {
          this.openPredictionMarketDetail(leadMarket);
        }
      },
      ariaLabel: 'Open prediction markets panel',
    });
    const [governanceCard, governanceBody] = this.sectionCard(t('countryBrief.governanceDemocracy') ?? 'Governance & Democracy');
    const [riskProfileCard, riskProfileBody] = this.sectionCard('GEM Risk Profile');
    const [briefCard, briefBody] = this.sectionCard(t('countryBrief.intelBrief'));

    this.signalsBody = signalBody;
    this.timelineBody = timelineBody;
    this.timelineBody.classList.add('cdp-timeline-mount');
    this.newsBody = newsBody;
    this.militaryBody = militaryBody;
    this.infrastructureBody = infraBody;
    this.economicBody = economicBody;
    this.marketsBody = marketsBody;
    this.governanceBody = governanceBody;
    this.riskProfileBody = riskProfileBody;
    this.briefBody = briefBody;

    this.renderInitialSignals(signals);
    newsBody.append(this.makeLoading('Loading country headlines…'));
    militaryBody.append(this.makeLoading('Loading flights, vessels, and nearby bases…'));
    infraBody.append(this.makeLoading('Computing nearby critical infrastructure…'));
    economicBody.append(this.makeLoading('Loading available indicators…'));
    marketsBody.append(this.makeLoading(t('countryBrief.loadingMarkets')));
    governanceBody.append(this.makeLoading('Loading governance data…'));
    riskProfileBody.append(this.makeLoading('Loading risk profile…'));
    briefBody.append(this.makeLoading(t('countryBrief.generatingBrief')));

    bodyGrid.append(briefCard, signalsCard, timelineCard, newsCard, militaryCard, infraCard, economicCard, marketsCard, governanceCard, riskProfileCard);

    const tabBar = this.renderTabBar();
    const overviewPane = this.el('div', 'cdp-pane cdp-pane-overview');
    overviewPane.dataset.tabId = 'overview';
    overviewPane.append(scoreCard, bodyGrid);
    this.tabPanes.set('overview', overviewPane);

    shell.append(header, tabBar, overviewPane);
    for (const def of FACTBOOK_TABS) {
      if (def.id === 'overview') continue;
      const pane = this.el('div', 'cdp-pane cdp-pane-factbook');
      pane.dataset.tabId = def.id;
      pane.hidden = true;
      this.tabPanes.set(def.id, pane);
      shell.append(pane);
    }
    this.setActiveTab('overview');
    this.content.append(shell);
  }

  private renderTabBar(): HTMLElement {
    this.tabButtons.clear();

    const wrap = this.el('div', 'cdp-tabs-wrap');
    const bar = this.el('nav', 'cdp-tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Country sections');

    for (const def of FACTBOOK_TABS) {
      const btn = this.el('button', 'cdp-tab', def.label) as HTMLButtonElement;
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.dataset.tabId = def.id;
      btn.addEventListener('click', () => this.setActiveTab(def.id));
      this.tabButtons.set(def.id, btn);
      bar.append(btn);
    }

    // Scroll-left chevron — hidden when at start
    const arrowLeft = this.el('button', 'cdp-tabs-arrow cdp-tabs-arrow--left') as HTMLButtonElement;
    arrowLeft.type = 'button';
    arrowLeft.setAttribute('aria-label', 'Scroll tabs left');
    arrowLeft.setAttribute('aria-hidden', 'true');
    arrowLeft.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M9 2l-5 5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    arrowLeft.hidden = true;
    arrowLeft.addEventListener('click', () => {
      bar.scrollBy({ left: -140, behavior: 'smooth' });
    });

    // Scroll-right chevron — hidden when no overflow
    const arrowRight = this.el('button', 'cdp-tabs-arrow cdp-tabs-arrow--right') as HTMLButtonElement;
    arrowRight.type = 'button';
    arrowRight.setAttribute('aria-label', 'Scroll tabs right');
    arrowRight.setAttribute('aria-hidden', 'true');
    arrowRight.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    arrowRight.addEventListener('click', () => {
      bar.scrollBy({ left: 140, behavior: 'smooth' });
    });

    const updateScrollState = (): void => {
      const { scrollLeft, clientWidth, scrollWidth } = bar;
      const atStart = scrollLeft <= 4;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 4;
      arrowLeft.hidden = atStart;
      arrowRight.hidden = atEnd;
      wrap.classList.toggle('cdp-tabs-wrap--start', atStart);
      wrap.classList.toggle('cdp-tabs-wrap--end', atEnd);
    };

    bar.addEventListener('scroll', updateScrollState, { passive: true });
    // Re-check on resize (e.g. panel width changes)
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(bar);
    // Initial state after browser has laid out
    requestAnimationFrame(updateScrollState);

    // Touch swipe support
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartScrollLeft = 0;
    let isSwiping = false;

    bar.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartScrollLeft = bar.scrollLeft;
      isSwiping = true;
    }, { passive: true });

    bar.addEventListener('touchmove', (e) => {
      if (!isSwiping || e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      const dx = touchStartX - touch.clientX;
      const dy = touchStartY - touch.clientY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
        e.preventDefault();
        bar.scrollLeft = touchStartScrollLeft + dx;
      }
    }, { passive: false });

    bar.addEventListener('touchend', (e) => {
      if (!isSwiping) return;
      isSwiping = false;
      const touch = e.changedTouches[0]!;
      const dx = touchStartX - touch.clientX;
      if (Math.abs(dx) >= 50) {
        bar.scrollTo({ left: bar.scrollLeft, behavior: 'smooth' });
      }
    }, { passive: true });

    wrap.append(arrowLeft, bar, arrowRight);
    return wrap;
  }

  private setActiveTab(tab: TabId): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    for (const [id, btn] of this.tabButtons) {
      const active = id === tab;
      btn.classList.toggle('cdp-tab-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        // Keep the active tab visible within the scroll strip
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
    for (const [id, pane] of this.tabPanes) {
      pane.hidden = id !== tab;
    }
    if (tab !== 'overview') {
      void this.ensureFactbookTabRendered(tab);
    }
  }

  private openDashboardPanel(panelId: string): boolean {
    const selector = `[data-panel="${CSS.escape(panelId)}"]`;
    const panel = document.querySelector<HTMLElement>(selector);
    if (!panel) return false;

    this.hide();
    requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      panel.classList.add('flash-highlight');
      window.setTimeout(() => panel.classList.remove('flash-highlight'), 1500);
    });
    return true;
  }

  private openPredictionMarketDetail(market: PredictionMarket): void {
    if (this.onMarketClickCallback) {
      this.onMarketClickCallback(market);
      return;
    }
    const panel = (window as any).__entityDetailPanel;
    if (panel) {
      panel.show('predictionMarket', {
        title: market.title,
        slug: market.slug || '',
        category: 'geopolitics',
        volume: market.volume,
        endDate: market.endDate,
        closed: false,
        url: market.url,
      });
    }
  }

  onMarketClick(cb: (market: PredictionMarket) => void): void {
    this.onMarketClickCallback = cb;
  }

  private async ensureFactbookTabRendered(tab: TabId): Promise<void> {
    const pane = this.tabPanes.get(tab);
    const code = this.currentCode;
    const name = this.currentName ?? code ?? 'this country';
    if (!pane || !code) return;
    if (pane.dataset.renderedFor === code) return;
    pane.replaceChildren(this.makeLoading('Loading factbook data…'));

    if (this.factbookLoadedFor !== code) {
      this.factbookLoadedFor = code;
      try {
        this.factbookData = await loadFactbook(code);
      } catch {
        this.factbookData = null;
      }
    }
    if (this.currentCode !== code) return;

    pane.replaceChildren(renderFactbookTab(tab, this.factbookData, name));
    pane.dataset.renderedFor = code;
  }

  private renderInitialSignals(signals: CountryBriefSignals): void {
    if (!this.signalsBody) return;
    this.signalsBody.replaceChildren();

    const chips = this.el('div', 'cdp-signal-chips');
    this.addSignalChip(chips, signals.criticalNews, t('countryBrief.chips.criticalNews'), '🚨', 'conflict');
    this.addSignalChip(chips, signals.protests, t('countryBrief.chips.protests'), '📢', 'protest');
    this.addSignalChip(chips, signals.militaryFlights, t('countryBrief.chips.militaryAir'), '✈️', 'military');
    this.addSignalChip(chips, signals.militaryVessels, t('countryBrief.chips.navalVessels'), '⚓', 'military');
    this.addSignalChip(chips, signals.outages, t('countryBrief.chips.outages'), '🌐', 'outage');
    this.addSignalChip(chips, signals.aisDisruptions, t('countryBrief.chips.aisDisruptions'), '🚢', 'outage');
    this.addSignalChip(chips, signals.satelliteFires, t('countryBrief.chips.satelliteFires'), '🔥', 'climate');
    this.addSignalChip(chips, signals.temporalAnomalies, t('countryBrief.chips.temporalAnomalies'), '⏱️', 'outage');
    this.addSignalChip(chips, signals.cyberThreats, t('countryBrief.chips.cyberThreats'), '🛡️', 'conflict');
    this.addSignalChip(chips, signals.earthquakes, t('countryBrief.chips.earthquakes'), '🌍', 'quake');
    if (signals.displacementOutflow > 0) {
      const fmt = signals.displacementOutflow >= 1_000_000
        ? `${(signals.displacementOutflow / 1_000_000).toFixed(1)}M`
        : `${(signals.displacementOutflow / 1000).toFixed(0)}K`;
      chips.append(this.makeSignalChip(`🌊 ${fmt} ${t('countryBrief.chips.displaced')}`, 'displacement'));
    }
    this.addSignalChip(chips, signals.climateStress, t('countryBrief.chips.climateStress'), '🌡️', 'climate');
    this.addSignalChip(chips, signals.conflictEvents, t('countryBrief.chips.conflictEvents'), '⚔️', 'conflict');
    this.addSignalChip(chips, signals.activeStrikes, t('countryBrief.chips.activeStrikes'), '💥', 'conflict');
    if (signals.travelAdvisories > 0 && signals.travelAdvisoryMaxLevel) {
      const advLabel = signals.travelAdvisoryMaxLevel === 'do-not-travel' ? t('countryBrief.chips.doNotTravel')
        : signals.travelAdvisoryMaxLevel === 'reconsider' ? t('countryBrief.chips.reconsiderTravel')
        : t('countryBrief.chips.exerciseCaution');
      chips.append(this.makeSignalChip(`⚠️ ${signals.travelAdvisories} ${t('countryBrief.chips.advisory')}: ${advLabel}`, 'advisory'));
    }
    this.addSignalChip(chips, signals.orefSirens, t('countryBrief.chips.activeSirens'), '🚨', 'conflict');
    this.addSignalChip(chips, signals.orefHistory24h, t('countryBrief.chips.sirens24h'), '🕓', 'conflict');
    this.addSignalChip(chips, signals.aviationDisruptions, t('countryBrief.chips.aviationDisruptions'), '🚫', 'outage');
    this.addSignalChip(chips, signals.gpsJammingHexes, t('countryBrief.chips.gpsJammingZones'), '📡', 'outage');
    this.signalsBody.append(chips);

    this.signalBreakdownBody = this.el('div', 'cdp-signal-breakdown');
    this.signalRecentBody = this.el('div', 'cdp-signal-recent');
    this.signalsBody.append(this.signalBreakdownBody, this.signalRecentBody);

    const seeded: CountryDeepDiveSignalDetails = {
      critical: signals.criticalNews + Math.max(0, signals.activeStrikes),
      high: signals.militaryFlights + signals.militaryVessels + signals.protests,
      medium: signals.outages + signals.cyberThreats + signals.aisDisruptions,
      low: signals.earthquakes + signals.temporalAnomalies + signals.satelliteFires,
      recentHigh: [],
    };
    this.renderSignalBreakdown(seeded);
    this.signalRecentBody.append(this.makeLoading('Loading top high-severity signals…'));
  }

  private addSignalChip(container: HTMLElement, count: number, label: string, icon: string, cls: string): void {
    if (count <= 0) return;
    container.append(this.makeSignalChip(`${icon} ${count} ${label}`, cls));
  }

  private makeSignalChip(text: string, cls: string): HTMLElement {
    return this.el('span', `cdp-signal-chip chip-${cls}`, text);
  }

  private renderComponentBars(components: CountryScore['components']): HTMLElement {
    const wrap = this.el('div', 'cdp-components');
    const items = [
      { label: t('countryBrief.components.unrest'), value: components.unrest, icon: '📢' },
      { label: t('countryBrief.components.conflict'), value: components.conflict, icon: '⚔' },
      { label: t('countryBrief.components.security'), value: components.security, icon: '🛡️' },
      { label: t('countryBrief.components.information'), value: components.information, icon: '📡' },
    ];
    for (const item of items) {
      const row = this.el('div', 'cdp-score-row');
      const icon = this.el('span', 'cdp-comp-icon', item.icon);
      const label = this.el('span', 'cdp-comp-label', item.label);
      const barOuter = this.el('div', 'cdp-comp-bar');
      const pct = Math.min(100, Math.max(0, item.value));
      const color = pct >= 70 ? getCSSColor('--semantic-critical')
        : pct >= 50 ? getCSSColor('--semantic-high')
        : pct >= 30 ? getCSSColor('--semantic-elevated')
        : getCSSColor('--semantic-normal');
      const barFill = this.el('div', 'cdp-comp-fill');
      barFill.style.width = `${pct}%`;
      barFill.style.background = color;
      barOuter.append(barFill);
      const val = this.el('span', 'cdp-comp-val', String(Math.round(item.value)));
      row.append(icon, label, barOuter, val);
      wrap.append(row);
    }
    return wrap;
  }

  private renderSignalBreakdown(details: CountryDeepDiveSignalDetails): void {
    if (!this.signalBreakdownBody) return;
    this.signalBreakdownBody.replaceChildren();

    this.signalBreakdownBody.append(
      this.metric(t('countryBrief.levels.critical'), String(details.critical), 'cdp-chip-danger'),
      this.metric(t('countryBrief.levels.high'), String(details.high), 'cdp-chip-warn'),
      this.metric(t('countryBrief.levels.moderate'), String(details.medium), 'cdp-chip-neutral'),
      this.metric(t('countryBrief.levels.low'), String(details.low), 'cdp-chip-success'),
    );
  }

  private renderRecentSignals(items: CountryDeepDiveSignalItem[]): void {
    if (!this.signalRecentBody) return;
    this.signalRecentBody.replaceChildren();

    if (items.length === 0) {
      this.signalRecentBody.append(this.makeEmpty(t('countryBrief.noSignals')));
      return;
    }

    for (const item of items.slice(0, 3)) {
      const row = this.el('div', 'cdp-signal-item');
      const line = this.el('div', 'cdp-signal-line');
      line.append(
        this.badge(item.type, 'cdp-type-badge'),
        this.badge(item.severity.toUpperCase(), `cdp-severity-badge sev-${item.severity}`),
      );
      const desc = this.el('div', 'cdp-signal-desc', item.description);
      const ts = this.el('div', 'cdp-signal-time', this.formatRelativeTime(item.timestamp));
      row.append(line, desc, ts);
      this.signalRecentBody.append(row);
    }
  }

  private renderEconomicIndicators(): void {
    if (!this.economicBody) return;
    this.economicBody.replaceChildren();

    if (this.macroCards.length === 0) {
      if (this.economicIndicators.length > 0) {
        const fallbackGrid = this.el('div', 'cdp-macro-grid');
        for (const indicator of this.economicIndicators) {
          const el = this.el('div', 'cdp-macro-card');
          const header = this.el('div', 'cdp-macro-header');
          const label = this.el('span', 'cdp-macro-label', indicator.label);
          header.append(label);
          if (indicator.trend !== 'flat') {
            const arrow = this.el('span', `cdp-macro-trend cdp-macro-trend--${indicator.trend}`, indicator.trend === 'up' ? '▲' : '▼');
            header.append(arrow);
          }
          const value = this.el('div', 'cdp-macro-value', indicator.value);
          const source = indicator.source ? this.el('div', 'cdp-macro-year', indicator.source) : null;
          el.append(header, value);
          if (source) el.append(source);
          fallbackGrid.append(el);
        }
        this.economicBody.append(fallbackGrid);
      } else {
        this.economicBody.append(this.makeEmpty(t('countryBrief.noIndicators')));
      }
      return;
    }

    const grid = this.el('div', 'cdp-macro-grid');
    for (const card of this.macroCards) {
      const el = this.el('div', `cdp-macro-card ${card.available ? '' : 'cdp-macro-card--unavailable'}`);
      const header = this.el('div', 'cdp-macro-header');
      const label = this.el('span', 'cdp-macro-label', card.label);
      header.append(label);
      if (card.available && card.trend !== 'flat') {
        const arrow = this.el('span', `cdp-macro-trend cdp-macro-trend--${card.trend}`, card.trend === 'up' ? '▲' : '▼');
        header.append(arrow);
      }
      const displayValue = card.available
        ? card.value
        : (card.reason ?? card.value);
      const value = this.el('div', 'cdp-macro-value', displayValue);
      const year = (card.available && card.year) ? this.el('div', 'cdp-macro-year', card.year) : null;
      el.append(header, value);
      if (year) el.append(year);
      grid.append(el);
    }
    this.economicBody.append(grid);
  }

  public updateMacroCards(cards: MacroEconomicCardData[]): void {
    this.macroCards = cards;
    this.renderEconomicIndicators();
  }

  public updateGovernance(data: CountryGovernanceData | null): void {
    if (!this.governanceBody) return;
    this.governanceBody.replaceChildren();

    if (!data) {
      this.governanceBody.append(this.makeEmpty('Governance data unavailable'));
      return;
    }

    const { vdem, polity, regimeType } = data;
    const regimeColor = getRegimeTypeColor(regimeType);

    // ── Regime type badge ──
    const header = this.el('div', 'cdp-governance-header');
    const regimeBadge = this.el('span', 'cdp-regime-badge');
    regimeBadge.textContent = regimeType;
    regimeBadge.style.background = `${regimeColor}20`;
    regimeBadge.style.color = regimeColor;
    regimeBadge.style.border = `1px solid ${regimeColor}40`;
    regimeBadge.style.fontSize = '11px';
    regimeBadge.style.fontWeight = '600';
    regimeBadge.style.padding = '2px 8px';
    regimeBadge.style.borderRadius = '999px';
    regimeBadge.style.letterSpacing = '0.03em';

    const compositeValue = this.el('span', 'cdp-governance-composite');
    compositeValue.textContent = `${vdem.compositeScore.toFixed(1)}`;
    compositeValue.style.color = regimeColor;
    compositeValue.style.fontSize = '20px';
    compositeValue.style.fontWeight = '700';
    compositeValue.style.lineHeight = '1';

    const compositeLabel = this.el('span', 'cdp-governance-label');
    compositeLabel.textContent = '/ 100';
    compositeLabel.style.color = 'var(--text-faint)';
    compositeLabel.style.fontSize = '11px';

    const compositeWrap = this.el('div', 'cdp-governance-composite-wrap');
    compositeWrap.append(compositeValue, compositeLabel);
    header.append(regimeBadge, compositeWrap);
    this.governanceBody.append(header);

    // ── Radar chart (CSS-only) ──
    this.governanceBody.append(this.renderRadarChart(vdem));

    // ── Key V-Dem indicators row ──
    const keyRow = this.el('div', 'cdp-governance-key-row');
    if (vdem.components.freedomOfExpression !== null) {
      keyRow.append(this.metric(
        '🗣\uFE0E Freedom of Expr.',
        `${Math.round(vdem.components.freedomOfExpression)}`,
        'cdp-chip-neutral',
      ));
    }
    if (vdem.components.cleanElections !== null) {
      keyRow.append(this.metric(
        '\u2705 Clean Elections',
        `${Math.round(vdem.components.cleanElections)}`,
        'cdp-chip-neutral',
      ));
    }
    if (keyRow.children.length > 0) {
      this.governanceBody.append(keyRow);
    }

    // ── Polity score (if available) ──
    if (polity) {
      const polityRow = this.el('div', 'cdp-governance-polity-row');

      const polityLabel = this.el('div', 'cdp-governance-polity-label');
      polityLabel.textContent = 'Polity2 Score';
      polityLabel.style.color = 'var(--text-muted)';
      polityLabel.style.fontSize = '11px';

      const polityBar = this.el('div', 'cdp-polity-bar');
      const polityFill = this.el('div', 'cdp-polity-fill');
      // Polity2 score ranges from -10 to +10; map to 0-100%
      const pct = ((polity.polityScore + 10) / 20) * 100;
      polityFill.style.width = `${Math.max(2, pct)}%`;
      const polityColor = polity.polityScore >= 6 ? '#22c55e'
        : polity.polityScore >= 0 ? '#eab308'
        : '#ef4444';
      polityFill.style.background = polityColor;
      polityBar.append(polityFill);
      polityBar.title = `Polity2: ${polity.polityScore} / +10`;

      const polityValue = this.el('span', 'cdp-polity-value');
      polityValue.textContent = `${polity.polityScore}`;
      polityValue.style.color = polityColor;
      polityValue.style.fontWeight = '700';
      polityValue.style.fontSize = '14px';
      polityValue.style.flexShrink = '0';

      const polityRange = this.el('div', 'cdp-polity-range');
      polityRange.textContent = '(-10 to +10)';
      polityRange.style.color = 'var(--text-faint)';
      polityRange.style.fontSize = '10px';

      polityRow.append(polityLabel, polityBar, polityValue, polityRange);
      this.governanceBody.append(polityRow);
    }
  }

  /** Populate the GEM / Data360 seismic risk section. Stub until Data360 RPC is wired. */
  public updateRiskProfile(countryCode: string): void {
    if (!this.riskProfileBody) return;
    this.riskProfileBody.replaceChildren();
    this.riskProfileBody.append(this.makeEmpty(`No GEM risk data for ${countryCode}`));
  }

  private renderRadarChart(vdem: CountryGovernanceData['vdem']): HTMLElement {
    const { components } = vdem;

    // Five sub-scores for radar: Electoral, Liberal, Participatory, Deliberative, Egalitarian
    const axes: Array<{ key: string; label: string; value: number | null; color: string }> = [
      { key: 'electoral', label: 'Electoral', value: components.electoral, color: '#3b82f6' },
      { key: 'liberal', label: 'Liberal', value: components.liberal, color: '#8b5cf6' },
      { key: 'participatory', label: 'Participatory', value: components.participatory, color: '#06b6d4' },
      { key: 'deliberative', label: 'Deliberative', value: components.deliberative, color: '#f59e0b' },
      { key: 'egalitarian', label: 'Egalitarian', value: components.egalitarian, color: '#10b981' },
    ];

    const wrap = this.el('div', 'cdp-radar-wrap');

    // SVG-based radar chart
    const size = 180;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 70;

    // Compute radial endpoints for each axis
    const radianOffset = -Math.PI / 2; // Start from top
    const points = axes.map((axis, i) => {
      const angle = radianOffset + (2 * Math.PI * i) / axes.length;
      const pct = axis.value !== null ? Math.min(100, Math.max(0, axis.value)) / 100 : 0;
      return {
        x: cx + radius * pct * Math.cos(angle),
        y: cy + radius * pct * Math.sin(angle),
        axis,
        angle,
        pct,
      };
    });

    // Build SVG string
    const gridRings = [0.25, 0.5, 0.75, 1.0];

    let svg = `<svg viewBox="0 0 ${size} ${size}" class="cdp-radar-svg" role="img" aria-label="V-Dem democracy radar chart">`;

    // Grid rings
    for (const ring of gridRings) {
      const ringPoints = axes.map((_, i) => {
        const angle = radianOffset + (2 * Math.PI * i) / axes.length;
        return `${cx + radius * ring * Math.cos(angle)},${cy + radius * ring * Math.sin(angle)}`;
      });
      svg += `<polygon points="${ringPoints.join(' ')}" fill="none" stroke="var(--border-subtle)" stroke-width="0.5"/>`;
    }

    // Grid lines from center to each vertex
    for (let i = 0; i < axes.length; i++) {
      const angle = radianOffset + (2 * Math.PI * i) / axes.length;
      const ex = cx + radius * Math.cos(angle);
      const ey = cy + radius * Math.sin(angle);
      svg += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="var(--border-subtle)" stroke-width="0.5"/>`;
    }

    // Data polygon
    const validPoints = points.filter(p => p.axis.value !== null);
    if (validPoints.length === axes.length) {
      const dataPoints = points.map(p => `${p.x},${p.y}`).join(' ');
      // Semi-transparent fill
      svg += `<polygon points="${dataPoints}" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" stroke-width="1.5"/>`;
    } else {
      // Partial data — draw individual dots instead
      for (const p of validPoints) {
        svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${p.axis.color}"/>`;
      }
    }

    // Data point dots
    for (const p of points) {
      if (p.axis.value !== null) {
        svg += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${p.axis.color}" stroke="var(--panel-bg)" stroke-width="1"/>`;
        svg += `<title>${p.axis.label}: ${Math.round(p.axis.value!)}</title>`;
      }
    }

    // Axis labels
    for (let i = 0; i < axes.length; i++) {
      const axis = axes[i]!;
      const angle = radianOffset + (2 * Math.PI * i) / axes.length;
      const labelRadius = radius + 16;
      const lx = cx + labelRadius * Math.cos(angle);
      const ly = cy + labelRadius * Math.sin(angle);
      svg += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="500">${axis.label}</text>`;
    }

    svg += '</svg>';
    wrap.innerHTML = svg;

    // Score labels below chart
    const legend = this.el('div', 'cdp-radar-legend');
    for (const axis of axes) {
      const item = this.el('div', 'cdp-radar-legend-item');
      const dot = this.el('span', 'cdp-radar-dot');
      dot.style.background = axis.color;
      const labelEl = this.el('span', 'cdp-radar-legend-label', axis.label);
      const valEl = this.el('span', 'cdp-radar-legend-val');
      valEl.textContent = axis.value !== null ? `${Math.round(axis.value)}` : '—';
      item.append(dot, labelEl, valEl);
      legend.append(item);
    }
    wrap.append(legend);

    return wrap;
  }

  private highlightInfrastructure(type: CountryInfraAssetType): void {
    if (!this.map) return;

    // Switch map layer: disable previous infrastructure layer, enable new one
    if (this.activeInfraLayer && this.activeInfraLayer !== type) {
      const prevLayer = ASSET_LAYER_MAP[this.activeInfraLayer];
      if (prevLayer) this.map.disableLayer(prevLayer);
    }
    const nextLayer = ASSET_LAYER_MAP[type];
    if (nextLayer) this.map.enableLayer(nextLayer);
    this.activeInfraLayer = type;

    const assets = this.infrastructureByType.get(type) ?? [];
    if (assets.length === 0) return;
    this.map.flashAssets(type, assets.map((asset) => asset.id));
  }

  private open(): void {
    if (this.panel.classList.contains('active')) return;
    if (!this.panel.isConnected) {
      document.body.appendChild(this.panel);
    }
    this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.panel.classList.add('active');
    this.panel.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', this.handleGlobalKeydown);
    requestAnimationFrame(() => this.closeButton.focus());
    this.onStateChangeCallback?.({ visible: true, maximized: this.isMaximizedState });
  }

  private close(): void {
    if (!this.panel.classList.contains('active')) return;
    this.panel.classList.remove('active');
    this.panel.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    if (this.lastFocusedElement) this.lastFocusedElement.focus();
  }

  private getFocusableElements(): HTMLElement[] {
    const selectors = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    return Array.from(this.panel.querySelectorAll<HTMLElement>(selectors))
      .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null);
  }

  private setupScrollButtons(): void {
    const scrollUp = this.panel.querySelector<HTMLButtonElement>('#cdp-scroll-top');
    const scrollDown = this.panel.querySelector<HTMLButtonElement>('#cdp-scroll-bottom');
    if (!scrollUp || !scrollDown) return;

    const update = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = this.content;
      const atTop = scrollTop < 80;
      const atBottom = scrollTop >= scrollHeight - clientHeight - 80;
      scrollUp.classList.toggle('cdp-scroll-btn--visible', !atTop);
      scrollDown.classList.toggle('cdp-scroll-btn--visible', !atBottom);
    };

    this.content.addEventListener('scroll', update, { passive: true });
    // Re-evaluate whenever new content is rendered
    const observer = new ResizeObserver(update);
    observer.observe(this.content);

    scrollUp.addEventListener('click', () => {
      this.content.scrollTo({ top: 0, behavior: 'smooth' });
    });
    scrollDown.addEventListener('click', () => {
      this.content.scrollTo({ top: this.content.scrollHeight, behavior: 'smooth' });
    });
  }

  private getOrCreatePanel(): HTMLElement {
    const existing = document.getElementById('country-deep-dive-panel');
    if (existing) return existing;

    const panel = this.el('aside', 'country-deep-dive');
    panel.id = 'country-deep-dive-panel';
    panel.setAttribute('aria-label', 'Country Intelligence');
    panel.setAttribute('aria-hidden', 'true');

    const shell = this.el('div', 'country-deep-dive-shell');
    const close = this.el('button', 'panel-close', '×') as HTMLButtonElement;
    close.id = 'deep-dive-close';
    close.setAttribute('aria-label', 'Close');

    const content = this.el('div', 'panel-content');
    content.id = 'deep-dive-content';

    const scrollUp = this.el('button', 'cdp-scroll-btn cdp-scroll-btn--top') as HTMLButtonElement;
    scrollUp.id = 'cdp-scroll-top';
    scrollUp.setAttribute('aria-label', 'Scroll to top');
    scrollUp.textContent = '↑';

    const scrollDown = this.el('button', 'cdp-scroll-btn cdp-scroll-btn--bottom') as HTMLButtonElement;
    scrollDown.id = 'cdp-scroll-bottom';
    scrollDown.setAttribute('aria-label', 'Scroll to bottom');
    scrollDown.textContent = '↓';

    shell.append(close, content, scrollUp, scrollDown);
    panel.append(shell);
    document.body.append(panel);
    return panel;
  }

  private sectionCard(
    title: string,
    options?: { onClick?: () => void; ariaLabel?: string },
  ): [HTMLElement, HTMLElement] {
    const card = this.el('section', 'cdp-card');
    const heading = options?.onClick
      ? this.buildCardTitleButton(title, options.onClick, options.ariaLabel)
      : this.el('h3', 'cdp-card-title', title);
    const body = this.el('div', 'cdp-card-body');
    card.append(heading, body);
    return [card, body];
  }

  private buildCardTitleButton(title: string, onClick: () => void, ariaLabel?: string): HTMLButtonElement {
    const button = this.el('button', 'cdp-card-title cdp-card-title-btn', title) as HTMLButtonElement;
    button.type = 'button';
    if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', onClick);
    return button;
  }

  private metric(label: string, value: string, chipClass: string): HTMLElement {
    const box = this.el('div', 'cdp-metric');
    box.append(
      this.el('span', 'cdp-metric-label', label),
      this.badge(value, `cdp-metric-value ${chipClass}`),
    );
    return box;
  }

  private makeLoading(text: string): HTMLElement {
    const wrap = this.el('div', 'cdp-loading-inline');
    wrap.append(
      this.el('div', 'cdp-loading-line'),
      this.el('div', 'cdp-loading-line cdp-loading-line-short'),
      this.el('span', 'cdp-loading-text', text),
    );
    return wrap;
  }

  private makeEmpty(text: string): HTMLElement {
    return this.el('div', 'cdp-empty', text);
  }

  private badge(text: string, className: string): HTMLElement {
    return this.el('span', className, text);
  }

  private formatBrief(text: string, headlineCount = 0): string {
    let html = escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');

    if (headlineCount > 0) {
      html = html.replace(/\[(\d{1,2})\]/g, (_match, numStr) => {
        const n = parseInt(numStr, 10);
        if (n >= 1 && n <= headlineCount) {
          return `<a href="#cdp-news-${n}" class="cb-citation">[${n}]</a>`;
        }
        return `[${numStr}]`;
      });
    }

    return html;
  }

  private summarizeBrief(brief: string): string {
    const normalized = brief.replace(/\s+/g, ' ').trim();
    const sentences = normalized.split(/(?<=[.!?])\s+/).filter((part) => part.length > 0);
    return sentences.slice(0, 3).join(' ') || normalized;
  }

  private trendArrow(trend: CountryScore['trend']): string {
    if (trend === 'rising') return '↑';
    if (trend === 'falling') return '↓';
    return '→';
  }

  private ciiBand(score: number): 'stable' | 'elevated' | 'high' | 'critical' {
    if (score <= 25) return 'stable';
    if (score <= 50) return 'elevated';
    if (score <= 75) return 'high';
    return 'critical';
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  private toThreatLevel(level: string | undefined): ThreatLevel {
    if (level === 'critical' || level === 'high' || level === 'medium' || level === 'low' || level === 'info') {
      return level;
    }
    return 'low';
  }

  private toTimestamp(date: Date | string): number {
    const d = date instanceof Date ? date : new Date(date);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  }

  private shortDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Unknown';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private formatRelativeTime(value: Date | string): string {
    const ms = Date.now() - this.toTimestamp(value);
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return t('countryBrief.timeAgo.m', { count: 1 });
    if (mins < 60) return t('countryBrief.timeAgo.m', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('countryBrief.timeAgo.h', { count: hours });
    const days = Math.floor(hours / 24);
    return t('countryBrief.timeAgo.d', { count: days });
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  public static toFlagEmoji(code: string): string {
    const upperCode = code.toUpperCase();
    if (!/^[A-Z]{2}$/.test(upperCode)) return '🌍';
    return upperCode
      .split('')
      .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
      .join('');
  }
}
