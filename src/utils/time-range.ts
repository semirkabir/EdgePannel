export type TimeRange = '1h' | '6h' | '24h' | '48h' | '7d' | 'custom' | 'all';
export type CustomLookbackUnit = 'h' | 'd';

export interface CustomLookbackConfig {
  value: number;
  unit: CustomLookbackUnit;
}

/**
 * An explicit start/end pair in epoch milliseconds. Presets express a rolling
 * lookback ("last 6 hours"); an absolute range pins both ends, which is what
 * the date-range picker and playback scrubbing produce.
 */
export interface AbsoluteRange {
  start: number;
  end: number;
}

/**
 * The resolved filter window every consumer should test timestamps against.
 * `start` may be `-Infinity` (the "all" preset) and `end` may be `Infinity`
 * (any rolling preset, which never excludes future-dated items).
 */
export interface TimeWindow {
  start: number;
  end: number;
}

export const TIME_RANGE_OPTIONS: TimeRange[] = ['1h', '6h', '24h', '48h', '7d', 'custom', 'all'];

export function getSortedTimeRanges(): TimeRange[] {
  return [...TIME_RANGE_OPTIONS].sort((a, b) => getTimeRangeWindowMs(a) - getTimeRangeWindowMs(b));
}

const CUSTOM_LOOKBACK_STORAGE_KEY = 'wm-custom-lookback';
const DEFAULT_CUSTOM_LOOKBACK: CustomLookbackConfig = { value: 12, unit: 'h' };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCustomLookback(config: Partial<CustomLookbackConfig> | null | undefined): CustomLookbackConfig {
  const unit: CustomLookbackUnit = config?.unit === 'd' ? 'd' : 'h';
  const parsedValue = Number(config?.value);
  const max = unit === 'd' ? 365 : 8760;
  const value = Number.isFinite(parsedValue) ? clamp(Math.round(parsedValue), 1, max) : DEFAULT_CUSTOM_LOOKBACK.value;
  return { value, unit };
}

export function getCustomLookbackConfig(): CustomLookbackConfig {
  try {
    const raw = localStorage.getItem(CUSTOM_LOOKBACK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_LOOKBACK };
    return normalizeCustomLookback(JSON.parse(raw) as Partial<CustomLookbackConfig>);
  } catch {
    return { ...DEFAULT_CUSTOM_LOOKBACK };
  }
}

export function setCustomLookbackConfig(config: Partial<CustomLookbackConfig>): CustomLookbackConfig {
  const normalized = normalizeCustomLookback(config);
  try {
    localStorage.setItem(CUSTOM_LOOKBACK_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
  return normalized;
}

export function getCustomLookbackMs(config = getCustomLookbackConfig()): number {
  const hours = config.unit === 'd' ? config.value * 24 : config.value;
  return hours * 60 * 60 * 1000;
}

export function formatCustomLookbackLabel(config = getCustomLookbackConfig()): string {
  const unitLabel = config.unit === 'd'
    ? config.value === 1 ? 'day' : 'days'
    : config.value === 1 ? 'hour' : 'hours';
  return `${config.value} ${unitLabel}`;
}

export function formatCustomLookbackShortLabel(config = getCustomLookbackConfig()): string {
  return `${config.value}${config.unit}`;
}

const ABSOLUTE_RANGE_STORAGE_KEY = 'wm-absolute-range';

/** Shortest absolute range we accept — narrower than this and the scrubber has nothing to draw. */
export const MIN_ABSOLUTE_RANGE_MS = 60 * 1000;

/**
 * How far back the scrubber's timeline reaches when the "all" preset is
 * active. "All" means no filtering, but a timeline still needs finite bounds
 * to draw an axis and to play back over.
 */
export const ALL_RANGE_TIMELINE_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeAbsoluteRange(range: Partial<AbsoluteRange> | null | undefined): AbsoluteRange | null {
  const start = Number(range?.start);
  const end = Number(range?.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  if (hi - lo < MIN_ABSOLUTE_RANGE_MS) return null;
  return { start: lo, end: hi };
}

export function getStoredAbsoluteRange(): AbsoluteRange | null {
  try {
    const raw = localStorage.getItem(ABSOLUTE_RANGE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeAbsoluteRange(JSON.parse(raw) as Partial<AbsoluteRange>);
  } catch {
    return null;
  }
}

export function setStoredAbsoluteRange(range: AbsoluteRange | null): void {
  try {
    if (range) localStorage.setItem(ABSOLUTE_RANGE_STORAGE_KEY, JSON.stringify(range));
    else localStorage.removeItem(ABSOLUTE_RANGE_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

/**
 * The scrubber draws more history than the preset selects, so the selection
 * brush sits inside a band of context you can drag into rather than filling
 * the whole axis.
 */
export const TIMELINE_CONTEXT_FACTOR = 3;

/**
 * Timeline extent for a preset — the preset's window widened for context,
 * except "all", which filters nothing but still needs a finite axis to draw.
 */
export function getTimeRangeTimelineMs(range: TimeRange): number {
  const window = getTimeRangeWindowMs(range);
  return Number.isFinite(window) ? window * TIMELINE_CONTEXT_FACTOR : ALL_RANGE_TIMELINE_MS;
}

function formatRangeEndpoint(ts: number, sameDay: boolean): string {
  const date = new Date(ts);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return time;
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}

export function formatAbsoluteRangeLabel(range: AbsoluteRange): string {
  const startDate = new Date(range.start);
  const endDate = new Date(range.end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const start = formatRangeEndpoint(range.start, false);
  const end = formatRangeEndpoint(range.end, sameDay);
  return `${start} → ${end}`;
}

/** Compact duration ("45m", "6h", "3d") for labelling a window width. */
export function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = ms / 3_600_000;
  if (hours < 48) return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}h`;
  const days = ms / 86_400_000;
  return `${days >= 10 ? Math.round(days) : Math.round(days * 10) / 10}d`;
}

export function getTimeRangeWindowMs(range: TimeRange): number {
  switch (range) {
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '48h': return 48 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case 'custom': return getCustomLookbackMs();
    case 'all': return Infinity;
  }
}

export function getTimeRangeLabel(range: TimeRange): string {
  switch (range) {
    case '1h': return 'the last hour';
    case '6h': return 'the last 6 hours';
    case '24h': return 'the last 24 hours';
    case '48h': return 'the last 48 hours';
    case '7d': return 'the last 7 days';
    case 'custom': return `the last ${formatCustomLookbackLabel()}`;
    case 'all': return 'all time';
  }
}

export function getTimeRangeShortLabel(range: TimeRange): string {
  switch (range) {
    case '1h': return '1h';
    case '6h': return '6h';
    case '24h': return '24h';
    case '48h': return '48h';
    case '7d': return '7d';
    case 'custom': return formatCustomLookbackShortLabel();
    case 'all': return 'All';
  }
}
