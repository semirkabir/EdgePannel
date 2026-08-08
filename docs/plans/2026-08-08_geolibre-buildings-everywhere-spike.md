# GeoLibre "Buildings Everywhere" Spike — Implementation Plan

> **Goal:** Validate whether EdgePannel can show Google/Apple-level building data (footprints + heights) *globally*, cheaply, before committing to a real build.

## Context

The NYC `.geolibre.json` file's wow layer is `Manhattan Building Heights` — municipal LiDAR-grade data (`height_roof`, `construction_year`, `era`, `bin`). That grade only exists for select cities. Global reality:

- **Footprints everywhere:** Overture (~2.6B) / OSM via OpenFreeMap — which is **already the dashboard's basemap tile source** (its style has a `building` layer at minzoom 12).
- **Heights:** only where OSM tags `height`/`building:levels` (Europe-heavy, patchy elsewhere). Cesium OSM Buildings = planet-wide 3D but needs Cesium ion (new dep + token).

## Spike questions (Given/When/Then)

| # | Spike | Validates | Risk |
|---|-------|-----------|------|
| S1 | basemap-footprints | Given the current flat map at z14+, when I pan to a dense city, then building footprints already render from the existing OpenFreeMap tiles | Low |
| S2 | toggleable-layer | Given the same OpenFreeMap vector source, when a `buildings` layer entry is added, then it toggles independently of basemap theme | Medium (12-file worldmonitor checklist) |
| S3 | extrusion | Given OSM `render_height` in the openmaptiles `building` layer, when fill-extrusion is applied in a harness, then buildings extrude 3D where tagged (Europe/US metros); flat elsewhere | Medium |

## Approach

1. **S1 + S3 in one throwaway harness** (`spikes/geolibre-buildings/index.html`): MapLibre + the dashboard's own OpenFreeMap dark style + a `fill-extrusion` building layer reading `render_height`. Pan 3 cities (NYC / Berlin / Tokyo) at z15+, screenshot. Answers "does the data exist everywhere + does 3D work" without touching app code.
2. **S1 in the live dashboard:** run dev server, drive browser to a city view, check whether the current basemap already shows footprints (console layer check + screenshot).
3. **Verdict:** VALIDATED / PARTIAL / INVALIDATED → then decide real build (LAYER_REGISTRY entry per worldmonitor checklist) or 3D path (Cesium ion).

## Files

- Create: `spikes/geolibre-buildings/index.html` + `README.md` (throwaway)
- App code: **none** until verdict

## Verification

- Screenshots at z15–z17 for NYC, Berlin, Tokyo (footprints visible)
- Extrusion visible where `render_height` exists; absent where not
- Console free of tile-source errors

## Risks / open questions

- OSM height coverage patchy outside Europe/US metros — 3D everywhere ≠ Google/Apple everywhere
- deck.gl flat map would need MapLibre layer injection for extrusion (S2 scope)
- 3D-everywhere alternative = Cesium ion (new dep, token, 3D Tiles in deck.gl via loaders.gl) — deferred unless S3 verdict demands it
- GeoLibre embed remains an option for the full GIS toolbox (legend, hot-spot) — separate decision
