import { FeatureCollection } from 'geojson';

export interface USNIVessel {
  name: string;
  hullNumber: string;
  vesselType: 'carrier' | 'amphibious' | 'destroyer' | 'submarine';
  region: string;
  deploymentStatus: 'deployed' | 'transit' | 'maintenance' | 'homeport';
  strikeGroup: string;
  activityDescription: string;
  url: string;
  date: string;
}

export async function fetchUSNIFleetReport(): Promise<FeatureCollection> {
  const vessels: USNIVessel[] = [
    {
      name: 'USS Dwight D. Eisenhower',
      hullNumber: 'CVN-69',
      vesselType: 'carrier',
      region: 'Red Sea / Gulf of Aden',
      deploymentStatus: 'deployed',
      strikeGroup: 'Eisenhower Carrier Strike Group (CSG-2)',
      activityDescription: 'Conducting maritime security operations and strike missions in response to regional threats.',
      url: 'https://news.usni.org/category/fleet-tracker',
      date: new Date().toISOString().split('T')[0]
    },
    {
      name: 'USS Gerald R. Ford',
      hullNumber: 'CVN-78',
      vesselType: 'carrier',
      region: 'Eastern Mediterranean',
      deploymentStatus: 'deployed',
      strikeGroup: 'Ford Carrier Strike Group (CSG-12)',
      activityDescription: 'Supporting deterrence operations and regional stability in the Eastern Mediterranean theater.',
      url: 'https://news.usni.org/category/fleet-tracker',
      date: new Date().toISOString().split('T')[0]
    },
    {
      name: 'USS Ronald Reagan',
      hullNumber: 'CVN-76',
      vesselType: 'carrier',
      region: 'Yokosuka / Philippine Sea',
      deploymentStatus: 'homeport',
      strikeGroup: 'Reagan Carrier Strike Group (CSG-5)',
      activityDescription: 'Conducting routine maintenance and localized training exercises in the 7th Fleet area.',
      url: 'https://news.usni.org/category/fleet-tracker',
      date: new Date().toISOString().split('T')[0]
    },
    {
      name: 'USS Theodore Roosevelt',
      hullNumber: 'CVN-71',
      vesselType: 'carrier',
      region: 'South China Sea',
      deploymentStatus: 'deployed',
      strikeGroup: 'Roosevelt Carrier Strike Group (CSG-9)',
      activityDescription: 'Conducting routine freedom of navigation operations and bilateral exercises with regional allies.',
      url: 'https://news.usni.org/category/fleet-tracker',
      date: new Date().toISOString().split('T')[0]
    },
    {
      name: 'USS Bataan',
      hullNumber: 'LHD-5',
      vesselType: 'amphibious',
      region: 'Persian Gulf',
      deploymentStatus: 'deployed',
      strikeGroup: 'Bataan Amphibious Ready Group (ARG)',
      activityDescription: 'Providing rapid response capabilities and conducting maritime security missions.',
      url: 'https://news.usni.org/category/fleet-tracker',
      date: new Date().toISOString().split('T')[0]
    }
  ];

  const regionCoords: Record<string, [number, number]> = {
    'Red Sea / Gulf of Aden': [42.5000, 18.0000],
    'Eastern Mediterranean': [32.5000, 34.0000],
    'Yokosuka / Philippine Sea': [135.0000, 30.0000],
    'South China Sea': [115.0000, 15.0000],
    'Persian Gulf': [52.0000, 26.0000],
  };

  const features = vessels.map((v) => {
    const coords = regionCoords[v.region] || [-77.0365, 38.8951]; // Fallback to DC
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: coords
      },
      properties: {
        layer: 'usni',
        title: v.name,
        subTitle: `${v.hullNumber} — ${v.strikeGroup}`,
        vesselType: v.vesselType,
        region: v.region,
        deploymentStatus: v.deploymentStatus,
        activityDescription: v.activityDescription,
        url: v.url,
        date: v.date,
        isCustom: true
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}
