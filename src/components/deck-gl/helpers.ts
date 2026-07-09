/**
 * Small pure module-level helpers extracted from DeckGLMap: country → flag
 * emoji lookup and localStorage-backed custom map-layer categories. Behaviour-
 * neutral extraction to shrink DeckGLMap.ts.
 */
import type { MapLayers } from '@/types';

const COUNTRY_FLAG_MAP: Record<string, string> = {
  'United States': '🇺🇸', 'USA': '🇺🇸', 'US': '🇺🇸',
  'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Britain': '🇬🇧',
  'Russia': '🇷🇺', 'Russian Federation': '🇷🇺',
  'China': '🇨🇳', 'PRC': '🇨🇳',
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'Italy': '🇮🇹',
  'Japan': '🇯🇵',
  'India': '🇮🇳',
  'Turkey': '🇹🇷',
  'UAE': '🇦🇪', 'United Arab Emirates': '🇦🇪',
  'Israel': '🇮🇱',
  'Iran': '🇮🇷',
  'Australia': '🇦🇺',
  'Canada': '🇨🇦',
  'South Korea': '🇰🇷',
  'Spain': '🇪🇸',
  'Netherlands': '🇳🇱',
  'Poland': '🇵🇱',
  'Saudi Arabia': '🇸🇦',
  'Qatar': '🇶🇦',
  'Pakistan': '🇵🇰',
  'Brazil': '🇧🇷',
  'Egypt': '🇪🇬',
  'South Africa': '🇿🇦',
};

export function countryToFlagEmoji(country: string): string {
  return COUNTRY_FLAG_MAP[country] || '';
}

export interface CustomCategory {
  id: string;
  name: string;
  layers: (keyof MapLayers)[];
}

const CC_STORAGE_KEY = 'wm-custom-categories';

export function loadCustomCategories(): CustomCategory[] {
  try {
    const raw = localStorage.getItem(CC_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomCategory[]) : [];
  } catch { return []; }
}

export function saveCustomCategories(cats: CustomCategory[]): void {
  try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(cats)); } catch { /* ignore */ }
}
