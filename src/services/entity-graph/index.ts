import type { PopupType } from '@/components/MapPopup';
import {
  candidateNamesFromUnknown,
  fetchGleifRelationshipSnapshot,
  findBestLeiRecord,
  gleifEdges,
  gleifIdentifier,
  gleifNode,
} from './gleif';
import type { GleifLeiRecord } from './gleif';
import { fetchSecEntityContext, secCompanyNode, secIdentifiers } from './sec';
import type { EntityGraphEdge, EntityGraphEnrichment, EntityGraphIdentifier, EntityGraphNode } from './types';

const SUPPORTED_TYPES = new Set<PopupType>(['company', 'institution']);

function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function getExplicitLei(data: unknown): string {
  if (typeof data !== 'object' || data === null) return '';
  const value = (data as Record<string, unknown>).lei;
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function connectSecToLei(secNode: EntityGraphNode | null, leiNode: EntityGraphNode | null): EntityGraphEdge[] {
  if (!secNode || !leiNode) return [];
  return [{
    source: secNode.id,
    target: leiNode.id,
    label: 'matched legal entity',
    sourceSystem: 'worldmonitor',
    status: 'INFERRED',
  }];
}

function isGleifLeiRecord(record: GleifLeiRecord | null): record is GleifLeiRecord {
  return record !== null;
}

export function supportsEntityGraphEnrichment(type: PopupType): boolean {
  return SUPPORTED_TYPES.has(type);
}

export async function fetchEntityGraphEnrichment(
  type: PopupType,
  data: unknown,
  signal: AbortSignal,
): Promise<EntityGraphEnrichment | null> {
  if (!supportsEntityGraphEnrichment(type)) return null;

  const secContext = await fetchSecEntityContext(type, data, signal);
  if (signal.aborted) return null;

  const explicitLei = getExplicitLei(data);
  const candidateNames = dedupeBy(
    [secContext?.name || '', ...candidateNamesFromUnknown(data), secContext?.ticker || ''],
    name => name.toLowerCase(),
  );
  const leiMatch = explicitLei
    ? { data: { lei: explicitLei }, stale: false, updatedAt: Date.now() }
    : await findBestLeiRecord(candidateNames, signal);
  const lei = leiMatch.data?.lei || '';
  const gleifSnapshot = lei ? await fetchGleifRelationshipSnapshot(lei, signal) : null;
  if (signal.aborted) return null;

  const identifiers: EntityGraphIdentifier[] = [];
  const nodes: EntityGraphNode[] = [];
  const edges: EntityGraphEdge[] = [];
  const notes: string[] = [];
  const secNode = secContext ? secCompanyNode(secContext) : null;

  if (secContext) identifiers.push(...secIdentifiers(secContext));
  if (secNode) nodes.push(secNode);

  if (gleifSnapshot) {
    const leiNode = gleifNode(gleifSnapshot.record);
    const relatedLeiRecords = [
      gleifSnapshot.directParent,
      gleifSnapshot.ultimateParent,
      ...gleifSnapshot.directChildren,
    ].filter(isGleifLeiRecord);
    identifiers.push(gleifIdentifier(gleifSnapshot.record));
    nodes.push(
      leiNode,
      ...relatedLeiRecords.map(gleifNode),
    );
    edges.push(...gleifEdges(gleifSnapshot), ...connectSecToLei(secNode, leiNode));
    notes.push(...gleifSnapshot.notes);
  } else if (candidateNames.length > 0) {
    notes.push('No confident GLEIF LEI match found for this entity name.');
  }

  const dedupedNodes = dedupeBy(nodes, node => node.id);
  const dedupedEdges = dedupeBy(edges, edge => `${edge.source}:${edge.target}:${edge.label}`);
  const dedupedIdentifiers = dedupeBy(identifiers, identifier => `${identifier.label}:${identifier.value}`);
  const recentFilings = secContext?.filings || [];

  if (dedupedNodes.length === 0 && dedupedIdentifiers.length === 0 && recentFilings.length === 0) {
    return null;
  }

  return {
    entityLabel: gleifSnapshot?.record.legalName || secContext?.name || candidateNames[0] || 'Entity',
    identifiers: dedupedIdentifiers,
    nodes: dedupedNodes,
    edges: dedupedEdges,
    recentFilings,
    sources: dedupeBy(
      [
        gleifSnapshot ? 'gleif' as const : null,
        secContext ? 'sec-edgar' as const : null,
        dedupedEdges.some(edge => edge.sourceSystem === 'worldmonitor') ? 'worldmonitor' as const : null,
      ].filter((source): source is 'gleif' | 'sec-edgar' | 'worldmonitor' => !!source),
      source => source,
    ),
    updatedAt: gleifSnapshot?.updatedAt || new Date().toISOString(),
    stale: Boolean(gleifSnapshot?.stale || leiMatch.stale),
    notes,
  };
}
