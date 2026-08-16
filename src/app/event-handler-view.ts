import { buildMapUrl } from '@/utils';
import { timeController } from '@/services/time-controller';
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
    // A pinned window is part of what the sharer is looking at, so it travels
    // with the link; presets stay relative to whenever the link is opened.
    absoluteRange: timeController.getSnapshot().absolute,
    layers: state.layers,
    country: isCountryVisible ? (briefPage?.getCode() ?? undefined) : undefined,
    expanded: isCountryVisible && briefPage?.getIsMaximized?.() ? true : undefined,
  });
}

