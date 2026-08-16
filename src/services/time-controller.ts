/**
 * Owns the app's effective time filter — the one window every panel, map layer
 * and scrubber agrees on.
 *
 * Three modes feed the same `TimeWindow` output:
 *  - **preset**   rolling lookback ending "now" (`1h`, `24h`, `all`, …). The
 *                 window's upper bound stays `Infinity` so future-dated items
 *                 are never dropped, matching the behaviour presets had before
 *                 the scrubber existed.
 *  - **absolute** both ends pinned, produced by the date-range picker or by
 *                 dragging the scrubber's brush handles.
 *  - **playback** a fixed-width window swept across the timeline extent by the
 *                 transport controls.
 *
 * The window is computed on read rather than stored, so a rolling preset keeps
 * tracking the wall clock without anyone having to re-set it.
 */
import {
  ALL_RANGE_TIMELINE_MS,
  MIN_ABSOLUTE_RANGE_MS,
  formatAbsoluteRangeLabel,
  getStoredAbsoluteRange,
  getTimeRangeLabel,
  getTimeRangeTimelineMs,
  getTimeRangeWindowMs,
  normalizeAbsoluteRange,
  setStoredAbsoluteRange,
  type AbsoluteRange,
  type TimeRange,
  type TimeWindow,
} from '@/utils/time-range';

export const PLAYBACK_SPEEDS = [1, 2, 5, 10] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** Wall-clock seconds a full-extent playback takes at 1x. */
const PLAYBACK_SWEEP_MS = 24_000;

/** Playback's moving window is this fraction of the timeline extent. */
const PLAYBACK_WINDOW_FRACTION = 1 / 12;
const MIN_PLAYBACK_WINDOW_MS = 5 * 60 * 1000;

export const TIME_WINDOW_EVENT = 'wm:time-window-changed';

export type TimeMode = 'preset' | 'absolute' | 'playback';

export interface TimeControllerSnapshot {
  mode: TimeMode;
  /** Preset backing the timeline extent. Stays meaningful in every mode. */
  range: TimeRange;
  absolute: AbsoluteRange | null;
  /** Full extent the scrubber draws — not the filter window. */
  timeline: AbsoluteRange;
  /** Resolved filter window; `start`/`end` may be infinite. */
  window: TimeWindow;
  playing: boolean;
  speed: PlaybackSpeed;
  /** Trailing edge of the playback window, epoch ms. */
  cursor: number;
  /** Width of the playback window, ms. */
  playbackWindowMs: number;
  loop: boolean;
}

type Listener = (snapshot: TimeControllerSnapshot) => void;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Share of the range added to each side when framing it on the axis. */
const VIEW_PADDING_FRACTION = 0.25;

/** Pads a pinned range so its brush has room to be dragged wider again. */
function frameRange(range: AbsoluteRange): AbsoluteRange {
  const padding = (range.end - range.start) * VIEW_PADDING_FRACTION;
  return { start: range.start - padding, end: range.end + padding };
}

class TimeController {
  private range: TimeRange = '24h';
  private absolute: AbsoluteRange | null = null;
  /**
   * The axis the scrubber draws, held separately from the selection so that
   * dragging the brush narrows what's *selected* without narrowing what's
   * *visible* — otherwise each drag would shrink the axis and the window could
   * never be widened again.
   */
  private viewExtent: AbsoluteRange | null = null;
  private playing = false;
  private speed: PlaybackSpeed = 1;
  private loop = false;
  /** Trailing edge of the playback window; `null` until playback first starts. */
  private cursor: number | null = null;
  private rafId: number | null = null;
  private lastFrameAt = 0;
  private listeners = new Set<Listener>();
  private hydrated = false;

  /**
   * Reads persisted absolute range on first use rather than at module load, so
   * this module stays importable in non-DOM test environments.
   */
  private hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    if (typeof localStorage === 'undefined') return;
    this.absolute = getStoredAbsoluteRange();
  }

  getRange(): TimeRange {
    return this.range;
  }

  getMode(): TimeMode {
    this.hydrate();
    if (this.playing || this.cursor !== null) return 'playback';
    return this.absolute ? 'absolute' : 'preset';
  }

  /** Extent the scrubber draws: the framed view, or the preset ending now. */
  getTimeline(): AbsoluteRange {
    this.hydrate();
    if (this.viewExtent) return { ...this.viewExtent };
    if (this.absolute) return frameRange(this.absolute);
    const end = Date.now();
    return { start: end - getTimeRangeTimelineMs(this.range), end };
  }

  getPlaybackWindowMs(): number {
    const timeline = this.getTimeline();
    const span = timeline.end - timeline.start;
    return Math.max(MIN_PLAYBACK_WINDOW_MS, span * PLAYBACK_WINDOW_FRACTION);
  }

  /**
   * The window everything filters against. Computed per call so rolling
   * presets follow the clock.
   */
  getWindow(): TimeWindow {
    this.hydrate();
    if (this.cursor !== null) {
      const timeline = this.getTimeline();
      const width = this.getPlaybackWindowMs();
      const end = clamp(this.cursor, timeline.start + width, timeline.end);
      return { start: end - width, end };
    }
    if (this.absolute) return { start: this.absolute.start, end: this.absolute.end };
    const windowMs = getTimeRangeWindowMs(this.range);
    if (!Number.isFinite(windowMs)) return { start: -Infinity, end: Infinity };
    return { start: Date.now() - windowMs, end: Infinity };
  }

  /** True when `ts` falls inside the active window. Nullish stays visible. */
  contains(ts: number | string | Date | null | undefined): boolean {
    if (ts == null) return true;
    const ms = ts instanceof Date ? ts.getTime() : typeof ts === 'number' ? ts : new Date(ts).getTime();
    if (!Number.isFinite(ms)) return true;
    const { start, end } = this.getWindow();
    return ms >= start && ms <= end;
  }

  getSnapshot(): TimeControllerSnapshot {
    const timeline = this.getTimeline();
    return {
      mode: this.getMode(),
      range: this.range,
      absolute: this.absolute ? { ...this.absolute } : null,
      timeline,
      window: this.getWindow(),
      playing: this.playing,
      speed: this.speed,
      cursor: this.cursor ?? timeline.end,
      playbackWindowMs: this.getPlaybackWindowMs(),
      loop: this.loop,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Seeds the preset at construction time. Unlike {@link setRange} this leaves
   * a persisted or URL-supplied pinned window intact — the map constructing
   * itself is not the user asking to go back to a rolling window.
   */
  initRange(range: TimeRange): void {
    this.hydrate();
    this.range = range;
  }

  /**
   * Switches to a rolling preset. Clears any absolute range and stops
   * playback — picking "6h" should mean the last 6 hours, live.
   */
  setRange(range: TimeRange, options: { silent?: boolean } = {}): void {
    this.hydrate();
    const changed = this.range !== range || this.absolute !== null || this.cursor !== null;
    this.range = range;
    this.setAbsoluteInternal(null);
    this.viewExtent = null;
    this.stopTicking();
    this.playing = false;
    this.cursor = null;
    if (changed && !options.silent) this.emit();
  }

  /**
   * Pins both ends. `null` drops back to the active preset. Ranges shorter
   * than {@link MIN_ABSOLUTE_RANGE_MS} are rejected and leave state untouched.
   *
   * `reframe` reflows the visible axis around the new range — right for the
   * date picker and shared links, wrong for a brush drag, which must leave the
   * axis where the user is dragging on it.
   */
  setAbsoluteRange(range: AbsoluteRange | null, options: { reframe?: boolean } = {}): boolean {
    this.hydrate();
    const reframe = options.reframe ?? true;
    if (range === null) {
      this.setAbsoluteInternal(null);
      this.viewExtent = null;
      this.cursor = null;
      this.pause();
      this.emit();
      return true;
    }
    const normalized = normalizeAbsoluteRange(range);
    if (!normalized) return false;
    if (reframe) this.viewExtent = frameRange(normalized);
    this.setAbsoluteInternal(normalized);
    this.cursor = null;
    this.pause();
    this.emit();
    return true;
  }

  /**
   * Re-broadcasts the current window without changing it — used when an input
   * the window derives from changed (e.g. the custom-lookback length).
   */
  refresh(): void {
    this.emit();
  }

  private setAbsoluteInternal(range: AbsoluteRange | null): void {
    this.absolute = range;
    setStoredAbsoluteRange(range);
  }

  /**
   * Nudges only the window's edges while keeping the timeline extent — used by
   * the scrubber's brush handles, which shouldn't collapse the axis they live on.
   */
  setWindowFromTimeline(start: number, end: number): boolean {
    const timeline = this.getTimeline();
    const lo = clamp(Math.min(start, end), timeline.start, timeline.end);
    const hi = clamp(Math.max(start, end), timeline.start, timeline.end);
    if (hi - lo < MIN_ABSOLUTE_RANGE_MS) return false;
    // Pin the axis first so the drag doesn't move the ground under itself.
    this.viewExtent = timeline;
    return this.setAbsoluteRange({ start: lo, end: hi }, { reframe: false });
  }

  // ---- playback ---------------------------------------------------------

  getSpeed(): PlaybackSpeed {
    return this.speed;
  }

  setSpeed(speed: PlaybackSpeed): void {
    if (this.speed === speed) return;
    this.speed = speed;
    this.emit();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setLoop(loop: boolean): void {
    if (this.loop === loop) return;
    this.loop = loop;
    this.emit();
  }

  isLooping(): boolean {
    return this.loop;
  }

  play(): void {
    this.hydrate();
    if (this.playing) return;
    const timeline = this.getTimeline();
    const width = this.getPlaybackWindowMs();
    const startCursor = timeline.start + width;
    // Restart from the beginning when parked at (or past) the end.
    if (this.cursor === null || this.cursor >= timeline.end - 1) this.cursor = startCursor;
    this.playing = true;
    this.lastFrameAt = 0;
    this.startTicking();
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.stopTicking();
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Leaves playback entirely and returns to the underlying preset/absolute window. */
  stop(): void {
    const wasEngaged = this.playing || this.cursor !== null;
    this.playing = false;
    this.cursor = null;
    this.stopTicking();
    if (wasEngaged) this.emit();
  }

  /** Moves the playback cursor by one window width (sign chooses direction). */
  step(direction: -1 | 1): void {
    const timeline = this.getTimeline();
    const width = this.getPlaybackWindowMs();
    const current = this.cursor ?? timeline.end;
    this.seek(current + direction * width);
  }

  /** Parks the playback cursor at an absolute timestamp, clamped to the timeline. */
  seek(cursor: number): void {
    this.hydrate();
    const timeline = this.getTimeline();
    const width = this.getPlaybackWindowMs();
    this.cursor = clamp(cursor, timeline.start + width, timeline.end);
    this.emit();
  }

  /** Parks the cursor at a 0–1 position along the timeline. */
  seekFraction(fraction: number): void {
    const timeline = this.getTimeline();
    const span = timeline.end - timeline.start;
    this.seek(timeline.start + clamp(fraction, 0, 1) * span);
  }

  private startTicking(): void {
    if (this.rafId !== null || typeof requestAnimationFrame === 'undefined') return;
    const tick = (now: number) => {
      this.rafId = null;
      if (!this.playing) return;
      const previous = this.lastFrameAt || now;
      // Cap the delta so a backgrounded tab doesn't jump the whole timeline.
      const deltaMs = Math.min(now - previous, 250);
      this.lastFrameAt = now;

      const timeline = this.getTimeline();
      const span = timeline.end - timeline.start;
      const width = this.getPlaybackWindowMs();
      const advance = (deltaMs / PLAYBACK_SWEEP_MS) * span * this.speed;
      const next = (this.cursor ?? timeline.start + width) + advance;

      if (next >= timeline.end) {
        if (this.loop) {
          this.cursor = timeline.start + width;
        } else {
          this.cursor = timeline.end;
          this.playing = false;
          this.emit();
          return;
        }
      } else {
        this.cursor = next;
      }
      this.emit();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTicking(): void {
    if (this.rafId === null) return;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastFrameAt = 0;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[TimeController] listener failed', err);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TIME_WINDOW_EVENT, { detail: snapshot }));
    }
  }

  /** Test seam — drops all state and listeners. */
  reset(): void {
    this.stopTicking();
    this.range = '24h';
    this.absolute = null;
    this.viewExtent = null;
    this.playing = false;
    this.speed = 1;
    this.loop = false;
    this.cursor = null;
    this.hydrated = true;
    this.listeners.clear();
  }
}

export const timeController = new TimeController();

/**
 * Human-readable description of the active window, for empty states like
 * "No items in {label}". Mirrors `getTimeRangeLabel` for plain presets and
 * spells out the endpoints for pinned or playback windows.
 */
export function describeTimeWindow(): string {
  const snapshot = timeController.getSnapshot();
  if (snapshot.mode === 'preset') return getTimeRangeLabel(snapshot.range);
  const { start, end } = snapshot.window;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return getTimeRangeLabel(snapshot.range);
  return formatAbsoluteRangeLabel({ start, end });
}

/** Convenience filter shared by panels and map layers. */
export function filterByTimeWindow<T>(
  items: readonly T[],
  getTime: (item: T) => Date | string | number | undefined | null,
): T[] {
  const { start, end } = timeController.getWindow();
  if (start === -Infinity && end === Infinity) return items as T[];
  return items.filter((item) => {
    const raw = getTime(item);
    if (raw == null) return true;
    const ts = raw instanceof Date ? raw.getTime() : typeof raw === 'number' ? raw : new Date(raw).getTime();
    if (!Number.isFinite(ts)) return true;
    return ts >= start && ts <= end;
  });
}

export { ALL_RANGE_TIMELINE_MS };
