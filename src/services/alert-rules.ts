import type { NewsItem, SignalEvidence } from '@/types';
import { buildSignalEvidenceFromNews } from '@/services/evidence';

export const ALERT_RULES_STORAGE_KEY = 'wm-alert-rules';

export type AlertRuleSeverity = 'all' | 'high' | 'critical';
export type AlertRuleRegion = 'global' | 'mena' | 'europe' | 'asia' | 'americas' | 'africa';
export type AlertRuleSignalType = 'news' | 'market' | 'military' | 'cyber' | 'infrastructure' | 'supply_chain' | 'weather';
export type AlertRuleChannel = 'banner' | 'desktop' | 'email' | 'webhook' | 'telegram';
export type AlertRuleEvidenceRequirement = 'any' | 'corroborated' | 'official' | 'analyst-reviewed';

export interface AlertRule {
  id: string;
  name: string;
  keywords: string[];
  severity: AlertRuleSeverity;
  region: AlertRuleRegion;
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
}

const REGIONS: AlertRuleRegion[] = ['global', 'mena', 'europe', 'asia', 'americas', 'africa'];
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

export function normalizeAlertRule(input: AlertRuleDraftInput, now = Date.now()): AlertRule {
  const channels = stringList(input.channels, input.notifications === false ? ['banner'] : ['banner', 'desktop'])
    .filter((channel): channel is AlertRuleChannel => CHANNELS.includes(channel as AlertRuleChannel));
  const signalTypes = stringList(input.signalTypes, ['news'])
    .filter((type): type is AlertRuleSignalType => SIGNAL_TYPES.includes(type as AlertRuleSignalType));
  return {
    id: String(input.id || `rule-${now}-${Math.random().toString(36).slice(2, 8)}`),
    name: String(input.name || 'Custom alert rule').trim().slice(0, 96),
    keywords: stringList(input.keywords),
    severity: oneOf(input.severity, SEVERITIES, 'high'),
    region: oneOf(input.region, REGIONS, 'global'),
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

export function evaluateAlertRule(rule: AlertRule, items: NewsItem[]): AlertRuleMatch {
  const evidence = buildSignalEvidenceFromNews(items);
  const text = items.map(item => `${item.title} ${item.source} ${item.locationName ?? ''}`).join(' ').toLowerCase();
  const matchedKeywords = rule.keywords.filter(keyword => containsToken(text, keyword));
  const matchedEntities = rule.entities.filter(entity => containsToken(text, entity));
  const score = Math.min(100, Math.round(evidence.confidence * 100) + matchedKeywords.length * 8 + matchedEntities.length * 10);
  const matched = rule.active
    && rule.signalTypes.includes('news')
    && (matchedKeywords.length > 0 || matchedEntities.length > 0)
    && score >= rule.threshold
    && evidencePasses(rule, evidence);
  return {
    matched,
    score,
    matchedKeywords,
    matchedEntities,
    evidence,
    reason: matched
      ? `Matched ${[...matchedKeywords, ...matchedEntities].join(', ')} with ${evidence.verificationState} evidence`
      : 'Rule conditions not met',
  };
}
