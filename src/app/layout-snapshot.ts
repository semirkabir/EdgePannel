export const PANEL_LAYOUT_SNAPSHOT_KEY = 'worldmonitor-saved-panel-layout';
export const MAP_LAYOUT_SNAPSHOT_KEY = 'worldmonitor-saved-map-layout';

export function buildPanelLayoutSnapshot(keys: string[], panelsKey: string, panelsValue: string | null): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {};
  for (const key of keys) {
    snapshot[key] = localStorage.getItem(key);
  }
  snapshot[panelsKey] = panelsValue;
  return snapshot;
}

export function savePanelLayoutSnapshot(keys: string[], panelsKey: string, panelsValue: string | null): void {
  localStorage.setItem(PANEL_LAYOUT_SNAPSHOT_KEY, JSON.stringify(buildPanelLayoutSnapshot(keys, panelsKey, panelsValue)));
}

export function saveMapLayoutSnapshot(): void {
  localStorage.setItem(MAP_LAYOUT_SNAPSHOT_KEY, window.location.search);
}

export function removePanelLayoutSnapshot(): void {
  localStorage.removeItem(PANEL_LAYOUT_SNAPSHOT_KEY);
}
