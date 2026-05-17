/**
 * Country Profiles Service
 *
 * Loads enriched country profile data from pre-compiled static JSON files.
 * Uses dynamic import for code-splitting — JSON only loaded on demand.
 *
 * Data sources:
 *   - REST Countries v3.1 (population, area, capital, languages, currency, timezone, etc.)
 *   - World Bank API (GDP, GINI, internet, military spend, unemployment, CO2, etc.)
 *   - Curated indices (HDI, CPI, Freedom House, Democracy Index, FSI, GPI)
 *
 * Refresh cadence: scripts should be re-run annually to update data.
 */

import type { CountryProfile, CountryIndicator, CountryIndex } from '@/types/country-profiles';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-loaded caches
// ─────────────────────────────────────────────────────────────────────────────

let _profiles: Promise<Record<string, CountryProfile>> | undefined;
let _indicators: Promise<Record<string, CountryIndicator>> | undefined;
let _indices: Promise<Record<string, CountryIndex>> | undefined;
let _iso3ToIso2: Promise<Record<string, string>> | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCountryProfiles(): Promise<Record<string, CountryProfile>> {
  if (_profiles) return _profiles;
  _profiles = (async () => {
    const { default: raw } = await import('@/data/country-profiles.json');
    return raw as unknown as Record<string, CountryProfile>;
  })();
  return _profiles;
}

export async function fetchCountryIndicators(): Promise<Record<string, CountryIndicator>> {
  if (_indicators) return _indicators;
  _indicators = (async () => {
    const { default: raw } = await import('@/data/country-indicators.json');
    return raw as unknown as Record<string, CountryIndicator>;
  })();
  return _indicators;
}

export async function fetchCountryIndices(): Promise<Record<string, CountryIndex>> {
  if (_indices) return _indices;
  _indices = (async () => {
    const { default: raw } = await import('@/data/country-indices.json');
    return raw as unknown as Record<string, CountryIndex>;
  })();
  return _indices;
}

/**
 * Returns a single country profile, or null if not found.
 * Accepts ISO-2 or ISO-3 codes.
 */
export async function getCountryProfile(code: string): Promise<CountryProfile | null> {
  const upper = code.toUpperCase();
  const profiles = await fetchCountryProfiles();
  if (profiles[upper]) return profiles[upper];
  const map = await getIso3ToIso2Map();
  const iso2 = map[upper];
  if (iso2) return profiles[iso2] ?? null;
  return null;
}

/**
 * Returns indicators for a single country, or null.
 */
export async function getCountryIndicators(code: string): Promise<CountryIndicator | null> {
  const upper = code.toUpperCase();
  const indicators = await fetchCountryIndicators();
  if (indicators[upper]) return indicators[upper];
  const map = await getIso3ToIso2Map();
  const iso2 = map[upper];
  if (iso2) return indicators[iso2] ?? null;
  return null;
}

/**
 * Returns governance/development indices for a single country, or null.
 */
export async function getCountryIndices(code: string): Promise<CountryIndex | null> {
  const upper = code.toUpperCase();
  const indices = await fetchCountryIndices();
  if (indices[upper]) return indices[upper];
  const map = await getIso3ToIso2Map();
  const iso2 = map[upper];
  if (iso2) return indices[iso2] ?? null;
  return null;
}

/**
 * Returns the full bundle for a country: profile + indicators + indices.
 */
export async function getCountryBundle(code: string): Promise<{
  profile: CountryProfile | null;
  indicators: CountryIndicator | null;
  indices: CountryIndex | null;
}> {
  const [profile, indicators, indices] = await Promise.all([
    getCountryProfile(code),
    getCountryIndicators(code),
    getCountryIndices(code),
  ]);
  return { profile, indicators, indices };
}

/**
 * Returns all country ISO-2 codes that have profile data.
 */
export async function getAllCountryCodes(): Promise<string[]> {
  const profiles = await fetchCountryProfiles();
  return Object.keys(profiles);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getIso3ToIso2Map(): Promise<Record<string, string>> {
  if (_iso3ToIso2) return _iso3ToIso2;
  _iso3ToIso2 = (async () => {
    const profiles = await fetchCountryProfiles();
    const map: Record<string, string> = {};
    for (const [iso2, profile] of Object.entries(profiles)) {
      if (profile.iso3) map[profile.iso3.toUpperCase()] = iso2;
    }
    return map;
  })();
  return _iso3ToIso2;
}

export {
  type CountryProfile,
  type CountryIndicator,
  type CountryIndex,
};
