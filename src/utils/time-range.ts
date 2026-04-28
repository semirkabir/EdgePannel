export type TimeRange = '1h' | '6h' | '24h' | '48h' | '7d' | 'custom' | 'all';
export type CustomLookbackUnit = 'h' | 'd';

export interface CustomLookbackConfig {
  value: number;
  unit: CustomLookbackUnit;
}

export const TIME_RANGE_OPTIONS: TimeRange[] = ['1h', '6h', '24h', '48h', '7d', 'custom', 'all'];

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
    case 'custom': return 'Custom';
    case 'all': return 'All';
  }
}
