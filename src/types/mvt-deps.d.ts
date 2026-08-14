/**
 * Ambient declarations for the CJS MVT toolchain used by the buildings
 * overzoom protocol (src/utils/buildings-tiles.ts). These packages ship no
 * types; keep the surface minimal and loose.
 */
declare module 'pbf' {
  export default class Pbf {
    constructor(data?: Uint8Array | ArrayBuffer);
    [key: string]: unknown;
  }
}

declare module '@mapbox/vector-tile' {
  import type Pbf from 'pbf';

  export interface VectorTileFeature {
    id?: number;
    type: number;
    properties: Record<string, unknown>;
    loadGeometry(): { x: number; y: number }[][];
  }

  export interface VectorTileLayer {
    version: number;
    name: string;
    extent: number;
    length: number;
    feature(i: number): VectorTileFeature;
  }

  export class VectorTile {
    constructor(pbf: Pbf);
    layers: Record<string, VectorTileLayer>;
  }
}

declare module 'vt-pbf' {
  const vtpbf: {
    fromVectorTileJs(tile: { layers: Record<string, unknown> }): Uint8Array;
  };
  export default vtpbf;
}
