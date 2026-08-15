/**
 * buildings:// custom protocol — real overzoom for the 3D buildings source.
 *
 * The openfreemap planet snapshot only carries `building` source-layer
 * features from z14 up (maxzoom 14), so at z13.x the city "loses" its
 * buildings entirely even though z14 tiles are rich. MapLibre can only
 * overzoom UP (viewport zoom > source maxzoom), never down.
 *
 * This protocol fixes the gap the cheap way: a z13 request is answered by
 * fetching the FOUR z14 child tiles that cover it, decoding each MVT,
 * scaling every ring by 0.5 and translating by the child's offset (2048,
 * 4096 extent), and re-encoding a single merged z13 tile. Decode→scale→
 * translate→re-encode is a pass-through of the original MVT rings (no
 * GeoJSON round-trip), so ring ordering, winding, property types and feature
 * ids are preserved exactly.
 *
 * Registered once via maplibregl.addProtocol('buildings', ...) — the handler
 * runs on the main thread and the merged buffer is transferred to the worker.
 */
import maplibregl from 'maplibre-gl';
import { VectorTile } from '@mapbox/vector-tile';
import pbf from 'pbf';
import vtpbf from 'vt-pbf';

const PLANET_TILEJSON_URL = 'https://tiles.openfreemap.org/planet';

let registered = false;

/** Cache the planet TileJSON tiles template (the snapshot path rotates over time). */
let templatePromise: Promise<string | null> | null = null;
function getPlanetTileTemplate(): Promise<string | null> {
  if (!templatePromise) {
    templatePromise = (async () => {
      try {
        const res = await fetch(PLANET_TILEJSON_URL);
        if (!res.ok) return null;
        const tj = await res.json();
        const tiles = Array.isArray(tj?.tiles) ? tj.tiles : [];
        const template = tiles.find((t: unknown) => typeof t === 'string') as string | undefined;
        return template ?? null;
      } catch {
        return null;
      }
    })().catch(() => null);
    // Only cache SUCCESS — a transient failure must not poison every later request.
    templatePromise.then((t) => {
      if (!t) templatePromise = null;
    });
  }
  return templatePromise;
}

function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

async function fetchTileBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // Some servers gzip the body without a Content-Encoding header — detect magic.
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      try {
        const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch {
        return null;
      }
    }
    return buf;
  } catch {
    return null;
  }
}

interface MergedFeature {
  id?: number;
  type: number;
  rings: { x: number; y: number }[][];
  properties: Record<string, unknown>;
}

/** Minimal vector-tile-js-compatible layer over translated rings (vt-pbf accepts it directly). */
class MergedLayer {
  name: string;
  extent = 4096;
  length: number;
  private items: MergedFeature[];

  constructor(name: string, items: MergedFeature[]) {
    this.name = name;
    this.items = items;
    this.length = items.length;
  }

  feature(i: number): { id?: number; type: number; properties: Record<string, unknown>; loadGeometry(): { x: number; y: number }[][] } {
    const f = this.items[i]!; // i is bounded by this.length, same contract as VectorTileLayer.feature
    return { id: f.id, type: f.type, properties: f.properties, loadGeometry: () => f.rings };
  }
}

/** Merge the 4 z14 children (tl, tr, bl, br) of a z13 tile into one z13 tile. */
function mergeChildren(children: (Uint8Array | null)[]): Uint8Array {
  const layerBuckets = new Map<string, MergedFeature[]>();
  for (let ti = 0; ti < 4; ti++) {
    const data = children[ti];
    if (!data || data.length === 0) continue;
    const tx = ti & 1; // 0 = left, 1 = right
    const ty = ti >> 1; // 0 = top, 1 = bottom
    const ox = tx * 2048;
    const oy = ty * 2048;
    let tile: VectorTile;
    try {
      tile = new VectorTile(new pbf(data));
    } catch {
      continue; // corrupt child — skip it, keep the rest
    }
    for (const name of Object.keys(tile.layers)) {
      const layer = tile.layers[name];
      if (!layer) continue;
      // A z14 child's coordinate space spans the same full [0, extent] as the
      // parent's, but the child covers only a QUARTER of the parent's area — so
      // child coordinates must be halved before the quadrant offset. Without
      // the scale, each quadrant's geometry overflows the parent tile by up to
      // half a tile width, so buildings at z13 render misaligned with the
      // basemap (snapping correct at z14+ where native tiles take over).
      const scale = 4096 / (2 * (layer.extent ?? 4096));
      let bucket = layerBuckets.get(name);
      if (!bucket) {
        bucket = [];
        layerBuckets.set(name, bucket);
      }
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        const rings = f.loadGeometry().map((ring) =>
          ring.map((p) => ({ x: p.x * scale + ox, y: p.y * scale + oy })),
        );
        bucket.push({
          id: typeof f.id === 'number' ? f.id : undefined,
          type: f.type,
          rings,
          properties: f.properties ?? {},
        });
      }
    }
  }
  if (layerBuckets.size === 0) return new Uint8Array(0);
  const layers: Record<string, MergedLayer> = {};
  for (const [name, items] of layerBuckets) layers[name] = new MergedLayer(name, items);
  const buf = vtpbf.fromVectorTileJs({ layers });
  return new Uint8Array(buf);
}

const EMPTY = new ArrayBuffer(0);

/**
 * Cache of merged z13 tiles keyed by "x/y". While panning/zooming through the
 * z13 band MapLibre re-requests the same tiles constantly, and every request
 * costs 4 network fetches + a full decode/scale/re-encode on the main thread —
 * without this the 3D buildings visibly lag the basemap (they "don't track"
 * during zoom-out) while each tile is rebuilt.
 */
const mergedCache = new Map<string, ArrayBuffer>();
const MERGED_CACHE_MAX = 256;

const handler = async (params: { url: string }): Promise<{ data: ArrayBuffer }> => {
  const m = params.url.match(/^buildings:\/\/planet\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
  if (!m) return { data: EMPTY };
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);

  const template = await getPlanetTileTemplate();
  if (!template) return { data: EMPTY };

  if (z >= 14) {
    // Native zoom (or MapLibre overzooming z14 upward at z15+): pass through.
    const bytes = await fetchTileBytes(tileUrl(template, z, x, y));
    return { data: bytes ? (bytes.buffer as ArrayBuffer) : EMPTY };
  }

  if (z === 13) {
    // Overzoom DOWN: merge the four z14 children covering this z13 tile.
    const cacheKey = `${x}/${y}`;
    const cached = mergedCache.get(cacheKey);
    if (cached) return { data: cached };
    const children = await Promise.all([
      fetchTileBytes(tileUrl(template, 14, x * 2, y * 2)),
      fetchTileBytes(tileUrl(template, 14, x * 2 + 1, y * 2)),
      fetchTileBytes(tileUrl(template, 14, x * 2, y * 2 + 1)),
      fetchTileBytes(tileUrl(template, 14, x * 2 + 1, y * 2 + 1)),
    ]);
    const merged = mergeChildren(children);
    const buf = merged.buffer as ArrayBuffer;
    mergedCache.set(cacheKey, buf);
    if (mergedCache.size > MERGED_CACHE_MAX) {
      // Drop the oldest entry (Map insertion order) to bound memory.
      const oldest = mergedCache.keys().next().value;
      if (oldest !== undefined) mergedCache.delete(oldest);
    }
    return { data: buf };
  }

  // z < 13: no building data at those zooms — serve an empty tile.
  return { data: EMPTY };
};

/** Register the protocol once (idempotent across HMR re-execution). */
export function registerBuildingsProtocol(): void {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol('buildings', handler as never);
}
