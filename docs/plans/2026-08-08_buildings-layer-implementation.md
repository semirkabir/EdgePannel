# 3D Buildings Layer — Implementation Plan (S2)

> **For Hermes:** Use subagent-driven-development to implement task-by-task, or execute directly.

**Goal:** Add a toggleable global 3D buildings layer (`buildings`) to EdgePannel's flat map, using the same OpenFreeMap tiles the dashboard already relies on. Spike S1+S3 VALIDATED — 99–100% height coverage in NYC/Berlin/Tokyo/Nairobi.

**Architecture:** Maplibre-native `fill-extrusion` layer on an explicitly-added vector source (`https://tiles.openfreemap.org/planet`, the TileJSON URL). Own source is required because the dashboard's default themes (Carto/custom Obsidian, satellite) do NOT carry an `openmaptiles` source — only OpenFreeMap styles do. Visibility driven by a new `MapLayers.buildings` boolean through the existing `state.layers` → `isLayerVisible()` gating, exactly like the globe-native layer pattern (`syncGlobeNativeLayers`).

**Tech Stack:** maplibre-gl 5.16 (already a dependency), TypeScript, no new deps, no new data feeds.

---

## Task 1: Add `buildings` to the MapLayers interface

**Files:** Modify `src/types/index.ts:606-688` — add after `gdeltEvents` (line 687):

```ts
  // GDELT 2.0 Event Database — structured CAMEO events
  gdeltEvents: boolean;
  // Global 3D building footprints (OSM heights via OpenFreeMap)
  buildings: boolean;
```

`LAYER_REGISTRY` is typed `Record<keyof MapLayers, LayerDefinition>` — tsc will force the registry entry (Task 2) before anything compiles.

## Task 2: Register the layer

**Files:** Modify `src/config/map-layer-definitions.ts`

**2a. New category.** `LayerCategory` union (line 13-24), `LAYER_CATEGORY_ORDER` (line 27), `LAYER_CATEGORY_LABELS` (line 42): add `'urban'` → order slot after `'technology'`, label `'Urban & Infrastructure'`.

**2b. Registry entry** (append near line 319, after `commodityPorts`):

```ts
  // Urban & Infrastructure
  buildings: def('buildings', ICONS.building, 'buildings3d', '3D Buildings', 'urban',
    { light: '#64748b', dark: '#94a3b8' }, ['full', 'tech', 'finance', 'commodity', 'conflicts', 'happy'],
    { renderers: ['flat'], minZoom: 13 }),
```

- `renderers: ['flat']` — globe skips extrusion (fill-extrusion on maplibre globe unverified; gate in Task 5).
- `minZoom: 13` — `isLayerVisible()` (DeckGLMap.ts:1468) already hides the toggle below this zoom, matching spike behavior.

## Task 3: Layer defaults — ALL MapLayers literals

**Files:** Modify `src/config/panels.ts` — `BASE_LAYERS` (line 17, after `gdeltEvents: false, satellite: false,` line 37) plus EVERY variant block that spreads from it: `FULL_MAP_LAYERS` (122), `FULL_MOBILE_MAP_LAYERS` (141), `TECH_MAP_LAYERS` (192), `FINANCE_MAP_LAYERS` (260), `FINANCE_MOBILE_MAP_LAYERS` (270), `HAPPY_MAP_LAYERS` (296), `COMMODITY_MAP_LAYERS` (341), `COMMODITY_MOBILE_MAP_LAYERS` (351), `CONFLICTS_MAP_LAYERS` (396), `CONFLICTS_MOBILE_MAP_LAYERS` (409).

Add `buildings: false` to each (or `true` for `full` if the user wants it default-on — decision point below).

**Files:** Modify `src/e2e/map-harness.ts` — `allLayersEnabled` (161): `buildings: true`; `allLayersDisabled` (224): `buildings: false`.

**Pitfall:** any missed literal → `tsc` error "Property 'buildings' is missing". Grep for `MapLayers` literals, don't trust the old 12-file list — defaults centralized in `panels.ts` (codebase evolved since the skill checklist was written).

## Task 4: Commands + i18n

**Files:** Modify `src/config/commands.ts` — add to `COMMANDS` (near line 56, after other `layer:` toggles):

```ts
{ id: 'layer:buildings', keywords: ['buildings', '3d', 'city', 'urban', 'extrusion'], label: 'Toggle 3D buildings', icon: '🏙️', category: 'layers' },
```

No `LAYER_KEY_MAP` entry needed (suffix `buildings` == key). Optional: add `'buildings'` to `LAYER_PRESETS.infra` (line 16).

**Files:** Modify `src/locales/en.json` — under `components` layer labels (~line 1136, next to `dayNight`): `"buildings3d": "3D Buildings"`. (Other 20 locales fall back to `fallbackLabel`.)

## Task 5: Flat-map rendering (DeckGLMap.ts)

**Files:** Modify `src/components/DeckGLMap.ts`

**5a. New source + layer sync** — mirror `syncGlobeNativeLayers()` (line 1882) / `ensureGlobeNativeLayerStyles()` (line 1915):

```ts
private syncBuildingsLayer(): void {
  const map = this.maplibreMap;
  if (!map || !map.isStyleLoaded()) return;
  if (this._globeProjection) { this.removeBuildingsLayer(); return; } // globe: skip extrusion
  if (!map.getSource('wm-buildings')) {
    map.addSource('wm-buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  }
  if (!map.getLayer('wm-buildings-3d')) {
    map.addLayer({
      id: 'wm-buildings-3d',
      type: 'fill-extrusion',
      source: 'wm-buildings',
      'source-layer': 'building',
      minzoom: 13,
      filter: ['all', ['!=', ['get', 'hide_3d'], true]],
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'],
          0, '#3b4a5a', 15, '#4b5f75', 35, '#5f7a96', 70, '#7a9cbb', 120, '#9fc0dd'],
        'fill-extrusion-height': ['get', 'render_height'],
        'fill-extrusion-base': ['get', 'render_min_height'],
        'fill-extrusion-opacity': 0.85,
      },
    } as maplibregl.LayerSpecification);
  }
  const visible = !!this.state.layers.buildings && this.isLayerVisible('buildings');
  map.setLayoutProperty('wm-buildings-3d', 'visibility', visible ? 'visible' : 'none');
}

private removeBuildingsLayer(): void {
  const map = this.maplibreMap;
  if (!map) return;
  if (map.getLayer('wm-buildings-3d')) map.removeLayer('wm-buildings-3d');
  if (map.getSource('wm-buildings')) map.removeSource('wm-buildings');
}
```

**5b. Call sites** — every place globe native layers sync on style reload:
- `syncGlobeNativeLayers()` (line 1900 area) — add `this.syncBuildingsLayer()` alongside `this.ensureGlobeNativeLayerStyles()`.
- `switchToFallbackStyle` style.load handler (line 9327) — after `this.syncGlobeNativeLayers()`.
- Main `style.load` handler (line 9259) — verify it also calls the sync (add if missing).
- `reloadBasemap()` (line 9340) — the style.load callback must re-invoke.
- Teardown: line 9427 `removeGlobeNativeLayers()` area — also `this.removeBuildingsLayer()` on flat→globe transitions (handled by the `_globeProjection` guard in 5a).

**5c. Layer tray visibility** — `map-layer-tray.ts` and the deck layer list derive from `LAYER_REGISTRY`, so no manual UI wiring needed (verified: tray reads `getLayerCategory` per registry key). The toggle updates `state.layers.buildings` via existing EventHandler paths, which triggers re-render → `syncBuildingsLayer()` picks it up.

## Task 6: Verify

1. `npx tsc --noEmit --skipLibCheck -p tsconfig.json 2>&1 | grep "error TS" | head -20` — clean (background, project is slow).
2. Restart dev server (kill ports 3000/3001 first): `npm run dev`.
3. Browser: open full variant → toggle **3D Buildings** in layer tray → fly to NYC z15 → expect extruded buildings.
4. Ground truth: `queryRenderedFeatures({ layers: ['wm-buildings-3d'] })` count > 0; console free of maplibre source errors.
5. Cross-theme: switch basemap to Obsidian/CartoSat/Sat Photo — extrusion persists (own source).
6. Cross-variant smoke: `npm run dev:conflicts` — toggle present, renders.
7. Screenshot NYC + one non-US city (Berlin) → `spikes/geolibre-buildings/shots/` comparison.

## Risks / tradeoffs / open questions

- **Globe view:** fill-extrusion on maplibre globe projection unverified — plan hides the layer on globe (`renderers: ['flat']` + `_globeProjection` guard). Verify during Task 6; if it renders, enable globe too.
- **Tile load:** OpenFreeMap `planet` TileJSON (dated snapshot) is the same source the dashboard already falls back to; the URL is versioned server-side via TileJSON, so no manual snapshot pinning.
- **Default state:** all variants `false` (matches every existing layer's default; user opts in). Say the word if `full` should ship with it on.
- **Perf:** one extra vector tile source only at z13+; negligible vs. existing 45 layers.
- **Skill staleness:** worldmonitor-development skill's "~12 init files under variants/" checklist is outdated — defaults now centralized in `panels.ts`. Patch the skill after implementation.
