// ============================================================================
// GOOGLE CIVIC INFO — US Election dates, polling places, and candidate info
// ============================================================================
// Uses Google Civic Information API v2
// Docs: https://developers.google.com/civic-information
// Free tier: 25,000 queries/day
// Requires API key (set VITE_GOOGLE_CIVIC_API_KEY in .env)
// ============================================================================

const CIVIC_BASE = 'https://www.googleapis.com/civicinfo/v2';
const CIVIC_TIMEOUT = 10_000;

function getApiKey(): string | null {
  return (import.meta as any).env?.VITE_GOOGLE_CIVIC_API_KEY ?? null;
}

// ── Rate-limit backoff ───────────────────────────────────────────────────
let civicBackoffUntil = 0;
let civicConsecutive429s = 0;
const CIVIC_MAX_BACKOFF_MS = 5 * 60 * 1000;

async function civicFetch(path: string, params: Record<string, string>): Promise<Response | null> {
  if (Date.now() < civicBackoffUntil) {
    await new Promise(r => setTimeout(r, Math.min(civicBackoffUntil - Date.now(), 5000)));
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[CivicInfo] No VITE_GOOGLE_CIVIC_API_KEY configured');
    return null;
  }

  const url = new URL(`${CIVIC_BASE}${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(CIVIC_TIMEOUT) });

    if (resp.status === 429) {
      civicConsecutive429s++;
      const retryAfter = resp.headers.get('Retry-After');
      const delayMs = retryAfter
        ? Math.min(parseInt(retryAfter, 10) * 1000, CIVIC_MAX_BACKOFF_MS)
        : Math.min(2 ** civicConsecutive429s * 1000, CIVIC_MAX_BACKOFF_MS);
      civicBackoffUntil = Date.now() + delayMs;
      console.warn(`[CivicInfo] Rate limited — backing off ${Math.round(delayMs / 1000)}s`);
      return null;
    }

    civicConsecutive429s = 0;
    return resp;
  } catch (e) {
    console.warn('[CivicInfo] Fetch failed:', e);
    return null;
  }
}

// ── Election list ────────────────────────────────────────────────────────

export interface CivicElection {
  id: string;
  name: string;
  electionDay: string;    // ISO date string
  ocdDivisionId: string;
}

/**
 * Get list of all available elections from Google Civic Info API.
 */
export async function fetchAvailableElections(): Promise<CivicElection[]> {
  const resp = await civicFetch('/elections', {});
  if (!resp?.ok) return [];

  try {
    const data = await resp.json();
    return (data.elections || []).map((e: any) => ({
      id: String(e.id),
      name: e.name,
      electionDay: e.electionDay,
      ocdDivisionId: e.ocdDivisionId,
    }));
  } catch {
    return [];
  }
}

/**
 * Find the closest upcoming US federal election by name pattern.
 */
export async function findUpcomingElection(pattern: string): Promise<CivicElection | null> {
  const elections = await fetchAvailableElections();
  const lower = pattern.toLowerCase();
  return elections.find(e => e.name.toLowerCase().includes(lower)) ?? null;
}

// ── Voter info (candidates, polling places for an address) ───────────────

export interface CivicCandidate {
  name: string;
  party: string;
  office: string;
  photoUrl?: string;
  candidateUrl?: string;
  email?: string;
  phone?: string;
}

export interface CivicPollingPlace {
  name: string;
  address: string;
  pollingHours?: string;
}

export interface CivicVoterInfo {
  election: { name: string; electionDay: string };
  candidates: CivicCandidate[];
  pollingPlaces: CivicPollingPlace[];
}

/**
 * Get voter info for a US address — returns candidates, polling places, etc.
 * Requires a valid US address string (e.g. "1600 Pennsylvania Ave, Washington DC 20500").
 */
export async function fetchVoterInfo(address: string): Promise<CivicVoterInfo | null> {
  const resp = await civicFetch('/voterinfo', {
    address,
    returnAllAvailableData: 'true',
  });
  if (!resp?.ok) return null;

  try {
    const data = await resp.json();
    const election = data.election || {};
    const candidates = (data.candidates || []).map((c: any) => ({
      name: c.name,
      party: c.party || 'Unknown',
      office: c.office || '',
      photoUrl: c.photoUrl,
      candidateUrl: c.candidateUrl,
      email: c.email,
      phone: c.phone,
    }));
    const pollingPlaces = (data.pollingLocations || []).map((p: any) => ({
      name: p.address?.locationName || 'Polling Place',
      address: [
        p.address?.line1,
        p.address?.city,
        p.address?.state,
        p.address?.zip,
      ].filter(Boolean).join(', '),
      pollingHours: p.pollingHours,
    }));

    return {
      election: {
        name: election.name || '',
        electionDay: election.electionDay || '',
      },
      candidates,
      pollingPlaces,
    };
  } catch {
    return null;
  }
}

// ── Division search (geographic lookup) ──────────────────────────────────

export interface CivicDivision {
  id: string;
  name: string;
  aliases?: string[];
}

/**
 * Search for political divisions by name.
 */
export async function searchDivisions(query: string): Promise<CivicDivision[]> {
  const resp = await civicFetch('/divisions', { query });
  if (!resp?.ok) return [];

  try {
    const data = await resp.json();
    return Object.entries(data.results || {}).map(([id, info]: [string, any]) => ({
      id,
      name: info.name,
      aliases: info.aliases,
    }));
  } catch {
    return [];
  }
}

// ── Availability check ───────────────────────────────────────────────────

export function isCivicApiConfigured(): boolean {
  return !!getApiKey();
}
