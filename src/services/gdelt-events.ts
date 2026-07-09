import { log } from '@/utils/logger';

/**
 * GDELT 2.0 Event Database integration.
 *
 * Unlike gdelt-intel.ts (which uses the DOC API for article search),
 * this service queries the Event Database API for structured CAMEO-coded
 * events with actor1/actor2, event type, geo-coordinates, GoldsteinScale
 * conflict intensity, and tone.
 *
 * API: https://api.gdeltproject.org/api/v2/events/events
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface GdeltEvent {
  globalEventId: number;
  date: string;           // ISO date string parsed from SQLDATE
  sqlDate: string;        // raw YYYYMMDD
  actor1Code?: string;
  actor1Name?: string;
  actor1CountryCode?: string;
  actor2Code?: string;
  actor2Name?: string;
  actor2CountryCode?: string;
  isRootEvent: boolean;
  eventCode: string;
  eventRootCode: string;
  eventBaseCode?: string;
  eventDescription?: string;
  quadClass: GdeltQuadClass;
  quadClassName: string;
  goldsteinScale: number;   // -10 (severe conflict) to +10 (strong cooperation)
  numMentions: number;
  numSources: number;
  numArticles: number;
  avgTone: number;          // typically -10 to +10
  actionGeoType?: number;
  actionGeoFullName?: string;
  actionGeoCountryCode?: string;
  actionGeoLat?: number;
  actionGeoLong?: number;
  actor1GeoLat?: number;
  actor1GeoLong?: number;
  actor2GeoLat?: number;
  actor2GeoLong?: number;
}

export enum GdeltQuadClass {
  VerbalCooperation = 1,
  MaterialCooperation = 2,
  VerbalConflict = 3,
  MaterialConflict = 4,
}

const QUAD_CLASS_NAMES: Record<GdeltQuadClass, string> = {
  [GdeltQuadClass.VerbalCooperation]: 'Verbal Cooperation',
  [GdeltQuadClass.MaterialCooperation]: 'Material Cooperation',
  [GdeltQuadClass.VerbalConflict]: 'Verbal Conflict',
  [GdeltQuadClass.MaterialConflict]: 'Material Conflict',
};

// CAMEO event root code descriptions (20 root categories)
const CAMEO_ROOT_DESCRIPTIONS: Record<string, string> = {
  '01': 'Make public statement',
  '02': 'Appeal',
  '03': 'Express intent to cooperate',
  '04': 'Consult, meet',
  '05': 'Engage in diplomatic cooperation',
  '06': 'Engage in material cooperation',
  '07': 'Provide aid',
  '08': 'Yield, demand',
  '09': 'Investigate, examine',
  '10': 'Demand',
  '11': 'Disapprove',
  '12': 'Reject',
  '13': 'Threaten',
  '14': 'Protest',
  '15': 'Exhibit force posture',
  '16': 'Reduce relations',
  '17': 'Coerce',
  '18': 'Assault',
  '19': 'Fight',
  '20': 'Use unconventional mass violence',
};

export function getEventDescription(rootCode: string): string {
  return CAMEO_ROOT_DESCRIPTIONS[rootCode] || `Event code ${rootCode}`;
}

// ── Rate-limit tracking (same pattern as gdelt-intel.ts) ───────────────

const gdeltEventsRateLimitState = { backoffUntil: 0, consecutive429s: 0 };
const GDELT_MAX_BACKOFF_MS = 5 * 60 * 1000;

function handleRateLimit(response: Response): { shouldRetry: boolean; delayMs: number } {
  if (response.status !== 429) {
    gdeltEventsRateLimitState.consecutive429s = 0;
    return { shouldRetry: false, delayMs: 0 };
  }
  gdeltEventsRateLimitState.consecutive429s++;
  const retryAfter = response.headers.get('Retry-After');
  let delayMs: number;
  if (retryAfter) {
    delayMs = Math.min(parseInt(retryAfter, 10) * 1000, GDELT_MAX_BACKOFF_MS);
  } else {
    delayMs = Math.min(2 ** gdeltEventsRateLimitState.consecutive429s * 1000, GDELT_MAX_BACKOFF_MS);
  }
  gdeltEventsRateLimitState.backoffUntil = Date.now() + delayMs;
  console.warn(`[GDELT-Events] Rate limited (429) — backing off for ${Math.round(delayMs / 1000)}s`);
  return { shouldRetry: true, delayMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Caching ────────────────────────────────────────────────────────────

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const eventCache = new Map<string, { events: GdeltEvent[]; timestamp: number }>();

// ── Predefined queries ─────────────────────────────────────────────────

export interface GdeltEventQuery {
  id: string;
  name: string;
  query: string;
  icon: string;
  description: string;
}

export const EVENT_QUERIES: GdeltEventQuery[] = [
  {
    id: 'conflict',
    name: 'Active Conflicts',
    query: 'quadclass:4 AND goldsteinscale:<-5',
    icon: '⚔️',
    description: 'Material conflict events with high negative intensity',
  },
  {
    id: 'protests',
    name: 'Protests & Unrest',
    query: 'eventrootcode:14',
    icon: '✊',
    description: 'Protests and demonstrations worldwide',
  },
  {
    id: 'diplomatic',
    name: 'Diplomatic Activity',
    query: 'quadclass:1',
    icon: '🤝',
    description: 'Verbal cooperation — statements, appeals, diplomatic ties',
  },
  {
    id: 'military',
    name: 'Military Posturing',
    query: 'eventrootcode:15 OR eventrootcode:18 OR eventrootcode:19',
    icon: '🎖️',
    description: 'Force posture, assaults, and armed conflict',
  },
  {
    id: 'humanitarian',
    name: 'Humanitarian Aid',
    query: 'eventrootcode:07',
    icon: '🏥',
    description: 'Aid provision and humanitarian assistance',
  },
  {
    id: 'sanctions',
    name: 'Sanctions & Coercion',
    query: 'eventrootcode:16 OR eventrootcode:17',
    icon: '🚫',
    description: 'Reduced relations, coercion, and sanctions',
  },
];

// ── API call ───────────────────────────────────────────────────────────

function parseSqlDate(sqlDate: string): string {
  if (!sqlDate || sqlDate.length < 8) return '';
  const y = sqlDate.slice(0, 4);
  const m = sqlDate.slice(4, 6);
  const d = sqlDate.slice(6, 8);
  const hh = sqlDate.length >= 10 ? sqlDate.slice(8, 10) : '00';
  const mm = sqlDate.length >= 12 ? sqlDate.slice(10, 12) : '00';
  return `${y}-${m}-${d}T${hh}:${mm}:00Z`;
}

function toGdeltEvent(raw: Record<string, unknown>): GdeltEvent {
  const rootCode = String(raw.EventRootCode || '');
  const quadRaw = Number(raw.QuadClass) || 0;
  const quadClass = (quadRaw >= 1 && quadRaw <= 4 ? quadRaw : 0) as GdeltQuadClass;

  return {
    globalEventId: Number(raw.GLOBALEVENTID) || 0,
    date: parseSqlDate(String(raw.SQLDATE || '')),
    sqlDate: String(raw.SQLDATE || ''),
    actor1Code: String(raw.Actor1Code || '') || undefined,
    actor1Name: String(raw.Actor1Name || '') || undefined,
    actor1CountryCode: String(raw.Actor1CountryCode || '') || undefined,
    actor2Code: String(raw.Actor2Code || '') || undefined,
    actor2Name: String(raw.Actor2Name || '') || undefined,
    actor2CountryCode: String(raw.Actor2CountryCode || '') || undefined,
    isRootEvent: Boolean(raw.IsRootEvent),
    eventCode: String(raw.EventCode || ''),
    eventRootCode: rootCode,
    eventBaseCode: String(raw.EventBaseCode || '') || undefined,
    eventDescription: getEventDescription(rootCode),
    quadClass,
    quadClassName: quadClass ? QUAD_CLASS_NAMES[quadClass] : 'Unknown',
    goldsteinScale: Number(raw.GoldsteinScale) || 0,
    numMentions: Number(raw.NumMentions) || 0,
    numSources: Number(raw.NumSources) || 0,
    numArticles: Number(raw.NumArticles) || 0,
    avgTone: Number(raw.AvgTone) || 0,
    actionGeoType: Number(raw.ActionGeo_Type) || undefined,
    actionGeoFullName: String(raw.ActionGeo_FullName || '') || undefined,
    actionGeoCountryCode: String(raw.ActionGeo_CountryCode || '') || undefined,
    actionGeoLat: Number(raw.ActionGeo_Lat) || undefined,
    actionGeoLong: Number(raw.ActionGeo_Long) || undefined,
    actor1GeoLat: Number(raw.Actor1Geo_Lat) || undefined,
    actor1GeoLong: Number(raw.Actor1Geo_Long) || undefined,
    actor2GeoLat: Number(raw.Actor2Geo_Lat) || undefined,
    actor2GeoLong: Number(raw.Actor2Geo_Long) || undefined,
  };
}

function buildParams(query: string, maxRecords: number, timespan: string, sort: string): string {
  const p = new URLSearchParams();
  p.set('query', query);
  p.set('mode', 'EventList');
  p.set('maxrecords', String(maxRecords));
  p.set('format', 'json');
  p.set('sort', sort);
  p.set('timespan', timespan);
  return p.toString();
}

/**
 * Fetch structured events from the GDELT 2.0 Event Database.
 *
 * Multi-tier strategy mirrors gdelt-intel.ts:
 *   1. Direct browser call (CORS-supported in production)
 *   2. Vite dev proxy (/api/gdelt → api.gdeltproject.org)
 *   3. Return empty on failure
 */
export async function fetchGdeltEvents(
  query: string,
  maxRecords = 50,
  timespan = '24h',
  sort = 'DateDesc',
): Promise<GdeltEvent[]> {
  const cacheKey = `${query}:${maxRecords}:${timespan}:${sort}`;
  const cached = eventCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.events;
  }

  // Respect backoff window
  if (Date.now() < gdeltEventsRateLimitState.backoffUntil) {
    const remaining = Math.round((gdeltEventsRateLimitState.backoffUntil - Date.now()) / 1000);
    log.debug(`[GDELT-Events] In backoff window, waiting ${remaining}s`);
    await sleep(gdeltEventsRateLimitState.backoffUntil - Date.now());
  }

  const params = buildParams(query, maxRecords, timespan, sort);

  // Try 1: direct GDELT API
  try {
    const url = `https://api.gdeltproject.org/api/v2/events/events?${params}`;
    let resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const rl = handleRateLimit(resp);
    if (rl.shouldRetry && rl.delayMs < GDELT_MAX_BACKOFF_MS) {
      await sleep(rl.delayMs);
      resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    }
    if (!resp.ok) throw new Error(`GDELT Events returned ${resp.status}`);
    const text = await resp.text();
    if (!text.startsWith('{')) throw new Error(`GDELT Events returned non-JSON: ${text.slice(0, 80)}`);
    const data = JSON.parse(text);
    const events: GdeltEvent[] = (data.events || []).map((r: Record<string, unknown>) => toGdeltEvent(r));
    log.debug(`[GDELT-Events] Direct result: ${events.length} events`);
    if (events.length > 0) {
      eventCache.set(cacheKey, { events, timestamp: Date.now() });
      return events;
    }
  } catch (e) {
    console.warn('[GDELT-Events] Direct call failed:', e);
  }

  // Try 2: Vite dev proxy
  try {
    const url = `/api/gdelt/api/v2/events/events?${params}`;
    let resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const rl = handleRateLimit(resp);
    if (rl.shouldRetry && rl.delayMs < GDELT_MAX_BACKOFF_MS) {
      await sleep(rl.delayMs);
      resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    }
    if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`);
    const text = await resp.text();
    if (!text.startsWith('{')) throw new Error(`Proxy returned non-JSON: ${text.slice(0, 80)}`);
    const data = JSON.parse(text);
    const events: GdeltEvent[] = (data.events || []).map((r: Record<string, unknown>) => toGdeltEvent(r));
    log.debug(`[GDELT-Events] Proxy result: ${events.length} events`);
    if (events.length > 0) {
      eventCache.set(cacheKey, { events, timestamp: Date.now() });
      return events;
    }
  } catch (e) {
    console.warn('[GDELT-Events] Proxy call failed:', e);
  }

  return [];
}

// ── Convenience fetchers ───────────────────────────────────────────────

/** Fetch events for a predefined query category */
export async function fetchEventsByCategory(
  categoryId: string,
  maxRecords = 50,
  timespan = '24h',
): Promise<GdeltEvent[]> {
  const q = EVENT_QUERIES.find(eq => eq.id === categoryId);
  if (!q) return [];
  return fetchGdeltEvents(q.query, maxRecords, timespan, 'DateDesc');
}

/** Fetch conflict-intensity events for map layer (geolocated, high-impact) */
export async function fetchConflictEventsForMap(
  maxRecords = 100,
  timespan = '24h',
): Promise<GdeltEvent[]> {
  const events = await fetchGdeltEvents(
    'quadclass:4 AND goldsteinscale:<-3',
    maxRecords,
    timespan,
    'GoldsteinAsc',
  );
  return events.filter(e => e.actionGeoLat != null && e.actionGeoLong != null);
}

/** Fetch events for a specific country (FIPS 2-letter code) */
export async function fetchEventsByCountry(
  countryCode: string,
  maxRecords = 50,
  timespan = '7d',
): Promise<GdeltEvent[]> {
  return fetchGdeltEvents(
    `actiongeocountrycode:${countryCode}`,
    maxRecords,
    timespan,
    'DateDesc',
  );
}

/** Fetch high-mention events (trending — most media coverage) */
export async function fetchTrendingEvents(
  maxRecords = 25,
  timespan = '24h',
): Promise<GdeltEvent[]> {
  return fetchGdeltEvents(
    'isrootevent:1',
    maxRecords,
    timespan,
    'NumMentionsDesc',
  );
}

/** Search GDELT events by free-text query (for Cmd+K search) */
export async function searchGdeltEvents(
  query: string,
  maxRecords = 15,
  timespan = '7d',
): Promise<GdeltEvent[]> {
  // GDELT event query syntax supports keyword search
  return fetchGdeltEvents(query, maxRecords, timespan, 'DateDesc');
}

// ── Formatting helpers ─────────────────────────────────────────────────

export function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 0) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return '';
  }
}

export function describeQuadClass(quad: GdeltQuadClass): string {
  return QUAD_CLASS_NAMES[quad] || 'Unknown';
}

export function intensityLabel(goldstein: number): { label: string; class: string } {
  if (goldstein <= -7) return { label: 'Severe Conflict', class: 'gdelt-intensity-severe' };
  if (goldstein <= -3) return { label: 'Conflict', class: 'gdelt-intensity-conflict' };
  if (goldstein < 0) return { label: 'Tension', class: 'gdelt-intensity-tension' };
  if (goldstein < 3) return { label: 'Neutral', class: 'gdelt-intensity-neutral' };
  if (goldstein < 7) return { label: 'Cooperation', class: 'gdelt-intensity-cooperation' };
  return { label: 'Strong Cooperation', class: 'gdelt-intensity-strong' };
}
