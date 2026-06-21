# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**World Monitor** — Real-time global intelligence dashboard. AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking in a unified situational awareness interface. Single codebase with 5 deployable variants (full, tech, finance, happy, commodity).

- **Repo:** https://github.com/koala73/worldmonitor
- **License:** AGPL-3.0-only

## Essential Commands

### Development
```bash
npm install                    # Install dependencies (or `make install` for everything)
npm run dev                    # Dev server + RSS relay (default: full variant)
npm run dev:tech               # Tech variant dev
npm run dev:finance            # Finance variant dev
npm run dev:happy              # Happy variant dev
npm run dev:commodity          # Commodity variant dev
npm run desktop:dev            # Tauri desktop app dev
```

### Build
```bash
npm run build                  # Build default variant (tsc + vite)
npm run build:tech             # Build tech variant
npm run build:finance          # Build finance variant
npm run build:happy            # Build happy variant
npm run build:commodity        # Build commodity variant
npm run build:full             # Build full variant
npm run build:desktop          # Full build with sidecar (Tauri)
```

### Type Checking
```bash
npm run typecheck             # Frontend TypeScript check
npm run typecheck:api         # API TypeScript check
npm run typecheck:all         # Both
```

### Tests
```bash
npm run test:sidecar          # Sidecar/API unit tests (local)
npm run test:data             # Data/service route tests
npm run test:feeds            # RSS feed validation
npm run test:e2e              # All e2e tests (Playwright, all variants)
npm run test:e2e:full         # E2E for full variant only
npm run test:e2e:runtime      # Runtime fetch e2e test
npm run test:e2e:visual       # Visual regression tests

# Run a single Playwright test file:
npx playwright test e2e/runtime-fetch.spec.ts

# Run tests matching a pattern:
npx playwright test -g "matches golden screenshots"
```

### Proto/Code Generation
```bash
make generate                  # Generate TS client/server from proto files
make lint                      # Lint protobuf files
make check                     # lint + generate
make breaking                  # Check breaking changes against main
make format                    # Format .proto files
make deps                      # Update buf proto dependencies
```

### Desktop Packaging
```bash
npm run desktop:package:macos:full
npm run desktop:package:windows:full
```

## High-Level Architecture

### Multi-Variant System

`SITE_VARIANT` is injected at build time via Vite `define`, enabling tree-shaking of dead variant code. Runtime hostname detection still works for web builds. Variants share a single codebase but differ in:
- Which data layers are visible on the map
- Which panels are enabled by default
- Theming via `data-variant` attribute on `<html>`
- Variant-specific layer configs in `src/config/map-layer-definitions.ts`

### Technology Stack

- **Frontend:** Preact, TypeScript, Vite, Web Workers (ML), i18next (21 languages)
- **Maps:** Dual engine — Maplibre-GL + deck.gl (flat) and globe.gl + Three.js (3D globe)
- **Desktop:** Tauri v2 with Rust sidecar, OS keychain integration, local API server
- **Backend:** Serverless Vercel API (`/api/`), Convex for real-time data
- **AI/ML:** Browser-side Transformers.js (ONNX), Ollama/Groq/OpenRouter summarization chain
- **Protobufs:** 92 proto files across 22 services, generated via Buf + sebuf plugins
- **Testing:** Playwright (e2e + visual regression), Node test runner (unit)

### Directory Structure

```
src/
  App.ts                      # Main App class — orchestrates all managers
  main.ts                     # Entry point: bootstrap, theme, Sentry, i18n, variant
  app/
    event-bus.ts              — Lightweight pub/sub for cross-module communication
    stores/
      news-store.ts           — Encapsulated news state (allNews, byCategory, happy)
      intelligence-store.ts   — Markets, predictions, clusters, cyber threats
      ui-store.ts             — Panel settings, map layers, time range, idle state
      map-store.ts            — Map container reference, initial URL state
    panel-interfaces.ts       — Interface contracts replacing 56+ type-casts
    news-clustering-pipeline.ts — News loading, clustering, categorization
    signal-publisher.ts       — Supplemental bus, CII refresh, intelligence signals
    data-renderer.ts          — Panel rendering calls via interface-based dispatch
    data-loader.ts            — Fetch orchestration, circuit breakers, staleness
    country-intel.ts          — Country brief management
    entity-intel.ts           — Entity detail panels
    search-manager.ts         — Cmd+K search index
    refresh-scheduler.ts      — Smart polling with exponential backoff
    event-handlers.ts         — DOM event binding
  components/                 # Preact UI components (panels, modals, map overlays)
  config/                     # App constants, variant configs, feed definitions
  data/                       # Static data (GeoJSON, basemaps, locale files)
  generated/                  # Auto-generated proto clients/servers (from `make generate`)
  services/                   # Business logic: data services, auth, ML worker, analytics
    economic/
      fred.ts                 — FRED economic data
      eia.ts                  — EIA energy analytics
      worldbank.ts            — World Bank indicators
      bis.ts                  — BIS central bank data
      index.ts                — Barrel re-export for backward compat
    managed-service.ts        — ManagedService interface + registry
  styles/                     # CSS (semantic variables, variant themes)
  types/                      # TypeScript type definitions
  utils/                      # Shared utilities
  workers/                    # Web Workers (analysis, ML via Transformers.js)
api/                          # Serverless API routes (RSS, data enrichment, video, etc.)
server/                       # Server-side route definitions
proto/                        # Protobuf definitions (buf-based, 22 services)
src-tauri/                    # Tauri desktop app (Rust sidecar, configs)
  sidecar/                    # Local API server written in Rust
  tauri.conf.json             # Main Tauri config
  tauri.tech.conf.json        # Tech variant Tauri config
  tauri.finance.conf.json     # Finance variant Tauri config
convex/                       # Convex real-time data functions
e2e/                          # Playwright end-to-end tests
tests/                        # Node test runner tests (data services, configs)
```

### Key Architectural Patterns

1. **Modular State Slices:** `NewsStore`, `IntelligenceStore`, `UIStore`, `MapStore` — each has a single writer and emits events via `AppEventBus`. No more mutating a shared `AppContext` object.

2. **Event Bus:** `AppEventBus` (`src/app/event-bus.ts`) replaces manual callback wiring. Modules subscribe to events like `news:all-updated`, `intelligence:markets-updated`, etc.

3. **Panel Interfaces:** 16 interfaces in `panel-interfaces.ts` (e.g., `MarketRenderable`, `CryptoRenderable`) replace 56+ string-key type-casts. Renderers look up by interface, not by panel name.

4. **ManagedService:** All singleton services implement `init()/destroy()` lifecycle. `ManagedServiceRegistry` manages init/destroy ordering.

5. **Variant Tree-Shaking:** `SITE_VARIANT` is a build-time constant via Vite `define`. Dead variant code (feeds, panels, configs) is eliminated at build time.

6. **Service Decomposition:** Large services split into focused modules (e.g., `economic/index.ts` → `fred.ts`, `eia.ts`, `worldbank.ts`, `bis.ts`).

7. **Map Layer System:** 45+ toggleable layers defined in `src/config/map-layer-definitions.ts`. Each variant restricts which layers are allowed. Layer state is persisted to localStorage with variant keys.

8. **Data Loading:** Split across `DataLoaderManager` (orchestration), `NewsClusteringPipeline` (news/clustering), `SignalPublisher` (intelligence signals), and `DataRenderer` (panel rendering).

9. **AI Pipeline:** Multi-tier fallback chain — Ollama (local) → Groq → OpenRouter → browser T5. Browser ML runs via `@huggingface/transformers` in a Web Worker.

10. **Scoring:** Country Instability Index (CII), Hotspot Escalation, Strategic Risk Score — all computed client-side from multi-signal data blends.

11. **Proto-First API:** All API contracts defined in `.proto` files. Generate TypeScript clients/servers + OpenAPI docs via `make generate`. Run `make check` before committing proto changes.

### Important Configuration

- `vite.config.ts` — Vite build config, PWA, code splitting, `SITE_VARIANT` define
- `middleware.ts` — Vercel edge middleware
- `tsconfig.json` / `tsconfig.api.json` — Separate TS configs for frontend and API
- `firebase.json` — Firebase configuration
- `railpack.json` — Deployment config
- `vercel.json` — Vercel deployment config

## Claude Code Automation Rules

These rules govern when Claude must automatically invoke project-specific agents and skills. Do not wait for the user to ask.

### Always invoke automatically:

| Trigger | Action |
|---|---|
| Any `.proto` file is read, modified, or discussed | Run the `proto-reviewer` subagent on the changed files |
| Any `.proto` file is modified | Run `/generate-proto` skill after edits to regenerate `src/generated/` |
| Any file in `src/components/`, `src/services/`, `src/config/`, or `src/app/` is modified | Run the `variant-impact-checker` subagent to report which variants are affected |
| User asks to "add a variant" or "create a new variant" | Run `/new-variant` skill |
| Implementing a new feature that touches shared code | Run `variant-impact-checker` before and after to confirm blast radius |
| After completing any multi-file change | Run `npm run typecheck:all` to confirm no type regressions |

### MCP server usage:
- Use **context7** whenever looking up API docs for: maplibre-gl, deck.gl, globe.gl, Vite, Firebase, Convex, Playwright, Tauri, Preact, or any other library in `package.json`. Prefer context7 over WebFetch for library documentation.
- Use **github** MCP when asked about issues, PRs, CI status, or commit history for this repo.

### Key rule:
Never make the user remind you to run these. If the trigger condition is met, invoke the agent or skill as part of your normal workflow.
