import { setWorkerUrl } from 'maplibre-gl';
// maplibre-gl v6 locates its worker relative to its own module URL
// (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`), which breaks once
// Vite pre-bundles/chunks the library: the worker file is never emitted and
// tile parsing silently stops (black basemap). Bundle the worker explicitly
// as a module worker and hand maplibre its URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(maplibreWorkerUrl);
