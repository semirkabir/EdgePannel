/**
 * How high things are drawn on the 3D globe.
 *
 * MapLibre's globe shaders take elevation in metres and scale the sphere by
 * `1 + elevation / GLOBE_RADIUS`, so altitude is geometrically exact for free —
 * the only question is what altitude to hand them. These are pure functions so
 * the answer is testable without a WebGL context.
 */
import { clampNumber } from './geo-math';

export const FEET_TO_METERS = 0.3048;
/** Matches the GLOBE_RADIUS the MapLibre globe shaders scale elevation against. */
export const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Bad-frame guard, not a style choice — 60,000 ft clears every civil airframe
 * ever flown, so anything above it is a corrupt ADS-B altitude, not a plane.
 */
export const GLOBE_AIRCRAFT_MAX_ALTITUDE_M = 60_000 * FEET_TO_METERS;
/** Assumed when a frame carries a position but no usable altitude. */
export const GLOBE_AIRCRAFT_ASSUMED_CRUISE_M = 35_000 * FEET_TO_METERS;

/**
 * Top of the 1:1 band. Below this — Starlink, the ISS, the imaging
 * constellations, the bulk of the CelesTrak catalog — nothing is distorted.
 */
export const GLOBE_SAT_TRUE_SCALE_CEILING_M = 2_000_000;
/** Top of the compressed range; ~0.7 R keeps the highest shell in frustum. */
export const GLOBE_SAT_DISPLAY_CEILING_M = 4_500_000;
/** Molniya apogee (~40,000 km) is the highest orbit we still place on a shell. */
export const GLOBE_SAT_TRUE_MAX_M = 45_000_000;
/** Curve strength above the knee. Higher = more room given to low MEO. */
export const GLOBE_SAT_COMPRESSION_K = 9;
export const GLOBE_SAT_FALLBACK_ALTITUDE_M = 550_000;

/**
 * True barometric altitude in metres. Aircraft on the ground sit on the ground;
 * a plane climbing out of an airport is drawn where it actually is.
 *
 * The band this replaced pinned every aircraft between 6 and 8 miles, which put
 * a plane on short final at 2,000 ft up at FL317 beside the transatlantic
 * traffic.
 */
export function aircraftDisplayAltitudeMeters(altitudeFt: number | undefined, onGround: boolean): number {
  if (onGround) return 0;
  const meters = (altitudeFt ?? 0) * FEET_TO_METERS;
  if (Number.isFinite(meters) && meters > 0) return Math.min(meters, GLOBE_AIRCRAFT_MAX_ALTITUDE_M);
  // Airborne but no altitude in the frame — one honest default beats a
  // per-airframe hash that invents a spread the data never had.
  return GLOBE_AIRCRAFT_ASSUMED_CRUISE_M;
}

/**
 * Exact through LEO, curved above it.
 *
 * The knee is forced by MapLibre's globe frustum, not by taste: the far plane
 * sits at `cameraToCenterDistance + globeRadiusPixels * 2`, and at a normal
 * whole-earth view the camera is ~4 earth radii out. A true-scale GEO bird
 * orbits at 5.6 R — behind the camera, so it never rasterises at any zoom you
 * would actually use.
 *
 * Above the knee a log curve preserves ordering and separation, so GPS/Galileo
 * (~20,200 km), GEO (~35,786 km) and Molniya apogee land on visibly distinct
 * shells instead of collapsing onto one ring the way a hard clamp does. Popups
 * and panels always report the real SGP4 altitude.
 */
export function satelliteDisplayAltitudeMeters(altitudeKm: number): number {
  const meters = Number.isFinite(altitudeKm) ? altitudeKm * 1000 : GLOBE_SAT_FALLBACK_ALTITUDE_M;
  if (meters <= GLOBE_SAT_TRUE_SCALE_CEILING_M) return Math.max(0, meters);

  const span = GLOBE_SAT_TRUE_MAX_M - GLOBE_SAT_TRUE_SCALE_CEILING_M;
  const t = clampNumber((meters - GLOBE_SAT_TRUE_SCALE_CEILING_M) / span, 0, 1);
  const curved = Math.log1p(GLOBE_SAT_COMPRESSION_K * t) / Math.log1p(GLOBE_SAT_COMPRESSION_K);
  return GLOBE_SAT_TRUE_SCALE_CEILING_M + (GLOBE_SAT_DISPLAY_CEILING_M - GLOBE_SAT_TRUE_SCALE_CEILING_M) * curved;
}
