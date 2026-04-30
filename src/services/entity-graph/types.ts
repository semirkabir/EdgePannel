import type { PopupType } from '@/components/MapPopup';

export type EntityGraphSource = 'gleif' | 'sec-edgar' | 'worldmonitor';
export type EntityGraphNodeKind = 'legal-entity' | 'sec-filer' | 'security' | 'unknown';

export interface EntityGraphRequest {
  type: PopupType;
  data: unknown;
}

export interface EntityGraphIdentifier {
  label: string;
  value: string;
  source: EntityGraphSource;
  url?: string;
}

export interface EntityGraphNode {
  id: string;
  label: string;
  kind: EntityGraphNodeKind;
  source: EntityGraphSource;
  lei?: string;
  cik?: string;
  ticker?: string;
  jurisdiction?: string;
  country?: string;
  status?: string;
  url?: string;
}

export interface EntityGraphEdge {
  source: string;
  target: string;
  label: string;
  sourceSystem: EntityGraphSource;
  status?: string;
}

export interface EntityGraphSecFiling {
  filingType: string;
  filedAt: string;
  url: string;
}

export interface EntityGraphEnrichment {
  entityLabel: string;
  identifiers: EntityGraphIdentifier[];
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
  recentFilings: EntityGraphSecFiling[];
  sources: EntityGraphSource[];
  updatedAt: string;
  stale: boolean;
  notes: string[];
}
