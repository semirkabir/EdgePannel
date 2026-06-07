import { TIME_RANGE_OPTIONS, type TimeRange } from '@/utils/time-range';

const MAP_CONTROL_SETTINGS_KEY = 'wm-deck-control-settings';

export interface MapControlSettings {
  visibleTimeRanges: TimeRange[];
  showLayerCount: boolean;
  showLayerActions: boolean;
}

export const DEFAULT_MAP_CONTROL_SETTINGS: MapControlSettings = {
  visibleTimeRanges: TIME_RANGE_OPTIONS,
  showLayerCount: true,
  showLayerActions: true,
};

export function loadMapControlSettings(): MapControlSettings {
  try {
    const raw = localStorage.getItem(MAP_CONTROL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_MAP_CONTROL_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MapControlSettings>;
    const visibleTimeRanges = Array.isArray(parsed.visibleTimeRanges)
      ? parsed.visibleTimeRanges.filter((range): range is TimeRange => TIME_RANGE_OPTIONS.includes(range as TimeRange))
      : DEFAULT_MAP_CONTROL_SETTINGS.visibleTimeRanges;
    if (
      Array.isArray(parsed.visibleTimeRanges) &&
      !visibleTimeRanges.includes('custom') &&
      TIME_RANGE_OPTIONS.filter((range) => range !== 'custom').every((range) => visibleTimeRanges.includes(range))
    ) {
      visibleTimeRanges.push('custom');
    }
    return {
      visibleTimeRanges: visibleTimeRanges.length > 0 ? visibleTimeRanges : DEFAULT_MAP_CONTROL_SETTINGS.visibleTimeRanges,
      showLayerCount: parsed.showLayerCount !== false,
      showLayerActions: parsed.showLayerActions !== false,
    };
  } catch {
    return { ...DEFAULT_MAP_CONTROL_SETTINGS };
  }
}

export function saveMapControlSettings(settings: MapControlSettings): void {
  try {
    localStorage.setItem(MAP_CONTROL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}
