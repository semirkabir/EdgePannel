# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev              # Full variant (relay + Vite)
npm run dev:tech         # Tech variant
npm run dev:finance      # Finance variant
npm run dev:happy        # Happy variant
npm run dev:commodity    # Commodity variant
npm run relay            # AIS relay server only
```

### Build
```bash
npm run build            # TypeScript check + Vite build
npm run build:full       # Full variant build
npm run build:desktop    # Tauri desktop build with sidecar
npm run build:sidecar-sebuf  # Protobuf sidecar build
```

### Testing
```bash
npm run test:e2e         # All E2E tests (Playwright)
npm run test:e2e:full    # Full variant E2E
npm run test:e2e:visual  # Visual regression tests
npm run test:data        # Data unit tests
npm run test:sidecar     # Sidecar API tests
npm run test:feeds       # RSS feed validation
```

### Code Quality
```bash
npm run typecheck        # TypeScript check
npm run typecheck:all    # All variants
npm run lint:md          # Markdown linting
npm run check:unsafe-dom # DOM security checks
npm run check:size-budgets # Bundle size checks
```

### Protobuf (Makefile)
```bash
make install    # Install buf, plugins, npm deps, browsers
make generate   # Generate TypeScript from .proto files
make lint       # Lint proto definitions
make breaking   # Check proto breaking changes
```

## Architecture

**World Monitor** is a real-time intelligence dashboard built with **Preact + TypeScript + Vite**, with desktop support via **Tauri**.

### Variant System
Five variants are built from a single codebase: `full`, `tech`, `finance`, `happy`, `commodity`. Selected at build time via `VITE_VARIANT` env var. Each variant has its own feeds, map layers, panel layouts, and geo points of interest. CSS uses `[data-variant]` selectors for runtime theming.

### Module Lifecycle
All major components implement `{ init(), destroy() }` via the `AppModule` interface. Central `AppContext` (in `src/app/app-context.ts`) holds all managers and shared state — this is the main coordination point, not a Redux-style store.

### Data Flow
1. **DataLoaderManager** (`src/app/data-loader.ts`) orchestrates parallel fetches from 17 domain services in `src/services/`
2. **analysis-core.ts** performs pure signal detection (clustering, sentiment, velocity)
3. **AnalysisWorker** (`src/workers/ml.worker.ts`) offloads heavy computation (ONNX inference) to a Web Worker
4. **RefreshScheduler** (`src/app/refresh-scheduler.ts`) manages smart polling with exponential backoff, pauses on tab hidden
5. Results flow into AppContext, triggering component re-renders
6. User interactions go through **EventHandlerManager** (`src/app/event-handlers.ts`)

### Maps
Dual map engine: **globe.gl** (3D globe + Three.js) and **deck.gl** (2D WebGL flat) with **MapLibre GL** tiles. 45 toggleable data layers defined in `src/config/map-layer-definitions.ts`.

### API Layer
Proto-first design with 138 `.proto` files across 22 services. Code generation via sebuf produces TypeScript clients in `src/generated/`. Firebase auth middleware in `src/services/api-auth-fetch.ts` attaches ID tokens to `/api/` requests.

### Key Directories
- `src/app/` — Application managers (state coordination layer)
- `src/components/` — Preact UI components (60+ panels)
- `src/services/` — Domain services organized by topic (aviation, climate, conflict, cyber, maritime, military, news, etc.)
- `src/config/` — Static configs, feed definitions, geo data, panel layouts (tree-shaken per variant)
- `src/types/` — Central TypeScript interfaces
- `src/generated/` — Auto-generated protobuf clients (do not edit manually)
- `src/locales/` — i18next translations (21 languages)
- `src/styles/` — CSS with variant-specific themes

### Intelligence Systems
- **News Clustering:** Jaccard similarity on tokenized titles (threshold 0.4) in analysis-core.ts
- **Threat Classification:** Fast keyword classifier with async ML override
- **CII (Country Instability Index):** 5-tier composite score from multiple signal sources
- **Headline Memory:** Client-side ONNX embeddings stored in IndexedDB

### Performance Patterns
- Bootstrap pre-hydration with 2-tier loading (fast 3s / slow 5s) in `src/services/bootstrap.ts`
- Circuit breaker pattern for failed service calls
- Brotli pre-compression for static assets
- Bundle size budgets enforced in CI

## Tech Stack

| Component | Technology |
|-----------|-----------|
| UI | Preact 10 |
| Language | TypeScript 5.7 |
| Build | Vite 6.0 |
| Maps (3D) | globe.gl + Three.js |
| Maps (2D) | deck.gl + MapLibre GL |
| Charts | D3.js, lightweight-charts |
| Desktop | Tauri 2.10 |
| Auth | Firebase |
| APIs | Protobuf (sebuf codegen) |
| ML | ONNX Runtime Web |
| Testing | Playwright |
| i18n | i18next (21 languages) |
| Analytics | Sentry, Vercel Analytics |

## Path Aliases

TypeScript path alias `@/*` maps to `src/*` (configured in tsconfig.json).
