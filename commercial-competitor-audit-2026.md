# Commercial Competitor Audit — EdgePannel

Research date: Aug 11, 2026. Scope: commercial real-time global-intelligence platforms an institutional analyst would actually use. Pricing verified against vendor pages/listings where public; all "quote-based" items are enterprise-negotiated.

---

## 1. Dataminr — dataminr.com

**Access/pricing:** No free tier. Enterprise contracts, demo-gated. Capterra lists a ~$15,000/yr starting price; AWS Marketplace sells "First Alert" with custom contract pricing. API access for enterprise customers.
**Core features:** AI event/threat/risk detection across 1M+ public sources, 150+ languages, 220+ countries; ~500K events detected daily. Product line: First Alert (public sector/corporate security), Dataminr Pulse (news/media), Dataminr for Cyber Defense (post-ThreatConnect acquisition, fuses external signals with internal telemetry). 50+ proprietary LLMs; ReGenAI auto-regenerating event briefs (claimed 99.5% accuracy); alert triage/prioritization; mass-notification and escalation workflows; solutions for diplomatic security, emergency management, force protection, law enforcement, transportation/infrastructure protection, digital risk.
**Data sources:** Public data — social, news, web, dark web, government feeds; plus (new) internal org telemetry for cyber.
**Visualization/UX:** Alert-feed-first (not map-first): ranked alert stream with map view, event timeline, "why this matters" AI briefs, per-alert metadata. Integration hub rather than standalone dashboard.
**Unique capabilities:** Detection speed + precision at planetary scale; event-confidence triage; agentic AI context ("Agentic AI for context"); live-updating briefs as events evolve.
**vs EdgePannel:** Dataminr is the "event detection + alert ops" layer EdgePannel's news clustering approximates — but with per-alert confidence scoring, auto-regenerating briefs, and outbound alert-to-action workflows EdgePannel lacks.

## 2. Bloomberg Terminal / Bloomberg Intelligence — professional.bloomberg.com

**Access/pricing:** ~$31,980/terminal/yr (single, 2026); ~$28,320/seat with multi-terminal contracts. Bloomberg Intelligence research included for subscribers; Bloomberg Professional App (mobile). Data APIs (BQL/BLPAPI/SAPI) gated to subscribers.
**Core features:** 40,000+ function codes across markets, economics (ECO/WEI/CBI), news (N), company data (DES/FA), charting (G), portfolio tools (PORT), messaging (IB), plus Bloomberg Intelligence (BI) — sell-side-grade research: equity/credit research, ESG, litigation risk, data-driven thematic pieces (e.g., China property stress, US election scenarios).
**Data sources:** Proprietary market data + 10,000+ contributed sources; company filings, government statistics, analyst research; BI analysts.
**Visualization/UX:** Function-code command line + function menus (mnemonic-driven, e.g., `TOP`, `ECO <GO>`), embeddable charting (G), "snap quote" workflow, cross-asset time series consistency. Dense, keyboard-first; no unified map view.
**Unique capabilities:** Authoritative cross-asset time series with 20+ yr history; consistent adjusted data across every asset class; function library as a language; BI research machine; the de-facto institutional standard (job-market relevance).
**vs EdgePannel:** Bloomberg is the benchmark for *data trust + function-driven UX + institutional research*; EdgePannel is map-first with scattered per-source series and no mnemonic command system.

## 3. Recorded Future — recordedfuture.com

**Access/pricing:** No free tier. 2026 packages Core/Professional/Elite, priced on named users + API-call volume + Intelligence Graph enrichment breadth. Reported ACVs: ~$40–60K entry module, $75–200K mid bundles, $250–500K+ full suite; Payment Fraud add-on $50–100K (financial institutions). API-first licensing (calls are the currency).
**Core features:** Intelligence Cloud: Threat Intelligence, Vulnerability Intelligence, Malware, Brand, Identity, Attack Surface Intelligence, Autonomous Threat Operations (100+ native integrations), plus Insikt Group human analyst team. Intelligence Graph ingests 1.2M+ sources continuously. 1,900+ customers, 45+ sovereign governments.
**Data sources:** 1.2M+ sources — open web, dark web, technical feeds (CVE, malware sandboxes), geopolitical/government data, payment-fraud data.
**Visualization/UX:** Graph-first: entity-centric views (threat actor, malware, CVE, country) with relationship maps; alert streams; timeline; API/webhook delivery into SIEM/SOAR. Analyst briefs layered on machine data.
**Unique capabilities (relevant):** "Geopolitical Intelligence" — an add-on module for geopolitical events, physical threats, and country-level risk (flat fee per org + named users): the closest commercial analogue to EdgePannel's Country Instability Index, sold as a named product with analyst support. Machine-speed API delivery; AI-generated, cited intelligence.
**vs EdgePannel:** RF monetizes the *same risk-intelligence stack* (incl. country risk) as API-licensable data with analyst validation — EdgePannel has the index but no API surface, no analyst-validated briefs, no entity graph beyond SEC filings.

## 4. Janes — janes.com

**Access/pricing:** Individual subscriptions exist (portal); team/enterprise quote-based. Benchmark: USAF sole-source "Jane's Online Database" contract — ~$610K/3 yrs for 10 named users × defense-platform modules ≈ ~$20K/user/yr. Data-as-a-Service (DaaS) delivery in File GeoDB, Parquet, RDBMS, XML, Label/Property Graph + API.
**Core features:** Open-source defense & security intelligence: equipment/sensors/weapons inventory; military capabilities & order of battle; country & CBRN profiles; defense budgets/programmes/forecasts; geoeconomic threat intelligence (incl. Belt & Road Monitor); news/events/analysis. Knowledge-graph structure; "connected context" across forces, equipment, places, events; AI-ready structured datasets; peer-reviewed analyst validation ("truth among conflicting feeds — data no web scraper will ever see").
**Data sources:** Human-validated OSINT — open sources, trade press, government releases, expert network; decades of archive.
**Visualization/UX:** Portal with entity pages, relationship graphs, imagery/GIS integration (plugs into GIS/battle-management/imagery platforms); graph traversal from "what happened" to "what it means"; briefing-ready exports.
**Unique capabilities:** Decision-grade validation & provenance on every record; machine-readable knowledge graph of global military power; the institutional defense-intel standard.
**vs EdgePannel:** Janes is the *provenance play*: every record human-validated with source/date, delivered as a queryable graph — EdgePannel's military layer is static base points with no equipment/capability attributes, no validation provenance, no graph export.

## 5. Windward — windward.ai

**Access/pricing:** Enterprise quote, demo-gated (public company; mission-grade contracts with gov + finance + commodity customers). API access for enterprise.
**Core features:** Maritime AI: multi-source fusion (AIS + dark-vessel signals + EO/SAR/RF) into one operational picture; behavioral analytics (loitering, AIS gaps, ship-to-ship transfers, destination deception); per-vessel risk scoring for sanctions/insurance/trade compliance; predictive "what's happening at sea and why"; agentic workflows; products for business intelligence, risk & compliance, border/asset security, defense & intelligence, container tracking. Used as an evidence source by UN Panel of Experts investigations (sanctions, North Korea).
**Data sources:** Premium + unrestricted AIS, dark activity, satellite EO, SAR, RF; proprietary behavioral models trained on 12+ yrs of vessel history.
**Visualization/UX:** Map-centric vessel tracking with risk overlays, alerting on behavioral anomalies, per-vessel risk scorecards with explainability ("predictive, explainable intelligence"), analyst support embedded in missions.
**Unique capabilities:** Dark-vessel detection and behavior-based risk (not just position); explainable per-vessel risk scores; the compliance/insurance use case (sanctions-evasion detection).
**vs EdgePannel:** Windward turns raw AIS into *behavioral intelligence* (dark activity, STS transfers, risk scores) — EdgePannel's AIS layer shows positions, not behaviors or per-vessel risk.

## 6. Kpler — kpler.com (with Vortexa as the adjacent energy-flows player)

**Access/pricing:** No free tier; demo-gated enterprise quotes (not publicly listed). Developer portal (developers.kpler.com) + API for enterprise data contracts.
**Core features:** Real-time trade intelligence: 300K+ vessels tracked/day, 1B+ AIS signals/day, 2M+ trades monitored. Fundamental Intelligence: real-time flows, asset tracking, connected intelligence across ags/metals/dry, containers, oils/chemicals, gas/power; ship tracking (real-time positions, custom map layers, notifications, vessel ownership & particulars); trader tools; risk & compliance; defense intelligence; market insights; freight analytics. Vortexa (adjacent): cargo history for every tanker >5,000 dwt since 2016, grade-level flow tracking, freight fundamentals ship-by-ship, Anywhere Freight Pricing (90K+ active routes, 70M possible port-pairs), freight price forecasts, API + Excel add-in + Python SDK.
**Data sources:** AIS + trade/cargo data (loading manifests, port calls), freight fixtures, satellite imagery for storage/activity; Vortexa adds 2016+ historical cargo database.
**Visualization/UX:** Map of vessel positions with flow layers; OD (origin–destination) flow arcs; route/freight curve charts; floating-storage and congestion dashboards; Excel add-in; per-route freight pricing curves with forecast overlays.
**Unique capabilities:** Cargo-level trade inference (what's on board, load/discharge, destination) — turning AIS into commodity flow fundamentals; freight rate curves per route; contango/storage signals.
**vs EdgePannel:** Kpler/Vortexa convert vessel positions into *trade flows with cargo metadata and per-route freight curves*; EdgePannel's commodity layers are static points with no OD arcs, no cargo inference, no freight/contango curves.

---

## Secondary platforms worth knowing (brief)

- **Palantir Foundry / Gaia** (palantir.com/platforms/foundry): enterprise data OS — ontology (objects/actions/processes) over your data, closed-loop operations, AIP agentic layer; Gaia is its OSINT product. Quote-based (tens of $M for gov; commercial tiers exist). **Gap signal:** EdgePannel is a viewing app — no "actions" (escalate/tag/export-to-workflow) on alerts, no ontology/object model users can extend.
- **AlphaSense** (alpha-sense.com): AI search over 500M+ premium docs — filings, earnings-call transcripts, broker research, Tegus expert transcripts; GenAI answers with *sentence-level citations* and anti-hallucination positioning; free trial, then quote (~$4–6K/seat/yr reported). **Gap signal:** transcript/expert-call search + citation-anchored Q&A over documents.
- **FlightAware AeroAPI** (flightaware.com/commercial/aeroapi): *public* usage pricing — per-query fees (~$0.001–0.05/result set); Personal free up to $5/mo; Standard $100/mo min (historical to 2011, alerting); Premium $1,000/mo min (Foresight predictive ETAs, Aireon space-based ADS-B, hold-pattern alerts, 99.5% uptime, phone support). **Gap signal:** predictive ETAs, oceanic/space-based ADS-B coverage, historical track playback, event alerting (departure/hold/divert).
- **Esri ArcGIS Living Atlas** (livingatlas.arcgis.com): thousands of curated layers (real-time weather, demographics, land use, VIIRS imagery) free with a public ArcGIS account; ArcGIS Velocity is the enterprise real-time geostreaming engine. **Gap signal:** free curated layer library EdgePannel could integrate wholesale instead of hand-rolling every source.
- **HawkEye 360**: hawkeye360.com was parked for sale (GoDaddy) at research time (Aug 2026) — RF-geolocation vendor appears defunct/rebranded; treat as cautionary tale, not a competitor. DTN, Spire, ICEYE/Capella, Graphika, Mandiant Advantage all exist but are either narrower (single-sensor) or defense-channel — see gap list where relevant.

---

## TOP 12 concrete gaps these platforms reveal (EdgePannel does NOT have)

1. **Per-alert confidence/velocity scoring + auto-regenerating event briefs** (Dataminr). Dataminr triages ~500K events/day into a ranked alert stream with per-alert relevance scoring and ReGenAI briefs that rewrite as the event unfolds. EdgePannel clusters news but shows no event-detection confidence/false-positive probability and no live-evolving AI brief per event. *Actionable:* emit per-cluster confidence + freshness score; regenerate insight panels on new source arrival.

2. **Outbound alert-to-action routing** (Dataminr). Dataminr's value chain ends in escalation: mass notification, ticketing, security-ops integrations via API. EdgePannel's alert rules engine is internal-only. *Actionable:* add webhook/Slack/Teams/email/SMS delivery + alert dedup into "incidents" with ack/escalate/tag lifecycle.

3. **Mnemonic command system / function palette** (Bloomberg). The Terminal's power is `ECO <GO>`-style function codes and keyboard-first navigation across 40K functions. EdgePannel is mouse-driven layer toggling. *Actionable:* add a command palette with mnemonic jumps (e.g., `INSTABILITY FR`, `FLIGHTS SIN`, `AI`), deep-linkable to any layer/view state.

4. **Unified per-entity time-series explorer with export** (Bloomberg). Bloomberg gives 20+ yrs of clean adjusted series for any asset/country with one consistent model; EdgePannel scatters FRED/EIA/World Bank series across layers with no per-country "everything in one chart" view and no CSV/Excel export. *Actionable:* build a per-entity series browser (country/asset/commodity) with aligned dates, y-axis normalization, export.

5. **API surface / machine-speed licensing model** (Recorded Future). RF licenses *data*, priced by API-call volume and graph enrichment, delivered into SIEM/SOAR. EdgePannel is an app with no queryable API for its own processed layers (instability index, entity graph, alerts). *Actionable:* publish a public/enterprise API + webhooks so EdgePannel data plugs into other tools (this is also the most plausible commercial moat).

6. **Analyst-validated country-risk briefs with severity/urgency scoring** (Recorded Future Geopolitical Intelligence). RF sells "geopolitical events, physical threats, and country-level risk" as a flat-fee add-on module with Insikt analyst context. EdgePannel computes a composite index but no per-country narrative brief, no severity/urgency rating per event, no analyst layer. *Actionable:* add severity (impact) × urgency (velocity) scoring per country event + a generated risk brief that cites sources.

7. **Machine-readable, provenance-stamped defense datasets** (Janes). Janes delivers equipment/bases/capabilities as a knowledge graph (Parquet/GeoDB/property-graph/API) where every record is human-validated with source + date; a USAF contract values it at ~$20K/user/yr. EdgePannel's military bases layer is static points with no equipment/capability/unit attributes and no validation provenance. *Actionable:* enrich base points with equipment inventory attributes and per-record source+as-of metadata (extends the teardown's geometry-confidence badges to all military records).

8. **Conflict-resolution/adjudication labeling** (Janes). Janes's tagline "truth among conflicting feeds" = explicit human adjudication of contradictory OSINT. EdgePannel's clustering surfaces conflicting reports without reconciling them. *Actionable:* when N sources conflict on an event fact, emit an explicit "sources conflict" state with per-source stance, not just a merged cluster.

9. **Behavioral maritime analytics: dark activity, AIS gaps, loitering, STS transfers** (Windward). Windward fuses AIS + dark-vessel signals + EO/SAR/RF and flags behavioral anomalies; it's cited in UN sanctions investigations. EdgePannel's AIS layer renders positions only. *Actionable:* compute per-vessel anomaly signals — AIS-gap events, loitering near infrastructure, ship-to-ship proximity events, destination mismatch — and render them as risk overlay layers.

10. **Per-vessel / per-entity risk scorecard with explainable reasons** (Windward). "Predictive, explainable intelligence": each vessel gets a risk score with the behavioral evidence behind it. EdgePannel has sanctions lists as layers but no entity-level risk score. *Actionable:* entity risk scorecards (vessel/company/country) = base risk factors + behavioral evidence list, mirrored for the cyber (CISA KEV) and sanctions layers.

11. **Cargo-level trade-flow inference + OD flow arcs + per-route freight curves** (Kpler, Vortexa). Kpler infers cargo/load/discharge/destination from 2M+ trades/day; Vortexa offers 2016+ cargo history, grade-level flows, and freight pricing/forecasts across 90K+ active routes. EdgePannel's commodity layers are static points. *Actionable:* connect AIS positions to port-call sequences to draw origin–destination arcs with direction/volume glyphs; add a per-route freight rate curve chart (price history + forward curve) for key routes (VLCC AG–China, LNG, dry bulk).

12. **Predictive aviation: ETAs, oceanic coverage, historical playback** (FlightAware). AeroAPI Premium ships Foresight ML predictive ETAs, Aireon space-based ADS-B (full-oceanic coverage), hold-pattern/divert alerting, and tracks back to 2011 — publicly priced from $100/mo min (Standard) / $1,000/mo min (Premium). EdgePannel's ADS-B is a free crowd-sourced feed: no oceanic coverage, no predictions, no playback. *Actionable:* add predictive-ETA and oceanic-gap layers (Aireon-class data is the premium differentiator); consider a paid tier benchmarked to AeroAPI's $100/$1,000/mo minimums.

*Honorable mentions:* a free curated "layer store" (Esri Living Atlas — thousands of ready-made layers, free with public account) and citation-anchored document Q&A over transcripts/broker research (AlphaSense — 500M+ docs, sentence-level citations) are both fast, high-leverage additions.
