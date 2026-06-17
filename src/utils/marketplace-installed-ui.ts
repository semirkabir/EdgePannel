import { escapeHtml } from '@/utils/sanitize';
import { DATA_SOURCE_METADATA, type DataSourceId } from '@/services/data-freshness';
import type { MarketplaceManifest, MarketplaceViewItem } from '@/types/marketplace';
import type { PanelConfig } from '@/types';

export type InstalledSurfaceGroup =
  | 'map-layers'
  | 'workspace-panels'
  | 'news-feeds'
  | 'data-services'
  | 'search-tools';

export const INSTALLED_GROUP_ORDER: InstalledSurfaceGroup[] = [
  'map-layers',
  'workspace-panels',
  'news-feeds',
  'data-services',
  'search-tools',
];

export const INSTALLED_GROUP_META: Record<InstalledSurfaceGroup, { title: string; hint: string }> = {
  'map-layers': {
    title: 'Map layers',
    hint: 'Geospatial overlays you can show or hide on the map',
  },
  'workspace-panels': {
    title: 'Panel datasets',
    hint: 'Imported datasets with a dedicated marketplace panel view',
  },
  'news-feeds': {
    title: 'News feeds',
    hint: 'Headline sources powering live news panels — no separate panel per feed',
  },
  'data-services': {
    title: 'Data enrichments',
    hint: 'API and runtime sources that enrich existing panels and map layers',
  },
  'search-tools': {
    title: 'Search tools',
    hint: 'Sources indexed in global search',
  },
};

export function getLinkedAppPanelId(manifest: MarketplaceManifest): string | null {
  const builtIn = manifest.builtIn;
  if (builtIn?.dataSourceId) {
    const meta = DATA_SOURCE_METADATA[builtIn.dataSourceId as DataSourceId];
    if (meta?.panelId) return meta.panelId;
  }

  const inline = manifest.datasets[0]?.inlineData;
  if (Array.isArray(inline) && inline[0] && typeof inline[0] === 'object') {
    const record = inline[0] as Record<string, unknown>;
    const panelId = String(record.panelId ?? '').trim();
    if (panelId) return panelId;
  }

  return null;
}

export function isWorkspacePanelId(panelId: string, panels: Record<string, PanelConfig>): boolean {
  return panelId !== 'map' && panelId !== 'search' && panelId in panels;
}

export function getInstalledSurfaceGroup(item: MarketplaceViewItem): InstalledSurfaceGroup {
  const { manifest } = item;
  const builtIn = manifest.builtIn;

  if (builtIn?.kind === 'feed') return 'news-feeds';

  const linkedPanelId = getLinkedAppPanelId(manifest);
  if (linkedPanelId === 'search') return 'search-tools';

  if (manifest.surfaces.map && !builtIn) return 'map-layers';

  if (builtIn?.kind === 'service' || builtIn?.kind === 'runtime') {
    return 'data-services';
  }

  if (manifest.surfaces.panel && !builtIn) return 'workspace-panels';
  if (manifest.surfaces.map) return 'map-layers';
  if (manifest.surfaces.search) return 'search-tools';

  return 'data-services';
}

export function groupInstalledItems(
  items: MarketplaceViewItem[],
): Array<{ group: InstalledSurfaceGroup; items: MarketplaceViewItem[] }> {
  const buckets = new Map<InstalledSurfaceGroup, MarketplaceViewItem[]>();
  for (const group of INSTALLED_GROUP_ORDER) {
    buckets.set(group, []);
  }

  for (const item of items) {
    const group = getInstalledSurfaceGroup(item);
    buckets.get(group)?.push(item);
  }

  return INSTALLED_GROUP_ORDER
    .map((group) => ({
      group,
      items: (buckets.get(group) ?? []).sort((a, b) => a.manifest.name.localeCompare(b.manifest.name)),
    }))
    .filter((entry) => entry.items.length > 0);
}

function getEnableLabel(group: InstalledSurfaceGroup, enabled: boolean): string {
  if (enabled) {
    switch (group) {
      case 'news-feeds': return 'Disable feed';
      case 'map-layers': return 'Disable layer';
      case 'workspace-panels': return 'Disable dataset';
      default: return 'Disable source';
    }
  }
  switch (group) {
    case 'news-feeds': return 'Enable feed';
    case 'map-layers': return 'Enable layer';
    case 'workspace-panels': return 'Enable dataset';
    default: return 'Enable source';
  }
}

export function getItemSurfaceChips(item: MarketplaceViewItem): string[] {
  const chips: string[] = [];
  const builtIn = item.manifest.builtIn;

  if (builtIn?.kind === 'feed') chips.push('Feed');
  if (builtIn?.kind === 'service') chips.push('API');
  if (builtIn?.kind === 'runtime') chips.push('Runtime');
  if (item.manifest.surfaces.map) chips.push('Map');
  if (item.manifest.surfaces.search) chips.push('Search');
  if (item.manifest.surfaces.panel && !builtIn) chips.push('Panel');

  return chips;
}

export function renderInstalledItemActions(
  item: MarketplaceViewItem,
  panels: Record<string, PanelConfig>,
): string {
  const itemId = item.manifest.id;
  const group = getInstalledSurfaceGroup(item);
  const linkedPanelId = getLinkedAppPanelId(item.manifest);
  const actions: string[] = [];

  if (group === 'map-layers' && item.manifest.surfaces.map) {
    actions.push(
      `<button class="marketplace-modal-primary" type="button" data-marketplace-map-enable="${escapeHtml(itemId)}" data-enabled="${item.mapEnabled ? 'true' : 'false'}">${item.mapEnabled ? 'Hide on map' : 'Show on map'}</button>`,
    );
    if (item.manifest.surfaces.panel) {
      actions.push(
        `<button class="marketplace-modal-secondary" type="button" data-marketplace-open-panel="${escapeHtml(itemId)}">View dataset</button>`,
      );
    }
  } else if (group === 'workspace-panels') {
    actions.push(
      `<button class="marketplace-modal-primary" type="button" data-marketplace-open-panel="${escapeHtml(itemId)}">View dataset</button>`,
    );
    if (item.manifest.surfaces.map) {
      actions.push(
        `<button class="marketplace-modal-secondary" type="button" data-marketplace-map-enable="${escapeHtml(itemId)}" data-enabled="${item.mapEnabled ? 'true' : 'false'}">${item.mapEnabled ? 'Hide on map' : 'Show on map'}</button>`,
      );
    }
  } else if (group === 'search-tools') {
    actions.push(
      `<button class="marketplace-modal-primary" type="button" data-marketplace-open-search="true">Open search</button>`,
    );
  } else if (group === 'data-services' && linkedPanelId && isWorkspacePanelId(linkedPanelId, panels)) {
    const panelName = panels[linkedPanelId]?.name ?? linkedPanelId;
    actions.push(
      `<button class="marketplace-modal-primary" type="button" data-marketplace-open-app-panel="${escapeHtml(linkedPanelId)}">Open ${escapeHtml(panelName)}</button>`,
    );
  }

  actions.push(
    `<button class="marketplace-modal-secondary" type="button" data-marketplace-enable="${escapeHtml(itemId)}" data-enabled="${item.enabled ? 'true' : 'false'}">${getEnableLabel(group, item.enabled)}</button>`,
  );

  if (item.hasUpdate) {
    actions.push(
      `<button class="marketplace-modal-secondary" type="button" data-marketplace-update="${escapeHtml(itemId)}">Update</button>`,
    );
  }

  actions.push(
    `<button class="marketplace-modal-danger" type="button" data-marketplace-remove="${escapeHtml(itemId)}">Remove</button>`,
  );

  return actions.join('');
}

export function renderInstalledItemCard(
  item: MarketplaceViewItem,
  panels: Record<string, PanelConfig>,
): string {
  const chips = getItemSurfaceChips(item);
  const linkedPanelId = getLinkedAppPanelId(item.manifest);
  const linkedPanelName = linkedPanelId && isWorkspacePanelId(linkedPanelId, panels)
    ? panels[linkedPanelId]?.name
    : null;

  return `
    <div class="marketplace-modal-installed-card">
      <div class="marketplace-modal-installed-copy">
        <div class="marketplace-modal-installed-head">
          <strong>${escapeHtml(item.manifest.name)}</strong>
          <span class="marketplace-modal-pill">${item.hasUpdate ? 'Update available' : item.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <p>${escapeHtml(item.manifest.description)}</p>
        ${chips.length > 0 ? `
          <div class="marketplace-modal-installed-surface-chips">
            ${chips.map((chip) => `<span class="marketplace-modal-chip">${escapeHtml(chip)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="marketplace-modal-installed-meta">
          <span>${escapeHtml(item.manifest.category)}</span>
          <span>${escapeHtml(item.manifest.version)}</span>
          ${linkedPanelName ? `<span>Uses ${escapeHtml(linkedPanelName)}</span>` : ''}
          <span>${item.variantCompatible ? 'Active in this variant' : 'Unavailable in this variant'}</span>
        </div>
      </div>
      <div class="marketplace-modal-installed-actions">
        ${renderInstalledItemActions(item, panels)}
      </div>
    </div>
  `;
}

export function renderGroupedInstalledItems(
  items: MarketplaceViewItem[],
  panels: Record<string, PanelConfig>,
): string {
  const groups = groupInstalledItems(items);
  if (groups.length === 0) {
    return '<div class="marketplace-modal-empty">No installed marketplace items yet.</div>';
  }

  return `
    <div class="marketplace-modal-installed">
      ${groups.map(({ group, items: groupItems }) => {
        const meta = INSTALLED_GROUP_META[group];
        return `
          <section class="marketplace-modal-installed-group">
            <div class="marketplace-modal-installed-group-head">
              <div>
                <strong>${escapeHtml(meta.title)}</strong>
                <span>${escapeHtml(meta.hint)}</span>
              </div>
              <span class="marketplace-modal-pill">${groupItems.length}</span>
            </div>
            <div class="marketplace-modal-installed-group-list">
              ${groupItems.map((item) => renderInstalledItemCard(item, panels)).join('')}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}