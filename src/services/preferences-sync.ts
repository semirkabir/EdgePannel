/**
 * Cloud preferences sync — TradingView-style session persistence.
 *
 * On login  → fetch cloud prefs, apply to localStorage, reload if layout changed.
 * On logout → stop background sync (localStorage keeps local copy).
 * While in  → save current prefs to cloud every 30s + on beforeunload.
 *
 * All /api/ calls automatically carry the Firebase ID token via
 * src/services/api-auth-fetch.ts, so no explicit auth header is needed.
 */

import { showShellNotification } from '@/app/shell-notifications';
import { log } from '@/utils/logger';
import { getCurrentAuthState, isLoggedIn } from '@/services/user-auth';

// ---------------------------------------------------------------------------
// Keys to persist — everything the user expects to "come back to"
// ---------------------------------------------------------------------------

export const SYNC_KEYS = [
  // Panels & layout
  'worldmonitor-panels',
  'worldmonitor-variant',
  'panel-order',
  'panel-order-bottom',
  'panel-order-bottom-set',
  'worldmonitor-panel-spans',
  'worldmonitor-panel-col-spans',
  'worldmonitor-panels-collapsed',
  'worldmonitor-bottom-grid-collapsed',
  'worldmonitor-layout-mode',
  'wm-custom-categories-v1',
  'map-height',
  'worldmonitor-sidebar-split',
  'map-pinned',

  // Map layers & mode
  'worldmonitor-layers',
  'worldmonitor-map-mode',
  'wm-globe-render-scale',
  'wm-globe-texture',
  'wm-globe-visual-preset',
  // Per-variant map themes
  'wm-map-theme:full',
  'wm-map-theme:tech',
  'wm-map-theme:finance',
  'wm-map-theme:commodity',
  'wm-map-theme:happy',
  'wm-map-theme:conflicts',

  // Time & appearance
  'wm:time-range',
  'worldmonitor-theme',
  'worldmonitor-font-preference',
  'worldmonitor-accent-color',
  'worldmonitor-text-tone',
  'wm-cursor-preference',
  'wm-header-tz',
  'wm-header-fmt',
  'wm-ui-panel-density',

  // Data feeds & monitors
  'worldmonitor-disabled-feeds',
  'worldmonitor-live-channels',
  'worldmonitor-monitors',

  // Watchlists & portfolios
  'wm-market-watchlist-v1',
  'wm-portfolio-v1',
  'aviation:watchlist:v1',

  // Alert & insight settings
  'wm-breaking-alerts-v1',
  'wm-insight-severity-preference',
  'wm-badge-animation',
  'wm-stream-quality',
  'wm-live-streams-always-on',
] as const;

/** Keys whose change requires a page reload to take full effect. */
const LAYOUT_RELOAD_KEYS = new Set([
  'worldmonitor-panels',
  'worldmonitor-variant',
  'panel-order',
  'panel-order-bottom',
  'panel-order-bottom-set',
  'worldmonitor-panel-spans',
  'worldmonitor-panel-col-spans',
  'worldmonitor-panels-collapsed',
  'worldmonitor-bottom-grid-collapsed',
  'worldmonitor-layout-mode',
  'wm-custom-categories-v1',
  'map-height',
  'worldmonitor-sidebar-split',
  'worldmonitor-layers',
]);

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

type PrefsBlob = Record<string, string | null>;

function captureLocalPrefs(): PrefsBlob {
  const blob: PrefsBlob = {};
  for (const key of SYNC_KEYS) {
    blob[key] = localStorage.getItem(key);
  }
  return blob;
}

function applyPrefsToLocal(prefs: PrefsBlob): void {
  for (const key of SYNC_KEYS) {
    const val = prefs[key];
    if (val !== undefined) {
      if (val === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, val);
      }
    }
  }
}

/** Returns true if any LAYOUT_RELOAD_KEYS differ between cloud and local. */
function hasLayoutDiff(cloudPrefs: PrefsBlob): boolean {
  for (const key of LAYOUT_RELOAD_KEYS) {
    const cloud = cloudPrefs[key] ?? null;
    const local = localStorage.getItem(key);
    if (cloud !== local) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function fetchCloudPrefs(): Promise<PrefsBlob | null> {
  const authState = getCurrentAuthState();
  if (authState.loading || !isLoggedIn()) return null;

  try {
    const resp = await fetch('/api/prefs', { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json() as { prefs?: PrefsBlob | null };
    return data.prefs ?? null;
  } catch {
    return null;
  }
}

async function pushCloudPrefs(prefs: PrefsBlob): Promise<void> {
  const authState = getCurrentAuthState();
  if (authState.loading || !isLoggedIn()) return;

  try {
    const resp = await fetch('/api/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs }),
    });
    if (!resp.ok && resp.status !== 401) {
      throw new Error(`HTTP ${resp.status}`);
    }
  } catch {
    // Silently ignore — local state is source of truth
  }
}

// ---------------------------------------------------------------------------
// Sync lifecycle
// ---------------------------------------------------------------------------

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isActive = false;

const SYNC_INTERVAL_MS = 30_000; // 30 s background save

function stopSync(): void {
  isActive = false;
  if (syncInterval !== null) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function startBackgroundSync(): void {
  stopSync();
  isActive = true;

  syncInterval = setInterval(() => {
    if (!isActive) return;
    void pushCloudPrefs(captureLocalPrefs());
  }, SYNC_INTERVAL_MS);

  // Save on tab close / navigation
  window.addEventListener('beforeunload', handleBeforeUnload);
}

function handleBeforeUnload(): void {
  if (!isActive) return;
  // Use sendBeacon for best-effort delivery on unload
  const prefs = captureLocalPrefs();
  const body = JSON.stringify({ prefs });
  try {
    navigator.sendBeacon('/api/prefs', new Blob([body], { type: 'application/json' }));
  } catch {
    // sendBeacon may fail in some environments — ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called when a user logs in.
 *
 * 1. Fetches cloud prefs.
 * 2a. If cloud is empty → saves current local state as initial backup.
 * 2b. If cloud has data  → applies to localStorage; reloads if layout differs.
 * 3. Starts 30 s background sync.
 */
export async function onUserLogin(): Promise<void> {
  const cloudPrefs = await fetchCloudPrefs();

  if (cloudPrefs === null) {
    // First-ever login — snapshot current state to cloud
    await pushCloudPrefs(captureLocalPrefs());
    log.debug('[prefs-sync] Initial snapshot saved to cloud');
  } else {
    const needsReload = hasLayoutDiff(cloudPrefs);
    applyPrefsToLocal(cloudPrefs);
    log.debug('[prefs-sync] Cloud prefs applied', { needsReload });

    if (needsReload) {
      showShellNotification('Restoring your last session…', 'info', 1800, 'top');
      setTimeout(() => window.location.reload(), 1200);
      return; // Don't start sync — page is reloading
    } else {
      showShellNotification('Session restored', 'success', 2000, 'top');
    }
  }

  startBackgroundSync();
}

/**
 * Called when a user logs out. Stops background sync; local prefs stay intact.
 */
export function onUserLogout(): void {
  stopSync();
  window.removeEventListener('beforeunload', handleBeforeUnload);
  log.debug('[prefs-sync] Sync stopped');
}

/**
 * Immediately save current prefs to cloud (e.g. after manually saving layout).
 */
export async function forceSaveToCloud(): Promise<void> {
  await pushCloudPrefs(captureLocalPrefs());
}
