I have the full picture from my earlier reads. Here's the audit and plan.

---

# Country Brief — Visual Enhancement Audit

Each section below: **what's there now** → **proposed additions**. I've starred the ones I think are most worth doing.

---

## 📍 Geography

| Component | Current | Proposed |
|---|---|---|
| Location | Prose + `📍 coords` | Render a small **inline locator map** (SVG country silhouette highlighted on its continent). Tap to fly map to it. |
| At a glance | 4 tiles (total / land / water / coastline) | ⭐ **Land-vs-water split bar** above the tiles — single horizontal bar, brown + blue proportions. Instantly scannable. |
| Size comparison | Plain prose ("Slightly smaller than Texas") | ⭐ **Side-by-side area visual** — country area drawn as a rectangle next to a well-known reference (US state, France, Texas). Factbook text already names the reference; we just need area values. |
| Elevation | 3 tiles | ⭐ **Stylized elevation profile** — SVG mountain silhouette with three labeled points (lowest → mean → highest) drawn proportionally. Way more evocative than tiles. |
| Climate & Terrain | Two prose blocks | ⭐ **Climate chips with icons** — keyword-scan the text for tokens (`tropical 🌴`, `arid 🏜`, `temperate 🌿`, `arctic ❄`, `monsoon 🌧`, `mediterranean ☀`, `alpine 🏔`) and render as chips at the top. Full text stays collapsible below. *You specifically called this one out.* |
| Natural resources | Plain chip row | **Resource chips with icons** — `⛽ petroleum`, `⛏ iron ore`, `💎 diamonds`, `🌲 timber`, `⚡ hydropower`, `☀ solar`, `🌾 arable land`, `🐟 fish`. Maps cleanly — factbook terms are consistent. |
| Natural hazards | Warn callout (prose) | **Hazard icon chips** — `🌋 volcanic`, `🌊 tsunami`, `🌀 cyclone`, `🏜 drought`, `🔥 wildfire`, `🌧 flooding`, `🌡 heat wave`. Keep full text as expandable. |

---

## 👥 People

| Component | Current | Proposed |
|---|---|---|
| Population hero | Big number + growth meta | Add a **tiny "N per pixel" pictogram** — a row of 10 little human figures with one darkened to represent the share of world population (~1/80th for most countries). Playful, informative. |
| Age structure | Stacked bar (0–14 / 15–64 / 65+) | ⭐ **Population pyramid** — proper left/right split by sex × age bracket. Factbook has `male` and `female` breakdowns per bracket. Classic, immediately readable. |
| Languages / Religions / Ethnic groups | Labeled bars | Fine as-is. (Optional: add small flag/symbol next to top language, but probably not worth it.) |
| Vitals (life exp / urbanization / birth rate) | 3 tiles | **Urbanization split bar** — rural/urban proportion. Visually richer than "23.2%". |
| Health & education | 4 tiles | ⭐ **Mini comparison sparks** — each tile gets a horizontal bar showing the country vs the **world median** (stored as static constants). "0.14 physicians/1K" is meaningless without context; "0.14 vs world median 1.8" is. |

---

## 🏛 Government

| Component | Current | Proposed |
|---|---|---|
| Leadership | Two person cards | **Role icons** — 👑 for chief of state, 🏛 for head of government. Also extract and highlight the **title** ("President") as a badge separate from the name. |
| Structure (gov type / legal system) | Prose blocks | ⭐ **Government type badge** — parse first clause (e.g. "Presidential republic", "Constitutional monarchy", "Federal parliamentary") into a colored pill. Same for legal system ("Civil law", "Common law", "Mixed", "Sharia-based"). Huge scannability win. |
| Capital | Big name + `📍 📅` meta | ⭐ **Mini-map of the capital** — small 120×80 map showing the country outline with the capital pin. Leverages existing map assets. |
| Independence / National holiday | Prose | Leave as-is. Could add a 📅 icon inline. |
| Constitution / Admin divisions | Collapsibles | Fine. |

---

## 💰 Economy

| Component | Current | Proposed |
|---|---|---|
| Headline (GDP PPP / per capita / growth) | 3 tiles with year tags | ⭐ **3-year sparklines per tile** — factbook stores multiple years in each GDP object. Draw a tiny 40×16 spark. Makes trend visible instantly. |
| GDP composition | Stacked bar (agri/ind/svc) | Optional: **donut variant** for visual variety, but stacked bar works well. |
| Fiscal (inflation / unemp / debt) | 3 tiles | Same sparkline treatment as headline tiles (multi-year data exists). |
| Trade — Exports/Imports | Two cards w/ value + partner chips + commodity chips | ⭐ **Flag-badged partner chips** — now that flags load from flagcdn, map partner names → ISO codes → flag images. A trade partner row with mini-flags is striking and faster to read. |
| Commodities | Plain chips | **Commodity icons** — 🛢 petroleum, 🌾 grains, 💎 gems, 🚗 vehicles, 📱 electronics, 🧵 textiles, ⚗ chemicals, 💊 pharmaceuticals, 🍷 beverages. |
| Economic overview | Collapsible prose | Leave as-is. |

---

## ⚡ Energy

| Component | Current | Proposed |
|---|---|---|
| Electricity (access / capacity / consumption) | 3 tiles | **Access gauge** — electricity access % as a radial gauge, more striking than "99.8%". |
| Generation mix | Stacked bar | Fine. Consider **source icons on hover** or a donut variant for visual variety. |
| Reserves (oil / gas) | 2 tiles | Fine. Could add a **global-rank badge** ("#8 in world oil reserves") — derivable from a static top-20 list. |
| Production vs consumption | Four tiles (petrol prod/cons, gas prod/cons) | ⭐ **Diverging bar chart** — single bar with production (green, right) and consumption (red, left) on opposite sides. Immediately shows whether the country is a net importer or exporter. Much better than 4 disconnected numbers. |

---

## 📡 Communications

| Component | Current | Proposed |
|---|---|---|
| Connectivity (internet / mobile / broadband / fixed) | 4 tiles | **Internet-penetration gauge** — % of population. Gauge or inline split bar. |
| TLD | Big text | **Address-bar styled badge** — `https://...something.dz` with the TLD highlighted. Small touch, looks nice. |
| Broadcast media | Collapsible prose | Leave as-is. |

---

## ✈ Transportation

| Component | Current | Proposed |
|---|---|---|
| Infrastructure (airports / railways / etc.) | 7 tiles with emoji | ⭐ **Scale-normalized bar chart** — each mode as a row with a log-scaled bar showing scale (airports 200, railways 5K km, roadways 100K km). Today they're 7 identical-looking tiles. |
| Airports by runway | Collapsible kv rows | **Runway-class histogram** — bar chart by runway length class ("over 3,047 m" → "914 to 1,523 m"). Factbook already categorizes this. |
| Ports | Chips | Add ⚓ icon per port. Minor. |

---

## 🪖 Military

| Component | Current | Proposed |
|---|---|---|
| Spend & size | 2 tiles | ⭐ **Spending benchmark gauge** — if spending as `% of GDP` is in the text, plot it against the NATO 2% target line and world average (~2.2%). Highly legible comparative context. |
| Branches | Plain chips | ⭐ **Branch chips with icons** — 🪖 Army, ⚓ Navy, ✈ Air Force, 🚀 Space, 🛡 Coast Guard, 🚓 Gendarmerie, 🚁 Special Ops. Maps cleanly from parsed branch text. |
| Service age | Collapsible prose | Extract age as a **badge** ("18+ voluntary" or "19–24 conscript"). |
| Deployments | Prose | ⭐ **Deployment map / flag chips** — parse text for country names, show a row of flag chips with deployment counts ("🇸🇴 280  🇲🇱 90  🇱🇧 120"). Small country-chips are perfect for this. |
| Equipment | Collapsible prose | Leave as-is; too varied to visualize usefully. |

---

## ⚠ Transnational Issues

| Component | Current | Proposed |
|---|---|---|
| Disputes | Warn callout | ⭐ **Disputed-neighbor flag chips** — parse country names from the disputes text, render a row of flags with the country names. Quickly shows who the active disputes are with. |
| Refugees & IDPs | 2 tiles | **Severity band** — color tiles based on magnitude (green < 10K, yellow < 100K, orange < 1M, red ≥ 1M). |
| Trafficking | Callout | ⭐ **TIP Tier badge** — factbook text almost always starts with "Tier 1 / Tier 2 / Tier 2 Watch List / Tier 3". Extract and show as a prominent colored badge. This is the single most important piece of info in the block. |
| Illicit drugs | Callout | **Drug-type chips with icons** — 🌿 cannabis, 🌺 opium/heroin, ❄ cocaine, 💊 synthetic, ⚗ precursors. |

---

# 📋 Recommended Build Order

Grouped by payoff-to-effort ratio. Each is independent; we can build any subset.

### **Phase 1 — High impact, low effort (half-day each)**
*Pure text parsing + chip/badge rendering. Biggest scannability wins.*
1. **Climate badges** (Geography) — your explicit ask
2. **Natural resources icons** (Geography)
3. **Natural hazards icons** (Geography)
4. **Government type & legal system badges** (Government)
5. **Military branches with icons** (Military)
6. **TIP tier badge** (Transnational) — hugely informative, trivial to extract
7. **Commodity icons** (Economy)

### **Phase 2 — Medium effort, strong visual payoff**
*Requires a new component or light data manipulation.*
8. **Land-vs-water split bar** (Geography)
9. **Elevation SVG profile** (Geography)
10. **Production vs consumption diverging bar** (Energy)
11. **Trade partners with flag chips** (Economy) — flags already work
12. **Deployment flag chips** (Military)
13. **Disputed-neighbor flag chips** (Transnational)
14. **Size comparison visual** (Geography)

### **Phase 3 — Larger builds, data-dependent**
*Worth doing but need more plumbing.*
15. **Population pyramid** (People) — needs sex-split parsing
16. **Headline/fiscal sparklines** (Economy) — multi-year factbook entries
17. **Capital mini-map** (Government) — embed existing map
18. **Health tiles vs world median** (People) — needs static reference data
19. **Location inline map** (Geography) — reuses map infra
20. **Transport bar chart** (Transportation)

### **Phase 4 — Polish / optional**
21. Population pictogram, spending gauge, electricity gauge, donut variants — nice but marginal.

---

# My recommendation

**Start with Phase 1 in one pass.** They're all the same shape — regex the text, map keywords to icons/badges, render chips. One reusable helper (`keywordChips(text, map)`) covers climate, resources, hazards, branches, commodities, and drugs. That alone transforms 7 of the most text-heavy sections into scannable visuals in roughly one sitting.

**Then Phase 2 item by item**, picking what you want most. I'd personally prioritize the **elevation profile**, the **production-vs-consumption diverging bar**, and **trade partner flags** — all three are striking and use data that's already present.
