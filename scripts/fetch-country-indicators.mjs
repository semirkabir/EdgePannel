#!/usr/bin/env node

/**
 * Fetches key economic & social indicators from World Bank API v2 for
 * all countries and writes src/data/country-indicators.json.
 *
 * World Bank uses ISO-2 country codes directly — no conversion needed.
 * Aggregates (1A, EU, S1, XC, Z4, etc.) are filtered out.
 *
 * Usage: node scripts/fetch-country-indicators.mjs
 */

const WB_BASE = 'https://api.worldbank.org/v2/country/ALL/indicator';
const HEADERS = { Accept: 'application/json' };

// World Bank aggregate codes to exclude (contain digits or are known non-country)
const AGG_PATTERN = /^[0-9]|[0-9]$|^X[A-Z]$|^Z[A-Z0-9]$/;
const KNOWN_AGGREGATES = new Set(['EU', 'OE', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI', 'XJ', 'XK', 'XL', 'XM', 'XN', 'XO', 'XP', 'XQ', 'XT', 'XU', 'JG']);

const INDICATORS = {
  gdpCurrentUSD: 'NY.GDP.MKTP.CD',
  gdpPerCapitaUSD: 'NY.GDP.PCAP.CD',
  gdpGrowthPct: 'NY.GDP.MKTP.KD.ZG',
  inflationPct: 'FP.CPI.TOTL.ZG',
  unemploymentPct: 'SL.UEM.TOTL.ZS',
  population: 'SP.POP.TOTL',
  giniIndex: 'SI.POV.GINI',
  internetUsersPct: 'IT.NET.USER.ZS',
  militarySpendPctGDP: 'MS.MIL.XPND.GD.ZS',
  lifeExpectancyYears: 'SP.DYN.LE00.IN',
};

async function fetchIndicator(code) {
  const url = `${WB_BASE}/${code}?format=json&per_page=20000&mrnev=1`;
  console.log(`  Fetching ${code}...`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`  ⚠ ${code}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data || data.length < 2 || !Array.isArray(data[1])) {
      console.warn(`  ⚠ ${code}: No data array (got ${data?.length} parts)`);
      return null;
    }
    return data[1];
  } catch (e) {
    console.warn(`  ⚠ ${code}: ${e.message}`);
    return null;
  }
}

function isCountryCode(id) {
  if (!id || id.length !== 2) return false;
  if (!/^[A-Z]{2}$/.test(id)) return false;
  if (AGG_PATTERN.test(id)) return false;
  if (KNOWN_AGGREGATES.has(id)) return false;
  return true;
}

async function main() {
  console.log('Fetching World Bank indicators...');

  // STEP 1 — Fetch all indicators sequentially with throttling
  const indicatorData = {};
  for (const [key, code] of Object.entries(INDICATORS)) {
    indicatorData[key] = await fetchIndicator(code);
    await new Promise((r) => setTimeout(r, 300));
  }

  // STEP 2 — Build per-country records
  const byCountry = {};

  for (const [indicatorKey, records] of Object.entries(indicatorData)) {
    if (!records) continue;

    for (const r of records) {
      const id = r.country?.id;
      if (!isCountryCode(id)) continue;
      if (r.value == null || r.value === '' || r.value === undefined) continue;

      if (!byCountry[id]) {
        byCountry[id] = {
          code: id,
          name: r.country.value || id,
          gdpCurrentUSD: null, gdpPerCapitaUSD: null, gdpGrowthPct: null,
          inflationPct: null, unemploymentPct: null, population: null,
          giniIndex: null, internetUsersPct: null, militarySpendPctGDP: null,
          co2EmissionsKt: null, lifeExpectancyYears: null, literacyRatePct: null,
          year: 0,
        };
      }

      const year = parseInt(r.date, 10);
      const key = `_yr_${indicatorKey}`;

      if (byCountry[id][indicatorKey] === null || year > (byCountry[id][key] || 0)) {
        byCountry[id][indicatorKey] = Math.round(parseFloat(r.value) * 100) / 100;
        byCountry[id][key] = year;
        if (year > byCountry[id].year) byCountry[id].year = year;
      }
    }
  }

  // Clean up temp fields
  for (const entry of Object.values(byCountry)) {
    for (const k of Object.keys(INDICATORS)) {
      delete entry[`_yr_${k}`];
    }
  }

  console.log(`  Parsed ${Object.keys(byCountry).length} countries`);

  // STEP 3 — Fetch country names from REST Countries for name enrichment
  console.log('  Enriching country names...');
  try {
    const rcRes = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name', { headers: HEADERS });
    if (rcRes.ok) {
      const rcData = await rcRes.json();
      for (const c of rcData) {
        const code = c.cca2?.toUpperCase();
        if (code && byCountry[code] && c.name?.common) {
          byCountry[code].name = c.name.common;
        }
      }
      console.log('  Names enriched');
    }
  } catch (e) {
    console.warn(`  ⚠ Name enrichment failed: ${e.message}`);
  }

  const output = JSON.stringify(byCountry, null, 2);
  const { writeFileSync } = await import('fs');
  writeFileSync('src/data/country-indicators.json', output + '\n', 'utf-8');

  console.log(`Wrote ${Object.keys(byCountry).length} country indicators to src/data/country-indicators.json`);
  console.log(`File size: ${(output.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
