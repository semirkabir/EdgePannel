import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPredictionGeotag,
  spreadGeotag,
} from '../src/services/prediction/geotagging';
import {
  eventToGroupedPredictionMarket,
  fetchGeoTaggedMarketsWithCache,
} from '../src/services/prediction/country-fetcher';
import type { GeoPredictionMarket, PolymarketEvent } from '../src/services/prediction/types';

const STORAGE_KEY = 'worldmonitor-persistent-cache:prediction:geo-markets:v2';

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mock,
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  };
}

describe('prediction geotag extraction', () => {
  it('maps an invasion target to the target country', () => {
    const tag = extractPredictionGeotag('Will China invade Taiwan?');
    assert.equal(tag?.country, 'Taiwan');
    assert.equal(tag?.extractedFrom, 'context');
  });

  it('maps a meeting market to the meeting location', () => {
    const tag = extractPredictionGeotag('Putin and Zelenskyy meet in Qatar');
    assert.equal(tag?.country, 'Qatar');
    assert.equal(tag?.extractedFrom, 'pattern');
  });

  it('maps country election markets', () => {
    const tag = extractPredictionGeotag('France election: will Macron party win?');
    assert.equal(tag?.country, 'France');
  });

  it('maps sports markets to a team city when recognized', () => {
    const tag = extractPredictionGeotag('Ravens vs Bengals: Ravens to win?');
    assert.equal(tag?.city, 'Baltimore');
    assert.equal(tag?.country, 'United States');
    assert.equal(tag?.extractedFrom, 'sports');
  });

  it('does not geotag crypto-only markets', () => {
    const tag = extractPredictionGeotag('Will Bitcoin hit $150k this year?');
    assert.equal(tag, null);
  });

  it('disambiguates Georgia state and Georgia country by context', () => {
    const stateTag = extractPredictionGeotag('Georgia election: Republican margin?');
    assert.equal(stateTag?.country, 'United States');
    assert.equal(stateTag?.region, 'Georgia');

    const countryTag = extractPredictionGeotag('Georgia election after Tbilisi protests');
    assert.equal(countryTag?.country, 'Georgia');
  });

  it('spreads country-level markets deterministically', () => {
    const tag = extractPredictionGeotag('France election result')!;
    const first = spreadGeotag(tag, 'event-123');
    const second = spreadGeotag(tag, 'event-123');
    assert.deepEqual(first, second);
  });
});

describe('prediction event grouping and geotag cache', () => {
  let restoreStorage: () => void;

  beforeEach(() => {
    restoreStorage = installLocalStorageMock();
  });

  afterEach(() => {
    restoreStorage();
  });

  it('groups multiple markets in one event and aggregates volume', () => {
    const event: PolymarketEvent = {
      id: 'event-president-1',
      slug: 'us-president-2028',
      title: 'Who will win the 2028 US presidential election?',
      volume: 25,
      liquidity: 10,
      markets: [
        { question: 'Will Candidate A win the 2028 US presidential election?', slug: 'candidate-a', outcomePrices: '["0.40","0.60"]', volumeNum: 100, liquidityNum: 12 },
        { question: 'Will Candidate B win the 2028 US presidential election?', slug: 'candidate-b', outcomePrices: '["0.30","0.70"]', volumeNum: 200, liquidityNum: 18 },
      ],
    };

    const grouped = eventToGroupedPredictionMarket(event);
    assert.equal(grouped?.eventId, 'event-president-1');
    assert.equal(grouped?.marketCount, 2);
    assert.equal(grouped?.volume, 300);
    assert.equal(grouped?.yesPrice, 30);
    assert.equal(grouped?.markets?.length, 2);
  });

  it('writes fresh geotag results to persistent cache', async () => {
    const data: GeoPredictionMarket[] = [{
      title: 'France election',
      yesPrice: 55,
      volume: 100,
      eventSlug: 'france-election',
      country: 'France',
      lat: 46,
      lon: 2,
    }];

    const result = await fetchGeoTaggedMarketsWithCache(async () => data);
    assert.deepEqual(result, data);
    const raw = localStorage.getItem(STORAGE_KEY);
    assert.ok(raw);
    assert.deepEqual(JSON.parse(raw).data, data);
  });

  it('returns stale geotag cache when refresh fails', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    const stale: GeoPredictionMarket[] = [{
      title: 'Taiwan security market',
      yesPrice: 48,
      volume: 50,
      eventSlug: 'taiwan-security',
      country: 'Taiwan',
      lat: 23,
      lon: 121,
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      key: 'prediction:geo-markets:v2',
      updatedAt: Date.now() - 30 * 60 * 1000,
      data: stale,
    }));

    try {
      const result = await fetchGeoTaggedMarketsWithCache(async () => {
        throw new Error('network down');
      });

      assert.deepEqual(result, stale);
    } finally {
      console.warn = originalWarn;
    }
  });
});
