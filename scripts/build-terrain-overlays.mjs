#!/usr/bin/env node
/**
 * Precompute the static terrain overlays that missions show on web, where
 * RustGIS cannot run. Each entry is a real RustGIS viewshed over Copernicus
 * GLO-90, written to public/data/terrain/<id>.json as { summary, overlay }.
 *
 * Run: RUSTGIS_CLI=/path/rustgis-cli node scripts/build-terrain-overlays.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTerrain } from '../src-tauri/sidecar/rustgis-terrain.mjs';

const OVERLAYS = [
  {
    id: 'znpp-viewshed',
    label: 'Zaporizhzhia NPP, 30 m mast',
    args: { lat: 47.5119, lon: 34.5856, observerHeight: 30, radiusM: 20000 },
  },
];

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'terrain');
await mkdir(outDir, { recursive: true });
for (const entry of OVERLAYS) {
  const { summary, overlay } = await analyzeTerrain(entry.args);
  const { elapsedMs: _elapsed, ...stable } = summary;
  const file = path.join(outDir, `${entry.id}.json`);
  await writeFile(file, JSON.stringify({ id: entry.id, label: entry.label, summary: stable, overlay }));
  console.log(`${entry.id}: ${stable.visibleAreaKm2} km² visible -> ${path.relative(process.cwd(), file)}`);
}
