import {
  FEEDS,
  INTEL_SOURCES,
  SOURCE_REGION_MAP,
  getSourcePanelId,
  getSourcePropagandaRisk,
  getSourceTier,
  getSourceType,
} from '@/config/feeds';
import { log } from '@/utils/logger';
import { PANEL_CATEGORY_MAP } from '@/config/panels';
import { SITE_VARIANT } from '@/config/variant';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import type { MapLayers, PanelConfig, CustomFeed } from '@/types';
import type { MarketplaceViewItem } from '@/types/marketplace';
import { FEATURES } from '@/services/feature-flags';
import { getUserTier, type FeatureTier } from '@/services/feature-flags';
import { subscribeToAuth } from '@/services/user-auth';
import { loginWithGoogle, logoutUser } from '@/services/firebase-auth';
import { User } from 'firebase/auth';
import { renderPreferences } from '@/services/preferences-content';

const SETTINGS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

export interface UnifiedSettingsConfig {
  getPanelSettings: () => Record<string, PanelConfig>;
  togglePanel: (key: string) => void;
  getDisabledSources: () => Set<string>;
  toggleSource: (name: string) => void;
  setSourcesEnabled: (names: string[], enabled: boolean) => void;
  getAllSourceNames: () => string[];
  getLocalizedPanelName: (key: string, fallback: string) => string;
  resetLayout: () => void;
  saveLayout: () => void;
  isDesktopApp: boolean;
  getMapLayers: () => MapLayers;
  openMarketplace: () => void;
  getMarketplaceItems: () => MarketplaceViewItem[];
  getCustomFeeds: () => CustomFeed[];
  addCustomFeed: (feed: CustomFeed) => void;
  removeCustomFeed: (id: string) => void;
}

type TabId = 'settings' | 'data' | 'panels' | 'sources' | 'profile';

export class UnifiedSettings {
  private overlay: HTMLElement;
  private config: UnifiedSettingsConfig;
  private activeTab: TabId = 'settings';
  private activeSourceRegion = 'all';
  private sourceFilter = '';
  private activePanelCategory = 'all';
  private panelFilter = '';
  private escapeHandler: (e: KeyboardEvent) => void;
  private prefsCleanup: (() => void) | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private currentUser: User | null = null;
  private authLoading = true;
  private currentTier: FeatureTier = 'free';
  private readonly openProfileHandler: () => void;
  private readonly openSourcesHandler: (e: Event) => void;

  private readonly profilePlans: Array<{
    key: FeatureTier;
    title: string;
    price: string;
    features: string[];
    featured?: boolean;
  }> = [
    {
      key: 'free',
      title: 'Hobbyist',
      price: '$0',
      features: ['All 680+ data feeds', '60 map layers · 6 lenses', 'Global instability pulse', 'Breaking alerts'],
    },
    {
      key: 'enthusiast',
      title: 'Enthusiast',
      price: '$9.97/mo',
      features: ['Everything free, plus:', 'AI summaries', 'Country-level scores', '30-day playback', 'Custom alert rules'],
    },
    {
      key: 'analyst',
      title: 'Analyst',
      price: '$19.97/mo',
      features: ['Everything in Enthusiast, plus:', 'AI Analyst chat', 'Situation reports', 'Live object tracking', 'Real-time & webhook alerts', 'Export · API · marketplace'],
      featured: true,
    },
    {
      key: 'strategist',
      title: 'Strategist',
      price: '$39.97/mo',
      features: ['Everything in Analyst, plus:', 'Premium AI models', 'Area monitors', 'Higher usage limits'],
    },
    {
      key: 'maximalist',
      title: 'Maximalist',
      price: '$99.97/mo',
      features: ['Everything in Strategist, plus:', 'Maximum usage limits', 'Priority processing'],
    },
  ];

  constructor(config: UnifiedSettingsConfig) {
    this.config = config;
    this.openProfileHandler = () => this.open('profile');
    this.openSourcesHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const panelId = detail?.panelId;
      if (panelId) {
        this.activeSourceRegion = this.getSourceRegionForPanel(panelId);
        this.sourceFilter = '';
        this.open('sources');
      }
    };

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.id = 'unifiedSettingsModal';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', t('header.settings'));

    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };

    this.overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target === this.overlay) {
        this.close();
        return;
      }

      if (target.closest('.unified-settings-close')) {
        this.close();
        return;
      }

      const tab = target.closest<HTMLElement>('.unified-settings-tab');
      if (tab?.dataset.tab) {
        this.switchTab(tab.dataset.tab as TabId);
        return;
      }

      const panelCatPill = target.closest<HTMLElement>('[data-panel-cat]');
      if (panelCatPill?.dataset.panelCat) {
        this.activePanelCategory = panelCatPill.dataset.panelCat;
        this.panelFilter = '';
        const searchInput = this.overlay.querySelector<HTMLInputElement>('.panels-search input');
        if (searchInput) searchInput.value = '';
        this.renderPanelCategoryPills();
        this.renderPanelsTab();
        return;
      }

      if (target.closest('.panels-save-layout')) {
        this.config.saveLayout();
        return;
      }

      if (target.closest('.panels-reset-layout')) {
        this.config.resetLayout();
        return;
      }

      const panelItem = target.closest<HTMLElement>('.panel-toggle-item');
      if (panelItem?.dataset.panel) {
        this.config.togglePanel(panelItem.dataset.panel);
        this.renderPanelsTab();
        return;
      }

      const sourceItem = target.closest<HTMLElement>('.source-toggle-item');
      if (sourceItem?.dataset.source) {
        this.config.toggleSource(sourceItem.dataset.source);
        this.renderSourcesGrid();
        this.updateSourcesCounter();
        return;
      }

      const pill = target.closest<HTMLElement>('.unified-settings-region-pill');
      if (pill?.dataset.region) {
        this.activeSourceRegion = pill.dataset.region;
        this.sourceFilter = '';
        const searchInput = this.overlay.querySelector<HTMLInputElement>('.sources-search input');
        if (searchInput) searchInput.value = '';
        this.renderRegionPills();
        this.renderSourcesGrid();
        this.updateSourcesCounter();
        return;
      }

      if (target.closest('.sources-select-all')) {
        const visible = this.getVisibleSourceNames();
        this.config.setSourcesEnabled(visible, true);
        this.renderSourcesGrid();
        this.updateSourcesCounter();
        return;
      }

      if (target.closest('.sources-select-none')) {
        const visible = this.getVisibleSourceNames();
        this.config.setSourcesEnabled(visible, false);
        this.renderSourcesGrid();
        this.updateSourcesCounter();
        return;
      }

      if (target.closest('[data-open-marketplace]')) {
        this.config.openMarketplace();
        return;
      }

      // Data section: import/export button handlers
      if (target.closest('#profileImportBtn')) {
        this.handleImportData();
        return;
      }

      if (target.closest('#profileExportBtn')) {
        this.handleExportData();
        return;
      }

      if (target.closest('#profileDeleteBtn')) {
        this.handleDeleteAccount();
        return;
      }

      // Community section: referral code copy
      if (target.closest('#copyReferralCode')) {
        this.handleCopyReferralCode();
        return;
      }
    });

    this.overlay.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.closest('.panels-search')) {
        this.panelFilter = target.value;
        this.renderPanelsTab();
      } else if (target.closest('.sources-search')) {
        this.sourceFilter = target.value;
        this.renderSourcesGrid();
        this.updateSourcesCounter();
      }
    });

    this.render();
    document.body.appendChild(this.overlay);
    window.addEventListener('worldmonitor:open-profile', this.openProfileHandler);
    window.addEventListener('worldmonitor:open-sources', this.openSourcesHandler);

    log.debug('[Settings] Subscribing to auth state');
    this.authUnsubscribe = subscribeToAuth((state) => {
      log.debug('[Settings] Auth state received:', { user: state.user?.email, loading: state.loading, configured: state.isConfigured });
      this.currentUser = state.user as User | null;
      this.authLoading = state.loading;
      this.currentTier = state.user ? state.tier : 'free';
      if (this.activeTab === 'profile') {
        log.debug('[Settings] Rendering profile tab');
        void this.renderProfileTab();
      }
    });
  }

  public open(tab?: TabId): void {
    if (tab) this.activeTab = tab;
    this.render();
    this.overlay.classList.add('active');
    localStorage.setItem('wm-settings-open', '1');
    document.addEventListener('keydown', this.escapeHandler);
    requestAnimationFrame(() => {
      this.overlay.querySelector<HTMLElement>('.unified-settings-modal')?.focus();
    });
    
    // Ensure profile tab renders if it's the profile tab
    if (this.activeTab === 'profile') {
      void this.renderProfileTab();
    }
  }

  public close(): void {
    this.overlay.classList.remove('active');
    localStorage.removeItem('wm-settings-open');
    document.removeEventListener('keydown', this.escapeHandler);
  }

  public refreshPanelToggles(): void {
    if (this.activeTab === 'panels') this.renderPanelsTab();
    if (this.activeTab === 'data') this.renderDataTab();
  }

  public getButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'unified-settings-btn';
    btn.id = 'unifiedSettingsBtn';
    btn.setAttribute('aria-label', t('header.settings'));
    btn.innerHTML = SETTINGS_SVG;
    btn.addEventListener('click', () => this.open());
    return btn;
  }

  public destroy(): void {
    this.prefsCleanup?.();
    this.prefsCleanup = null;
    this.authUnsubscribe?.();
    this.authUnsubscribe = null;
    window.removeEventListener('worldmonitor:open-profile', this.openProfileHandler);
    window.removeEventListener('worldmonitor:open-sources', this.openSourcesHandler);
    document.removeEventListener('keydown', this.escapeHandler);
    this.overlay.remove();
  }

  private getSourceRegionForPanel(panelId: string): string {
    // 1. Direct match
    if (panelId in SOURCE_REGION_MAP) {
      return panelId;
    }

    // 2. Case-insensitive / normalized match
    const normalizedMap: Record<string, string> = {};
    for (const key of Object.keys(SOURCE_REGION_MAP)) {
      normalizedMap[key.toLowerCase()] = key;
    }
    const normId = panelId.toLowerCase();
    if (normalizedMap[normId]) {
      return normalizedMap[normId];
    }

    // 3. Search active regions where feedKeys include panelId
    const feedKeys = new Set(Object.keys(FEEDS));
    const activeRegions = Object.entries(SOURCE_REGION_MAP).filter(([regionKey, regionDef]) => {
      if (regionKey === 'intel') return INTEL_SOURCES.length > 0;
      return regionDef.feedKeys.some(fk => feedKeys.has(fk));
    });

    const match = activeRegions.find(([_, def]) => def.feedKeys.includes(panelId));
    if (match) {
      return match[0];
    }

    // 4. Fallback: Search all regions
    const fallbackMatch = Object.entries(SOURCE_REGION_MAP).find(([_, def]) => def.feedKeys.includes(panelId));
    if (fallbackMatch) {
      return fallbackMatch[0];
    }

    return 'all';
  }

  private render(): void {
    this.prefsCleanup?.();
    this.prefsCleanup = null;

    const tabClass = (id: TabId) => `unified-settings-tab${this.activeTab === id ? ' active' : ''}`;
    const prefs = renderPreferences({
      isDesktopApp: this.config.isDesktopApp,
    });

    this.overlay.innerHTML = `
      <div class="modal unified-settings-modal" tabindex="-1">
        <div class="modal-header">
          <span class="modal-title">${t('header.settings')}</span>
          <button class="modal-close unified-settings-close" aria-label="Close">\u00d7</button>
        </div>
        <div class="unified-settings-tabs" role="tablist" aria-label="Settings">
          <button class="${tabClass('settings')}" data-tab="settings" role="tab" aria-selected="${this.activeTab === 'settings'}" id="us-tab-settings" aria-controls="us-tab-panel-settings">${t('header.tabSettings')}</button>
          <button class="${tabClass('data')}" data-tab="data" role="tab" aria-selected="${this.activeTab === 'data'}" id="us-tab-data" aria-controls="us-tab-panel-data">Data</button>
          <button class="${tabClass('panels')}" data-tab="panels" role="tab" aria-selected="${this.activeTab === 'panels'}" id="us-tab-panels" aria-controls="us-tab-panel-panels">${t('header.tabPanels')}</button>
          <button class="${tabClass('sources')}" data-tab="sources" role="tab" aria-selected="${this.activeTab === 'sources'}" id="us-tab-sources" aria-controls="us-tab-panel-sources">${t('header.tabSources')}</button>
          <button class="${tabClass('profile')}" data-tab="profile" role="tab" aria-selected="${this.activeTab === 'profile'}" id="us-tab-profile" aria-controls="us-tab-panel-profile">Profile</button>
        </div>
        <div class="unified-settings-tab-panel${this.activeTab === 'settings' ? ' active' : ''}" data-panel-id="settings" id="us-tab-panel-settings" role="tabpanel" aria-labelledby="us-tab-settings">
          ${prefs.html}
        </div>
        <div class="unified-settings-tab-panel${this.activeTab === 'data' ? ' active' : ''}" data-panel-id="data" id="us-tab-panel-data" role="tabpanel" aria-labelledby="us-tab-data">
          <p class="unified-settings-panel-note">Start from a mission pack or open the catalog to add data without hunting across panels.</p>
          <div class="data-manager-shell" id="usDataManager"></div>
        </div>
        <div class="unified-settings-tab-panel${this.activeTab === 'panels' ? ' active' : ''}" data-panel-id="panels" id="us-tab-panel-panels" role="tabpanel" aria-labelledby="us-tab-panels">
          <p class="unified-settings-panel-note">Choose which panels stay visible in the workspace. Use categories or search to narrow the list.</p>
          <div class="unified-settings-region-wrapper">
            <div class="unified-settings-region-bar" id="usPanelCatBar"></div>
          </div>
          <div class="panels-search">
            <input type="text" aria-label="${t('header.filterPanels')}" placeholder="${t('header.filterPanels')}" value="${escapeHtml(this.panelFilter)}" />
          </div>
          <div class="panel-toggle-grid" id="usPanelToggles"></div>
          <div class="panels-footer">
            <div class="panels-layout-dropdown">
              <button class="panels-layout-trigger">${t('header.saveResetLayout')}</button>
              <div class="panels-layout-menu">
                <button class="panels-save-layout">${t('header.saveLayout')}</button>
                <button class="panels-reset-layout">${t('header.resetLayout')}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="unified-settings-tab-panel${this.activeTab === 'sources' ? ' active' : ''}" data-panel-id="sources" id="us-tab-panel-sources" role="tabpanel" aria-labelledby="us-tab-sources">
          <p class="unified-settings-panel-note">Control feed noise by source. Disabled sources stop contributing to news panels and summaries.</p>
          <div id="usCustomFeedsContainer"></div>
          <div class="unified-settings-region-wrapper">
            <div class="unified-settings-region-bar" id="usRegionBar"></div>
          </div>
          <div class="sources-search">
            <input type="text" aria-label="${t('header.filterSources')}" placeholder="${t('header.filterSources')}" value="${escapeHtml(this.sourceFilter)}" />
          </div>
          <div class="sources-toggle-grid" id="usSourceToggles"></div>
          <div class="sources-footer">
            <span class="sources-counter" id="usSourcesCounter"></span>
            <button class="sources-select-all">${t('common.selectAll')}</button>
            <button class="sources-select-none">${t('common.selectNone')}</button>
          </div>
        </div>
        <div class="unified-settings-tab-panel${this.activeTab === 'profile' ? ' active' : ''}" data-panel-id="profile" id="us-tab-panel-profile" role="tabpanel" aria-labelledby="us-tab-profile">
          <div class="profile-tab" id="usProfileTab"></div>
        </div>
      </div>
    `;

    const settingsPanel = this.overlay.querySelector('#us-tab-panel-settings');
    if (settingsPanel) {
      this.prefsCleanup = prefs.attach(settingsPanel as HTMLElement);
    }

    this.renderPanelCategoryPills();
    this.renderDataTab();
    this.renderPanelsTab();
    this.renderRegionPills();
    this.renderSourcesGrid();
    this.renderCustomFeedsEditor();
    this.updateSourcesCounter();
    this.injectCustomFeedsStyles();
    if (this.activeTab === 'profile') {
      void this.renderProfileTab();
    }

    this.setupModalScrollButtons();
  }

  private setupModalScrollButtons(): void {
    const modal = this.overlay.querySelector<HTMLElement>('.unified-settings-modal');
    if (!modal) return;

    const NS = 'http://www.w3.org/2000/svg';
    const makeChevron = (direction: 'up' | 'down'): SVGElement => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
      const poly = document.createElementNS(NS, 'polyline');
      poly.setAttribute('points', direction === 'up' ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
      svg.appendChild(poly);
      return svg;
    };

    const topBtn = document.createElement('button');
    topBtn.className = 'scroll-to-top-btn';
    topBtn.setAttribute('aria-label', 'Scroll to top');
    topBtn.appendChild(makeChevron('up'));

    const bottomBtn = document.createElement('button');
    bottomBtn.className = 'scroll-to-bottom-btn';
    bottomBtn.setAttribute('aria-label', 'Scroll to bottom');
    bottomBtn.appendChild(makeChevron('down'));

    modal.appendChild(topBtn);
    modal.appendChild(bottomBtn);

    const update = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = modal;
      const scrollable = scrollHeight > clientHeight + 60;
      topBtn.classList.toggle('visible', scrollTop > 60);
      bottomBtn.classList.toggle('visible', scrollable && scrollTop < scrollHeight - clientHeight - 60);
    };

    modal.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(modal);
    update();

    topBtn.addEventListener('click', () => modal.scrollTo({ top: 0, behavior: 'smooth' }));
    bottomBtn.addEventListener('click', () => modal.scrollTo({ top: modal.scrollHeight, behavior: 'smooth' }));
  }

  private switchTab(tab: TabId): void {
    this.activeTab = tab;

    this.overlay.querySelectorAll('.unified-settings-tab').forEach(el => {
      const isActive = (el as HTMLElement).dataset.tab === tab;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-selected', String(isActive));
    });

    this.overlay.querySelectorAll('.unified-settings-tab-panel').forEach(el => {
      el.classList.toggle('active', (el as HTMLElement).dataset.panelId === tab);
    });

    if (tab === 'profile') {
      void this.renderProfileTab();
    }
  }

  private getAvailablePanelCategories(): Array<{ key: string; label: string }> {
    const panelKeys = new Set(Object.keys(this.config.getPanelSettings()));
    const variant = SITE_VARIANT || 'full';
    const categories: Array<{ key: string; label: string }> = [
      { key: 'all', label: t('header.sourceRegionAll') }
    ];

    for (const [catKey, catDef] of Object.entries(PANEL_CATEGORY_MAP)) {
      if (catDef.variants && !catDef.variants.includes(variant)) continue;
      const hasPanel = catDef.panelKeys.some(pk => panelKeys.has(pk));
      if (hasPanel) {
        categories.push({ key: catKey, label: t(catDef.labelKey) });
      }
    }

    return categories;
  }

  private getVisiblePanelEntries(): Array<[string, PanelConfig]> {
    const panelSettings = this.config.getPanelSettings();
    const variant = SITE_VARIANT || 'full';
    let entries = Object.entries(panelSettings)
      .filter(([key]) => key !== 'runtime-config' || this.config.isDesktopApp);

    if (this.activePanelCategory !== 'all') {
      const catDef = PANEL_CATEGORY_MAP[this.activePanelCategory];
      if (catDef && (!catDef.variants || catDef.variants.includes(variant))) {
        const allowed = new Set(catDef.panelKeys);
        entries = entries.filter(([key]) => allowed.has(key));
      }
    }

    if (this.panelFilter) {
      const lower = this.panelFilter.toLowerCase();
      entries = entries.filter(([key, panel]) =>
        key.toLowerCase().includes(lower) ||
        panel.name.toLowerCase().includes(lower) ||
        this.config.getLocalizedPanelName(key, panel.name).toLowerCase().includes(lower)
      );
    }

    return entries;
  }

  private renderPanelCategoryPills(): void {
    const bar = this.overlay.querySelector('#usPanelCatBar');
    if (!bar) return;

    const categories = this.getAvailablePanelCategories();
    bar.innerHTML = categories.map(c =>
      `<button class="unified-settings-region-pill${this.activePanelCategory === c.key ? ' active' : ''}" data-panel-cat="${c.key}">${escapeHtml(c.label)}</button>`
    ).join('');
  }

  private renderPanelsTab(): void {
    const container = this.overlay.querySelector('#usPanelToggles');
    if (!container) return;

    const entries = this.getVisiblePanelEntries();
    container.innerHTML = entries.map(([key, panel]) => `
      <div class="panel-toggle-item ${panel.enabled ? 'active' : ''}" data-panel="${escapeHtml(key)}">
        <div class="panel-toggle-checkbox">${panel.enabled ? '\u2713' : ''}</div>
        <span class="panel-toggle-label">${escapeHtml(this.config.getLocalizedPanelName(key, panel.name))}</span>
      </div>
    `).join('');
  }

  private getAvailableRegions(): Array<{ key: string; label: string }> {
    const feedKeys = new Set(Object.keys(FEEDS));
    const regions: Array<{ key: string; label: string }> = [
      { key: 'all', label: t('header.sourceRegionAll') }
    ];

    for (const [regionKey, regionDef] of Object.entries(SOURCE_REGION_MAP)) {
      if (regionKey === 'intel') {
        if (INTEL_SOURCES.length > 0) {
          regions.push({ key: regionKey, label: t(regionDef.labelKey) });
        }
        continue;
      }
      const hasFeeds = regionDef.feedKeys.some(fk => feedKeys.has(fk));
      if (hasFeeds) {
        regions.push({ key: regionKey, label: t(regionDef.labelKey) });
      }
    }

    return regions;
  }

  private getSourcesByRegion(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const feedKeys = new Set(Object.keys(FEEDS));

    for (const [regionKey, regionDef] of Object.entries(SOURCE_REGION_MAP)) {
      const sources: string[] = [];
      if (regionKey === 'intel') {
        INTEL_SOURCES.forEach(f => sources.push(f.name));
      } else {
        for (const fk of regionDef.feedKeys) {
          if (feedKeys.has(fk)) {
            FEEDS[fk]!.forEach(f => sources.push(f.name));
          }
        }
      }
      if (sources.length > 0) {
        map.set(regionKey, sources.sort((a, b) => a.localeCompare(b)));
      }
    }

    return map;
  }

  private getVisibleSourceNames(): string[] {
    let sources: string[];
    if (this.activeSourceRegion === 'all') {
      sources = this.config.getAllSourceNames();
    } else {
      const byRegion = this.getSourcesByRegion();
      sources = byRegion.get(this.activeSourceRegion) || [];
    }

    if (this.sourceFilter) {
      const lower = this.sourceFilter.toLowerCase();
      sources = sources.filter(s => s.toLowerCase().includes(lower));
    }

    return sources;
  }

  private renderRegionPills(): void {
    const bar = this.overlay.querySelector('#usRegionBar');
    if (!bar) return;

    const regions = this.getAvailableRegions();
    bar.innerHTML = regions.map(r =>
      `<button class="unified-settings-region-pill${this.activeSourceRegion === r.key ? ' active' : ''}" data-region="${r.key}">${escapeHtml(r.label)}</button>`
    ).join('');
  }

  private renderSourcesGrid(): void {
    const container = this.overlay.querySelector('#usSourceToggles');
    if (!container) return;

    const sources = this.getVisibleSourceNames();
    const disabled = this.config.getDisabledSources();

    container.innerHTML = sources.map(source => {
      const isEnabled = !disabled.has(source);
      const escaped = escapeHtml(source);
      const tier = getSourceTier(source);
      const type = getSourceType(source);
      const risk = getSourcePropagandaRisk(source);
      const panelId = getSourcePanelId(source);
      return `
        <div class="source-toggle-item ${isEnabled ? 'active' : ''}" data-source="${escaped}">
          <div class="source-toggle-checkbox">${isEnabled ? '\u2713' : ''}</div>
          <div class="source-toggle-copy">
            <span class="source-toggle-label">${escaped}</span>
            <span class="source-toggle-meta">Tier ${tier} • ${escapeHtml(type)} • ${escapeHtml(panelId)}${risk.risk !== 'low' ? ` • ${escapeHtml(risk.risk)} risk` : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  private renderDataTab(): void {
    const container = this.overlay.querySelector('#usDataManager');
    if (!container) return;

    const panelSettings = this.config.getPanelSettings();
    const enabledPanels = Object.values(panelSettings).filter((panel) => panel.enabled).length;
    const disabled = this.config.getDisabledSources();
    const allSources = this.config.getAllSourceNames();
    const enabledSources = allSources.length - disabled.size;
    const mapLayers = this.config.getMapLayers();
    const enabledLayers = Object.values(mapLayers).filter(Boolean).length;
    const marketplaceItems = this.config.getMarketplaceItems();

    container.innerHTML = `
      <section class="data-manager-summary">
        <div><strong>${enabledPanels}</strong><span>Panels enabled</span></div>
        <div><strong>${enabledSources}</strong><span>Sources enabled</span></div>
        <div><strong>${enabledLayers}</strong><span>Map layers enabled</span></div>
        <div><strong>${marketplaceItems.length}</strong><span>Packages installed</span></div>
      </section>

      <section class="data-manager-section">
        <div class="data-manager-section-head">
          <div>
            <strong>Add / Manage Data</strong>
            <span>One place to grow the workspace across decks, panels, layers, sources, and packages.</span>
          </div>
          <button class="data-manager-primary" type="button" data-open-marketplace="true">Open catalog</button>
        </div>
      </section>

      <section class="data-manager-section">
        <div class="data-manager-section-head">
          <div>
            <strong>Installed marketplace packages</strong>
            <span>${marketplaceItems.length > 0 ? 'Currently extending this workspace.' : 'No installed packages yet.'}</span>
          </div>
        </div>
        <div class="data-manager-installed-grid">
          ${marketplaceItems.map((item) => `
            <article class="data-manager-installed-card">
              <strong>${escapeHtml(item.manifest.name)}</strong>
              <span>${escapeHtml(item.manifest.category)} • ${item.enabled ? 'enabled' : 'disabled'}</span>
            </article>
          `).join('') || '<div class="data-manager-empty">Install catalog packages to add reusable map, search, and panel surfaces.</div>'}
        </div>
      </section>
    `;
  }

  private updateSourcesCounter(): void {
    const counter = this.overlay.querySelector('#usSourcesCounter');
    if (!counter) return;

    const disabled = this.config.getDisabledSources();
    const allSources = this.config.getAllSourceNames();
    const enabledTotal = allSources.length - disabled.size;

    counter.textContent = t('header.sourcesEnabled', { enabled: String(enabledTotal), total: String(allSources.length) });
  }

  private async handleLogin(): Promise<void> {
    const user = await loginWithGoogle();
    if (user) {
      void this.renderProfileTab();
    }
  }

  private async handleLogout(): Promise<void> {
    await logoutUser();
    void this.renderProfileTab();
  }

  private renderPlanCards(): string {
    return this.profilePlans.map((plan) => {
      const isCurrent = plan.key === this.currentTier;
      const classes = ['profile-plan-card', plan.featured ? 'featured' : '', isCurrent ? 'current' : ''].filter(Boolean).join(' ');
      const buttonLabel = isCurrent
        ? 'Current Plan'
        : plan.key === 'free'
          ? 'Included Free'
          : `Upgrade to ${plan.title}`;

      return `
        <div class="${classes}">
          <h5>${plan.title}</h5>
          <p class="plan-price">${plan.price}</p>
          <ul class="plan-features">
            ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
          </ul>
          <button class="profile-upgrade-btn" data-tier="${plan.key}" ${isCurrent || plan.key === 'free' ? 'disabled' : ''}>${buttonLabel}</button>
        </div>
      `;
    }).join('');
  }

  private async renderProfileTab(): Promise<void> {
    const container = this.overlay.querySelector('#usProfileTab');
    log.debug('[Settings] Profile container:', container);
    if (!container) {
      log.debug('[Settings] Container not found, checking DOM...');
      log.debug('[Settings] All elements with usProfileTab:', this.overlay.querySelectorAll('[id*="Profile"]'));
      return;
    }

    const user = this.currentUser;

    if (user) {
      this.currentTier = await getUserTier();
    } else {
      this.currentTier = 'free';
    }

    // If still loading after timeout, show guest view
    if (this.authLoading) {
      container.innerHTML = `
        <div class="profile-guest">
          <div class="profile-icon">👤</div>
          <h3>Sign in to access more features</h3>
          <p>Login to unlock AI summaries, historical playback, and more.</p>
          <button class="profile-login-btn" id="profileLoginBtn">Sign in with Google</button>
        </div>
        <div class="profile-features">
          <h4>Free Features</h4>
          <ul>
            ${FEATURES.filter(f => f.tier === 'free').map(f => `<li>✓ ${f.name}</li>`).join('')}
          </ul>
          <h4>Login Required</h4>
          <ul>
            ${FEATURES.filter(f => f.tier === 'logged_in').map(f => `<li>🔒 ${f.name}</li>`).join('')}
          </ul>
        </div>
      `;
      container.querySelector('#profileLoginBtn')?.addEventListener('click', () => this.handleLogin());
      return;
    }

    if (!user) {
      container.innerHTML = `
        <div class="profile-guest">
          <div class="profile-icon">👤</div>
          <h3>Sign in to access more features</h3>
          <p>Login to unlock AI summaries, historical playback, and more.</p>
          <button class="profile-login-btn" id="profileLoginBtn">Sign in with Google</button>
        </div>
        <div class="profile-features">
          <h4>Free Features</h4>
          <ul>
            ${FEATURES.filter(f => f.tier === 'free').map(f => `<li>✓ ${f.name}</li>`).join('')}
          </ul>
          <h4>Login Required</h4>
          <ul>
            ${FEATURES.filter(f => f.tier === 'logged_in').map(f => `<li>🔒 ${f.name}</li>`).join('')}
          </ul>
        </div>
      `;
      container.querySelector('#profileLoginBtn')?.addEventListener('click', () => this.handleLogin());
      return;
    }

    container.innerHTML = `
      <div class="profile-logged-in">
        <img src="${user.photoURL || ''}" alt="${user.displayName}" class="profile-avatar" />
        <div class="profile-info">
          <h3>${user.displayName || 'User'}</h3>
          <p>${user.email || ''}</p>
        </div>
        <span class="profile-tier-badge" id="profileTierBadge">${escapeHtml(this.currentTier.charAt(0).toUpperCase() + this.currentTier.slice(1))}</span>
        <button class="profile-logout-btn" id="profileLogoutBtn">Sign Out</button>
      </div>

      <div class="profile-section">
        <h4>Plans</h4>
        <div class="profile-plan-grid">
          ${this.renderPlanCards()}
        </div>
      </div>
        <ul class="profile-feature-list">
          ${FEATURES.map(f => `<li>✓ ${f.name}</li>`).join('')}
        </ul>
      </div>
      
      <div class="profile-section">
        <h4>Account Preferences</h4>
        <div class="profile-preference">
          <label class="profile-toggle-label">
            <input type="checkbox" id="prefEmailAlerts" checked />
            <span>Email Alerts</span>
          </label>
          <p class="profile-preference-desc">Receive breaking news via email</p>
        </div>
        <div class="profile-preference">
          <label class="profile-toggle-label">
            <input type="checkbox" id="prefDarkMode" checked />
            <span>Dark Mode</span>
          </label>
          <p class="profile-preference-desc">Use dark theme (follows system)</p>
        </div>
      </div>
      
      <div class="profile-section">
        <h4>Linked Accounts</h4>
        <p class="profile-section-desc">Connect your other accounts for easier login</p>
        <div class="profile-linked-accounts">
          <div class="profile-linked-account">
            <span class="profile-linked-icon">🔗</span>
            <div class="profile-linked-info">
              <span class="profile-linked-name">Google</span>
              <span class="profile-linked-status connected">Connected</span>
            </div>
            <span class="profile-linked-check">✓</span>
          </div>
          <button class="profile-add-account-btn" id="profileLinkAccountBtn">Link Another Account</button>
        </div>
      </div>
      
      <div class="profile-section">
        <h4>Two-Factor Authentication</h4>
        <p class="profile-section-desc">Add extra security to your account</p>
        <div class="profile-2fa">
          <div class="profile-2fa-status">
            <span class="profile-2fa-icon">🔐</span>
            <div class="profile-2fa-info">
              <span class="profile-2fa-label">Authenticator App</span>
              <span class="profile-2fa-desc">Use an app like Google Authenticator</span>
            </div>
          </div>
          <button class="profile-2fa-btn" id="profileEnable2FABtn">Enable 2FA</button>
        </div>
        <div class="profile-2fa">
          <div class="profile-2fa-status">
            <span class="profile-2fa-icon">📱</span>
            <div class="profile-2fa-info">
              <span class="profile-2fa-label">SMS Verification</span>
              <span class="profile-2fa-desc">Receive codes via text message</span>
            </div>
          </div>
          <button class="profile-2fa-btn" id="profileEnableSMSBtn">Enable</button>
        </div>
      </div>
      
      <div class="profile-section">
        <h4>Data & Community</h4>
        <div class="profile-actions">
          <button class="profile-action-btn" id="profileExportBtn">Export Settings</button>
          <button class="profile-action-btn" id="profileImportBtn">Import Settings</button>
        </div>
        <div class="profile-community-section">
          <h5>Invite Friends</h5>
          <p class="profile-community-desc">Share EdgePannel and earn bonus features when they sign up.</p>
          <div class="profile-referral-row">
            <code class="profile-referral-code" id="referralCodeDisplay">Loading...</code>
            <button class="profile-action-btn small" id="copyReferralCode">Copy Code</button>
          </div>
          <div class="profile-referral-share">
            <button class="profile-share-btn twitter" id="shareTwitter">Share on X</button>
            <button class="profile-share-btn linkedin" id="shareLinkedIn">Share on LinkedIn</button>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <h4>Data Management</h4>
        <div class="profile-actions">
          <button class="profile-action-btn danger" id="profileDeleteBtn">Delete Account</button>
        </div>
      </div>
      
      <div class="profile-section">
        <h4>Account Info</h4>
        <div class="profile-info-row">
          <span class="profile-info-label">User ID:</span>
          <span class="profile-info-value">${user.uid.slice(0, 12)}...</span>
        </div>
        <div class="profile-info-row">
          <span class="profile-info-label">Joined:</span>
          <span class="profile-info-value">${user.metadata?.creationTime || 'Recently'}</span>
        </div>
        <div class="profile-info-row">
          <span class="profile-info-label">Last Login:</span>
          <span class="profile-info-value">${user.metadata?.lastSignInTime || 'Recently'}</span>
        </div>
      </div>
    `;
    container.querySelector('#profileLogoutBtn')?.addEventListener('click', () => this.handleLogout());
    container.querySelector('#profileDeleteBtn')?.addEventListener('click', () => this.handleDeleteAccount());
    container.querySelectorAll('.profile-upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tier = (btn as HTMLElement).dataset.tier;
        if (tier) this.handleUpgrade(tier);
      });
    });

    // Social share buttons
    container.querySelector('#shareTwitter')?.addEventListener('click', () => {
      const text = encodeURIComponent('Check out EdgePannel - real-time global monitoring at edgepannel.app');
      window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
    });
    container.querySelector('#shareLinkedIn')?.addEventListener('click', () => {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://edgepannel.app')}`, '_blank');
    });

    // Fetch referral code display
    void this.populateReferralCode(user);
  }

  private async handleExportData(): Promise<void> {
    const data: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: __APP_VERSION__ ?? '0.1.0',
    };

    // Gather preferences from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wm-') || key.startsWith('unified-settings-'))) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key)!);
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }

    // Gather IndexedDB cache snapshots if available
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('worldmonitor');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const storeNames = Array.from(db.objectStoreNames);
      for (const store of storeNames) {
        const tx = db.transaction(store, 'readonly');
        const items = await new Promise<any[]>((resolve, reject) => {
          const getAll = tx.objectStore(store).getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => reject(getAll.error);
        });
        if (items.length > 0) data[`indexeddb:${store}`] = items;
      }
      db.close();
    } catch {
      // IndexedDB not available — skip
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worldmonitor-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async handleImportData(): Promise<void> {
    // Create a hidden file input for importing JSON settings
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate basic structure
        if (!data.exportedAt) {
          alert('This does not appear to be an EdgePannel settings export.');
          return;
        }

        // Restore localStorage entries
        let restored = 0;
        for (const [key, value] of Object.entries(data)) {
          if (key === 'exportedAt' || key === 'version' || key === 'indexeddb') continue;
          if (key.startsWith('wm-') || key.startsWith('unified-settings-')) {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            restored++;
          }
        }

        const confirmed = confirm(`Restored ${restored} settings from export dated ${data.exportedAt}.\n\nReload the page to apply changes?`);
        if (confirmed) {
          window.location.reload();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Failed to import settings: ${message}`);
      }
    };

    input.click();
  }

  private async handleCopyReferralCode(): Promise<void> {
    const codeEl = this.overlay.querySelector<HTMLElement>('#referralCodeDisplay');
    if (!codeEl) return;
    const code = codeEl.textContent?.trim() || '';
    if (!code || code === 'Loading...') return;

    try {
      await navigator.clipboard.writeText(code);
      codeEl.textContent = 'Copied!';
      setTimeout(() => { codeEl.textContent = code; }, 2000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand('copy');
      sel?.removeAllRanges();
    }
  }

  private async handleDeleteAccount(): Promise<void> {
    const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (confirmed) {
      alert('Account deletion coming soon! Contact support for now.');
    }
  }

  private async populateReferralCode(user: User): Promise<void> {
    // Try to get referral code from Convex
    const codeEl = this.overlay.querySelector<HTMLElement>('#referralCodeDisplay');
    try {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
      if (convexUrl) {
        const resp = await fetch(`${convexUrl}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'register-interest:getPosition',
            arguments: { referralCode: user.uid.slice(0, 8) },
          }),
          signal: AbortSignal.timeout(3_000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.referralCount !== undefined && codeEl) {
            codeEl.textContent = `${user.uid.slice(0, 8)} · ${data.referralCount} referrals`;
            return;
          }
        }
      }
    } catch {
      // Fall through to default
    }

    if (codeEl) codeEl.textContent = user.uid.slice(0, 8);
  }

  private async handleUpgrade(tier: string): Promise<void> {
    if (tier === 'free') {
      return;
    }

    // Hand off to the checkout endpoint, which creates a Stripe Checkout session
    // and redirects the browser to Stripe's hosted payment page.
    const uid = this.currentUser?.uid;
    window.location.href = `/api/checkout?tier=${tier}&uid=${uid || ''}`;
  }

  private injectCustomFeedsStyles(): void {
    if (this.overlay.querySelector('#custom-feeds-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'custom-feeds-styles';
    styleEl.textContent = `
      .custom-feeds-editor-container {
        margin: 15px 0 25px 0;
        padding: 20px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
      }
      .custom-feeds-form-header {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: bold;
        color: #ffaa00;
        letter-spacing: 2px;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255, 170, 0, 0.15);
        padding-bottom: 8px;
        text-transform: uppercase;
      }
      .custom-feeds-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .custom-feeds-form .form-row {
        display: flex;
        gap: 16px;
      }
      .custom-feeds-form .form-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .custom-feeds-form .form-group.flex-2 {
        flex: 2;
      }
      .custom-feeds-form label {
        font-size: 11px;
        font-weight: 600;
        color: #888;
      }
      .custom-feeds-form input, .custom-feeds-form select {
        background: #0a0c10;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        padding: 8px 12px;
        color: #fff;
        font-size: 12px;
        font-family: var(--font-body);
        outline: none;
        transition: border-color 0.2s;
      }
      .custom-feeds-form input:focus, .custom-feeds-form select:focus {
        border-color: #ffaa00;
      }
      .custom-feeds-submit-btn {
        align-self: flex-end;
        background: #ffaa00;
        color: #000;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .custom-feeds-submit-btn:hover {
        background: #ffbb33;
      }
      .custom-feeds-submit-btn:active {
        transform: scale(0.98);
      }
      .custom-feeds-list-container {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 180px;
        overflow-y: auto;
      }
      .custom-feed-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.01);
        border: 1px solid rgba(255, 255, 255, 0.04);
        padding: 8px 12px;
        border-radius: 4px;
      }
      .custom-feed-list-item-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        text-align: left;
      }
      .custom-feed-list-item-name {
        font-size: 12px;
        font-weight: 600;
        color: #fff;
      }
      .custom-feed-list-item-meta {
        font-size: 10px;
        color: #666;
      }
      .custom-feed-list-item-delete {
        background: none;
        border: none;
        color: #ff4444;
        font-size: 16px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s, color 0.2s;
      }
      .custom-feed-list-item-delete:hover {
        background: rgba(255, 68, 68, 0.1);
        color: #ff6666;
      }
    `;
    this.overlay.appendChild(styleEl);
  }

  private renderCustomFeedsEditor(): void {
    const container = this.overlay.querySelector('#usCustomFeedsContainer');
    if (!container) return;

    const feeds = this.config.getCustomFeeds ? this.config.getCustomFeeds() : [];

    container.innerHTML = `
      <div class="custom-feeds-editor-container">
        <div class="custom-feeds-form-header">CUSTOM INTELLIGENCE SOURCES</div>
        <form class="custom-feeds-form" id="customFeedsForm">
          <div class="form-row">
            <div class="form-group">
              <label for="cfName">Source Name</label>
              <input type="text" id="cfName" placeholder="e.g. Spectator Index" required />
            </div>
            <div class="form-group">
              <label for="cfType">Feed Type</label>
              <select id="cfType">
                <option value="rss">RSS Feed URL</option>
                <option value="telegram">Telegram Channel Handle</option>
                <option value="x">X (Twitter) Username</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group flex-2">
              <label for="cfUrl" id="cfUrlLabel">Feed URL</label>
              <input type="text" id="cfUrl" placeholder="https://example.com/rss.xml" required />
            </div>
            <div class="form-group" id="cfCategoryGroup">
              <label for="cfCategory">Category</label>
              <select id="cfCategory">
                <option value="politics">Politics</option>
                <option value="us">United States</option>
                <option value="europe">Europe</option>
                <option value="middleeast">Middle East</option>
                <option value="africa">Africa</option>
                <option value="latam">Latin America</option>
                <option value="asia">Asia-Pacific</option>
                <option value="tech">Technology</option>
                <option value="ai">AI / ML</option>
                <option value="finance">Finance / Markets</option>
              </select>
            </div>
          </div>
          <button type="submit" class="custom-feeds-submit-btn">+ Add Custom Source</button>
        </form>
        <div class="custom-feeds-list-container" id="customFeedsList"></div>
      </div>
    `;

    const typeSelect = container.querySelector('#cfType') as HTMLSelectElement;
    const urlLabel = container.querySelector('#cfUrlLabel') as HTMLLabelElement;
    const urlInput = container.querySelector('#cfUrl') as HTMLInputElement;

    typeSelect?.addEventListener('change', () => {
      const type = typeSelect.value;
      if (type === 'rss') {
        urlLabel.textContent = 'Feed URL';
        urlInput.placeholder = 'https://example.com/rss.xml';
      } else if (type === 'telegram') {
        urlLabel.textContent = 'Telegram Handle';
        urlInput.placeholder = 'e.g. MiddleEastSpectator';
      } else if (type === 'x') {
        urlLabel.textContent = 'X (Twitter) Username';
        urlInput.placeholder = 'e.g. elonmusk';
      }
    });

    const listContainer = container.querySelector('#customFeedsList') as HTMLElement;
    if (listContainer) {
      if (feeds.length === 0) {
        listContainer.innerHTML = '<div style="font-size: 11px; color: #555; text-align: center; padding: 10px;">No custom sources added yet.</div>';
      } else {
        listContainer.innerHTML = feeds.map(f => `
          <div class="custom-feed-list-item">
            <div class="custom-feed-list-item-info">
              <span class="custom-feed-list-item-name">${escapeHtml(f.name)}</span>
              <span class="custom-feed-list-item-meta">${escapeHtml(f.type.toUpperCase())} • ${escapeHtml(f.category)} • ${escapeHtml(f.url)}</span>
            </div>
            <button class="custom-feed-list-item-delete" data-feed-id="${f.id}" title="Remove feed">&times;</button>
          </div>
        `).join('');

        listContainer.querySelectorAll('.custom-feed-list-item-delete').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).dataset.feedId;
            if (id) {
              this.config.removeCustomFeed(id);
              this.renderCustomFeedsEditor();
              this.renderSourcesGrid();
              this.updateSourcesCounter();
              window.dispatchEvent(new CustomEvent('worldmonitor:refresh-pipeline'));
            }
          });
        });
      }
    }

    const form = container.querySelector('#customFeedsForm') as HTMLFormElement;
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (container.querySelector('#cfName') as HTMLInputElement).value.trim();
      const type = typeSelect.value as 'rss' | 'telegram' | 'x';
      const rawUrl = urlInput.value.trim();
      const category = (container.querySelector('#cfCategory') as HTMLSelectElement).value;

      if (!name || !rawUrl) return;

      let finalUrl = rawUrl;
      if (type === 'telegram') {
        finalUrl = rawUrl.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?t\.me\//, '');
      } else if (type === 'x') {
        const cleanHandle = rawUrl.replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?(twitter|x)\.com\//, '');
        finalUrl = `https://news.google.com/rss/search?q=site:twitter.com/${cleanHandle}`;
      }

      const newFeed: CustomFeed = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        url: finalUrl,
        category,
        type,
      };

      this.config.addCustomFeed(newFeed);
      this.renderCustomFeedsEditor();
      this.renderSourcesGrid();
      this.updateSourcesCounter();
      window.dispatchEvent(new CustomEvent('worldmonitor:refresh-pipeline'));
    });
  }
}
