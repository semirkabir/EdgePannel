// ============================================================================
// OPENFEC — Campaign Finance API Wrapper
// ============================================================================
// Uses the FEC OpenFEC API (https://api.open.fec.gov/developers/)
// No API key required for read-only endpoints.
// Rate limit: ~30 requests/minute (anonymous tier).
// ============================================================================

import type { Candidate, Donor, FundingSummary } from '@/types/elections';
import { createCircuitBreaker } from '@/utils/circuit-breaker';

const OPENFEC_BASE = 'https://api.open.fec.gov/v1';
const OPENFEC_TIMEOUT = 15_000;
const OPENFEC_PER_PAGE = 20;

// ── Rate-limit tracking ──────────────────────────────────────────────────
let openfecBackoffUntil = 0;
let openfecConsecutive429s = 0;
const OPENFEC_MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 min cap

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function openfecFetch<T>(endpoint: string, params: Record<string, string | number>): Promise<T | null> {
  // Respect backoff window
  if (Date.now() < openfecBackoffUntil) {
    const remaining = openfecBackoffUntil - Date.now();
    console.log(`[OpenFEC] In backoff, waiting ${Math.round(remaining / 1000)}s`);
    await sleep(Math.min(remaining, 5000)); // wait up to 5s, then proceed
  }

  const searchParams = new URLSearchParams();
  searchParams.set('api_key', 'WEB9ENPKO3S7R6YJ'); // Public demo key (rate-limited)
  searchParams.set('per_page', String(OPENFEC_PER_PAGE));
  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  const url = `${OPENFEC_BASE}${endpoint}?${searchParams.toString()}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(OPENFEC_TIMEOUT),
    });

    if (resp.status === 429) {
      openfecConsecutive429s++;
      const retryAfter = resp.headers.get('Retry-After');
      const delayMs = retryAfter
        ? Math.min(parseInt(retryAfter, 10) * 1000, OPENFEC_MAX_BACKOFF_MS)
        : Math.min(2 ** openfecConsecutive429s * 1000, OPENFEC_MAX_BACKOFF_MS);
      openfecBackoffUntil = Date.now() + delayMs;
      console.warn(`[OpenFEC] Rate limited (429) — backing off for ${Math.round(delayMs / 1000)}s`);
      return null;
    }

    openfecConsecutive429s = 0;

    if (!resp.ok) {
      console.warn(`[OpenFEC] ${endpoint} returned ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    return data as T;
  } catch (error) {
    console.warn(`[OpenFEC] ${endpoint} fetch failed:`, error);
    return null;
  }
}

// ── Circuit breaker ──────────────────────────────────────────────────────
const cb = createCircuitBreaker({
  name: 'OpenFEC',
  maxFailures: 3,
  cooldownMs: 60_000,
  cacheTtlMs: 0,
});

async function openfecWithCircuitBreaker<T>(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  return cb.execute<T | null>(() => openfecFetch<T>(endpoint, params), null);
}

// ── API response types ───────────────────────────────────────────────────

interface OpenFecCandidateResponse {
  results: Array<{
    candidate_id: string;
    name: string;
    party_full: string;
    office: string;
    office_state: string;
    office_district?: string | null;
    incumbent: boolean;
    election_years: number[];
    candidate_status: string;
  }>;
  pagination: { count: number; pages: number };
}

interface OpenFecCandidateTotalResponse {
  results: Array<{
    candidate_id: string;
    name: string;
    party_full: string;
    office: string;
    office_state: string;
    office_district?: string | null;
    total_receipts: number | null;
    total_disbursements: number | null;
    cash_on_hand_beginning_period: number | null;
    cash_on_hand_end_period: number | null;
    debts_owed: number | null;
    last_report_type: string;
    last_report_date: string | null;
  }>;
  pagination: { count: number; pages: number };
}

interface OpenFecScheduleAResponse {
  results: Array<{
    contributor_name: string;
    contribution_receipt_amount: number;
    receipt_date: string;
    entity_type: string;
    committee_id: string;
  }>;
  pagination: { count: number; pages: number };
}

interface OpenFecCommitteeResponse {
  results: Array<{
    committee_id: string;
    name: string;
    designation: string;
    organization_type?: string | null;
    party: string;
  }>;
  pagination: { count: number; pages: number };
}

// ── Party name normalization ─────────────────────────────────────────────

const PARTY_MAP: Record<string, string> = {
  DEMOCRATIC: 'Democratic',
  'DEMOCRATIC PARTY': 'Democratic',
  REPUBLICAN: 'Republican',
  'REPUBLICAN PARTY': 'Republican',
  INDEPENDENT: 'Independent',
  GREEN: 'Green',
  LIBERTARIAN: 'Libertarian',
  'LIBERTARIAN PARTY': 'Libertarian',
  CONSERVATIVE: 'Conservative',
  'CONSERVATIVE PARTY': 'Conservative',
  'CONSTITUTION': 'Constitution',
  REFORM: 'Reform',
  SOCIALIST: 'Socialist',
  'WORKING FAMILIES': 'Working Families',
};

function normalizeParty(raw: string): string {
  return PARTY_MAP[raw.toUpperCase()] ?? raw;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Search for candidates by name.
 * Returns basic candidate info (no financial data).
 */
export async function searchCandidates(name: string, cycle?: number): Promise<Candidate[]> {
  const params: Record<string, string | number> = { name };
  if (cycle) params.cycle = cycle;

  const data = await openfecWithCircuitBreaker<OpenFecCandidateResponse>('/candidates/', params);
  if (!data?.results?.length) return [];

  return data.results.map(c => ({
    id: c.candidate_id,
    name: c.name,
    party: normalizeParty(c.party_full),
    partyColor: getPartyColor(normalizeParty(c.party_full)),
    incumbency: c.incumbent,
  }));
}

/**
 * Get candidate financial totals for a given cycle.
 * Returns total receipts, disbursements, and cash on hand.
 */
export async function getCandidateTotals(
  candidateId: string,
  cycle: number,
): Promise<{ totalReceipts: number; totalDisbursements: number; cashOnHand: number } | null> {
  const data = await openfecWithCircuitBreaker<OpenFecCandidateTotalResponse>(
    '/candidates/totals/',
    { candidate_id: candidateId, cycle },
  );
  if (!data?.results?.length) return null;

  const [r] = data.results;
  if (!r) return null;
  return {
    totalReceipts: r.total_receipts ?? 0,
    totalDisbursements: r.total_disbursements ?? 0,
    cashOnHand: r.cash_on_hand_end_period ?? 0,
  };
}

/**
 * Get top individual contributors (Schedule A) for a candidate.
 * Aggregates by contributor name and returns top N.
 */
export async function getTopDonors(
  candidateId: string,
  cycle: number,
  limit = 5,
): Promise<Donor[]> {
  const data = await openfecWithCircuitBreaker<OpenFecScheduleAResponse>(
    '/schedules/schedule_a/by_contributor/',
    { candidate_id: candidateId, cycle, per_page: 50, sort: '-contribution_receipt_amount' },
  );
  if (!data?.results?.length) return [];

  // Aggregate by contributor name
  const aggregated = new Map<string, { total: number; type: Donor['type'] }>();
  for (const r of data.results) {
    const name = r.contributor_name || 'Unknown';
    const existing = aggregated.get(name);
    if (existing) {
      existing.total += r.contribution_receipt_amount;
    } else {
      const type: Donor['type'] = r.entity_type === 'COM' ? 'organization' : 'individual';
      aggregated.set(name, { total: r.contribution_receipt_amount, type });
    }
  }

  return Array.from(aggregated.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([name, info]) => ({ name, type: info.type, amount: info.total }));
}

/**
 * Get committee info for a candidate's principal committee.
 */
export async function getCandidateCommittees(
  candidateId: string,
): Promise<Array<{ id: string; name: string; type: string }>> {
  const data = await openfecWithCircuitBreaker<OpenFecCommitteeResponse>(
    '/committees/',
    { candidate_id: candidateId },
  );
  if (!data?.results?.length) return [];

  return data.results.map(c => ({
    id: c.committee_id,
    name: c.name,
    type: c.designation,
  }));
}

/**
 * Build a full funding summary for a candidate.
 */
export async function getCandidateFunding(
  candidateId: string,
  cycle: number,
): Promise<FundingSummary | null> {
  const [totals, donors] = await Promise.all([
    getCandidateTotals(candidateId, cycle),
    getTopDonors(candidateId, cycle),
  ]);

  if (!totals) return null;

  return {
    totalRaised: totals.totalReceipts,
    totalSpent: totals.totalDisbursements,
    cashOnHand: totals.cashOnHand,
    topDonors: donors,
  };
}

// ── Party color mapping ──────────────────────────────────────────────────

const PARTY_COLORS: Record<string, string> = {
  Democratic: '#3b82f6',
  Republican: '#ef4444',
  Independent: '#a855f7',
  Green: '#22c55e',
  Libertarian: '#f59e0b',
  Conservative: '#2563eb',
  Constitution: '#6b7280',
  Reform: '#06b6d4',
  Socialist: '#dc2626',
  'Working Families': '#8b5cf6',
};

export function getPartyColor(party: string): string {
  return PARTY_COLORS[party] ?? '#6b7280';
}
