#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const FILE_BUDGETS = [
  ['src/app/data-loader.ts', 2400],
  ['src/app/panel-layout.ts', 2400],
  ['src/app/event-handlers.ts', 1850],
  ['src/components/MapPopup.ts', 2800],
  ['src/components/Map.ts', 4400],
  ['src/components/DeckGLMap.ts', 9400],
  ['src/components/GlobeMap.ts', 2650],
];

const ARTIFACT_BUDGETS = {
  jsChunkBytes: 2_100_000,
  cssChunkBytes: 850_000,
  totalAssetsBytes: 43_000_000,
  precacheBytes: 18_000_000,
};

const failures = [];

for (const [file, budget] of FILE_BUDGETS) {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  const lineCount = source.split(/\r?\n/).length;

  if (lineCount > budget) {
    failures.push(`${file}: ${lineCount} lines exceeds budget ${budget}`);
  } else {
    console.log(`${file}: ${lineCount}/${budget}`);
  }
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

async function checkArtifactBudgets() {
  const distDir = path.join(ROOT, 'dist');
  try { await stat(distDir); } catch {
    console.log('dist not found; skipping artifact budget checks. Run after npm run build for bundle budgets.');
    return;
  }

  const files = await collectFiles(distDir);
  let totalAssetsBytes = 0;
  let precacheBytes = 0;

  for (const file of files) {
    const { size } = await stat(file);
    const relative = path.relative(distDir, file).replace(/\\/g, '/');
    if (relative.endsWith('.br')) continue;
    totalAssetsBytes += size;
    if (/^(assets\/|favico\/|offline\.html$|.*\.(?:js|css|woff2|png|svg|ico)$)/.test(relative)) {
      precacheBytes += size;
    }
    if (/\.js$/.test(file) && size > ARTIFACT_BUDGETS.jsChunkBytes) {
      failures.push(`${relative}: ${size} bytes exceeds JS chunk budget ${ARTIFACT_BUDGETS.jsChunkBytes}`);
    }
    if (/\.css$/.test(file) && size > ARTIFACT_BUDGETS.cssChunkBytes) {
      failures.push(`${relative}: ${size} bytes exceeds CSS chunk budget ${ARTIFACT_BUDGETS.cssChunkBytes}`);
    }
  }

  if (totalAssetsBytes > ARTIFACT_BUDGETS.totalAssetsBytes) {
    failures.push(`dist total: ${totalAssetsBytes} bytes exceeds budget ${ARTIFACT_BUDGETS.totalAssetsBytes}`);
  }
  if (precacheBytes > ARTIFACT_BUDGETS.precacheBytes) {
    failures.push(`estimated precache: ${precacheBytes} bytes exceeds budget ${ARTIFACT_BUDGETS.precacheBytes}`);
  }

  console.log(`dist total: ${totalAssetsBytes}/${ARTIFACT_BUDGETS.totalAssetsBytes}`);
  console.log(`estimated precache: ${precacheBytes}/${ARTIFACT_BUDGETS.precacheBytes}`);
}

await checkArtifactBudgets();

if (failures.length > 0) {
  console.error('File budget guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('File budget guard passed.');
