/** Zoom-aware size + density capping for dense point layers (flights). */
export function flightIconScale(zoom: number): number {
  if (zoom < 2.5) return 0.45;
  if (zoom < 4) return 0.65;
  if (zoom < 6) return 0.85;
  return 1;
}

/** Pixel floor for flight icons. A fixed 10px floor defeats the zoom scale at world view. */
export function flightMinPixels(zoom: number): number {
  if (zoom < 2.5) return 4;
  if (zoom < 4) return 6;
  return 10;
}

type KeepId = string | null | undefined;
type GeoPoint = { id?: string; icao24?: string; lat: number; lon: number };

/** At or above this zoom every point is shown. */
export const DENSITY_CAP_MAX_ZOOM = 5;
/** Screen size of one density cell, in CSS pixels (about one world-zoom icon). */
const CELL_PX = 12;
/** Points kept per cell. */
const MAX_PER_CELL = 3;

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Degrees covered by CELL_PX at this Web Mercator zoom (256px tiles). */
export function densityCellDegrees(zoom: number): number {
  return (CELL_PX * 360) / (256 * 2 ** zoom);
}

/**
 * Cap how many points render per screen cell so dense corridors (US, Europe)
 * stop merging into a solid smear while sparse regions keep every point.
 * Uniform sampling can't do this: it thins the oceans as much as the US.
 *
 * - Below DENSITY_CAP_MAX_ZOOM, keeps at most MAX_PER_CELL points per ~12px cell.
 * - Selection within a cell is by stable id hash, so the same aircraft stay
 *   visible frame to frame instead of flickering.
 * - Points matching `keepId` (selected / followed aircraft) are always kept.
 * - Original order is preserved.
 */
export function sampleForZoom<T extends GeoPoint>(
  points: T[],
  zoom: number,
  keepId?: KeepId | KeepId[],
): T[] {
  if (zoom >= DENSITY_CAP_MAX_ZOOM || points.length < 500) return points;
  const kept = new Set<string>((Array.isArray(keepId) ? keepId : [keepId]).filter((k): k is string => !!k));
  const cellDeg = densityCellDegrees(zoom);
  const keyOf = (p: T) => p.id ?? p.icao24 ?? '';
  const cellOf = (p: T) => `${Math.floor(p.lon / cellDeg)}:${Math.floor(p.lat / cellDeg)}`;

  // Per cell, keep the MAX_PER_CELL lowest id hashes.
  const winners = new Map<string, number[]>();
  for (const p of points) {
    const h = hashKey(keyOf(p));
    const cell = cellOf(p);
    const list = winners.get(cell);
    if (!list) {
      winners.set(cell, [h]);
    } else if (list.length < MAX_PER_CELL) {
      list.push(h);
      list.sort((a, b) => a - b);
    } else if (h < list[list.length - 1]!) {
      list[list.length - 1] = h;
      list.sort((a, b) => a - b);
    }
  }

  return points.filter((p) => {
    const key = keyOf(p);
    if (kept.size > 0 && kept.has(key)) return true;
    return winners.get(cellOf(p))!.includes(hashKey(key));
  });
}
