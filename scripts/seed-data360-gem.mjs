#!/usr/bin/env node
/**
 * Seed script: IFC GEM Risk Indicators → Redis
 *
 * Fetches IFC GEM (Global Economic Monitor) risk indicators from the
 * World Bank Data360 API, computes composite GEM risk/safety scores
 * and risk classifications, then stores results in Redis for bootstrap hydration.
 *
 * GEM risk scores are 1–10 (higher = more risk). We convert to safety scores
 * (0–100) via: safety = (10 - risk) / 10 * 100, then weighted-composite.
 *
 * Usage:
 *   node scripts/seed-data360-gem.mjs [--env production|preview|development] [--sha <sha>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEM_KEY = 'economic:data360-gem:v1';
const GEM_BASELINES_KEY = 'economic:gemBaselines:v1'; // for bootstrap hydration
const TTL_SECONDS = 7 * 24 * 3600; // 7 days
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

const DATA360_BASE = 'https://data360api.worldbank.org/data360/data';

/** GEM risk indicators with composite safety weights */
const GEM_INDICATORS = [
  { key: 'politicalDomestic',  id: 'IFC_GEM_PBD', weight: 0.175, label: 'Political Risk - Domestic' },
  { key: 'politicalForeign',  id: 'IFC_GEM_PBF', weight: 0.175, label: 'Political Risk - Foreign' },
  { key: 'economic',          id: 'IFC_GEM_ECN', weight: 0.25,  label: 'Economic Risk' },
  { key: 'operational',       id: 'IFC_GEM_OPR', weight: 0.20,  label: 'Operational Risk' },
  { key: 'sovereign',         id: 'IFC_GEM_SOV', weight: 0.20,  label: 'Sovereign Risk' },
];

/**
 * IFC_GEM_PBC is the pre-computed Political Risk Composite from Data360.
 * We store it separately (not in the weighted composite) for reference.
 */
const GEM_EXTRA_INDICATORS = [
  { key: 'politicalComposite', id: 'IFC_GEM_PBC', label: 'Political Risk - Composite' },
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
  BHS:'BS', BBD:'BB', BLZ:'BZ', BMU:'BM', BTN:'BT', COK:'CK',
  COM:'KM', CPV:'CV', CYM:'KY', DJI:'DJ', DMA:'DM', ERI:'ER',
  SWZ:'SZ', FJI:'FJ', FLK:'FK', GAB:'GA', GIN:'GN', GLP:'GP',
  GUF:'GF', GUM:'GU', HTI:'HT', KIR:'KI', KNA:'KN', LAO:'LA',
  LCA:'LC', LSO:'LS', MDG:'MG', MDV:'MV', MHL:'MH', MLI:'ML',
  MLT:'MT', MNP:'MP', MRT:'MR', MSR:'MS', NAM:'NA', NCL:'NC',
  NER:'NE', NIU:'NU', NRU:'NR', PLW:'PW', PNG:'PG', PRI:'PR',
  PYF:'PF', RWA:'RW', SHN:'SH', SLB:'SB', SLE:'SL',
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
 * value is the raw OBS_VALUE (risk score 1–10 for GEM).
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
// GEM scoring
// ---------------------------------------------------------------------------

/**
 * Convert a GEM risk score (1–10, higher = more risk) to a safety score (0–100).
 * safety = (10 - risk) / 10 * 100
 * So risk=1 → safety=90, risk=10 → safety=0
 */
function riskToSafety(riskScore) {
  return Math.max(0, Math.min(100, ((10 - riskScore) / 10) * 100));
}

/**
 * Classify risk level from a GEM risk score (1–10).
 */
function classifyRisk(riskScore) {
  if (riskScore <= 2) return 'Very Low Risk';
  if (riskScore <= 4) return 'Low Risk';
  if (riskScore <= 6) return 'Moderate Risk';
  if (riskScore <= 8) return 'High Risk';
  return 'Very High Risk';
}

function computeGEMScores(indicatorData, extraData) {
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
      politicalDomestic: null,
      politicalForeign: null,
      economic: null,
      operational: null,
      sovereign: null,
    };
    // Raw risk components for reference
    const riskComponents = {
      politicalDomestic: null,
      politicalForeign: null,
      economic: null,
      operational: null,
      sovereign: null,
    };
    let countryName = countryCode;

    for (const { key, weight } of GEM_INDICATORS) {
      const entry = indicatorData[key]?.[countryCode];
      if (!entry || entry.value == null) continue;

      const riskValue = entry.value;
      // GEM risk scores are 1–10, convert to safety 0–100 for composite
      const safetyValue = riskToSafety(riskValue);
      weightedSum += safetyValue * weight;
      totalWeight += weight;
      components[key] = Math.round(safetyValue * 10) / 10;
      riskComponents[key] = Math.round(riskValue * 10) / 10;

      if (countryName === countryCode || !countryName) {
        countryName = entry.name;
      }
    }

    if (totalWeight === 0) continue;

    const compositeSafetyScore = Math.round((weightedSum / totalWeight) * 10) / 10;

    // Compute an average raw risk score for risk classification
    let riskSum = 0;
    let riskCount = 0;
    for (const val of Object.values(riskComponents)) {
      if (val !== null) {
        riskSum += val;
        riskCount++;
      }
    }
    const avgRisk = riskCount > 0 ? riskSum / riskCount : 0;
    const riskClassification = classifyRisk(avgRisk);

    // Look up Political Risk Composite from extra data
    const pbcEntry = extraData.politicalComposite?.[countryCode];
    const politicalCompositeRisk = pbcEntry ? Math.round(pbcEntry.value * 10) / 10 : null;
    const politicalCompositeSafety = pbcEntry ? Math.round(riskToSafety(pbcEntry.value) * 10) / 10 : null;

    // Political composite (domestic + foreign weighted average)
    const domesticRisk = riskComponents.politicalDomestic;
    const foreignRisk = riskComponents.politicalForeign;
    let politicalCombinedSafety = null;
    if (components.politicalDomestic !== null && components.politicalForeign !== null) {
      politicalCombinedSafety = Math.round(((components.politicalDomestic + components.politicalForeign) / 2) * 10) / 10;
    } else if (components.politicalDomestic !== null) {
      politicalCombinedSafety = components.politicalDomestic;
    } else if (components.politicalForeign !== null) {
      politicalCombinedSafety = components.politicalForeign;
    }

    scores.push({
      countryCode,
      countryName: countryName || countryCode,
      compositeScore: compositeSafetyScore,
      rank: 0, // assigned after sorting
      riskClassification,
      avgRiskScore: Math.round(avgRisk * 10) / 10,
      components,
      riskComponents,
      politicalCombinedSafety,
      politicalCompositeRisk,
      politicalCompositeSafety,
      source: 'gem',
    });
  }

  // Sort by composite safety score descending, assign ranks
  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => { s.rank = i + 1; });

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

  const fullGemKey = `${prefix}${GEM_KEY}`;
  const fullBaselinesKey = `${prefix}${GEM_BASELINES_KEY}`;

  console.log('=== IFC GEM Risk Indicators Seed (Data360) ===');
  console.log(`  Environment:  ${env}`);
  console.log(`  Prefix:       ${prefix || '(none — production)'}`);
  console.log(`  Redis URL:    ${redisUrl}`);
  console.log(`  Redis Token:  ${maskToken(redisToken)}`);
  console.log(`  Keys: ${fullGemKey}, ${fullBaselinesKey}`);
  console.log(`  TTL:          ${TTL_SECONDS}s (7 days)`);
  console.log();

  const t0 = Date.now();

  // ── 1. GEM Risk Indicators (IFC_GEM) ──
  console.log('── GEM Risk Indicators (IFC_GEM) ──');
  const gemData = {};
  for (const { key, id } of GEM_INDICATORS) {
    gemData[key] = await fetchData360Indicator('IFC_GEM', id);
  }

  // ── 2. GEM Extra Indicators ──
  console.log('\n── GEM Extra Indicators (IFC_GEM) ──');
  const extraData = {};
  for (const { key, id } of GEM_EXTRA_INDICATORS) {
    extraData[key] = await fetchData360Indicator('IFC_GEM', id);
  }

  const gemScores = computeGEMScores(gemData, extraData);
  console.log(`\n  → ${gemScores.length} countries with GEM composite scores`);

  if (gemScores.length > 0) {
    const top10 = gemScores.slice(0, 10);
    console.log(`  Top 10 (safest):    ${top10.map(s => `${s.countryName}(${s.compositeScore})`).join(', ')}`);
    const bottom10 = gemScores.slice(-10).reverse();
    console.log(`  Bottom 10 (riskiest): ${bottom10.map(s => `${s.countryName}(${s.compositeScore})`).join(', ')}`);
  }

  // Risk classification counts
  const riskCounts = {};
  for (const s of gemScores) {
    riskCounts[s.riskClassification] = (riskCounts[s.riskClassification] || 0) + 1;
  }
  console.log(`  Risk classifications: ${Object.entries(riskCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  const fetchElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll data fetched in ${fetchElapsed}s`);

  // Validate
  if (gemScores.length === 0) {
    console.error('No GEM scores computed — aborting.');
    process.exit(1);
  }

  // ── 3. Build gemBaselines for bootstrap hydration ──
  const gemBaselines = gemScores.map(s => ({
    countryCode: s.countryCode,
    countryName: s.countryName,
    compositeScore: s.compositeScore,
    rank: s.rank,
    riskClassification: s.riskClassification,
    avgRiskScore: s.avgRiskScore,
    components: s.components,
    riskComponents: s.riskComponents,
    politicalCombinedSafety: s.politicalCombinedSafety,
    politicalCompositeRisk: s.politicalCompositeRisk,
    politicalCompositeSafety: s.politicalCompositeSafety,
    source: 'gem',
  }));

  console.log(`  → ${gemBaselines.length} countries in gemBaselines`);

  // ── 4. Write to Redis ──
  const pipeline = [
    ['SET', fullGemKey, JSON.stringify(gemScores), 'EX', String(TTL_SECONDS)],
    ['SET', `seed-meta:${GEM_KEY}`, JSON.stringify({
      fetchedAt: Date.now(),
      recordCount: gemScores.length,
      indicators: GEM_INDICATORS.map(i => i.id),
      source: 'data360-gem',
    }), 'EX', String(TTL_SECONDS + 3600)],
  ];

  pipeline.push(
    ['SET', fullBaselinesKey, JSON.stringify(gemBaselines), 'EX', String(TTL_SECONDS)],
    ['SET', `seed-meta:${GEM_BASELINES_KEY}`, JSON.stringify({
      fetchedAt: Date.now(),
      recordCount: gemBaselines.length,
      source: 'data360-gem',
    }), 'EX', String(TTL_SECONDS + 3600)],
  );

  console.log(`\nWriting ${pipeline.length} keys to Redis...`);
  await redisPipeline(redisUrl, redisToken, pipeline);

  // ── 5. Verify ──
  console.log('Verifying...');
  const verifyResp = await redisPipeline(redisUrl, redisToken, [
    ['GET', fullGemKey],
    ['GET', fullBaselinesKey],
  ]);

  const parsedGem = verifyResp[0]?.result ? JSON.parse(verifyResp[0].result) : null;
  if (!Array.isArray(parsedGem) || parsedGem.length === 0) {
    throw new Error('Verification failed: GEM key missing or empty');
  }
  console.log(`  ✓ gemScores: ${parsedGem.length} country scores`);

  const parsedBaselines = verifyResp[1]?.result ? JSON.parse(verifyResp[1].result) : null;
  if (!Array.isArray(parsedBaselines) || parsedBaselines.length === 0) {
    throw new Error('Verification failed: gemBaselines key missing or empty');
  }
  console.log(`  ✓ gemBaselines: ${parsedBaselines.length} country records`);

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== Done in ${total}s ===`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exitCode = 1;
});