import {
  TIME_RANGE_OPTIONS,
  type TimeRange,
} from '@/utils/time-range';

const DECK_CONTROL_SETTINGS_KEY = 'wm-deck-control-settings';

export interface DeckControlSettings {
  visibleTimeRanges: TimeRange[];
  layersOpenDefault: boolean;
  showLayerCount: boolean;
  showLayerActions: boolean;
}

export const DEFAULT_DECK_CONTROL_SETTINGS: DeckControlSettings = {
  visibleTimeRanges: TIME_RANGE_OPTIONS,
  layersOpenDefault: false,
  showLayerCount: true,
  showLayerActions: true,
};

export function loadDeckControlSettings(): DeckControlSettings {
  try {
    const raw = localStorage.getItem(DECK_CONTROL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DECK_CONTROL_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DeckControlSettings>;
    const visibleTimeRanges = Array.isArray(parsed.visibleTimeRanges)
      ? parsed.visibleTimeRanges.filter((range): range is TimeRange => TIME_RANGE_OPTIONS.includes(range as TimeRange))
      : DEFAULT_DECK_CONTROL_SETTINGS.visibleTimeRanges;
    if (
      Array.isArray(parsed.visibleTimeRanges) &&
      !visibleTimeRanges.includes('custom') &&
      TIME_RANGE_OPTIONS.filter((range) => range !== 'custom').every((range) => visibleTimeRanges.includes(range))
    ) {
      visibleTimeRanges.push('custom');
    }

    return {
      visibleTimeRanges: visibleTimeRanges.length > 0 ? visibleTimeRanges : DEFAULT_DECK_CONTROL_SETTINGS.visibleTimeRanges,
      layersOpenDefault: parsed.layersOpenDefault === true,
      showLayerCount: parsed.showLayerCount !== false,
      showLayerActions: parsed.showLayerActions !== false,
    };
  } catch {
    return { ...DEFAULT_DECK_CONTROL_SETTINGS };
  }
}

export function saveDeckControlSettings(settings: DeckControlSettings): void {
  try {
    localStorage.setItem(DECK_CONTROL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

export function normalizeTimeRange(range: TimeRange): TimeRange {
  return range;
}
