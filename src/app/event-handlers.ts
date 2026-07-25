import type { AppContext, AppModule } from '@/app/app-context';
import { log } from '@/utils/logger';
import type { AirlineIntelPanel } from '@/components/AirlineIntelPanel';
import type { PanelConfig, CustomFeed } from '@/types';
import type { MarketplaceVariant } from '@/types/marketplace';
import type { MapView } from '@/components';
import type { ClusteredEvent } from '@/types';
import type { DashboardSnapshot } from '@/services/storage';
import {
  PlaybackControl,
  StatusPanel,
  CIIPanel,
  PredictionPanel,
} from '@/components';
import {
  debounce,
  saveToStorage,
  ExportPanel,
  generateId,
  getCurrentTheme,
  setThemeWithLinkedMap,
} from '@/utils';
import { applyStoredMapHeight, scheduleMapResize } from '@/utils/map-layout-height';
import { startSearchTicker } from '@/utils/search-ticker';
import { buildLiveSearchTickerPhrases } from '@/utils/live-search-suggestions';
import {
  IDLE_PAUSE_MS,
  STORAGE_KEYS,
  SITE_VARIANT,
  LAYER_TO_SOURCE,
  FEEDS,
  INTEL_SOURCES,
  DEFAULT_PANELS,
  MONITOR_COLORS,
  getMissionPack,
  getVariantStorageKey,
} from '@/config';
import {
  saveSnapshot,
  initAisStream,
  disconnectAisStream,
  subscribeToAuth,
} from '@/services';
import { isLoggedIn } from '@/services/user-auth';
import {
  trackPanelView,
  trackVariantSwitch,
  trackThemeChanged,
  trackMapViewChange,
  trackMapLayerToggle,
  trackPanelToggled,
} from '@/services/analytics';
import { invokeTauri } from '@/services/tauri-bridge';
import { dataFreshness } from '@/services/data-freshness';
import { getEnrichmentDataSourceId } from '@/services/enrichment-gates';
import { mlWorker } from '@/services/ml-worker';
import { UnifiedSettings } from '@/components/UnifiedSettings';
import { AgentChatPanel } from '@/components/AgentChatPanel';
import { SituationReportPanel } from '@/components/SituationReportPanel';
import { DataSourcesPanel } from '@/components/DataSourcesPanel';
import { VisitorCounter } from '@/components/VisitorCounter';
import { SituationRoomDrawer } from '@/components/SituationRoomDrawer';
import { NotificationCenter } from '@/components/NotificationCenter';
import { WhatsNewPanel } from '@/components/WhatsNewPanel';
import { OnboardingHints } from '@/components/OnboardingHints';
import { MAP_MODE_CHANGE_EVENT } from '@/components/MapContainer';
import { t } from '@/services/i18n';
import { TvModeController } from '@/services/tv-mode';
import { buildShareUrl } from './event-handler-view';
import { showShellNotification } from './shell-notifications';
import { checkFeatureAccess } from '@/services/auth-modal';
import { forceSaveToCloud } from '@/services/preferences-sync';
import { getHeaderTimezone } from '@/services/preferences-content';
import { loadAlertRules, normalizeAlertRule, saveAlertRules } from '@/services/alert-rules';
import { formatClockTime } from './header-clock';
import { savePanelLayoutSnapshot } from './layout-snapshot';
import { SourceStatusPanel } from '@/components/SourceStatusPanel';
import {
  applyPanelDensity,
  confirmAndResetLayout,
  openMobileHelpSheet,
  setupMobileHelpSheet,
  setupShellGuidance,
  togglePanelDensity,
} from './event-handler-shell-ui';

const WORKSPACE_SETUP_DISMISSED_KEY = 'wm-workspace-setup-dismissed-v1';

export interface EventHandlerCallbacks {
  updateSearchIndex: () => void;
  loadAllData: () => Promise<void>;
  loadDataForPanel: (panelKey: string) => void;
  flushStaleRefreshes: () => void;
  setHiddenSince: (ts: number) => void;
  loadDataForLayer: (layer: string) => void;
  waitForAisData: () => void;
  syncDataFreshnessWithLayers: () => void;
  ensureCorrectZones: () => void;
  refreshOpenCountryBrief?: () => void;
  openCountryBriefByCode?: (code: string, country: string) => void;
  openCountryBrief?: (lat: number, lon: number) => void;
}

export class EventHandlerManager implements AppModule {
  private ctx: AppContext;
  private callbacks: EventHandlerCallbacks;

  private handlers = {
    fullscreen:           null as (() => void) | null,
    resize:               null as (() => void) | null,
    visibility:           null as (() => void) | null,
    desktopExternalLink:  null as ((e: MouseEvent) => void) | null,
    idleReset:            null as ((e: Event) => void) | null,
    storage:              null as ((e: StorageEvent) => void) | null,
    tvKeydown:            null as ((e: KeyboardEvent) => void) | null,
    focalPointsReady:     null as (() => void) | null,
    themeChanged:         null as (() => void) | null,
    mapResizeMove:        null as ((e: PointerEvent) => void) | null,
    mapEndResize:         null as (() => void) | null,
    bloombergKey:         null as ((e: KeyboardEvent) => void) | null,
    mapResizeVisChange:   null as (() => void) | null,
    mapFullscreenEsc:     null as ((e: KeyboardEvent) => void) | null,
    mobileMenuKey:        null as ((e: KeyboardEvent) => void) | null,
    missionPackApply:     null as ((e: Event) => void) | null,
    mapModeChanged:       null as ((e: Event) => void) | null,
  };
  private kbShortcutsOverlay: HTMLElement | null = null;
  private statusDropdownEl: SourceStatusPanel | null = null;
  private statusDropdownTimer: ReturnType<typeof setTimeout> | null = null;
  private statusDropdownPinned = false;
  private searchTickerStop: (() => void) | null = null;
  private idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private snapshotIntervalId: ReturnType<typeof setInterval> | null = null;
  private clockIntervalId: ReturnType<typeof setInterval> | null = null;
  private whatsNewPanel: WhatsNewPanel | null = null;

  private readonly idlePauseMs = IDLE_PAUSE_MS;
  private readonly debouncedUrlSync = debounce(() => {
    const shareUrl = this.getShareUrl();
    if (!shareUrl) return;
    try { history.replaceState(null, '', shareUrl); } catch { }
  }, 250);

  constructor(ctx: AppContext, callbacks: EventHandlerCallbacks) {
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  private switchVariant(variant: string): void {
    trackVariantSwitch(SITE_VARIANT, variant);
    localStorage.setItem('worldmonitor-variant', variant);

    // Clear persisted UI/map state for the old variant only
    localStorage.removeItem(STORAGE_KEYS.mapLayers);
    localStorage.removeItem(getVariantStorageKey(STORAGE_KEYS.panels, SITE_VARIANT));
    localStorage.removeItem('panel-order');
    localStorage.removeItem('panel-order-bottom');
    localStorage.removeItem('panel-order-bottom-set');
    localStorage.removeItem('worldmonitor-panel-spans');

    // Drop query params like ?layers=... that can override variant defaults.
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(cleanUrl);
  }

  init(): void {
    this.setupEventListeners();
    applyPanelDensity();
    setupShellGuidance(this.ctx.isMobile);
    this.setupWorkspaceSetup();
    setupMobileHelpSheet(this.ctx.isMobile);
    new OnboardingHints().init();
    this.setupIdleDetection();
    this.setupTvMode();
    this.setupBloombergShortcuts();
    this.setupStatusDropdown();
    this.setupMissionPackHandling();

    // Update header status indicator when auth state changes
    subscribeToAuth(() => {
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      if (statusDot && statusText) {
        const loggedIn = isLoggedIn();
        statusDot.classList.toggle('delayed', !loggedIn);
        statusText.textContent = loggedIn ? 'LIVE' : '10 mins';
      }
    });
  }

  private setupTvMode(): void {
    if (SITE_VARIANT !== 'happy') return;

    const tvBtn = document.getElementById('tvModeBtn');
    const tvExitBtn = document.getElementById('tvExitBtn');
    if (tvBtn) {
      tvBtn.addEventListener('click', () => this.toggleTvMode());
    }
    if (tvExitBtn) {
      tvExitBtn.addEventListener('click', () => this.toggleTvMode());
    }
    // Keyboard shortcut: Shift+T
    this.handlers.tvKeydown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'T' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement;
        if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.toggleTvMode();
        }
      }
    };
    document.addEventListener('keydown', this.handlers.tvKeydown);
  }

  private toggleTvMode(): void {
    const panelKeys = Object.keys(DEFAULT_PANELS).filter(
      key => this.ctx.panelSettings[key]?.enabled !== false
    );
    if (!this.ctx.tvMode) {
      this.ctx.tvMode = new TvModeController({
        panelKeys,
        onPanelChange: () => {
          document.getElementById('tvModeBtn')?.classList.toggle('active', this.ctx.tvMode?.active ?? false);
        }
      });
    } else {
      this.ctx.tvMode.updatePanelKeys(panelKeys);
    }
    this.ctx.tvMode.toggle();
    document.getElementById('tvModeBtn')?.classList.toggle('active', this.ctx.tvMode.active);
  }

  destroy(): void {
    this.searchTickerStop?.();
    this.searchTickerStop = null;
    this.debouncedUrlSync.cancel();
    if (this.handlers.fullscreen) {
      document.removeEventListener('fullscreenchange', this.handlers.fullscreen);
      this.handlers.fullscreen = null;
    }
    if (this.handlers.resize) {
      window.removeEventListener('resize', this.handlers.resize);
      this.handlers.resize = null;
    }
    if (this.handlers.visibility) {
      document.removeEventListener('visibilitychange', this.handlers.visibility);
      this.handlers.visibility = null;
    }
    if (this.handlers.desktopExternalLink) {
      document.removeEventListener('click', this.handlers.desktopExternalLink, true);
      this.handlers.desktopExternalLink = null;
    }
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
    if (this.handlers.idleReset) {
      ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(event => {
        document.removeEventListener(event, this.handlers.idleReset!);
      });
      this.handlers.idleReset = null;
    }
    if (this.snapshotIntervalId) {
      clearInterval(this.snapshotIntervalId);
      this.snapshotIntervalId = null;
    }
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }
    if (this.handlers.storage) {
      window.removeEventListener('storage', this.handlers.storage);
      this.handlers.storage = null;
    }
    if (this.handlers.tvKeydown) {
      document.removeEventListener('keydown', this.handlers.tvKeydown);
      this.handlers.tvKeydown = null;
    }
    if (this.handlers.focalPointsReady) {
      window.removeEventListener('focal-points-ready', this.handlers.focalPointsReady);
      this.handlers.focalPointsReady = null;
    }
    if (this.handlers.themeChanged) {
      window.removeEventListener('theme-changed', this.handlers.themeChanged);
      this.handlers.themeChanged = null;
    }
    if (this.handlers.mapResizeMove) {
      document.removeEventListener('pointermove', this.handlers.mapResizeMove);
      this.handlers.mapResizeMove = null;
    }
    if (this.handlers.mapEndResize) {
      document.removeEventListener('pointerup', this.handlers.mapEndResize);
      document.removeEventListener('pointercancel', this.handlers.mapEndResize);
      window.removeEventListener('blur', this.handlers.mapEndResize);
      this.handlers.mapEndResize = null;
    }
    if (this.handlers.mapResizeVisChange) {
      document.removeEventListener('visibilitychange', this.handlers.mapResizeVisChange);
      this.handlers.mapResizeVisChange = null;
    }
    if (this.handlers.mapFullscreenEsc) {
      document.removeEventListener('keydown', this.handlers.mapFullscreenEsc);
      this.handlers.mapFullscreenEsc = null;
    }
    if (this.handlers.mobileMenuKey) {
      document.removeEventListener('keydown', this.handlers.mobileMenuKey);
      this.handlers.mobileMenuKey = null;
    }
    if (this.handlers.missionPackApply) {
      window.removeEventListener('wm:apply-mission-pack', this.handlers.missionPackApply);
      this.handlers.missionPackApply = null;
    }
    if (this.handlers.mapModeChanged) {
      window.removeEventListener(MAP_MODE_CHANGE_EVENT, this.handlers.mapModeChanged);
      this.handlers.mapModeChanged = null;
    }
    if (this.handlers.bloombergKey) {
      document.removeEventListener('keydown', this.handlers.bloombergKey);
      this.handlers.bloombergKey = null;
    }
    this.kbShortcutsOverlay?.remove();
    this.kbShortcutsOverlay = null;
    this.ctx.tvMode?.destroy();
    this.ctx.tvMode = null;
    this.ctx.unifiedSettings?.destroy();
    this.ctx.unifiedSettings = null;
    this.ctx.agentChatPanel?.destroy();
    this.ctx.agentChatPanel = null;
    this.ctx.situationReportPanel?.destroy();
    this.ctx.situationReportPanel = null;
    this.ctx.dataSourcesPanel?.destroy();
    this.ctx.dataSourcesPanel = null;
    this.ctx.situationRoomDrawer?.destroy();
    this.ctx.situationRoomDrawer = null;
    this.ctx.visitorCounter?.destroy();
    this.ctx.visitorCounter = null;
    this.whatsNewPanel?.hide();
    this.whatsNewPanel = null;
  }

  private setupMissionPackHandling(): void {
    this.handlers.missionPackApply = (event: Event) => {
      const detail = (event as CustomEvent<{ packId?: string }>).detail;
      if (detail?.packId) this.applyMissionPack(detail.packId);
    };
    window.addEventListener('wm:apply-mission-pack', this.handlers.missionPackApply);
  }

  private setupWorkspaceSetup(): void {
    const overlay = document.getElementById('workspaceSetupOverlay');
    if (!overlay) return;

    const dismiss = (): void => {
      overlay.classList.remove('open');
      localStorage.setItem(WORKSPACE_SETUP_DISMISSED_KEY, '1');
    };

    document.getElementById('workspaceSetupClose')?.addEventListener('click', dismiss);
    document.getElementById('workspaceSetupSkip')?.addEventListener('click', dismiss);
    overlay.querySelectorAll<HTMLElement>('[data-setup-pack]').forEach((button) => {
      button.addEventListener('click', () => {
        const packId = button.dataset.setupPack;
        if (!packId) return;
        window.dispatchEvent(new CustomEvent('wm:apply-mission-pack', { detail: { packId } }));
        dismiss();
      });
    });

    if (!localStorage.getItem(WORKSPACE_SETUP_DISMISSED_KEY)) {
      window.setTimeout(() => overlay.classList.add('open'), 450);
    }
  }

  private applyMissionPack(packId: string): void {
    const pack = getMissionPack(packId);
    if (!pack || !pack.compatibleVariants.includes(SITE_VARIANT as MarketplaceVariant)) return;

    let enabledPanels = 0;
    for (const panelId of pack.recommendedPanels) {
      const panel = this.ctx.panelSettings[panelId];
      if (panel && !panel.enabled) {
        panel.enabled = true;
        enabledPanels += 1;
      }
    }
    saveToStorage(getVariantStorageKey(STORAGE_KEYS.panels, SITE_VARIANT), this.ctx.panelSettings);
    this.applyPanelSettings();
    pack.recommendedPanels.forEach((panelId) => {
      if (this.ctx.panelSettings[panelId]?.enabled) this.callbacks.loadDataForPanel(panelId);
    });

    let enabledLayers = 0;
    for (const layer of pack.recommendedLayers) {
      if (!this.ctx.mapLayers[layer]) {
        this.ctx.mapLayers[layer] = true;
        enabledLayers += 1;
      }
    }
    saveToStorage(STORAGE_KEYS.mapLayers, this.ctx.mapLayers);
    this.ctx.map?.setLayers(this.ctx.mapLayers);

    let enabledSources = 0;
    for (const source of pack.recommendedSources) {
      if (!this.ctx.uiStore.isSourceEnabled(source)) {
        this.ctx.uiStore.enableSource(source);
        enabledSources += 1;
      }
      const enrichmentDataSourceId = getEnrichmentDataSourceId(source);
      if (enrichmentDataSourceId) {
        dataFreshness.setEnabled(enrichmentDataSourceId, true);
      }
    }
    saveToStorage(STORAGE_KEYS.disabledFeeds, Array.from(this.ctx.uiStore.disabledSources));

    const monitorPanel = this.ctx.panels['monitors'] as import('@/components').MonitorPanel | undefined;
    const existingMonitors = monitorPanel?.getMonitors() ?? this.ctx.monitors;
    const monitorNames = new Set(existingMonitors.map((monitor) => monitor.name || monitor.keywords.join(',')));
    const newMonitors = pack.monitorTemplates
      .filter((monitor) => !monitorNames.has(monitor.name || monitor.keywords.join(',')))
      .map((monitor, index) => ({
        ...monitor,
        id: generateId(),
        color: MONITOR_COLORS[(existingMonitors.length + index) % MONITOR_COLORS.length] ?? '#60a5fa',
      }));
    if (newMonitors.length > 0) {
      this.ctx.monitors = [...existingMonitors, ...newMonitors];
      monitorPanel?.setMonitors(this.ctx.monitors);
      saveToStorage(STORAGE_KEYS.monitors, this.ctx.monitors);
      monitorPanel?.renderResults(this.ctx.newsStore.allNews);
    }

    const alertRules = loadAlertRules();
    const existingRuleNames = new Set(alertRules.map((rule) => rule.name));
    const addedRules = pack.alertRuleTemplates
      .filter((rule) => rule.name && !existingRuleNames.has(rule.name))
      .map((rule) => normalizeAlertRule(rule));
    if (addedRules.length > 0) {
      saveAlertRules([...alertRules, ...addedRules]);
    }

    this.ctx.unifiedSettings?.refreshPanelToggles();
    showShellNotification(
      `${pack.name} applied: ${enabledPanels} panels, ${enabledLayers} layers, ${enabledSources} sources${newMonitors.length ? `, ${newMonitors.length} monitor` : ''}.`,
      'success',
    );
  }

  private setupEventListeners(): void {
    const openSearch = () => {
      this.callbacks.updateSearchIndex();
      this.ctx.searchModal?.open();
    };
    document.getElementById('searchBtn')?.addEventListener('click', openSearch);
    document.getElementById('mobileSearchBtn')?.addEventListener('click', openSearch);
    document.getElementById('searchMobileFab')?.addEventListener('click', openSearch);
    document.getElementById('shellGuidanceSearch')?.addEventListener('click', openSearch);

    this.searchTickerStop = startSearchTicker(
      document.querySelector<HTMLElement>('.header-right .search-ticker-text'),
      { getPhrases: () => buildLiveSearchTickerPhrases(this.ctx) },
    );

    document.getElementById('saveLayoutBtn')?.addEventListener('click', async () => {
      if (!checkFeatureAccess('save-layout')) return;
      const shareUrl = this.getShareUrl();
      if (!shareUrl) return;
      try {
        const urlObj = new URL(shareUrl);
        localStorage.setItem('worldmonitor-saved-map-layout', urlObj.search);
        this.savePanelLayoutSnapshot();
        // Push to cloud immediately so it's available on next login
        void forceSaveToCloud();
        showShellNotification(t('header.layoutSaved'), 'success');
      } catch (error) {
        console.warn('Failed to save layout:', error);
        showShellNotification('Layout save failed', 'error');
      }
    });

    document.getElementById('shareLayoutBtn')?.addEventListener('click', () => {
      this.shareCurrentView();
    });

    document.getElementById('resetLayoutBtn')?.addEventListener('click', () => {
      void confirmAndResetLayout(this.ctx.PANEL_SPANS_KEY, this.ctx.PANEL_ORDER_KEY);
    });

    document.getElementById('densityToggleBtn')?.addEventListener('click', () => {
      togglePanelDensity();
    });

    document.getElementById('shellHelpBtn')?.addEventListener('click', () => {
      if (this.ctx.isMobile) openMobileHelpSheet();
      else showShellNotification('Use Cmd/Ctrl+K for search, ? for shortcuts, and Shift+S to copy the current view.', 'info', 3600);
    });

    this.handlers.storage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.panels && e.newValue) {
        try {
          this.ctx.panelSettings = JSON.parse(e.newValue) as Record<string, PanelConfig>;
          this.applyPanelSettings();
          this.ctx.unifiedSettings?.refreshPanelToggles();
        } catch (_) { }
      }
      if (e.key === STORAGE_KEYS.liveChannels && e.newValue) {
        const panel = this.ctx.panels['live-news'];
        if (panel && typeof (panel as unknown as { refreshChannelsFromStorage?: () => void }).refreshChannelsFromStorage === 'function') {
          (panel as unknown as { refreshChannelsFromStorage: () => void }).refreshChannelsFromStorage();
        }
      }
    };
    window.addEventListener('storage', this.handlers.storage);

    document.getElementById('headerThemeToggle')?.addEventListener('click', () => {
      const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
      setThemeWithLinkedMap(next);
      this.updateHeaderThemeIcon();
      trackThemeChanged(next);
    });

    const isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (this.ctx.isDesktopApp || isLocalDev) {
      this.ctx.container.querySelectorAll<HTMLAnchorElement>('.variant-option').forEach(link => {
        link.addEventListener('click', (e) => {
          const variant = link.dataset.variant;
          if (variant && variant !== SITE_VARIANT) {
            e.preventDefault();
            this.switchVariant(variant);
          }
        });
      });
    }

    document.getElementById('whatsNewBtn')?.addEventListener('click', () => {
      this.ctx.countryBriefPage?.hide();
      this.ctx.entityDetailPanel?.hide();
      this.whatsNewPanel ??= new WhatsNewPanel();
      this.whatsNewPanel.show();
      document.getElementById('headerOverflowMenu')?.removeAttribute('open');
    });

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (!this.ctx.isDesktopApp && fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
      this.handlers.fullscreen = () => {
        fullscreenBtn.textContent = document.fullscreenElement ? '\u26F6' : '\u26F6';
        fullscreenBtn.classList.toggle('active', !!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', this.handlers.fullscreen);
    }

    const regionSelect = document.getElementById('regionSelect') as HTMLSelectElement;
    regionSelect?.addEventListener('change', () => {
      this.ctx.map?.setView(regionSelect.value as MapView);
      trackMapViewChange(regionSelect.value);
    });

    this.handlers.resize = debounce(() => {
      this.ctx.map?.setIsResizing(false);
      this.ctx.map?.render();
    }, 150);
    window.addEventListener('resize', this.handlers.resize);

    this.setupMapResize();
    this.setupMapPin();

    this.handlers.visibility = () => {
      document.body?.classList.toggle('animations-paused', document.hidden);
      if (this.ctx.isDesktopApp) {
        this.ctx.map?.setRenderPaused(document.hidden);
      }
      if (document.hidden) {
        this.callbacks.setHiddenSince(Date.now());
        mlWorker.unloadOptionalModels();
        // Pause clock to avoid wasted CPU on hidden tabs
        if (this.clockIntervalId) {
          clearInterval(this.clockIntervalId);
          this.clockIntervalId = null;
        }
      } else {
        this.resetIdleTimer();
        this.callbacks.flushStaleRefreshes();
        this.startHeaderClock(); // resume (no-op if already running)
      }
    };
    document.addEventListener('visibilitychange', this.handlers.visibility);

    this.handlers.focalPointsReady = () => {
      (this.ctx.panels['cii'] as CIIPanel)?.refresh(true);
      this.callbacks.refreshOpenCountryBrief?.();
    };
    window.addEventListener('focal-points-ready', this.handlers.focalPointsReady);

    this.handlers.themeChanged = () => {
      this.ctx.map?.render();
      this.updateHeaderThemeIcon();
      this.updateMobileMenuThemeItem();
    };
    window.addEventListener('theme-changed', this.handlers.themeChanged);

    this.setupMobileMenu();

    if (this.ctx.isDesktopApp) {
      if (this.handlers.desktopExternalLink) {
        document.removeEventListener('click', this.handlers.desktopExternalLink, true);
      }
      this.handlers.desktopExternalLink = (e: MouseEvent) => {
        if (!(e.target instanceof Element)) return;
        const anchor = e.target.closest('a[href]') as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.href;
        if (!href || href.startsWith('javascript:') || href === '#' || href.startsWith('#')) return;
        // Only handle valid http(s) URLs
        let url: URL;
        try {
          url = new URL(href, window.location.href);
        } catch {
          // Malformed URL, let browser handle
          return;
        }
        if (url.origin === window.location.origin) return;
        if (!/^https?:$/.test(url.protocol)) return; // Only allow http(s) links
        e.preventDefault();
        e.stopPropagation();
        void invokeTauri<void>('open_url', { url: url.toString() }).catch(() => {
          window.open(url.toString(), '_blank');
        });
      };
      document.addEventListener('click', this.handlers.desktopExternalLink, true);
    }
  }

  private setupMobileMenu(): void {
    const hamburger = document.getElementById('hamburgerBtn');
    const overlay = document.getElementById('mobileMenuOverlay');
    const menu = document.getElementById('mobileMenu');
    const closeBtn = document.getElementById('mobileMenuClose');
    if (!hamburger || !overlay || !menu || !closeBtn) return;

    hamburger.addEventListener('click', () => this.openMobileMenu());
    overlay.addEventListener('click', () => this.closeMobileMenu());
    closeBtn.addEventListener('click', () => this.closeMobileMenu());

    const isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    menu.querySelectorAll<HTMLButtonElement>('.mobile-menu-variant').forEach(btn => {
      btn.addEventListener('click', () => {
        const variant = btn.dataset.variant;
        if (variant && variant !== SITE_VARIANT) {
          if (this.ctx.isDesktopApp || isLocalDev) {
            this.switchVariant(variant);
          } else {
            const hosts: Record<string, string> = {
              full: 'https://edgepannel.app',
              tech: 'https://tech.edgepannel.app',
              finance: 'https://finance.edgepannel.app',
              commodity: 'https://commodity.edgepannel.app',
              happy: 'https://happy.edgepannel.app',
              conflicts: 'https://conflicts.edgepannel.app',
            };
            if (hosts[variant]) window.location.href = hosts[variant] ?? '';
          }
        }
      });
    });

    document.getElementById('mobileMenuRegion')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.openRegionSheet();
    });

    document.getElementById('mobileMenuSettings')?.addEventListener('click', () => {
      this.closeMobileMenu();
      this.ctx.unifiedSettings?.open();
    });

    document.getElementById('mobileMenuTheme')?.addEventListener('click', () => {
      this.closeMobileMenu();
      const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
      setThemeWithLinkedMap(next);
      this.updateHeaderThemeIcon();
      trackThemeChanged(next);
    });

    const sheetBackdrop = document.getElementById('regionSheetBackdrop');
    sheetBackdrop?.addEventListener('click', () => this.closeRegionSheet());

    const sheet = document.getElementById('regionBottomSheet');
    sheet?.querySelectorAll<HTMLButtonElement>('.region-sheet-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const region = opt.dataset.region;
        if (!region) return;
        this.ctx.map?.setView(region as MapView);
        trackMapViewChange(region);
        const regionSelect = document.getElementById('regionSelect') as HTMLSelectElement;
        if (regionSelect) regionSelect.value = region;
        sheet.querySelectorAll('.region-sheet-option').forEach(o => {
          o.classList.toggle('active', o === opt);
          const check = o.querySelector('.region-sheet-check');
          if (check) check.textContent = o === opt ? '✓' : '';
        });
        const menuRegionLabel = document.getElementById('mobileMenuRegion')?.querySelector('.mobile-menu-item-label');
        if (menuRegionLabel) menuRegionLabel.textContent = opt.querySelector('span')?.textContent ?? '';
        this.closeRegionSheet();
      });
    });

    this.handlers.mobileMenuKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sheet?.classList.contains('open')) {
          this.closeRegionSheet();
        } else if (menu.classList.contains('open')) {
          this.closeMobileMenu();
        }
      }
    };
    document.addEventListener('keydown', this.handlers.mobileMenuKey);
  }

  private openMobileMenu(): void {
    const overlay = document.getElementById('mobileMenuOverlay');
    const menu = document.getElementById('mobileMenu');
    if (!overlay || !menu) return;
    overlay.classList.add('open');
    requestAnimationFrame(() => menu.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  private closeMobileMenu(): void {
    const overlay = document.getElementById('mobileMenuOverlay');
    const menu = document.getElementById('mobileMenu');
    if (!overlay || !menu) return;
    menu.classList.remove('open');
    overlay.classList.remove('open');
    const sheetOpen = document.getElementById('regionBottomSheet')?.classList.contains('open');
    if (!sheetOpen) document.body.style.overflow = '';
  }

  private openRegionSheet(): void {
    const backdrop = document.getElementById('regionSheetBackdrop');
    const sheet = document.getElementById('regionBottomSheet');
    if (!backdrop || !sheet) return;
    backdrop.classList.add('open');
    requestAnimationFrame(() => sheet.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  private closeRegionSheet(): void {
    const backdrop = document.getElementById('regionSheetBackdrop');
    const sheet = document.getElementById('regionBottomSheet');
    if (!backdrop || !sheet) return;
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  private setupIdleDetection(): void {
    this.handlers.idleReset = () => {
      if (this.ctx.isIdle) {
        this.ctx.isIdle = false;
        document.body?.classList.remove('animations-paused');
      }
      this.resetIdleTimer();
    };

    ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(event => {
      document.addEventListener(event, this.handlers.idleReset!, { passive: true });
    });

    this.resetIdleTimer();
  }

  resetIdleTimer(): void {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
    }
    this.idleTimeoutId = setTimeout(() => {
      if (!document.hidden) {
        this.ctx.isIdle = true;
        document.body?.classList.add('animations-paused');
        log.debug('[App] User idle - pausing animations to save resources');
      }
    }, this.idlePauseMs);
  }

  setupUrlStateSync(): void {
    if (!this.ctx.map) return;

    this.ctx.map.onStateChanged(() => {
      this.debouncedUrlSync();
      const regionSelect = document.getElementById('regionSelect') as HTMLSelectElement;
      if (regionSelect && this.ctx.map) {
        const state = this.ctx.map.getState();
        if (regionSelect.value !== state.view) {
          regionSelect.value = state.view;
        }
      }
    });
    this.debouncedUrlSync();
  }

  syncUrlState(): void {
    this.debouncedUrlSync();
  }

  getShareUrl(): string | null {
    return buildShareUrl(
      this.ctx.map,
      this.ctx.countryBriefPage,
      `${window.location.origin}${window.location.pathname}`,
    );
  }

  private savePanelLayoutSnapshot(): void {
    const keys = [
      this.ctx.PANEL_ORDER_KEY,
      this.ctx.PANEL_ORDER_KEY + '-bottom-set',
      'worldmonitor-layout-mode',
      this.ctx.PANEL_SPANS_KEY,
      'worldmonitor-panel-col-spans',
      'map-height',
      'worldmonitor-sidebar-split',
      'worldmonitor-panels-collapsed',
      'worldmonitor-bottom-grid-collapsed',
    ];
    try {
      savePanelLayoutSnapshot(keys, STORAGE_KEYS.panels, localStorage.getItem(STORAGE_KEYS.panels));
    } catch { /* ignore */ }
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) {
      try { void document.exitFullscreen()?.catch(() => { }); } catch { }
    } else {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      if (el.requestFullscreen) {
        try { void el.requestFullscreen()?.catch(() => { }); } catch { }
      } else if (el.webkitRequestFullscreen) {
        try { el.webkitRequestFullscreen(); } catch { }
      }
    }
  }

  updateHeaderThemeIcon(): void {
    const btn = document.getElementById('headerThemeToggle');
    if (!btn) return;
    btn.dataset.theme = getCurrentTheme();
  }

  private updateMobileMenuThemeItem(): void {
    const btn = document.getElementById('mobileMenuTheme');
    if (!btn) return;
    const isDark = getCurrentTheme() === 'dark';
    const icon = btn.querySelector('.mobile-menu-item-icon');
    const label = btn.querySelector('.mobile-menu-item-label');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }

  startHeaderClock(): void {
    if (this.clockIntervalId) return; // already running
    const el = document.getElementById('headerClock');
    if (!el) return;
    const tick = () => { el.textContent = formatClockTime(getHeaderTimezone()); };
    tick();
    this.clockIntervalId = setInterval(tick, 1000);
  }

  setupStatusPanel(): void {
    this.ctx.statusPanel = new StatusPanel();
  }

  setupPizzIntIndicator(): void {
    // PizzIntIndicator removed from header
  }

  setupExportPanel(): void {
    this.ctx.exportPanel = new ExportPanel();

    const headerRight = this.ctx.container.querySelector('.header-right');
    const liveActions = this.ctx.container.querySelector('.header-live-actions');
    const actionParent = liveActions || headerRight;
    if (actionParent) {
      // Insert export panel first, then visitor counter before it so eye sits left of camera
      actionParent.insertBefore(this.ctx.exportPanel.getElement(), actionParent.firstChild);
      const visitorCounter = new VisitorCounter(() => {
        void this.ctx.situationRoomDrawer?.open();
      });
      this.ctx.visitorCounter = visitorCounter;
      this.ctx.situationRoomDrawer = new SituationRoomDrawer({
        getViewerCount: () => visitorCounter.getCount(),
        onUnreadCountChange: (count) => visitorCounter.setUnreadCount(count),
      });
      actionParent.insertBefore(visitorCounter.getElement(), this.ctx.exportPanel.getElement());
    }
  }

  setupUnifiedSettings(): void {
    this.ctx.unifiedSettings = new UnifiedSettings({
      getCustomFeeds: () => this.ctx.uiStore.customFeeds,
      addCustomFeed: (feed: CustomFeed) => this.ctx.uiStore.addCustomFeed(feed),
      removeCustomFeed: (id: string) => this.ctx.uiStore.removeCustomFeed(id),
      getPanelSettings: () => this.ctx.panelSettings,
      togglePanel: (key: string) => {
        const config = this.ctx.panelSettings[key];
        if (config) {
          config.enabled = !config.enabled;
          trackPanelToggled(key, config.enabled);
          saveToStorage(STORAGE_KEYS.panels, this.ctx.panelSettings);
          this.applyPanelSettings();
          if (config.enabled) this.callbacks.loadDataForPanel(key);
        }
      },
      getDisabledSources: () => this.ctx.disabledSources,
      toggleSource: (name: string) => {
        const enabled = !this.ctx.uiStore.isSourceEnabled(name);
        if (enabled) {
          this.ctx.uiStore.enableSource(name);
        } else {
          this.ctx.uiStore.disableSource(name);
        }
        const enrichmentDataSourceId = getEnrichmentDataSourceId(name);
        if (enrichmentDataSourceId) {
          dataFreshness.setEnabled(enrichmentDataSourceId, enabled);
        }
        saveToStorage(STORAGE_KEYS.disabledFeeds, Array.from(this.ctx.uiStore.disabledSources));
      },
      setSourcesEnabled: (names: string[], enabled: boolean) => {
        for (const name of names) {
          if (enabled) this.ctx.uiStore.enableSource(name);
          else this.ctx.uiStore.disableSource(name);
          const enrichmentDataSourceId = getEnrichmentDataSourceId(name);
          if (enrichmentDataSourceId) {
            dataFreshness.setEnabled(enrichmentDataSourceId, enabled);
          }
        }
        saveToStorage(STORAGE_KEYS.disabledFeeds, Array.from(this.ctx.uiStore.disabledSources));
      },
      getAllSourceNames: () => this.getAllSourceNames(),
      getLocalizedPanelName: (key: string, fallback: string) => this.getLocalizedPanelName(key, fallback),
      resetLayout: () => {
        void confirmAndResetLayout(this.ctx.PANEL_SPANS_KEY, this.ctx.PANEL_ORDER_KEY);
      },
      saveLayout: () => {
        const shareUrl = this.getShareUrl();
        if (!shareUrl) return;
        try {
          const urlObj = new URL(shareUrl);
          localStorage.setItem('worldmonitor-saved-map-layout', urlObj.search);
          this.savePanelLayoutSnapshot();
          showShellNotification(t('header.layoutSaved'), 'success');
        } catch (error) {
          console.warn('Failed to save layout:', error);
          showShellNotification('Layout save failed', 'error');
        }
      },
      isDesktopApp: this.ctx.isDesktopApp,
      getMapLayers: () => this.ctx.mapLayers,
      openMarketplace: () => {
        void this.ctx.marketplace?.openModal();
      },
      getMarketplaceItems: () => this.ctx.marketplace?.getViewItems() ?? [],
    });

    const mount = document.getElementById('unifiedSettingsMount');
    if (mount) {
      mount.appendChild(this.ctx.unifiedSettings.getButton());
    }

    if (this.ctx.isDesktopApp) {
      this.ctx.agentChatPanel = new AgentChatPanel();
      const headerRight = this.ctx.container.querySelector<HTMLElement>('.header-right');
      const overflowPanel = document.getElementById('headerOverflowPanel');
      const agentBtn = document.createElement('button');
      agentBtn.type = 'button';
      agentBtn.className = 'agent-chat-open-btn';
      agentBtn.title = 'Open agent chat';
      agentBtn.setAttribute('aria-label', 'Open agent chat');
      agentBtn.textContent = 'AI';
      agentBtn.addEventListener('click', () => {
        void this.ctx.agentChatPanel?.open();
      });
      if (overflowPanel) {
        overflowPanel.insertBefore(agentBtn, mount || null);
      } else if (headerRight) {
        headerRight.insertBefore(agentBtn, mount?.parentElement === headerRight ? mount : null);
      }
    }

    // Situation Report — full structured intelligence brief. Available on web
    // and desktop (gated at generation time on an AI provider being enabled).
    this.ctx.situationReportPanel = new SituationReportPanel();
    this.ctx.situationReportPanel.setHeadlinesProvider(() =>
      (this.ctx.newsStore?.allNews ?? []).map((n) => n.title).filter(Boolean),
    );
    const sitrepHeaderRight = this.ctx.container.querySelector<HTMLElement>('.header-right');
    const sitrepOverflow = document.getElementById('headerOverflowPanel');
    const sitrepBtn = document.createElement('button');
    sitrepBtn.type = 'button';
    sitrepBtn.className = 'sitrep-open-btn';
    sitrepBtn.title = 'Open situation report';
    sitrepBtn.setAttribute('aria-label', 'Open situation report');
    sitrepBtn.textContent = 'BRIEF';
    sitrepBtn.addEventListener('click', () => void this.ctx.situationReportPanel?.open());
    if (sitrepOverflow) {
      sitrepOverflow.insertBefore(sitrepBtn, mount || null);
    } else if (sitrepHeaderRight) {
      sitrepHeaderRight.insertBefore(sitrepBtn, mount?.parentElement === sitrepHeaderRight ? mount : null);
    }

    // Data sources & pipeline health — an auditable view of where data comes from.
    this.ctx.dataSourcesPanel = new DataSourcesPanel();
    const sourcesBtn = document.createElement('button');
    sourcesBtn.type = 'button';
    sourcesBtn.className = 'dsrc-open-btn';
    sourcesBtn.title = 'Data sources & status';
    sourcesBtn.setAttribute('aria-label', 'Data sources and status');
    sourcesBtn.textContent = 'DATA';
    sourcesBtn.addEventListener('click', () => this.ctx.dataSourcesPanel?.open());
    if (sitrepOverflow) {
      sitrepOverflow.insertBefore(sourcesBtn, mount || null);
    } else if (sitrepHeaderRight) {
      sitrepHeaderRight.insertBefore(sourcesBtn, mount?.parentElement === sitrepHeaderRight ? mount : null);
    }

    const mobileBtn = document.getElementById('mobileSettingsBtn');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => this.ctx.unifiedSettings?.open());
    }
  }

  setupNotificationCenter(): void {
    this.ctx.notificationCenter?.destroy();
    const nc = new NotificationCenter();
    this.ctx.notificationCenter = nc;
    nc.setLocationClickHandler((lat, lon) => {
      this.ctx.map?.setCenter(lat, lon, 6);
    });
    nc.setFindingClickHandler((signal) => {
      if (this.ctx.countryBriefPage?.isVisible()) return;
      if (localStorage.getItem('wm-settings-open') === '1') return;
      this.ctx.findingPanel?.showSignal(signal);
    });
    nc.setAlertClickHandler((alert) => {
      if (this.ctx.countryBriefPage?.isVisible()) return;
      if (localStorage.getItem('wm-settings-open') === '1') return;
      this.ctx.findingPanel?.showAlert(alert);
    });
    const liveActions = this.ctx.container.querySelector<HTMLElement>('.header-live-actions');
    const headerRight = this.ctx.container.querySelector<HTMLElement>('.header-right');
    if (liveActions) {
      nc.mount(liveActions);
    } else if (headerRight) {
      const settingsMount = document.getElementById('unifiedSettingsMount');
      nc.mount(headerRight, settingsMount);
    }
  }

  setupPlaybackControl(): void {
    this.ctx.playbackControl = new PlaybackControl();
    this.ctx.playbackControl.onSnapshot((snapshot) => {
      if (snapshot) {
        this.ctx.isPlaybackMode = true;
        this.restoreSnapshot(snapshot);
      } else {
        this.ctx.isPlaybackMode = false;
        this.callbacks.loadAllData();
      }
    });

    const headerRight = this.ctx.container.querySelector('.header-right');
    const liveActions = this.ctx.container.querySelector('.header-live-actions');
    const actionParent = liveActions || headerRight;
    if (actionParent) {
      actionParent.insertBefore(this.ctx.playbackControl.getElement(), actionParent.firstChild);
    }
  }

  setupSnapshotSaving(): void {
    const saveCurrentSnapshot = async () => {
      if (this.ctx.isPlaybackMode || this.ctx.isDestroyed) return;

      const marketPrices: Record<string, number> = {};
      this.ctx.latestMarkets.forEach(m => {
        if (m.price !== null) marketPrices[m.symbol] = m.price;
      });

      await saveSnapshot({
        timestamp: Date.now(),
        events: this.ctx.latestClusters,
        marketPrices,
        predictions: this.ctx.latestPredictions.map(p => ({
          title: p.title,
          yesPrice: p.yesPrice
        })),
        hotspotLevels: this.ctx.map?.getHotspotLevels() ?? {}
      });
    };

    void saveCurrentSnapshot().catch((e) => console.warn('[Snapshot] save failed:', e));
    this.snapshotIntervalId = setInterval(() => void saveCurrentSnapshot().catch((e) => console.warn('[Snapshot] save failed:', e)), 15 * 60 * 1000);
  }

  restoreSnapshot(snapshot: DashboardSnapshot): void {
    for (const panel of Object.values(this.ctx.newsPanels)) {
      panel.showLoading();
    }

    const events = snapshot.events as ClusteredEvent[];
    this.ctx.latestClusters = events;

    const predictions = snapshot.predictions.map((p, i) => ({
      id: `snap-${i}`,
      title: p.title,
      yesPrice: p.yesPrice,
      noPrice: 100 - p.yesPrice,
      volume24h: 0,
      liquidity: 0,
    }));
    this.ctx.latestPredictions = predictions;
    (this.ctx.panels['polymarket'] as PredictionPanel).renderPredictions(predictions);

    this.ctx.map?.setHotspotLevels(snapshot.hotspotLevels);
  }

  setupMapLayerHandlers(): void {
    this.ctx.map?.setOnLayerChange((layer, enabled, source) => {
      log.debug(`[App.onLayerChange] ${layer}: ${enabled} (${source})`);
      trackMapLayerToggle(layer, enabled, source);
      this.ctx.mapLayers[layer] = enabled;
      saveToStorage(STORAGE_KEYS.mapLayers, this.ctx.mapLayers);
      this.syncUrlState();

      const sourceIds = LAYER_TO_SOURCE[layer];
      if (sourceIds) {
        for (const sourceId of sourceIds) {
          dataFreshness.setEnabled(sourceId, enabled);
        }
      }

      if (layer === 'ais') {
        if (enabled) {
          this.ctx.map?.setLayerLoading('ais', true);
          initAisStream();
          this.callbacks.waitForAisData();
        } else {
          disconnectAisStream();
        }
        return;
      }

      if (layer === 'flights') {
        const airlineIntel = this.ctx.panels['airline-intel'] as AirlineIntelPanel | undefined;
        airlineIntel?.setLiveMode(enabled);
      }

      if (enabled) {
        this.callbacks.loadDataForLayer(layer);
      }
    });

    // Forward live aircraft positions from map to AirlineIntelPanel + cache
    this.ctx.map?.setOnAircraftPositionsUpdate((positions) => {
      this.ctx.intelligenceCache.aircraftPositions = positions;
      const airlineIntel = this.ctx.panels['airline-intel'] as AirlineIntelPanel | undefined;
      airlineIntel?.updateLivePositions(positions);
    });
  }

  setupPanelViewTracking(): void {
    const viewedPanels = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          const id = (entry.target as HTMLElement).dataset.panel;
          if (id && !viewedPanels.has(id)) {
            viewedPanels.add(id);
            trackPanelView(id);
          }
        }
      }
    }, { threshold: 0.3 });

    const grid = document.getElementById('panelsGrid');
    if (grid) {
      for (const child of Array.from(grid.children)) {
        if ((child as HTMLElement).dataset.panel) {
          observer.observe(child);
        }
      }
    }
  }

  showToast(msg: string): void {
    showShellNotification(msg, 'info');
  }

  shouldShowIntelligenceNotifications(): boolean {
    return !this.ctx.isMobile;
  }

  setupMapResize(): void {
    const mainContent = document.querySelector('.main-content') as HTMLElement | null;
    const mapSection = document.getElementById('mapSection') as HTMLElement | null;
    const mapContainer = document.getElementById('mapContainer') as HTMLElement | null;
    const rightHandle = document.getElementById('mapResizeHandle') as HTMLElement | null;
    const bottomHandle = document.getElementById('bottomGridResizeHandle') as HTMLElement | null;
    const cornerHandle = document.getElementById('cornerResizeHandle') as HTMLElement | null;
    if (!mainContent || !mapSection || !mapContainer || (!rightHandle && !bottomHandle)) return;

    const MAP_HEIGHT_KEY = 'map-height';
    const SIDEBAR_SPLIT_KEY = 'worldmonitor-sidebar-split';
    const DEFAULT_SIDEBAR_SPLIT = 60;
    const MIN_RIGHT_COLUMN_PX = 320;
    const MIN_MAP_COLUMN_PX = 460;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const isSideLikeLayout = () => window.innerWidth >= 1600 || mainContent.classList.contains('layout-side');

    const clampSidebarSplit = (percent: number) => {
      const totalWidth = mainContent.getBoundingClientRect().width;
      if (totalWidth <= 0) return DEFAULT_SIDEBAR_SPLIT;
      const minPercent = (MIN_MAP_COLUMN_PX / totalWidth) * 100;
      const maxPercent = ((totalWidth - MIN_RIGHT_COLUMN_PX) / totalWidth) * 100;
      if (maxPercent <= minPercent) return clamp(percent, 45, 70);
      return clamp(percent, minPercent, maxPercent);
    };

    const applySidebarSplit = (percent: number, persist: boolean) => {
      const clamped = clampSidebarSplit(percent);
      mainContent.style.setProperty('--map-sidebar-split', `${clamped}%`);
      if (persist) {
        localStorage.setItem(SIDEBAR_SPLIT_KEY, String(clamped));
      }
      return clamped;
    };

    const hydrateSidebarSplit = () => {
      if (!isSideLikeLayout()) return;
      const stored = localStorage.getItem(SIDEBAR_SPLIT_KEY);
      const parsed = stored ? Number.parseFloat(stored) : Number.NaN;
      if (Number.isFinite(parsed)) {
        applySidebarSplit(parsed, false);
      } else {
        applySidebarSplit(DEFAULT_SIDEBAR_SPLIT, false);
      }
    };

    const getMinHeight = () => (window.innerWidth >= 1600 ? 280 : 350);
    const getMaxHeight = () => {
      if (window.innerWidth < 1600) return Math.max(getMinHeight(), window.innerHeight - 150);

      const bottomGrid = document.getElementById('mapBottomGrid');
      const isEmpty = !bottomGrid || bottomGrid.children.length === 0;
      const headerHeight = 60;
      const totalAvailable = window.innerHeight - headerHeight;

      return isEmpty ? totalAvailable - 25 : totalAvailable - 300;
    };

    const getBottomResizeTarget = () => (window.innerWidth >= 1600 ? mapContainer : mapSection);

    if (applyStoredMapHeight()) {
      scheduleMapResize(this.ctx.map);
    }
    hydrateSidebarSplit();

    type ResizeMode = 'none' | 'bottom' | 'right' | 'both';
    let resizeMode: ResizeMode = 'none';
    let startY = 0;
    let startX = 0;
    let startHeight = 0;
    let startMapWidth = 0;
    let activeResizePointerId: number | null = null;
    let resizeRafId: number | null = null;
    let pendingClientX = 0;
    let pendingClientY = 0;

    const beginResize = (handle: HTMLElement, event: PointerEvent): void => {
      activeResizePointerId = event.pointerId;
      try { handle.setPointerCapture(event.pointerId); } catch {}
    };

    this.handlers.mapEndResize = () => {
      if (resizeMode === 'none') return;
      if (resizeRafId !== null) { cancelAnimationFrame(resizeRafId); resizeRafId = null; }
      const endedMode = resizeMode;
      resizeMode = 'none';
      activeResizePointerId = null;
      this.ctx.map?.setIsResizing(false);
      this.ctx.map?.resize();
      mapSection.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (endedMode === 'bottom' || endedMode === 'both') {
        const target = getBottomResizeTarget();
        if (target.style.height) {
          localStorage.setItem(MAP_HEIGHT_KEY, target.style.height);
        }
      }
      if (endedMode === 'right' || endedMode === 'both') {
        const current = Number.parseFloat(
          mainContent.style.getPropertyValue('--map-sidebar-split')
        );
        if (Number.isFinite(current)) {
          localStorage.setItem(SIDEBAR_SPLIT_KEY, String(current));
        }
      }
    };
    const endResize = this.handlers.mapEndResize;
    // The collapse buttons are absolutely-positioned children of the resize
    // handles (they share the same hit area). Without this guard, every
    // pointerdown on a button also starts a resize drag and captures the
    // pointer on the ancestor handle, which silently swallows the button's
    // own click — the button visually exists but never fires its handler.
    const isCollapseButtonTarget = (e: PointerEvent): boolean =>
      !!(e.target as HTMLElement | null)?.closest('.panels-collapse-btn, .bottom-grid-collapse-btn');

    if (bottomHandle) {
      bottomHandle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || resizeMode !== 'none' || isCollapseButtonTarget(e)) return;
        beginResize(bottomHandle, e);
        resizeMode = 'bottom';
        startY = e.clientY;
        const target = getBottomResizeTarget();
        startHeight = target.offsetHeight;
        this.ctx.map?.setIsResizing(true);
        mapSection.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      bottomHandle.addEventListener('dblclick', () => {
        const isWide = window.innerWidth >= 1600;
        const target = isWide ? mapContainer : mapSection;
        const targetHeight = window.innerHeight * 0.5;
        const finalHeight = clamp(targetHeight, getMinHeight(), getMaxHeight());

        this.ctx.map?.setIsResizing(true);
        target.classList.add('map-section-smooth');

        target.style.flex = 'none';
        target.style.setProperty('height', `${finalHeight}px`, 'important');

        let fired = false;
        const onEnd = () => {
          if (fired) return;
          fired = true;
          target.classList.remove('map-section-smooth');
          target.removeEventListener('transitionend', onEnd);
          localStorage.setItem(MAP_HEIGHT_KEY, `${finalHeight}px`);
          this.ctx.map?.setIsResizing(false);
          this.ctx.map?.resize();
        };

        target.addEventListener('transitionend', onEnd);
        this.ctx.map?.resize();
        setTimeout(onEnd, 500);
      });
    }

    if (cornerHandle) {
      cornerHandle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || resizeMode !== 'none') return;
        if (!isSideLikeLayout()) return;
        beginResize(cornerHandle, e);
        resizeMode = 'both';
        startX = e.clientX;
        startY = e.clientY;
        startMapWidth = mapSection.getBoundingClientRect().width;
        const target = getBottomResizeTarget();
        startHeight = target.offsetHeight;
        this.ctx.map?.setIsResizing(true);
        mapSection.classList.add('resizing');
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
      });
    }

    if (rightHandle) {
      rightHandle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || resizeMode !== 'none' || isCollapseButtonTarget(e)) return;
        beginResize(rightHandle, e);
        // In side layout: horizontal split resize
        // In stacked/bottom layout: vertical height resize (same as bottomHandle)
        if (isSideLikeLayout()) {
          resizeMode = 'right';
          startX = e.clientX;
          startMapWidth = mapSection.getBoundingClientRect().width;
          document.body.style.cursor = 'ew-resize';
        } else {
          resizeMode = 'bottom';
          startY = e.clientY;
          const target = getBottomResizeTarget();
          startHeight = target.offsetHeight;
          document.body.style.cursor = 'ns-resize';
        }
        this.ctx.map?.setIsResizing(true);
        mapSection.classList.add('resizing');
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });

      rightHandle.addEventListener('dblclick', () => {
        if (isSideLikeLayout()) {
          applySidebarSplit(DEFAULT_SIDEBAR_SPLIT, true);
          this.ctx.map?.resize();
        } else {
          // Double-click resets to 50% height in stacked layout
          const target = getBottomResizeTarget();
          const finalHeight = clamp(window.innerHeight * 0.5, getMinHeight(), getMaxHeight());
          target.style.flex = 'none';
          target.style.setProperty('height', `${finalHeight}px`, 'important');
          localStorage.setItem(MAP_HEIGHT_KEY, `${finalHeight}px`);
          this.ctx.map?.resize();
        }
      });
    }

    this.handlers.mapResizeMove = (e: PointerEvent) => {
      if (resizeMode === 'none') return;
      if (activeResizePointerId !== null && e.pointerId !== activeResizePointerId) return;

      pendingClientX = e.clientX;
      pendingClientY = e.clientY;

      if (resizeRafId !== null) return;

      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null;
        const clientX = pendingClientX;
        const clientY = pendingClientY;

        if (resizeMode === 'bottom') {
          const isWide = window.innerWidth >= 1600;
          const target = isWide ? mapContainer : mapSection;
          const newHeight = clamp(startHeight + (clientY - startY), getMinHeight(), getMaxHeight());
          target.style.flex = 'none';
          target.style.setProperty('height', `${newHeight}px`, 'important');
          this.ctx.map?.resize();
          return;
        }

        if (resizeMode === 'right') {
          if (!isSideLikeLayout()) return;
          const totalWidth = mainContent.getBoundingClientRect().width;
          if (totalWidth <= 0) return;
          const desiredPercent = ((startMapWidth + (clientX - startX)) / totalWidth) * 100;
          applySidebarSplit(desiredPercent, false);
          this.ctx.map?.resize();
          return;
        }

        if (resizeMode === 'both') {
          if (!isSideLikeLayout()) return;
          const isWide = window.innerWidth >= 1600;
          const target = isWide ? mapContainer : mapSection;
          const newHeight = clamp(startHeight + (clientY - startY), getMinHeight(), getMaxHeight());
          target.style.flex = 'none';
          target.style.setProperty('height', `${newHeight}px`, 'important');
          const totalWidth = mainContent.getBoundingClientRect().width;
          if (totalWidth > 0) {
            const desiredPercent = ((startMapWidth + (clientX - startX)) / totalWidth) * 100;
            applySidebarSplit(desiredPercent, false);
          }
          this.ctx.map?.resize();
        }
      });
    };
    document.addEventListener('pointermove', this.handlers.mapResizeMove);

    document.addEventListener('pointerup', endResize);
    document.addEventListener('pointercancel', endResize);
    window.addEventListener('blur', endResize);
    this.handlers.mapResizeVisChange = () => {
      if (document.hidden) endResize();
    };
    document.addEventListener('visibilitychange', this.handlers.mapResizeVisChange);
  }

  setupMapPin(): void {
    const mapSection = document.getElementById('mapSection');
    const pinBtn = document.getElementById('mapPinBtn');
    if (!mapSection || !pinBtn) return;

    const isPinned = localStorage.getItem('map-pinned') === 'true';
    if (isPinned) {
      mapSection.classList.add('pinned');
      pinBtn.classList.add('active');
    }

    pinBtn.addEventListener('click', () => {
      const nowPinned = mapSection.classList.toggle('pinned');
      pinBtn.classList.toggle('active', nowPinned);
      localStorage.setItem('map-pinned', String(nowPinned));
    });

    this.setupMapFullscreen(mapSection);
    this.setupMapDimensionToggle();
  }

  // ─── Bloomberg Terminal-inspired keyboard shortcuts ───────────────────────

  private setupBloombergShortcuts(): void {
    this.handlers.bloombergKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        e.ctrlKey || e.metaKey || e.altKey
      ) return;

      switch (e.key) {
        case '?':
          e.preventDefault();
          this.toggleKbShortcutsOverlay();
          break;
        case 'Escape':
          if (this.kbShortcutsOverlay) {
            this.kbShortcutsOverlay.remove();
            this.kbShortcutsOverlay = null;
          }
          break;
        case '/':
          e.preventDefault();
          this.callbacks.updateSearchIndex();
          this.ctx.searchModal?.open();
          break;
        case 'g':
        case 'G':
          if (!e.shiftKey) {
            e.preventDefault();
            if (!(this.ctx.map?.isGlobeMode() ?? false)) {
              document.querySelector<HTMLButtonElement>('[data-mode="globe"]')?.click();
            }
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          if (this.ctx.map?.isGlobeMode() ?? true) {
            document.querySelector<HTMLButtonElement>('[data-mode="flat"]')?.click();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this.ctx.map?.setView('global');
          break;
        case '+':
        case '=':
          e.preventDefault();
          (document.querySelector('.zoom-in') as HTMLButtonElement | null)?.click();
          break;
        case '-':
          e.preventDefault();
          (document.querySelector('.zoom-out') as HTMLButtonElement | null)?.click();
          break;
        case '0':
          e.preventDefault();
          (document.querySelector('.zoom-reset') as HTMLButtonElement | null)?.click();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          (document.getElementById('mapFullscreenBtn') as HTMLButtonElement | null)?.click();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          (document.getElementById('layerToggleBtn') as HTMLButtonElement | null)?.click();
          break;

        // Shift+S — share current view URL
        case 'S':
          if (e.shiftKey) {
            e.preventDefault();
            this.shareCurrentView();
          }
          break;
      }
    };
    document.addEventListener('keydown', this.handlers.bloombergKey);
  }

  private shareCurrentView(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.showWmToast('\u2713  Link copied to clipboard');
    }).catch(() => {
      this.showToast('Copy failed \u2014 use Ctrl+C on the address bar');
    });
  }

  private showWmToast(message: string): void {
    showShellNotification(message, 'success');
  }

  private toggleKbShortcutsOverlay(): void {
    if (this.kbShortcutsOverlay) {
      this.kbShortcutsOverlay.remove();
      this.kbShortcutsOverlay = null;
      return;
    }

    const shortcuts: [string, string][] = [
      ['/', 'Open search'],
      ['G', 'Switch to 3D globe'],
      ['M', 'Switch to 2D map'],
      ['R', 'Reset map view'],
      ['L', 'Toggle layers panel'],
      ['F', 'Fullscreen map'],
      ['+ / -', 'Zoom in / out'],
      ['0', 'Reset zoom'],
      ['Shift+S', 'Copy share link'],
      ['Cmd+K', 'Command search'],
      ['Shift+T', 'TV mode'],
      ['?', 'Toggle this panel'],
      ['Esc', 'Close'],
    ];

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#0a0c10', border: '1px solid #ffaa00', borderRadius: '4px',
      padding: '28px 36px', minWidth: '460px', maxWidth: '90vw', fontFamily: 'var(--font-body)',
      boxShadow: '0 0 40px rgba(255,170,0,0.2)',
    });

    const title = document.createElement('div');
    title.textContent = '\u2328  KEYBOARD SHORTCUTS';
    Object.assign(title.style, {
      color: '#ffaa00', fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px',
      marginBottom: '20px', borderBottom: '1px solid rgba(255,170,0,0.26)', paddingBottom: '10px',
    });
    box.appendChild(title);

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 24px',
    });

    shortcuts.forEach(([key, desc]) => {
      const keyEl = document.createElement('span');
      keyEl.textContent = key;
      Object.assign(keyEl.style, {
        color: '#ffaa00', fontSize: '11px', padding: '4px 8px',
        background: 'rgba(255,170,0,0.08)', borderRadius: '2px', letterSpacing: '0.5px',
      });

      const descEl = document.createElement('span');
      descEl.textContent = desc;
      Object.assign(descEl.style, {
        color: '#aaaaaa', fontSize: '11px', padding: '4px 0', alignSelf: 'center',
      });

      grid.appendChild(keyEl);
      grid.appendChild(descEl);
    });
    box.appendChild(grid);

    const footer = document.createElement('div');
    footer.textContent = 'PRESS ? OR ESC TO CLOSE';
    Object.assign(footer.style, {
      marginTop: '20px', color: '#555', fontSize: '10px',
      textAlign: 'center', letterSpacing: '1px',
    });
    box.appendChild(footer);
    overlay.appendChild(box);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        this.kbShortcutsOverlay = null;
      }
    });

    document.body.appendChild(overlay);
    this.kbShortcutsOverlay = overlay;
  }

  // ─── Sources & status hover panel ─────────────────────────────────────────

  private setupStatusDropdown(): void {
    const indicator = document.querySelector<HTMLElement>('.status-indicator');
    if (!indicator) return;

    indicator.style.cursor = 'pointer';
    indicator.style.position = 'relative';

    indicator.addEventListener('mouseenter', () => {
      if (this.statusDropdownTimer) clearTimeout(this.statusDropdownTimer);
      this.showStatusDropdown(indicator);
    });
    indicator.addEventListener('mouseleave', () => {
      if (this.statusDropdownPinned) return;
      this.statusDropdownTimer = setTimeout(() => this.hideStatusDropdown(), 220);
    });

    // The panel re-renders its list in place, so a clicked row/header can be
    // detached from the DOM before the event finishes bubbling. Read the
    // dispatch-time path instead of the (possibly stale) target's ancestors.
    const pathHas = (e: Event, predicate: (node: HTMLElement) => boolean): boolean =>
      e.composedPath().some(node => node instanceof HTMLElement && predicate(node));

    // Click pins the panel open so search and filters stay usable.
    indicator.addEventListener('click', (e) => {
      if (pathHas(e, node => node.classList.contains('ss-panel'))) return;
      this.statusDropdownPinned = !this.statusDropdownPinned;
      if (this.statusDropdownPinned) this.showStatusDropdown(indicator);
      else this.hideStatusDropdown();
    });

    document.addEventListener('click', (e) => {
      if (!this.statusDropdownPinned) return;
      if (pathHas(e, node => node === indicator)) return;
      this.statusDropdownPinned = false;
      this.hideStatusDropdown();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.statusDropdownEl) {
        this.statusDropdownPinned = false;
        this.hideStatusDropdown();
      }
    });
  }

  private showStatusDropdown(anchor: HTMLElement): void {
    if (this.statusDropdownEl) return;

    const panel = new SourceStatusPanel();
    const node = panel.getElement();
    node.addEventListener('mouseenter', () => {
      if (this.statusDropdownTimer) clearTimeout(this.statusDropdownTimer);
    });
    node.addEventListener('mouseleave', () => {
      if (this.statusDropdownPinned) return;
      this.statusDropdownTimer = setTimeout(() => this.hideStatusDropdown(), 220);
    });

    anchor.appendChild(node);
    this.statusDropdownEl = panel;
  }

  private hideStatusDropdown(): void {
    this.statusDropdownEl?.destroy();
    this.statusDropdownEl = null;
  }

  private setupMapDimensionToggle(): void {
    const toggle = document.getElementById('mapDimensionToggle');
    if (!toggle) return;

    const syncButtons = (mode = this.ctx.map?.isGlobeMode() ? 'globe' : 'flat') => {
      toggle.querySelectorAll<HTMLButtonElement>('.map-dim-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.mode === mode);
      });
    };

    syncButtons();
    this.handlers.mapModeChanged = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: 'flat' | 'globe' }>).detail?.mode;
      syncButtons(mode === 'globe' ? 'globe' : 'flat');
    };
    window.addEventListener(MAP_MODE_CHANGE_EVENT, this.handlers.mapModeChanged);

    toggle.querySelectorAll<HTMLButtonElement>('.map-dim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (!mode) return;
        const isGlobe = mode === 'globe';
        const alreadyGlobe = this.ctx.map?.isGlobeMode() ?? false;
        if (isGlobe === alreadyGlobe) {
          saveToStorage(STORAGE_KEYS.mapMode, isGlobe ? 'globe' : 'flat');
          syncButtons();
          return;
        }
        saveToStorage(STORAGE_KEYS.mapMode, isGlobe ? 'globe' : 'flat');
        if (isGlobe) {
          this.ctx.map?.switchToGlobe();
        } else {
          this.ctx.map?.switchToFlat();
        }
        syncButtons();
      });
    });
  }

  private setupMapFullscreen(mapSection: HTMLElement): void {
    const btn = document.getElementById('mapFullscreenBtn');
    if (!btn) return;
    const expandSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
    const shrinkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>';
    let isFullscreen = false;

    const toggle = () => {
      isFullscreen = !isFullscreen;
      mapSection.classList.toggle('live-news-fullscreen', isFullscreen);
      document.body.classList.toggle('live-news-fullscreen-active', isFullscreen);
      btn.innerHTML = isFullscreen ? shrinkSvg : expandSvg;
      btn.title = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
      // Notify map so globe (and deck.gl) can resize after CSS transition completes
      setTimeout(() => this.ctx.map?.setIsResizing(false), 320);
    };

    btn.addEventListener('click', toggle);
    this.handlers.mapFullscreenEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) toggle();
    };
    document.addEventListener('keydown', this.handlers.mapFullscreenEsc);
  }

  getLocalizedPanelName(panelKey: string, fallback: string): string {
    if (panelKey === 'runtime-config') {
      return t('modals.runtimeConfig.title');
    }
    const key = panelKey.replace(/-([a-z])/g, (_match, group: string) => group.toUpperCase());
    const lookup = `panels.${key}`;
    const localized = t(lookup);
    return localized === lookup ? fallback : localized;
  }

  getAllSourceNames(): string[] {
    const sources = new Set<string>();
    Object.values(FEEDS).forEach(feeds => {
      if (feeds) feeds.forEach(f => sources.add(f.name));
    });
    INTEL_SOURCES.forEach(f => sources.add(f.name));
    try {
      const custom = this.ctx.uiStore.customFeeds || [];
      custom.forEach(f => sources.add(f.name));
    } catch {}
    return Array.from(sources).sort((a, b) => a.localeCompare(b));
  }

  applyPanelSettings(): void {
    Object.entries(this.ctx.panelSettings).forEach(([key, config]) => {
      if (key === 'map') {
        const mapSection = document.getElementById('mapSection');
        if (mapSection) {
          mapSection.classList.toggle('hidden', !config.enabled);
          const mainContent = document.querySelector('.main-content');
          if (mainContent) {
            mainContent.classList.toggle('map-hidden', !config.enabled);
          }
          this.callbacks.ensureCorrectZones();
        }
        return;
      }
      const panel = this.ctx.panels[key];
      panel?.toggle(config.enabled);
    });
  }
}
