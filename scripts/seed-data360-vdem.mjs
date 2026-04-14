#!/usr/bin/env node
/**
 * Seed script: V-Dem Democracy Indices + Polity V → Redis
 *
 * Fetches V-Dem (VDEM_CORE) and Polity V (POLITY5_PRC) indicators from the
 * World Bank Data360 API, computes composite democracy scores and regime
 * classifications, then stores results in Redis for bootstrap hydration.
 *
 * Usage:
 *   node scripts/seed-data360-vdem.mjs [--env production|preview|development] [--sha <sha>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VDEM_KEY = 'economic:data360-vdem:v1';
const POLITY_KEY = 'economic:data360-polity:v1';
const VDEM_BASELINES_KEY = 'economic:vdemBaselines:v1'; // for bootstrap hydration
const TTL_SECONDS = 7 * 24 * 3600; // 7 days
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

const DATA360_BASE = 'https://data360api.worldbank.org/data360/data';

/** V-Dem key indicators with democracy composite weights */
const VDEM_INDICATORS = [
  { key: 'electoral',           id: 'VDEM_CORE_V2X_API',      weight: 0.30, label: 'Electoral Democracy' },
  { key: 'liberal',             id: 'VDEM_CORE_V2X_LIB',      weight: 0.20, label: 'Liberal Democracy' },
  { key: 'participatory',       id: 'VDEM_CORE_V2X_PART',     weight: 0.15, label: 'Participatory Democracy' },
  { key: 'deliberative',        id: 'VDEM_CORE_V2X_DL',       weight: 0.15, label: 'Deliberative Democracy' },
  { key: 'egalitarian',         id: 'VDEM_CORE_V2X_EG',       weight: 0.10, label: 'Egalitarian Democracy' },
  { key: 'freedomOfExpression', id: 'VDEM_CORE_V2XME_FREEXP', weight: 0.05, label: 'Freedom of Expression' },
  { key: 'cleanElections',      id: 'VDEM_CORE_V2XELECGOV',   weight: 0.05, label: 'Clean Elections' },
];

const POLITY_INDICATORS = [
  { key: 'polityScore',              id: 'POLITY5_PRC_POLITY2',  label: 'Polity Score' },
  { key: 'democracyScore',           id: 'POLITY5_PRC_DEMOC',    label: 'Democracy Indicator' },
  { key: 'autocracyScore',           id: 'POLITY5_PRC_AUTOC',    label: 'Autocracy Indicator' },
  { key: 'constraintOnExecutive',   id: 'POLITY5_PRC_XCONST',   label: 'Constraint on Executive' },
  { key: 'politicalCompetition',     id: 'POLITY5_PRC_POLCOMP',  label: 'Political Competition' },
];

// ISO-3 → ISO-2 mapping (Data360 returns ISO-3 codes, client uses ISO-2)
const ISO3_TO_ISO2 = {
  AFG:'AF', ALB:'AL', DZA:'DZ', AGO:'AO', ARG:'AR', ARM:'AM', AUS:'AU',
  AUT:'AT', AZE:'AZ', BHR:'BH', BGD:'BD', BLR:'BY', BEL:'BE', BOL:'BO',
  BIH:'BA', BWA:'BW', BRA:'BR', BGR:'BG', CAN:'CA', CHL:'CL', CHN:'CN',
  COL:'CO', COD:'CD', CRI:'CR', HRV:'HR', CZE:'CZ', DNK:'DK', DOM:'DO',
  ECU:'EC', EGY:'EG', ETH:'ET', FIN:'FI', FRA:'FR', GHA:'GH', GRC:'GR',
  GTM:'GT', HND:'HN', HKG:'HK', HUN:'HU', ISL:'IS', IND:'IN', IDN:'ID',
  IRN:'IR', IRQ:'IQ', IRL:'IE', ISR:'IL', ITA:'IT', JPN:'JP', JOR:'JO',
  KAZ:'KZ', KEN:'KE', KWT:'KW', LBN:'LB', LTU:'LT', LVA:'LV', LUX:'LU',
  MYS:'MY', MEX:'MX', MAR:'MA', MOZ:'MZ', MMR:'MM', NLD:'NL', NZL:'NZ',
  NGA:'NG', MKD:'MK', NOR:'NO', OMN:'OM', PAK:'PK', PAN:'PA', PRY:'PY',
  PER:'PE', PHL:'PH', POL:'PL', PRT:'PT', QAT:'QA', ROU:'RO', RUS:'RU',
  SAU:'SA', SEN:'SN', SRB:'RS', SGP:'SG', ZAF:'ZA', KOR:'KR', ESP:'ES',
  LKA:'LK', SDN:'SD', SWE:'SE', CHE:'CH', SYR:'SY', TWN:'TW', TZA:'TZ',
  THA:'TH', TUN:'TN', TUR:'TR', UGA:'UG', UKR:'UA', ARE:'AE', GBR:'GB',
  USA:'US', URY:'UY', UZB:'UZ', VEN:'VE', VNM:'VN', YEM:'YE', ZMB:'ZM',
  ZWE:'ZW', EST:'EE', SVK:'SK', SVN:'SI', CYP:'CY', MLT:'MT', CIV:'CI',
  LBY:'LY', KGZ:'KG', TJK:'TJ', MAC:'MO', BRN:'BN', PSE:'PS', XKX:'XK',
  TTO:'TT', SUR:'SR', GMB:'GM', GNQ:'GQ', MDA:'MD', GEO:'GE',
  SSD:'SS', MNE:'ME', ABW:'AW', AIA:'AI', ATA:'AQ', ATG:'AG',
  BHS:'BS', BBD:'BB', BZ:'BZ', BMU:'BM', BTN:'BT', COK:'CK',
  COM:'KM', CPV:'CV', CYM:'KY', DJI:'DJ', DMA:'DM', ERI:'ER',
  SWZ:'SZ', FJI:'FJ', FLK:'FK', GAB:'GA', GIN:'GN', GLP:'GP',
  GUF:'GF', GUM:'GU', HTI:'HT', KIR:'KI', KNA:'KN', LAO:'LA',
  LCA:'LC', LSO:'LS', MDG:'MG', MDV:'MV', MHL:'MH', MLI:'ML',
  MLT:'MT', MNP:'MP', MRT:'MR', MSR:'MS', NAM:'NA', NCL:'NC',
  NER:'NE', NIU:'NU', NRU:'NR', PLW:'PW', PNG:'PG', PRI:'PR',
  PYF:'PF', RWA:'RW', SHN:'SH', SLB:'SB', SLB:'SB', SLE:'SL',
  SMR:'SM', SOM:'SO', SPM:'PM', STP:'ST', SYC:'SC', TCA:'TC',
  TGO:'TG', TKL:'TK', TLS:'TL', TON:'TO', TUV:'TV', VCT:'VC',
  VIR:'VI', VUT:'VU', WSM:'WS', ATA:'AQ',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let env = 'production';
  let sha = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' && args[i + 1]) {
      env = args[++i];
    } else if (args[i] === '--sha' && args[i + 1]) {
      sha = args[++i];
    } else if (args[i].startsWith('--env=')) {
      env = args[i].split('=')[1];
    } else if (args[i].startsWith('--sha=')) {
      sha = args[i].split('=')[1];
    }
  }

  const valid = ['production', 'preview', 'development'];
  if (!valid.includes(env)) {
    console.error(`Invalid --env "${env}". Must be one of: ${valid.join(', ')}`);
    process.exit(1);
  }

  if ((env === 'preview' || env === 'development') && !sha) {
    sha = 'dev';
  }

  return { env, sha };
}

function getKeyPrefix(env, sha) {
  if (env === 'production') return '';
  return `${env}:${sha}:`;
}

function maskToken(token) {
  if (!token || token.length < 8) return '***';
  return token.slice(0, 4) + '***' + token.slice(-4);
}

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, attempt = 1) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'WorldMonitor-Seed/1.0 (https://worldmonitor.app)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return resp.json();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`  Retry ${attempt}/${MAX_RETRIES} for ${url} in ${delay}ms... (${err.message})`);
      await sleep(delay);
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

async function redisPipeline(redisUrl, token, commands) {
  const resp = await fetch(`${redisUrl}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Redis pipeline failed: HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }
  return resp.json();
}

/** Normalize ISO-3 ref area to ISO-2 where possible */
function normalizeRefArea(refArea) {
  if (refArea.length === 3 && ISO3_TO_ISO2[refArea]) return ISO3_TO_ISO2[refArea];
  return refArea;
}

// ---------------------------------------------------------------------------
// Data360 fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a single Data360 indicator.
 * Returns a map of countryCode → { value, name, year }
 * countryCode is normalized to ISO-2.
 */
async function fetchData360Indicator(databaseId, indicatorId) {
  const url = `${DATA360_BASE}?DATABASE_ID=${databaseId}&INDICATOR=${indicatorId}&isLatestData=true&top=1000&format=json`;
  console.log(`  Fetching ${indicatorId} (db=${databaseId})...`);

  const raw = await fetchWithRetry(url);

  if (!raw || !raw.value || !Array.isArray(raw.value)) {
    console.warn(`    → No data for ${indicatorId}`);
    return {};
  }

  const latestByCountry = {};
  for (const entry of raw.value) {
    if (entry.OBS_VALUE == null || entry.REF_AREA == null) continue;

    const refArea = normalizeRefArea(entry.REF_AREA);
    // Skip non-country codes (regions, income groups, etc.)
    if (refArea.length !== 2) continue;

    const value = parseFloat(entry.OBS_VALUE);
    if (isNaN(value)) continue;

    const year = parseInt(entry.TIME_PERIOD, 10) || 0;
    const name = entry.REF_AREA_DESC || entry.REF_AREA || refArea;

    // Keep latest year per country
    if (!latestByCountry[refArea] || year > latestByCountry[refArea].year) {
      latestByCountry[refArea] = { value, name, year };
    }
  }

  const count = Object.keys(latestByCountry).length;
  console.log(`    → ${count} countries`);
  return latestByCountry;
}

// ---------------------------------------------------------------------------
// V-Dem scoring
// ---------------------------------------------------------------------------

function computeVDemScores(indicatorData) {
  const scores = [];

  // Collect all country codes across all indicators
  const allCountries = new Set();
  for (const data of Object.values(indicatorData)) {
    for (const code of Object.keys(data)) {
      allCountries.add(code);
    }
  }

  for (const countryCode of allCountries) {
    let weightedSum = 0;
    let totalWeight = 0;
    const components = {
      electoral: null,
      liberal: null,
      participatory: null,
      deliberative: null,
      egalitarian: null,
      freedomOfExpression: null,
      cleanElections: null,
    };
    let countryName = countryCode;

    for (const { key, weight } of VDEM_INDICATORS) {
      const entry = indicatorData[key]?.[countryCode];
      if (!entry || entry.value == null) continue;

      // V-Dem scores are typically 0–1, normalize to 0–100
      const normalized = Math.min(100, entry.value * 100);
      weightedSum += normalized * weight;
      totalWeight += weight;
      components[key] = Math.round(normalized * 10) / 10;

      if (countryName === countryCode || !countryName) {
        countryName = entry.name;
      }
    }

    if (totalWeight === 0) continue;

    const compositeScore = Math.round((weightedSum / totalWeight) * 10) / 10;

    // Determine regime type based on electoral democracy score
    const electoral = components.electoral;
    let regimeType = 'Autocracy';
    if (electoral !== null) {
      if (electoral >= 80) regimeType = 'Full Democracy';
      else if (electoral >= 50) regimeType = 'Democracy';
      else if (electoral >= 30) regimeType = 'Hybrid Regime';
    }

    scores.push({
      countryCode,
      countryName: countryName || countryCode,
      compositeScore,
      rank: 0, // assigned after sorting
      regimeType,
      components,
      source: 'vdem',
    });
  }

  // Sort by composite score descending, assign ranks
  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => { s.rank = i + 1; });

  return scores;
}

// ---------------------------------------------------------------------------
// Polity V scoring
// ---------------------------------------------------------------------------

function computePolityScores(indicatorData) {
  const scores = [];

  // Only include countries that have polityScore (POLITY2)
  const polityData = indicatorData.polityScore;
  if (!polityData) return scores;

  for (const [countryCode, polityEntry] of Object.entries(polityData)) {
    if (polityEntry.value == null) continue;

    const polity = polityEntry.value;
    const democ = indicatorData.democracyScore?.[countryCode]?.value ?? 0;
    const autoc = indicatorData.autocracyScore?.[countryCode]?.value ?? 0;
    const xconst = indicatorData.constraintOnExecutive?.[countryCode]?.value ?? 1;
    const polcomp = indicatorData.politicalCompetition?.[countryCode]?.value ?? 1;

    let regimeType = 'Autocracy';
    if (polity >= 8) regimeType = 'Full Democracy';
    else if (polity >= 5) regimeType = 'Democracy';
    else if (polity >= -5) regimeType = 'Hybrid Regime';

    scores.push({
      countryCode,
      countryName: polityEntry.name || countryCode,
      polityScore: Math.round(polity * 10) / 10,
      democracyScore: Math.round(democ * 10) / 10,
      autocracyScore: Math.round(autoc * 10) / 10,
      regimeType,
      constraintOnExecutive: xconst,
      politicalCompetition: polcomp,
      source: 'polity',
    });
  }

  // Sort by polity score descending
  scores.sort((a, b) => b.polityScore - a.polityScore);

  return scores;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFile();

  const { env, sha } = parseArgs();
  const prefix = getKeyPrefix(env, sha);

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl) {
    console.error('Missing UPSTASH_REDIS_REST_URL. Set it in .env.local or as an env var.');
    process.exit(1);
  }
  if (!redisToken) {
    console.error('Missing UPSTASH_REDIS_REST_TOKEN. Set it in .env.local or as an env var.');
    process.exit(1);
  }

  const fullVdemKey = `${prefix}${VDEM_KEY}`;
  const fullPolityKey = `${prefix}${POLITY_KEY}`;
  const fullBaselinesKey = `${prefix}${VDEM_BASELINES_KEY}`;

  console.log('=== V-Dem Democracy + Polity V Seed (Data360) ===');
  console.log(`  Environment:  ${env}`);
  console.log(`  Prefix:       ${prefix || '(none — production)'}`);
  console.log(`  Redis URL:    ${redisUrl}`);
  console.log(`  Redis Token:  ${maskToken(redisToken)}`);
  console.log(`  Keys: ${fullVdemKey}, ${fullPolityKey}, ${fullBaselinesKey}`);
  console.log(`  TTL:          ${TTL_SECONDS}s (7 days)`);
  console.log();

  const t0 = Date.now();

  // ── 1. V-Dem Democracy Indices ──
  console.log('── V-Dem Democracy Indices (VDEM_CORE) ──');
  const vdemData = {};
  for (const { key, id } of VDEM_INDICATORS) {
    vdemData[key] = await fetchData360Indicator('VDEM_CORE', id);
  }

  const vdemScores = computeVDemScores(vdemData);
  console.log(`  → ${vdemScores.length} countries with V-Dem democracy scores`);
  const top10 = vdemScores.slice(0, 10);
  console.log(`  Top 10:    ${top10.map(s => `${s.countryName}(${s.compositeScore})`).join(', ')}`);
  const bottom10 = vdemScores.slice(-10).reverse();
  console.log(`  Bottom 10: ${bottom10.map(s => `${s.countryName}(${s.compositeScore})`).join(', ')}`);

  // Regime counts
  const regimeCounts = {};
  for (const s of vdemScores) {
    regimeCounts[s.regimeType] = (regimeCounts[s.regimeType] || 0) + 1;
  }
  console.log(`  Regimes: ${Object.entries(regimeCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // ── 2. Polity V ──
  console.log('\n── Polity V Regime Data (POLITY5_PRC) ──');
  const polityData = {};
  for (const { key, id } of POLITY_INDICATORS) {
    polityData[key] = await fetchData360Indicator('POLITY5_PRC', id);
  }

  const polityScores = computePolityScores(polityData);
  console.log(`  → ${polityScores.length} countries with Polity V scores`);
  if (polityScores.length > 0) {
    const pTop = polityScores.slice(0, 5);
    console.log(`  Top 5:    ${pTop.map(s => `${s.countryName}(${s.polityScore})`).join(', ')}`);
    const pBottom = polityScores.slice(-5).reverse();
    console.log(`  Bottom 5: ${pBottom.map(s => `${s.countryName}(${s.polityScore})`).join(', ')}`);
  }

  const polityRegimeCounts = {};
  for (const s of polityScores) {
    polityRegimeCounts[s.regimeType] = (polityRegimeCounts[s.regimeType] || 0) + 1;
  }
  console.log(`  Regimes: ${Object.entries(polityRegimeCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  const fetchElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll data fetched in ${fetchElapsed}s`);

  // Validate
  if (vdemScores.length === 0) {
    console.error('No V-Dem scores computed — aborting.');
    process.exit(1);
  }

  // ── 3. Build combined vdemBaselines for bootstrap hydration ──
  // This merges V-Dem and Polity data per country for the bootstrap endpoint
  const vdemByCountry = new Map(vdemScores.map(s => [s.countryCode, s]));
  const polityByCountry = new Map(polityScores.map(s => [s.countryCode, s]));

  const allCountryCodes = new Set([...vdemByCountry.keys(), ...polityByCountry.keys()]);
  const vdemBaselines = [];
  for (const code of allCountryCodes) {
    const v = vdemByCountry.get(code);
    const p = polityByCountry.get(code);
    vdemBaselines.push({
      countryCode: code,
      countryName: v?.countryName || p?.countryName || code,
      // V-Dem data
      compositeScore: v?.compositeScore ?? null,
      regimeType: v?.regimeType || p?.regimeType || 'Autocracy',
      rank: v?.rank ?? null,
      components: v?.components || {
        electoral: null, liberal: null, participatory: null,
        deliberative: null, egalitarian: null, freedomOfExpression: null,
        cleanElections: null,
      },
      // Polity data
      polityScore: p?.polityScore ?? null,
      democracyScore: p?.democracyScore ?? null,
      autocracyScore: p?.autocracyScore ?? null,
      constraintOnExecutive: p?.constraintOnExecutive ?? null,
      politicalCompetition: p?.politicalCompetition ?? null,
      source: 'vdem',
    });
  }
  // Sort by composite score descending (nulls last)
  vdemBaselines.sort((a, b) => {
    const aScore = a.compositeScore ?? -1;
    const bScore = b.compositeScore ?? -1;
    return bScore - aScore;
  });

  console.log(`  → ${vdemBaselines.length} countries in combined vdemBaselines`);

  // ── 4. Write to Redis ──
  const pipeline = [
    ['SET', fullVdemKey, JSON.stringify(vdemScores), 'EX', String(TTL_SECONDS)],
    ['SET', `seed-meta:${VDEM_KEY}`, JSON.stringify({
      fetchedAt: Date.now(),
      recordCount: vdemScores.length,
      indicators: VDEM_INDICATORS.map(i => i.id),
      source: 'data360-vdem',
    }), 'EX', String(TTL_SECONDS + 3600)],
  ];

  pipeline.push(
    ['SET', fullBaselinesKey, JSON.stringify(vdemBaselines), 'EX', String(TTL_SECONDS)],
    ['SET', `seed-meta:${VDEM_BASELINES_KEY}`, JSON.stringify({
      fetchedAt: Date.now(),
      recordCount: vdemBaselines.length,
      source: 'data360-vdem-combined',
    }), 'EX', String(TTL_SECONDS + 3600)],
  );

  if (polityScores.length > 0) {
    pipeline.push(
      ['SET', fullPolityKey, JSON.stringify(polityScores), 'EX', String(TTL_SECONDS)],
      ['SET', `seed-meta:${POLITY_KEY}`, JSON.stringify({
        fetchedAt: Date.now(),
        recordCount: polityScores.length,
        indicators: POLITY_INDICATORS.map(i => i.id),
        source: 'data360-polity',
      }), 'EX', String(TTL_SECONDS + 3600)],
    );
  }

  console.log(`\nWriting ${pipeline.length} keys to Redis...`);
  await redisPipeline(redisUrl, redisToken, pipeline);

  // ── 5. Verify ──
  console.log('Verifying...');
  const verifyResp = await redisPipeline(redisUrl, redisToken, [
    ['GET', fullVdemKey],
    ['GET', fullPolityKey],
    ['GET', fullBaselinesKey],
  ]);

  const parsedVdem = verifyResp[0]?.result ? JSON.parse(verifyResp[0].result) : null;
  if (!Array.isArray(parsedVdem) || parsedVdem.length === 0) {
    throw new Error('Verification failed: V-Dem key missing or empty');
  }
  console.log(`  ✓ vdemScores: ${parsedVdem.length} country scores`);

  if (verifyResp[1]?.result) {
    const p = JSON.parse(verifyResp[1].result);
    console.log(`  ✓ polityScores: ${p.length} country scores`);
  }

  const parsedBaselines = verifyResp[2]?.result ? JSON.parse(verifyResp[2].result) : null;
  if (!Array.isArray(parsedBaselines) || parsedBaselines.length === 0) {
    throw new Error('Verification failed: vdemBaselines key missing or empty');
  }
  console.log(`  ✓ vdemBaselines: ${parsedBaselines.length} country records`);

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== Done in ${total}s ===`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(0);
});