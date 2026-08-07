import { FeatureCollection } from 'geojson';

export interface GPSJammingZone {
  id: string;
  name: string;
  center: [number, number]; // [lng, lat]
  radiusKm: number;
  intensity: 'high' | 'medium' | 'low';
  description: string;
  source: string;
}

const JAMMING_ZONES: GPSJammingZone[] = [
  {
    id: 'baltic-sea',
    name: 'Baltic Sea & Poland Jamming Corridor',
    center: [20.5, 54.7], // Kaliningrad
    radiusKm: 420,
    intensity: 'high',
    description: 'Severe GPS signal denial and coordinate spoofing affecting commercial aviation. Flights report sudden signal loss and coordinate offsets. Tracked to Kaliningrad electronic warfare installations.',
    source: 'GPSJAM / EUROCONTROL'
  },
  {
    id: 'levant',
    name: 'Eastern Mediterranean & Levant',
    center: [35.0, 32.8], // Israel / Lebanon border
    radiusKm: 280,
    intensity: 'high',
    description: 'Aviation and maritime receivers report continuous spoofing, placing aircraft coordinates at false locations (often Beirut Airport). Active defensive jamming and spoofing in operation.',
    source: 'FAA / Israel Civil Aviation Authority'
  },
  {
    id: 'black-sea',
    name: 'Crimea & Black Sea Theater',
    center: [34.0, 45.0], // Crimea
    radiusKm: 350,
    intensity: 'high',
    description: 'High-intensity tactical jamming targeting UAV navigation systems and precision weapons. Disrupts commercial shipping transponders throughout the northern Black Sea.',
    source: 'Maritime Intelligence Reports'
  },
  {
    id: 'red-sea',
    name: 'Bab-el-Mandeb & Southern Red Sea',
    center: [43.3, 12.6], // Bab-el-Mandeb Strait
    radiusKm: 220,
    intensity: 'medium',
    description: 'Moderate GPS spoofing and signal loss. Merchant vessels report false positions and automated navigation alerts. Linked to defensive systems and regional drone warfare.',
    source: 'UKMTO / US Naval Forces Central Command'
  },
  {
    id: 'korean-dmz',
    name: 'Korean DMZ Interference Zone',
    center: [127.0, 38.0], // DMZ
    radiusKm: 160,
    intensity: 'low',
    description: 'Periodic GPS L1 signal jamming and scintillation. Primarily affects small aircraft, drone patrols, and fishing boat navigation near the Northern Limit Line.',
    source: 'South Korean Ministry of Defense'
  }
];

function generateCirclePolygon(center: [number, number], radiusKm: number, points: number = 32): any {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  
  for (let i = 0; i < points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const pointLng = lng + dx / kmPerDegreeLng;
    const pointLat = lat + dy / kmPerDegreeLat;
    coords.push([pointLng, pointLat]);
  }
  
  // Close the polygon
  coords.push(coords[0]);
  
  return {
    type: 'Polygon' as const,
    coordinates: [coords]
  };
}

export async function fetchGPSJammingData(): Promise<FeatureCollection> {
  const features = JAMMING_ZONES.map(zone => {
    const polygonGeometry = generateCirclePolygon(zone.center, zone.radiusKm, 36);
    
    return {
      type: 'Feature' as const,
      geometry: polygonGeometry,
      properties: {
        layer: 'gpsjam',
        id: zone.id,
        title: zone.name,
        subTitle: `Telemetry Source: ${zone.source}`,
        intensity: zone.intensity,
        description: zone.description,
        radiusKm: zone.radiusKm,
        center: zone.center,
        isCustom: true,
        category: 'GPS Jamming'
      }
    };
  });
  
  return {
    type: 'FeatureCollection' as const,
    features
  };
}
