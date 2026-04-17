#!/usr/bin/env node

import { loadEnvFile, sleep, runSeed, parseYahooChart, writeExtraKey } from './_seed-utils.mjs';
import { fetchYahooJson } from './_yahoo-fetch.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'market:commodities-bootstrap:v1';
const CACHE_TTL = 1800;
const YAHOO_DELAY_MS = 200;

const COMMODITY_SYMBOLS = ['^VIX', 'GC=F', 'CL=F', 'NG=F', 'SI=F', 'HG=F'];

async function fetchCommodityQuotes() {
  const quotes = [];
  let misses = 0;

  for (let i = 0; i < COMMODITY_SYMBOLS.length; i++) {
    const symbol = COMMODITY_SYMBOLS[i];
    if (i > 0) await sleep(YAHOO_DELAY_MS);

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
      let chart;
      try {
        chart = await fetchYahooJson(url, { label: symbol });
      } catch {
        misses++;
        continue;
      }
      const parsed = parseYahooChart(chart, symbol);
      if (parsed) {
        quotes.push(parsed);
        console.log(`  ${symbol}: $${parsed.price} (${parsed.change > 0 ? '+' : ''}${parsed.change}%)`);
      } else {
        misses++;
      }
    } catch (err) {
      console.warn(`  [Yahoo] ${symbol} error: ${err.message}`);
      misses++;
    }
  }

  if (quotes.length === 0) {
    throw new Error(`All commodity fetches failed (${misses} misses)`);
  }

  return { quotes };
}

function validate(data) {
  return Array.isArray(data?.quotes) && data.quotes.length >= 1;
}

let seedData = null;

async function fetchAndStash() {
  seedData = await fetchCommodityQuotes();
  return seedData;
}

runSeed('market', 'commodities', CANONICAL_KEY, fetchAndStash, {
  validateFn: validate,
  ttlSeconds: CACHE_TTL,
  sourceVersion: 'yahoo-chart',
}).then(async (result) => {
  if (result?.skipped || !seedData) return;
  const commodityKey = `market:commodities:v1:${[...COMMODITY_SYMBOLS].sort().join(',')}`;
  const quotesKey = `market:quotes:v1:${[...COMMODITY_SYMBOLS].sort().join(',')}`;
  const quotesPayload = { ...seedData, finnhubSkipped: false, skipReason: '', rateLimited: false };
  await writeExtraKey(commodityKey, seedData, CACHE_TTL);
  await writeExtraKey(quotesKey, quotesPayload, CACHE_TTL);
}).catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
