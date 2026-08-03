# Map Toolbar Consolidation Plan

**Status (2026-08-02): Phase A shipped in part.** `.map-toolbar` row, Layers, Draw, and Map Type (theme picker + 2D/3D) are live — relocated, not duplicated, verified in a running dev server. Jump, Locate, Track, Intel, and the unified Sat-Photo/Time button are still open (net-new features / real design work, not simple relocation — see "Open Questions" below, which is now also a punch list for Phase B).

## Overview

SitDeck's Ops Center puts one toolbar row directly above the map canvas: `Layers · Draw · Jump · Locate · Track · Intel` on the left, `Sat Photo · Time · Map Type` on the right. World Monitor has most of the underlying functionality already, but it's scattered across a page-header row, a floating in-canvas overlay, and a separate page-header playback control — there is no single toolbar row. This plan consolidates existing controls into that shape and identifies the genuinely new features needed to match.

Reference screenshot (user-annotated, SitDeck Ops Center, 2026-08-02): toolbar row sits between `.panel-header` and the map canvas, spanning the full map width. Related survey: [[project_sitdeck_integration]] (memory).

## Current State (as of 2026-08-02)

- **Row above the map today**: `.panel-header` in `src/app/panel-layout.ts:464-484` — brand logo, `#headerClock`, and `.map-header-actions` (2D/3D dimension toggle `#mapDimensionToggle`, fullscreen, pin/detach). No layers/draw/jump/locate/track/intel here.
- **One map engine, not two**: despite CLAUDE.md describing "Maplibre+deck.gl" and "globe.gl+Three.js" as separate engines, the 3D globe is MapLibre's native `setProjection({type:'globe'})` on the *same* `DeckGLMap` instance (`DeckGLMap.ts:8927-8988`). `globe.gl` is only used for the decorative marketing globe (`src/landing/globe.ts`). There's also a legacy SVG/D3 fallback, `src/components/Map.ts`, used on mobile/low-memory ([[feedback_map_consistency]] applies: any toolbar change must work in both `DeckGLMap` projection modes, and degrade sanely in the SVG fallback).
- **Layers** — exists, wrong location. `layersToggleBtn` (`DeckGLMap.ts:5942-5949`) already has the count badge SitDeck shows (`getCategorizedLayersForVariant` → `createLayerToggles`, line 6248). It's a floating overlay (`layersRow`) inside the canvas, not a toolbar button. SVG-fallback parity via `map-layer-tray.ts` (`createSvgLayerToggles`).
- **Draw** — exists, wrong shape. `MapDrawController` (`src/components/map-draw/MapDrawController.ts`) supports `distance | circle | rangeRings | sector | polygon | rectangle | bearing`. Its `buildToolbar()` (line 476) is a floating 2-column text-button grid, bottom-left, instantiated only from `DeckGLMap.ensureDrawController()` (line 5779). No corridor/path or standalone arrow tool yet. Absent entirely from `Map.ts` (SVG fallback) — a pre-existing 2D/3D-consistency gap already logged in [[project_sitdeck_integration]].
- **Jump** — missing as a dedicated control. Closest analog: Cmd+K `SearchManager` (`src/app/search-manager.ts`) indexes countries/entities/satellites and calls `flyTo`/`jumpTo`; a region `<select>` also exists in the map controls overlay. No lightweight "go to coordinates/place" toolbar button.
- **Locate** — geolocation exists but isn't map-facing. `resolvePreciseUserCoordinates()` in `src/utils/user-location.ts:112` wraps `navigator.geolocation`, but it's used for regional defaults/personalization, not a "recenter map on me" action.
- **Track** — missing. AIS trail history (`aisTrackHistory`, `DeckGLMap.ts:7354-7358`) renders past-position trails but there's no user-initiated "follow this entity" mode (camera-lock on a vessel/aircraft/satellite as it updates).
- **Sat Photo** — basemap style switching exists (`.map-theme-picker`, `DeckGLMap.ts:5831-5843`, driven by `src/config/basemap.ts` `UNIFIED_THEME_OPTIONS`), but no entry in that list is a satellite-imagery basemap today — needs confirming/adding.
- **Time** — exists twice, inconsistently placed. `createTimeSlider()` (`DeckGLMap.ts:5915-5933`) is a live-filtering time-range control inside the canvas overlay. `PlaybackControl.ts` (491 lines) is a separate *historical snapshot scrubber* mounted in the page header (`src/app/event-handlers.ts:1088-1106`), far from the map. SitDeck's single "Time" button in the toolbar suggests these two should be reachable from one place, not necessarily merged in logic.
- **Map Type** — `#mapDimensionToggle` (2D/3D) lives in `.panel-header` today; `.map-theme-picker` (basemap style) lives in the canvas overlay. SitDeck treats these as one "map type" control on the right.
- **Intel** — no map-adjacent entry point. Conceptually maps to `SituationReportPanel.ts`, `src/app/country-intel/`, `src/app/entity-intel.ts`, `CountryDeepDivePanel.ts`, `GdeltIntelPanel.ts`, `TelegramIntelPanel.ts`, `AnalystWorkbenchPanel.ts` — all separate side-panel/modal features today.

## Proposed Toolbar

A new `.map-toolbar` row, rendered between `.panel-header` and `#mapContainer` in `panel-layout.ts`, full map width, matching the reference screenshot's two button groups:

**Left (action) group** — `Layers · Draw · Jump · Locate · Track · Intel`
- `Layers`, `Draw`: re-parent existing buttons/entry-points from the floating canvas overlay into the toolbar. Underlying panels (`layersRow` tray, `MapDrawController.buildToolbar()`) stay as-is, opened as flyouts anchored to the toolbar button instead of floating fixed-position elements.
- `Jump`: new lightweight input (place name or `lat,lon`) reusing `SearchManager`'s existing geocoding/flyTo plumbing, scoped to map targets only (skip news/entity results).
- `Locate`: new button wiring `resolvePreciseUserCoordinates()` to a map recenter + "you are here" marker, with the existing permission-prompt UX from `user-location.ts`.
- `Track`: new feature — click an entity (vessel/aircraft/satellite marker) then "Track" locks the camera to follow it as position updates arrive; needs new state (`trackedEntityId`) and a per-frame `flyTo`/`panTo` in the existing update loop, plus a visible "stop tracking" affordance.
- `Intel`: new dropdown surfacing the existing intel panels (Situation Report, Country Deep Dive, Entity Intel) scoped to whatever is currently selected/clicked on the map, rather than requiring the user to already know which side panel to open.

**Right (view) group** — `Sat Photo · Time · Map Type`
- `Sat Photo`: confirm/add a satellite-imagery entry to `UNIFIED_THEME_OPTIONS` in `basemap.ts` if missing; expose as a one-click toggle rather than buried in the full theme picker.
- `Time`: single entry point that opens either the live time-range slider or the historical `PlaybackControl` scrubber (tabbed or mode-switched), so both concepts live behind one map-adjacent button instead of one being stuck in the page header.
- `Map Type`: merge `#mapDimensionToggle` (2D/3D) and `.map-theme-picker` (basemap style) into one control matching SitDeck's single map-type button.

## Migration Strategy

- **Phase A (re-parent, no logic change)**: move Layers, Draw-entry, basemap picker, and 2D/3D toggle into the new `.map-toolbar` row. Existing panels/controllers keep their current behavior; only the trigger button's location and the flyout anchor change.
- **Phase B (net-new)**: Jump, Locate, Track, Intel-quick-access, Sat Photo basemap entry, and the merged Time button.
- Per CLAUDE.md automation rules: since this touches `src/components/` and `src/app/`, run the `variant-impact-checker` subagent before and after implementation to confirm which of the 6 variants (full/tech/finance/happy/commodity/conflicts) should show the full toolbar vs. a trimmed set.
- Per [[feedback_map_consistency]]: every control must behave sensibly in both `DeckGLMap` projection modes (2D flat / 3D globe) and degrade explicitly (not silently) in the SVG fallback `Map.ts` where Draw and Track are unlikely to be portable.

## Open Questions

- Should `Track` follow the entity across the *live* map only, or also drive `PlaybackControl`'s historical scrubber (i.e. "show me where this vessel was")?
- Does `Jump` need reverse-geocoding (click map → place name) in addition to forward search?
- Is the SVG fallback (`Map.ts`) worth building a reduced toolbar for, or should it keep its current separate `map-layer-tray.ts` pattern and simply omit Draw/Track/Sat-Photo?
