/**
 * Client-side executor for agent map-control tools.
 *
 * The agent gateway validates set_map_view / zoom_to_region / toggle_map_layers /
 * highlight_features calls from the LLM but deliberately does NOT execute them —
 * the live map lives in the browser. It returns each accepted call as a toolEvent
 * carrying a `clientAction` payload; AgentChatPanel forwards those events here.
 *
 * Accessors keep this module decoupled from AppContext so the logic stays
 * unit-testable; event-handlers supplies them when constructing the panel.
 */

/** Shape of the gateway's toolEvents entries relevant to the map. */
export interface AgentMapToolEvent {
  name: string;
  args?: Record<string, unknown>;
  /** Present only on accepted client-executed tools (validated server-side). */
  clientAction?: Record<string, unknown>;
  error?: string;
}

export interface AgentMapViewport {
  center: { lat: number; lon: number };
  zoom?: number;
  bounds?: { west: number; south: number; east: number; north: number };
  mode?: 'flat' | 'globe' | 'svg';
}

export interface AgentHighlightItem {
  id?: string;
  type?: string;
  lat?: number;
  lon?: number;
  label?: string;
}

/** Minimal view of the pieces of app state the bridge is allowed to touch. */
export interface AgentMapAccessors {
  /** Active map container (flat or globe) — null before map init. */
  getMap(): { setCenter(lat: number, lon: number, zoom?: number): void } | null;
  /** Current layer-toggle record (the same object shape as MapLayers). */
  getCurrentLayers(): Record<string, boolean>;
  /** Persist + apply a merged layer record (storage, URL state, renderers). */
  commitLayers(layers: Record<string, boolean>): void;
  /** Optional: flash asset ids / drop temporary pins. */
  highlightFeatures?(items: AgentHighlightItem[], durationMs: number): void;
  /** Optional: snapshot for get_visible_region (sent with each chat request). */
  getViewport?(): AgentMapViewport | null;
}

export interface AgentMapApplySummary {
  /** Camera commands applied (set_map_view / zoom_to_region). */
  movedCamera: number;
  /** Layer keys actually flipped (present in state and changed value). */
  toggledKeys: string[];
  /** Number of highlight_features batches applied. */
  highlighted: number;
  /** Events that carried a clientAction but failed defensive checks. */
  rejected: string[];
}

/**
 * Apply a chat response's toolEvents to the live map. Safe to call with any
 * response: non-map tools and errored events are skipped, and unknown/absent
 * layer keys are ignored rather than created.
 */
export function applyAgentMapToolEvents(
  events: readonly AgentMapToolEvent[] | undefined | null,
  accessors: AgentMapAccessors,
): AgentMapApplySummary {
  const summary: AgentMapApplySummary = {
    movedCamera: 0,
    toggledKeys: [],
    highlighted: 0,
    rejected: [],
  };
  if (!Array.isArray(events)) return summary;

  for (const event of events) {
    if (!event || event.error || !event.clientAction) continue;
    const action = event.clientAction;

    if (event.name === 'set_map_view' || event.name === 'zoom_to_region') {
      const lat = Number(action.lat);
      const lon = Number(action.lon);
      const zoom = Number(action.zoom);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        summary.rejected.push(event.name);
        continue;
      }
      accessors.getMap()?.setCenter(lat, lon, Number.isFinite(zoom) ? zoom : undefined);
      summary.movedCamera++;
      continue;
    }

    if (event.name === 'toggle_map_layers') {
      const current = accessors.getCurrentLayers();
      const next: Record<string, boolean> = { ...current };
      const enable = Array.isArray(action.enable) ? action.enable.map(String) : [];
      const disable = Array.isArray(action.disable) ? action.disable.map(String) : [];
      const touched: string[] = [];
      for (const key of enable) {
        if (key in next && next[key] !== true) { next[key] = true; touched.push(key); }
      }
      for (const key of disable) {
        if (key in next && next[key] !== false) { next[key] = false; touched.push(key); }
      }
      if (touched.length > 0) {
        accessors.commitLayers(next);
        summary.toggledKeys.push(...touched);
      }
      continue;
    }

    if (event.name === 'highlight_features') {
      const items = Array.isArray(action.items) ? action.items as AgentHighlightItem[] : [];
      let durationMs = Number(action.durationMs);
      if (!Number.isFinite(durationMs)) durationMs = 3000;
      durationMs = Math.max(800, Math.min(8000, Math.round(durationMs)));
      if (items.length === 0) {
        summary.rejected.push(event.name);
        continue;
      }
      // Prefer the first coordinate pin as a gentle camera nudge so the
      // analyst is looking at the right region even when asset flash is no-op
      // on SVG / missing layers.
      const pin = items.find(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
      if (pin) {
        accessors.getMap()?.setCenter(Number(pin.lat), Number(pin.lon));
      }
      if (typeof accessors.highlightFeatures === 'function') {
        accessors.highlightFeatures(items, durationMs);
      }
      summary.highlighted++;
      continue;
    }

    summary.rejected.push(event.name || 'unknown');
  }

  return summary;
}

/** Read viewport for chat request bodies; null when map not ready. */
export function readAgentMapViewport(accessors: AgentMapAccessors | null | undefined): AgentMapViewport | null {
  if (!accessors || typeof accessors.getViewport !== 'function') return null;
  try {
    return accessors.getViewport() ?? null;
  } catch {
    return null;
  }
}
