import type { MapLayers, RelatedAsset } from '@/types';
import { listWorkspaces, getActiveWorkspaceId, clearActiveWorkspace } from '@/services/workspaces';
import { escapeHtml } from '@/utils/sanitize';
import { SITE_VARIANT, STORAGE_KEYS, getVariantStorageKey } from '@/config';
import { trackVariantSwitch } from '@/services/analytics';
import { isDesktopRuntime } from '@/services/runtime';

const CUSTOM_CATEGORIES_KEY = 'wm-custom-categories-v1';

export interface SiteVariantInfo {
  id: string;
  icon: string;
  labelKey: string;
  /** Production URL — each variant is a separate deployment there, so prod links here instead of switching in place. */
  prodUrl: string;
}

/** Single source of truth for the 6 built-in site variants — shared by the header switcher, mobile menu, and the Workspaces panel. */
export const SITE_VARIANTS: SiteVariantInfo[] = [
  { id: 'full', icon: '🌍', labelKey: 'header.world', prodUrl: 'https://edgepannel.app' },
  { id: 'tech', icon: '💻', labelKey: 'header.tech', prodUrl: 'https://tech.edgepannel.app' },
  { id: 'finance', icon: '📈', labelKey: 'header.finance', prodUrl: 'https://finance.edgepannel.app' },
  { id: 'commodity', icon: '⛏️', labelKey: 'header.commodity', prodUrl: 'https://commodity.edgepannel.app' },
  { id: 'happy', icon: '☀️', labelKey: 'header.happy', prodUrl: 'https://happy.edgepannel.app' },
  { id: 'conflicts', icon: '⚔️', labelKey: 'header.conflicts', prodUrl: 'https://conflicts.edgepannel.app' },
];

/** Local dev and the desktop app can switch variants in place; in production each variant is a separate deployment reached via a link. */
export function canSwitchVariantInPlace(): boolean {
  return isDesktopRuntime() || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

/** Switches SITE_VARIANT and reloads. Only meaningful where canSwitchVariantInPlace() is true. */
export function switchToVariant(variant: string): void {
  trackVariantSwitch(SITE_VARIANT, variant);
  localStorage.setItem('worldmonitor-variant', variant);
  clearActiveWorkspace();

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

export const NEWS_REFRESH_SWEEP_EVENT = 'wm:news-refresh-sweep';
export const APP_TIME_RANGE_STORAGE_KEY = 'wm:time-range';
export const APP_TIME_RANGE_EVENT = 'wm:time-range-changed';

/**
 * Briefly glows a panel's border/shadow in the accent color, same visual
 * language as the existing `.panel-shared-highlight` treatment — reused here
 * to flag "this panel just re-rendered" after a time-range switch (mirrors
 * SitDeck's widget-update flash).
 */
export function flashPanelUpdate(element: HTMLElement): void {
  element.classList.remove('panel-shared-highlight');
  void element.offsetWidth; // force reflow so a re-trigger restarts the animation
  element.classList.add('panel-shared-highlight');
  setTimeout(() => element.classList.remove('panel-shared-highlight'), 2500);
}

const RELATED_ASSET_LAYER_MAP: Record<RelatedAsset['type'], keyof MapLayers> = {
  pipeline: 'pipelines',
  cable: 'cables',
  datacenter: 'datacenters',
  base: 'bases',
  nuclear: 'nuclear',
  irradiator: 'irradiators',
  spaceport: 'spaceports',
  waterway: 'waterways',
  economicCenter: 'economic',
  aptGroup: 'aptGroups',
  mineral: 'minerals',
  startupHub: 'startupHubs',
  accelerator: 'accelerators',
  cloudRegion: 'cloudRegions',
  techHQ: 'techHQs',
  stockExchange: 'stockExchanges',
  financialCenter: 'financialCenters',
  centralBank: 'centralBanks',
  commodityHub: 'commodityHubs',
  miningSite: 'miningSites',
  processingPlant: 'processingPlants',
  commodityPort: 'commodityPorts',
};

/**
 * Saved workspaces (including decks created from a Deck Template) rendered as
 * tabs in the top-left variant switcher, next to the built-in variant links —
 * so a created deck is reachable from the main nav, not just from the
 * Workspaces overlay. Lives here (rather than in workspaces.ts) since it's
 * DOM-markup generation, not workspace data logic.
 */
export function renderWorkspaceTabsHtml(): string {
  const activeId = getActiveWorkspaceId();
  return listWorkspaces()
    .filter(w => w.variant === SITE_VARIANT)
    .map(w => `
      <span class="variant-divider"></span>
      <a href="#"
         class="variant-option workspace-tab${w.id === activeId ? ' active' : ''}"
         data-workspace-id="${escapeHtml(w.id)}"
         title="Switch to “${escapeHtml(w.name)}” (${w.panelCount} panel${w.panelCount === 1 ? '' : 's'})">
        <span class="variant-icon">\u{1F5C2}\u{FE0F}</span>
        <span class="variant-label">${escapeHtml(w.name)}</span>
      </a>`)
    .join('');
}

/**
 * Custom categories predate decks and only ever stored a name + emoji — clicking
 * one did nothing, and they were global while decks are per-variant, so there's
 * no faithful way to carry them forward. Just clear the old storage key.
 */
export function clearLegacyCategories(): void {
  try {
    localStorage.removeItem(CUSTOM_CATEGORIES_KEY);
  } catch {
    // ignore
  }
}

/** Re-renders the workspace-tab group in place after a save/delete/rename that didn't reload the page. */
export function refreshWorkspaceTabsInHeader(): void {
  const group = document.getElementById('workspaceTabsGroup');
  if (group) group.innerHTML = renderWorkspaceTabsHtml();
}

export function getRelatedAssetLayer(type: RelatedAsset['type']): keyof MapLayers {
  return RELATED_ASSET_LAYER_MAP[type];
}
