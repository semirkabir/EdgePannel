# Upstream Feature Audit: koala73/worldmonitor → semirkabir/worldmonitor

## Context

**Fork divergence:** You forked from `koala73/worldmonitor` on **2026-03-07** at commit [`cd7d3b75`](https://github.com/koala73/worldmonitor/commit/cd7d3b75) (PR #1194 — "perf(baseline): move temporal baseline for news+fires to server-side"). Latest upstream is from today, 2026-04-16, at PR [#3135](https://github.com/koala73/worldmonitor/pull/3135).

**Scale of divergence (5.5 weeks):**
- **1,535 new upstream commits** (you're 141 ahead on your own additions)
- **2,050 files changed**, +361,488 / −35,645 LOC
- **1,454 net-new files** across 32 top-level directories
- Upstream is shipping ~280 commits/week — feature velocity is high

**Goal of this document:** A two-tier feature audit so you can selectively port what fits your fork. Tier 1 is a curated, opinionated top-picks list (what I'd port first). Tier 2 is the full grouped catalog for browsing.

This is a **suggestion document, not an implementation plan**. Each item below is its own future task — pick one, then we'll plan that port specifically.

---

## Tier 1 — Curated Top Picks (Ranked by Value / Effort)

Ordered by recommended-do-next. Each has a value rating, effort estimate, and the upstream PRs/files to crib from.

### 1. **Proxy-tunnel & curl-multi-retry resilience layer** ⭐ Best ROI
**Value: High · Effort: S (1-2 days)**

Upstream wraps every flaky upstream API (GDELT, Yahoo, Open-Meteo, Comtrade, FIRMS) in a shared proxy fallback util. When direct fetch fails or returns empty, it retries via Decodo curl egress. This is the single highest-leverage thing to steal — your current fork will increasingly hit the same upstream-API drift.

- Key util: `scripts/_gdelt-fetch.mjs`, `scripts/_yahoo-fetch.mjs`, `scripts/_proxy-tunnel.mjs` (consolidated in PR [#2702](https://github.com/koala73/worldmonitor/pull/2702))
- Recent applications: PRs [#3122](https://github.com/koala73/worldmonitor/pull/3122) (GDELT), [#3120](https://github.com/koala73/worldmonitor/pull/3120) (Yahoo), [#3119](https://github.com/koala73/worldmonitor/pull/3119) (Open-Meteo), [#3118](https://github.com/koala73/worldmonitor/pull/3118) (climate normals)
- Pair with circuit-breaker fixes: PRs [#2274](https://github.com/koala73/worldmonitor/pull/2274), [#2415](https://github.com/koala73/worldmonitor/pull/2415) (validation poisoning)

### 2. **Real-time push via SSE/WebSocket for breaking alerts**
**Value: High · Effort: M (3-5 days)**

Long-standing upstream issue [#1227](https://github.com/koala73/worldmonitor/issues/1227). Replaces your current polling for high-priority alerts with server-push. Your fork already added WebSocket data sources (`de21ff7e`), so the plumbing partly exists — this would extend it to alerts.

### 3. **MCP server + chat-with-analyst panel**
**Value: High · Effort: L (1-2 weeks)**

Lets users (and external Claude/agent clients) query your data via Model Context Protocol. Massive surface-area: 39 seeded data sources exposed as MCP tools (issue [#3029](https://github.com/koala73/worldmonitor/issues/3029)).

- API: [`api/mcp.ts`](https://github.com/koala73/worldmonitor/blob/main/api/mcp.ts), [`api/mcp-proxy.js`](https://github.com/koala73/worldmonitor/blob/main/api/mcp-proxy.js), [`api/chat-analyst.ts`](https://github.com/koala73/worldmonitor/blob/main/api/chat-analyst.ts)
- UI: `src/components/ChatAnalystPanel.ts`
- Service: `src/services/mcp-store.ts`
- Reference doc: `AGENTS.md`, `docs/2026-03-27-pro-mcp-server-requirements.md`

### 4. **Supply-Chain Route Explorer + chokepoint visualization**
**Value: High · Effort: L (1-2 weeks)**

Showcase feature: animated trade-route trails, pulsing chokepoints, bypass arc layers, multi-sector cost-shock scenarios with closure-duration slider. Very visual, very impressive.

- UI: `src/components/RouteExplorer/*` (10 files) — sprints in PRs [#2982](https://github.com/koala73/worldmonitor/pull/2982), [#2994](https://github.com/koala73/worldmonitor/pull/2994), [#2996](https://github.com/koala73/worldmonitor/pull/2996), [#3000](https://github.com/koala73/worldmonitor/pull/3000)
- Map layers: PRs [#2914](https://github.com/koala73/worldmonitor/pull/2914) (TripsLayer trails), [#2934](https://github.com/koala73/worldmonitor/pull/2934) (pulsing chokepoints + bypass)
- Backend: `server/worldmonitor/supply-chain/` (16 files), proto in `proto/worldmonitor/supply_chain/v1/`
- Scenarios: [`api/scenario/v1/{run,status,templates}.ts`](https://github.com/koala73/worldmonitor/tree/main/api/scenario)

### 5. **Self-hosting via Docker + Nixpacks**
**Value: Medium · Effort: M (2-4 days)**

If you want anyone (or future-you on a fresh machine) to run your fork without the full Vercel/Railway stack. Includes a relay-only image and a validation-bundle image.

- Files: `Dockerfile`, `Dockerfile.relay`, `docker-compose.yml`, `nixpacks.toml`, `.dockerignore`
- Doc: `SELF_HOSTING.md`, `DEPLOYMENT-PLAN.md`
- CI: `.github/workflows/docker-publish.yml`

### 6. **Resilience scoring v2 (selective port — pick a slice)**
**Value: High · Effort: L-XL (full port = 100+ commits)**

Don't port the whole 3-pillar / 6-dimension / cross-index benchmark stack — too heavy. **Cherry-pick** instead:
- The **5-tier CII upgrade** to a richer composite (existing in your fork)
- One pillar (e.g., recovery capacity, PR [#2987](https://github.com/koala73/worldmonitor/pull/2987))
- Cross-index comparison panel ([#2985](https://github.com/koala73/worldmonitor/pull/2985)) — easy win, just adds INFORM/ND-GAIN/WRI/FSI columns next to your CII

### 7. **AI digest + LLM narrative generation**
**Value: Medium · Effort: M (3-5 days)**

Daily/regional briefs synthesized by Anthropic/Groq, delivered via email/Telegram/Discord. Pairs nicely with your existing notification system.

- Services: `server/_shared/llm.ts`, `llm-health.ts`
- PRs: [#2960](https://github.com/koala73/worldmonitor/pull/2960) (regional narrative), [#2989](https://github.com/koala73/worldmonitor/pull/2989) (Phase 3 briefs), [#2876](https://github.com/koala73/worldmonitor/pull/2876) (AI-enriched digest), [#3018](https://github.com/koala73/worldmonitor/pull/3018) (time-of-day greeting)

### 8. **CF edge caching + Redis pipeline batching**
**Value: Medium · Effort: S-M (2-3 days)**

PR [#2829](https://github.com/koala73/worldmonitor/pull/2829) reportedly saved ~25M requests/week at the edge. PR [#2773](https://github.com/koala73/worldmonitor/pull/2773) batches Redis reads in groups of 10. Both are pure perf wins with no UX risk.

### 9. **Stock analytics suite (analyst consensus / dividends / insider txns)**
**Value: Medium · Effort: M (3-5 days)**

Three panels, each in its own PR — easy to port one at a time.
- Analyst consensus + price targets: PR [#2926](https://github.com/koala73/worldmonitor/pull/2926)
- Dividend growth: PR [#2927](https://github.com/koala73/worldmonitor/pull/2927)
- Insider transactions: PR [#2928](https://github.com/koala73/worldmonitor/pull/2928)
- Sector P/E heatmap: PR [#2929](https://github.com/koala73/worldmonitor/pull/2929)

### 10. **Discord OAuth notification channel**
**Value: Medium · Effort: S (1-2 days)**

Generic webhook channel (PR [#2887](https://github.com/koala73/worldmonitor/pull/2887)) plus Discord OAuth2 (PR [#2596](https://github.com/koala73/worldmonitor/pull/2596)). You already have notification infra; this just adds a new sink.

### 11. **Gold V2 panel + Hyperliquid perp positioning**
**Value: Medium · Effort: M (3 days)**

Niche-but-flashy: PR [#3034](https://github.com/koala73/worldmonitor/pull/3034) (gold positioning depth, returns, drivers), [#3037](https://github.com/koala73/worldmonitor/pull/3037) (SPDR GLD flows), [#3074](https://github.com/koala73/worldmonitor/pull/3074) (Hyperliquid as leading indicator).

### 12. **Auth/payments stack (Clerk + Dodo) — only if monetizing**
**Value: High if monetizing, zero otherwise · Effort: L (1-2 weeks)**

Major commitment. You already shipped a paid-subscription *notice* (`e54d29e7`); this would replace the notice with real entitlement gating.
- Payments core: PR [#2024](https://github.com/koala73/worldmonitor/pull/2024) (Dodo + entitlement engine + webhooks)
- Catalog: PR [#2649](https://github.com/koala73/worldmonitor/pull/2649) (single source of truth, live IDs)
- Convex backend: `convex/entitlements.ts`, `convex/alertRules.ts`, `convex/config/productCatalog.ts`
- PRO gating: `src/services/entitlements.ts`, `src/services/panel-gating.ts`
- Newer: usage-based metered billing (issue [#3117](https://github.com/koala73/worldmonitor/issues/3117)), user API key management ([#3116](https://github.com/koala73/worldmonitor/issues/3116) / PR [#3125](https://github.com/koala73/worldmonitor/pull/3125))

---

## Tier 2 — Complete Catalog by Area

### A. Authentication, Payments & Subscriptions
| Feature | PR(s) | Files |
|---|---|---|
| Dodo Payments + entitlement engine + webhook pipeline | [#2024](https://github.com/koala73/worldmonitor/pull/2024) | `convex/entitlements.ts`, `api/create-checkout.ts`, `convex/__tests__/{checkout,webhook}.test.ts` |
| Clerk auth integration + token retry | [#2632](https://github.com/koala73/worldmonitor/pull/2632), [#2640](https://github.com/koala73/worldmonitor/pull/2640) | server `_shared/auth-session.ts` |
| Subscription welcome + admin notification email | [#2809](https://github.com/koala73/worldmonitor/pull/2809) | `api/notify.ts` |
| Live Dodo prices with Redis cache + fallback | [#2653](https://github.com/koala73/worldmonitor/pull/2653) | `api/_product-fallback-prices.js` |
| Product catalog as single source of truth | [#2649](https://github.com/koala73/worldmonitor/pull/2649) | `src/config/products.ts`, `convex/config/productCatalog.ts` |
| PRO entitlement check before delivery | [#2899](https://github.com/koala73/worldmonitor/pull/2899) | `server/_shared/entitlement-check.ts` |
| Gate all endpoints behind PRO | [#2852](https://github.com/koala73/worldmonitor/pull/2852) | `server/_shared/premium-check.ts` |
| User API key management (in flight) | [#3125](https://github.com/koala73/worldmonitor/pull/3125), [#3116](https://github.com/koala73/worldmonitor/issues/3116) | TBD |
| Usage-based metered billing (open) | [#3117](https://github.com/koala73/worldmonitor/issues/3117) | TBD |

### B. Self-Hosting / Deployment Infrastructure
| Feature | Files / PR |
|---|---|
| Dockerfile (main app) | `Dockerfile` |
| Dockerfile.relay (AIS relay only) | `Dockerfile.relay` |
| Validation bundle Docker + Railway cron | `Dockerfile.seed-bundle-resilience-validation`, PR [#3023](https://github.com/koala73/worldmonitor/pull/3023), [#3031](https://github.com/koala73/worldmonitor/pull/3031) |
| docker-compose for local dev | `docker-compose.yml` |
| Nixpacks config (Railway) | `nixpacks.toml` + PR [#3023](https://github.com/koala73/worldmonitor/pull/3023) |
| Self-hosting docs | `SELF_HOSTING.md`, `DEPLOYMENT-PLAN.md`, `ARCHITECTURE.md`, `AGENTS.md` |
| Health/bootstrap parity | PR [#3015](https://github.com/koala73/worldmonitor/pull/3015), [#3056](https://github.com/koala73/worldmonitor/pull/3056) |
| Wall-time budget (avoid Railway 10min SIGKILL) | PR [#3094](https://github.com/koala73/worldmonitor/pull/3094) |
| CI: docker-publish, deploy-gate, contributor-trust | `.github/workflows/` |
| Seeder-loop heartbeats | PR [#3133](https://github.com/koala73/worldmonitor/pull/3133) |

### C. AI / MCP / Chat-Analyst / Agentic
| Feature | PR(s) | Files |
|---|---|---|
| MCP server endpoint | — | [`api/mcp.ts`](https://github.com/koala73/worldmonitor/blob/main/api/mcp.ts), `api/mcp-proxy.js`, `api/widget-agent.ts` |
| Chat-with-analyst panel | — | `api/chat-analyst.ts`, `src/components/ChatAnalystPanel.ts` |
| MCP coverage of 39 data sources (open) | [#3029](https://github.com/koala73/worldmonitor/issues/3029) | TBD |
| LLM narrative generator (regional snapshots) | [#2960](https://github.com/koala73/worldmonitor/pull/2960) | `server/_shared/llm.ts` |
| Phase 3 regional briefs (LLM seeder + RPC) | [#2989](https://github.com/koala73/worldmonitor/pull/2989) | server `intelligence/` |
| AI-enriched digest delivery | [#2876](https://github.com/koala73/worldmonitor/pull/2876) | digest pipeline |
| Per-event AI impact analysis | [#2886](https://github.com/koala73/worldmonitor/pull/2886) | server `intelligence/` |
| Time-of-day-aware brief greeting | [#3018](https://github.com/koala73/worldmonitor/pull/3018) | digest |
| Topic-aware digest search hallucination fix | [#2677](https://github.com/koala73/worldmonitor/pull/2677) | LLM prompts |
| Relay recomputes importanceScore post-LLM + parity test | [#3069](https://github.com/koala73/worldmonitor/pull/3069) | relay |
| AGENTS.md (architecture spec) | — | `AGENTS.md` |
| MCP requirements doc | — | `docs/2026-03-27-pro-mcp-server-requirements.md` |
| Iran crisis structured analysis layer (open) | [#3103](https://github.com/koala73/worldmonitor/issues/3103) | TBD |
| AI Agent desktop UI w/ web search (open) | [#1099](https://github.com/koala73/worldmonitor/issues/1099) | TBD |

### D. Performance & Resilience Patterns
| Feature | PR(s) |
|---|---|
| Proxy tunnel consolidated into shared utils | [#2702](https://github.com/koala73/worldmonitor/pull/2702) |
| GDELT curl-multi-retry proxy | [#3122](https://github.com/koala73/worldmonitor/pull/3122) |
| Yahoo via Decodo curl egress | [#3120](https://github.com/koala73/worldmonitor/pull/3120), [#3134](https://github.com/koala73/worldmonitor/pull/3134) |
| Open-Meteo curl-only fallback | [#3119](https://github.com/koala73/worldmonitor/pull/3119) |
| Climate-normals proxy fallback | [#3118](https://github.com/koala73/worldmonitor/pull/3118) |
| Fuel-prices resilient seeder (proxy + retry + stale carry-forward) | [#3082](https://github.com/koala73/worldmonitor/pull/3082) |
| CF edge caching (~25M req/wk saved) | [#2829](https://github.com/koala73/worldmonitor/pull/2829) |
| Batch Redis pipeline reads (groups of 10) | [#2773](https://github.com/koala73/worldmonitor/pull/2773) |
| Batch PRO entitlement check | [#2917](https://github.com/koala73/worldmonitor/pull/2917) |
| Chunked warm SET + always-on rebuild | [#3124](https://github.com/koala73/worldmonitor/pull/3124) |
| Reddit traffic 6× reduction (hourly cadence) | [#3135](https://github.com/koala73/worldmonitor/pull/3135) |
| Halve aviation seed cadence (30min) | [#3073](https://github.com/koala73/worldmonitor/pull/3073) |
| Circuit-breaker validation poisoning fix | [#2274](https://github.com/koala73/worldmonitor/pull/2274), [#2415](https://github.com/koala73/worldmonitor/pull/2415) |
| Add cacheKey to aviation/arxiv/trending/HN breakers | [#2323](https://github.com/koala73/worldmonitor/pull/2323), [#2328](https://github.com/koala73/worldmonitor/pull/2328) |
| Strict-floor validators must not poison metadata | [#3078](https://github.com/koala73/worldmonitor/pull/3078) |
| Gzip on all `https.request` calls | [#1681](https://github.com/koala73/worldmonitor/pull/1681) |
| Smart pre-push test selection | [#2834](https://github.com/koala73/worldmonitor/pull/2834) |
| Lighthouse-100 push (Phases 19–23, accessibility, code-splitting) | [#3106](https://github.com/koala73/worldmonitor/pull/3106), [#3107](https://github.com/koala73/worldmonitor/pull/3107)–[#3113](https://github.com/koala73/worldmonitor/pull/3113), [#3129](https://github.com/koala73/worldmonitor/pull/3129) |
| Eliminate barrel files / variant-based chunks | [#3113](https://github.com/koala73/worldmonitor/pull/3113) |

### E. New Data Sources & Seeders (sample — full list in upstream `scripts/`)
- **IMF SDMX 3.0 migration** — [#3020](https://github.com/koala73/worldmonitor/pull/3020); IMF WEO expansion [#3046](https://github.com/koala73/worldmonitor/pull/3046)
- **BIS DSR + property prices** — [#3048](https://github.com/koala73/worldmonitor/pull/3048)
- **Eurostat house prices, debt, IIP** — [#3047](https://github.com/koala73/worldmonitor/pull/3047)
- **IEA 2026 Energy Crisis Policy Tracker** — [#3008](https://github.com/koala73/worldmonitor/pull/3008)
- **Oil Inventories panel + SVG charts** — [#3003](https://github.com/koala73/worldmonitor/pull/3003)
- **ENTSO-E + EIA-930 electricity spot** — [#2712](https://github.com/koala73/worldmonitor/pull/2712)
- **Comtrade bilateral HS4** — [#2921](https://github.com/koala73/worldmonitor/pull/2921)
- **FAO Food Price Index** — [#2682](https://github.com/koala73/worldmonitor/pull/2682)
- **CoinPaprika primary + CoinGecko fallback** — [#3086](https://github.com/koala73/worldmonitor/pull/3086)
- **INFORM 2026 / UNDP HDI / WRI via HDX** — [#3068](https://github.com/koala73/worldmonitor/pull/3068)
- **Tzeva Adom (Hebrew translation)** — [#2863](https://github.com/koala73/worldmonitor/pull/2863)
- **IRWatch.org Iran OSINT (open)** — [#3137](https://github.com/koala73/worldmonitor/issues/3137)

### F. New UI Panels & Map Layers
- Energy Crisis Policy panel — [#3008](https://github.com/koala73/worldmonitor/pull/3008)
- Oil Inventories with SVG charts — [#3003](https://github.com/koala73/worldmonitor/pull/3003)
- Regional Intelligence Board — [#2963](https://github.com/koala73/worldmonitor/pull/2963)
- Liquidity Shifts panel — [#3070](https://github.com/koala73/worldmonitor/pull/3070)
- Animated trade-route trails (TripsLayer) — [#2914](https://github.com/koala73/worldmonitor/pull/2914)
- Pulsing chokepoints + bypass arc layer — [#2934](https://github.com/koala73/worldmonitor/pull/2934)
- Click-to-toggle flight trail on DeckGL — [#2867](https://github.com/koala73/worldmonitor/pull/2867)
- Severity-aware pulse dot on headers — [#2860](https://github.com/koala73/worldmonitor/pull/2860)
- CMD+K entry for resilience layer toggle — [#2833](https://github.com/koala73/worldmonitor/pull/2833)
- New domain panels in `src/components/`: `CorrelationPanel`, `ForecastPanel`, `ResilienceWidget`, `ThermalEscalationPanel`, `RadiationWatchPanel`, `DailyMarketBriefPanel`, `MarketImplicationsPanel`, `SanctionsPressurePanel`, `HormuzPanel`

### G. Notifications & Alerts
- Generic webhook channel — [#2887](https://github.com/koala73/worldmonitor/pull/2887)
- Discord OAuth2 notification — [#2596](https://github.com/koala73/worldmonitor/pull/2596)
- Telegram OSINT/adversary expansion — [#2848](https://github.com/koala73/worldmonitor/pull/2848)
- Telegram auto-add to alert rules + pairing — [#2594](https://github.com/koala73/worldmonitor/pull/2594), [#2595](https://github.com/koala73/worldmonitor/pull/2595)
- Proactive intelligence agent (Phase 4) — [#2889](https://github.com/koala73/worldmonitor/pull/2889)
- Digest mode + quiet-hours scheduling — [#2614](https://github.com/koala73/worldmonitor/pull/2614), [#2615](https://github.com/koala73/worldmonitor/pull/2615)
- Regional state-change alerts from diff engine — [#2966](https://github.com/koala73/worldmonitor/pull/2966)
- Redesigned intelligence brief email template — [#2933](https://github.com/koala73/worldmonitor/pull/2933)
- Deduplicate near-identical stories — [#2724](https://github.com/koala73/worldmonitor/pull/2724)
- Notification-relay bug fixes (in flight) — [#3136](https://github.com/koala73/worldmonitor/pull/3136), [#3127](https://github.com/koala73/worldmonitor/pull/3127)

### H. Long-Standing Open Feature Requests (community asks)
- **#1227** — Real-time push (SSE/WebSocket) for breaking alerts
- **#904** — Dynamic panel layout customization
- **#1310** — Global health dashboard (WHO/ECDC/PubMed)
- **#1099** — AI Agent desktop UI w/ live web search
- **#1010** — Major company earnings reports panel
- **#680** — Stock/market index customization
- **#649** — User-configurable news feed sources
- **#1419** — Chromecast casting

---

## Caveats & Risks

- **Don't bulk-merge.** Upstream rebased and refactored aggressively (e.g., `vite.config.ts` ±1,201 lines, `package-lock.json` +23k). A `git merge upstream/main` will produce a conflict storm. Cherry-pick by feature.
- **Resilience scoring v2 is a swamp.** 100+ commits with cross-cutting schema changes and a parity linter. Don't attempt full port — pick one slice.
- **Convex dependency** introduced for entitlements/alertRules. If you port payments/auth, you take on Convex too (or rewrite to your stack).
- **Proto changes are breaking.** New proto services in `proto/worldmonitor/` regenerate clients in `src/generated/` — don't hand-edit, run the buf pipeline (`make generate`).
- **Your fork's diverged paths** (custom `event-handlers.ts`, panel CSS, playback) will conflict with upstream's parallel reworks. Inspect those files before porting anything that touches them.
- **License/credit:** When porting, preserve upstream commit attribution where reasonable (`git cherry-pick -x` adds the source SHA).

---

## Verification (Per-Port Checklist)

When you decide to port a specific feature, the workflow is:

1. **Scope:** Open a planning task for that single feature; produce a per-port plan.
2. **Cherry-pick or copy:**
   - For atomic PRs: `git cherry-pick <upstream-sha>` (use `-x` for attribution).
   - For multi-file panels: copy files, then re-resolve imports / variant config.
3. **Regenerate proto** (if proto changed): `make generate`
4. **Run quality gates:** `npm run typecheck`, `npm run lint:md`, `npm run check:unsafe-dom`, `npm run check:size-budgets`
5. **Run tests:** `npm run test:data` (unit), `npm run test:e2e:full` (E2E for the active variant)
6. **Smoke in browser:** `npm run dev` and click through the new panel/map layer; check console for errors.
7. **Visual regression** (if UI): `npm run test:e2e:visual`
8. **Commit per feature**, not per file — easier to revert if a port misbehaves.

---

## Suggested Next Step

Pick one item from Tier 1 (recommend starting with **#1 proxy-tunnel resilience** as the lowest-risk, highest-leverage starter) and ask me to plan that specific port. We'll do a focused exploration of the upstream files, your fork's relevant code, and a step-by-step diff plan.