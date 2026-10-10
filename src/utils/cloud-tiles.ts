/**
 * clouds:// custom protocol — real cloud cover from NASA GIBS.
 *
 * GIBS is public domain and needs no API key, but it serves nothing that can be
 * dropped straight into a raster layer as clouds. The obvious shortcut —
 * luminance-keying the true-colour imagery so "bright = cloud" — paints the
 * Sahara, the Greenland ice sheet and all of Antarctica solid white, because
 * reflectance can't tell cloud from desert or snow.
 *
 * So this protocol composites TWO same-overpass MODIS Terra products per tile:
 *
 *   MASK       MODIS_Terra_Cloud_Top_Temp_Day — an actual cloud retrieval,
 *              opaque only where a cloud top was found and fully transparent
 *              over clear sky. This decides WHERE cloud exists.
 *   TEXTURE    MODIS_Terra_CorrectedReflectance_TrueColor — decides how THICK
 *              it looks. Within the mask, brighter reflectance means denser
 *              cloud, so thin cirrus stays faint and deep convection reads
 *              solid, instead of every cloud being one flat blob of paint.
 *
 * The output is white with the composited value in alpha, which is what a
 * MapLibre raster layer wants and which sits correctly over any basemap theme.
 *
 * Both products come off the same instrument and overpass, so mask and texture
 * are always temporally consistent. GIBS wants an explicit UTC date (its
 * literal `default` time is rejected for the cloud product), and today's
 * composite fills in through the UTC day as Terra's swaths land — so a tile
 * that misses on today retries yesterday before giving up.
 */
import * as maplibregl from 'maplibre-gl';

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/** Cloud retrieval: where there IS cloud. Transparent over clear sky. */
const MASK_LAYER = 'MODIS_Terra_Cloud_Top_Temp_Day';
const MASK_MATRIX_SET = 'GoogleMapsCompatible_Level6';
/** True colour: how thick the cloud looks. */
const TEXTURE_LAYER = 'MODIS_Terra_CorrectedReflectance_TrueColor';
const TEXTURE_MATRIX_SET = 'GoogleMapsCompatible_Level9';

/**
 * The cloud retrieval tops out at Level6; z7+ is a hard 400 from GIBS, not an
 * empty tile. The source declares this as its maxzoom so MapLibre overzooms the
 * z6 tiles instead of requesting levels that don't exist.
 */
export const CLOUD_TILE_MAX_ZOOM = 6;
export const CLOUD_TILE_SIZE = 256;
export const CLOUD_TILE_URL_TEMPLATE = 'clouds://tiles/{z}/{x}/{y}.png';
export const CLOUD_ATTRIBUTION = 'NASA EOSDIS GIBS · MODIS Terra';

/**
 * Floor on how visible a masked pixel can get, so cloud the retrieval is sure
 * about never vanishes just because the reflectance under it came back dark
 * (night-edge swaths, sun glint, sensor gaps).
 */
const MIN_TEXTURE_WEIGHT = 0.35;

/** 1x1 transparent PNG — served for tiles GIBS has no data for. */
const EMPTY_TILE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let registered = false;
let emptyTile: ArrayBuffer | null = null;

function getEmptyTile(): ArrayBuffer {
  if (emptyTile) return emptyTile;
  const binary = atob(EMPTY_TILE_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  emptyTile = bytes.buffer;
  return emptyTile;
}

/** GIBS REST paths order the tile triple as z/y/x — row before column. */
function gibsUrl(layer: string, matrixSet: string, date: string, z: number, x: number, y: number, ext: string): string {
  return `${GIBS_BASE}/${layer}/default/${date}/${matrixSet}/${z}/${y}/${x}.${ext}`;
}

function utcDateString(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return date.toISOString().slice(0, 10);
}

async function fetchBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, signal ? { signal } : undefined);
    // 404 is GIBS's ordinary "no data for this tile/date", not a failure.
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

type Canvas2D = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
};

function createCanvas(width: number, height: number): Canvas2D | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return ctx ? { canvas, ctx } : null;
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return ctx ? { canvas, ctx } : null;
}

/** Rasterise a bitmap into RGBA bytes at the tile's own size. */
function readPixels(bitmap: ImageBitmap, size: number): Uint8ClampedArray | null {
  const surface = createCanvas(size, size);
  if (!surface) return null;
  surface.ctx.clearRect(0, 0, size, size);
  surface.ctx.drawImage(bitmap, 0, 0, size, size);
  return surface.ctx.getImageData(0, 0, size, size).data;
}

async function encodePng(surface: Canvas2D): Promise<ArrayBuffer | null> {
  try {
    if (typeof OffscreenCanvas !== 'undefined' && surface.canvas instanceof OffscreenCanvas) {
      const blob = await surface.canvas.convertToBlob({ type: 'image/png' });
      return await blob.arrayBuffer();
    }
    const canvas = surface.canvas as HTMLCanvasElement;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? await blob.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Mask decides presence, reflectance decides density. Output is white with the
 * result in alpha; the layer's raster-opacity scales the whole thing.
 */
function compositeCloudTile(
  mask: Uint8ClampedArray,
  texture: Uint8ClampedArray | null,
  size: number,
): ImageData {
  const out = new ImageData(size, size);
  const pixels = out.data;

  for (let i = 0; i < mask.length; i += 4) {
    const presence = mask[i + 3]!;
    if (presence === 0) continue;

    let weight = 1;
    if (texture) {
      // Rec. 709 luma of the true-colour pixel, as a stand-in for optical depth.
      const luma = (0.2126 * texture[i]! + 0.7152 * texture[i + 1]! + 0.0722 * texture[i + 2]!) / 255;
      weight = MIN_TEXTURE_WEIGHT + (1 - MIN_TEXTURE_WEIGHT) * luma;
    }

    pixels[i] = 255;
    pixels[i + 1] = 255;
    pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(presence * weight);
  }

  return out;
}

async function buildTile(z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  // Today's composite grows through the UTC day; fall back a day on a miss so
  // the globe is never blank just because Terra hasn't crossed this tile yet.
  let date = utcDateString(0);
  let maskBitmap = await fetchBitmap(gibsUrl(MASK_LAYER, MASK_MATRIX_SET, date, z, x, y, 'png'), signal);
  if (!maskBitmap) {
    date = utcDateString(1);
    maskBitmap = await fetchBitmap(gibsUrl(MASK_LAYER, MASK_MATRIX_SET, date, z, x, y, 'png'), signal);
  }
  if (!maskBitmap) return getEmptyTile();

  const size = maskBitmap.width || CLOUD_TILE_SIZE;
  const mask = readPixels(maskBitmap, size);
  maskBitmap.close();
  if (!mask) return getEmptyTile();

  // Same date as the mask that survived, so the two products always agree.
  const textureBitmap = await fetchBitmap(gibsUrl(TEXTURE_LAYER, TEXTURE_MATRIX_SET, date, z, x, y, 'jpg'), signal);
  const texture = textureBitmap ? readPixels(textureBitmap, size) : null;
  textureBitmap?.close();

  const surface = createCanvas(size, size);
  if (!surface) return getEmptyTile();
  surface.ctx.putImageData(compositeCloudTile(mask, texture, size), 0, 0);
  return (await encodePng(surface)) ?? getEmptyTile();
}

const handler = async (
  params: { url: string },
  abortController?: AbortController,
): Promise<{ data: ArrayBuffer }> => {
  const match = params.url.match(/^clouds:\/\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) return { data: getEmptyTile() };
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (z > CLOUD_TILE_MAX_ZOOM) return { data: getEmptyTile() };
  return { data: await buildTile(z, x, y, abortController?.signal) };
};

/** Register the protocol once (idempotent across HMR re-execution). */
export function registerCloudsProtocol(): void {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol('clouds', handler as never);
}
