import type { MapLayers } from '@/types';
import type { WeatherCategory } from '@/services/weather';
import {
  WEATHER_CATEGORY_COLORS,
  WEATHER_CATEGORY_ICONS,
  resolveLayerAccentColor,
  resolveLayerIcon,
} from '@/config/map-layer-definitions';
import { getCurrentTheme } from '@/utils/index';

export const SHARED_LAYER_ICON_MAPPING = { marker: { x: 0, y: 0, width: 32, height: 32, mask: false } };
export const WEATHER_PNG_ICON_MAPPING = { marker: { x: 0, y: 0, width: 512, height: 512, mask: false } };
export const WEATHER_THUNDERSTORM_ICON_ATLAS = 'https://cdn-icons-png.flaticon.com/512/3104/3104612.png';
export const WEATHER_FLOOD_ICON_ATLAS = '/icons/Flood.png';
export const WEATHER_DEFAULT_ICON_ATLAS = 'https://cdn-icons-png.flaticon.com/512/6257/6257646.png';

export const AIS_VESSEL_ICON_MAPPING = { ship: { x: 0, y: 0, width: 64, height: 64, mask: true } };
export const AIS_VESSEL_ICON_ATLAS = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg viewBox="0 0 24 24" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h16"/><path d="M7 14V9h10v5"/><path d="M3 17c1.2 1 2.4 1.5 3.5 1.5S8.8 18 10 17c1.2 1 2.4 1.5 3.5 1.5S15.8 18 17 17c1.2 1 2.4 1.5 3.5 1.5"/><path d="M12 5v4"/></svg>'
)}`;

export const AIS_PORT_ICON_MAPPING = { port: { x: 0, y: 0, width: 64, height: 64, mask: false } };
export const AIS_PORT_ICON_ATLAS = '/icons/port.png';

export const AVIATION_AIRPORT_ICON_MAPPING = { airport: { x: 0, y: 0, width: 512, height: 512, mask: false } };
export const AVIATION_AIRPORT_ICON_ATLAS = '/icons/airport.png';
export const AVIATION_PLANE_ICON_MAPPING = { plane: { x: 0, y: 0, width: 512, height: 512, mask: false } };
export const AVIATION_PLANE_ICON_ATLAS = '/icons/plane.png';

const SHARED_LAYER_ICON_ATLAS_CACHE = new Map<string, string>();
const WEATHER_CATEGORY_ATLAS_CACHE = new Map<string, string>();

function getThemeMode(): 'light' | 'dark' {
  return getCurrentTheme() === 'light' ? 'light' : 'dark';
}

export function getWeatherCategoryAtlas(category: WeatherCategory, theme: 'light' | 'dark' = getThemeMode()): string {
  const cacheKey = `weather:${category}:${theme}`;
  const cached = WEATHER_CATEGORY_ATLAS_CACHE.get(cacheKey);
  if (cached) return cached;
  const colors = WEATHER_CATEGORY_COLORS[category];
  const color = theme === 'light' ? colors.light : colors.dark;
  const markup = WEATHER_CATEGORY_ICONS[category];
  const svg = markup.replace(
    '<svg ',
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" style="color:${color}" `,
  );
  const atlas = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  WEATHER_CATEGORY_ATLAS_CACHE.set(cacheKey, atlas);
  return atlas;
}

export function getSharedLayerIconAtlas(layer: keyof MapLayers, theme: 'light' | 'dark' = getThemeMode()): string {
  const cacheKey = `${layer}:${theme}`;
  const cached = SHARED_LAYER_ICON_ATLAS_CACHE.get(cacheKey);
  if (cached) return cached;

  const color = resolveLayerAccentColor(layer, theme);
  const markup = resolveLayerIcon(layer);
  const imgMatch = markup.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    SHARED_LAYER_ICON_ATLAS_CACHE.set(cacheKey, imgMatch[1]);
    return imgMatch[1];
  }

  const svg = markup.replace(
    '<svg ',
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" style="color:${color}" `,
  );
  const atlas = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  SHARED_LAYER_ICON_ATLAS_CACHE.set(cacheKey, atlas);
  return atlas;
}
