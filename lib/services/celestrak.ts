import { FeatureCollection } from 'geojson';

export interface SatelliteOrbitalElements {
  name: string;
  noradId: string;
  inclination: number;     // degrees
  raan: number;            // degrees (Right Ascension of Ascending Node)
  argPerigee: number;      // degrees (Argument of Perigee)
  meanMotion: number;      // revolutions per day
  meanAnomaly: number;     // degrees
  epoch: string;           // ISO date string
  eccentricity: number;
}

const FALLBACK_SATELLITES: SatelliteOrbitalElements[] = [
  {
    name: 'ISS (ZARYA)',
    noradId: '25544',
    inclination: 51.6418,
    raan: 147.2842,
    argPerigee: 73.1254,
    meanMotion: 15.4953,
    meanAnomaly: 312.4589,
    epoch: new Date().toISOString(),
    eccentricity: 0.000184
  },
  {
    name: 'TIANGONG (CSS)',
    noradId: '48274',
    inclination: 41.4745,
    raan: 285.1245,
    argPerigee: 124.5821,
    meanMotion: 15.5782,
    meanAnomaly: 245.1953,
    epoch: new Date().toISOString(),
    eccentricity: 0.000382
  },
  {
    name: 'HUBBLE SPACE TELESCOPE',
    noradId: '20580',
    inclination: 28.4682,
    raan: 84.5123,
    argPerigee: 345.1892,
    meanMotion: 14.8021,
    meanAnomaly: 15.8241,
    epoch: new Date().toISOString(),
    eccentricity: 0.000287
  },
  {
    name: 'ENVISAT',
    noradId: '27386',
    inclination: 98.5412,
    raan: 220.1245,
    argPerigee: 94.5121,
    meanMotion: 14.2812,
    meanAnomaly: 265.4125,
    epoch: new Date().toISOString(),
    eccentricity: 0.000102
  },
  {
    name: 'NOAA 19',
    noradId: '33504',
    inclination: 98.7021,
    raan: 45.1824,
    argPerigee: 110.2458,
    meanMotion: 14.1124,
    meanAnomaly: 250.1241,
    epoch: new Date().toISOString(),
    eccentricity: 0.001142
  }
];

// Helper to propagate simple circular Keplerian orbit coordinates at a given time
export function propagateOrbit(sat: SatelliteOrbitalElements, timeMs: number): [number, number] {
  const epochTime = new Date(sat.epoch).getTime();
  const elapsedMinutes = (timeMs - epochTime) / (60 * 1000);
  
  // Convert mean motion (revs/day) to radians/minute
  // 1 rev = 2pi radians. 1 day = 1440 minutes.
  const meanMotionRadMin = (sat.meanMotion * 2 * Math.PI) / 1440;
  
  // Mean anomaly at current time
  const M = (sat.meanAnomaly * Math.PI) / 180 + meanMotionRadMin * elapsedMinutes;
  
  // Argument of latitude (circular orbit assumption: true anomaly = mean anomaly)
  const argLat = M + (sat.argPerigee * Math.PI) / 180;
  
  const inc = (sat.inclination * Math.PI) / 180;
  const raan = (sat.raan * Math.PI) / 180;
  
  // 3D coordinates in orbital frame (unit sphere)
  const x0 = Math.cos(argLat);
  const y0 = Math.sin(argLat) * Math.cos(inc);
  const z0 = Math.sin(argLat) * Math.sin(inc);
  
  // Earth's rotation rate: 360 degrees per 24 hours (0.004363323 radians per minute)
  const earthRotationMin = 0.004363323 * elapsedMinutes;
  const adjustedRaan = raan - earthRotationMin;
  
  // Rotate around Z-axis by adjusted RAAN
  const x = x0 * Math.cos(adjustedRaan) - y0 * Math.sin(adjustedRaan);
  const y = x0 * Math.sin(adjustedRaan) + y0 * Math.cos(adjustedRaan);
  const z = z0;
  
  // Convert back to spherical coordinates
  let lat = Math.asin(z) * (180 / Math.PI);
  let lng = Math.atan2(y, x) * (180 / Math.PI);
  
  // Normalize longitude to [-180, 180]
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  
  return [lng, lat];
}

export async function fetchSatelliteLayerData(): Promise<FeatureCollection> {
  let satellites = FALLBACK_SATELLITES;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
    
    const response = await fetch(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json',
      { 
        signal: controller.signal,
        next: { revalidate: 3600 } 
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // Select up to 15 key visual satellites including ISS, CSS, HST and others
        const highValueNames = ['ISS (ZARYA)', 'TIANGONG', 'HUBBLE', 'ENVISAT', 'NOAA', 'AQUA', 'TERRA', 'LANDSAT', 'METOP'];
        const filtered = data.filter((item: any) => 
          item.OBJECT_NAME && 
          highValueNames.some(name => item.OBJECT_NAME.toUpperCase().includes(name))
        ).slice(0, 15);
        
        if (filtered.length > 0) {
          satellites = filtered.map((item: any) => ({
            name: item.OBJECT_NAME,
            noradId: String(item.NORAD_CAT_ID),
            inclination: Number(item.INCLINATION),
            raan: Number(item.RA_OF_ASC_NODE),
            argPerigee: Number(item.ARG_OF_PERICENTER),
            meanMotion: Number(item.MEAN_MOTION),
            meanAnomaly: Number(item.MEAN_ANOMALY),
            epoch: item.EPOCH,
            eccentricity: Number(item.ECCENTRICITY)
          }));
        }
      }
    }
  } catch (error) {
    console.warn('CelesTrak satellite fetch failed or timed out. Falling back to local data.', error);
  }
  
  const currentTime = Date.now();
  
  const features = satellites.map(sat => {
    const [lng, lat] = propagateOrbit(sat, currentTime);
    
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [lng, lat]
      },
      properties: {
        layer: 'satellites',
        title: sat.name,
        subTitle: `NORAD #${sat.noradId}`,
        noradId: sat.noradId,
        inclination: sat.inclination,
        raan: sat.raan,
        argPerigee: sat.argPerigee,
        meanMotion: sat.meanMotion,
        meanAnomaly: sat.meanAnomaly,
        epoch: sat.epoch,
        eccentricity: sat.eccentricity,
        isCustom: true,
        category: 'Satellite'
      }
    };
  });
  
  return {
    type: 'FeatureCollection' as const,
    features
  };
}
