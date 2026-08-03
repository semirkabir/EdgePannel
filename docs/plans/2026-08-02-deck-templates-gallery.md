# Deck Templates Gallery Plan

**Status (2026-08-02): Shipped**, with 7 of the original ~11 themes (Command Center, OSINT & Social, Markets & Finance, War & Conflict, Environment & Climate, Energy & Resources, Aviation & Space). Live TV & Media, Maritime & Trade, Nuclear & WMD, and Cyber & Technology are still out — see Migration Strategy below, unchanged from the original plan. `compatibleVariants` per template were verified against each variant's actual panel set (not just asserted) before shipping — see [[project_sitdeck_integration]] for the specific narrowing.

## Overview

SitDeck's "Deck Manager" popover has two panes: **My Saved Decks** (switch between the user's own saved layouts) and **Create a New Deck** (a gallery of ~11 themed starter templates — Command Center, OSINT & Social, Live TV & Media, Markets & Finance, War & Conflict, Nuclear & WMD, Aviation & Space, Maritime & Trade, Environment & Climate, Energy & Resources, Cyber & Technology — each with an icon, a widget-count badge, and a one-line description). World Monitor already shipped the left pane (named **Workspaces**, per [[project_sitdeck_integration]] Phase 2) — this plan adds the missing right pane: a template gallery to start a new named workspace from a themed preset instead of building one widget-by-widget.

Reference screenshots (user-provided, SitDeck Deck Manager, 2026-08-02).

## Current State

- **`WorkspacesPanel.ts` + `services/workspaces.ts`** — save/switch only, single-pane list (`render()`/`renderRow()`, `WorkspacesPanel.ts:160-189`). `saveCurrent()` (line 88) → `saveWorkspace(name)` (`workspaces.ts:122`) snapshots whatever panels/layout are *already on screen* — there's no "create from preset" path. Switching is `apply(id)` (line 122) → `applyWorkspace(id)` (`workspaces.ts:152`), writing stored keys back and reloading.
- **The building block already exists, just in a different feature.** `src/config/mission-packs.ts` defines 8 `MissionPack` objects (`red-sea-shipping-risk`, `critical-minerals-exposure`, etc., lines 31–266+), each with `recommendedPanels: string[]` — a plain list of panel IDs (e.g. `['live-news','strategic-risk','supply-chain','trade-flows','monitors','alert-rules','marketplace']`) — plus `recommendedLayers`, `recommendedSources`, `tagline`, `description`, `compatibleVariants`. `applyMissionPack(packId)` (`src/app/event-handlers.ts:389-450`) walks `recommendedPanels`, flips `this.ctx.panelSettings[panelId].enabled = true`, persists, and calls `applyPanelSettings()` — turning "enable a curated widget set" into a solved, data-driven operation. It's triggered via a `wm:apply-mission-pack` event from `MarketplaceModal.ts:349` / `UnifiedSettings.ts:214`.
- **The UI pattern already exists too.** `MarketplaceModal.ts:588-607` renders a card grid (`.marketplace-modal-pack-grid` / `.marketplace-modal-pack-card`) with kicker/name/tagline/chips/apply-button — visually close to SitDeck's template cards, just missing an icon glyph and a widget-count badge.
- **The gap**: Mission Packs are **additive** — they enable panels *on top of* whatever layout is currently active, in the Marketplace, and don't produce a new named workspace. SitDeck's "Create New Deck" **replaces** the layout with exactly the template's widget set and saves it as a new named deck immediately.
- **Content gap, not just UI**: `src/config/panels.ts`'s `PANEL_CATEGORY_MAP` has real panel IDs for most of SitDeck's themes (markets → `markets, watchlist, commodities, polymarket, ...`; conflict → `armed-conflict, defense, sanctions, ...`; geopolitical → `politics, us, europe, middleeast, ...`) but **no standalone panel widgets for Nuclear/CBRN, dedicated Aviation/Space, or dedicated Cyber intelligence** — those exist today only as map *layers* (per `map-layer-definitions.ts`), not as dashboard panels. Three of SitDeck's 11 themes (Nuclear & WMD, Aviation & Space, Cyber & Technology) can't be honestly represented as a panel-set preset until those panels exist, or until we accept a thinner template (e.g. map-layer preset only, no panel widgets).

## Proposed Plan

1. **New config catalog** — `src/config/deck-templates.ts`, a `DeckTemplate` type reusing the `MissionPack` shape (`id`, `name`, `tagline`, `description`, `icon`, `compatibleVariants`, `recommendedPanels`, `recommendedLayers`) but semantically **replace**, not additive. Author ~8 templates using panel IDs that already exist today (Command Center / default, OSINT & Social, Live TV & Media if/when live-TV panels exist, Markets & Finance, War & Conflict, Environment & Climate, Energy & Resources); leave Nuclear & WMD / Aviation & Space / Cyber & Technology as a follow-up pending new panels (see Open Questions).
2. **`WorkspacesPanel.ts` becomes two-pane**: left pane keeps the existing saved-workspace list/logic untouched; right pane ("Create New") renders a card grid reusing `.marketplace-modal-pack-card` markup/CSS from `MarketplaceModal.ts`, extended with an icon and a `recommendedPanels.length` widget-count badge (free — no separate authoring needed).
3. **New apply path**: `applyDeckTemplate(templateId, name)` — unlike `applyMissionPack` (additive), this **disables panels not in the template's list**, enables the ones that are, then immediately calls `saveWorkspace(name)` so the result is a real, persisted, named workspace rather than a transient overlay on the current layout.
4. **Variant gating**: reuse `compatibleVariants` exactly as `MissionPack` does, so e.g. a happy-variant build doesn't offer "War & Conflict".

## Migration Strategy

- Ship with the templates that map cleanly to existing panels first (Command Center, OSINT & Social, Markets & Finance, War & Conflict, Environment & Climate, Energy & Resources) — no new panel widgets required, pure data-authoring + the two-pane UI change.
- Nuclear & WMD / Aviation & Space / Cyber & Technology templates wait on whichever comes first: (a) new dedicated panel widgets for those domains, or (b) a decision to ship a thinner "map-layer-only" template for them in the meantime.
- Per CLAUDE.md automation rules: this touches `src/components/`, `src/services/`, `src/config/`, `src/app/` — run `variant-impact-checker` before/after implementation.

## Open Questions

- Should Nuclear/Aviation/Cyber ship as thin map-layer-only presets now, or wait for real panel widgets to exist (tracked as a "still open" item in [[project_sitdeck_integration]])?
- Should `MissionPack` and `DeckTemplate` be unified into one config (same shape, an `applyMode: 'additive' | 'replace'` field) to avoid maintaining two parallel catalogs, or kept separate since their UI surfaces (Marketplace vs. Workspaces) and audiences differ?
- Icon set: SitDeck uses a distinct glyph per template — do we have (or need to add) icon coverage for each theme in whatever icon system `MarketplaceModal.ts` already uses for its cards?
