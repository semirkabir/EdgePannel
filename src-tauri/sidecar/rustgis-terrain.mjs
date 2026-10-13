/**
 * Terrain analysis (viewshed / line of sight) backed by RustGIS.
 *
 * Runs `rustgis-cli mcp` as a short-lived stdio MCP server per request,
 * feeds it a Copernicus GLO-90 DEM tile (AWS open data, cached on disk), and
 * converts the result into GeoJSON the map can draw. Desktop sidecar / server
 * only: the tool is offered to the agent only when RUSTGIS_CLI points at a
 * binary, so web builds without it never see it.
 *
 * Known limits (v1): one 1°×1° DEM tile per request, so a viewshed near a
 * tile edge is clipped at the edge; ocean tiles do not exist (404).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

export const RUSTGIS_CLI_ENV_KEY = 'RUSTGIS_CLI';
const DEM_BASE_URL = 'https://copernicus-dem-90m.s3.amazonaws.com';
const MCP_TIMEOUT_MS = 30_000;
const MAX_RADIUS_M = 50_000;
const MAX_OVERLAY_GRID = 240;

export function rustgisCliPath(env = process.env) {
  const configured = env[RUSTGIS_CLI_ENV_KEY];
  return configured && existsSync(configured) ? configured : null;
}

export function terrainCacheDir(env = process.env) {
  return env.RUSTGIS_CACHE_DIR || path.join(os.tmpdir(), 'edgepannel-terrain');
}

/** Copernicus GLO-90 tile name covering a point (tiles are named by their SW corner). */
export function copernicusTileName(lat, lon) {
  const latFloor = Math.floor(lat);
  const lonFloor = Math.floor(lon);
  const ns = latFloor >= 0 ? 'N' : 'S';
  const ew = lonFloor >= 0 ? 'E' : 'W';
  const la = String(Math.abs(latFloor)).padStart(2, '0');
  const lo = String(Math.abs(lonFloor)).padStart(3, '0');
  return `Copernicus_DSM_COG_30_${ns}${la}_00_${ew}${lo}_00_DEM`;
}

async function ensureDemTile(lat, lon, { cacheDir, fetchImpl = fetch }) {
  const name = copernicusTileName(lat, lon);
  const file = path.join(cacheDir, `${name}.tif`);
  if (existsSync(file)) return file;
  await mkdir(cacheDir, { recursive: true });
  const response = await fetchImpl(`${DEM_BASE_URL}/${name}/${name}.tif`, { signal: AbortSignal.timeout(60_000) });
  if (response.status === 404 || response.status === 403) {
    throw new Error(`No land elevation tile for ${lat.toFixed(3)}, ${lon.toFixed(3)} (open water or outside DEM coverage).`);
  }
  if (!response.ok) throw new Error(`DEM download failed: HTTP ${response.status}`);
  const tmp = `${file}.${process.pid}.part`;
  await writeFile(tmp, Buffer.from(await response.arrayBuffer()));
  await rename(tmp, file);
  return file;
}

/** Run a sequence of RustGIS MCP tool calls in one short-lived server session. */
export async function runRustgisMcp(cli, args, calls, { cwd, timeoutMs = MCP_TIMEOUT_MS } = {}) {
  const child = spawn(cli, ['mcp', ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  let stderr = '';
  const pending = new Map();
  let nextId = 0;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      const waiter = pending.get(message.id);
      if (waiter) { pending.delete(message.id); waiter(message); }
    }
  });
  const exited = new Promise(resolve => child.on('close', resolve));
  const failAll = reason => { for (const [, waiter] of pending) waiter({ error: { message: reason } }); pending.clear(); };
  child.on('error', error => failAll(`rustgis-cli failed to start: ${error.message}`));
  exited.then(code => failAll(`rustgis-cli exited (${code}): ${stderr.trim().slice(-300)}`));
  const timer = setTimeout(() => { failAll('rustgis-cli timed out'); child.kill('SIGKILL'); }, timeoutMs);

  const rpc = (method, params, notify = false) => {
    const message = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
    if (notify) { child.stdin.write(`${JSON.stringify(message)}\n`); return Promise.resolve(null); }
    const id = ++nextId;
    return new Promise(resolve => {
      pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify({ ...message, id })}\n`);
    });
  };

  try {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'edgepannel', version: '1' } });
    if (init.error) throw new Error(init.error.message);
    await rpc('notifications/initialized', null, true);
    const results = [];
    for (const [name, toolArgs] of calls) {
      const reply = await rpc('tools/call', { name, arguments: toolArgs });
      if (reply.error) throw new Error(`${name}: ${reply.error.message}`);
      const text = reply.result?.content?.find(part => part.type === 'text')?.text ?? '';
      if (reply.result?.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
      let parsed = text;
      try { parsed = JSON.parse(text); } catch { /* plain text result */ }
      results.push(parsed);
    }
    return results;
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    child.kill();
    await exited;
  }
}

// --- Minimal GeoTIFF reader for RustGIS raster exports ------------------------
// Handles what RustGIS writes: little/big-endian, stripped or tiled, float32 or
// integer samples, no/Deflate compression, geographic ModelPixelScale/Tiepoint.

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };

export function readGeoTiff(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const little = buffer[0] === 0x49;
  if (view.getUint16(2, little) !== 42) throw new Error('Unsupported TIFF (BigTIFF or not a TIFF)');
  const ifd = view.getUint32(4, little);
  const count = view.getUint16(ifd, little);
  const tags = {};
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const n = view.getUint32(entry + 4, little);
    const size = (TYPE_SIZES[type] || 1) * n;
    const at = size <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
    const values = [];
    for (let k = 0; k < n && k < 4096; k++) {
      if (type === 3 || type === 8) values.push(view.getUint16(at + k * 2, little));
      else if (type === 4 || type === 9) values.push(view.getUint32(at + k * 4, little));
      else if (type === 11) values.push(view.getFloat32(at + k * 4, little));
      else if (type === 12) values.push(view.getFloat64(at + k * 8, little));
      else values.push(view.getUint8(at + k));
    }
    tags[tag] = values;
  }
  const width = tags[256][0];
  const height = tags[257][0];
  const bits = tags[258]?.[0] ?? 8;
  const compression = tags[259]?.[0] ?? 1;
  const format = tags[339]?.[0] ?? 1;
  const predictor = tags[317]?.[0] ?? 1;
  if (![1, 8, 32946].includes(compression)) throw new Error(`Unsupported TIFF compression ${compression}`);
  if (predictor !== 1) throw new Error(`Unsupported TIFF predictor ${predictor}`);
  const bytes = bits / 8;
  const readSample = (dv, offset) => {
    if (format === 3) return bits === 64 ? dv.getFloat64(offset, little) : dv.getFloat32(offset, little);
    if (bits === 8) return dv.getUint8(offset);
    if (bits === 16) return format === 2 ? dv.getInt16(offset, little) : dv.getUint16(offset, little);
    return format === 2 ? dv.getInt32(offset, little) : dv.getUint32(offset, little);
  };
  const decode = (offset, length) => {
    const raw = buffer.subarray(offset, offset + length);
    const data = compression === 1 ? raw : inflateSync(raw);
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
  };
  const values = new Float64Array(width * height);
  if (tags[322]) {
    const tw = tags[322][0];
    const th = tags[323][0];
    const across = Math.ceil(width / tw);
    tags[324].forEach((offset, index) => {
      const dv = decode(offset, tags[325][index]);
      const x0 = (index % across) * tw;
      const y0 = Math.floor(index / across) * th;
      for (let y = 0; y < th && y0 + y < height; y++) {
        for (let x = 0; x < tw && x0 + x < width; x++) {
          values[(y0 + y) * width + x0 + x] = readSample(dv, (y * tw + x) * bytes);
        }
      }
    });
  } else {
    const rowsPerStrip = tags[278]?.[0] ?? height;
    tags[273].forEach((offset, index) => {
      const dv = decode(offset, tags[279][index]);
      const start = index * rowsPerStrip * width;
      const n = Math.min(dv.byteLength / bytes, values.length - start);
      for (let k = 0; k < n; k++) values[start + k] = readSample(dv, k * bytes);
    });
  }
  const scale = tags[33550];
  const tie = tags[33922];
  if (!scale || !tie) throw new Error('GeoTIFF has no georeferencing');
  return {
    width,
    height,
    values,
    // Upper-left corner of pixel (0,0) and pixel size in degrees.
    originLon: tie[3] - tie[0] * scale[0],
    originLat: tie[4] + tie[1] * scale[1],
    pixelLon: scale[0],
    pixelLat: scale[1],
  };
}

/**
 * Turn a 0/1 visibility raster into a compact MultiPolygon: downsample to at
 * most MAX_OVERLAY_GRID cells per side (a block is visible if any cell is),
 * then merge horizontal runs into rectangles.
 */
export function visibilityRasterToGeoJson(raster, { maxGrid = MAX_OVERLAY_GRID } = {}) {
  const { width, height, values } = raster;
  const block = Math.max(1, Math.ceil(Math.max(width, height) / maxGrid));
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);
  const visible = new Uint8Array(cols * rows);
  let visibleCells = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (values[y * width + x] === 1) {
        visible[Math.floor(y / block) * cols + Math.floor(x / block)] = 1;
        visibleCells++;
      }
    }
  }
  const polygons = [];
  const dLon = raster.pixelLon * block;
  const dLat = raster.pixelLat * block;
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (!visible[r * cols + c]) { c++; continue; }
      const start = c;
      while (c < cols && visible[r * cols + c]) c++;
      const west = raster.originLon + start * dLon;
      const east = Math.min(raster.originLon + c * dLon, raster.originLon + width * raster.pixelLon);
      const north = raster.originLat - r * dLat;
      const south = Math.max(raster.originLat - (r + 1) * dLat, raster.originLat - height * raster.pixelLat);
      polygons.push([[[west, north], [east, north], [east, south], [west, south], [west, north]]]);
    }
  }
  // Approximate visible area from full-resolution cell count.
  const midLat = raster.originLat - (height * raster.pixelLat) / 2;
  const cellKm2 = (raster.pixelLon * 111.32 * Math.cos((midLat * Math.PI) / 180)) * (raster.pixelLat * 110.57);
  return {
    geojson: polygons.length
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'viewshed' }, geometry: { type: 'MultiPolygon', coordinates: polygons } }] }
      : { type: 'FeatureCollection', features: [] },
    visibleCells,
    visibleAreaKm2: Math.round(visibleCells * cellKm2 * 10) / 10,
    rectangles: polygons.length,
  };
}

// --- Public entry ------------------------------------------------------------

export function validateTerrainArgs(args) {
  const a = args && typeof args === 'object' ? args : {};
  const mode = String(a.mode || 'viewshed').toLowerCase().replace(/[\s-]+/g, '_');
  const num = (value, fallback) => (value === undefined || value === null || value === '' ? fallback : Number(value));
  const inRange = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const lat = num(a.lat);
  const lon = num(a.lon);
  if (!inRange(lat, lon)) return { ok: false, error: 'lat/lon (observer, WGS84) are required.' };
  const observerHeight = Math.max(0, Math.min(1000, num(a.observerHeight, 10)));
  if (!Number.isFinite(observerHeight)) return { ok: false, error: 'observerHeight must be a number (metres).' };
  if (mode === 'viewshed') {
    const radius = Math.max(500, Math.min(MAX_RADIUS_M, num(a.radiusM ?? a.radius, 20_000)));
    if (!Number.isFinite(radius)) return { ok: false, error: 'radiusM must be a number (metres).' };
    return { ok: true, args: { mode, lat, lon, observerHeight, radiusM: radius } };
  }
  if (mode === 'line_of_sight' || mode === 'los') {
    const targetLat = num(a.targetLat);
    const targetLon = num(a.targetLon);
    if (!inRange(targetLat, targetLon)) return { ok: false, error: 'line_of_sight needs targetLat/targetLon.' };
    if (Math.floor(targetLat) !== Math.floor(lat) || Math.floor(targetLon) !== Math.floor(lon)) {
      return { ok: false, error: 'Observer and target must fall in the same 1° elevation tile (v1 limit).' };
    }
    const targetHeight = Math.max(0, Math.min(1000, num(a.targetHeight, 2)));
    return { ok: true, args: { mode: 'line_of_sight', lat, lon, targetLat, targetLon, observerHeight, targetHeight } };
  }
  return { ok: false, error: `Unknown mode '${a.mode}'. Use viewshed or line_of_sight.` };
}

export async function analyzeTerrain(rawArgs, options = {}) {
  const env = options.env ?? process.env;
  const cli = options.cli ?? rustgisCliPath(env);
  if (!cli) throw new Error('Terrain analysis is unavailable: RUSTGIS_CLI is not configured on this server.');
  const validation = validateTerrainArgs(rawArgs);
  if (!validation.ok) throw new Error(validation.error);
  const args = validation.args;
  const cacheDir = options.cacheDir ?? terrainCacheDir(env);
  const dem = await ensureDemTile(args.lat, args.lon, { cacheDir, fetchImpl: options.fetchImpl });
  const work = await mkdtemp(path.join(cacheDir, 'run-'));
  // RustGIS names a loaded layer after its file stem.
  const demLayer = path.basename(dem, '.tif');
  const started = Date.now();
  try {
    if (args.mode === 'viewshed') {
      const out = path.join(work, 'viewshed.tif');
      const [run] = await runRustgisMcp(cli, ['--data', dem, '--yes'], [
        ['run_command', { command: 'analysis.viewshed', params: { layer: demLayer, lon: args.lon, lat: args.lat, height: args.observerHeight, radius: args.radiusM, name: 'viewshed' } }],
        ['run_command', { command: 'share.exportRaster', params: { layer: 'viewshed', path: out } }],
      ], { cwd: work });
      const overlay = visibilityRasterToGeoJson(readGeoTiff(await readFile(out)));
      return {
        summary: {
          mode: 'viewshed',
          observer: { lat: args.lat, lon: args.lon, heightM: args.observerHeight },
          radiusKm: args.radiusM / 1000,
          visibleAreaKm2: overlay.visibleAreaKm2,
          visibleCells: run?.result?.visibleCells ?? overlay.visibleCells,
          dem: 'Copernicus GLO-90 (90 m)',
          engine: 'RustGIS',
          elapsedMs: Date.now() - started,
          note: 'Surface model (DSM): tree canopy and large buildings count as obstacles; no earth-curvature/refraction correction stated by RustGIS; clipped at the 1° tile edge.',
        },
        overlay: overlay.geojson,
      };
    }
    const out = path.join(work, 'los.geojson');
    const [run] = await runRustgisMcp(cli, ['--data', dem, '--yes'], [
      ['run_command', { command: 'analysis.lineOfSight', params: { layer: demLayer, from: [args.lon, args.lat], to: [args.targetLon, args.targetLat], observerHeight: args.observerHeight, targetHeight: args.targetHeight, name: 'los' } }],
      ['run_command', { command: 'share.exportLayer', params: { layer: 'los', path: out } }],
    ], { cwd: work });
    const geojson = JSON.parse(await readFile(out, 'utf8'));
    const profile = Array.isArray(run?.result?.profile) ? run.result.profile : [];
    const firstBlocked = profile.find(sample => sample.visible === false);
    const targetVisible = profile.length ? profile[profile.length - 1].visible === true : null;
    for (const feature of geojson.features ?? []) feature.properties = { ...feature.properties, kind: 'los' };
    return {
      summary: {
        mode: 'line_of_sight',
        observer: { lat: args.lat, lon: args.lon, heightM: args.observerHeight },
        target: { lat: args.targetLat, lon: args.targetLon, heightM: args.targetHeight },
        targetVisible,
        firstBlockedAtKm: firstBlocked ? Math.round(firstBlocked.distance / 100) / 10 : null,
        visibleSegments: (geojson.features ?? []).filter(f => f.properties?.visible).length,
        totalSegments: (geojson.features ?? []).length,
        dem: 'Copernicus GLO-90 (90 m)',
        engine: 'RustGIS',
        elapsedMs: Date.now() - started,
      },
      overlay: geojson,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
