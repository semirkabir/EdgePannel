// ============================================================================
// ELECTIONS — Types
// ============================================================================

export type ElectionLevel = 'federal' | 'state' | 'local' | 'national' | 'municipal';
export type ElectionStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ElectionType = 'general' | 'primary' | 'special' | 'referendum' | 'runoff';

export interface Election {
  id: string;
  name: string;               // "2026 California Senate"
  country: string;            // ISO 3166-1 alpha-2
  countryName: string;
  level: ElectionLevel;
  office: string;             // "Senate" | "Governor" | "House" | "Parliament"
  district?: string;          // "District 12" | "Statewide"
  type: ElectionType;
  date: string;               // ISO date
  status: ElectionStatus;
  candidates: Candidate[];
  results?: ElectionResult[];
  funding?: FundingSummary;
  description?: string;
  sourceUrl?: string;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;              // "Democratic" | "Republican" | "Labour" | etc.
  partyColor: string;         // hex color for the party
  incumbency: boolean;
  photoUrl?: string;
  bio?: string;
  policies?: Policy[];
  fundingTotal?: number;      // total raised in USD
  fundingSpent?: number;      // total spent in USD
  topDonors?: Donor[];
}

export interface Policy {
  id: string;
  category: string;           // "economy" | "healthcare" | "immigration" | "climate" | "defense" | "education" | "tax"
  position: string;           // short summary of stance
  detail?: string;            // longer explanation
}

export interface Donor {
  name: string;
  type: 'individual' | 'pac' | 'super_pac' | 'self_funded' | 'organization';
  amount: number;
}

export interface ElectionResult {
  candidateId: string;
  votes: number;
  percentage: number;
  winner: boolean;
}

export interface FundingSummary {
  totalRaised: number;
  totalSpent: number;
  cashOnHand: number;
  topDonors: Donor[];
  smallDonorPct?: number;    // percentage from donations < $200
}

// Map layer data — state/region-level results for choropleth
export interface ElectionGeoResult {
  electionId: string;
  region: string;             // state name or district
  regionCode: string;         // ISO 3166-2 or short code
  lat: number;
  lon: number;
  winner: string;             // party name
  winnerColor: string;
  results: Array<{
    party: string;
    partyColor: string;
    percentage: number;
    votes: number;
  }>;
}

// API response wrappers
export interface OpenFecCandidate {
  candidate_id: string;
  name: string;
  party_full: string;
  office: string;
  office_state: string;
  office_district?: string;
  incumbent: boolean;
  total_receipts?: number;
  total_disbursements?: number;
  cash_on_hand?: number;
}

export interface OpenFecCommittee {
  committee_id: string;
  name: string;
  designation: string;
  organization_type?: string;
  total_receipts?: number;
}
