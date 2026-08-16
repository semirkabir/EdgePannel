/**
 * Timeline scrubber for the map's time filter.
 *
 * Replaces the old row of preset buttons with a proper time-series control:
 * an axis with a draggable selection brush, a density histogram of activity,
 * key-event markers, transport controls that animate the window across the
 * timeline, and a custom date-range picker.
 *
 * All state lives in {@link timeController}; this component only renders a
 * snapshot and turns pointer/keyboard input into controller calls.
 */
import { t } from '@/services/i18n';
import {
  PLAYBACK_SPEEDS,
  timeController,
  type PlaybackSpeed,
  type TimeControllerSnapshot,
} from '@/services/time-controller';
import {
  getTimeMarkers,
  subscribeTimeMarkers,
  type TimeMarker,
  type TimeMarkerCategory,
  type TimeMarkerSeverity,
} from '@/services/time-markers';
import { escapeHtml } from '@/utils/sanitize';
import {
  formatAbsoluteRangeLabel,
  formatDurationShort,
  getTimeRangeShortLabel,
  getTimeRangeWindowMs,
  type TimeRange,
} from '@/utils/time-range';

const DENSITY_BUCKETS = 56;
/** Keeps rolling presets' axis honest without re-rendering on every frame. */
const LIVE_REFRESH_MS = 30_000;

type DragKind = 'start' | 'end' | 'pan' | null;

interface TickSpec {
  stepMs: number;
  format: (date: Date, index: number) => string;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Picks a readable tick interval and label style for the visible span. */
function chooseTicks(spanMs: number): TickSpec {
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  if (spanMs <= 2 * HOUR) return { stepMs: 15 * MINUTE, format: formatClock };
  if (spanMs <= 8 * HOUR) return { stepMs: HOUR, format: formatClock };
  if (spanMs <= 36 * HOUR) return { stepMs: 4 * HOUR, format: (d) => (d.getHours() === 0 ? formatDay(d) : formatClock(d)) };
  if (spanMs <= 4 * DAY) return { stepMs: 12 * HOUR, format: (d) => (d.getHours() === 0 ? formatDay(d) : formatClock(d)) };
  if (spanMs <= 16 * DAY) return { stepMs: 2 * DAY, format: formatDay };
  if (spanMs <= 70 * DAY) return { stepMs: 7 * DAY, format: formatDay };
  return { stepMs: 30 * DAY, format: formatDay };
}

/** `YYYY-MM-DDTHH:mm` in local time, the format `<input type="datetime-local">` wants. */
function toDateTimeLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Localised label with a guaranteed fallback. `t()` returns the raw key (or
 * nothing at all when i18next hasn't initialised yet), and a control rendered
 * before init would otherwise show "undefined" in place of every label.
 */
function label(key: string, fallback: string, vars: Record<string, unknown> = {}): string {
  const full = `components.timeScrubber.${key}`;
  const translated = t(full, { defaultValue: fallback, ...vars });
  return typeof translated === 'string' && translated && translated !== full ? translated : fallback;
}

const MARKER_GLYPH: Record<string, string> = {
  conflict: '⚔',
  market: '$',
  disaster: '▲',
  cyber: '⌁',
  unrest: '✊',
  news: '●',
};

const SEVERITY_RANK: Record<TimeMarkerSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/**
 * Marker slots across the axis. A dot is ~12px wide, so at a typical 500px
 * track this keeps neighbours from stacking on top of each other and stealing
 * one another's hover target.
 */
const MARKER_SLOTS = 40;

/** Titles listed inside a clustered marker's tooltip before it says "+N more". */
const TOOLTIP_MAX_ENTRIES = 4;

interface MarkerCluster {
  /** Position used for drawing and seeking — the lead marker's time. */
  time: number;
  severity: TimeMarkerSeverity;
  category: TimeMarkerCategory;
  markers: TimeMarker[];
}

/**
 * Collapses markers that would overlap into one dot, led by the most severe
 * (then most recent) member.
 */
function clusterMarkers(markers: readonly TimeMarker[], start: number, span: number): MarkerCluster[] {
  const slots = new Map<number, TimeMarker[]>();
  for (const marker of markers) {
    const slot = Math.round(((marker.time - start) / span) * MARKER_SLOTS);
    const bucket = slots.get(slot);
    if (bucket) bucket.push(marker);
    else slots.set(slot, [marker]);
  }

  return [...slots.values()]
    .map((bucket) => {
      const sorted = [...bucket].sort(
        (a, b) => (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b.time - a.time),
      );
      const lead = sorted[0]!;
      return { time: lead.time, severity: lead.severity, category: lead.category, markers: sorted };
    })
    .sort((a, b) => a.time - b.time);
}

export interface TimeScrubberOptions {
  /** Presets to offer, already ordered. */
  ranges: TimeRange[];
  /** Localised label for a preset chip. */
  formatRangeLabel?: (range: TimeRange) => string;
  /** Called after any change to the effective window. */
  onChange?: (snapshot: TimeControllerSnapshot) => void;
}

export class TimeScrubber {
  private readonly element: HTMLElement;
  private readonly track: HTMLElement;
  private readonly densityEl: HTMLElement;
  private readonly axisEl: HTMLElement;
  private readonly markersEl: HTMLElement;
  private readonly selectionEl: HTMLElement;
  private readonly playheadEl: HTMLElement;
  private readonly tooltipEl: HTMLElement;
  private readonly presetsEl: HTMLElement;
  private readonly transportEl: HTMLElement;
  private readonly pickerEl: HTMLElement;
  private readonly readoutEl: HTMLElement;

  private ranges: TimeRange[];
  private readonly formatRangeLabel: (range: TimeRange) => string;
  private readonly onChange?: (snapshot: TimeControllerSnapshot) => void;

  private markers: TimeMarker[] = [];
  private clusters: MarkerCluster[] = [];
  private drag: DragKind = null;
  private dragPointerId: number | null = null;
  /** Offsets from the pointer to each window edge, kept so a pan doesn't snap. */
  private dragOffsets = { start: 0, end: 0 };
  private frameHandle: number | null = null;
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribers: Array<() => void> = [];
  private destroyed = false;

  constructor(options: TimeScrubberOptions) {
    this.ranges = [...options.ranges];
    this.formatRangeLabel = options.formatRangeLabel ?? ((range) => getTimeRangeShortLabel(range));
    this.onChange = options.onChange;

    this.element = document.createElement('div');
    this.element.className = 'time-scrubber';
    this.element.innerHTML = `
      <div class="ts-presets" role="group" aria-label="${label('presets', 'Time presets')}"></div>
      <div class="ts-track" data-role="track" tabindex="0" role="group"
           aria-label="${label('timeline', 'Timeline')}">
        <div class="ts-density" aria-hidden="true"></div>
        <div class="ts-axis" aria-hidden="true"></div>
        <div class="ts-selection" data-role="selection">
          <span class="ts-handle ts-handle-start" data-role="handle-start" role="slider" tabindex="0"
                aria-label="${label('windowStart', 'Window start')}"></span>
          <span class="ts-selection-body" data-role="selection-body"></span>
          <span class="ts-handle ts-handle-end" data-role="handle-end" role="slider" tabindex="0"
                aria-label="${label('windowEnd', 'Window end')}"></span>
        </div>
        <div class="ts-markers"></div>
        <div class="ts-playhead" hidden></div>
      </div>
      <div class="ts-transport"></div>
      <div class="ts-picker" hidden></div>
      <div class="ts-tooltip" hidden role="tooltip"></div>
    `;

    this.presetsEl = this.query('.ts-presets');
    this.track = this.query('.ts-track');
    this.densityEl = this.query('.ts-density');
    this.axisEl = this.query('.ts-axis');
    this.markersEl = this.query('.ts-markers');
    this.selectionEl = this.query('.ts-selection');
    this.playheadEl = this.query('.ts-playhead');
    this.tooltipEl = this.query('.ts-tooltip');
    this.transportEl = this.query('.ts-transport');
    this.pickerEl = this.query('.ts-picker');

    this.renderPresets();
    this.renderTransport();
    this.renderPicker();
    this.readoutEl = this.query('.ts-readout');

    this.bindEvents();

    this.markers = getTimeMarkers();
    this.unsubscribers.push(
      subscribeTimeMarkers((markers) => {
        this.markers = markers;
        this.scheduleRender();
      }),
      timeController.subscribe((snapshot) => {
        this.scheduleRender();
        this.onChange?.(snapshot);
      }),
    );

    this.liveTimer = setInterval(() => {
      // Only rolling presets drift; a pinned range redraws identically.
      if (timeController.getMode() === 'preset') this.scheduleRender();
    }, LIVE_REFRESH_MS);

    this.render();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  /** Narrows the preset chips on offer (map control settings drives this). */
  setVisibleRanges(ranges: TimeRange[]): void {
    // Called on every window change, so skip the DOM rebuild when nothing moved
    // — re-rendering would drop focus mid-interaction.
    if (ranges.length === this.ranges.length && ranges.every((range, i) => this.ranges[i] === range)) return;
    this.ranges = [...ranges];
    this.renderPresets();
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    if (this.liveTimer !== null) clearInterval(this.liveTimer);
    this.liveTimer = null;
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = null;
    this.element.remove();
  }

  private query<T extends HTMLElement = HTMLElement>(selector: string): T {
    const el = this.element.querySelector<T>(selector);
    if (!el) throw new Error(`TimeScrubber: missing ${selector}`);
    return el;
  }

  // ---- static sub-renders ----------------------------------------------

  private renderPresets(): void {
    this.presetsEl.innerHTML = `
      ${this.ranges
        .map(
          (range) =>
            `<button type="button" class="ts-preset time-btn" data-range="${range}">${this.formatRangeLabel(range)}</button>`,
        )
        .join('')}
      <button type="button" class="ts-preset ts-picker-toggle" data-action="toggle-picker"
              title="${label('customRange', 'Custom date range')}"
              aria-label="${label('customRange', 'Custom date range')}" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
        </svg>
      </button>
    `;
  }

  private renderTransport(): void {
    this.transportEl.innerHTML = `
      <button type="button" class="ts-transport-btn" data-action="step-back"
              title="${label('stepBack', 'Step back')}" aria-label="${label('stepBack', 'Step back')}">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18 6v12l-9-6zM7 6h2v12H7z"/></svg>
      </button>
      <button type="button" class="ts-transport-btn ts-play" data-action="play"
              title="${label('play', 'Play')}" aria-label="${label('play', 'Play')}" aria-pressed="false">
        <svg class="ts-icon-play" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg class="ts-icon-pause" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
      </button>
      <button type="button" class="ts-transport-btn" data-action="step-forward"
              title="${label('stepForward', 'Step forward')}" aria-label="${label('stepForward', 'Step forward')}">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 6v12l9-6zM15 6h2v12h-2z"/></svg>
      </button>
      <div class="ts-speeds" role="group" aria-label="${label('speed', 'Playback speed')}">
        ${PLAYBACK_SPEEDS.map((speed) => `<button type="button" class="ts-speed" data-speed="${speed}">${speed}x</button>`).join('')}
      </div>
      <button type="button" class="ts-transport-btn ts-loop" data-action="loop"
              title="${label('loop', 'Loop playback')}" aria-label="${label('loop', 'Loop playback')}" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
        </svg>
      </button>
      <button type="button" class="ts-live" data-action="live" title="${label('backToLive', 'Back to live')}">${label('live', 'LIVE')}</button>
      <span class="ts-readout" aria-live="polite"></span>
    `;
  }

  private renderPicker(): void {
    this.pickerEl.innerHTML = `
      <div class="ts-picker-row">
        <label class="ts-picker-field">
          <span>${label('from', 'From')}</span>
          <input type="datetime-local" data-picker="start">
        </label>
        <label class="ts-picker-field">
          <span>${label('to', 'To')}</span>
          <input type="datetime-local" data-picker="end">
        </label>
      </div>
      <div class="ts-picker-quick">
        <button type="button" data-quick="today">${label('quickToday', 'Today')}</button>
        <button type="button" data-quick="yesterday">${label('quickYesterday', 'Yesterday')}</button>
        <button type="button" data-quick="week">${label('quickWeek', 'Last 7 days')}</button>
        <button type="button" data-quick="month">${label('quickMonth', 'Last 30 days')}</button>
      </div>
      <div class="ts-picker-actions">
        <button type="button" class="ts-picker-apply" data-action="apply-range">${label('apply', 'Apply')}</button>
        <button type="button" class="ts-picker-clear" data-action="clear-range">${label('clear', 'Clear')}</button>
      </div>
      <div class="ts-picker-error" hidden role="alert"></div>
    `;
  }

  // ---- event wiring -----------------------------------------------------

  private bindEvents(): void {
    this.presetsEl.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button');
      if (!button) return;
      if (button.dataset.action === 'toggle-picker') {
        this.togglePicker();
        return;
      }
      const range = button.dataset.range as TimeRange | undefined;
      if (range) timeController.setRange(range);
    });

    this.transportEl.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button');
      if (!button) return;
      const speed = button.dataset.speed;
      if (speed) {
        timeController.setSpeed(Number(speed) as PlaybackSpeed);
        return;
      }
      switch (button.dataset.action) {
        case 'play':
          timeController.toggle();
          break;
        case 'step-back':
          timeController.step(-1);
          break;
        case 'step-forward':
          timeController.step(1);
          break;
        case 'loop':
          timeController.setLoop(!timeController.isLooping());
          break;
        case 'live':
          timeController.setRange(timeController.getRange());
          break;
      }
    });

    this.pickerEl.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button');
      if (!button) return;
      const quick = button.dataset.quick;
      if (quick) {
        this.applyQuickRange(quick);
        return;
      }
      if (button.dataset.action === 'apply-range') this.applyPickerRange();
      if (button.dataset.action === 'clear-range') {
        timeController.setAbsoluteRange(null);
        this.showPickerError(null);
      }
    });

    this.pickerEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        this.applyPickerRange();
      }
    });

    this.track.addEventListener('pointerdown', (event) => this.onTrackPointerDown(event));
    this.track.addEventListener('pointermove', (event) => this.onTrackPointerMove(event));
    this.track.addEventListener('pointerup', (event) => this.endDrag(event));
    this.track.addEventListener('pointercancel', (event) => this.endDrag(event));
    this.track.addEventListener('keydown', (event) => this.onTrackKeyDown(event));

    this.markersEl.addEventListener('pointerover', (event) => {
      const marker = (event.target as HTMLElement).closest<HTMLElement>('.ts-marker');
      if (marker) this.showMarkerTooltip(marker);
    });
    this.markersEl.addEventListener('pointerout', (event) => {
      const marker = (event.target as HTMLElement).closest<HTMLElement>('.ts-marker');
      const next = (event as PointerEvent).relatedTarget as HTMLElement | null;
      if (marker && !next?.closest('.ts-marker')) this.hideTooltip();
    });
    this.markersEl.addEventListener('focusin', (event) => {
      const marker = (event.target as HTMLElement).closest<HTMLElement>('.ts-marker');
      if (marker) this.showMarkerTooltip(marker);
    });
    this.markersEl.addEventListener('focusout', () => this.hideTooltip());
    this.markersEl.addEventListener('click', (event) => {
      const markerEl = (event.target as HTMLElement).closest<HTMLElement>('.ts-marker');
      if (!markerEl) return;
      event.stopPropagation();
      const time = Number(markerEl.dataset.time);
      if (Number.isFinite(time)) this.centerWindowOn(time);
    });
  }

  private togglePicker(): void {
    const open = this.pickerEl.hidden;
    this.pickerEl.hidden = !open;
    this.presetsEl
      .querySelector<HTMLElement>('[data-action="toggle-picker"]')
      ?.setAttribute('aria-expanded', String(open));
    if (open) {
      // Seed the inputs from whatever window is currently in force.
      const snapshot = timeController.getSnapshot();
      const start = snapshot.absolute?.start ?? snapshot.timeline.start;
      const end = snapshot.absolute?.end ?? snapshot.timeline.end;
      this.pickerInput('start').value = toDateTimeLocal(start);
      this.pickerInput('end').value = toDateTimeLocal(end);
      this.showPickerError(null);
    }
  }

  private pickerInput(which: 'start' | 'end'): HTMLInputElement {
    return this.query<HTMLInputElement>(`input[data-picker="${which}"]`);
  }

  private applyPickerRange(): void {
    const start = fromDateTimeLocal(this.pickerInput('start').value);
    const end = fromDateTimeLocal(this.pickerInput('end').value);
    if (start === null || end === null) {
      this.showPickerError(label('errorIncomplete', 'Pick both a start and an end.'));
      return;
    }
    if (!timeController.setAbsoluteRange({ start, end })) {
      this.showPickerError(label('errorTooShort', 'Range must span at least a minute.'));
      return;
    }
    this.showPickerError(null);
  }

  private applyQuickRange(quick: string): void {
    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const DAY = 24 * 60 * 60 * 1000;

    let range: { start: number; end: number };
    switch (quick) {
      case 'today':
        range = { start: midnight.getTime(), end: now };
        break;
      case 'yesterday':
        range = { start: midnight.getTime() - DAY, end: midnight.getTime() };
        break;
      case 'week':
        range = { start: now - 7 * DAY, end: now };
        break;
      case 'month':
        range = { start: now - 30 * DAY, end: now };
        break;
      default:
        return;
    }

    this.pickerInput('start').value = toDateTimeLocal(range.start);
    this.pickerInput('end').value = toDateTimeLocal(range.end);
    timeController.setAbsoluteRange(range);
    this.showPickerError(null);
  }

  private showPickerError(message: string | null): void {
    const el = this.query('.ts-picker-error');
    el.textContent = message ?? '';
    el.hidden = message === null;
  }

  // ---- track interaction -------------------------------------------------

  private timeAtClientX(clientX: number): number {
    const rect = this.track.getBoundingClientRect();
    const timeline = timeController.getTimeline();
    const fraction = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
    return timeline.start + fraction * (timeline.end - timeline.start);
  }

  private onTrackPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.ts-marker')) return;

    const time = this.timeAtClientX(event.clientX);
    const snapshot = timeController.getSnapshot();
    const visible = this.visibleWindow(snapshot);

    if (target.closest('[data-role="handle-start"]')) this.drag = 'start';
    else if (target.closest('[data-role="handle-end"]')) this.drag = 'end';
    else if (target.closest('[data-role="selection-body"]')) this.drag = 'pan';
    else {
      // Bare-track click re-centres the current window width on that instant.
      this.centerWindowOn(time);
      return;
    }

    this.dragOffsets = { start: visible.start - time, end: visible.end - time };
    this.dragPointerId = event.pointerId;
    this.track.setPointerCapture(event.pointerId);
    this.element.classList.add('ts-dragging');
    event.preventDefault();
  }

  private onTrackPointerMove(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.dragPointerId) return;
    const time = this.timeAtClientX(event.clientX);
    const timeline = timeController.getTimeline();
    const visible = this.visibleWindow(timeController.getSnapshot());

    if (this.drag === 'start') {
      timeController.setWindowFromTimeline(time, visible.end);
    } else if (this.drag === 'end') {
      timeController.setWindowFromTimeline(visible.start, time);
    } else {
      const width = visible.end - visible.start;
      let start = time + this.dragOffsets.start;
      start = clamp(start, timeline.start, timeline.end - width);
      timeController.setWindowFromTimeline(start, start + width);
    }
  }

  private endDrag(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.drag = null;
    this.dragPointerId = null;
    if (this.track.hasPointerCapture(event.pointerId)) this.track.releasePointerCapture(event.pointerId);
    this.element.classList.remove('ts-dragging');
  }

  private onTrackKeyDown(event: KeyboardEvent): void {
    const visible = this.visibleWindow(timeController.getSnapshot());
    const width = visible.end - visible.start;
    const nudge = width / 10;
    const target = event.target as HTMLElement;
    const isStartHandle = !!target.closest('[data-role="handle-start"]');
    const isEndHandle = !!target.closest('[data-role="handle-end"]');

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const delta = direction * (event.shiftKey ? width : nudge);
        if (isStartHandle) timeController.setWindowFromTimeline(visible.start + delta, visible.end);
        else if (isEndHandle) timeController.setWindowFromTimeline(visible.start, visible.end + delta);
        else timeController.setWindowFromTimeline(visible.start + delta, visible.end + delta);
        event.preventDefault();
        break;
      }
      case ' ':
      case 'Spacebar':
        timeController.toggle();
        event.preventDefault();
        break;
      case 'Home':
        this.centerWindowOn(timeController.getTimeline().start + width / 2);
        event.preventDefault();
        break;
      case 'End':
        timeController.setRange(timeController.getRange());
        event.preventDefault();
        break;
    }
  }

  /** Re-centres the current window width on `time`, clamped to the timeline. */
  private centerWindowOn(time: number): void {
    const snapshot = timeController.getSnapshot();
    const visible = this.visibleWindow(snapshot);
    const width = visible.end - visible.start;
    const timeline = snapshot.timeline;
    let start = time - width / 2;
    start = clamp(start, timeline.start, Math.max(timeline.start, timeline.end - width));
    timeController.setWindowFromTimeline(start, start + width);
  }

  /**
   * The window projected onto the timeline for drawing. Rolling presets report
   * an open upper bound and "all" an infinite lower one; both are clipped here
   * so the brush always has finite edges to render and drag.
   */
  private visibleWindow(snapshot: TimeControllerSnapshot): { start: number; end: number } {
    const { timeline, window } = snapshot;
    const start = Number.isFinite(window.start) ? Math.max(window.start, timeline.start) : timeline.start;
    const end = Number.isFinite(window.end) ? Math.min(window.end, timeline.end) : timeline.end;
    if (end <= start) return { start: timeline.start, end: timeline.end };
    return { start, end };
  }

  // ---- rendering ---------------------------------------------------------

  private scheduleRender(): void {
    if (this.frameHandle !== null || this.destroyed) return;
    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;
      this.render();
    });
  }

  private render(): void {
    if (this.destroyed) return;
    const snapshot = timeController.getSnapshot();
    const { timeline } = snapshot;
    const span = Math.max(1, timeline.end - timeline.start);
    const toPercent = (ts: number) => clamp(((ts - timeline.start) / span) * 100, 0, 100);

    this.renderPresetState(snapshot);
    this.renderDensity(timeline.start, span);
    this.renderAxis(timeline.start, span);
    this.renderMarkers(toPercent, this.visibleWindow(snapshot));
    this.renderSelection(snapshot, toPercent);
    this.renderTransportState(snapshot);
    this.element.dataset.mode = snapshot.mode;
  }

  private renderPresetState(snapshot: TimeControllerSnapshot): void {
    const presetActive = snapshot.mode === 'preset';
    this.presetsEl.querySelectorAll<HTMLElement>('.ts-preset[data-range]').forEach((button) => {
      button.classList.toggle('active', presetActive && button.dataset.range === snapshot.range);
    });
    this.presetsEl
      .querySelector<HTMLElement>('[data-action="toggle-picker"]')
      ?.classList.toggle('active', snapshot.absolute !== null);
  }

  private renderDensity(start: number, span: number): void {
    const counts = new Array<number>(DENSITY_BUCKETS).fill(0);
    for (const marker of this.markers) {
      const index = Math.floor(((marker.time - start) / span) * DENSITY_BUCKETS);
      if (index >= 0 && index < DENSITY_BUCKETS) counts[index]! += 1;
    }
    const peak = Math.max(1, ...counts);
    const width = 100 / DENSITY_BUCKETS;
    this.densityEl.innerHTML = counts
      .map((count, index) => {
        if (count === 0) return '';
        // sqrt keeps a single event visible without letting spikes dominate.
        const height = Math.max(8, Math.round((Math.sqrt(count) / Math.sqrt(peak)) * 100));
        return `<span class="ts-density-bar" style="left:${(index * width).toFixed(3)}%;width:${width.toFixed(3)}%;height:${height}%"></span>`;
      })
      .join('');
  }

  private renderAxis(start: number, span: number): void {
    const { stepMs, format } = chooseTicks(span);
    const first = Math.ceil(start / stepMs) * stepMs;
    const parts: string[] = [];
    let index = 0;
    for (let ts = first; ts <= start + span; ts += stepMs, index += 1) {
      const percent = ((ts - start) / span) * 100;
      if (percent < 2 || percent > 98) continue;
      parts.push(
        `<span class="ts-tick" style="left:${percent.toFixed(3)}%"><i></i><b>${format(new Date(ts), index)}</b></span>`,
      );
    }
    this.axisEl.innerHTML = parts.join('');
  }

  private renderMarkers(toPercent: (ts: number) => number, window: { start: number; end: number }): void {
    const timeline = timeController.getTimeline();
    const span = Math.max(1, timeline.end - timeline.start);
    const onAxis = this.markers.filter((marker) => marker.time >= timeline.start && marker.time <= timeline.end);
    this.clusters = clusterMarkers(onAxis, timeline.start, span);

    this.markersEl.innerHTML = this.clusters
      .map((cluster, index) => {
        const count = cluster.markers.length;
        const glyph = count > 1 ? String(Math.min(count, 99)) : MARKER_GLYPH[cluster.category] ?? '●';
        // Markers outside the filter window stay drawn but dimmed — they're
        // the context that makes dragging the brush worthwhile.
        const outside = cluster.time < window.start || cluster.time > window.end ? ' ts-marker--outside' : '';
        const multiple = count > 1 ? ' ts-marker--cluster' : '';
        const label = count > 1
          ? `${count} events around ${new Date(cluster.time).toLocaleString()}`
          : cluster.markers[0]!.title;
        return `<button type="button" class="ts-marker ts-marker--${cluster.severity} ts-marker--${cluster.category}${multiple}${outside}"
          style="left:${toPercent(cluster.time).toFixed(3)}%"
          data-cluster="${index}" data-time="${cluster.time}"
          aria-label="${escapeHtml(label)}"><span aria-hidden="true">${escapeHtml(glyph)}</span></button>`;
      })
      .join('');
  }

  private renderSelection(snapshot: TimeControllerSnapshot, toPercent: (ts: number) => number): void {
    const visible = this.visibleWindow(snapshot);
    const left = toPercent(visible.start);
    const right = toPercent(visible.end);
    this.selectionEl.style.left = `${left.toFixed(3)}%`;
    this.selectionEl.style.width = `${Math.max(0.5, right - left).toFixed(3)}%`;

    const startHandle = this.selectionEl.querySelector<HTMLElement>('[data-role="handle-start"]');
    const endHandle = this.selectionEl.querySelector<HTMLElement>('[data-role="handle-end"]');
    startHandle?.setAttribute('aria-valuetext', new Date(visible.start).toLocaleString());
    endHandle?.setAttribute('aria-valuetext', new Date(visible.end).toLocaleString());

    if (snapshot.mode === 'playback') {
      this.playheadEl.hidden = false;
      this.playheadEl.style.left = `${toPercent(snapshot.cursor).toFixed(3)}%`;
    } else {
      this.playheadEl.hidden = true;
    }
  }

  private renderTransportState(snapshot: TimeControllerSnapshot): void {
    const playBtn = this.transportEl.querySelector<HTMLElement>('.ts-play');
    playBtn?.setAttribute('aria-pressed', String(snapshot.playing));
    playBtn?.classList.toggle('active', snapshot.playing);
    // `hidden` as a property only exists on HTMLElement — these icons are SVG,
    // so the attribute has to be set explicitly.
    const setHidden = (el: Element | null, hidden: boolean) => {
      if (!el) return;
      if (hidden) el.setAttribute('hidden', '');
      else el.removeAttribute('hidden');
    };
    setHidden(playBtn?.querySelector('.ts-icon-play') ?? null, snapshot.playing);
    setHidden(playBtn?.querySelector('.ts-icon-pause') ?? null, !snapshot.playing);
    if (playBtn) {
      const text = snapshot.playing ? label('pause', 'Pause') : label('play', 'Play');
      playBtn.setAttribute('title', text);
      playBtn.setAttribute('aria-label', text);
    }

    this.transportEl.querySelectorAll<HTMLElement>('.ts-speed').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.speed) === snapshot.speed);
    });

    const loopBtn = this.transportEl.querySelector<HTMLElement>('.ts-loop');
    loopBtn?.classList.toggle('active', snapshot.loop);
    loopBtn?.setAttribute('aria-pressed', String(snapshot.loop));

    const liveBtn = this.transportEl.querySelector<HTMLElement>('.ts-live');
    if (liveBtn) {
      const isLive = snapshot.mode === 'preset';
      liveBtn.classList.toggle('active', isLive);
      liveBtn.hidden = isLive;
    }

    this.readoutEl.textContent = this.buildReadout(snapshot);
  }

  private buildReadout(snapshot: TimeControllerSnapshot): string {
    if (snapshot.mode === 'playback') {
      const visible = this.visibleWindow(snapshot);
      return `${formatAbsoluteRangeLabel({ start: visible.start, end: visible.end })} · ${formatDurationShort(visible.end - visible.start)}`;
    }
    if (snapshot.absolute) {
      return `${formatAbsoluteRangeLabel(snapshot.absolute)} · ${formatDurationShort(snapshot.absolute.end - snapshot.absolute.start)}`;
    }
    const windowMs = getTimeRangeWindowMs(snapshot.range);
    if (!Number.isFinite(windowMs)) {
      return label('readoutAll', 'All available history');
    }
    const duration = formatDurationShort(windowMs);
    return label('readoutLive', `Last ${duration} · live`, { duration });
  }

  // ---- tooltip -----------------------------------------------------------

  private showMarkerTooltip(markerEl: HTMLElement): void {
    const cluster = this.clusters[Number(markerEl.dataset.cluster)];
    if (!cluster) return;
    const when = (ts: number) => new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const shown = cluster.markers.slice(0, TOOLTIP_MAX_ENTRIES);
    const overflow = cluster.markers.length - shown.length;
    this.tooltipEl.innerHTML = `
      <div class="ts-tooltip-head">
        <span class="ts-tooltip-sev ts-tooltip-sev--${cluster.severity}"></span>
        <span class="ts-tooltip-time">${when(cluster.time)}</span>
        <span class="ts-tooltip-cat">${cluster.markers.length > 1 ? `${cluster.markers.length} events` : escapeHtml(cluster.category)}</span>
      </div>
      ${shown
        .map(
          (marker) => `
        <div class="ts-tooltip-entry">
          <div class="ts-tooltip-title" data-slot="title"></div>
          ${marker.detail ? '<div class="ts-tooltip-detail" data-slot="detail"></div>' : ''}
          ${marker.source ? '<div class="ts-tooltip-source" data-slot="source"></div>' : ''}
        </div>`,
        )
        .join('')}
      ${overflow > 0 ? `<div class="ts-tooltip-more">+${overflow} more</div>` : ''}
    `;

    // Feed text goes through textContent — titles come from external sources.
    const entries = this.tooltipEl.querySelectorAll('.ts-tooltip-entry');
    shown.forEach((marker, index) => {
      const entry = entries[index];
      if (!entry) return;
      entry.querySelector('[data-slot="title"]')!.textContent = marker.title;
      const detail = entry.querySelector('[data-slot="detail"]');
      if (detail) detail.textContent = marker.detail ?? '';
      const source = entry.querySelector('[data-slot="source"]');
      if (source) source.textContent = marker.source ?? '';
    });

    this.tooltipEl.hidden = false;
    // Anchor over the marker, then pull back inside the track's edges.
    const trackRect = this.track.getBoundingClientRect();
    const markerRect = markerEl.getBoundingClientRect();
    const tooltipWidth = this.tooltipEl.offsetWidth;
    const centre = markerRect.left + markerRect.width / 2 - trackRect.left;
    const left = clamp(centre - tooltipWidth / 2, 0, Math.max(0, trackRect.width - tooltipWidth));
    this.tooltipEl.style.left = `${left}px`;
  }

  private hideTooltip(): void {
    this.tooltipEl.hidden = true;
  }
}

export type { TimeMarker, TimeMarkerSeverity };
