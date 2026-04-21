# World Monitor

**Real-time global intelligence dashboard** — AI-powered news aggregation, geopolitical monitoring, and infrastructure tracking in a unified situational awareness interface.

[![GitHub stars](https://img.shields.io/github/stars/koala73/worldmonitor?style=social)](https://github.com/koala73/worldmonitor/stargazers)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Last commit](https://img.shields.io/github/last-commit/koala73/worldmonitor)](https://github.com/koala73/worldmonitor/commits/main)
[![Latest release](https://img.shields.io/github/v/release/koala73/worldmonitor?style=flat)](https://github.com/koala73/worldmonitor/releases/latest)

<p align="center">
  <a href="https://worldmonitor.app"><img src="https://img.shields.io/badge/Web_App-worldmonitor.app-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Web App"></a>&nbsp;
  <a href="https://tech.worldmonitor.app"><img src="https://img.shields.io/badge/Tech_Variant-tech.worldmonitor.app-0891b2?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Tech Variant"></a>&nbsp;
  <a href="https://finance.worldmonitor.app"><img src="https://img.shields.io/badge/Finance_Variant-finance.worldmonitor.app-059669?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Finance Variant"></a>&nbsp;
  <a href="https://commodity.worldmonitor.app"><img src="https://img.shields.io/badge/Commodity_Variant-commodity.worldmonitor.app-b45309?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Commodity Variant"></a>&nbsp;
  <a href="https://happy.worldmonitor.app"><img src="https://img.shields.io/badge/Happy_Variant-happy.worldmonitor.app-f59e0b?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Happy Variant"></a>
</p>

<p align="center">
  <a href="https://worldmonitor.app/api/download?platform=windows-exe"><img src="https://img.shields.io/badge/Download-Windows_(.exe)-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download Windows"></a>&nbsp;
  <a href="https://worldmonitor.app/api/download?platform=macos-arm64"><img src="https://img.shields.io/badge/Download-macOS_Apple_Silicon-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS ARM"></a>&nbsp;
  <a href="https://worldmonitor.app/api/download?platform=macos-x64"><img src="https://img.shields.io/badge/Download-macOS_Intel-555555?style=for-the-badge&logo=apple&logoColor=white" alt="Download macOS Intel"></a>&nbsp;
  <a href="https://worldmonitor.app/api/download?platform=linux-appimage"><img src="https://img.shields.io/badge/Download-Linux_(.AppImage)-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download Linux"></a>
</p>

---

## Why World Monitor?

| Problem                            | Solution                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| News scattered across 100+ sources | **Single unified dashboard** with 435+ curated feeds across 15 categories                                  |
| No geospatial context for events   | **Interactive map** with 45 toggleable data layers and CII country risk heatmap                             |
| Information overload               | **AI-synthesized briefs** with focal point detection and local LLM support                                 |
| Crypto/macro signal noise          | **7-signal market radar** with composite BUY/CASH verdict                                                  |
| Expensive OSINT tools ($$$)        | **100% free & open source**                                                                                |
| Static news feeds                  | **Real-time updates** with live video streams and AI-powered deductions                                    |
| Cloud-dependent AI tools           | **Run AI locally** with Ollama/LM Studio — no API keys, no data leaves your machine                        |
| Web-only dashboards                | **Native desktop app** (Tauri) for macOS, Windows, and Linux + installable PWA with offline map support    |
| English-only OSINT tools           | **21 languages** with native-language RSS feeds, AI-translated summaries, and RTL support for Arabic       |
| Undocumented, fragile APIs         | **Proto-first API contracts** — 22 typed services with auto-generated clients, servers, and OpenAPI docs   |

---

## Live Demos

| Variant             | URL                                                          | Focus                                            |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| **World Monitor**   | [worldmonitor.app](https://worldmonitor.app)                 | Geopolitics, military, conflicts, infrastructure |
| **Tech Monitor**    | [tech.worldmonitor.app](https://tech.worldmonitor.app)       | Startups, AI/ML, cloud, cybersecurity            |
| **Finance Monitor** | [finance.worldmonitor.app](https://finance.worldmonitor.app) | Global markets, trading, central banks, Gulf FDI |
| **Commodity Monitor** | [commodity.worldmonitor.app](https://commodity.worldmonitor.app) | Mining, metals, energy commodities, critical minerals |
| **Happy Monitor**   | [happy.worldmonitor.app](https://happy.worldmonitor.app)     | Good news, positive trends, uplifting stories    |

All five variants run from a single codebase — switch between them with one click via the header bar.

---

## Key Features

### Maps & Visualization

- **Dual Map Engine** — 3D globe (globe.gl + Three.js) and WebGL flat map (deck.gl), runtime-switchable with 45 shared data layers
- **45 toggleable data layers** — conflicts, bases, cables, pipelines, flights, vessels, protests, fires, earthquakes, datacenters, and more
- **8 regional presets** — Global, Americas, Europe, MENA, Asia, Africa, Oceania, Latin America with time filtering (1h–7d)
- **CII choropleth heatmap** — five-stop color gradient paints every country by instability score on both map engines
- **URL state sharing** — map center, zoom, active layers, and time range encoded in shareable URLs

### AI & Intelligence

- **World Brief** — LLM-synthesized summary with 4-tier fallback: Ollama (local) → Groq → OpenRouter → browser T5
- **AI Deduction & Forecasting** — free-text geopolitical analysis grounded in live headlines
- **Headline Memory (RAG)** — opt-in browser-local semantic index using ONNX embeddings in IndexedDB
- **Threat Classification** — instant keyword classifier with async ML and LLM override
- **Country Brief Pages** — full-page intelligence dossiers with CII scores, AI analysis, timelines, and prediction markets

### Scoring & Detection

- **Country Instability Index (CII)** — real-time stability scores using weighted multi-signal blend across 23 tier-1 nations + universal scoring for all countries
- **Hotspot Escalation** — dynamic scoring blending news activity, CII, geo-convergence, and military signals
- **Strategic Risk Score** — composite geopolitical risk from convergence, CII, infrastructure, theater, and breaking news
- **Signal Aggregation** — multi-source fusion with temporal baseline anomaly detection (Welford's algorithm)
- **Cross-Stream Correlation** — 14 signal types detecting patterns across news, markets, military, and predictions

### Live News & Video

- **435+ RSS feeds** across geopolitics, defense, energy, tech, and finance with server-side aggregation
- **30+ live video streams** — Bloomberg, Sky News, Al Jazeera, and more with HLS native streaming
- **Custom keyword monitors** — user-defined alerts with word-boundary matching and auto-coloring

### Desktop & Mobile

- **Native desktop app** (Tauri) — macOS, Windows, Linux with OS keychain, local sidecar, and cloud fallback
- **Progressive Web App** — installable with offline map support
- **Mobile-optimized map** — touch pan with inertia, pinch-to-zoom, bottom-sheet popups, GPS centering
- **Responsive layout** — ultra-wide L-shaped layout on 2000px+, collapsible panels

### Platform Features

- **21 languages** — lazy-loaded bundles with native-language RSS feeds, AI translation, and RTL support
- **Cmd+K command palette** — fuzzy search across 24 result types, layer presets, ~250 country commands
- **Proto-first API contracts** — 92 proto files, 22 services, auto-generated TypeScript + OpenAPI docs
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
- **Panel interfaces** — renderers look up by interface, not string key + type-cast
- **ManagedService** — all singleton services implement `init()/destroy()` lifecycle
- **Variant tree-shaking** — `SITE_VARIANT` is a build-time constant, dead code eliminated

### Data Flow

1. **DataLoaderManager** orchestrates parallel fetches from 17+ domain services
2. **NewsClusteringPipeline** handles news loading, Jaccard clustering, categorization
3. **SignalPublisher** manages supplemental bus, CII refresh, intelligence aggregation
4. **DataRenderer** dispatches data to panels via interface contracts
5. Stores emit events on change — subscribers react automatically
6. User interactions go through **EventHandlerManager**

### Variant System

A single codebase produces five specialized dashboards. `SITE_VARIANT` is injected at build time via Vite `define`, enabling tree-shaking of unused variant data:

| Aspect                | World Monitor                                        | Tech Monitor                                    | Finance Monitor                                  | Commodity Monitor                                         | Happy Monitor                                         |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| **Domain**            | worldmonitor.app                                     | tech.worldmonitor.app                           | finance.worldmonitor.app                         | commodity.worldmonitor.app                                | happy.worldmonitor.app                                |
| **Focus**             | Geopolitics, military, conflicts                     | AI/ML, startups, cybersecurity                  | Markets, trading, central banks                  | Mining, metals, energy commodities, critical minerals     | Good news, conservation, human progress               |
| **RSS Feeds**         | 15 categories, 200+ feeds                            | 21 categories, 152 feeds                        | 14 categories, 55 feeds                          | 10 categories, 50+ feeds                                  | 5 categories, 21 positive-news sources                |
| **Panels**            | 45                                                   | 28                                              | 27                                               | 16                                                        | 10                                                    |
| **Desktop App**       | Yes                                                  | Yes                                             | Yes                                              | (web-only)                                                | (web-only)                                            |

---

## Programmatic API Access

Every data endpoint is accessible via `api.worldmonitor.app`:

```bash
# Fetch market quotes
curl -s 'https://api.worldmonitor.app/api/market/v1/list-market-quotes?symbols=AAPL,MSFT,GOOGL'

# Get airport delays
curl -s 'https://api.worldmonitor.app/api/aviation/v1/list-airport-delays'

# Get earthquake data
curl -s 'https://api.worldmonitor.app/api/seismology/v1/list-earthquakes'

# Company enrichment
curl -s 'https://api.worldmonitor.app/api/enrichment/company?domain=stripe.com'
```

All 22 service domains available as `POST /api/{domain}/v1/{rpc-name}`. GET with query params supported for read-only RPCs.

> **Note**: Use `api.worldmonitor.app`, not `worldmonitor.app` — the main domain requires browser origin headers.

---

## Quick Start

```bash
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor
npm install
vercel dev       # Runs frontend + all 60+ API edge functions
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables (Optional)

```bash
cp .env.example .env.local
```

| Group             | Variables                                  | Free Tier                          |
| ----------------- | ------------------------------------------ | ---------------------------------- |
| **AI (Local)**    | `OLLAMA_API_URL`, `OLLAMA_MODEL`           | Free (runs on your hardware)       |
| **AI (Cloud)**    | `GROQ_API_KEY`, `OPENROUTER_API_KEY`       | 14,400 req/day (Groq)              |
| **Cache**         | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | 10K commands/day         |
| **Markets**       | `FINNHUB_API_KEY`, `FRED_API_KEY`, `EIA_API_KEY` | All free tier               |
| **UI**            | `VITE_VARIANT`                             | N/A                                |

See [`.env.example`](./.env.example) for the complete list.

---

## Self-Hosting

### Option 1: Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Option 2: Local Development

```bash
npm install -g vercel
vercel dev                   # Frontend + edge functions on localhost:3000
```

### Option 3: Static Frontend Only

```bash
npm run dev    # Vite dev server on localhost:5173
```

---

## Tech Stack

| Category              | Technologies                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**          | Preact 10, TypeScript 5.7, Vite 6.0                                                                                                            |
| **Maps (3D)**         | globe.gl + Three.js                                                                                                                            |
| **Maps (2D)**         | deck.gl + MapLibre GL                                                                                                                          |
| **Charts**            | D3.js, lightweight-charts                                                                                                                      |
| **Desktop**           | Tauri 2.10 (Rust)                                                                                                                              |
| **AI/ML**             | Ollama, Groq, OpenRouter, Transformers.js (browser), ONNX Runtime Web                                                                          |
| **APIs**              | Protobuf (sebuf codegen), 22 services                                                                                                          |
| **Testing**           | Playwright                                                                                                                                     |
| **i18n**              | i18next (21 languages)                                                                                                                         |
| **Analytics**         | Sentry, Vercel Analytics                                                                                                                       |

---

## Contributing

```bash
# Development
npm run dev              # Full variant (worldmonitor.app)
npm run dev:tech         # Tech variant
npm run dev:finance      # Finance variant
npm run dev:commodity    # Commodity variant
npm run dev:happy        # Happy variant

# Production builds
npm run build:full       # Build full variant
npm run build:tech       # Build tech variant
npm run build:finance    # Build finance variant
npm run build:commodity  # Build commodity variant
npm run build:happy      # Build happy variant

# Quality
npm run typecheck        # TypeScript type checking

# Desktop packaging
npm run desktop:package:macos:full
npm run desktop:package:windows:full
```

---

## Roadmap

**Upcoming:**

- [ ] Mobile-optimized views
- [ ] Push notifications for critical alerts
- [ ] Self-hosted Docker image

---

## Support the Project

- **Star this repo** to help others discover it
- **Share** with colleagues interested in OSINT
- **Contribute** code, data sources, or documentation
- **Report issues** to help improve the platform

---

## License

Licensed under **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**You are free to:** Use, study, modify, and distribute.

**Conditions:** Source code disclosure for network use, same license (copyleft), attribution, state changes.

| Use Case | Allowed? | Condition |
|----------|----------|-----------|
| Personal / internal use | Yes | No conditions |
| Self-hosted deployment | Yes | No conditions if unmodified |
| Forking & modifying | Yes | Must share source under AGPL-3.0 |
| Commercial use | Yes | Must share source under AGPL-3.0 |
| Running as a SaaS/web service | Yes | Must share source under AGPL-3.0 |
| Bundling into a proprietary product | No | AGPL-3.0 copyleft prevents this |

Copyright (C) 2024-2026 Elie Habib. All rights reserved under AGPL-3.0.

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
  <a href="https://worldmonitor.app">worldmonitor.app</a> &nbsp;·&nbsp;
  <a href="https://tech.worldmonitor.app">tech.worldmonitor.app</a> &nbsp;·&nbsp;
  <a href="https://finance.worldmonitor.app">finance.worldmonitor.app</a> &nbsp;·&nbsp;
  <a href="https://commodity.worldmonitor.app">commodity.worldmonitor.app</a>
</p>

## Star History

<a href="https://api.star-history.com/svg?repos=koala73/worldmonitor&type=Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=koala73/worldmonitor&type=Date&theme=dark" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=koala73/worldmonitor&type=Date" />
 </picture>
</a>
