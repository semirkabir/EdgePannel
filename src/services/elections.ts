// ============================================================================
// ELECTIONS — Data Service (Phase 2: API integration)
// ============================================================================
// Merges seed data with live API responses:
// - OpenFEC API: US federal candidate funding data
// - Google Civic Info: US election dates and polling places
// Falls back to seed data when APIs are unavailable.
// ============================================================================

import type { Election, ElectionGeoResult } from '@/types/elections';
import { SEED_ELECTIONS, SEED_ELECTION_GEO } from '@/config/elections-seed';
import { getCandidateFunding } from '@/services/openfec';
import { fetchAvailableElections, isCivicApiConfigured } from '@/services/civic-info';

// In-memory cache
let cachedElections: Election[] | null = null;
let cachedGeo: Map<string, ElectionGeoResult[]> = new Map();
let lastFetch = 0;
let apiHealth = { openFecOk: false, civicOk: false, lastCheck: 0 };

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const API_HEALTH_TTL = 30 * 60 * 1000; // 30 min between API health checks
const CURRENT_CYCLE = 2026;

/**
 * Check API availability (cached for 30 min).
 */
async function checkApiHealth(): Promise<{ openFecOk: boolean; civicOk: boolean }> {
  if (Date.now() - apiHealth.lastCheck < API_HEALTH_TTL) {
    return { openFecOk: apiHealth.openFecOk, civicOk: apiHealth.civicOk };
  }

  // OpenFEC is free and doesn't require a key — assume available
  const openFecOk = true;
  const civicOk = isCivicApiConfigured();

  apiHealth = { openFecOk, civicOk, lastCheck: Date.now() };
  return { openFecOk, civicOk };
}

/**
 * Enrich a US federal election with live OpenFEC funding data.
 * Matches seed candidates by name similarity and office.
 */
async function enrichWithOpenFec(election: Election): Promise<Election> {
  if (election.country !== 'US' || election.level !== 'federal') {
    return election; // Only US federal races have FEC data
  }

  const enriched = { ...election, candidates: election.candidates.map(c => ({ ...c })) };

  // Fetch funding for each candidate in parallel
  const fundingPromises = enriched.candidates.map(async (candidate) => {
    try {
      const funding = await getCandidateFunding(candidate.id, CURRENT_CYCLE);
      if (funding) {
        candidate.fundingTotal = funding.totalRaised;
        candidate.fundingSpent = funding.totalSpent;
        candidate.topDonors = funding.topDonors;
      }
    } catch {
      // Keep seed data as fallback
    }
    return candidate;
  });

  await Promise.allSettled(fundingPromises);
  return enriched;
}

/**
 * Fetch all elections, merging seed data with live API responses.
 * Falls back to seed-only when APIs are unavailable.
 */
export async function fetchElections(): Promise<Election[]> {
  if (cachedElections && Date.now() - lastFetch < CACHE_TTL) {
    return cachedElections;
  }

  const health = await checkApiHealth();

  // Start with seed data as baseline
  let elections = SEED_ELECTIONS.map(e => ({ ...e }));

  // Enrich US federal races with OpenFEC data
  if (health.openFecOk) {
    const usFederal = elections.filter(e => e.country === 'US' && e.level === 'federal');
    const enriched = await Promise.allSettled(usFederal.map(enrichWithOpenFec));

    enriched.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const federalEntry = usFederal[idx];
        if (!federalEntry) return;
        const federalIdx = elections.findIndex(e => e.id === federalEntry.id);
        if (federalIdx >= 0) {
          elections[federalIdx] = result.value;
        }
      }
    });
  }

  // Fetch upcoming elections from Google Civic Info (if configured)
  if (health.civicOk) {
    try {
      const civicElections = await fetchAvailableElections();
      // Merge civic election dates into matching seed elections
      for (const civic of civicElections) {
        const civicName = civic.name || '';
        if (!civicName) continue;
        const firstWord = civicName.split(' ')[0] || '';
        const match = elections.find(e =>
          e.country === 'US' &&
          e.name.toLowerCase().includes(firstWord.toLowerCase())
        );
        if (match && civic.electionDay) {
          match.date = civic.electionDay;
          match.sourceUrl = `https://www.googleapis.com/civicinfo/v2/elections/${civic.id}`;
        }
      }
    } catch {
      // Civic API failed — continue with seed + OpenFEC data
    }
  }

  cachedElections = elections;
  lastFetch = Date.now();

  return cachedElections;
}

/**
 * Fetch geo results for a specific election (for map choropleth).
 */
export async function fetchElectionGeo(electionId: string): Promise<ElectionGeoResult[]> {
  if (cachedGeo.has(electionId)) {
    return cachedGeo.get(electionId)!;
  }

  const entry = SEED_ELECTION_GEO.find(e => e.electionId === electionId);
  if (!entry) return [];

  cachedGeo.set(electionId, entry.geo);
  return entry.geo;
}

/**
 * Get elections filtered by status.
 */
export function getElectionsByStatus(status: Election['status']): Election[] {
  return (cachedElections ?? SEED_ELECTIONS).filter(e => e.status === status);
}

/**
 * Get elections filtered by country.
 */
export function getElectionsByCountry(country: string): Election[] {
  return (cachedElections ?? SEED_ELECTIONS).filter(e => e.country === country);
}

/**
 * Get a single election by ID.
 */
export function getElectionById(id: string): Election | undefined {
  return (cachedElections ?? SEED_ELECTIONS).find(e => e.id === id);
}

/**
 * Clear the cache (useful for testing or manual refresh).
 */
export function clearElectionsCache(): void {
  cachedElections = null;
  cachedGeo.clear();
  lastFetch = 0;
}

/**
 * Format currency for display.
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

/**
 * Format vote count for display.
 */
export function formatVotes(votes: number): string {
  if (votes >= 1_000_000) return `${(votes / 1_000_000).toFixed(1)}M`;
  if (votes >= 1_000) return `${(votes / 1_000).toFixed(0)}K`;
  return votes.toLocaleString();
}

/**
 * Get party abbreviation for compact display.
 */
export function partyAbbreviation(party: string): string {
  const map: Record<string, string> = {
    Democratic: 'D',
    Republican: 'R',
    Independent: 'I',
    Green: 'G',
    Libertarian: 'L',
    Labour: 'Lab',
    Conservative: 'Con',
    Liberal: 'Lib',
    AfD: 'AfD',
    SPD: 'SPD',
    'CDU/CSU': 'CDU',
    FDP: 'FDP',
    Greens: 'Grn',
    BJP: 'BJP',
    INC: 'INC',
    AAP: 'AAP',
    Other: 'Oth',
  };
  return map[party] ?? party.slice(0, 3);
}
