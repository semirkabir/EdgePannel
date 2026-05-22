/**
 * Open-Meteo point weather utility.
 *
 * Fetches current conditions and a short hourly forecast for any lat/lon.
 * CORS-enabled — called directly from the browser, no proxy needed.
 *
 * Free, no API key. Source: https://open-meteo.com/en/docs
 * Rate limit: 10 000 req/day (free tier). We cache aggressively to stay well under.
 */

// ── WMO weather interpretation codes ────────────────────────────────────────

const WMO_CODE_LABEL: Record<number, string> = {
  0:  'Clear sky',
  1:  'Mainly clear',    2: 'Partly cloudy',   3: 'Overcast',
  45: 'Fog',             48: 'Icy fog',
  51: 'Light drizzle',   53: 'Drizzle',         55: 'Heavy drizzle',
  56: 'Freezing drizzle',57: 'Heavy freezing drizzle',
  61: 'Light rain',      63: 'Rain',            65: 'Heavy rain',
  66: 'Freezing rain',   67: 'Heavy freezing rain',
  71: 'Light snow',      73: 'Snow',            75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',   81: 'Showers',         82: 'Heavy showers',
  85: 'Snow showers',    86: 'Heavy snow showers',
  95: 'Thunderstorm',    96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail',
};

export function wmoLabel(code: number): string {
  return WMO_CODE_LABEL[code] ?? 'Unknown';
}

export function wmoEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2)  return '🌤️';
  if (code === 3)  return '☁️';
  if (code <= 48)  return '🌫️';
  if (code <= 67)  return '🌧️';
  if (code <= 77)  return '❄️';
  if (code <= 82)  return '🌦️';
  if (code <= 86)  return '🌨️';
  return '⛈️';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PointWeather {
  /** Latitude (WGS84). */
  lat: number;
  /** Longitude (WGS84). */
  lon: number;
  /** Current air temperature at 2 m (°C). */
  temperatureC: number;
  /** Current apparent / feels-like temperature (°C). */
  apparentC: number;
  /** Current wind speed at 10 m (km/h). */
  windKph: number;
  /** Wind direction (degrees, 0 = N). */
  windDeg: number;
  /** Current precipitation (mm/h). */
  precipMm: number;
  /** WMO weather interpretation code for current conditions. */
  weatherCode: number;
  /** Human-readable condition label derived from WMO code. */
  condition: string;
  /** Visual emoji shorthand. */
  emoji: string;
  /** Relative humidity at 2 m (%). */
  humidity: number;
  /** ISO timestamp of the observation (hourly slot). */
  time: string;
  /** UTC offset in seconds at the queried location. */
  utcOffsetSeconds: number;
  /** Timezone abbreviation (e.g. "EST", "CET"). */
  timezone: string;
}

// ── In-process LRU cache (coordinate-keyed) ───────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 200;

interface CacheEntry {
  data: PointWeather;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number): string {
  // Round to 2 decimal places (~1 km precision) — avoids cache explosion
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function pruneCache(): void {
  if (cache.size < MAX_CACHE_ENTRIES) return;
  // Remove oldest 25%
  const now = Date.now();
  const toDelete: string[] = [];
  for (const [k, v] of cache) {
    if (v.expiresAt < now) toDelete.push(k);
  }
  if (toDelete.length === 0) {
    // Nothing expired — drop the first quarter by insertion order
    const keys = [...cache.keys()];
    keys.slice(0, Math.ceil(MAX_CACHE_ENTRIES / 4)).forEach(k => cache.delete(k));
  } else {
    toDelete.forEach(k => cache.delete(k));
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch current weather conditions for any coordinate.
 *
 * Results are cached for 30 minutes per rounded coordinate (2 dp).
 * Returns `null` on network failure so callers can silently degrade.
 *
 * @example
 * const wx = await getPointWeather(48.8566, 2.3522);
 * // → { temperatureC: 14, condition: 'Partly cloudy', emoji: '🌤️', ... }
 */
export async function getPointWeather(
  lat: number,
  lon: number,
): Promise<PointWeather | null> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const params = new URLSearchParams({
    latitude:          String(lat.toFixed(4)),
    longitude:         String(lon.toFixed(4)),
    current:           [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    wind_speed_unit:   'kmh',
    forecast_days:     '1',
    timezone:          'auto',
  });

  try {
    const resp = await fetch(`${BASE_URL}?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const cur = json.current as Record<string, number | string>;

    const data: PointWeather = {
      lat,
      lon,
      temperatureC:     cur['temperature_2m']        as number,
      apparentC:        cur['apparent_temperature']   as number,
      humidity:         cur['relative_humidity_2m']  as number,
      precipMm:         cur['precipitation']          as number,
      weatherCode:      cur['weather_code']           as number,
      windKph:          cur['wind_speed_10m']         as number,
      windDeg:          cur['wind_direction_10m']     as number,
      time:             cur['time']                   as string,
      utcOffsetSeconds: json.utc_offset_seconds       as number,
      timezone:         json.timezone_abbreviation    as string,
      condition:        wmoLabel(cur['weather_code']  as number),
      emoji:            wmoEmoji(cur['weather_code']  as number),
    };

    pruneCache();
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return null;
  }
}

/**
 * Synchronously return a cached weather entry if one exists and is fresh.
 * Useful for popup enrichment paths that cannot be async.
 */
export function getCachedPointWeather(lat: number, lon: number): PointWeather | null {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  return cached && cached.expiresAt > Date.now() ? cached.data : null;
}

/**
 * Format a PointWeather into a compact one-line summary string.
 * e.g. "🌧️ Rain · 12°C (feels 9°C) · Wind 28 km/h"
 */
export function formatWeatherSummary(wx: PointWeather): string {
  const temp = `${Math.round(wx.temperatureC)}°C`;
  const feels = Math.round(wx.apparentC);
  const feelsStr = Math.abs(feels - Math.round(wx.temperatureC)) >= 2
    ? ` (feels ${feels}°C)` : '';
  const wind = wx.windKph >= 10 ? ` · Wind ${Math.round(wx.windKph)} km/h` : '';
  return `${wx.emoji} ${wx.condition} · ${temp}${feelsStr}${wind}`;
}
