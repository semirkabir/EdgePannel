import type { MapLayers } from '@/types';
import type { MapView, TimeRange } from '@/components/Map';
import { TIME_RANGE_OPTIONS, normalizeAbsoluteRange, type AbsoluteRange } from '@/utils/time-range';
import { LAYER_REGISTRY } from '@/config/map-layer-definitions';

/** Every layer key the app knows about — this is what `?layers=` can name. */
const LAYER_KEYS = Object.keys(LAYER_REGISTRY) as (keyof MapLayers)[];

const VIEW_VALUES: MapView[] = ['global', 'america', 'mena', 'eu', 'asia', 'latam', 'africa', 'oceania'];

export interface ParsedMapUrlState {
  view?: MapView;
  zoom?: number;
  lat?: number;
  lon?: number;
  timeRange?: TimeRange;
  /** Explicit `from`/`to` window, which overrides the preset when present. */
  absoluteRange?: AbsoluteRange;
  layers?: MapLayers;
  country?: string;
  expanded?: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function parseMapUrlState(
  search: string,
  fallbackLayers: MapLayers
): ParsedMapUrlState {
  const params = new URLSearchParams(search);

  const viewParam = params.get('view');
  const view = VIEW_VALUES.includes(viewParam as MapView) ? (viewParam as MapView) : undefined;

  const zoomParam = params.get('zoom');
  const zoomValue = zoomParam ? Number.parseFloat(zoomParam) : NaN;
  const zoom = Number.isFinite(zoomValue) ? clamp(zoomValue, 1, 10) : undefined;

  const latParam = params.get('lat');
  const lonParam = params.get('lon');
  const latValue = latParam ? Number.parseFloat(latParam) : NaN;
  const lonValue = lonParam ? Number.parseFloat(lonParam) : NaN;
  const lat = Number.isFinite(latValue) ? clamp(latValue, -90, 90) : undefined;
  const lon = Number.isFinite(lonValue) ? clamp(lonValue, -180, 180) : undefined;

  const timeRangeParam = params.get('timeRange');
  const timeRange = TIME_RANGE_OPTIONS.includes(timeRangeParam as TimeRange)
    ? (timeRangeParam as TimeRange)
    : undefined;

  // `from`/`to` accept epoch ms or anything Date can parse, so a shared link
  // survives both machine-generated and hand-edited URLs.
  const parseInstant = (value: string | null): number | null => {
    if (!value) return null;
    const numeric = Number(value);
    const ts = Number.isFinite(numeric) && value.trim() !== '' ? numeric : new Date(value).getTime();
    return Number.isFinite(ts) ? ts : null;
  };
  const from = parseInstant(params.get('from'));
  const to = parseInstant(params.get('to'));
  const absoluteRange = from !== null && to !== null
    ? normalizeAbsoluteRange({ start: from, end: to }) ?? undefined
    : undefined;

  const countryParam = params.get('country');
  const country = countryParam && /^[A-Z]{2}$/i.test(countryParam.trim()) ? countryParam.trim().toUpperCase() : undefined;

  const expandedParam = params.get('expanded');
  const expanded = expandedParam === '1' ? true : undefined;

  const layersParam = params.get('layers');
  let layers: MapLayers | undefined;
  if (layersParam !== null) {
    layers = { ...fallbackLayers };
    const normalizedLayers = layersParam.trim();
    if (normalizedLayers !== '' && normalizedLayers !== 'none') {
      const requested = new Set(
        normalizedLayers
          .split(',')
          .map((layer) => layer.trim())
          .filter(Boolean)
      );
      LAYER_KEYS.forEach((key) => {
        layers![key] = requested.has(key);
      });
    } else {
      LAYER_KEYS.forEach((key) => {
        layers![key] = false;
      });
    }
  }

  return {
    view,
    zoom,
    lat,
    lon,
    timeRange,
    absoluteRange,
    layers,
    country,
    expanded,
  };
}

export function buildMapUrl(
  baseUrl: string,
  state: {
    view: MapView;
    zoom: number;
    center?: { lat: number; lon: number } | null;
    timeRange: TimeRange;
    absoluteRange?: AbsoluteRange | null;
    layers: MapLayers;
    country?: string;
    expanded?: boolean;
  }
): string {
  const url = new URL(baseUrl);
  const params = new URLSearchParams();

  if (state.center) {
    params.set('lat', state.center.lat.toFixed(4));
    params.set('lon', state.center.lon.toFixed(4));
  }

  params.set('zoom', state.zoom.toFixed(2));
  params.set('view', state.view);
  params.set('timeRange', state.timeRange);

  if (state.absoluteRange) {
    params.set('from', String(Math.round(state.absoluteRange.start)));
    params.set('to', String(Math.round(state.absoluteRange.end)));
  }

  const activeLayers = LAYER_KEYS.filter((layer) => state.layers[layer]);
  params.set('layers', activeLayers.length > 0 ? activeLayers.join(',') : 'none');

  if (state.country) {
    params.set('country', state.country);
  }

  if (state.expanded) {
    params.set('expanded', '1');
  }

  url.search = params.toString();
  return url.toString();
}
