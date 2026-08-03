/**
 * Pure decision layer for the alert rule engine: given the rules, the current
 * news and the last-fired bookkeeping, decide which rules should fire now.
 *
 * Deliberately free of DOM, storage and auth imports so it stays unit-testable
 * — `alert-rule-engine.ts` wraps this with delivery, persistence and tiering.
 */

import type { NewsItem } from '@/types';
import { evaluateAlertRule, type AlertRule, type AlertRuleMatch } from '@/services/alert-rules';

/**
 * Rules are scored over a rolling window rather than the whole corpus, so a
 * rule that matched once doesn't keep matching against months-old items. The
 * window also keeps evidence corroboration meaningful — it should measure "how
 * many sources are carrying this now", not "ever".
 */
export const RECENCY_WINDOW_MS = 60 * 60 * 1000;

/** Channels with a real delivery path today. */
const DELIVERABLE_CHANNELS = new Set(['banner', 'desktop', 'email', 'webhook']);

export interface AlertRuleFireState {
  lastFiredAt: number;
  /** Keywords/entities that triggered the last fire — shown in the rules panel. */
  signature: string;
}

export interface AlertRuleCandidate {
  rule: AlertRule;
  match: AlertRuleMatch;
}

/** Items recent enough to be considered evidence for a firing right now. */
export function withinWindow(items: NewsItem[], now: number, windowMs = RECENCY_WINDOW_MS): NewsItem[] {
  const cutoff = now - windowMs;
  return items.filter(item => item.pubDate instanceof Date && item.pubDate.getTime() >= cutoff);
}

export function isInCooldown(
  rule: AlertRule,
  state: AlertRuleFireState | undefined,
  now: number,
): boolean {
  if (!state) return false;
  return (now - state.lastFiredAt) < rule.cooldownMinutes * 60 * 1000;
}

/**
 * Channels the user picked that can't be delivered yet. Surfaced so the UI can
 * label them rather than implying an email went out.
 */
export function deliveryPending(rule: AlertRule): string[] {
  return rule.channels.filter(channel => !DELIVERABLE_CHANNELS.has(channel));
}

export function signatureFor(match: AlertRuleMatch): string {
  return [...match.matchedKeywords, ...match.matchedEntities].join(', ');
}

/**
 * Which rules should fire against `items` at `now`.
 *
 * Skips rules that are paused, unmatchable (no keywords or entities — the state
 * a freshly created rule starts in), or still inside their cooldown.
 */
export function selectFiringRules(
  rules: AlertRule[],
  items: NewsItem[],
  fireState: Record<string, AlertRuleFireState>,
  now: number,
): AlertRuleCandidate[] {
  const scoped = withinWindow(items, now);
  if (scoped.length === 0) return [];

  const candidates: AlertRuleCandidate[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.keywords.length === 0 && rule.entities.length === 0) continue;
    if (isInCooldown(rule, fireState[rule.id], now)) continue;

    const match = evaluateAlertRule(rule, scoped);
    if (!match.matched) continue;

    candidates.push({ rule, match });
  }
  return candidates;
}
