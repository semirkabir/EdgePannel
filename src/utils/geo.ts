/** Haversine distance between two coordinates in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from point 1 to point 2 in degrees (0=N, 90=E, 180=S, 270=W). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Destination point given a start, an initial bearing (deg) and a distance (km).
 * Returns [lng, lat] (GeoJSON order). Great-circle / spherical model.
 */
export function destinationPoint(lat: number, lon: number, bearing: number, distanceKm: number): [number, number] {
  const R = 6371;
  const δ = distanceKm / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  const lat2 = (φ2 * 180) / Math.PI;
  const lon2 = (((λ2 * 180) / Math.PI) + 540) % 360 - 180; // normalise to [-180, 180)
  return [lon2, lat2];
}

/** Distance-unit conversions from kilometres. */
export type DistanceUnit = 'km' | 'mi' | 'nmi';

const KM_PER: Record<DistanceUnit, number> = { km: 1, mi: 0.621371, nmi: 0.539957 };

/** Convert a value in km to the given unit. */
export function convertKm(km: number, unit: DistanceUnit): number {
  return km * KM_PER[unit];
}

/** Format a km distance in the given unit with a sensible precision + suffix. */
export function formatDistance(km: number, unit: DistanceUnit): string {
  const v = convertKm(km, unit);
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${unit}`;
}
