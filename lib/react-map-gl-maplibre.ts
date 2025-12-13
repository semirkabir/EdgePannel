// Wrapper to properly import react-map-gl/maplibre for Next.js compatibility
// This works around Next.js module resolution issues with package.json exports

export {
  default as Map,
  Source,
  Layer,
  Popup,
  NavigationControl,
  FullscreenControl,
} from 'react-map-gl/maplibre';

export type {
  MapLayerMouseEvent,
  MapRef,
} from 'react-map-gl/maplibre';
