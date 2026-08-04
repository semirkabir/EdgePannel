import { escapeHtml } from '@/utils/sanitize';
import { DEFAULT_PANELS, MISSION_PACKS, SITE_VARIANT } from '@/config';
import type { MarketplaceCatalogItem, MarketplaceManifest, MarketplacePreviewAsset, MarketplaceVariant, MarketplaceViewItem } from '@/types/marketplace';
import { MarketplaceService } from '@/services/marketplace';
import { renderGroupedInstalledItems, renderInstalledItemActions } from '@/utils/marketplace-installed-ui';
import {
  listWorkspaces,
  saveWorkspace,
  applyWorkspace,
  deleteWorkspace,
  renameWorkspace,
  createWorkspaceFromTemplate,
  createWorkspaceFromMissionPack,
  type Workspace,
} from '@/services/workspaces';
import { DECK_TEMPLATES } from '@/config/deck-templates';
import {
  refreshWorkspaceTabsInHeader,
  SITE_VARIANTS,
  canSwitchVariantInPlace,
  switchToVariant,
} from '@/app/panel-layout-helpers';

export type MarketplaceTab = 'decks' | 'browse' | 'installed' | 'import' | 'submit';

interface MarketplaceModalFilters {
  search: string;
  category: string;
  surface: string;
  variant: string;
  installState: string;
}

interface MarketplaceModalHandlers {
  onOpenPanel?: (itemId: string) => void;
  onOpenAppPanel?: (panelId: string) => void;
  onOpenSearch?: () => void;
  requireInstallAccess?: () => boolean;
  requireSubmitAccess?: () => boolean;
}

const TAB_KEY = 'wm-marketplace-modal-tab-v1';
const FILTER_KEY = 'wm-marketplace-modal-filters-v1';

function defaultFilters(): MarketplaceModalFilters {
  return {
    search: '',
    category: 'all',
    surface: 'all',
    variant: 'all',
    installState: 'all',
  };
}

function authorAvatar(author: string, size: 'sm' | 'md' = 'md'): string {
  const initials = author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('');
  const hue = [...author].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const sizeClass = size === 'sm' ? ' marketplace-author-avatar--sm' : '';
  return `<span class="marketplace-author-avatar${sizeClass}" style="--avatar-hue:${hue}">${escapeHtml(initials)}</span>`;
}

function authorWithAvatar(author: string, size: 'sm' | 'md' = 'md'): string {
  return `<strong class="marketplace-modal-author-row">${authorAvatar(author, size)}<span class="marketplace-modal-author-name">${escapeHtml(author)}</span></strong>`;
}

function formatUpdateEvery(datasets: MarketplaceManifest['datasets']): string {
  const intervals = datasets.map((d) => d.pollingIntervalMs).filter((ms): ms is number => typeof ms === 'number');
  if (intervals.length === 0) return 'manual refresh';
  const ms = Math.min(...intervals);
  if (ms < 60_000) return `every ${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `every ${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) {
    const hrs = Math.round(ms / 3_600_000);
    return `every ${hrs === 1 ? 'hour' : `${hrs} hrs`}`;
  }
  const days = Math.round(ms / 86_400_000);
  return days === 1 ? 'every day' : `approx. every ${days} days`;
}

function computeSchemaSummary(manifest: MarketplaceManifest): string {
  return manifest.datasets
    .map((dataset) => {
      const fields = Object.keys(dataset.fieldMap ?? {}).slice(0, 6);
      const fieldText = fields.length > 0 ? ` • ${fields.join(', ')}` : '';
      return `${dataset.name} (${dataset.format.toUpperCase()})${fieldText}`;
    })
    .join(' • ');
}

function previewMarkup(previews: MarketplacePreviewAsset[] | undefined): string {
  if (!previews || previews.length === 0) return '';
  return `
    <div class="marketplace-modal-previews">
      ${previews.map((preview) => preview.type === 'image'
        ? `
          <div class="marketplace-modal-preview image">
            ${preview.url ? `<img src="${escapeHtml(preview.url)}" alt="${escapeHtml(preview.title)}" />` : ''}
            <div class="marketplace-modal-preview-copy">
              <strong>${escapeHtml(preview.title)}</strong>
              ${preview.body ? `<span>${escapeHtml(preview.body)}</span>` : ''}
            </div>
          </div>
        `
        : `
          <div class="marketplace-modal-preview card">
            <strong>${escapeHtml(preview.title)}</strong>
            ${preview.body ? `<span>${escapeHtml(preview.body)}</span>` : ''}
          </div>
        `).join('')}
    </div>
  `;
}

function formatSurfaceLabel(surface: string): string {
  if (surface === 'map') return 'Map overlay';
  if (surface === 'search') return 'Global search';
  if (surface === 'panel') return 'Panel view';
  return surface;
}

function formatSourceTypeLabel(sourceType: string): string {
  if (sourceType === 'catalog') return 'Curated';
  if (sourceType === 'import-file') return 'Private file';
  if (sourceType === 'import-url') return 'Remote feed';
  return sourceType;
}

function formatVisibilityLabel(visibility: string): string {
  if (visibility === 'public') return 'Public';
  if (visibility === 'review') return 'Review queue';
  if (visibility === 'private') return 'Private';
  return visibility;
}

function formatVerificationLabel(level: string | undefined): string {
  if (level === 'verified-source') return 'Verified source';
  if (level === 'partner') return 'Partner';
  if (level === 'community') return 'Community';
  if (level === 'experimental') return 'Experimental';
  return 'Curated';
}

function formatAccessLabel(access: string | undefined): string {
  if (access === 'upgrade-required') return 'Upgrade required';
  if (access === 'add-on') return 'Add-on';
  if (access === 'enterprise') return 'Enterprise';
  return 'Included';
}

function computeDatasetRefreshText(manifest: Pick<MarketplaceManifest, 'datasets'>): string {
  const labels = Array.from(new Set(manifest.datasets.map((dataset) => dataset.pollingIntervalMs
    ? `${Math.round(dataset.pollingIntervalMs / 60000)}m`
    : 'manual')));
  return labels.join(' • ');
}

function renderSurfaceCards(manifest: MarketplaceManifest): string {
  const cards: string[] = [];
  if (manifest.surfaces.map) {
    cards.push(`
      <div class="marketplace-modal-capability-card">
        <strong>Map layer</strong>
        <span>Geospatial overlay with click-through detail</span>
      </div>
    `);
  }
  if (manifest.surfaces.search) {
    cards.push(`
      <div class="marketplace-modal-capability-card">
        <strong>Search index</strong>
        <span>Records indexed in global search</span>
      </div>
    `);
  }
  if (manifest.surfaces.panel) {
    cards.push(`
      <div class="marketplace-modal-capability-card">
        <strong>Panel view</strong>
        <span>${escapeHtml(manifest.surfaces.panel.template.replace('-', ' '))} layout</span>
      </div>
    `);
  }
  return cards.join('');
}

function renderDatasetMarkup(manifest: MarketplaceManifest): string {
  return manifest.datasets.map((dataset) => {
    const fields = Object.keys(dataset.fieldMap ?? {}).slice(0, 8);
    const fieldSummary = fields.length > 0 ? fields.join(', ') : 'Schema inferred at runtime';
    const refresh = dataset.pollingIntervalMs ? `${Math.round(dataset.pollingIntervalMs / 60000)} minute refresh` : 'Manual refresh';
    return `
      <article class="marketplace-modal-dataset-card">
        <div class="marketplace-modal-dataset-head">
          <div>
            <strong>${escapeHtml(dataset.name)}</strong>
            <span>${escapeHtml(dataset.format.toUpperCase())} source</span>
          </div>
          <span class="marketplace-modal-pill">${escapeHtml(refresh)}</span>
        </div>
        <div class="marketplace-modal-dataset-meta">
          <span>${dataset.url ? 'Remote dataset' : 'Embedded dataset'}</span>
          ${dataset.primaryIdField ? `<span>Primary key: ${escapeHtml(dataset.primaryIdField)}</span>` : ''}
          ${dataset.recordPath ? `<span>Path: ${escapeHtml(dataset.recordPath)}</span>` : ''}
        </div>
        <p>${escapeHtml(fieldSummary)}</p>
      </article>
    `;
  }).join('');
}

export class MarketplaceModal {
  private service: MarketplaceService;
  private handlers: MarketplaceModalHandlers = {};
  private overlay: HTMLElement | null = null;
  private activeTab: MarketplaceTab = localStorage.getItem(TAB_KEY) as MarketplaceTab || 'browse';
  private filters: MarketplaceModalFilters = (() => {
    try {
      return JSON.parse(localStorage.getItem(FILTER_KEY) || '') as MarketplaceModalFilters;
    } catch {
      return defaultFilters();
    }
  })();
  private selectedItemId: string | null = null;
  private detailCache = new Map<string, MarketplaceManifest>();
  private pendingDetailItemId: string | null = null;
  private statusMessage = '';
  private statusTone: 'info' | 'error' = 'info';
  private unsubscribe: (() => void) | null = null;

  constructor(service: MarketplaceService) {
    this.service = service;
    this.filters = { ...defaultFilters(), ...this.filters };
  }

  public setHandlers(handlers: MarketplaceModalHandlers): void {
    this.handlers = handlers;
  }

  public preSelectItem(itemId: string): void {
    this.selectedItemId = itemId;
    this.activeTab = 'browse';
    // If the modal is already open, re-render immediately and load the detail
    if (this.overlay && document.body.contains(this.overlay)) {
      void this.loadDetail(itemId);
      this.render();
    }
  }

  public async open(tab?: MarketplaceTab): Promise<void> {
    if (tab) {
      this.activeTab = tab;
      localStorage.setItem(TAB_KEY, this.activeTab);
    }
    // Guard: if overlay was detached from DOM without close() being called (e.g. HMR), reset state
    if (this.overlay && !document.body.contains(this.overlay)) {
      this.overlay = null;
    }
    if (this.overlay) {
      this.render();
      return;
    }
    this.overlay = document.createElement('div');
    this.overlay.className = 'marketplace-modal-overlay';
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target === this.overlay || target.closest('[data-marketplace-close]')) {
        this.close();
        return;
      }

      const tabButton = target.closest<HTMLElement>('[data-marketplace-tab]');
      if (tabButton) {
        this.activeTab = tabButton.dataset.marketplaceTab as MarketplaceTab;
        localStorage.setItem(TAB_KEY, this.activeTab);
        this.render();
        return;
      }

      const cardButton = target.closest<HTMLElement>('[data-marketplace-card]');
      if (cardButton) {
        const itemId = cardButton.dataset.marketplaceCard;
        if (itemId) {
          this.selectedItemId = itemId;
          void this.loadDetail(itemId);
          this.render();
        }
        return;
      }

      const installButton = target.closest<HTMLElement>('[data-marketplace-install]');
      if (installButton) {
        const itemId = installButton.dataset.marketplaceInstall;
        if (itemId) void this.installCatalogItem(itemId);
        return;
      }

      const updateButton = target.closest<HTMLElement>('[data-marketplace-update]');
      if (updateButton) {
        const itemId = updateButton.dataset.marketplaceUpdate;
        if (itemId) void this.updateInstalledItem(itemId);
        return;
      }

      const removeButton = target.closest<HTMLElement>('[data-marketplace-remove]');
      if (removeButton) {
        const itemId = removeButton.dataset.marketplaceRemove;
        if (itemId) void this.removeInstalledItem(itemId);
        return;
      }

      const enableButton = target.closest<HTMLElement>('[data-marketplace-enable]');
      if (enableButton) {
        const itemId = enableButton.dataset.marketplaceEnable;
        if (itemId) {
          const enabled = enableButton.dataset.enabled !== 'true';
          if (this.requireInstallAccess()) {
            this.service.setItemEnabled(itemId, enabled);
            this.render();
          }
        }
        return;
      }

      const mapButton = target.closest<HTMLElement>('[data-marketplace-map-enable]');
      if (mapButton) {
        const itemId = mapButton.dataset.marketplaceMapEnable;
        if (itemId) {
          const enabled = mapButton.dataset.enabled !== 'true';
          if (this.requireInstallAccess()) {
            this.service.setMapLayerEnabled(itemId, enabled);
            this.render();
          }
        }
        return;
      }

      const openPanelButton = target.closest<HTMLElement>('[data-marketplace-open-panel]');
      if (openPanelButton) {
        const itemId = openPanelButton.dataset.marketplaceOpenPanel;
        if (itemId) this.handlers.onOpenPanel?.(itemId);
        return;
      }

      const openAppPanelButton = target.closest<HTMLElement>('[data-marketplace-open-app-panel]');
      if (openAppPanelButton) {
        const panelId = openAppPanelButton.dataset.marketplaceOpenAppPanel;
        if (panelId) this.handlers.onOpenAppPanel?.(panelId);
        return;
      }

      const openSearchButton = target.closest<HTMLElement>('[data-marketplace-open-search]');
      if (openSearchButton) {
        this.handlers.onOpenSearch?.();
        return;
      }

      const importUrlButton = target.closest<HTMLElement>('[data-marketplace-import-url]');
      if (importUrlButton) {
        void this.importFromUrl();
        return;
      }

      const variantLink = target.closest<HTMLAnchorElement>('[data-marketplace-variant]');
      if (variantLink?.dataset.marketplaceVariant) {
        const variant = variantLink.dataset.marketplaceVariant;
        if (variant !== SITE_VARIANT && canSwitchVariantInPlace()) {
          event.preventDefault();
          switchToVariant(variant);
        }
        // Otherwise let the <a href> navigate to the production subdomain as-is.
        return;
      }

      const deckSaveButton = target.closest<HTMLElement>('[data-marketplace-deck-save]');
      if (deckSaveButton) {
        this.saveCurrentDeck();
        return;
      }

      const deckTemplateCard = target.closest<HTMLElement>('[data-marketplace-deck-template]');
      if (deckTemplateCard?.dataset.marketplaceDeckTemplate) {
        this.createDeckFromTemplate(deckTemplateCard.dataset.marketplaceDeckTemplate);
        return;
      }

      const missionPackCard = target.closest<HTMLElement>('[data-marketplace-mission-pack]');
      if (missionPackCard?.dataset.marketplaceMissionPack) {
        this.createDeckFromMissionPack(missionPackCard.dataset.marketplaceMissionPack);
        return;
      }

      const deckApplyButton = target.closest<HTMLElement>('[data-marketplace-deck-apply]');
      if (deckApplyButton?.dataset.marketplaceDeckApply) {
        this.applyDeck(deckApplyButton.dataset.marketplaceDeckApply);
        return;
      }

      const deckRenameButton = target.closest<HTMLElement>('[data-marketplace-deck-rename]');
      if (deckRenameButton?.dataset.marketplaceDeckRename) {
        this.beginDeckRename(deckRenameButton.dataset.marketplaceDeckRename);
        return;
      }

      const deckDeleteButton = target.closest<HTMLElement>('[data-marketplace-deck-delete]');
      if (deckDeleteButton?.dataset.marketplaceDeckDelete) {
        this.deleteDeck(deckDeleteButton.dataset.marketplaceDeckDelete);
        return;
      }

      const submitButton = target.closest<HTMLElement>('[data-marketplace-submit]');
      if (submitButton) {
        void this.submitManifest();
        return;
      }
    });

    this.overlay.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.matches('[data-marketplace-deck-name-input]') && event.key === 'Enter') {
        event.preventDefault();
        this.saveCurrentDeck();
      }
    });

    this.overlay.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | null;
      if (!target) return;
      if (target.matches('[data-marketplace-filter]')) {
        const key = target.dataset.marketplaceFilter as keyof MarketplaceModalFilters;
        this.filters[key] = target.value;
        localStorage.setItem(FILTER_KEY, JSON.stringify(this.filters));
        this.render();
        return;
      }

      if (target.matches('[data-marketplace-import-file]')) {
        const file = target instanceof HTMLInputElement ? target.files?.[0] : undefined;
        if (file) void this.importFromFile(file);
      }
    });

    this.overlay.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target) return;
      if (target.matches('[data-marketplace-filter="search"]')) {
        this.filters.search = target.value;
        localStorage.setItem(FILTER_KEY, JSON.stringify(this.filters));
        this.render();
      }
    });

    this.unsubscribe?.();
    this.unsubscribe = this.service.subscribe(() => {
      if (!this.overlay) {
        this.unsubscribe?.();
        this.unsubscribe = null;
        return;
      }
      this.render();
    });

    await Promise.allSettled([
      this.service.refreshCatalog(),
      this.service.refreshInstalledData(),
    ]);
    if (!this.selectedItemId) {
      this.selectedItemId = this.service.getCatalogItems()[0]?.id ?? this.service.getViewItems(SITE_VARIANT as MarketplaceVariant)[0]?.manifest.id ?? null;
    }
    if (this.selectedItemId) void this.loadDetail(this.selectedItemId);
    this.render();
  }

  public close(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.overlay?.remove();
    this.overlay = null;
  }

  private requireInstallAccess(): boolean {
    return this.handlers.requireInstallAccess ? this.handlers.requireInstallAccess() : true;
  }

  private requireSubmitAccess(): boolean {
    return this.handlers.requireSubmitAccess ? this.handlers.requireSubmitAccess() : true;
  }

  private async installCatalogItem(itemId: string): Promise<void> {
    if (!this.requireInstallAccess()) return;
    try {
      this.setStatus('Installing marketplace item…');
      await this.service.installCatalogItem(itemId);
      this.selectedItemId = itemId;
      await this.loadDetail(itemId);
      this.setStatus('Marketplace item installed.');
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Install failed', 'error');
    } finally {
      this.render();
    }
  }

  private async updateInstalledItem(itemId: string): Promise<void> {
    if (!this.requireInstallAccess()) return;
    try {
      this.setStatus('Updating dataset…');
      await this.service.updateInstalledItem(itemId);
      await this.loadDetail(itemId);
      this.setStatus('Marketplace item updated.');
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Update failed', 'error');
    } finally {
      this.render();
    }
  }

  private async removeInstalledItem(itemId: string): Promise<void> {
    if (!this.requireInstallAccess()) return;
    try {
      await this.service.removeInstalledItem(itemId);
      this.setStatus('Marketplace item removed.');
      if (this.selectedItemId === itemId) {
        this.selectedItemId = this.service.getCatalogItems()[0]?.id ?? null;
      }
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Remove failed', 'error');
    } finally {
      this.render();
    }
  }

  private async importFromFile(file: File): Promise<void> {
    if (!this.requireInstallAccess()) return;
    try {
      const text = await file.text();
      await this.service.importManifestText(text, 'import-file');
      this.setStatus(`Imported ${file.name}.`);
      this.activeTab = 'installed';
      localStorage.setItem(TAB_KEY, this.activeTab);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Import failed', 'error');
    } finally {
      this.render();
    }
  }

  private async importFromUrl(): Promise<void> {
    if (!this.requireInstallAccess()) return;
    const input = this.overlay?.querySelector<HTMLInputElement>('[data-marketplace-import-url-input]');
    const url = input?.value.trim() || '';
    if (!url) {
      this.setStatus('Enter a manifest URL to import.', 'error');
      this.render();
      return;
    }
    try {
      await this.service.importManifestFromUrl(url);
      this.setStatus('Imported manifest from URL.');
      this.activeTab = 'installed';
      localStorage.setItem(TAB_KEY, this.activeTab);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Import failed', 'error');
    } finally {
      this.render();
    }
  }

  private async submitManifest(): Promise<void> {
    if (!this.requireSubmitAccess()) return;
    const textarea = this.overlay?.querySelector<HTMLTextAreaElement>('[data-marketplace-submit-json]');
    const noteInput = this.overlay?.querySelector<HTMLInputElement>('[data-marketplace-submit-note]');
    const text = textarea?.value.trim() || '';
    if (!text) {
      this.setStatus('Paste a manifest JSON package before submitting.', 'error');
      this.render();
      return;
    }
    try {
      await this.service.submitManifestText(text, noteInput?.value.trim() || undefined);
      this.setStatus('Submission queued for review.');
      if (textarea) textarea.value = '';
      if (noteInput) noteInput.value = '';
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : 'Submission failed', 'error');
    } finally {
      this.render();
    }
  }

  private saveCurrentDeck(): void {
    const input = this.overlay?.querySelector<HTMLInputElement>('[data-marketplace-deck-name-input]');
    const name = input?.value.trim() || '';
    if (!name) {
      this.setStatus('Give the layout a name first.', 'error');
      input?.focus();
      return;
    }
    const saved = saveWorkspace(name);
    if (input) input.value = '';
    refreshWorkspaceTabsInHeader();
    this.setStatus(`Saved “${saved.name}”.`);
    this.render();
  }

  private createDeckFromTemplate(templateId: string): void {
    const template = DECK_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const url = createWorkspaceFromTemplate(template);
    if (!url) {
      this.setStatus('Could not create that deck — try again.', 'error');
      this.render();
      return;
    }
    this.setStatus(`Creating “${template.name}”…`);
    window.location.assign(url);
  }

  private createDeckFromMissionPack(packId: string): void {
    const pack = MISSION_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    const url = createWorkspaceFromMissionPack(pack);
    if (!url) {
      this.setStatus('Could not create that deck — try again.', 'error');
      this.render();
      return;
    }
    this.setStatus(`Creating “${pack.name}”…`);
    window.location.assign(url);
  }

  private applyDeck(id: string): void {
    const url = applyWorkspace(id);
    if (!url) {
      this.setStatus('That deck was saved on a different variant and can’t be applied here.', 'error');
      this.render();
      return;
    }
    // Panel order and sizes are read when panels are built, so reload for an
    // exact restore rather than leaving a half-applied layout on screen.
    this.setStatus('Applying…');
    window.location.assign(url);
  }

  private deleteDeck(id: string): void {
    const deck = listWorkspaces().find((w) => w.id === id);
    if (!deck || !confirm(`Delete deck "${deck.name}"?`)) return;
    deleteWorkspace(id);
    refreshWorkspaceTabsInHeader();
    this.setStatus('Deck deleted.');
    this.render();
  }

  private beginDeckRename(id: string): void {
    const row = this.overlay?.querySelector<HTMLElement>(`[data-marketplace-deck-row="${CSS.escape(id)}"]`);
    const nameEl = row?.querySelector<HTMLElement>('[data-marketplace-deck-name]');
    if (!row || !nameEl) return;
    const input = document.createElement('input');
    input.className = 'marketplace-modal-deck-rename-input';
    input.value = nameEl.textContent ?? '';
    input.maxLength = 60;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (commit: boolean) => {
      if (commit && input.value.trim()) {
        renameWorkspace(id, input.value);
        refreshWorkspaceTabsInHeader();
      }
      this.render();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
  }

  /**
   * The 6 built-in variants aren't decks — separate app builds, not something
   * you save — but they used to only live in the header switcher, disconnected
   * from this "browse everything" catalog. Surfacing them here too keeps the
   * catalog matching what the header shows, instead of covering half of it.
   */
  private renderVariantSwitchRow(): string {
    const local = canSwitchVariantInPlace();
    return `
      <div class="marketplace-modal-variant-row-wrap">
        <div class="marketplace-modal-section-head"><strong>Switch app</strong></div>
        <div class="marketplace-modal-variant-row">
          ${SITE_VARIANTS.map((v) => `
            <a href="${local || SITE_VARIANT === v.id ? '#' : v.prodUrl}"
               class="marketplace-modal-variant-link${SITE_VARIANT === v.id ? ' active' : ''}"
               data-marketplace-variant="${v.id}"
               title="${escapeHtml(v.id === SITE_VARIANT ? 'Current app' : `Switch to ${v.id}`)}">
              <span>${v.icon}</span>
            </a>`).join('')}
        </div>
      </div>
    `;
  }

  private renderDeckRow(w: Workspace): string {
    const foreign = w.variant !== SITE_VARIANT;
    return `
      <div class="marketplace-modal-deck-row${foreign ? ' foreign' : ''}" data-marketplace-deck-row="${escapeHtml(w.id)}">
        <div class="marketplace-modal-deck-row-main">
          <span class="marketplace-modal-deck-icon">\u{1F5C2}\u{FE0F}</span>
          <div>
            <span class="marketplace-modal-deck-name" data-marketplace-deck-name>${escapeHtml(w.name)}</span>
            <span class="marketplace-modal-deck-meta">${w.panelCount} panel${w.panelCount === 1 ? '' : 's'} · ${escapeHtml(formatWhen(w.updatedAt))}${foreign ? ` · saved on ${escapeHtml(w.variant)}` : ''}</span>
          </div>
        </div>
        ${foreign ? '' : `
          <div class="marketplace-modal-deck-row-actions">
            <button class="marketplace-modal-secondary" type="button" data-marketplace-deck-apply="${escapeHtml(w.id)}">Apply</button>
            <button class="marketplace-modal-deck-icon-btn" type="button" data-marketplace-deck-rename="${escapeHtml(w.id)}" aria-label="Rename deck" title="Rename">✏️</button>
            <button class="marketplace-modal-deck-icon-btn" type="button" data-marketplace-deck-delete="${escapeHtml(w.id)}" aria-label="Delete deck" title="Delete">×</button>
          </div>
        `}
      </div>
    `;
  }

  private renderDecks(): string {
    const decks = listWorkspaces();
    const templates = DECK_TEMPLATES.filter((t) => t.compatibleVariants.includes(SITE_VARIANT as MarketplaceVariant));
    const packs = MISSION_PACKS.filter((p) => p.compatibleVariants.includes(SITE_VARIANT as MarketplaceVariant));

    return `
      ${this.renderVariantSwitchRow()}

      <section class="marketplace-modal-section">
        <div class="marketplace-modal-section-head">
          <strong>Save current layout</strong>
          <span>Snapshots which panels are shown, their order, sizes, and the map view</span>
        </div>
        <div class="marketplace-modal-inline-form">
          <input type="text" maxlength="60" placeholder="Name this layout…" data-marketplace-deck-name-input aria-label="Deck name" />
          <button class="marketplace-modal-primary" type="button" data-marketplace-deck-save="true">Save current</button>
        </div>
      </section>

      <section class="marketplace-modal-section">
        <div class="marketplace-modal-section-head">
          <strong>My decks</strong>
          <span>${decks.length} saved</span>
        </div>
        ${decks.length === 0
          ? '<div class="marketplace-modal-empty-inline">No saved decks yet — save the current layout above, or start from a template below.</div>'
          : `<div class="marketplace-modal-deck-list">${decks.map((w) => this.renderDeckRow(w)).join('')}</div>`
        }
      </section>

      <section class="marketplace-modal-pack-shelf">
        <div class="marketplace-modal-section-head">
          <strong>Start from a template</strong>
          <span>Replace the current layout with a themed preset and save it as a new deck</span>
        </div>
        ${templates.length === 0 && packs.length === 0
          ? '<div class="marketplace-modal-empty-inline">No starter templates for this build yet.</div>'
          : `<div class="marketplace-modal-pack-grid">
              ${templates.map((t) => `
                <article class="marketplace-modal-pack-card marketplace-modal-deck-template-card" data-marketplace-deck-template="${escapeHtml(t.id)}" role="button" tabindex="0">
                  <div class="marketplace-modal-pack-kicker">${escapeHtml(t.icon)} ${escapeHtml(t.recommendedPanels.length.toString())} panels</div>
                  <strong>${escapeHtml(t.name)}</strong>
                  <p>${escapeHtml(t.tagline)}</p>
                  <div class="marketplace-modal-card-meta">
                    <span style="display:inline-flex;align-items:center;gap:4px">${authorAvatar(t.author, 'sm')}<span>${escapeHtml(t.author)}</span></span>
                    <span class="marketplace-modal-pill">${escapeHtml(t.commercial.priceLabel || formatAccessLabel(t.commercial.access))}</span>
                  </div>
                </article>
              `).join('')}
              ${packs.map((p) => `
                <article class="marketplace-modal-pack-card marketplace-modal-deck-template-card" data-marketplace-mission-pack="${escapeHtml(p.id)}" role="button" tabindex="0">
                  <div class="marketplace-modal-pack-kicker">${escapeHtml(p.domain.replace('-', ' '))} · ${escapeHtml(p.recommendedPanels.length.toString())} panels</div>
                  <strong>${escapeHtml(p.name)}</strong>
                  <p>${escapeHtml(p.tagline)}</p>
                  <div class="marketplace-modal-chip-row">
                    ${p.recommendedLayers.length > 0 ? `<span class="marketplace-modal-chip">${p.recommendedLayers.length} layers</span>` : ''}
                    ${p.recommendedSources.length > 0 ? `<span class="marketplace-modal-chip">${p.recommendedSources.length} sources</span>` : ''}
                    ${p.monitorTemplates.length > 0 ? `<span class="marketplace-modal-chip">${p.monitorTemplates.length} monitors</span>` : ''}
                    ${p.alertRuleTemplates.length > 0 ? `<span class="marketplace-modal-chip">${p.alertRuleTemplates.length} alert rules</span>` : ''}
                  </div>
                </article>
              `).join('')}
            </div>`
        }
      </section>
    `;
  }

  private async loadDetail(itemId: string): Promise<void> {
    const installed = this.service.getInstalledItem(itemId)?.manifest;
    if (installed) {
      this.detailCache.set(itemId, installed);
      return;
    }
    if (this.detailCache.has(itemId) || this.pendingDetailItemId === itemId) return;
    this.pendingDetailItemId = itemId;
    try {
      const manifest = await this.service.fetchItemDetail(itemId);
      this.detailCache.set(itemId, manifest);
    } catch (error) {
      console.warn('[marketplace] Failed to load item detail', itemId, error);
    } finally {
      if (this.pendingDetailItemId === itemId) this.pendingDetailItemId = null;
      this.render();
    }
  }

  private setStatus(message: string, tone: 'info' | 'error' = 'info'): void {
    this.statusMessage = message;
    this.statusTone = tone;
  }

  private filteredCatalogItems(installedItems: MarketplaceViewItem[]): MarketplaceCatalogItem[] {
    const installedIds = new Set(installedItems.map((item) => item.manifest.id));
    const installedWithUpdates = new Set(installedItems.filter((item) => item.hasUpdate).map((item) => item.manifest.id));
    const query = this.filters.search.trim().toLowerCase();
    return this.service.getCatalogItems().filter((item) => {
      if (this.filters.category !== 'all' && item.category !== this.filters.category) return false;
      if (this.filters.surface !== 'all' && !item.surfaces.includes(this.filters.surface as any)) return false;
      if (this.filters.variant !== 'all' && !item.compatibility.variants.includes(this.filters.variant as MarketplaceVariant)) return false;
      if (this.filters.installState === 'installed' && !installedIds.has(item.id)) return false;
      if (this.filters.installState === 'updates' && !installedWithUpdates.has(item.id)) return false;
      if (!query) return true;
      const haystack = [item.name, item.description, item.author, item.category, ...item.tags].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  private renderBrowse(installedItems: MarketplaceViewItem[]): string {
    const items = this.filteredCatalogItems(installedItems);
    const categories = [...new Set(this.service.getCatalogItems().map((item) => item.category))].sort();
    const currentDetail = this.selectedItemId ? this.detailCache.get(this.selectedItemId) ?? null : null;
    const selectedCatalog = items.find((item) => item.id === this.selectedItemId) ?? items[0] ?? null;
    const selectedInstalled = installedItems.find((item) => item.manifest.id === selectedCatalog?.id);
    const detailManifest = currentDetail && selectedCatalog?.id === this.selectedItemId ? currentDetail : null;
    const detailVariants = detailManifest?.compatibility.variants || selectedCatalog?.compatibility.variants || [];
    const compatiblePacks = MISSION_PACKS.filter((pack) =>
      pack.compatibleVariants.includes(SITE_VARIANT as MarketplaceVariant)
      && pack.datasetIds.some((datasetId) => datasetId === selectedCatalog?.id));
    const currentTrust = detailManifest?.trust || selectedCatalog?.trust;
    const currentCommercial = detailManifest?.commercial || selectedCatalog?.commercial;

    return `
      <div class="marketplace-modal-filters">
        <input type="search" data-marketplace-filter="search" placeholder="Search datasets, tags, and authors" value="${escapeHtml(this.filters.search)}" />
        <select data-marketplace-filter="category">
          <option value="all"${this.filters.category === 'all' ? ' selected' : ''}>All categories</option>
          ${categories.map((category) => `<option value="${escapeHtml(category)}"${this.filters.category === category ? ' selected' : ''}>${escapeHtml(category)}</option>`).join('')}
        </select>
        <select data-marketplace-filter="surface">
          <option value="all"${this.filters.surface === 'all' ? ' selected' : ''}>All surfaces</option>
          <option value="map"${this.filters.surface === 'map' ? ' selected' : ''}>Map</option>
          <option value="search"${this.filters.surface === 'search' ? ' selected' : ''}>Search</option>
          <option value="panel"${this.filters.surface === 'panel' ? ' selected' : ''}>Panel</option>
        </select>
        <select data-marketplace-filter="variant">
          <option value="all"${this.filters.variant === 'all' ? ' selected' : ''}>All variants</option>
          ${['full', 'tech', 'finance', 'conflicts', 'commodity', 'happy']
            .map((variant) => `<option value="${variant}"${this.filters.variant === variant ? ' selected' : ''}>${variant}</option>`)
            .join('')}
        </select>
        <select data-marketplace-filter="installState">
          <option value="all"${this.filters.installState === 'all' ? ' selected' : ''}>All items</option>
          <option value="installed"${this.filters.installState === 'installed' ? ' selected' : ''}>Installed</option>
          <option value="updates"${this.filters.installState === 'updates' ? ' selected' : ''}>Updates</option>
        </select>
      </div>

      <div class="marketplace-modal-browse">
        <div class="marketplace-modal-card-list">
          ${items.map((item) => {
            const installed = installedItems.find((entry) => entry.manifest.id === item.id);
            const compatible = item.compatibility.variants.includes(SITE_VARIANT as MarketplaceVariant);
            const detail = item.id === this.selectedItemId ? detailManifest : null;
            const datasetCount = detail?.datasets.length ?? 0;
            const refreshText = detail ? computeDatasetRefreshText(detail) : 'Detail available on open';
            return `
              <button class="marketplace-modal-card${item.id === selectedCatalog?.id ? ' active' : ''}" type="button" data-marketplace-card="${escapeHtml(item.id)}">
                <div class="marketplace-modal-card-kicker-row">
                  <span class="marketplace-modal-kicker" data-category="${escapeHtml(item.category)}">${escapeHtml(item.category)}</span>
                  <span class="marketplace-modal-card-state ${installed ? (installed.hasUpdate ? 'update' : 'installed') : 'catalog'}">${installed ? (installed.hasUpdate ? 'Update ready' : 'Installed') : 'Catalog'}</span>
                </div>
                <div class="marketplace-modal-card-head">
                  <strong>${escapeHtml(item.name)}</strong>
                  ${!compatible ? '<span class="marketplace-modal-pill warn">Variant locked</span>' : ''}
                </div>
                <p>${escapeHtml(item.description)}</p>
                <div class="marketplace-modal-card-meta">
                  <span style="display:inline-flex;align-items:center;gap:4px">${authorAvatar(item.author, 'sm')}<span>${escapeHtml(item.author)}</span></span>
                  <span>${datasetCount > 0 ? `${datasetCount} source${datasetCount === 1 ? '' : 's'}` : 'Manifest'}</span>
                  <span>${escapeHtml(refreshText)}</span>
                  ${compatible ? '' : '<span class="warn">Unavailable in this variant</span>'}
                </div>
                <div class="marketplace-modal-chip-row">${item.surfaces.map((surface) => `<span class="marketplace-modal-chip" data-surface="${escapeHtml(surface)}">${escapeHtml(formatSurfaceLabel(surface))}</span>`).join('')}</div>
                <div class="marketplace-modal-card-footer">${escapeHtml(item.tags.slice(0, 3).join(' • ') || item.slug)}</div>
              </button>
            `;
          }).join('') || '<div class="marketplace-modal-empty">No marketplace items match these filters.</div>'}
        </div>

        <div class="marketplace-modal-detail">
          ${selectedCatalog ? `
            <div class="marketplace-modal-detail-shell">
              <div class="marketplace-modal-detail-head">
                <div class="marketplace-modal-detail-banner">
                  <div class="marketplace-modal-detail-banner-copy">
                    <span class="marketplace-modal-kicker" data-category="${escapeHtml(selectedCatalog.category)}">${escapeHtml(selectedCatalog.category)}</span>
                    <h3>${escapeHtml(detailManifest?.name || selectedCatalog.name)}</h3>
                    <p>${escapeHtml(detailManifest?.description || selectedCatalog.description)}</p>
                    ${detailManifest ? `<div style="margin-top:8px"><span class="marketplace-update-badge">⟳ ${escapeHtml(formatUpdateEvery(detailManifest.datasets))}</span></div>` : ''}
                  </div>
                  <div class="marketplace-modal-detail-badges">
                    <span class="marketplace-modal-pill">${escapeHtml(formatSourceTypeLabel(detailManifest?.sourceType || 'catalog'))}</span>
                    <span class="marketplace-modal-pill">${escapeHtml(formatVisibilityLabel(detailManifest?.visibility || 'public'))}</span>
                    <span class="marketplace-modal-pill">${escapeHtml(formatVerificationLabel(currentTrust?.verificationLevel))}</span>
                    <span class="marketplace-modal-pill">${escapeHtml(formatAccessLabel(currentCommercial?.access))}</span>
                  </div>
                </div>
                <div class="marketplace-modal-chip-row">
                  ${(detailManifest?.tags || selectedCatalog.tags).map((tag) => `<span class="marketplace-modal-chip">${escapeHtml(tag)}</span>`).join('')}
                </div>
                <div class="marketplace-modal-chip-row" style="margin-top:6px">
                  ${selectedCatalog.surfaces.map((surface) => `<span class="marketplace-modal-chip" data-surface="${escapeHtml(surface)}">${escapeHtml(formatSurfaceLabel(surface))}</span>`).join('')}
                </div>
              </div>

              <div class="marketplace-modal-stats">
                <div><span>Author</span>${authorWithAvatar(detailManifest?.author || selectedCatalog.author)}</div>
                <div><span>Version</span><strong>${escapeHtml(detailManifest?.version || selectedCatalog.version)}</strong></div>
                <div><span>Variants</span><strong>${escapeHtml(detailVariants.join(', '))}</strong></div>
                <div><span>Refresh</span><strong>${detailManifest ? escapeHtml(computeDatasetRefreshText(detailManifest)) : 'Loading…'}</strong></div>
                <div><span>Data sources</span><strong>${detailManifest ? String(detailManifest.datasets.length) : '…'}</strong></div>
                <div><span>Surfaces</span><strong>${detailManifest ? String(Object.values(detailManifest.surfaces).filter(Boolean).length) : String(selectedCatalog.surfaces.length)}</strong></div>
              </div>

              <section class="marketplace-modal-section">
                <div class="marketplace-modal-section-head">
                  <strong>Why use it</strong>
                </div>
                <div class="marketplace-modal-value-card">
                  <p>${escapeHtml(detailManifest?.valueProposition || selectedCatalog.valueProposition || detailManifest?.description || selectedCatalog.description)}</p>
                  <div class="marketplace-modal-trust-grid">
                    <div><span>Verification</span><strong>${escapeHtml(formatVerificationLabel(currentTrust?.verificationLevel))}</strong></div>
                    <div><span>Maintainer</span><strong>${escapeHtml(currentTrust?.maintainer || detailManifest?.author || selectedCatalog.author)}</strong></div>
                    <div><span>Coverage</span><strong>${escapeHtml(currentTrust?.coverage || 'Global / package-defined')}</strong></div>
                    <div><span>Access</span><strong>${escapeHtml(currentCommercial?.priceLabel || formatAccessLabel(currentCommercial?.access))}</strong></div>
                  </div>
                  ${currentTrust?.methodology ? `<p class="marketplace-modal-muted">${escapeHtml(currentTrust.methodology)}</p>` : ''}
                </div>
              </section>

              ${compatiblePacks.length > 0 ? `
                <section class="marketplace-modal-section">
                  <div class="marketplace-modal-section-head">
                    <strong>Used in mission packs</strong>
                  </div>
                  <div class="marketplace-modal-chip-row">
                    ${compatiblePacks.map((pack) => `<span class="marketplace-modal-chip">${escapeHtml(pack.name)}</span>`).join('')}
                  </div>
                </section>
              ` : ''}

              ${detailManifest ? `
                <section class="marketplace-modal-section">
                  <div class="marketplace-modal-section-head">
                    <strong>Surfaces</strong>
                  </div>
                  <div class="marketplace-modal-capability-grid">
                    ${renderSurfaceCards(detailManifest)}
                  </div>
                </section>

                <section class="marketplace-modal-section">
                  <div class="marketplace-modal-section-head">
                    <strong>Data sources</strong>
                  </div>
                  <div class="marketplace-modal-dataset-grid">
                    ${renderDatasetMarkup(detailManifest)}
                  </div>
                </section>

                <div class="marketplace-modal-schema">${escapeHtml(computeSchemaSummary(detailManifest))}</div>
                ${previewMarkup(detailManifest.assets?.previews)}
              ` : '<div class="marketplace-modal-schema">Loading detail…</div>'}

              <div class="marketplace-modal-actions">
                ${selectedInstalled
                  ? renderInstalledItemActions(selectedInstalled, DEFAULT_PANELS)
                  : `
                    <button class="marketplace-modal-primary" type="button" data-marketplace-install="${escapeHtml(selectedCatalog.id)}"${selectedCatalog.compatibility.variants.includes(SITE_VARIANT as MarketplaceVariant) ? '' : ' disabled'}>Install</button>
                  `
                }
              </div>
            </div>
          ` : '<div class="marketplace-modal-empty">Select a marketplace item to inspect its detail.</div>'}
        </div>
      </div>
    `;
  }

  private renderInstalled(installedItems: MarketplaceViewItem[]): string {
    return renderGroupedInstalledItems(installedItems, DEFAULT_PANELS);
  }

  private renderImport(): string {
    return `
      <div class="marketplace-modal-forms">
        <section class="marketplace-modal-form-card">
          <div class="marketplace-modal-form-head">
            <strong>Import local file</strong>
            <span>Install from a JSON manifest bundle</span>
          </div>
          <label class="marketplace-modal-upload">
            <span>Select manifest file</span>
            <input type="file" accept="application/json,.json" data-marketplace-import-file />
          </label>
        </section>

        <section class="marketplace-modal-form-card">
          <div class="marketplace-modal-form-head">
            <strong>Import from URL</strong>
            <span>Install from a remote manifest</span>
          </div>
          <div class="marketplace-modal-inline-form">
            <input type="url" placeholder="https://example.com/manifest.json" data-marketplace-import-url-input />
            <button class="marketplace-modal-primary" type="button" data-marketplace-import-url="true">Install</button>
          </div>
        </section>
      </div>
    `;
  }

  private renderSubmit(): string {
    const submissions = this.service.getSubmissions();
    return `
      <div class="marketplace-modal-forms submit">
        <section class="marketplace-modal-form-card">
          <div class="marketplace-modal-form-head">
            <strong>Submit to review</strong>
            <span>Drafts are stored locally until hosted publishing is enabled</span>
          </div>
          <input type="text" placeholder="Optional note for reviewers" data-marketplace-submit-note />
          <textarea rows="14" placeholder="Paste marketplace manifest JSON here" data-marketplace-submit-json></textarea>
          <button class="marketplace-modal-primary" type="button" data-marketplace-submit="true">Submit package</button>
        </section>

        <section class="marketplace-modal-form-card submissions">
          <div class="marketplace-modal-form-head">
            <strong>Submissions</strong>
            <span>Queue status</span>
          </div>
          <div class="marketplace-modal-submissions">
            ${submissions.map((submission) => `
              <div class="marketplace-modal-submission">
                <strong>${escapeHtml(submission.name)}</strong>
                <span>${new Date(submission.submittedAt).toLocaleString()}</span>
                <span class="marketplace-modal-pill">${escapeHtml(submission.status)}</span>
              </div>
            `).join('') || '<div class="marketplace-modal-empty-inline">No submissions yet.</div>'}
          </div>
        </section>
      </div>
    `;
  }

  private render(): void {
    if (!this.overlay) return;
    const installedItems = this.service.getViewItems(SITE_VARIANT as MarketplaceVariant);
    const tabContent = this.activeTab === 'decks'
      ? this.renderDecks()
      : this.activeTab === 'browse'
        ? this.renderBrowse(installedItems)
        : this.activeTab === 'installed'
          ? this.renderInstalled(installedItems)
          : this.activeTab === 'import'
            ? this.renderImport()
            : this.renderSubmit();

    this.overlay.innerHTML = `
      <div class="marketplace-modal">
        <div class="marketplace-modal-header">
          <div class="marketplace-modal-heading">
            <h2>Intelligence Catalog</h2>
            <span class="marketplace-modal-kicker">decks + datasets + mission packs</span>
            <span class="marketplace-modal-beta">BETA</span>
          </div>
          <button class="marketplace-modal-close" type="button" data-marketplace-close="true">×</button>
        </div>

        <div class="marketplace-modal-tabs">
          ${(['decks', 'browse', 'installed', 'import', 'submit'] as MarketplaceTab[]).map((tab) => `
            <button class="marketplace-modal-tab${this.activeTab === tab ? ' active' : ''}" type="button" data-marketplace-tab="${tab}">
              ${tab}
            </button>
          `).join('')}
        </div>

        ${this.statusMessage ? `<div class="marketplace-modal-status ${this.statusTone}">${escapeHtml(this.statusMessage)}</div>` : ''}

        <div class="marketplace-modal-body">
          ${tabContent}
        </div>
      </div>
    `;
  }
}

function formatWhen(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
