import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const apiDir = join(root, 'api');

// All .js files in api/ except underscore-prefixed helpers (_cors.js, _api-key.js)
const edgeFunctions = readdirSync(apiDir)
  .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
  .map((f) => ({ name: f, path: join(apiDir, f) }));

// ALL .js files in api/ (including helpers) — used for node: built-in checks
const allApiFiles = readdirSync(apiDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, path: join(apiDir, f) }));

describe('Edge Function shared helpers resolve', () => {
  it('_rss-allowed-domains.js re-exports shared domain list', async () => {
    const mod = await import(join(apiDir, '_rss-allowed-domains.js'));
    const domains = mod.default;
    assert.ok(Array.isArray(domains), 'Expected default export to be an array');
    assert.ok(domains.length > 200, `Expected 200+ domains, got ${domains.length}`);
    assert.ok(domains.includes('feeds.bbci.co.uk'), 'Expected BBC feed domain in list');
  });
});

describe('Edge Function no node: built-ins', () => {
  // Routes that explicitly opt into the Node.js runtime may use node: built-ins.
  const isNodeRuntime = (src) => /runtime:\s*['"]nodejs['"]/.test(src);
  for (const { name, path } of allApiFiles) {
    it(`${name} does not import node: built-ins (unsupported in Vercel Edge Runtime)`, () => {
      const src = readFileSync(path, 'utf-8');
      if (isNodeRuntime(src)) return;
      const match = src.match(/from\s+['"]node:(\w+)['"]/);
      assert.ok(
        !match,
        `${name}: imports node:${match?.[1]} — Vercel Edge Runtime does not support node: built-in modules. Use an edge-compatible alternative.`,
      );
    });
  }
});

describe('Edge Function module isolation', () => {
  for (const { name, path } of edgeFunctions) {
    it(`${name} does not import from ../server/ (Edge Functions cannot resolve cross-directory TS)`, () => {
      const src = readFileSync(path, 'utf-8');
      assert.ok(
        !src.includes("from '../server/"),
        `${name}: imports from ../server/ — Vercel Edge Functions cannot resolve cross-directory TS imports. Inline the code or move to a same-directory .js helper.`,
      );
    });

    it(`${name} does not import from ../src/ (Edge Functions cannot resolve TS aliases)`, () => {
      const src = readFileSync(path, 'utf-8');
      assert.ok(
        !src.includes("from '../src/"),
        `${name}: imports from ../src/ — Vercel Edge Functions cannot resolve @/ aliases or cross-directory TS. Inline the code instead.`,
      );
    });
  }
});
