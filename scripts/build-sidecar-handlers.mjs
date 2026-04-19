/**
 * Compiles TypeScript API handler files (api/**\/[rpc].ts) into self-contained
 * ESM bundles (.js) so the Tauri sidecar's buildRouteTable() can discover and
 * load them at runtime.
 *
 * Run: node scripts/build-sidecar-handlers.mjs
 * Or:  npm run build:desktop  (runs this as part of the full desktop build)
 *
 * Only files named [rpc].ts are compiled; helper/data files (e.g. city-coords.ts)
 * are bundled transitively and do not produce their own output.
 */

import { build } from 'esbuild';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const apiDir = path.join(projectRoot, 'api');

/** Recursively collect all files matching a predicate. */
async function walk(dir, predicate) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(full, predicate)));
    } else if (predicate(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Only compile files whose basename is exactly "[rpc].ts".
 * These are the domain gateway entry points that the sidecar loads as routes.
 * Other .ts files (e.g. city-coords.ts) are helpers bundled transitively.
 */
const entryPoints = await walk(apiDir, (name) => name === '[rpc].ts');

if (entryPoints.length === 0) {
  console.log('build:sidecar-handlers  no [rpc].ts files found — nothing to compile');
  process.exit(0);
}

let totalSize = 0;
let failed = 0;

await Promise.all(
  entryPoints.map(async (entryPoint) => {
    const outfile = entryPoint.replace(/\.ts$/, '.js');
    try {
      await build({
        entryPoints: [entryPoint],
        outfile,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node18',
        treeShaking: true,
        // Silence the "config" export warning from Vercel edge runtime exports
        logLevel: 'error',
      });

      const { size } = await stat(outfile);
      totalSize += size;
      const rel = path.relative(projectRoot, outfile).replace(/\\/g, '/');
      const sizeKB = (size / 1024).toFixed(1);
      console.log(`build:sidecar-handlers  ${rel}  ${sizeKB} KB`);
    } catch (err) {
      const rel = path.relative(projectRoot, entryPoint).replace(/\\/g, '/');
      console.error(`build:sidecar-handlers  FAILED  ${rel}: ${err.message}`);
      failed++;
    }
  }),
);

const totalKB = (totalSize / 1024).toFixed(1);
console.log(`build:sidecar-handlers  done — ${entryPoints.length} handlers, ${totalKB} KB total`);

if (failed > 0) {
  console.error(`build:sidecar-handlers  ${failed} handler(s) failed to compile`);
  process.exit(1);
}
