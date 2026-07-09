import type { MapLayers } from '@/types';
import type { TimeRange } from './MapContainer';

/**
 * Core contract implemented by the map engine — DeckGLMap (MapLibre + deck.gl),
 * which serves both the 2D/flat view and the 3D globe via MapLibre's globe
 * projection (`setGlobeProjection`).
 *
 * This interface pins the *core* method surface, so `implements MapEngine` on the
 * engine turns any accidental signature change to these methods into a compile-time
 * error — a guard against silent drift as the engine evolves.
 *
 * It intentionally covers only a stable subset of methods; others (e.g. `getState`,
 * `flashAssets`, `highlightAssets`, `setCableHealth`) are deliberately excluded.
 * Widen this contract as more of the surface stabilizes.
 */
export interface MapEngine {
  // ── Lifecycle ──────────────────────────────────────────────────────────
  render(dirtyLayer?: string): void;
  resize(): void;
  destroy(): void;

  // ── Layer control ──────────────────────────────────────────────────────
  enableLayer(layer: keyof MapLayers): void;
  hideLayerToggle(layer: keyof MapLayers): void;

  // ── Navigation ─────────────────────────────────────────────────────────
  setCenter(lat: number, lon: number, zoom?: number): void;
  getCenter(): { lat: number; lon: number } | null;
  fitCountry(code: string): void;
  getTimeRange(): TimeRange;

  // ── Country highlight ──────────────────────────────────────────────────
  highlightCountry(code: string): void;
  clearCountryHighlight(): void;

  // ── Transient markers ──────────────────────────────────────────────────
  flashLocation(lat: number, lon: number, durationMs?: number): void;

  // ── Escalation / hotspots ──────────────────────────────────────────────
  initEscalationGetters(): void;
  getHotspotLevels(): Record<string, string>;
}
