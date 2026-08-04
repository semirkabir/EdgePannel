/**
 * Shared drawing geometry.
 *
 * Kept separate from MapDrawController so consumers that need the drawn shapes
 * (e.g. alert geofencing) can read them from storage without a live map.
 */
import { bearingDeg, destinationPoint } from '@/utils/geo';

export type DrawTool =
  | 'distance'
  | 'circle'
  | 'rangeRings'
  | 'sector'
  | 'polygon'
  | 'rectangle'
  | 'polyline'
  | 'bearing'
  | 'arrow'
  | 'corridor'
  | 'text';

export type LngLat = [number, number];

export interface Drawing {
  id: string;
  tool: DrawTool;
  name: string;
  color: string;
  points: LngLat[];
  radiusKm?: number;
  rings?: number;
  visible: boolean;
  createdAt: number;
}

export const DRAWINGS_STORAGE_KEY = 'wm-map-drawings-v1';

/** Tools whose committed shape encloses an area (usable as a geofence). */
export const AREA_TOOLS: ReadonlySet<DrawTool> = new Set<DrawTool>([
  'circle', 'rangeRings', 'sector', 'polygon', 'rectangle', 'corridor',
]);

export const SECTOR_HALF_ANGLE = 30; // ±30° → 60° wedge
export const RING_COUNT = 3;
export const CORRIDOR_HALF_WIDTH_KM = 20;
const ARC_STEPS = 72;

function segmentBearing(a: LngLat, b: LngLat): number {
  return bearingDeg(a[1], a[0], b[1], b[0]);
}

/** Buffer a multi-point path into a ribbon polygon, halfWidthKm on each side. */
export function corridorRing(points: LngLat[], halfWidthKm: number): LngLat[] {
  if (points.length < 2) return [];
  const left: LngLat[] = [];
  const right: LngLat[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    if (!cur) continue;
    let brg: number;
    if (prev && next) {
      const b1 = segmentBearing(prev, cur);
      const b2 = segmentBearing(cur, next);
      const diff = ((b2 - b1 + 540) % 360) - 180;
      brg = (b1 + diff / 2 + 360) % 360;
    } else if (next) {
      brg = segmentBearing(cur, next);
    } else if (prev) {
      brg = segmentBearing(prev, cur);
    } else {
      brg = 0;
    }
    const [lng, lat] = cur;
    left.push(destinationPoint(lat, lng, brg - 90, halfWidthKm));
    right.push(destinationPoint(lat, lng, brg + 90, halfWidthKm));
  }
  const first = left[0];
  if (!first) return [];
  return [...left, ...right.reverse(), first];
}

/** Small filled triangle at `to`, oriented along the bearing from `from`. */
export function arrowHead(from: LngLat, to: LngLat, sizeKm: number): LngLat[] {
  const brg = segmentBearing(from, to);
  const [lng, lat] = to;
  const back = destinationPoint(lat, lng, brg + 180, sizeKm);
  const [bLng, bLat] = back;
  const left = destinationPoint(bLat, bLng, brg - 90, sizeKm * 0.5);
  const right = destinationPoint(bLat, bLng, brg + 90, sizeKm * 0.5);
  return [to, right, left, to];
}

export function circleRing(center: LngLat, radiusKm: number): LngLat[] {
  const [lng, lat] = center;
  const ring: LngLat[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    ring.push(destinationPoint(lat, lng, (i / ARC_STEPS) * 360, radiusKm));
  }
  return ring;
}

export function sectorRing(center: LngLat, radiusKm: number, bearing: number): LngLat[] {
  const [lng, lat] = center;
  const ring: LngLat[] = [center];
  const start = bearing - SECTOR_HALF_ANGLE;
  for (let i = 0; i <= ARC_STEPS; i++) {
    ring.push(destinationPoint(lat, lng, start + (i / ARC_STEPS) * (SECTOR_HALF_ANGLE * 2), radiusKm));
  }
  ring.push(center);
  return ring;
}

export function rectRing(a: LngLat, b: LngLat): LngLat[] {
  const [x1, y1] = a; const [x2, y2] = b;
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
}

/** Closed rings that define a drawing's enclosed area(s). Empty for line tools. */
export function polygonRings(d: Drawing): LngLat[][] {
  const p = d.points;
  const c = p[0];
  const e = p[1];
  switch (d.tool) {
    case 'circle':
      return c && d.radiusKm ? [circleRing(c, d.radiusKm)] : [];
    case 'rangeRings': {
      if (!c || !d.radiusKm) return [];
      const r = d.radiusKm;
      const n = d.rings ?? RING_COUNT;
      return Array.from({ length: n }, (_, i) => circleRing(c, (r * (i + 1)) / n));
    }
    case 'sector':
      return c && e && d.radiusKm
        ? [sectorRing(c, d.radiusKm, bearingDeg(c[1], c[0], e[1], e[0]))]
        : [];
    case 'rectangle':
      return c && e ? [rectRing(c, e)] : [];
    case 'polygon':
      return p.length >= 3 && c ? [[...p, c]] : [];
    case 'corridor': {
      const ring = p.length >= 2 ? corridorRing(p, d.radiusKm ?? CORRIDOR_HALF_WIDTH_KM) : [];
      return ring.length ? [ring] : [];
    }
    default:
      return [];
  }
}

export interface DrawnZone {
  id: string;
  name: string;
  /** Outer polygon ring, [lng, lat] order. */
  ring: LngLat[];
}

/** Enclosed-area drawings as zones. For range rings, the outermost ring wins. */
export function drawingsToZones(drawings: Drawing[]): DrawnZone[] {
  const zones: DrawnZone[] = [];
  for (const d of drawings) {
    if (!AREA_TOOLS.has(d.tool)) continue;
    const rings = polygonRings(d);
    const outer = rings[rings.length - 1];
    if (outer) zones.push({ id: d.id, name: d.name, ring: outer });
  }
  return zones;
}

/** Read persisted drawings without needing a live map instance. */
export function loadStoredDrawings(): Drawing[] {
  try {
    const raw = localStorage.getItem(DRAWINGS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((d): d is Drawing => !!d && typeof d.id === 'string' && Array.isArray(d.points))
      : [];
  } catch {
    return [];
  }
}

/** Zones available for geofencing, read straight from persisted drawings. */
export function loadStoredDrawnZones(): DrawnZone[] {
  return drawingsToZones(loadStoredDrawings());
}
