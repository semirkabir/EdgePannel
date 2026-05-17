#!/usr/bin/env node

/**
 * Fetches country profile data from REST Countries v3.1 API and writes
 * a compact JSON to src/data/country-profiles.json.
 *
 * Uses 2 parallel requests (API caps fields at 10 per call):
 *   Batch A: identity + geography + demographics
 *   Batch B: languages, currencies, timezones, borders, membership, flags
 *
 * Usage: node scripts/fetch-country-profiles.mjs
 */

const BASE = 'https://restcountries.com/v3.1/all?fields=';

const BATCH_A = 'cca2,cca3,name,capital,population,area,region,subregion,latlng';
const BATCH_B = 'cca2,languages,currencies,timezones,borders,demonyms,unMember,independent,flag';

async function main() {
  console.log('Fetching country profiles (2 parallel batches)...');
  const [resA, resB] = await Promise.all([
    fetch(BASE + BATCH_A),
    fetch(BASE + BATCH_B),
  ]);

  if (!resA.ok) throw new Error(`Batch A HTTP ${resA.status}: ${resA.statusText}`);
  if (!resB.ok) throw new Error(`Batch B HTTP ${resB.status}: ${resB.statusText}`);

  const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
  console.log(`  Batch A: ${dataA.length} countries, Batch B: ${dataB.length} countries`);

  // Index batch B by cca2
  const bIndex = {};
  for (const c of dataB) {
    const code = (c.cca2 || '').toUpperCase();
    if (code) bIndex[code] = c;
  }

  const profiles = {};
  let count = 0;

  for (const c of dataA) {
    const code = (c.cca2 || '').toUpperCase();
    if (!code) continue;

    const b = bIndex[code] || {};

    const languages = {};
    if (b.languages) {
      for (const [lang, name] of Object.entries(b.languages)) {
        languages[lang] = name;
      }
    }

    const currencies = {};
    if (b.currencies) {
      for (const [cur, info] of Object.entries(b.currencies)) {
        currencies[cur] = { name: info.name || '', symbol: info.symbol || '' };
      }
    }

    profiles[code] = {
      code,
      iso3: (c.cca3 || '').toUpperCase(),
      name: c.name?.common || c.name?.official || code,
      capital: Array.isArray(c.capital) ? (c.capital[0] || null) : (c.capital || null),
      region: c.region || '',
      subregion: c.subregion || '',
      population: c.population || 0,
      areaKm2: Math.round(c.area || 0),
      languages: languages || {},
      currencies: currencies || {},
      timezones: b.timezones || [],
      lat: c.latlng?.[0] ?? 0,
      lon: c.latlng?.[1] ?? 0,
      demonym: b.demonyms?.eng?.m || b.demonyms?.eng?.f || '',
      flagEmoji: b.flag || '',
      borders: (b.borders || []).map((x) => x.toUpperCase()),
      independent: b.independent ?? false,
      unMember: b.unMember ?? false,
    };

    count++;
  }

  const output = JSON.stringify(profiles, null, 2);
  const { writeFileSync } = await import('fs');
  writeFileSync('src/data/country-profiles.json', output + '\n', 'utf-8');

  console.log(`Wrote ${count} country profiles to src/data/country-profiles.json`);
  console.log(`File size: ${(output.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
