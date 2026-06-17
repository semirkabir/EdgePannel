import type {
  APTGroup,
  ConflictZone,
  CriticalMineralProject,
  EconomicCenter,
  Hotspot,
  MilitaryBase,
  NuclearFacility,
  Spaceport,
  StrategicWaterway,
  UnderseaCable,
} from '@/types';
import geoDataJson from './data/geo.json';

type GeoData = {
  INTEL_HOTSPOTS: Hotspot[];
  STRATEGIC_WATERWAYS: StrategicWaterway[];
  APT_GROUPS: APTGroup[];
  CONFLICT_ZONES: ConflictZone[];
  MILITARY_BASES: MilitaryBase[];
  UNDERSEA_CABLES: UnderseaCable[];
  NUCLEAR_FACILITIES: NuclearFacility[];
  SANCTIONED_COUNTRIES: Record<number, 'severe' | 'high' | 'moderate'>;
  MAP_URLS: { world: string };
  ECONOMIC_CENTERS: EconomicCenter[];
  SPACEPORTS: Spaceport[];
  CRITICAL_MINERALS: CriticalMineralProject[];
};

const geoData = geoDataJson as unknown as GeoData;

// Hotspot levels are dynamically recalculated at runtime; this module only owns seed data.
export const INTEL_HOTSPOTS = geoData.INTEL_HOTSPOTS;
export const STRATEGIC_WATERWAYS = geoData.STRATEGIC_WATERWAYS;
export const APT_GROUPS = geoData.APT_GROUPS;
export const CONFLICT_ZONES = geoData.CONFLICT_ZONES;
export const MILITARY_BASES = geoData.MILITARY_BASES;
export const UNDERSEA_CABLES = geoData.UNDERSEA_CABLES;
export const NUCLEAR_FACILITIES = geoData.NUCLEAR_FACILITIES;
export const SANCTIONED_COUNTRIES = geoData.SANCTIONED_COUNTRIES;
export const MAP_URLS = geoData.MAP_URLS;
export const ECONOMIC_CENTERS = geoData.ECONOMIC_CENTERS;
export const SPACEPORTS = geoData.SPACEPORTS;
export const CRITICAL_MINERALS = geoData.CRITICAL_MINERALS;
