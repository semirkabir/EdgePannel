# EdgePannel

**Real-time global intelligence dashboard** — AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking in a unified situational awareness interface.

[![GitHub stars](https://img.shields.io/github/stars/koala73/worldmonitor?style=social)](https://github.com/koala73/worldmonitor/stargazers)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Last commit](https://img.shields.io/github/last-commit/koala73/worldmonitor)](https://github.com/koala73/worldmonitor/commits/main)
[![Latest release](https://img.shields.io/github/v/release/koala73/worldmonitor?style=flat)](https://github.com/koala73/worldmonitor/releases/latest)

<p align="center">
  <a href="https://edgepannel.com"><img src="https://img.shields.io/badge/Web_App-edgepannel.com-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Web App"></a>&nbsp;
</p>

<p align="center">
  <a href="https://edgepannel.com/api/download?platform=windows-exe"><img src="https://img.shields.io/badge/Download-Windows_(.exe)-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows"></a>&nbsp;
  <a href="https://edgepannel.com/api/download?platform=macos-arm64"><img src="https://img.shields.io/badge/Download-macOS_Apple_Silicon-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS ARM"></a>&nbsp;
  <a href="https://edgepannel.com/api/download?platform=macos-x64"><img src="https://img.shields.io/badge/Download-macOS_Intel-555555?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS Intel"></a>&nbsp;
  <a href="https://edgepannel.com/api/download?platform=linux-appimage"><img src="https://img.shields.io/badge/Download-Linux_(.AppImage)-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download Linux"></a>
</p>

---

## Why EdgePannel?

| Problem                            | Solution                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| News scattered across 100+ sources | **Single unified dashboard** with 680+ curated feeds across 30 categories                                  |
| No geospatial context for events   | **Interactive map** with 60 toggleable data layers on a unified MapLibre GL + deck.gl engine, plus a CII country risk heatmap |
| Information overload               | **AI-synthesized briefs** with focal point detection and local LLM support                                 |
| Crypto/macro signal noise          | **7-signal market radar** with composite BUY/CASH verdict                                                  |
| Expensive OSINT tools ($$$)        | **Free forever core** — the full map, feeds, and layers need no account                                    |
| Static news feeds                  | **Real-time updates** with live video streams, desktop push alerts, and AI-powered deductions               |
| Cloud-dependent AI tools           | **Run AI locally** with Ollama/LM Studio — no API keys, no data leaves your machine                        |
| Web-only dashboards                | **Native desktop app** (Tauri) for macOS, Windows, and Linux + installable PWA with offline map support    |
| English-only OSINT tools           | **21 languages** with native-language RSS feeds, AI-translated summaries, and RTL support for Arabic       |
| Undocumented, fragile APIs         | **Proto-first API contracts** — 28 typed services with auto-generated clients, servers, and OpenAPI docs   |
| Fixed feature set                  | **Marketplace & Workspaces** — install community layers/panels/sources, save named dashboard layouts       |

---

## Live Demos

| Variant             | URL                                                          | Focus                                            |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| **EdgePannel**   | [edgepannel.com](https://edgepannel.com)                 | Geopolitics, military, conflicts, infrastructure |

---

## Key Features

### Maps & Visualization

- **Unified map engine** — MapLibre GL + deck.gl render both the flat map and a native globe projection from the same WebGL layer stack (no separate 3D engine), switchable at runtime with 60 shared data layers
- **60 toggleable data layers** across 11 categories — conflict, military, cyber/infrastructure, aviation & maritime, space, economy, environment, governance, technology, positive signals, and commodities
- **Draw & measure toolkit** — native drawing, distance/area measurement, and annotation directly on the map
- **CII / governance choropleths** — country-level instability and governance-quality heatmaps on the same map engine
- **URL state sharing** — map center, zoom, active layers, and time range encoded in shareable URLs
- **Workspaces** — save, name, and switch between multiple full dashboard layouts (panels, layers, layout mode)

### AI & Intelligence

- **World Brief** — LLM-synthesized summary with 4-tier fallback: Ollama/LM Studio (local) → Groq → OpenRouter → browser T5
- **AI Deduction & Forecasting** — free-text geopolitical analysis grounded in live headlines
- **Headline Memory (RAG)** — opt-in browser-local semantic index using ONNX embeddings in IndexedDB
- **Threat Classification** — instant keyword classifier with async ML and LLM override
- **Country Brief Pages** — full-page intelligence dossiers with CII scores, AI analysis, timelines, factbook data, and prediction markets, with maximize mode and native share
- **Country Factbook** — structured reference data (demographics, government, economy) per country

### Scoring & Detection

- **Country Instability Index (CII)** — real-time stability scores using a weighted multi-signal blend across tier-1 nations + universal scoring for every country
- **Hotspot Escalation** — dynamic scoring blending news activity, CII, geo-convergence, and military signals
- **Strategic Risk Score** — composite geopolitical risk from convergence, CII, infrastructure, theater posture, and breaking news
- **Signal Aggregation** — multi-source fusion with temporal baseline anomaly detection (Welford's online algorithm)
- **UCDP conflict data** — Uppsala Conflict Data Program integration for historical & ongoing armed-conflict events
- **GPS/GNSS jamming detection** — H3 hexagonal-grid interference overlay wired into CII scoring
- **Geofenced alert rules** — user-defined, editable alert rules with a Sources & Status health panel

### Live News, Signals & Video

- **680+ RSS feeds** across geopolitics, defense, energy, tech, and finance, deduplicated and tier-ranked server-side
- **Telegram Intel panel** — curated OSINT channels relayed via MTProto
- **OREF Israel Sirens** — real-time alert relay with Hebrew→English translation
- **Security Advisories** — government travel/security alert aggregation
- **AviationStack integration** — global airport delay tracking with NOTAM closure detection
- **Article extraction** — full-text article fetching with readability parsing and reading-progress tracking
- **30+ live video streams** — Bloomberg, Sky News, Al Jazeera, RT, and more with native HLS streaming
- **Custom keyword monitors** — user-defined alerts with word-boundary matching, auto-coloring, and desktop push notifications
- **Breaking news alert banner** — audio alerts for critical/high-severity items

### Desktop & Mobile

- **Native desktop app** (Tauri 2) — macOS, Windows, Linux with OS keychain, local Rust sidecar, and cloud fallback
- **Progressive Web App** — installable with offline map support
- **Mobile-optimized map** — touch pan with inertia, pinch-to-zoom, bottom-sheet popups, GPS centering
- **Desktop push notifications** — OS-native alerts for critical intelligence signals
- **Responsive layout** — ultra-wide L-shaped layout on 2000px+, collapsible panels

### Platform Features

- **21 languages** — lazy-loaded bundles with native-language RSS feeds, AI translation, and RTL support
- **Cmd+K command palette** — fuzzy search across news, countries, layers, and panel commands
- **Marketplace** — install community-contributed map layers, panels, and custom RSS/Telegram/X sources
- **Proto-first API contracts** — 168 proto files across 28 services, auto-generated TypeScript clients/servers + OpenAPI docs
- **What's New panel** — release timeline auto-parsed from `CHANGELOG.md` at build time
- **Story sharing** — intelligence briefs exportable to Twitter/X, LinkedIn, WhatsApp, Telegram, Reddit

---

## Architecture

### Modular Design

The codebase uses a **modular manager architecture** with clear ownership boundaries:

```
src/app/
  event-bus.ts            — Lightweight pub/sub for cross-module communication
  stores/
    news-store.ts         — Encapsulated news state (allNews, byCategory, happy)
    intelligence-store.ts — Markets, predictions, clusters, cyber threats
    ui-store.ts           — Panel settings, map layers, time range, idle state
    map-store.ts          — Map container reference, initial URL state
  panel-interfaces.ts     — Interface contracts replacing 56+ type-casts
  news-clustering-pipeline.ts — News loading, clustering, categorization
  signal-publisher.ts     — Supplemental bus, CII refresh, intelligence signals
  data-renderer.ts        — Panel rendering calls via interface-based dispatch
  data-loader.ts          — Fetch orchestration, circuit breakers, staleness
  country-intel.ts        — Country brief management
  entity-intel.ts         — Entity detail panels
  search-manager.ts       — Cmd+K search index
  refresh-scheduler.ts    — Smart polling with exponential backoff
  event-handlers.ts       — DOM event binding
```

**Key patterns:**

- **Event bus** — modules communicate via `AppEventBus` instead of direct mutations
- **Owned stores** — each domain (news, intelligence, UI, map) has a single writer
- **Panel interfaces** — 16 renderable interfaces replace string-key + type-cast lookups
- **ManagedService** — singleton services implement `init()/destroy()` lifecycle via a registry
- **Variant tree-shaking** — `SITE_VARIANT` is a build-time constant, dead variant code eliminated

### Data Flow

1. **DataLoaderManager** orchestrates parallel fetches across domain services
2. **NewsClusteringPipeline** handles news loading, Jaccard clustering, categorization
3. **SignalPublisher** manages supplemental bus, CII refresh, intelligence aggregation
4. **DataRenderer** dispatches data to panels via interface contracts
5. Stores emit events on change — subscribers react automatically
6. User interactions go through **EventHandlerManager**

### Variant System

A single codebase produces six specialized dashboards. `SITE_VARIANT` is injected at build time via Vite `define`, enabling tree-shaking of unused variant data:

| Aspect                | EdgePannel                                           | EdgePannel Tech                                 | EdgePannel Finance                               | EdgePannel Commodity                                      | EdgePannel Happy                                      | EdgePannel Conflicts                                  |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| **Domain**            | edgepannel.com                                       | tech.edgepannel.com                             | finance.edgepannel.com                           | commodity.edgepannel.com                                  | happy.edgepannel.com                                  | conflicts.edgepannel.com                              |
| **Focus**             | Geopolitics, military, conflicts, infrastructure     | AI/ML, startups, cybersecurity                  | Markets, trading, central banks                  | Mining, metals, energy commodities, critical minerals     | Good news, conservation, human progress               | Conflict, military, displacement, security risk       |
| **RSS Feeds**         | 30 categories, 250+ feeds                            | 21 categories, 150+ feeds                       | 15 categories, 65+ feeds                         | 10 categories, 60+ feeds                                  | 6 categories, 28+ feeds                                | 8 categories, 75+ feeds                               |
| **Default panels**    | 64                                                    | 31                                              | 45                                                | 26                                                        | 10                                                    | 28                                                    |
| **Desktop App**       | Yes                                                  | Yes                                             | Yes                                              | (web-only)                                                | (web-only)                                            | Yes                                                    |

---

## Programmatic API Access

Every data endpoint is accessible via `api.edgepannel.com`:

```bash
# Fetch market quotes
curl -s 'https://api.edgepannel.com/api/market/v1/list-market-quotes?symbols=AAPL,MSFT,GOOGL'

# Get airport delays
curl -s 'https://api.edgepannel.com/api/aviation/v1/list-airport-delays'

# Get earthquake data
curl -s 'https://api.edgepannel.com/api/seismology/v1/list-earthquakes'

# Company enrichment
curl -s 'https://api.edgepannel.com/api/enrichment/company?domain=stripe.com'
```

All 28 service domains (alerts, aviation, climate, conflict, consumer-prices, cyber, displacement, economic, forecast, giving, infrastructure, intelligence, maritime, market, military, natural, news, positive-events, prediction, reference, research, resilience, seismology, supply-chain, trade, unrest, wildfire, and core) are available as `POST /api/{domain}/v1/{rpc-name}`. GET with query params is supported for read-only RPCs.

> **Note**: Use `api.edgepannel.com`, not `edgepannel.com` — the main domain requires browser origin headers.

---

## Quick Start

```bash
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor
npm install
npm run dev       # Vite dev server + RSS/AIS relay on localhost:5173
```

Open [http://localhost:5173](http://localhost:5173). Run `npm run dev:tech`, `dev:finance`, `dev:happy`, `dev:commodity`, or `dev:conflicts` for the other variants.

### Environment Variables (Optional)

```bash
cp .env.example .env.local
```

The dashboard runs with zero configuration — static layers, the map, and browser-side ML all work with no API keys. `.env.example` documents 60+ optional integrations; the main groups:

| Group                | Variables                                                    | Free Tier                          |
| --------------------- | ------------------------------------------------------------ | ---------------------------------- |
| **AI (Local)**        | `OLLAMA_API_URL`, `OLLAMA_MODEL`                             | Free (runs on your hardware)       |
| **AI (Cloud)**        | `GROQ_API_KEY`, `OPENROUTER_API_KEY`                         | 14,400 req/day (Groq)              |
| **Cache**              | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`         | 10K commands/day                   |
| **Markets**            | `FINNHUB_API_KEY`, `FRED_API_KEY`, `EIA_API_KEY`             | All free tier                      |
| **Aviation / Maritime**| `AVIATIONSTACK_API`, `WINGBITS_API_KEY`, `AISSTREAM_API_KEY` | Free tier available                |
| **Conflict / Cyber**   | `ACLED_ACCESS_TOKEN`, `UCDP_ACCESS_TOKEN`, `OTX_API_KEY`, `ABUSEIPDB_API_KEY` | Free tier available |
| **Telegram Intel**     | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`   | Free (MTProto)                     |
| **UI**                 | `VITE_VARIANT`                                                | N/A                                 |

See [`.env.example`](./.env.example) for the complete list.

---

## Deployment

For authorised developers and deployments only — the source is proprietary and
running it requires a written agreement (see [`LICENSE`](./LICENSE)).

### Option 1: Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Option 2: Local Development

```bash
npm run dev                  # Frontend + RSS/AIS relay on localhost:5173
```

### Option 3: Full Edge Function Parity

```bash
npm install -g vercel
vercel dev                   # Frontend + all Vercel edge functions on localhost:3000
```

The RSS/AIS relay (`scripts/ais-relay.cjs`) is designed to run standalone (e.g. on Railway, see `railpack.json`) alongside the Vercel deployment for production.

---

## Tech Stack

| Category              | Technologies                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**          | Preact 10, TypeScript 5.7, Vite 8                                                                                                              |
| **Maps**              | MapLibre GL 5 (native globe projection) + deck.gl 9 — single unified engine for flat map and globe                                            |
| **Charts**            | D3 (per-module `d3-*` imports), lightweight-charts                                                                                             |
| **Desktop**           | Tauri 2 (Rust sidecar), OS keychain, local API server                                                                                          |
| **Realtime data**     | Convex                                                                                                                                          |
| **AI/ML**             | Ollama, LM Studio, Groq, OpenRouter, Transformers.js (browser), ONNX Runtime Web                                                               |
| **APIs**              | Protobuf (sebuf codegen) — 168 proto files, 28 services                                                                                        |
| **Testing**           | Playwright (e2e + visual regression), Node test runner (unit)                                                                                  |
| **i18n**              | i18next (21 languages)                                                                                                                          |
| **Analytics**         | Sentry, Vercel Analytics                                                                                                                        |

---

## Contributing

```bash
# Development
npm run dev              # Full variant (edgepannel.com)
npm run dev:tech         # Tech variant
npm run dev:finance      # Finance variant
npm run dev:commodity    # Commodity variant
npm run dev:happy        # Happy variant
npm run dev:conflicts    # Conflicts variant

# Production builds
npm run build:full       # Build full variant
npm run build:tech       # Build tech variant
npm run build:finance    # Build finance variant
npm run build:commodity  # Build commodity variant
npm run build:happy      # Build happy variant
npm run build:conflicts  # Build conflicts variant

# Quality
npm run typecheck:all    # TypeScript type checking (frontend + API)
npm run test:e2e         # Playwright e2e tests, all variants

# Desktop packaging
npm run desktop:package:macos:full
npm run desktop:package:windows:full
```

---

## Roadmap

**Upcoming:**

- [ ] Self-hosted Docker image

---

## Support the Project

- **Star this repo** to help others discover it
- **Share** with colleagues interested in OSINT
- **Contribute** code, data sources, or documentation
- **Report issues** to help improve the platform

---

## License

**Proprietary — all rights reserved.** See [`LICENSE`](./LICENSE).

This software is not open source. No right to use, copy, modify or distribute
the source is granted except under a written agreement with the copyright
holder. Access to the hosted service is governed by the
[Terms of Service](https://edgepannel.com/terms), which do not grant any rights
to the source code.

| Use Case | Allowed? |
|----------|----------|
| Using the hosted service | Yes — under the Terms of Service |
| Reading, copying or self-hosting the source | No — written agreement required |
| Forking or modifying | No — written agreement required |
| Redistributing, in whole or in part | No |

Third-party open-source components remain under their own licences, and
third-party data providers' terms of use apply independently.

Copyright (C) 2026 Semir Kabir. All rights reserved.
Portions copyright (C) 2024-2026 Elie Habib, incorporated under a separate
commercial licence.

---

## Author

**Elie Habib** — [GitHub](https://github.com/koala73)

---

## Contributors

<a href="https://github.com/koala73/worldmonitor/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=koala73/worldmonitor" />
</a>

---

## Security Acknowledgments

We thank the following researchers for responsibly disclosing security issues:

- **Cody Richard** — Disclosed three security findings covering IPC command exposure via DevTools in production builds, renderer-to-sidecar trust boundary analysis, and the global fetch patch credential injection architecture (2026)

---

<p align="center">
  <a href="https://edgepannel.com">edgepannel.com</a>
</p>

## Star History

<a href="https://api.star-history.com/svg?repos=koala73/worldmonitor&type=Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=koala73/worldmonitor&type=Date&theme=dark" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=koala73/worldmonitor&type=Date" />
 </picture>
</a>
