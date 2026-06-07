import type { MapLayers, RelatedAsset } from '@/types';

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
}

const CUSTOM_CATEGORIES_KEY = 'wm-custom-categories-v1';

export const NEWS_REFRESH_SWEEP_EVENT = 'wm:news-refresh-sweep';
export const APP_TIME_RANGE_STORAGE_KEY = 'wm:time-range';
export const APP_TIME_RANGE_EVENT = 'wm:time-range-changed';

const RELATED_ASSET_LAYER_MAP: Record<RelatedAsset['type'], keyof MapLayers> = {
  pipeline: 'pipelines',
  cable: 'cables',
  datacenter: 'datacenters',
  base: 'bases',
  nuclear: 'nuclear',
  irradiator: 'irradiators',
  spaceport: 'spaceports',
  waterway: 'waterways',
  economicCenter: 'economic',
  aptGroup: 'aptGroups',
  mineral: 'minerals',
  startupHub: 'startupHubs',
  accelerator: 'accelerators',
  cloudRegion: 'cloudRegions',
  techHQ: 'techHQs',
  stockExchange: 'stockExchanges',
  financialCenter: 'financialCenters',
  centralBank: 'centralBanks',
  commodityHub: 'commodityHubs',
  miningSite: 'miningSites',
  processingPlant: 'processingPlants',
  commodityPort: 'commodityPorts',
};

export function loadCustomCategories(): CustomCategory[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomCategory[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories: CustomCategory[]): void {
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // ignore
  }
}

export function generateCategoryId(): string {
  return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export function getRelatedAssetLayer(type: RelatedAsset['type']): keyof MapLayers {
  return RELATED_ASSET_LAYER_MAP[type];
}
