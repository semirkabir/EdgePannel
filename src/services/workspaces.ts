/**
 * Workspaces — multiple named layout snapshots ("decks").
 *
 * The app already persists everything that defines a workspace (which panels
 * are enabled, their order, row/column spans, collapse state, map layers and
 * view) as discrete localStorage keys, and `layout-snapshot.ts` can capture a
 * set of those keys — but only one snapshot at a time. This service stores an
 * array of *named* snapshots so a user can keep several workspaces and switch
 * between them, the way a "War & Conflict" deck differs from "Markets".
 *
 * Capture is a value-copy of the relevant keys; applying writes them back
 * verbatim. Because panel order and spans are read when panels are constructed,
 * an exact restore requires a reload — {@link applyWorkspace} stages the keys
 * and leaves reloading to the caller.
 */
import { STORAGE_KEYS, SITE_VARIANT, getVariantStorageKey } from '@/config';
import { buildPanelLayoutSnapshot } from '@/app/layout-snapshot';

export const WORKSPACES_STORAGE_KEY = 'wm-workspaces-v1';

/** Max workspaces kept, to stay well inside the localStorage budget. */
const MAX_WORKSPACES = 24;

export interface Workspace {
  id: string;
  name: string;
  /** Variant this was captured under — applying across variants is refused. */
  variant: string;
  createdAt: number;
  updatedAt: number;
  /** localStorage key → captured value (null means "was unset"). */
  snapshot: Record<string, string | null>;
  /** Map view/layers encoded in the URL query at capture time. */
  mapQuery: string;
  /** Cached for display without re-parsing the snapshot. */
  panelCount: number;
}

/**
 * Layout-defining keys. Mirrors PanelLayoutManager.saveCurrentLayout() plus the
 * variant-scoped panel + map-layer keys.
 */
export function workspaceKeys(variant: string = SITE_VARIANT): string[] {
  return [
    'panel-order',
    'panel-order-bottom-set',
    'worldmonitor-layout-mode',
    'worldmonitor-panel-spans',
    'worldmonitor-panel-col-spans',
    // Row-drag resize stores pixel heights separately and applies them as an
    // inline `grid-row: span N`, which overrides the span classes above. Without
    // this key a restore silently keeps the previous workspace's row heights.
    'worldmonitor-panel-heights',
    'map-pinned',
    'map-height',
    'worldmonitor-sidebar-split',
    'worldmonitor-panels-collapsed',
    'worldmonitor-bottom-grid-collapsed',
    'worldmonitor-map-mode',
    // Panel settings and layers are written under both the variant-scoped and
    // the plain key depending on the code path (panel toggles use the plain
    // key, mission packs the scoped one), so capture both for an exact restore.
    getVariantStorageKey(STORAGE_KEYS.panels, variant),
    STORAGE_KEYS.panels,
    getVariantStorageKey(STORAGE_KEYS.mapLayers, variant),
    STORAGE_KEYS.mapLayers,
  ];
}

/**
 * How many panels this workspace shows. Panel settings are only written to
 * storage once something toggles them, so on an untouched layout fall back to
 * counting what is actually on screen.
 */
function countEnabledPanels(snapshot: Record<string, string | null>, variant: string): number {
  const raw = snapshot[getVariantStorageKey(STORAGE_KEYS.panels, variant)]
    ?? snapshot[STORAGE_KEYS.panels];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, { enabled?: boolean }>;
      const count = Object.values(parsed).filter(p => p?.enabled).length;
      if (count > 0) return count;
    } catch {
      /* fall through to the DOM count */
    }
  }
  return countVisiblePanels();
}

function countVisiblePanels(): number {
  try {
    return document.querySelectorAll(
      '#panelsGrid > [data-panel]:not(.hidden), #mapBottomGrid > [data-panel]:not(.hidden)',
    ).length;
  } catch {
    return 0;
  }
}

export function listWorkspaces(): Workspace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKSPACES_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((w): w is Workspace =>
        !!w && typeof w.id === 'string' && typeof w.name === 'string' && !!w.snapshot)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persist(workspaces: Workspace[]): void {
  try {
    localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces.slice(0, MAX_WORKSPACES)));
  } catch {
    /* quota — keep the in-memory list; the user can delete some and retry */
  }
}

/** Snapshot the current layout under `name`. Re-saving an existing id updates it. */
export function saveWorkspace(name: string, id?: string): Workspace {
  const variant = SITE_VARIANT;
  const keys = workspaceKeys(variant);
  const panelsKey = getVariantStorageKey(STORAGE_KEYS.panels, variant);
  // buildPanelLayoutSnapshot copies `keys` and then sets panelsKey to the value
  // passed in — pass the live value so it matches the rest of the capture.
  const snapshot = buildPanelLayoutSnapshot(keys, panelsKey, localStorage.getItem(panelsKey));

  const now = Date.now();
  const existing = id ? listWorkspaces().find(w => w.id === id) : undefined;
  const workspace: Workspace = {
    id: existing?.id ?? `ws${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: name.trim().slice(0, 60) || 'Untitled workspace',
    variant,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    snapshot,
    mapQuery: window.location.search,
    panelCount: countEnabledPanels(snapshot, variant),
  };

  const rest = listWorkspaces().filter(w => w.id !== workspace.id);
  persist([workspace, ...rest]);
  return workspace;
}

/**
 * Stage a workspace's keys into localStorage. Returns the URL the caller should
 * navigate to for an exact restore, or null if the workspace can't be applied.
 */
export function applyWorkspace(id: string): string | null {
  const workspace = listWorkspaces().find(w => w.id === id);
  if (!workspace) return null;
  // A layout captured on another variant references panels/layers that may not
  // exist here; refuse rather than half-apply it.
  if (workspace.variant !== SITE_VARIANT) return null;

  for (const [key, value] of Object.entries(workspace.snapshot)) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* skip unwritable key rather than abort the whole restore */
    }
  }
  return `${window.location.pathname}${workspace.mapQuery || ''}`;
}

export function deleteWorkspace(id: string): void {
  persist(listWorkspaces().filter(w => w.id !== id));
}

export function renameWorkspace(id: string, name: string): void {
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return;
  persist(listWorkspaces().map(w =>
    w.id === id ? { ...w, name: trimmed, updatedAt: Date.now() } : w));
}
