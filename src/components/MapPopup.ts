import type { ConflictZone, Hotspot, NewsItem, MilitaryBase, StrategicWaterway, APTGroup, NuclearFacility, EconomicCenter, GammaIrradiator, Pipeline, UnderseaCable, CableAdvisory, RepairShip, InternetOutage, AIDataCenter, AisDisruptionEvent, SocialUnrestEvent, MilitaryFlight, MilitaryVessel, MilitaryFlightCluster, MilitaryVesselCluster, NaturalEvent, Port, Spaceport, CriticalMineralProject, CyberThreat, GulfInvestment, UcdpGeoEvent } from '@/types';
import type { PositiveGeoEvent } from '@/services/positive-events-geo';
import type { KindnessPoint } from '@/services/kindness-data';
import type { SpeciesRecovery } from '@/services/conservation-data';
import type { RenewableInstallation } from '@/services/renewable-installations';
import type { AirportDelayAlert, PositionSample } from '@/services/aviation';
import type { AisPositionData, MaritimeGeospatialFeature } from '@/services/maritime';
import type { GeoPredictionMarket } from '@/services/prediction';
import type { Earthquake } from '@/services/earthquakes';
import type { WeatherAlert } from '@/services/weather';
import type { StartupHub, Accelerator, TechHQ, CloudRegion } from '@/config/tech-geo';
import type { TradeRouteSegment } from '@/config/trade-routes';
import type { CommodityPort } from '@/config/commodity-geo';
import type { TechHubActivity } from '@/services/tech-activity';
import type { GeoHubActivity } from '@/services/geo-activity';
import { isMobileDevice } from '@/utils';
import { escapeHtml } from '@/utils/sanitize';
import { t } from '@/services/i18n';
import { fetchHotspotContext } from '@/services/gdelt-intel';
import { isModifiedArticleClick, openArticleFromElement } from '@/services/article-open';
import type {
  TechEventPopupData, TechHQClusterData, TechEventClusterData,
  GpsJammingPopupData, IranEventPopupData, StockExchangePopupData,
  FinancialCenterPopupData, CentralBankPopupData, CommodityHubPopupData,
  ProtestClusterData, DatacenterClusterData,
} from './popup/types';
import {
  renderConflictPopup, renderHotspotPopup, renderGdeltArticle,
  renderEarthquakePopup, renderWeatherPopup, renderBasePopup,
  renderWaterwayPopup, renderNuclearPopup, renderEconomicPopup,
  renderIrradiatorPopup, renderPipelinePopup, renderFirePopup,
  renderPositiveEventPopup, renderKindnessEventPopup, renderUcdpEventPopup,
  renderSpeciesRecoveryPopup, renderRenewableInstallationPopup,
} from './popup/renderers-geo';
import {
  renderMilitaryFlightPopup, renderMilitaryVesselPopup,
  renderMilitaryFlightClusterPopup, renderMilitaryVesselClusterPopup,
  renderAircraftPopup, renderFlightPopup,
} from './popup/renderers-military';
import {
  renderCablePopup, renderCableAdvisoryPopup, renderRepairShipPopup,
  renderOutagePopup, renderDatacenterPopup, renderDatacenterClusterPopup,
  renderPortPopup, renderSpaceportPopup, renderMineralPopup,
} from './popup/renderers-infra';
import {
  renderProtestPopup, renderProtestClusterPopup, renderAisPopup,
  renderAisVesselPopup, renderNaturalEventPopup, renderIranEventPopup,
  renderGpsJammingPopup, renderTechActivityPopup, renderGeoActivityPopup,
  renderGulfInvestmentPopup, renderMaritimeGeospatialPopup,
} from './popup/renderers-events';
import {
  renderStartupHubPopup, renderCloudRegionPopup, renderTechHQPopup,
  renderAcceleratorPopup, renderTechEventPopup, renderTechHQClusterPopup,
  renderTechEventClusterPopup,
} from './popup/renderers-tech';
import {
  renderStockExchangePopup, renderFinancialCenterPopup,
  renderCentralBankPopup, renderCommodityHubPopup,
  renderCommodityPortPopup, renderTradeRoutePopup,
} from './popup/renderers-finance';
import {
  renderAPTPopup, renderCyberThreatPopup,
} from './popup/renderers-special';

export type PopupType = 'conflict' | 'hotspot' | 'earthquake' | 'weather' | 'base' | 'waterway' | 'apt' | 'cyberThreat' | 'nuclear' | 'economic' | 'irradiator' | 'pipeline' | 'cable' | 'cable-advisory' | 'repair-ship' | 'outage' | 'datacenter' | 'datacenterCluster' | 'ais' | 'aisVessel' | 'maritimeGeo' | 'protest' | 'protestCluster' | 'flight' | 'aircraft' | 'militaryFlight' | 'militaryVessel' | 'militaryFlightCluster' | 'militaryVesselCluster' | 'natEvent' | 'port' | 'spaceport' | 'mineral' | 'startupHub' | 'cloudRegion' | 'techHQ' | 'accelerator' | 'techEvent' | 'techHQCluster' | 'techEventCluster' | 'techActivity' | 'geoActivity' | 'stockExchange' | 'financialCenter' | 'centralBank' | 'commodityHub' | 'iranEvent' | 'gpsJamming' | 'gulfInvestment' | 'tradeRoute' | 'commodityPort' | 'fire' | 'positiveEvent' | 'kindnessEvent' | 'ucdpEvent' | 'speciesRecovery' | 'renewableInstallation' | 'company' | 'predictionMarket' | 'crypto' | 'article' | 'ciiCountry' | 'governanceCountry' | 'sanctionsCountry' | 'democracyCountry' | 'gemRiskCountry' | 'congressPolitician' | 'institution' | 'congressTrade' | 'sector';

interface PopupData {
  type: PopupType;
  data: ConflictZone | Hotspot | Earthquake | WeatherAlert | MilitaryBase | StrategicWaterway | APTGroup | CyberThreat | NuclearFacility | EconomicCenter | GeoPredictionMarket | GammaIrradiator | Pipeline | UnderseaCable | CableAdvisory | RepairShip | InternetOutage | AIDataCenter | AisDisruptionEvent | MaritimeGeospatialFeature | SocialUnrestEvent | AirportDelayAlert | PositionSample | MilitaryFlight | MilitaryVessel | MilitaryFlightCluster | MilitaryVesselCluster | NaturalEvent | Port | Spaceport | CriticalMineralProject | StartupHub | CloudRegion | TechHQ | Accelerator | TechEventPopupData | TechHQClusterData | TechEventClusterData | ProtestClusterData | DatacenterClusterData | TechHubActivity | GeoHubActivity | StockExchangePopupData | FinancialCenterPopupData | CentralBankPopupData | CommodityHubPopupData | IranEventPopupData | GpsJammingPopupData | GulfInvestment | TradeRouteSegment | CommodityPort | { region?: string; brightness?: number; frp?: number; acq_date?: string } | PositiveGeoEvent | KindnessPoint | UcdpGeoEvent | SpeciesRecovery | RenewableInstallation;
  relatedNews?: NewsItem[];
  x: number;
  y: number;
}

function formatPredictionMarketVolume(volume?: number): string {
  if (!volume) return 'Volume unavailable';
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M volume`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K volume`;
  return `$${volume.toFixed(0)} volume`;
}

function renderPredictionMarketPopup(market: GeoPredictionMarket): string {
  const yes = Number(market.yesPrice ?? 50);
  const no = 100 - yes;
  const conviction = Math.abs(yes - 50) / 50;
  const r = Math.round(125 + conviction * 40);
  const g = Math.round(190 + conviction * 28);
  const barColor = `rgb(${r},${g},255)`;
  const yesStr = yes.toFixed(0);
  const noStr = no.toFixed(0);
  const daysStr = (() => {
    if (!market.endDate) return '';
    const days = Math.ceil((new Date(market.endDate).getTime() - Date.now()) / 86_400_000);
    return days > 0 ? `<span class="pm-popup-days">${days}d left</span>` : '';
  })();
  return `
    <div class="popup-header predictionMarket">
      <div class="pm-popup-header-content">
        <h3>${escapeHtml(market.title)}</h3>
      </div>
      <button class="popup-close">&times;</button>
    </div>
    <div class="popup-content">
      <div class="pm-popup-probs">
        <div class="pm-popup-outcome">
          <span class="pm-popup-pct" style="color:${barColor}">${yesStr}%</span>
          <span class="pm-popup-outcome-label">YES</span>
        </div>
        <div class="pm-popup-bar">
          <div class="pm-popup-bar-fill" style="width:${yesStr}%;background:${barColor}"></div>
        </div>
        <div class="pm-popup-outcome pm-popup-outcome--no">
          <span class="pm-popup-pct pm-popup-pct--no">${noStr}%</span>
          <span class="pm-popup-outcome-label">NO</span>
        </div>
      </div>
      <div class="pm-popup-meta">
        <span>${escapeHtml(market.country)}</span>
        <span class="pm-popup-meta-dot">·</span>
        <span>${escapeHtml(formatPredictionMarketVolume(market.volume))}</span>
        ${daysStr}
      </div>
    </div>
  `;
}

export class MapPopup {
  private container: HTMLElement;
  private popup: HTMLElement | null = null;
  private onClose?: () => void;
  private cableAdvisories: CableAdvisory[] = [];
  private repairShips: RepairShip[] = [];
  private isMobileSheet = false;
  private sheetTouchStartY: number | null = null;
  private sheetCurrentOffset = 0;
  private readonly mobileDismissThreshold = 96;
  private outsideListenerTimeoutId: number | null = null;
  private currentData: PopupData | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public show(data: PopupData): void {
    this.hide();
    this.currentData = data;

    this.isMobileSheet = isMobileDevice();
    this.popup = document.createElement('div');
    this.popup.className = this.isMobileSheet ? 'map-popup map-popup-sheet' : 'map-popup';

    const content = this.renderContent(data);
    this.popup.innerHTML = this.isMobileSheet
      ? `<button class="map-popup-sheet-handle" aria-label="${t('common.close')}"></button>${content}`
      : content;

    // Get container's viewport position for absolute positioning
    const containerRect = this.container.getBoundingClientRect();

    if (this.isMobileSheet) {
      this.popup.style.left = '';
      this.popup.style.top = '';
      this.popup.style.transform = '';
    } else {
      this.positionDesktopPopup(data, containerRect);
    }

    // Append to body to avoid container overflow clipping
    document.body.appendChild(this.popup);
    this.popup.scrollTop = 0;
    const popupBody = this.popup.querySelector<HTMLElement>('.popup-body');
    if (popupBody) popupBody.scrollTop = 0;

    // Close button handler via event delegation on the popup element.
    // This avoids re-querying and re-attaching listeners after innerHTML.
    this.popup.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.popup-close') || target.closest('.map-popup-sheet-handle')) {
        this.hide();
        return;
      }
      const articleTarget = target.closest<HTMLElement>('[data-article-url]');
      if (articleTarget && e instanceof MouseEvent && !isModifiedArticleClick(e) && openArticleFromElement(articleTarget)) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return;
      }
      const toggle = target.closest('.cluster-toggle') as HTMLButtonElement | null;
      if (toggle) {
        const hidden = toggle.previousElementSibling as HTMLElement | null;
        if (!hidden) return;
        const expanded = hidden.style.display !== 'none';
        hidden.style.display = expanded ? 'none' : '';
        toggle.textContent = expanded ? (toggle.dataset.more ?? '') : (toggle.dataset.less ?? '');
        return;
      }

      const vesselRow = target.closest('.cluster-vessel-item[data-vessel-index]') as HTMLButtonElement | null;
      if (vesselRow && this.currentData?.type === 'militaryVesselCluster') {
        const cluster = this.currentData.data as MilitaryVesselCluster;
        const index = Number(vesselRow.dataset.vesselIndex);
        const vessel = Number.isInteger(index) ? cluster.vessels[index] : undefined;
        if (vessel) {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: { type: 'militaryVessel', data: vessel },
          }));
          this.hide();
        }
        return;
      }

      const flightRow = target.closest('.cluster-flight-item[data-flight-index]') as HTMLButtonElement | null;
      if (flightRow && this.currentData?.type === 'militaryFlightCluster') {
        const cluster = this.currentData.data as MilitaryFlightCluster;
        const index = Number(flightRow.dataset.flightIndex);
        const flight = Number.isInteger(index) ? cluster.flights[index] : undefined;
        if (flight) {
          document.dispatchEvent(new CustomEvent('wm:open-entity-detail', {
            detail: { type: 'militaryFlight', data: flight },
          }));
          this.hide();
        }
      }
    });

    if (this.isMobileSheet) {
      this.popup.addEventListener('touchstart', this.handleSheetTouchStart, { passive: true });
      this.popup.addEventListener('touchmove', this.handleSheetTouchMove, { passive: false });
      this.popup.addEventListener('touchend', this.handleSheetTouchEnd);
      this.popup.addEventListener('touchcancel', this.handleSheetTouchEnd);
      requestAnimationFrame(() => {
        if (!this.popup) return;
        this.popup.classList.add('open');
        // Remove will-change after slide-in transition to free GPU memory
        this.popup.addEventListener('transitionend', () => {
          if (this.popup) this.popup.style.willChange = 'auto';
        }, { once: true });
      });
    }

    // Click outside to close
    if (this.outsideListenerTimeoutId !== null) {
      window.clearTimeout(this.outsideListenerTimeoutId);
    }
    this.outsideListenerTimeoutId = window.setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
      document.addEventListener('touchstart', this.handleOutsideClick);
      document.addEventListener('keydown', this.handleEscapeKey);
      this.outsideListenerTimeoutId = null;
    }, 0);
  }

  private positionDesktopPopup(data: PopupData, containerRect: DOMRect): void {
    if (!this.popup) return;

    const minMargin = 20; // Minimum margin from viewport edges
    const bottomBuffer = 50; // Buffer from viewport bottom
    const topBuffer = 80; // Header height + breathing room
    const maxPopupWidth = Math.min(380, Math.max(240, window.innerWidth - minMargin * 2));
    const topLimit = Math.max(topBuffer, containerRect.top + minMargin);
    const bottomLimit = Math.min(window.innerHeight - bottomBuffer, containerRect.bottom - minMargin);

    this.popup.style.width = `${maxPopupWidth}px`;

    // Cap popup height to available vertical space before measuring
    const maxAllowedHeight = Math.max(160, bottomLimit - topLimit);
    this.popup.style.maxHeight = `${maxAllowedHeight}px`;

    // Temporarily append popup off-screen to measure actual height
    this.popup.style.visibility = 'hidden';
    this.popup.style.top = '0';
    this.popup.style.left = '-9999px';
    document.body.appendChild(this.popup);
    const rawPopupHeight = this.popup.offsetHeight;
    const popupWidth = Math.min(this.popup.offsetWidth || maxPopupWidth, maxPopupWidth);
    document.body.removeChild(this.popup);
    this.popup.style.visibility = '';

    const popupHeight = Math.min(rawPopupHeight, maxAllowedHeight);

    // Convert container-relative coords to viewport coords
    const viewportX = containerRect.left + data.x;
    const viewportY = containerRect.top + data.y;

    // Horizontal positioning — constrain to map container bounds so the popup
    // never escapes into the panels grid in side-by-side layout.
    const containerRight = containerRect.right; // right edge of map in viewport coords
    const spaceToRight = containerRight - viewportX - minMargin;
    const spaceToLeft = viewportX - containerRect.left - minMargin;

    let left: number;
    if (spaceToRight >= popupWidth) {
      // Enough space to the right within the map container
      left = viewportX + 20;
    } else if (spaceToLeft >= popupWidth) {
      // Flip left — still within the map container
      left = viewportX - popupWidth - 20;
    } else {
      // Not enough space on either side — centre within the container
      left = containerRect.left + (containerRect.width - popupWidth) / 2;
    }

    // Hard clamp: keep the popup inside both the map frame and the viewport.
    // This prevents the hotspot header badge from getting pushed off-screen on
    // narrow layouts or when the map is docked against the viewport edge.
    const minLeft = Math.max(minMargin, containerRect.left + minMargin);
    const maxLeft = Math.min(window.innerWidth - popupWidth - minMargin, containerRight - popupWidth - minMargin);
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

    // Vertical positioning - prefer below click, but flip above if needed
    const availableBelow = bottomLimit - viewportY;
    const availableAbove = viewportY - topLimit;

    let top: number;
    if (availableBelow >= popupHeight) {
      // Enough space below - position below click
      top = viewportY + 10;
    } else if (availableAbove >= popupHeight) {
      // Not enough below, but enough above - position above click
      top = viewportY - popupHeight - 10;
    } else {
      // Limited space both ways - position at top buffer
      top = topBuffer;
    }

    // Keep the popup inside the visible map frame as well as the viewport.
    top = Math.max(topLimit, top);
    const maxTop = Math.max(topLimit, bottomLimit - popupHeight);
    top = Math.min(top, maxTop);

    // Tighten max-height to the space actually available from this position so
    // async content (GDELT articles) that loads after positioning can never push
    // the popup below the viewport.
    const fittingMaxHeight = Math.max(160, bottomLimit - top);
    this.popup.style.maxHeight = `${Math.min(maxAllowedHeight, fittingMaxHeight)}px`;

    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
  }

  private handleOutsideClick = (e: Event) => {
    if (this.popup && !this.popup.contains(e.target as Node)) {
      this.hide();
    }
  };

  private handleEscapeKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.hide();
    }
  };

  private handleSheetTouchStart = (e: TouchEvent): void => {
    if (!this.popup || !this.isMobileSheet || e.touches.length !== 1) return;

    const target = e.target as HTMLElement | null;
    const popupBody = this.popup.querySelector('.popup-body');
    if (target?.closest('.popup-body') && popupBody && popupBody.scrollTop > 0) {
      this.sheetTouchStartY = null;
      return;
    }

    this.sheetTouchStartY = e.touches[0]?.clientY ?? null;
    this.sheetCurrentOffset = 0;
    this.popup.classList.add('dragging');
  };

  private handleSheetTouchMove = (e: TouchEvent): void => {
    if (!this.popup || !this.isMobileSheet || this.sheetTouchStartY === null) return;

    const currentY = e.touches[0]?.clientY;
    if (currentY == null) return;

    const delta = Math.max(0, currentY - this.sheetTouchStartY);
    if (delta <= 0) return;

    this.sheetCurrentOffset = delta;
    this.popup.style.transform = `translate3d(0, ${delta}px, 0)`;
    e.preventDefault();
  };

  private handleSheetTouchEnd = (): void => {
    if (!this.popup || !this.isMobileSheet || this.sheetTouchStartY === null) return;

    const shouldDismiss = this.sheetCurrentOffset >= this.mobileDismissThreshold;
    this.popup.classList.remove('dragging');
    this.sheetTouchStartY = null;

    if (shouldDismiss) {
      this.hide();
      return;
    }

    this.sheetCurrentOffset = 0;
    this.popup.style.transform = '';
    this.popup.classList.add('open');
  };

  public hide(): void {
    if (this.outsideListenerTimeoutId !== null) {
      window.clearTimeout(this.outsideListenerTimeoutId);
      this.outsideListenerTimeoutId = null;
    }

    if (this.popup) {
      this.popup.removeEventListener('touchstart', this.handleSheetTouchStart);
      this.popup.removeEventListener('touchmove', this.handleSheetTouchMove);
      this.popup.removeEventListener('touchend', this.handleSheetTouchEnd);
      this.popup.removeEventListener('touchcancel', this.handleSheetTouchEnd);
      this.popup.remove();
      this.popup = null;
      this.currentData = null;
      this.isMobileSheet = false;
      this.sheetTouchStartY = null;
      this.sheetCurrentOffset = 0;
      document.removeEventListener('click', this.handleOutsideClick);
      document.removeEventListener('touchstart', this.handleOutsideClick);
      document.removeEventListener('keydown', this.handleEscapeKey);
      this.onClose?.();
    }
  }

  public setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  public setCableActivity(advisories: CableAdvisory[], repairShips: RepairShip[]): void {
    this.cableAdvisories = advisories;
    this.repairShips = repairShips;
  }

  private renderContent(data: PopupData): string {
    switch (data.type) {
      case 'conflict':
        return renderConflictPopup(data.data as ConflictZone);
      case 'hotspot':
        return renderHotspotPopup(data.data as Hotspot, data.relatedNews);
      case 'earthquake':
        return renderEarthquakePopup(data.data as Earthquake);
      case 'weather':
        return renderWeatherPopup(data.data as WeatherAlert);
      case 'base':
        return renderBasePopup(data.data as MilitaryBase);
      case 'waterway':
        return renderWaterwayPopup(data.data as StrategicWaterway);
      case 'apt':
        return renderAPTPopup(data.data as APTGroup);
      case 'cyberThreat':
        return renderCyberThreatPopup(data.data as CyberThreat);
      case 'nuclear':
        return renderNuclearPopup(data.data as NuclearFacility);
      case 'economic':
        return renderEconomicPopup(data.data as EconomicCenter);
      case 'predictionMarket':
        return renderPredictionMarketPopup(data.data as GeoPredictionMarket);
      case 'irradiator':
        return renderIrradiatorPopup(data.data as GammaIrradiator);
      case 'pipeline':
        return renderPipelinePopup(data.data as Pipeline);
      case 'cable':
        return renderCablePopup(data.data as UnderseaCable, this.cableAdvisories, this.repairShips);
      case 'cable-advisory':
        return renderCableAdvisoryPopup(data.data as CableAdvisory);
      case 'repair-ship':
        return renderRepairShipPopup(data.data as RepairShip);
      case 'outage':
        return renderOutagePopup(data.data as InternetOutage);
      case 'datacenter':
        return renderDatacenterPopup(data.data as AIDataCenter);
      case 'datacenterCluster':
        return renderDatacenterClusterPopup(data.data as DatacenterClusterData);
      case 'ais':
        return renderAisPopup(data.data as AisDisruptionEvent);
      case 'aisVessel':
        return renderAisVesselPopup(data.data as AisPositionData);
      case 'maritimeGeo':
        return renderMaritimeGeospatialPopup(data.data as MaritimeGeospatialFeature);
      case 'protest':
        return renderProtestPopup(data.data as SocialUnrestEvent);
      case 'protestCluster':
        return renderProtestClusterPopup(data.data as ProtestClusterData);
      case 'flight':
        return renderFlightPopup(data.data as AirportDelayAlert);
      case 'aircraft':
        return renderAircraftPopup(data.data as PositionSample);
      case 'militaryFlight':
        return renderMilitaryFlightPopup(data.data as MilitaryFlight);
      case 'militaryVessel':
        return renderMilitaryVesselPopup(data.data as MilitaryVessel);
      case 'militaryFlightCluster':
        return renderMilitaryFlightClusterPopup(data.data as MilitaryFlightCluster);
      case 'militaryVesselCluster':
        return renderMilitaryVesselClusterPopup(data.data as MilitaryVesselCluster);
      case 'natEvent':
        return renderNaturalEventPopup(data.data as NaturalEvent);
      case 'port':
        return renderPortPopup(data.data as Port);
      case 'spaceport':
        return renderSpaceportPopup(data.data as Spaceport);
      case 'mineral':
        return renderMineralPopup(data.data as CriticalMineralProject);
      case 'startupHub':
        return renderStartupHubPopup(data.data as StartupHub);
      case 'cloudRegion':
        return renderCloudRegionPopup(data.data as CloudRegion);
      case 'techHQ':
        return renderTechHQPopup(data.data as TechHQ);
      case 'accelerator':
        return renderAcceleratorPopup(data.data as Accelerator);
      case 'techEvent':
        return renderTechEventPopup(data.data as TechEventPopupData);
      case 'techHQCluster':
        return renderTechHQClusterPopup(data.data as TechHQClusterData);
      case 'techEventCluster':
        return renderTechEventClusterPopup(data.data as TechEventClusterData);
      case 'techActivity':
        return renderTechActivityPopup(data.data as TechHubActivity);
      case 'geoActivity':
        return renderGeoActivityPopup(data.data as GeoHubActivity);
      case 'stockExchange':
        return renderStockExchangePopup(data.data as StockExchangePopupData);
      case 'financialCenter':
        return renderFinancialCenterPopup(data.data as FinancialCenterPopupData);
      case 'centralBank':
        return renderCentralBankPopup(data.data as CentralBankPopupData);
      case 'commodityHub':
        return renderCommodityHubPopup(data.data as CommodityHubPopupData);
      case 'iranEvent':
        return renderIranEventPopup(data.data as IranEventPopupData);
      case 'gpsJamming':
        return renderGpsJammingPopup(data.data as GpsJammingPopupData);
      case 'gulfInvestment':
        return renderGulfInvestmentPopup(data.data as GulfInvestment);
      case 'tradeRoute':
        return renderTradeRoutePopup(data.data as TradeRouteSegment);
      case 'commodityPort':
        return renderCommodityPortPopup(data.data as CommodityPort);
      case 'fire':
        return renderFirePopup(data.data as { region?: string; brightness?: number; frp?: number; acq_date?: string });
      case 'positiveEvent':
        return renderPositiveEventPopup(data.data as PositiveGeoEvent);
      case 'kindnessEvent':
        return renderKindnessEventPopup(data.data as KindnessPoint);
      case 'ucdpEvent':
        return renderUcdpEventPopup(data.data as UcdpGeoEvent);
      case 'speciesRecovery':
        return renderSpeciesRecoveryPopup(data.data as SpeciesRecovery);
      case 'renewableInstallation':
        return renderRenewableInstallationPopup(data.data as RenewableInstallation);
      default:
        return '';
    }
  }

  public async loadHotspotGdeltContext(hotspot: Hotspot): Promise<void> {
    if (!this.popup) return;

    const container = this.popup.querySelector('.hotspot-gdelt-context');
    if (!container) return;

    try {
      const articles = await fetchHotspotContext(hotspot);

      if (!this.popup || !container.isConnected) return;

      if (articles.length === 0) {
        container.innerHTML = `
          <div class="hotspot-gdelt-header">${t('popups.liveIntel')}</div>
          <div class="hotspot-gdelt-loading">${t('popups.noCoverage')}</div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="hotspot-gdelt-header">${t('popups.liveIntel')}</div>
        <div class="hotspot-gdelt-articles">
          ${articles.slice(0, 5).map(article => renderGdeltArticle(article)).join('')}
        </div>
      `;
    } catch (error) {
      if (container.isConnected) {
        container.innerHTML = `
          <div class="hotspot-gdelt-header">${t('popups.liveIntel')}</div>
          <div class="hotspot-gdelt-loading">${t('common.error')}</div>
        `;
      }
    }
  }
}
