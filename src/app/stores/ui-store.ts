import type { PanelConfig, MapLayers } from '@/types';
import type { TimeRange } from '@/components';
import type { AppEventBus } from '../event-bus';

export type AppRegion = 'global' | 'america' | 'mena' | 'eu' | 'asia' | 'latam' | 'africa' | 'oceania';

export interface UIStore {
  panelSettings: Record<string, PanelConfig>;
  mapLayers: MapLayers;
  currentTimeRange: TimeRange;
  isIdle: boolean;
  isPlaybackMode: boolean;
  isDestroyed: boolean;
  initialLoadComplete: boolean;
  disabledSources: Set<string>;
  inFlight: Set<string>;
  seenGeoAlerts: Set<string>;
  resolvedLocation: AppRegion;
  setPanelSettings(settings: Record<string, PanelConfig>): void;
  setMapLayers(layers: MapLayers): void;
  setTimeRange(range: TimeRange): void;
  setIdle(idle: boolean): void;
  setPlaybackMode(mode: boolean): void;
  setInitialLoadComplete(done: boolean): void;
  disableSource(source: string): void;
  enableSource(source: string): void;
  isSourceEnabled(source: string): boolean;
  markInFlight(key: string): void;
  clearInFlight(key: string): void;
  markGeoAlert(key: string): void;
  hasSeenGeoAlert(key: string): boolean;
  setResolvedLocation(loc: AppRegion): void;
  destroy(): void;
}

export function createUIStore(bus: AppEventBus): UIStore {
  let panelSettings: Record<string, PanelConfig> = {};
  let mapLayers: MapLayers = {} as MapLayers;
  let currentTimeRange: TimeRange = '24h';
  let isIdle = false;
  let isPlaybackMode = false;
  let isDestroyed = false;
  let initialLoadComplete = false;
  let disabledSources = new Set<string>();
  let inFlight = new Set<string>();
  let seenGeoAlerts = new Set<string>();
  let resolvedLocation: AppRegion = 'global';

  return {
    get panelSettings() { return panelSettings; },
    get mapLayers() { return mapLayers; },
    get currentTimeRange() { return currentTimeRange; },
    get isIdle() { return isIdle; },
    get isPlaybackMode() { return isPlaybackMode; },
    get isDestroyed() { return isDestroyed; },
    get initialLoadComplete() { return initialLoadComplete; },
    get disabledSources() { return disabledSources; },
    get inFlight() { return inFlight; },
    get seenGeoAlerts() { return seenGeoAlerts; },
    get resolvedLocation() { return resolvedLocation; },

    setPanelSettings(settings: Record<string, PanelConfig>) {
      panelSettings = settings;
      bus.emit('ui:panel-settings-updated', settings);
    },

    setMapLayers(layers: MapLayers) {
      mapLayers = layers;
      bus.emit('ui:map-layers-updated', layers);
    },

    setTimeRange(range: TimeRange) {
      currentTimeRange = range;
      bus.emit('ui:time-range-updated', range);
    },

    setIdle(idle: boolean) {
      isIdle = idle;
      bus.emit('ui:idle-changed', idle);
    },

    setPlaybackMode(mode: boolean) {
      isPlaybackMode = mode;
      bus.emit('ui:playback-mode-changed', mode);
    },

    setInitialLoadComplete(done: boolean) {
      initialLoadComplete = done;
      bus.emit('ui:initial-load-complete', done);
    },

    disableSource(source: string) {
      disabledSources.add(source);
      bus.emit('ui:source-disabled', source);
    },

    enableSource(source: string) {
      disabledSources.delete(source);
      bus.emit('ui:source-enabled', source);
    },

    isSourceEnabled(source: string): boolean {
      return !disabledSources.has(source);
    },

    markInFlight(key: string) {
      inFlight.add(key);
    },

    clearInFlight(key: string) {
      inFlight.delete(key);
    },

    markGeoAlert(key: string) {
      seenGeoAlerts.add(key);
    },

    hasSeenGeoAlert(key: string): boolean {
      return seenGeoAlerts.has(key);
    },

    setResolvedLocation(loc: AppRegion) {
      resolvedLocation = loc;
      bus.emit('ui:resolved-location-changed', loc);
    },

    destroy() {
      isDestroyed = true;
      panelSettings = {};
      disabledSources.clear();
      inFlight.clear();
      seenGeoAlerts.clear();
    },
  };
}
