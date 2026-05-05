import { describeFreshness, getPersistentCache, setPersistentCache } from '@/services/persistent-cache';
import type { EntityGraphEdge, EntityGraphIdentifier, EntityGraphNode } from './types';

const GLEIF_API_BASE = 'https://api.gleif.org/api/v1';
const GLEIF_CACHE_PREFIX = 'entity-graph:gleif:';
const GLEIF_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface GleifLocalizedName {
  name?: string;
  language?: string;
}

interface GleifAddress {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}

interface GleifLeiRecordAttributes {
  lei?: string;
  entity?: {
    legalName?: GleifLocalizedName;
    legalAddress?: GleifAddress;
    headquartersAddress?: GleifAddress;
    registeredAs?: string | null;
    jurisdiction?: string | null;
    status?: string | null;
  };
  registration?: {
    status?: string | null;
    lastUpdateDate?: string | null;
    nextRenewalDate?: string | null;
    corroborationLevel?: string | null;
  };
  bic?: string[] | null;
  conformityFlag?: string | null;
}

interface GleifRelationshipAttributes {
  relationship?: {
    type?: string | null;
    status?: string | null;
    startNode?: { id?: string | null; type?: string | null };
    endNode?: { id?: string | null; type?: string | null };
  };
  registration?: {
    status?: string | null;
    lastUpdateDate?: string | null;
  };
}

interface GleifResource<T> {
  id?: string;
  type?: string;
  attributes?: T;
  links?: { self?: string };
}

interface GleifResponse<T> {
  data?: T;
  meta?: {
    goldenCopy?: { publishDate?: string };
    pagination?: { total?: number };
  };
}

export interface GleifLeiRecord {
  lei: string;
  legalName: string;
  status: string;
  registrationStatus: string;
  jurisdiction: string;
  country: string;
  city: string;
  registeredAs: string;
  bic: string[];
  conformityFlag: string;
  lastUpdateDate: string;
  nextRenewalDate: string;
  corroborationLevel: string;
  selfUrl: string;
  goldenCopyDate: string;
}

export interface GleifRelationshipSnapshot {
  record: GleifLeiRecord;
  directParent: GleifLeiRecord | null;
  ultimateParent: GleifLeiRecord | null;
  directChildren: GleifLeiRecord[];
  relationshipRecords: GleifRelationshipSummary[];
  stale: boolean;
  updatedAt: string;
  notes: string[];
}

interface GleifRelationshipSummary {
  startLei: string;
  endLei: string;
  type: string;
  status: string;
}

interface CachedValue<T> {
  data: T;
  stale: boolean;
  updatedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|llc|class|common|stock)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKey(key: string): string {
  return `${GLEIF_CACHE_PREFIX}${key}`;
}

function gleifRecordUrl(lei: string): string {
  return `https://search.gleif.org/#/record/${encodeURIComponent(lei)}`;
}

async function readCache<T>(key: string): Promise<CachedValue<T> | null> {
  const cached = await getPersistentCache<T>(cacheKey(key));
  if (!cached) return null;
  const stale = Date.now() - cached.updatedAt > GLEIF_CACHE_TTL_MS;
  return { data: cached.data, stale, updatedAt: cached.updatedAt };
}

async function fetchJsonCached<T>(key: string, url: string, signal: AbortSignal): Promise<CachedValue<T>> {
  const cached = await readCache<T>(key);
  if (cached && !cached.stale) return cached;

  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/vnd.api+json, application/json' },
    });
    if (response.status === 404) throw new Error('GLEIF resource not found');
    if (!response.ok) throw new Error(`GLEIF HTTP ${response.status}`);
    const data = await response.json() as T;
    void setPersistentCache(cacheKey(key), data);
    return { data, stale: false, updatedAt: Date.now() };
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

function asLeiRecord(
  resource: GleifResource<GleifLeiRecordAttributes> | undefined,
  goldenCopyDate = '',
): GleifLeiRecord | null {
  const attr = resource?.attributes;
  const lei = attr?.lei || resource?.id || '';
  const legalName = attr?.entity?.legalName?.name || '';
  if (!lei || !legalName) return null;

  const hq = attr?.entity?.headquartersAddress;
  const legal = attr?.entity?.legalAddress;

  return {
    lei,
    legalName,
    status: attr?.entity?.status || '',
    registrationStatus: attr?.registration?.status || '',
    jurisdiction: attr?.entity?.jurisdiction || '',
    country: hq?.country || legal?.country || '',
    city: hq?.city || legal?.city || '',
    registeredAs: attr?.entity?.registeredAs || '',
    bic: attr?.bic || [],
    conformityFlag: attr?.conformityFlag || '',
    lastUpdateDate: attr?.registration?.lastUpdateDate || '',
    nextRenewalDate: attr?.registration?.nextRenewalDate || '',
    corroborationLevel: attr?.registration?.corroborationLevel || '',
    selfUrl: resource?.links?.self || `${GLEIF_API_BASE}/lei-records/${encodeURIComponent(lei)}`,
    goldenCopyDate,
  };
}

function scoreLeiCandidate(record: GleifLeiRecord, query: string): number {
  const legal = normalizeText(record.legalName);
  const wanted = normalizeText(query);
  if (!legal || !wanted) return 0;

  let score = 0;
  if (legal === wanted) score += 100;
  else if (legal.includes(wanted) || wanted.includes(legal)) score += 70;
  else {
    const wantedParts = wanted.split(' ').filter(Boolean);
    const matched = wantedParts.filter(part => legal.includes(part)).length;
    score += wantedParts.length > 0 ? (matched / wantedParts.length) * 50 : 0;
  }
  if (record.status === 'ACTIVE') score += 10;
  if (record.registrationStatus === 'ISSUED') score += 8;
  if (record.conformityFlag === 'CONFORMING') score += 4;
  return score;
}

async function searchLeiRecords(query: string, signal: AbortSignal): Promise<CachedValue<GleifLeiRecord[]>> {
  const url = new URL(`${GLEIF_API_BASE}/lei-records`);
  url.searchParams.set('filter[entity.legalName]', query);
  url.searchParams.set('page[size]', '5');

  const fetched = await fetchJsonCached<GleifResponse<Array<GleifResource<GleifLeiRecordAttributes>>>>(
    `search:${normalizeText(query)}`,
    url.toString(),
    signal,
  );
  const goldenCopyDate = fetched.data.meta?.goldenCopy?.publishDate || '';
  const records = (fetched.data.data || [])
    .map(resource => asLeiRecord(resource, goldenCopyDate))
    .filter((record): record is GleifLeiRecord => !!record)
    .sort((a, b) => scoreLeiCandidate(b, query) - scoreLeiCandidate(a, query));

  return { data: records, stale: fetched.stale, updatedAt: fetched.updatedAt };
}

async function fetchLeiRecord(lei: string, signal: AbortSignal): Promise<CachedValue<GleifLeiRecord | null>> {
  const fetched = await fetchJsonCached<GleifResponse<GleifResource<GleifLeiRecordAttributes>>>(
    `record:${lei}`,
    `${GLEIF_API_BASE}/lei-records/${encodeURIComponent(lei)}`,
    signal,
  );
  const record = asLeiRecord(fetched.data.data, fetched.data.meta?.goldenCopy?.publishDate || '');
  return { data: record, stale: fetched.stale, updatedAt: fetched.updatedAt };
}

async function fetchRelatedLeiRecord(
  lei: string,
  relation: 'direct-parent' | 'ultimate-parent',
  signal: AbortSignal,
): Promise<CachedValue<GleifLeiRecord | null>> {
  try {
    const fetched = await fetchJsonCached<GleifResponse<GleifResource<GleifLeiRecordAttributes>>>(
      `${relation}:${lei}`,
      `${GLEIF_API_BASE}/lei-records/${encodeURIComponent(lei)}/${relation}`,
      signal,
    );
    const record = asLeiRecord(fetched.data.data, fetched.data.meta?.goldenCopy?.publishDate || '');
    return { data: record, stale: fetched.stale, updatedAt: fetched.updatedAt };
  } catch {
    return { data: null, stale: false, updatedAt: Date.now() };
  }
}

async function fetchDirectChildren(lei: string, signal: AbortSignal): Promise<CachedValue<GleifLeiRecord[]>> {
  try {
    const fetched = await fetchJsonCached<GleifResponse<Array<GleifResource<GleifLeiRecordAttributes>>>>(
      `direct-children:${lei}`,
      `${GLEIF_API_BASE}/lei-records/${encodeURIComponent(lei)}/direct-children?page%5Bsize%5D=6`,
      signal,
    );
    const records = (fetched.data.data || [])
      .map(resource => asLeiRecord(resource, fetched.data.meta?.goldenCopy?.publishDate || ''))
      .filter((record): record is GleifLeiRecord => !!record);
    return { data: records, stale: fetched.stale, updatedAt: fetched.updatedAt };
  } catch {
    return { data: [], stale: false, updatedAt: Date.now() };
  }
}

async function fetchDirectChildRelationships(lei: string, signal: AbortSignal): Promise<CachedValue<GleifRelationshipSummary[]>> {
  try {
    const fetched = await fetchJsonCached<GleifResponse<Array<GleifResource<GleifRelationshipAttributes>>>>(
      `direct-child-relationships:${lei}`,
      `${GLEIF_API_BASE}/lei-records/${encodeURIComponent(lei)}/direct-child-relationships?page%5Bsize%5D=6`,
      signal,
    );
    const records = (fetched.data.data || []).map((resource) => {
      const rel = resource.attributes?.relationship;
      return {
        startLei: rel?.startNode?.id || '',
        endLei: rel?.endNode?.id || '',
        type: rel?.type || '',
        status: rel?.status || resource.attributes?.registration?.status || '',
      };
    }).filter(rel => rel.startLei && rel.endLei);
    return { data: records, stale: fetched.stale, updatedAt: fetched.updatedAt };
  } catch {
    return { data: [], stale: false, updatedAt: Date.now() };
  }
}

export async function findBestLeiRecord(names: string[], signal: AbortSignal): Promise<CachedValue<GleifLeiRecord | null>> {
  const queries = names.map(name => name.trim()).filter(Boolean);
  let best: { record: GleifLeiRecord; score: number; stale: boolean; updatedAt: number } | null = null;

  for (const query of queries.slice(0, 3)) {
    const candidates = await searchLeiRecords(query, signal);
    for (const record of candidates.data) {
      const score = scoreLeiCandidate(record, query);
      if (!best || score > best.score) {
        best = { record, score, stale: candidates.stale, updatedAt: candidates.updatedAt };
      }
    }
    if (best && best.score >= 100) break;
  }

  if (!best || best.score < 55) {
    return { data: null, stale: false, updatedAt: Date.now() };
  }
  return { data: best.record, stale: best.stale, updatedAt: best.updatedAt };
}

export async function fetchGleifRelationshipSnapshot(
  lei: string,
  signal: AbortSignal,
): Promise<GleifRelationshipSnapshot | null> {
  const record = await fetchLeiRecord(lei, signal);
  if (!record.data) return null;

  const [directParent, ultimateParent, directChildren, relationshipRecords] = await Promise.all([
    fetchRelatedLeiRecord(lei, 'direct-parent', signal),
    fetchRelatedLeiRecord(lei, 'ultimate-parent', signal),
    fetchDirectChildren(lei, signal),
    fetchDirectChildRelationships(lei, signal),
  ]);

  const updatedAtMs = Math.max(
    record.updatedAt,
    directParent.updatedAt,
    ultimateParent.updatedAt,
    directChildren.updatedAt,
    relationshipRecords.updatedAt,
  );
  const stale = record.stale || directParent.stale || ultimateParent.stale || directChildren.stale || relationshipRecords.stale;
  const notes = stale ? [`GLEIF cache fallback, refreshed ${describeFreshness(updatedAtMs)}.`] : [];

  return {
    record: record.data,
    directParent: directParent.data,
    ultimateParent: ultimateParent.data,
    directChildren: directChildren.data,
    relationshipRecords: relationshipRecords.data,
    stale,
    updatedAt: new Date(updatedAtMs).toISOString(),
    notes,
  };
}

export function gleifIdentifier(record: GleifLeiRecord): EntityGraphIdentifier {
  return {
    label: 'LEI',
    value: record.lei,
    source: 'gleif',
    url: gleifRecordUrl(record.lei),
  };
}

export function gleifNode(record: GleifLeiRecord): EntityGraphNode {
  return {
    id: `lei:${record.lei}`,
    label: record.legalName,
    kind: 'legal-entity',
    source: 'gleif',
    lei: record.lei,
    jurisdiction: record.jurisdiction,
    country: record.country,
    status: record.status || record.registrationStatus,
    url: gleifRecordUrl(record.lei),
  };
}

export function gleifEdges(snapshot: GleifRelationshipSnapshot): EntityGraphEdge[] {
  const edges: EntityGraphEdge[] = [];
  const childStatuses = new Map(snapshot.relationshipRecords.map(rel => [rel.startLei, rel.status]));

  if (snapshot.directParent) {
    edges.push({
      source: `lei:${snapshot.record.lei}`,
      target: `lei:${snapshot.directParent.lei}`,
      label: 'directly consolidated by',
      sourceSystem: 'gleif',
      status: 'ACTIVE',
    });
  }
  if (snapshot.ultimateParent && snapshot.ultimateParent.lei !== snapshot.directParent?.lei) {
    edges.push({
      source: `lei:${snapshot.record.lei}`,
      target: `lei:${snapshot.ultimateParent.lei}`,
      label: 'ultimately consolidated by',
      sourceSystem: 'gleif',
      status: 'ACTIVE',
    });
  }
  for (const child of snapshot.directChildren) {
    edges.push({
      source: `lei:${child.lei}`,
      target: `lei:${snapshot.record.lei}`,
      label: 'directly consolidated by',
      sourceSystem: 'gleif',
      status: childStatuses.get(child.lei) || 'ACTIVE',
    });
  }

  return edges;
}

export function candidateNamesFromUnknown(data: unknown): string[] {
  if (!isRecord(data)) return [];
  return ['name', 'companyName', 'title', 'institutionName', 'issuerName']
    .map(key => data[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}
