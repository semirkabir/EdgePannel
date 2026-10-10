/**
 * Named camera anchors shared by missions (client) and the agent gateway's
 * zoom_to_region tool. The sidecar keeps its own copy in
 * src-tauri/sidecar/agent-tool-registry.mjs (plain node, no TS import);
 * tests/missions.test.mts asserts the two stay identical.
 */
export interface MapRegionAnchor {
  lat: number;
  lon: number;
  zoom: number;
}

export const MAP_REGION_ANCHORS = {
  global:      { lat: 25,   lon: 10,  zoom: 2 },
  mena:        { lat: 27,   lon: 40,  zoom: 4 },
  europe:      { lat: 52,   lon: 14,  zoom: 4 },
  asia:        { lat: 30,   lon: 105, zoom: 3 },
  americas:    { lat: 15,   lon: -90, zoom: 3 },
  africa:      { lat: 2,    lon: 20,  zoom: 3 },
  middle_east: { lat: 27,   lon: 45,  zoom: 5 },
  ukraine:     { lat: 49,   lon: 32,  zoom: 5.5 },
  taiwan_strait: { lat: 24, lon: 119.5, zoom: 7 },
  red_sea:     { lat: 19,   lon: 38.5, zoom: 6 },
  south_china_sea: { lat: 13, lon: 114, zoom: 5.5 },
  korea_peninsula: { lat: 38, lon: 127, zoom: 6.5 },
} as const satisfies Record<string, MapRegionAnchor>;

export type MapRegionId = keyof typeof MAP_REGION_ANCHORS;
