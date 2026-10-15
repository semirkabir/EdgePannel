import { MISSIONS, getMission, type Mission } from '@/config/missions';
import { buildBriefing, missionMapEvents, type Briefing, type BriefingSnapshot } from '@/services/mission-briefing';
import { applyAgentMapToolEvents, type AgentMapAccessors } from '@/services/map-agent-bridge';

/** Web-mercator degrees of longitude per screen pixel (512px tiles). */
const degPerPx = (zoom: number) => 360 / (512 * 2 ** zoom);
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

/**
 * Mission briefings: pick a mission, the map flies there and a deterministic
 * (no-AI) briefing renders. The locked box below is where "connect your own
 * agent" lands (Phase 3); until then it is a placeholder.
 *
 * innerHTML is safe here: every interpolated value goes through escapeHtml /
 * escapeAttr, and external story links through sanitizeUrl.
 */
export class MissionBriefingPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private accessors: AgentMapAccessors | null = null;

  constructor(private loadSnapshot: () => Promise<BriefingSnapshot>) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'agent-chat-overlay mission-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = `
      <aside class="mission-panel" role="dialog" aria-label="Mission briefings">
        <header class="mission-header">
          <div><h2>Briefings</h2><p>Pick a mission. The map follows.</p></div>
          <button type="button" class="mission-close" aria-label="Close">×</button>
        </header>
        <div class="mission-body"></div>
      </aside>`;
    document.body.appendChild(this.overlay);
    this.body = this.overlay.querySelector<HTMLElement>('.mission-body')!;

    this.overlay.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.mission-close')) return this.close();
      const card = target.closest<HTMLElement>('[data-mission]');
      if (card) return void this.run(card.dataset.mission!);
      if (target.closest('.mission-back')) return this.renderPicker();
      const spot = target.closest<HTMLElement>('[data-lat]');
      if (spot) this.insetAccessors()?.getMap()?.setCenter(Number(spot.dataset.lat), Number(spot.dataset.lon), 7);
    });
  }

  public setMapAccessors(accessors: AgentMapAccessors): void {
    this.accessors = accessors;
  }

  public open(): void {
    this.overlay.hidden = false;
    this.overlay.classList.add('active');
    this.renderPicker();
  }

  /** Open straight into a mission (deep link `?mission=<id>`). Returns false for unknown ids. */
  public openMission(id: string): boolean {
    if (!getMission(id)) return false;
    this.overlay.hidden = false;
    this.overlay.classList.add('active');
    void this.run(id);
    return true;
  }

  public close(): void {
    this.overlay.classList.remove('active');
    this.overlay.hidden = true;
  }

  public destroy(): void {
    this.overlay.remove();
  }

  /**
   * Accessors whose camera moves land in the middle of the map area left
   * uncovered by this panel, not under it. Panel covers the right edge, so the
   * true center shifts east by half the panel width.
   */
  private insetAccessors(): AgentMapAccessors | null {
    const base = this.accessors;
    if (!base) return null;
    const panelWidth = this.overlay.querySelector<HTMLElement>('.mission-panel')?.offsetWidth ?? 0;
    const covered = panelWidth > 0 && panelWidth < window.innerWidth;
    return {
      ...base,
      getMap: () => {
        const map = base.getMap();
        if (!map || !covered) return map;
        return {
          setCenter: (lat: number, lon: number, zoom?: number) => {
            // highlight_features nudges without a zoom: use the live zoom.
            const z = zoom ?? base.getViewport?.()?.zoom;
            map.setCenter(lat, z == null ? lon : lon + (panelWidth / 2) * degPerPx(z), zoom);
          },
        };
      },
    };
  }

  private renderPicker(): void {
    this.body.innerHTML = `<div class="mission-grid">${MISSIONS.map(m => `
      <button type="button" class="mission-card" data-mission="${escapeHtml(m.id)}">
        <strong>${escapeHtml(m.title)}</strong>
        <span>${escapeHtml(m.summary)}</span>
      </button>`).join('')}</div>`;
  }

  private async run(id: string): Promise<void> {
    const mission = getMission(id);
    if (!mission) return;
    this.body.innerHTML = '<p class="mission-loading">Pulling live signals…</p>';
    // Move the map first (instant feedback), then flash hotspots once the
    // briefing data is in. Highlights never move the camera (focus: false).
    const accessors = this.insetAccessors();
    if (accessors) applyAgentMapToolEvents(missionMapEvents(mission, accessors.getCurrentLayers()), accessors);
    // Clear any overlay from a previous mission, then draw this one's (if any).
    this.accessors?.showAnalysisOverlay?.('terrain', { type: 'FeatureCollection', features: [] });
    if (mission.terrainOverlay) void this.showTerrainOverlay(mission.terrainOverlay);
    const briefing = buildBriefing(mission, await this.loadSnapshot().catch(() => ({})));
    if (accessors && briefing.hotspots.length > 0) {
      applyAgentMapToolEvents(
        missionMapEvents(mission, accessors.getCurrentLayers(), briefing.hotspots).filter(e => e.name === 'highlight_features'),
        accessors,
      );
    }
    this.renderBriefing(mission, briefing);
  }

  /** Fetch a precomputed terrain overlay and route it through the agent bridge. */
  private async showTerrainOverlay(id: string): Promise<void> {
    if (!this.accessors?.showAnalysisOverlay || !/^[a-z0-9-]+$/.test(id)) return;
    try {
      const response = await fetch(`/data/terrain/${id}.json`);
      if (!response.ok) return;
      const asset = await response.json() as { summary?: unknown; overlay?: unknown };
      applyAgentMapToolEvents(
        [{ name: 'analyze_terrain', clientAction: { overlayId: 'terrain', summary: asset.summary, overlay: asset.overlay } }],
        this.accessors,
      );
    } catch {
      // Optional layer: a missing asset must not break the briefing.
    }
  }

  private renderBriefing(mission: Mission, b: Briefing): void {
    const stats = b.stats.map(s => `
      <div class="mission-stat${s.tone ? ` mission-stat--${s.tone}` : ''}">
        <span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong>
      </div>`).join('');
    const spots = b.hotspots.map(h => `
      <li><button type="button" data-lat="${h.lat}" data-lon="${h.lon}">${escapeHtml(h.label ?? h.id ?? '')}</button></li>`).join('');
    const stories = b.topStories.map(s => `
      <li><a href="${sanitizeUrl(s.url ?? '') || '#'}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a>
      ${s.source ? `<span>${escapeHtml(s.source)}</span>` : ''}</li>`).join('');
    const gaps = b.dataGaps.map(g => `<li>${escapeHtml(g)}</li>`).join('');

    this.body.innerHTML = `
      <button type="button" class="mission-back">← All missions</button>
      <h3 class="mission-headline">${escapeHtml(b.headline)}</h3>
      ${stats ? `<div class="mission-stats">${stats}</div>` : ''}
      ${spots ? `<section><h4>Hotspots</h4><ul class="mission-spots">${spots}</ul></section>` : ''}
      ${stories ? `<section><h4>Top stories</h4><ul class="mission-stories">${stories}</ul></section>` : ''}
      ${gaps ? `<ul class="mission-gaps">${gaps}</ul>` : ''}
      <section class="mission-locked">
        <strong>Full analysis</strong>
        <p>Connect your own agent (Claude Code, Codex, Cursor) to get the written brief and ask follow-ups about ${escapeHtml(mission.title)}. Your agent drives this map.</p>
        <span class="mission-soon">Coming soon</span>
      </section>`;
  }
}
