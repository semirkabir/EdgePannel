/**
 * Client-side executor for agent map-control tools.
 *
 * The desktop agent gateway (src-tauri/sidecar/agent-gateway.mjs) validates
 * set_map_view / zoom_to_region / toggle_map_layers calls from the LLM but
 * deliberately does NOT execute them — the live map lives in the browser.
 * It returns each accepted call as a toolEvent carrying a `clientAction`
 * payload; AgentChatPanel forwards those events here, and this module turns
 * them into real camera moves and layer switches via injected accessors.
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

/** Minimal view of the pieces of app state the bridge is allowed to touch. */
export interface AgentMapAccessors {
  /** Active map container (flat or globe) — null before map init. */
  getMap(): { setCenter(lat: number, lon: number, zoom?: number): void } | null;
  /** Current layer-toggle record (the same object shape as MapLayers). */
  getCurrentLayers(): Record<string, boolean>;
  /** Persist + apply a merged layer record (storage, URL state, renderers). */
  commitLayers(layers: Record<string, boolean>): void;
}

export interface AgentMapApplySummary {
  /** Camera commands applied (set_map_view / zoom_to_region). */
  movedCamera: number;
  /** Layer keys actually flipped (present in state and changed value). */
  toggledKeys: string[];
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
  const summary: AgentMapApplySummary = { movedCamera: 0, toggledKeys: [], rejected: [] };
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

    summary.rejected.push(event.name || 'unknown');
  }

  return summary;
}
