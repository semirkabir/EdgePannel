#!/usr/bin/env node
/**
 * Seed script: WGI Governance Baselines + Economic Vulnerability → Redis
 *
 * Fetches 6 WGI governance indicators (GOV_WGI_*.SC — percentile scores 0-100)
 * for all countries, computes a governance index and inverse baseline risk.
 * Also fetches poverty, GDP/capita, and debt data for economic vulnerability scoring.
 *
 * Stores results for bootstrap hydration.
 *
 * Usage:
 *   node scripts/seed-wb-governance.mjs [--env production|preview|development] [--sha <sha>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GOVERNANCE_KEY = 'economic:worldbank-governance:v1';
const VULNERABILITY_KEY = 'economic:worldbank-economic-vulnerability:v1';
const TTL_SECONDS = 7 * 24 * 3600; // 7 days
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

const WGI_INDICATORS = [
  { key: 'controlOfCorruption', id: 'GOV_WGI_CC.SC', weight: 0.20 },
  { key: 'governmentEffectiveness', id: 'GOV_WGI_GE.SC', weight: 0.20 },
  { key: 'politicalStability', id: 'GOV_WGI_PV.SC', weight: 0.30 },
  { key: 'ruleOfLaw', id: 'GOV_WGI_RL.SC', weight: 0.15 },
  { key: 'regulatoryQuality', id: 'GOV_WGI_RQ.SC', weight: 0.10 },
  { key: 'voiceAndAccountability', id: 'GOV_WGI_VA.SC', weight: 0.05 },
];

const VULNERABILITY_INDICATORS = [
  { key: 'povertyRate', id: 'SI.POV.DDAY', weight: 0.35 },
  { key: 'gdpPerCapita', id: 'NY.GDP.PCAP.CD', weight: 0.35 },
  { key: 'debtToGdp', id: 'GC.DOD.TOTL.GD.ZS', weight: 0.30 },
];

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

// ---------------------------------------------------------------------------
// WGI fetch + governance scoring
// ---------------------------------------------------------------------------

async function fetchWgiIndicator(indicatorId) {
  const currentYear = new Date().getFullYear();
  const dateRange = `${currentYear - 4}:${currentYear}`;
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicatorId}?format=json&date=${dateRange}&per_page=5000&source=3`;
  console.log(`  Fetching ${indicatorId} (${dateRange})...`);
  const raw = await fetchWithRetry(url);

  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) {
    console.warn(`    → No data for ${indicatorId}`);
    return {};
  }

  const latestByCountry = {};
  for (const entry of raw[1]) {
    if (entry.value === null || entry.value === undefined) continue;
    const iso3 = entry.countryiso3code;
    if (!iso3 || iso3.length !== 3) continue;
    const year = parseInt(entry.date, 10);
    if (!latestByCountry[iso3] || year > latestByCountry[iso3].year) {
      latestByCountry[iso3] = {
        value: entry.value,
        name: entry.country?.value || iso3,
        year,
      };
    }
  }

  const count = Object.keys(latestByCountry).length;
  console.log(`    → ${count} countries`);
  return latestByCountry;
}

function computeGovernanceScores(indicatorData) {
  const scores = [];

  for (const [iso3, indicators] of Object.entries(indicatorData)) {
    let weightedSum = 0;
    let totalWeight = 0;
    const components = {};

    for (const { key, weight } of WGI_INDICATORS) {
      const entry = indicators[key];
      if (!entry || entry.value == null) continue;
      weightedSum += entry.value * weight;
      totalWeight += weight;
      components[key] = entry.value;
    }

    if (totalWeight === 0) continue;

    const governanceIndex = Math.round((weightedSum / totalWeight) * 10) / 10;
    const baselineRisk = Math.round(100 - governanceIndex);
    const name = Object.values(indicators).find(e => e?.name)?.name || iso3;

    scores.push({
      countryCode: iso3,
      countryName: name,
      governanceIndex,
      baselineRisk,
      components,
    });
  }

  scores.sort((a, b) => b.governanceIndex - a.governanceIndex);
  return scores;
}

// ---------------------------------------------------------------------------
// Economic vulnerability scoring
// ---------------------------------------------------------------------------

async function fetchWbIndicator(indicatorId) {
  const currentYear = new Date().getFullYear();
  const dateRange = `${currentYear - 4}:${currentYear}`;
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicatorId}?format=json&date=${dateRange}&per_page=5000`;
  console.log(`  Fetching ${indicatorId} (${dateRange})...`);
  const raw = await fetchWithRetry(url);

  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) {
    console.warn(`    → No data for ${indicatorId}`);
    return {};
  }

  const latestByCountry = {};
  for (const entry of raw[1]) {
    if (entry.value === null || entry.value === undefined) continue;
    const iso3 = entry.countryiso3code;
    if (!iso3 || iso3.length !== 3) continue;
    const year = parseInt(entry.date, 10);
    if (!latestByCountry[iso3] || year > latestByCountry[iso3].year) {
      latestByCountry[iso3] = {
        value: entry.value,
        name: entry.country?.value || iso3,
        year,
      };
    }
  }

  const count = Object.keys(latestByCountry).length;
  console.log(`    → ${count} countries`);
  return latestByCountry;
}

function computeEconomicVulnerability(indicatorData) {
  const scores = [];

  for (const [iso3, indicators] of Object.entries(indicatorData)) {
    const poverty = indicators.povertyRate?.value ?? null;
    const gdpPc = indicators.gdpPerCapita?.value ?? null;
    const debt = indicators.debtToGdp?.value ?? null;

    let score = 0;
    let weight = 0;

    if (poverty != null) {
      score += Math.min(100, poverty) * 0.35;
      weight += 0.35;
    }
    if (gdpPc != null) {
      score += (1 - Math.min(1, gdpPc / 80000)) * 100 * 0.35;
      weight += 0.35;
    }
    if (debt != null) {
      score += Math.min(100, debt / 2) * 0.30;
      weight += 0.30;
    }

    if (weight === 0) continue;

    const economicScore = Math.round((score / weight) * 10) / 10;
    const name = Object.values(indicators).find(e => e?.name)?.name || iso3;

    scores.push({
      countryCode: iso3,
      countryName: name,
      economicScore,
      components: { povertyRate: poverty, gdpPerCapita: gdpPc, debtToGdp: debt },
    });
  }

  scores.sort((a, b) => b.economicScore - a.economicScore);
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

  const fullGovKey = `${prefix}${GOVERNANCE_KEY}`;
  const fullVulnKey = `${prefix}${VULNERABILITY_KEY}`;

  console.log('=== WGI Governance + Economic Vulnerability Seed ===');
  console.log(`  Environment:  ${env}`);
  console.log(`  Prefix:       ${prefix || '(none — production)'}`);
  console.log(`  Redis URL:    ${redisUrl}`);
  console.log(`  Redis Token:  ${maskToken(redisToken)}`);
  console.log(`  Keys: ${fullGovKey}, ${fullVulnKey}`);
  console.log(`  TTL:          ${TTL_SECONDS}s (7 days)`);
  console.log();

  const t0 = Date.now();

  // ── 1. WGI Governance ──
  console.log('── WGI Governance Indicators ──');
  const governanceData = {};
  for (const { key, id } of WGI_INDICATORS) {
    governanceData[key] = await fetchWgiIndicator(id);
  }

  const governanceScores = computeGovernanceScores(governanceData);
  console.log(`  → ${governanceScores.length} countries with governance scores`);
  const top10 = governanceScores.slice(0, 10);
  console.log(`  Top 10: ${top10.map(s => `${s.countryName}(${s.governanceIndex})`).join(', ')}`);
  console.log(`  Bottom 10: ${governanceScores.slice(-10).reverse().map(s => `${s.countryName}(${s.governanceIndex})`).join(', ')}`);

  // ── 2. Economic Vulnerability ──
  console.log('\n── Economic Vulnerability Indicators ──');
  const vulnData = {};
  for (const { key, id } of VULNERABILITY_INDICATORS) {
    vulnData[key] = await fetchWbIndicator(id);
  }

  const vulnerabilityScores = computeEconomicVulnerability(vulnData);
  console.log(`  → ${vulnerabilityScores.length} countries with vulnerability scores`);

  const fetchElapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll data fetched in ${fetchElapsed}s`);

  // Validate
  if (governanceScores.length === 0) {
    console.error('No governance scores computed — aborting.');
    process.exit(1);
  }

  // Write to Redis
  const pipeline = [
    ['SET', fullGovKey, JSON.stringify(governanceScores), 'EX', String(TTL_SECONDS)],
    ['SET', `seed-meta:${GOVERNANCE_KEY}`, JSON.stringify({ fetchedAt: Date.now(), recordCount: governanceScores.length }), 'EX', String(TTL_SECONDS + 3600)],
  ];

  if (vulnerabilityScores.length > 0) {
    pipeline.push(['SET', fullVulnKey, JSON.stringify(vulnerabilityScores), 'EX', String(TTL_SECONDS)]);
    pipeline.push(['SET', `seed-meta:${VULNERABILITY_KEY}`, JSON.stringify({ fetchedAt: Date.now(), recordCount: vulnerabilityScores.length }), 'EX', String(TTL_SECONDS + 3600)]);
  }

  console.log(`\nWriting ${pipeline.length} keys to Redis...`);
  await redisPipeline(redisUrl, redisToken, pipeline);

  // Verify
  console.log('Verifying...');
  const verifyResp = await redisPipeline(redisUrl, redisToken, [
    ['GET', fullGovKey],
    ['GET', fullVulnKey],
  ]);

  const parsedGov = verifyResp[0]?.result ? JSON.parse(verifyResp[0].result) : null;
  if (!Array.isArray(parsedGov) || parsedGov.length === 0) {
    throw new Error('Verification failed: governance key missing or empty');
  }
  console.log(`  ✓ governanceBaselines: ${parsedGov.length} country scores`);

  if (verifyResp[1]?.result) {
    const v = JSON.parse(verifyResp[1].result);
    console.log(`  ✓ economicVulnerability: ${v.length} country scores`);
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== Done in ${total}s ===`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message || err);
  process.exit(0);
});