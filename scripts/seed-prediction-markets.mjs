#!/usr/bin/env node

import { loadEnvFile, CHROME_UA, sleep, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const CANONICAL_KEY = 'prediction:markets-bootstrap:v1';
const CACHE_TTL = 900; // 15 min — matches client poll interval

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const FETCH_TIMEOUT = 10_000;
const TAG_DELAY_MS = 300;

const GEOPOLITICAL_TAGS = [
  'politics', 'geopolitics', 'elections', 'world',
  'ukraine', 'china', 'middle-east', 'europe',
  'economy', 'fed', 'inflation',
];

const TECH_TAGS = [
  'ai', 'tech', 'crypto', 'science',
  'business', 'economy',
];

const EXCLUDE_KEYWORDS = [
  'nba', 'nfl', 'mlb', 'nhl', 'fifa', 'world cup', 'super bowl', 'championship',
  'playoffs', 'oscar', 'grammy', 'emmy', 'box office', 'movie', 'album', 'song',
  'streamer', 'influencer', 'celebrity', 'kardashian',
  'bachelor', 'reality tv', 'mvp', 'touchdown', 'home run', 'goal scorer',
  'academy award', 'bafta', 'golden globe', 'cannes', 'sundance',
  'documentary', 'feature film', 'tv series', 'season finale',
  'tweet', 'tweets', 'what will', 'will elon musk post', 'gta vi',
];

function isExcluded(title) {
  const lower = title.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
}

function parseYesPrice(market) {
  try {
    const prices = JSON.parse(market.outcomePrices || '[]');
    if (prices.length >= 1) {
      const p = parseFloat(prices[0]);
      if (!isNaN(p)) return +(p * 100).toFixed(1);
    }
  } catch {}
  return 50;
}

function isExpired(endDate) {
  if (!endDate) return false;
  const ms = Date.parse(endDate);
  return Number.isFinite(ms) && ms < Date.now();
}

function relevanceScore(market, variant) {
  const tags = market.tags ?? [];
  const haystack = `${market.title} ${tags.join(' ')}`;
  let score = 0;
  if (variant === 'tech') {
    if (/ai|openai|gpt|model|chip|semiconductor|nvidia|apple|microsoft|google|tesla|crypto|bitcoin|ethereum|tech|acquired/i.test(haystack)) score = 1;
    if (tags.some(t => TECH_TAGS.includes(t))) score = Math.max(score, 0.7);
  } else {
    if (/iran|israel|gaza|hamas|syria|ukraine|russia|china|taiwan|venezuela|nato|ceasefire|peace|sanction|military|war|invasion|strike|nuclear|missile/i.test(haystack)) score = 1;
    if (/election|president|prime minister|parliament|congress|senate|fed decision|rate cuts?|inflation|tariff|cpi|recession|oil|opec/i.test(haystack)) score = Math.max(score, 0.82);
    if (tags.some(t => GEOPOLITICAL_TAGS.includes(t))) score = Math.max(score, 0.68);
  }
  return score;
}

function rankMarkets(markets, variant, limit) {
  const maxVolume = Math.max(1, ...markets.map(m => m.volume ?? 0));
  return markets
    .filter(m => !isExpired(m.endDate) && !isExcluded(m.title))
    .map(m => ({ market: m, relevance: relevanceScore(m, variant) }))
    .filter(item => item.relevance > 0 || (item.market.volume ?? 0) >= 5_000_000)
    .sort((a, b) => {
      const score = (item) => {
        const volumeScore = Math.log1p(item.market.volume ?? 0) / Math.log1p(maxVolume);
        const conviction = Math.abs((item.market.yesPrice ?? 50) - 50) / 50;
        return item.relevance * 0.58 + volumeScore * 0.34 + conviction * 0.08;
      };
      return score(b) - score(a) || (b.market.volume ?? 0) - (a.market.volume ?? 0);
    })
    .slice(0, limit)
    .map(item => item.market);
}

async function fetchEventsByTag(tag, limit = 20) {
  const params = new URLSearchParams({
    tag_slug: tag,
    closed: 'false',
    active: 'true',
    archived: 'false',
    end_date_min: new Date().toISOString(),
    order: 'volume',
    ascending: 'false',
    limit: String(limit),
  });

  const resp = await fetch(`${GAMMA_BASE}/events?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!resp.ok) {
    console.warn(`  [${tag}] HTTP ${resp.status}`);
    return [];
  }
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

async function fetchAllPredictions() {
  const allTags = [...new Set([...GEOPOLITICAL_TAGS, ...TECH_TAGS])];
  const seen = new Set();
  const markets = [];

  for (const tag of allTags) {
    try {
      const events = await fetchEventsByTag(tag, 20);
      console.log(`  [${tag}] ${events.length} events`);

      for (const event of events) {
        if (event.closed || seen.has(event.id)) continue;
        seen.add(event.id);
        if (isExcluded(event.title)) continue;

        const eventVolume = event.volume ?? 0;
        if (eventVolume < 1000) continue;

        if (event.markets?.length > 0) {
          const active = event.markets.filter(m => !m.closed && !isExpired(m.endDate));
          if (active.length === 0) continue;

          const topMarket = active.reduce((best, m) => {
            const vol = m.volumeNum ?? (m.volume ? parseFloat(m.volume) : 0);
            const bestVol = best.volumeNum ?? (best.volume ? parseFloat(best.volume) : 0);
            return vol > bestVol ? m : best;
          });

          markets.push({
            title: topMarket.question || event.title,
            yesPrice: parseYesPrice(topMarket),
            volume: eventVolume,
            url: `https://polymarket.com/event/${event.slug}`,
            endDate: topMarket.endDate ?? event.endDate ?? undefined,
            tags: (event.tags ?? []).map(t => t.slug),
          });
        } else {
          markets.push({
            title: event.title,
            yesPrice: 50,
            volume: eventVolume,
            url: `https://polymarket.com/event/${event.slug}`,
            endDate: event.endDate ?? undefined,
            tags: (event.tags ?? []).map(t => t.slug),
          });
        }
      }
    } catch (err) {
      console.warn(`  [${tag}] error: ${err.message}`);
    }
    await sleep(TAG_DELAY_MS);
  }

  const geopolitical = rankMarkets(markets, 'geopolitical', 75);
  const tech = rankMarkets(
    markets.filter(m => m.tags?.some(t => TECH_TAGS.includes(t)) || relevanceScore(m, 'tech') > 0),
    'tech',
    75,
  );

  return {
    geopolitical,
    tech,
    fetchedAt: Date.now(),
  };
}

await runSeed('prediction', 'markets', CANONICAL_KEY, fetchAllPredictions, {
  ttlSeconds: CACHE_TTL,
  lockTtlMs: 60_000,
  validateFn: (data) => (data?.geopolitical?.length > 0 || data?.tech?.length > 0),
});
