import type { MapContainer } from '@/components';
import type { ParsedMapUrlState } from '@/utils';
import type { AppEventBus } from '../event-bus';

export interface MapStore {
  map: MapContainer | null;
  initialUrlState: ParsedMapUrlState | null;
  setMap(map: MapContainer): void;
  setInitialUrlState(state: ParsedMapUrlState | null): void;
  destroy(): void;
}

export function createMapStore(bus: AppEventBus): MapStore {
  let map: MapContainer | null = null;
  let initialUrlState: ParsedMapUrlState | null = null;

  return {
    get map() { return map; },
    get initialUrlState() { return initialUrlState; },

    setMap(m: MapContainer) {
      map = m;
      bus.emit('map:initialized', m);
    },

    setInitialUrlState(state: ParsedMapUrlState | null) {
      initialUrlState = state;
    },

    destroy() {
      map = null;
      initialUrlState = null;
    },
  };
}
