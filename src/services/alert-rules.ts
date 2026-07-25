import type { NewsItem, SignalEvidence } from '@/types';
import { buildSignalEvidenceFromNews } from '@/services/evidence';
import { pointInPolygon } from '@/utils/geo';

export const ALERT_RULES_STORAGE_KEY = 'wm-alert-rules';

export type AlertRuleSeverity = 'all' | 'high' | 'critical';
export type AlertRuleRegion = 'global' | 'mena' | 'europe' | 'asia' | 'americas' | 'africa';
export type AlertRuleSignalType = 'news' | 'market' | 'military' | 'cyber' | 'infrastructure' | 'supply_chain' | 'weather';
export type AlertRuleChannel = 'banner' | 'desktop' | 'email' | 'webhook' | 'telegram';
export type AlertRuleEvidenceRequirement = 'any' | 'corroborated' | 'official' | 'analyst-reviewed';
/** `any` = OR across keywords (default), `all` = every keyword must appear. */
export type AlertRuleMatchMode = 'any' | 'all';

/**
 * Geofence scoping a rule to a shape drawn on the map. `ring` is the outer
 * polygon ring in [lng, lat] order, snapshotted at save time so the rule keeps
 * working if the source drawing is later edited or deleted.
 */
export interface AlertRuleZone {
  id: string;
  name: string;
  ring: Array<[number, number]>;
}

export interface AlertRule {
  id: string;
  name: string;
  keywords: string[];
  matchMode: AlertRuleMatchMode;
  severity: AlertRuleSeverity;
  region: AlertRuleRegion;
  /** When set, only items geolocated inside this drawn zone can match. */
  zone: AlertRuleZone | null;
  notifications: boolean;
  active: boolean;
  entities: string[];
  signalTypes: AlertRuleSignalType[];
  threshold: number;
  cooldownMinutes: number;
  channels: AlertRuleChannel[];
  evidenceRequirement: AlertRuleEvidenceRequirement;
  createdAt: number;
  updatedAt: number;
}

export interface AlertRuleDraftInput {
  id?: string;
  name?: string;
  keywords?: string[] | string;
  matchMode?: string;
  zone?: AlertRuleZone | null;
  severity?: string;
  region?: string;
  notifications?: boolean;
  active?: boolean;
  entities?: string[] | string;
  signalTypes?: string[] | string;
  threshold?: number;
  cooldownMinutes?: number;
  channels?: string[] | string;
  evidenceRequirement?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AlertRuleMatch {
  matched: boolean;
  score: number;
  matchedKeywords: string[];
  matchedEntities: string[];
  evidence: SignalEvidence;
  reason: string;
  /** Items considered after geofencing — equals the input unless a zone is set. */
  consideredCount: number;
}

const REGIONS: AlertRuleRegion[] = ['global', 'mena', 'europe', 'asia', 'americas', 'africa'];
const MATCH_MODES: AlertRuleMatchMode[] = ['any', 'all'];
const SEVERITIES: AlertRuleSeverity[] = ['all', 'high', 'critical'];
const SIGNAL_TYPES: AlertRuleSignalType[] = ['news', 'market', 'military', 'cyber', 'infrastructure', 'supply_chain', 'weather'];
const CHANNELS: AlertRuleChannel[] = ['banner', 'desktop', 'email', 'webhook', 'telegram'];
const EVIDENCE_REQUIREMENTS: AlertRuleEvidenceRequirement[] = ['any', 'corroborated', 'official', 'analyst-reviewed'];

function stringList(value: string[] | string | undefined, fallback: string[] = []): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const list = raw.map(item => item.trim()).filter(Boolean);
  return list.length > 0 ? [...new Set(list)].slice(0, 30) : fallback;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/** Accept a zone only if it carries a usable polygon ring. */
function normalizeZone(zone: AlertRuleZone | null | undefined): AlertRuleZone | null {
  if (!zone || !Array.isArray(zone.ring) || zone.ring.length < 3) return null;
  const ring = zone.ring
    .filter((p): p is [number, number] =>
      Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([lng, lat]) => [lng, lat] as [number, number]);
  if (ring.length < 3) return null;
  return {
    id: String(zone.id || 'zone'),
    name: String(zone.name || 'Drawn zone').trim().slice(0, 60),
    ring,
  };
}

export function normalizeAlertRule(input: AlertRuleDraftInput, now = Date.now()): AlertRule {
  const channels = stringList(input.channels, input.notifications === false ? ['banner'] : ['banner', 'desktop'])
    .filter((channel): channel is AlertRuleChannel => CHANNELS.includes(channel as AlertRuleChannel));
  const signalTypes = stringList(input.signalTypes, ['news'])
    .filter((type): type is AlertRuleSignalType => SIGNAL_TYPES.includes(type as AlertRuleSignalType));
  return {
    id: String(input.id || `rule-${now}-${Math.random().toString(36).slice(2, 8)}`),
    name: String(input.name || 'Custom alert rule').trim().slice(0, 96),
    keywords: stringList(input.keywords),
    matchMode: oneOf(input.matchMode, MATCH_MODES, 'any'),
    severity: oneOf(input.severity, SEVERITIES, 'high'),
    region: oneOf(input.region, REGIONS, 'global'),
    zone: normalizeZone(input.zone),
    notifications: input.notifications !== false,
    active: input.active !== false,
    entities: stringList(input.entities),
    signalTypes: signalTypes.length > 0 ? signalTypes : ['news'],
    threshold: clampNumber(input.threshold, 1, 100, input.severity === 'critical' ? 80 : 60),
    cooldownMinutes: clampNumber(input.cooldownMinutes, 1, 1440, 30),
    channels: channels.length > 0 ? channels : ['banner'],
    evidenceRequirement: oneOf(input.evidenceRequirement, EVIDENCE_REQUIREMENTS, 'any'),
    createdAt: Number.isFinite(input.createdAt) ? Number(input.createdAt) : now,
    updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : now,
  };
}

export function loadAlertRules(): AlertRule[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALERT_RULES_STORAGE_KEY) || '[]') as AlertRuleDraftInput[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(rule => normalizeAlertRule(rule, Number(rule.createdAt) || Date.now()));
  } catch {
    return [];
  }
}

export function saveAlertRules(rules: AlertRule[]): void {
  localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(rules));
}

function containsToken(text: string, token: string): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized) return false;
  return text.includes(normalized);
}

function evidencePasses(rule: AlertRule, evidence: SignalEvidence): boolean {
  if (rule.evidenceRequirement === 'any') return true;
  if (rule.evidenceRequirement === 'corroborated') return ['corroborated', 'official', 'analyst-reviewed'].includes(evidence.verificationState);
  if (rule.evidenceRequirement === 'official') return ['official', 'analyst-reviewed'].includes(evidence.verificationState);
  return evidence.verificationState === 'analyst-reviewed';
}

/** Items geolocated inside the rule's zone. Un-geolocated items are excluded. */
function withinZone(rule: AlertRule, items: NewsItem[]): NewsItem[] {
  if (!rule.zone) return items;
  const ring = rule.zone.ring;
  return items.filter(item =>
    typeof item.lat === 'number' && typeof item.lon === 'number'
    && pointInPolygon(item.lon, item.lat, ring));
}

export function evaluateAlertRule(rule: AlertRule, items: NewsItem[]): AlertRuleMatch {
  const scoped = withinZone(rule, items);
  const evidence = buildSignalEvidenceFromNews(scoped);
  const text = scoped.map(item => `${item.title} ${item.source} ${item.locationName ?? ''}`).join(' ').toLowerCase();
  const matchedKeywords = rule.keywords.filter(keyword => containsToken(text, keyword));
  const matchedEntities = rule.entities.filter(entity => containsToken(text, entity));
  const score = Math.min(100, Math.round(evidence.confidence * 100) + matchedKeywords.length * 8 + matchedEntities.length * 10);

  // 'all' requires every configured keyword to appear; 'any' needs a single hit
  // from either keywords or entities (the long-standing behaviour).
  const keywordsSatisfied = rule.matchMode === 'all'
    ? rule.keywords.length > 0 && matchedKeywords.length === rule.keywords.length
    : matchedKeywords.length > 0 || matchedEntities.length > 0;

  const matched = rule.active
    && scoped.length > 0
    && rule.signalTypes.includes('news')
    && keywordsSatisfied
    && score >= rule.threshold
    && evidencePasses(rule, evidence);

  let reason: string;
  if (matched) {
    const zoneNote = rule.zone ? ` inside ${rule.zone.name}` : '';
    reason = `Matched ${[...matchedKeywords, ...matchedEntities].join(', ')}${zoneNote} with ${evidence.verificationState} evidence`;
  } else if (rule.zone && scoped.length === 0) {
    reason = `No geolocated items inside ${rule.zone.name}`;
  } else if (rule.matchMode === 'all' && matchedKeywords.length > 0 && !keywordsSatisfied) {
    const missing = rule.keywords.filter(k => !matchedKeywords.includes(k));
    reason = `Match-all unmet — missing: ${missing.join(', ')}`;
  } else {
    reason = 'Rule conditions not met';
  }

  return {
    matched,
    score,
    matchedKeywords,
    matchedEntities,
    evidence,
    reason,
    consideredCount: scoped.length,
  };
}
