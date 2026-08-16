/**
 * Map hover coordinate bus.
 *
 * The map engines are the only place that knows where the pointer sits in
 * geographic space; the status bar is the only place that renders it. Routing
 * the value through one tiny module keeps DeckGLMap free of any status-bar
 * knowledge and avoids threading another callback through MapContainer's
 * facade.
 *
 * Readers poll `getMapHoverPosition()` — mousemove fires far more often than a
 * frame, so publishing is a plain assignment and consumers sample it on their
 * own animation frame instead of re-rendering per pointer event.
 */

export interface MapHoverPosition {
  lat: number;
  lon: number;
}

let current: MapHoverPosition | null = null;

/** Called by the map engine on every pointer move over the map surface. */
export function publishMapHoverPosition(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  current = { lat, lon };
}

/** Called when the pointer leaves the map surface. */
export function clearMapHoverPosition(): void {
  current = null;
}

/** Latest hovered coordinate, or null when the pointer is off the map. */
export function getMapHoverPosition(): MapHoverPosition | null {
  return current;
}
