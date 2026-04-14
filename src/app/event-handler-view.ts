import { buildMapUrl } from '@/utils';
import type { MapContainer, TimeRange } from '@/components';
import type { CountryBriefPanel } from '@/components/CountryBriefPanel';
import type { MapLayers } from '@/types';
import type { MapView } from '@/components';

interface ShareableMapState {
  view: MapView;
  zoom: number;
  timeRange: TimeRange;
  layers: MapLayers;
}

export function buildShareUrl(
  map: MapContainer | null,
  briefPage: CountryBriefPanel | null,
  baseUrl: string,
): string | null {
  if (!map) return null;

  const state = map.getState() as ShareableMapState;
  const center = map.getCenter() as { lat: number; lon: number } | null;
  const isCountryVisible = briefPage?.isVisible() ?? false;

  return buildMapUrl(baseUrl, {
    view: state.view,
    zoom: state.zoom,
    center,
    timeRange: state.timeRange,
    layers: state.layers,
    country: isCountryVisible ? (briefPage?.getCode() ?? undefined) : undefined,
    expanded: isCountryVisible && briefPage?.getIsMaximized?.() ? true : undefined,
  });
}

