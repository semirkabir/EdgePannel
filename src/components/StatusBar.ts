/**
 * StatusBar — Bloomberg-style bottom status bar.
 *
 * Two rows pinned to the bottom of the app shell:
 *
 *   1. Readout row
 *      · left   — hovered map coordinates + the country under the cursor
 *      · center — every active map layer with its legend swatch / color scale
 *      · right  — data-source attribution, feed freshness, live FPS
 *   2. Ticker row — a scrolling marquee of the newest global events and alerts.
 *
 * Update strategy: an animation-frame loop drives the two things that change
 * per frame (FPS and the coordinate readout, sampled from the map hover bus),
 * while everything derived from network state refreshes on a one-second tick.
 * Both write to the DOM only when the rendered text actually changes.
 */

import type { MapLayers, NewsItem } from '@/types';
import type { AppEventBus } from '@/app/event-bus';
import type { BreakingAlert } from '@/services/breaking-news-alerts';
import { getMapHoverPosition } from '@/services/map-hover-bus';
import { getCountryAtCoordinates, isCountryGeometryLoaded } from '@/services/country-geometry';
import {
  getLayersForVariant,
  resolveLayerAccentColor,
  resolveLayerLabel,
  type LayerDefinition,
  type MapVariant,
} from '@/config/map-layer-definitions';
import {
  dataFreshness,
  DATA_SOURCE_METADATA,
  getStatusColor,
  type DataSourceId,
  type FreshnessStatus,
} from '@/services/data-freshness';
import { getLayerSources } from '@/config/map-layer-definitions';
import { SITE_VARIANT } from '@/config';
import { t } from '@/services/i18n';
import { getCurrentTheme } from '@/utils';
import { escapeHtml } from '@/utils/sanitize';

export interface StatusBarDeps {
  eventBus: AppEventBus;
  /** Live view of the app's map layer toggles. */
  getMapLayers: () => MapLayers;
  /** Live view of the aggregated news feed backing the ticker. */
  getNews: () => NewsItem[];
}

/** Ticker scroll speed, in CSS pixels per second. */
const TICKER_SPEED_PX_PER_SEC = 55;
/** Newest items to put on the ticker belt. */
const TICKER_MAX_ITEMS = 30;
/** Breaking alerts older than this drop off the front of the ticker. */
const ALERT_TTL_MS = 30 * 60 * 1000;
/** Country lookup is a point-in-polygon sweep — don't run it every frame. */
const COUNTRY_LOOKUP_INTERVAL_MS = 140;
/** FPS is averaged over this window so the number stays readable. */
const FPS_SAMPLE_WINDOW_MS = 500;
/** Source codes named inline before the readout collapses to a "+N" count. */
const INLINE_SOURCE_CODES = 4;

const COLLAPSED_KEY = 'worldmonitor-status-bar-collapsed';

/**
 * Continuous scales that the flat swatch can't express. Stops mirror the
 * choropleth ramps the map itself paints, so the bar and the map agree.
 */
const LAYER_COLOR_SCALES: Partial<Record<keyof MapLayers, { stops: string[]; ticks: string[] }>> = {
  ciiChoropleth: {
    stops: ['#28b33e', '#dcc030', '#e87425', '#dc2626', '#7f1d1d'],
    ticks: ['0', '31', '51', '66', '81', '100'],
  },
};

interface TickerEntry {
  id: string;
  time: string;
  source: string;
  title: string;
  link?: string;
  tone: 'critical' | 'high' | 'medium' | 'normal';
}

export class StatusBar {
  private root: HTMLElement;
  private deps: StatusBarDeps;

  // Readout row nodes
  private latEl!: HTMLElement;
  private lonEl!: HTMLElement;
  private countryEl!: HTMLElement;
  private legendEl!: HTMLElement;
  private legendCountEl!: HTMLElement;
  private sourcesEl!: HTMLElement;
  private freshnessEl!: HTMLElement;
  private freshnessDotEl!: HTMLElement;
  private fpsEl!: HTMLElement;

  // Ticker nodes
  private tickerRowEl!: HTMLElement;
  private tickerTrackEl!: HTMLElement;
  private collapseBtn!: HTMLButtonElement;

  // Loops
  private rafId: number | null = null;
  private tickIntervalId: ReturnType<typeof setInterval> | null = null;

  // FPS accumulator
  private frameCount = 0;
  private fpsWindowStart = 0;

  // Rendered-value caches — every DOM write is guarded by one of these.
  private lastCoordKey = '';
  private lastCountryKey = '';
  private lastLegendKey = '';
  private lastSourcesKey = '';
  private lastFreshnessKey = '';
  private lastFpsText = '';
  private lastTickerKey = '';

  // Hover/country lookup state
  private lastCountryLookupAt = 0;

  private alerts: BreakingAlert[] = [];
  private prefersReducedMotion: MediaQueryList | null = null;
  private reducedMotionIndex = 0;
  private reducedMotionTimer: ReturnType<typeof setInterval> | null = null;
  private tickerEntries: TickerEntry[] = [];

  private unsubscribers: Array<() => void> = [];
  private boundOnAlert: (e: Event) => void;
  private boundOnVisibility: () => void;
  private boundOnThemeChange: () => void;
  private boundOnReducedMotionChange: () => void;

  constructor(container: HTMLElement, deps: StatusBarDeps) {
    this.deps = deps;
    this.root = document.createElement('div');
    this.root.className = 'status-bar';
    this.root.id = 'statusBar';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'off');
    this.root.innerHTML = this.template();
    container.appendChild(this.root);

    this.cacheNodes();
    this.applyCollapsedState(localStorage.getItem(COLLAPSED_KEY) === '1');

    this.boundOnAlert = (e: Event) => this.handleAlert((e as CustomEvent<BreakingAlert>).detail);
    this.boundOnVisibility = () => this.handleVisibilityChange();
    this.boundOnThemeChange = () => { this.lastLegendKey = ''; this.refreshSlowRow(); };
    this.boundOnReducedMotionChange = () => this.renderTicker(true);

    document.addEventListener('wm:breaking-news', this.boundOnAlert);
    document.addEventListener('visibilitychange', this.boundOnVisibility);
    window.addEventListener('theme-changed', this.boundOnThemeChange);

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion.addEventListener('change', this.boundOnReducedMotionChange);

    this.unsubscribers.push(
      deps.eventBus.on('news:all-updated', () => this.renderTicker()),
      deps.eventBus.on('ui:map-layers-updated', () => this.refreshLegend()),
      dataFreshness.subscribe(() => this.refreshSlowRow()),
    );

    this.collapseBtn.addEventListener('click', () => {
      const next = !this.root.classList.contains('status-bar--collapsed');
      this.applyCollapsedState(next);
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      if (!next) this.renderTicker(true);
    });

    this.refreshSlowRow();
    this.renderTicker(true);
    this.startLoops();
  }

  // ── Markup ────────────────────────────────────────────────────────────────

  private template(): string {
    return `
      <div class="status-bar-readout">
        <div class="status-bar-section status-bar-position" title="Cursor position on the map">
          <span class="sb-key">POS</span>
          <span class="sb-coord" data-role="lat">—</span>
          <span class="sb-coord" data-role="lon">—</span>
          <span class="sb-divider"></span>
          <span class="sb-country" data-role="country">No cursor on map</span>
        </div>
        <div class="status-bar-section status-bar-layers">
          <span class="sb-key">LAYERS</span>
          <span class="sb-count" data-role="legend-count">0</span>
          <div class="sb-legend" data-role="legend"></div>
        </div>
        <div class="status-bar-section status-bar-meta">
          <span class="sb-key">SRC</span>
          <span class="sb-sources" data-role="sources">—</span>
          <span class="sb-divider"></span>
          <span class="sb-key">UPD</span>
          <span class="sb-freshness">
            <i class="sb-dot" data-role="freshness-dot"></i>
            <span data-role="freshness">—</span>
          </span>
          <span class="sb-divider"></span>
          <span class="sb-fps" data-role="fps" title="Render frame rate">— FPS</span>
          <button type="button" class="sb-ticker-collapse" data-role="collapse"
                  aria-label="Collapse news ticker" aria-expanded="true">▾</button>
        </div>
      </div>
      <div class="status-bar-ticker" data-role="ticker-row">
        <span class="sb-ticker-brand">LIVE</span>
        <div class="sb-ticker-viewport" data-role="ticker-viewport">
          <div class="sb-ticker-track" data-role="ticker-track"></div>
        </div>
      </div>
    `;
  }

  private cacheNodes(): void {
    const pick = (role: string): HTMLElement =>
      this.root.querySelector(`[data-role="${role}"]`) as HTMLElement;

    this.latEl = pick('lat');
    this.lonEl = pick('lon');
    this.countryEl = pick('country');
    this.legendEl = pick('legend');
    this.legendCountEl = pick('legend-count');
    this.sourcesEl = pick('sources');
    this.freshnessEl = pick('freshness');
    this.freshnessDotEl = pick('freshness-dot');
    this.fpsEl = pick('fps');
    this.tickerRowEl = pick('ticker-row');
    this.tickerTrackEl = pick('ticker-track');
    this.collapseBtn = pick('collapse') as HTMLButtonElement;
  }

  private applyCollapsedState(collapsed: boolean): void {
    this.root.classList.toggle('status-bar--collapsed', collapsed);
    this.tickerRowEl.classList.toggle('sb-ticker-hidden', collapsed);
    this.collapseBtn.textContent = collapsed ? '▴' : '▾';
    this.collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    this.collapseBtn.setAttribute('aria-label', collapsed ? 'Expand news ticker' : 'Collapse news ticker');
  }

  // ── Loops ─────────────────────────────────────────────────────────────────

  private startLoops(): void {
    if (this.rafId === null) {
      this.fpsWindowStart = performance.now();
      this.frameCount = 0;
      this.rafId = requestAnimationFrame(this.frame);
    }
    this.tickIntervalId ??= setInterval(() => this.refreshSlowRow(), 1000);
  }

  private stopLoops(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.stopLoops();
      this.writeFps('— FPS', '');
    } else {
      this.startLoops();
      this.refreshSlowRow();
    }
  }

  private frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);

    this.frameCount++;
    const elapsed = now - this.fpsWindowStart;
    if (elapsed >= FPS_SAMPLE_WINDOW_MS) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.fpsWindowStart = now;
      this.writeFps(`${fps} FPS`, fps >= 50 ? 'good' : fps >= 30 ? 'fair' : 'poor');
    }

    this.refreshPosition(now);
  };

  private writeFps(text: string, tone: string): void {
    if (text === this.lastFpsText) return;
    this.lastFpsText = text;
    this.fpsEl.textContent = text;
    this.fpsEl.dataset.tone = tone;
  }

  // ── Left: hovered coordinates + country ───────────────────────────────────

  private refreshPosition(now: number): void {
    const hover = getMapHoverPosition();

    if (!hover) {
      if (this.lastCoordKey === '') return;
      this.lastCoordKey = '';
      this.lastCountryKey = '';
      this.latEl.textContent = '—';
      this.lonEl.textContent = '—';
      this.countryEl.textContent = 'No cursor on map';
      this.countryEl.classList.add('sb-country--empty');
      return;
    }

    const lat = clampLatitude(hover.lat);
    const lon = normalizeLongitude(hover.lon);
    const coordKey = `${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (coordKey !== this.lastCoordKey) {
      this.lastCoordKey = coordKey;
      this.latEl.textContent = formatLatitude(lat);
      this.lonEl.textContent = formatLongitude(lon);
    }

    // Point-in-polygon against every country is too heavy for a frame budget.
    if (now - this.lastCountryLookupAt < COUNTRY_LOOKUP_INTERVAL_MS) return;
    this.lastCountryLookupAt = now;

    // A null hit means open water only once the boundaries are actually in
    // memory — before that it just means we can't answer yet.
    const loaded = isCountryGeometryLoaded();
    const hit = loaded ? getCountryAtCoordinates(lat, lon) : null;
    const label = hit ? hit.name : loaded ? 'International waters' : 'Locating…';
    const key = hit ? `${hit.code}:${hit.name}` : loaded ? 'water' : 'pending';
    if (key === this.lastCountryKey) return;
    this.lastCountryKey = key;
    this.countryEl.textContent = label;
    this.countryEl.classList.toggle('sb-country--empty', !hit);
    this.countryEl.title = hit ? `${hit.name} (${hit.code})` : label;
  }

  // ── One-second tick: legend, attribution, freshness ───────────────────────

  private refreshSlowRow(): void {
    this.refreshLegend();
    this.refreshAttribution();
    this.refreshFreshness();
  }

  private activeLayerDefs(): LayerDefinition[] {
    const layers = this.deps.getMapLayers();
    const variant = (SITE_VARIANT || 'full') as MapVariant;
    return getLayersForVariant(variant, 'flat').filter((def) => layers[def.key]);
  }

  private refreshLegend(): void {
    const defs = this.activeLayerDefs();
    const theme = getCurrentTheme() === 'light' ? 'light' : 'dark';
    const key = `${theme}|${defs.map((d) => d.key).join(',')}`;
    if (key === this.lastLegendKey) return;
    this.lastLegendKey = key;

    this.legendCountEl.textContent = String(defs.length);

    if (defs.length === 0) {
      this.legendEl.innerHTML = '<span class="sb-legend-empty">No active layers</span>';
      return;
    }

    this.legendEl.innerHTML = defs
      .map((def) => {
        const label = escapeHtml(resolveLayerLabel(def, t));
        const scale = LAYER_COLOR_SCALES[def.key];
        if (scale) {
          const gradient = `linear-gradient(to right, ${scale.stops.join(', ')})`;
          const ticks = scale.ticks.map((tick) => `<span>${escapeHtml(tick)}</span>`).join('');
          return `
            <span class="sb-legend-item sb-legend-item--scale" title="${label}">
              <span class="sb-legend-label">${label}</span>
              <span class="sb-scale">
                <span class="sb-scale-ramp" style="background:${gradient}"></span>
                <span class="sb-scale-ticks">${ticks}</span>
              </span>
            </span>`;
        }
        const color = escapeHtml(resolveLayerAccentColor(def.key, theme));
        return `
          <span class="sb-legend-item" title="${label}">
            <i class="sb-swatch" style="background:${color}"></i>
            <span class="sb-legend-label">${label}</span>
          </span>`;
      })
      .join('');
  }

  /** Data-freshness sources feeding the layers currently drawn on the map. */
  private activeSourceIds(): DataSourceId[] {
    const seen = new Set<DataSourceId>();
    for (const def of this.activeLayerDefs()) {
      for (const id of getLayerSources(def.key)) seen.add(id);
    }
    // News and GDELT back the ticker and the panels regardless of map layers.
    seen.add('rss');
    return Array.from(seen);
  }

  private refreshAttribution(): void {
    const ids = this.activeSourceIds().sort((a, b) => a.localeCompare(b));

    const key = ids.join('|');
    if (key === this.lastSourcesKey) return;
    this.lastSourcesKey = key;

    if (ids.length === 0) {
      this.sourcesEl.textContent = 'none';
      this.sourcesEl.title = 'No data sources attached to the active layers';
      return;
    }

    // Short provider codes inline (ACLED · GDELT · USGS), full names on hover —
    // the descriptive labels are far too wide for a one-line attribution.
    const codes = ids.map((id) => id.toUpperCase().replace(/_/g, ' '));
    const shown = codes.slice(0, INLINE_SOURCE_CODES).join(' · ');
    const overflow = codes.length - INLINE_SOURCE_CODES;
    this.sourcesEl.textContent = overflow > 0 ? `${shown} +${overflow}` : shown;
    this.sourcesEl.title = 'Feeding the active layers:\n' +
      ids.map((id) => `${id.toUpperCase()} — ${DATA_SOURCE_METADATA[id]?.name ?? id}`).join('\n');
  }

  private refreshFreshness(): void {
    const summary = dataFreshness.getSummary();
    const newest = summary.newestUpdate;
    const age = newest ? formatAge(Date.now() - newest.getTime()) : 'no data';
    const status: FreshnessStatus = summary.errorSources > 0 && summary.activeSources === 0
      ? 'error'
      : !newest
        ? 'no_data'
        : summary.staleSources > summary.activeSources / 2
          ? 'stale'
          : 'fresh';

    const text = `${age} · ${summary.activeSources}/${summary.totalSources} live`;
    const key = `${text}|${status}`;
    if (key === this.lastFreshnessKey) return;
    this.lastFreshnessKey = key;

    this.freshnessEl.textContent = text;
    this.freshnessDotEl.style.background = getStatusColor(status);
    this.freshnessEl.parentElement?.setAttribute(
      'title',
      `${summary.activeSources} of ${summary.totalSources} sources reporting · ` +
      `${summary.coveragePercent}% risk coverage · ${summary.staleSources} stale · ${summary.errorSources} errored`
    );
  }

  // ── Ticker ────────────────────────────────────────────────────────────────

  private handleAlert(alert: BreakingAlert | undefined): void {
    if (!alert) return;
    this.alerts = [alert, ...this.alerts.filter((a) => a.id !== alert.id)].slice(0, 8);
    this.renderTicker();
  }

  private buildEntries(): TickerEntry[] {
    const now = Date.now();
    const entries: TickerEntry[] = [];
    const seen = new Set<string>();

    for (const alert of this.alerts) {
      const ts = alert.timestamp instanceof Date ? alert.timestamp.getTime() : now;
      if (now - ts > ALERT_TTL_MS) continue;
      const id = `alert:${alert.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({
        id,
        time: formatClock(new Date(ts)),
        source: alert.source,
        title: alert.headline,
        ...(alert.link ? { link: alert.link } : {}),
        tone: alert.threatLevel,
      });
    }

    const news = [...this.deps.getNews()]
      .filter((item) => item.pubDate instanceof Date && !Number.isNaN(item.pubDate.getTime()))
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    for (const item of news) {
      if (entries.length >= TICKER_MAX_ITEMS) break;
      const id = `news:${item.link || item.title}`;
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push({
        id,
        time: formatClock(item.pubDate),
        source: item.source,
        title: item.title,
        ...(item.link ? { link: item.link } : {}),
        tone: toneForNews(item),
      });
    }

    return entries;
  }

  private renderTicker(force = false): void {
    const entries = this.buildEntries();
    const key = entries.map((e) => e.id).join('|');
    if (!force && key === this.lastTickerKey) return;
    this.lastTickerKey = key;
    this.tickerEntries = entries;

    this.stopReducedMotionRotation();

    if (entries.length === 0) {
      this.tickerTrackEl.innerHTML = '<span class="sb-tick sb-tick--idle">Awaiting feed…</span>';
      this.tickerTrackEl.style.removeProperty('animation-duration');
      this.tickerTrackEl.classList.remove('sb-ticker-track--scrolling');
      return;
    }

    if (this.prefersReducedMotion?.matches) {
      this.tickerTrackEl.classList.remove('sb-ticker-track--scrolling');
      this.tickerTrackEl.style.removeProperty('animation-duration');
      this.startReducedMotionRotation();
      return;
    }

    // The belt holds two identical copies and slides exactly one copy's width,
    // so the seam lands where the loop restarts and the scroll reads as endless.
    const belt = entries.map((entry) => this.entryHtml(entry)).join('');
    this.tickerTrackEl.innerHTML = `${belt}${belt}`;
    this.tickerTrackEl.classList.add('sb-ticker-track--scrolling');

    requestAnimationFrame(() => {
      const half = this.tickerTrackEl.scrollWidth / 2;
      if (half <= 0) return;
      const seconds = Math.max(20, Math.round(half / TICKER_SPEED_PX_PER_SEC));
      this.tickerTrackEl.style.animationDuration = `${seconds}s`;
    });
  }

  private entryHtml(entry: TickerEntry): string {
    const inner = `
      <span class="sb-tick-time">${escapeHtml(entry.time)}</span>
      <i class="sb-tick-dot" data-tone="${entry.tone}"></i>
      <span class="sb-tick-source">${escapeHtml(entry.source)}</span>
      <span class="sb-tick-title">${escapeHtml(entry.title)}</span>
      <span class="sb-tick-sep" aria-hidden="true">◆</span>`;
    // Feed links are third-party strings — only web URLs become anchors, so a
    // `javascript:` href in a malformed item can never reach the DOM.
    const href = entry.link && isWebUrl(entry.link) ? entry.link : null;
    return href
      ? `<a class="sb-tick" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
      : `<span class="sb-tick">${inner}</span>`;
  }

  /**
   * Reduced-motion fallback: step through the same entries one at a time
   * instead of sliding a marquee past the reader.
   */
  private startReducedMotionRotation(): void {
    this.reducedMotionIndex = 0;
    const show = () => {
      const entry = this.tickerEntries[this.reducedMotionIndex % this.tickerEntries.length];
      if (!entry) return;
      this.tickerTrackEl.innerHTML = this.entryHtml(entry);
      this.reducedMotionIndex++;
    };
    show();
    this.reducedMotionTimer = setInterval(show, 6000);
  }

  private stopReducedMotionRotation(): void {
    if (this.reducedMotionTimer === null) return;
    clearInterval(this.reducedMotionTimer);
    this.reducedMotionTimer = null;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public destroy(): void {
    this.stopLoops();
    this.stopReducedMotionRotation();
    document.removeEventListener('wm:breaking-news', this.boundOnAlert);
    document.removeEventListener('visibilitychange', this.boundOnVisibility);
    window.removeEventListener('theme-changed', this.boundOnThemeChange);
    this.prefersReducedMotion?.removeEventListener('change', this.boundOnReducedMotionChange);
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.root.remove();
  }
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function isWebUrl(link: string): boolean {
  try {
    const { protocol } = new URL(link, window.location.origin);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function clampLatitude(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/** Maplibre keeps panning past ±180; fold it back so the readout stays valid. */
function normalizeLongitude(lon: number): number {
  const wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
}

function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
}

function formatClock(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}Z`;
}

function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function toneForNews(item: NewsItem): TickerEntry['tone'] {
  const level = item.threat?.level;
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (item.isAlert || level === 'medium') return 'medium';
  return 'normal';
}
