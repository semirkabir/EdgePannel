# EdgePannel — Competitor Market Research & Gap Analysis

**Date:** 2026-08-24 · **Scope:** Real-time intelligence dashboards, conflict/geopolitical
tracking, OSINT platforms, enterprise risk-intelligence, and the vertical trackers
(aviation/maritime) EdgePannel overlaps with.

**Method:** Vendor sites, pricing pages, AWS Marketplace, G2/Capterra listings, App Store
listings, and press releases. Pricing marked with confidence: ✔ = published price,
~ = third-party/secondary source, * = custom/enterprise quote.

---

## TL;DR

EdgePannel sits in a **white space nobody occupies end-to-end**: a *free*, multi-domain
(map + globe, 60 layers, 680+ feeds, AI briefs, desktop app, 21 languages) unified
situational-awareness dashboard. Its competitors each beat it badly in **one dimension**
but none combine its breadth:

- **Dataminr** beats it on *speed & source breadth* (1M+ sources vs 680 feeds) — enterprise-only, $$$$.
- **Crisis24 Horizon** beats it on *human analyst validation & granular risk ratings* — enterprise-only.
- **Liveuamap** beats it on *on-the-ground OSINT & geolocated field media* — narrow (conflicts), ad-funded.
- **Janes / RANE / ACLED / GDELT** beat it on *data depth, validation, and history* — no unified map UI (or free data only).
- **Ground News / NewsWhip** beat it on *media-bias lens & engagement prediction* — no geospatial layer.
- **Flightradar24** beats it on *aviation depth* (own sensor network, flight history) — single domain.

The biggest structural gaps to close (see §3): **source breadth + first-mover detection**,
**human-validated data layer**, **granular sub-country risk ratings**, and **proprietary
sensor/feeder networks** (the FR24 model).

---

## 1. Competitive landscape (3 tiers)

### Tier A — Direct competitors (map-centric real-time event/intel)

| Competitor | What they are | Key facts |
|---|---|---|
| **Liveuamap** | Map-centric news platform for conflicts, protests, disasters, terrorism | Founded 2014 (Ukraine); 30+ regions/topics; AI crawlers + **human editors fact-check**; free ad-supported; PRO ($1.99/mo ✔) removes ads + satellite maps; enterprise API & social-data-mining services; used by UN, partners with ACLED (Syria) |
| **Ground News** | News aggregation with bias/factuality comparison | 50,000+ sources ✔; bias ratings from AllSides/Ad Fontes/MBF Check; story clustering across the spectrum; blindspot detection; **Vantage $8.33/mo billed annually** ✔; iOS/Android/web; **no map layer, no OSINT** |
| **Crisis24 Horizon** (GardaWorld) | Enterprise travel-risk & security-intelligence platform ("duty of care") | 200,000+ sources, 35+ languages; **200+ human analysts** (largest private-sector team); world map tracking people/sites; risk ratings across **27 categories at 0.25-increment granularity** for 200+ countries/800+ provinces/400+ cities; "Ask Horizon" AI; mass notification (SMS/app/email, two-way check-ins); enterprise pricing * |

### Tier B — Enterprise real-time intelligence (the "we have a bigger firehose" tier)

| Competitor | What they are | Key facts |
|---|---|---|
| **Dataminr** | AI real-time event/threat/risk alerting for enterprises & gov | **1M+ public sources**, 150+ languages, 220+ countries; multi-modal fusion (text/image/video/audio/sensor); ~500K events/day; ReGenAI live-evolving briefs; agentic "Intel Agents"; Pulse Team modules **$65,000/12mo each** on AWS Marketplace ✔ (Corporate/Brand/Cyber Risk); customers incl. 100+ US gov agencies, NATO; known weakness: alert noise / cluttered UI (G2) |
| **NewsWhip Spike** | Real-time media & social monitoring with engagement prediction | Tracks web + social (Facebook, X, Reddit, TikTok, YouTube, Instagram); **predicts which stories will go viral**; AI monitoring agents; 7+ years historical data; API; enterprise pricing * (publishers, brands, PR, gov) |
| **Flashpoint / Echosec** | Geospatial OSINT: social media + fringe networks + dark web search by location | Real-time geolocated social search (mainstream → fringe forums → messaging apps → dark web); no search expertise needed; used by security/LE; Basic tier **$1,000/mo** ✔ (Capterra) |

### Tier C — Data depth & authority (they ARE the source)

| Competitor | What they are | Key facts |
|---|---|---|
| **ACLED** | Canonical near-real-time political-violence & protest event data | Structured events (date, location, actors, fatalities, type); global coverage, Africa back to 1997; free access tiers + API; the research gold standard (UN/World Bank cite it). **EdgePannel already consumes ACLED.** |
| **GDELT** | Free open global event database + knowledge graph | Monitors broadcast/print/web news in **100+ languages every 15 min**; free APIs; historical ambition back to 1800; Google Jigsaw-supported; research-grade, no polished UI |
| **Janes** | Defense intelligence (validated, decision-grade) | Expert-collected & validated: equipment/weapons/sensors, military capabilities, orders of battle, country & CBRN profiles, budgets/forecasts; "Ask Janes" AI; machine-readable & integration-ready; enterprise * (gov/defense) |
| **RANE Worldview** (ex-Stratfor) | Geopolitical analysis & forecasting | Analyst-written reports, scenario planning; individual **$199–349/yr**, enterprise **$50K+/yr** (~ third-party source); deep on "what it means", weak on live map |

### Tier D — Platforms & vertical trackers (partial overlap)

| Competitor | What they are | Key facts |
|---|---|---|
| **Palantir** (Gotham/Foundry/AIP) | Government/enterprise intelligence platform | Data fusion, ontology, graph/geospatial analysis, alerts, prediction, secure enclaves, disconnected ops; the enterprise intel standard; custom pricing (typically millions/yr) |
| **Privateer** (ex-Orbital Insight) | Satellite-imagery + AI geospatial analytics | GO platform infers economic/activity signals from imagery (oil storage, parking lots, retail, crops, ship counts); defense & finance customers; enterprise * |
| **Flightradar24** | Live flight tracking (the aviation vertical) | **Crowdsourced ADS-B feeder network** (thousands of volunteer receivers); free tier; Silver **$14.99/yr**, Gold **$34.99/yr**, Business **$499.99/yr** ✔; 3-year flight history (Business); 60+ premium features; 1M+ subscribers; separate paid API |

*Also adjacent but not tabled: Meltwater (enterprise media monitoring), Bloomberg/Reuters terminals
(geopolitics modules at ~$30K/yr), Google Earth (basemap, not intel), OSINT toolkits like Maltego
(graph analysis, not a dashboard).*

---

## 2. What they have over us — the gap list (ranked by threat)

1. **Source breadth & first-mover detection.** Dataminr ingests 1M+ sources incl. social,
   sensors, imagery; Crisis24 200K+. EdgePannel: **~680 curated RSS feeds**. We are
   2–3 orders of magnitude narrower, and RSS polling is minutes-behind by design. We
   cannot detect "event before it hits the news" — Dataminr's entire value prop.
2. **Human-validated data layer.** Liveuamap (editors), Crisis24 (200+ analysts), Janes
   (expert collectors), ACLED (methodology review) all put humans in the loop. EdgePannel
   is AI-only for synthesis — a trust gap for serious/professional users.
3. **Granular sub-country risk ratings.** Crisis24 rates 200+ countries / 800+ provinces /
   400+ cities at 0.25 granularity across 27 categories. EdgePannel's CII is
   country-level, 5-tier. No city/province risk, no category decomposition, no
   mitigation advice.
4. **Proprietary sensor / feeder networks.** Flightradar24's volunteer ADS-B network and
   Echosec's platform/API access are structural moats we can't rent. EdgePannel depends
   on third-party free-tier APIs (AviationStack, AISstream) — rate-limited and shallow.
5. **Imagery & CV-based activity analytics.** Privateer/Orbital Insight infer
   infrastructure/economic activity from satellite imagery. EdgePannel has **no imagery
   layer at all** (gap noted in our own tool evaluations: Copernicus DEM + OBM footprints
   is the cheap entry).
6. **Social engagement velocity.** NewsWhip predicts which stories will blow up using
   engagement data across platforms. EdgePannel has news clustering but no social-signal
   layer.
7. **Research-grade historical depth.** GDELT (decades, free), ACLED (1997+), Janes
   archives, FR24 (3-yr flight history). EdgePannel's time-range playback is bounded by
   recent data.
8. **Enterprise workflows.** Mass notification / duty-of-care check-ins (Crisis24),
   SIEM/ticketing integrations (Dataminr), wargaming & ops planning (Janes, Palantir).
   EdgePannel is consumer/prosumer — no org workflows.
9. **Deep defense data.** Janes' validated equipment, orders of battle, budgets, and
   forecasts have no open equivalent. EdgePannel's military layer is news-derived markers.
10. **Media-bias & factuality framing.** Ground News' rating stack (3 third-party raters)
    is a differentiator for trust-conscious consumers; EdgePannel ranks sources by tier
    internally but exposes no bias/factuality lens.

## 3. Where EdgePannel wins (don't concede these)

- **Price/access:** free, no-account core vs $65K/yr (Dataminr), $50K+/yr (RANE), six-figure
  enterprise deals (Crisis24/Palantir). GDELT is free but has no UI; ACLED free tier is raw data.
- **Unified map + globe, 60 layers, 11 categories:** nobody else runs a real-time globe +
  flat map with conflict/military/cyber/maritime/space/economy layers in one pane.
  Liveuamap is flat-map conflict-only; Dataminr's map is an alert view; Ground News has no map.
- **Desktop app + offline PWA:** Liveuamap/FR24 have mobile apps; the others are web/enterprise SaaS.
- **Local-first AI (Ollama/LM Studio):** no competitor offers on-device, private LLM briefs.
- **21 languages incl. RTL + native-language feeds:** Dataminr covers 150 languages for
  *alerting*, but not as a user-facing multilingual product.
- **Extensibility:** Marketplace + Workspaces + proto-first API with typed clients — closest
  competitor analogue is GDELT's open API (data only) or Palantir (closed, expensive).
- **Multi-domain breadth:** conflicts + cyber + markets + commodities + environment + space
  in one dashboard; FR24 is aviation-only, Liveuamap conflict-only, NewsWhip media-only.

## 4. Comparison table

| Competitor | Category | Data & sources | Real-time | Map/globe | AI/analytics | Price | What they have over us | Where we win |
|---|---|---|---|---|---|---|---|---|
| **Liveuamap** | Conflict/news map | AI crawlers + human-edited field reports, 30+ regions | ✅ min-level | Flat map only | Basic | Free / PRO $1.99/mo ✔ | On-the-ground geolocated photos/videos; editorial fact-checking; UN/ACLED credibility; open historical archive | Free 60-layer globe+map; multi-domain (not just conflict); AI briefs; desktop app; API |
| **Ground News** | Bias-aware news | 50K+ sources ✔ | ✅ | ❌ | Bias/factuality ratings, blindspots | Vantage $8.33/mo ✔ | Third-party bias/factuality stack; blindspot detection; ownership transparency; 5M+ consumer brand | Map+globe; OSINT signals; local AI; price (free vs sub); no political framing dependence |
| **Crisis24 Horizon** | Enterprise risk intel | 200K+ sources, 35+ langs + 200+ analysts | ✅ | ✅ people/sites map | Ask Horizon AI | Enterprise * | Human analyst team; 0.25-granularity risk ratings (27 categories); city/province depth; mass notification & check-ins; travel duty-of-care | Free; no-account; unified multi-domain dashboard; desktop; local AI privacy |
| **Dataminr** | Enterprise real-time alerts | 1M+ sources, 150 langs, sensors/imagery | ✅✅ minutes-ahead | ✅ alert map | Fusion AI + ReGenAI + agents | $65K/yr/module ✔ | Detection speed; source scale; multi-modal; SIEM/ticketing integrations; gov/NATO trust | Price; self-serve; transparency; globe; marketplace; no lock-in |
| **NewsWhip Spike** | Media/social monitoring | Web + FB/X/Reddit/TikTok/YT/IG | ✅ | ❌ | Engagement prediction, AI agents | Enterprise * | Predicts virality; 7-yr history; social-velocity signals; publisher workflows | Geospatial context; OSINT; free; map; conflict/cyber depth |
| **Flashpoint / Echosec** | Geospatial OSINT | Social + fringe + dark web by location | ✅ | ✅ geosearch | Search/AI assist | From $1,000/mo ✔ | Fringe/dark-web reach; people/place/topic geosearch; no-expertise-required UX | Price; breadth of layers; AI briefs; marketplace; desktop |
| **ACLED** | Conflict data (source) | Methodologically curated events, 1997+ | ✅ near-real-time | ❌ (dashboards only) | — | Free tiers + API ✔ | Canonical, citable data; research-grade methodology; historical depth | We consume them — turn ACLED data into a live map UX they don't ship |
| **GDELT** | Event database (source) | 100+ langs, every 15 min, decades | ✅ | ❌ | — | 100% free ✔ | Scale; depth; research API | Curated UX, 60 layers, AI synthesis, desktop — they have no product layer |
| **Janes** | Defense intel | Expert-validated equipment/OB/budgets | ✅ | ❌ (data only) | Ask Janes | Enterprise * | Validated orders of battle; equipment specs; forecasts; wargaming workflows | Price; live map; speed; OSINT breadth; free access |
| **RANE Worldview** | Geopolitical analysis | Analyst reports & forecasts | ⚠️ briefings | ❌ | — | $199–349/yr ind., $50K+ ent. ~ | Analyst-written "what it means"; scenario planning; enterprise advisory | Live data layer; map/globe; AI briefs at any moment; price |
| **Palantir** | Enterprise intel platform | Client data + open fusion | ✅ | ✅ geospatial | AIP | Custom ($$$M) | Ontology/graph fusion; prediction; secure enclaves; disconnected ops; org-scale collaboration | Self-serve; free; transparent; no data residency lock-in; consumer-grade UX |
| **Privateer (ex-Orbital Insight)** | Imagery analytics | Satellite imagery + CV | ⚠️ periodic | ✅ | CV activity inference | Enterprise * | Imagery-based economic/infrastructure signals (oil, retail, crops, ships) | We could add imagery cheaply (Copernicus/OBM); price; live news context |
| **Flightradar24** | Aviation vertical | Crowdsourced ADS-B network | ✅ | ✅ | — | Free / $14.99–499.99/yr ✔ | Own sensor network; 3-yr flight history; 60+ features; 1M+ subscriber brand | Multi-domain (aviation is 1 of 60 layers); free; globe; AI; conflict/cyber breadth |

## 5. Strategic implications (codebase-mapped)

1. **GDELT as a free event backbone** → new `DataSourceId` in `map-layer-definitions.ts`
   (events layer, e.g. `gdeltEvents`), served via a sidecar precompute that normalizes
   GDELT 2.0 events to our proto `ConflictEvent` shape. Cheap, massive coverage win —
   closes gap #1 (breadth) without enterprise budgets. Fits the existing
   `ManagedService` + freshness-tray pattern exactly.
2. **Human-validation layer via marketplace** → "Verified by analyst" badges for
   community-contributed sources/layers; let vetted analysts (Liveuamap/ACLED-style)
   publish curated layers through the existing Marketplace. Closes gap #2 at zero infra cost.
3. **Granular risk ratings** → extend CII with sub-country scoring once we have
   geocoded event density (GDELT/ACLED) — city/province risk tiles. Closes gap #3,
   reuses the existing choropleth renderer.
4. **Crowd-feeder model (FR24-style)** → opt-in telemetry/feeds from desktop installs
   (community ADS-B/AIS receivers, OREF-style relays) as a first-party data moat.
5. **Social-velocity signals** → NewsWhip-style engagement tracking is API-accessible
   per-platform; a sidecar poller feeding a `heat` weight into news clustering
   (Hotspot Escalation) is a contained feature. Closes gap #6.
6. **Imagery layer** → Copernicus GLO-30 DEM 3D Tiles + OBM footprints (already proposed
   in tool evaluations) as the cheap entry; satellite-CV analytics (Privateer-style)
   only as a marketplace partner integration.

**Suggested next steps:** (a) deep-dive Dataminr/Crisis24 pricing & packaging to size the
threat precisely, (b) spike the GDELT layer (one region, one week of events), (c) draft a
public comparison page ("vs Liveuamap / vs Ground News / vs Dataminr") for edgepannel.com —
we win the price + breadth axis and should say so.
