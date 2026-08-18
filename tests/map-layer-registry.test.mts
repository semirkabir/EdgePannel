import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

/**
 * Guard test for `src/config/map-layer-definitions.ts`'s consolidated
 * `LayerDefinition` registry (see the map-layers plan). Two jobs:
 *
 * 1. Catch the exact bug that motivated this file — a layer registered but
 *    missing from every variant's picker (`gdeltEvents` was silently
 *    unreachable for months). See "every key belongs to a variant" below.
 * 2. Prove the Phase 1 registry consolidation was behavior-preserving except
 *    for its one deliberate fix (15 layers that used to silently fall
 *    through to a grey default color now have an assigned accent) — see the
 *    golden-snapshot describe block.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadRegistry() {
  const sourcePath = resolve(__dirname, '..', 'src', 'config', 'map-layer-definitions.ts');
  const source = readFileSync(sourcePath, 'utf-8');
  // isDesktopRuntime is the only runtime (non-type-only) import in this
  // module; stub it the same way map-locale.test.mts stubs getCurrentLanguage,
  // so this file can be transformed and imported standalone.
  const patched = source.replace(
    "import { isDesktopRuntime } from '@/services/runtime';",
    'const isDesktopRuntime = () => false;',
  );
  const transformed = transformSync(patched, {
    loader: 'ts',
    format: 'esm',
    target: 'es2020',
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`;
  return import(dataUrl);
}

const {
  LAYER_REGISTRY,
  LAYER_CATEGORY_ORDER,
  getVariantAllowedLayerKeys,
  resolveLayerAccentColor,
} = await loadRegistry();

const ALL_VARIANTS = ['full', 'tech', 'finance', 'happy', 'commodity', 'conflicts'];
const HEX_RE = /^#[0-9a-f]{6}$/i;

function readJsonLocaleLayerKeys(): Set<string> {
  const en = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'locales', 'en.json'), 'utf-8'));
  return new Set(Object.keys(en.components?.deckgl?.layers ?? {}));
}

/** DataSourceId union, regexed out of data-freshness.ts rather than imported —
 *  that module pulls in far more than this test needs to patch. */
function readDataSourceIds(): Set<string> {
  const src = readFileSync(resolve(__dirname, '..', 'src', 'services', 'data-freshness.ts'), 'utf-8');
  const match = src.match(/export type DataSourceId =([\s\S]*?);/);
  assert.ok(match, 'could not find DataSourceId union in data-freshness.ts');
  return new Set([...match![1].matchAll(/'([\w-]+)'/g)].map(m => m[1]));
}

const registryKeys = Object.keys(LAYER_REGISTRY);

describe('LAYER_REGISTRY — structural invariants', () => {
  it('has exactly 64 layers (bump this deliberately per rollout batch)', () => {
    assert.equal(registryKeys.length, 64);
  });

  it('every definition has the required fields, well-formed', () => {
    for (const key of registryKeys) {
      const def = LAYER_REGISTRY[key];
      assert.ok(def.category, `${key}: missing category`);
      assert.ok(def.renderers?.length > 0, `${key}: empty renderers`);
      assert.ok(def.i18nSuffix, `${key}: missing i18nSuffix`);
      assert.ok(def.fallbackLabel, `${key}: missing fallbackLabel`);
      assert.ok(def.color, `${key}: missing color`);
      assert.match(def.color.light, HEX_RE, `${key}: color.light not a hex string`);
      assert.match(def.color.dark, HEX_RE, `${key}: color.dark not a hex string`);
      assert.ok(Array.isArray(def.variants) && def.variants.length > 0, `${key}: empty variants`);
    }
  });

  it('every category is a member of LAYER_CATEGORY_ORDER', () => {
    // Category type and display-order array are declared separately; this
    // catches a category added to one but not the other.
    const orderSet = new Set(LAYER_CATEGORY_ORDER);
    for (const key of registryKeys) {
      const cat = LAYER_REGISTRY[key].category;
      assert.ok(orderSet.has(cat), `${key}: category "${cat}" missing from LAYER_CATEGORY_ORDER`);
    }
  });

  it('every layer belongs to at least one variant (the gdeltEvents-class bug)', () => {
    for (const key of registryKeys) {
      const def = LAYER_REGISTRY[key];
      assert.ok(def.variants.length > 0, `${key}: not in any variant — unreachable in every picker`);
    }
  });

  it("exactly 36 layers declare 'svg' support (Phase 2 audit of Map.ts's real render code)", () => {
    // This count is a deliberate, hand-verified constant — a layer only gets
    // 'svg' if it has confirmed working render code in Map.ts (grep for
    // `this.state.layers.<key>` there before adding one). Bumping this without
    // that check re-introduces the exact bug Phase 2 fixed: 9 layers
    // (including all 5 of the happy variant's) were declared togglable in the
    // SVG picker with zero corresponding render code — dead toggles.
    const svgKeys = registryKeys.filter(key => LAYER_REGISTRY[key].renderers.includes('svg'));
    assert.equal(svgKeys.length, 36);
  });

  it("LayerDefinition.variants agrees with the private VARIANT_LAYER_ORDER, for every variant", () => {
    for (const variant of ALL_VARIANTS) {
      const allowed = getVariantAllowedLayerKeys(variant);
      for (const key of registryKeys) {
        const def = LAYER_REGISTRY[key];
        const declaresVariant = def.variants.includes(variant);
        const inOrderTable = allowed.has(key);
        assert.equal(
          declaresVariant, inOrderTable,
          `${key}: variants field says ${declaresVariant} for "${variant}", VARIANT_LAYER_ORDER says ${inOrderTable}`,
        );
      }
    }
  });

  it('every sources entry is a valid DataSourceId', () => {
    const validIds = readDataSourceIds();
    assert.ok(validIds.size > 0, 'failed to parse DataSourceId union');
    for (const key of registryKeys) {
      const sources = LAYER_REGISTRY[key].sources;
      if (!sources) continue;
      for (const id of sources) {
        assert.ok(validIds.has(id), `${key}: "${id}" is not a valid DataSourceId`);
      }
    }
  });

  it('every i18nSuffix resolves in en.json (or the fallback label is used instead)', () => {
    const localeKeys = readJsonLocaleLayerKeys();
    const missing = registryKeys.filter(key => !localeKeys.has(LAYER_REGISTRY[key].i18nSuffix));
    assert.deepEqual(missing, [], `layers missing an en.json label (falls back to fallbackLabel): ${missing.join(', ')}`);
  });

  it('resolveLayerAccentColor never falls through to the unassigned-grey default', () => {
    // #a1a1aa/#475569 is the function's own "no color found" fallback: a real
    // color assignment that happens to equal it is fine, an unassigned one is not.
    for (const key of registryKeys) {
      const def = LAYER_REGISTRY[key];
      assert.equal(resolveLayerAccentColor(key, 'light'), def.color.light, `${key}: light color mismatch`);
      assert.equal(resolveLayerAccentColor(key, 'dark'), def.color.dark, `${key}: dark color mismatch`);
    }
  });
});

describe('LAYER_REGISTRY — golden snapshot vs. pre-Phase-1 state', () => {
  const fixture = JSON.parse(
    readFileSync(resolve(__dirname, 'fixtures', 'layer-registry.snapshot.json'), 'utf-8'),
  );

  it('fixture covers exactly the same 64 keys as the live registry', () => {
    assert.deepEqual([...registryKeys].sort(), Object.keys(fixture).sort());
  });

  it('category, variants, sources, and zoom gating are unchanged for every layer', () => {
    for (const key of registryKeys) {
      const def = LAYER_REGISTRY[key];
      const snap = fixture[key];
      assert.equal(def.category, snap.category, `${key}: category changed`);
      assert.deepEqual([...def.variants].sort(), snap.variants, `${key}: variants changed`);
      assert.deepEqual(
        def.sources ? [...def.sources].sort() : null,
        snap.sources,
        `${key}: sources changed`,
      );
      assert.equal(def.minZoom ?? null, snap.minZoom, `${key}: minZoom changed`);
      assert.equal(def.labelZoom ?? null, snap.labelZoom, `${key}: labelZoom changed`);
    }
  });

  it('color is unchanged for every layer EXCEPT the 15 that were silently grey before', () => {
    const unexpectedColorChanges: string[] = [];
    let greyFixCount = 0;
    for (const key of registryKeys) {
      const def = LAYER_REGISTRY[key];
      const snap = fixture[key];
      const colorMatches = def.color.light === snap.color.light && def.color.dark === snap.color.dark;
      if (colorMatches) continue;
      if (snap.wasGreyFallback) {
        greyFixCount++; // expected: this key's color intentionally moved off grey
      } else {
        unexpectedColorChanges.push(key);
      }
    }
    assert.deepEqual(unexpectedColorChanges, [], 'layers with unexpected color changes');
    assert.equal(greyFixCount, 15, 'expected exactly the 15 known grey-fallback layers to have new colors');
  });

  it('the 15 grey-fallback layers actually have a real, non-grey color now', () => {
    for (const key of registryKeys) {
      if (!fixture[key].wasGreyFallback) continue;
      const def = LAYER_REGISTRY[key];
      assert.notEqual(def.color.light, '#475569', `${key}: still grey (light)`);
      assert.notEqual(def.color.dark, '#a1a1aa', `${key}: still grey (dark)`);
    }
  });
});
