/**
 * Runs user-authored alert rules against incoming news.
 *
 * `evaluateAlertRule` in `alert-rules.ts` has always held the matching logic,
 * but nothing ever called it outside tests — rules could be authored, geofenced
 * and tuned, yet never fire. This module is the missing half: it drives the
 * evaluation off the news pipeline and delivers matches.
 *
 * Delivery follows the rule's own `channels`:
 *   banner  → shell toast
 *   desktop → OS notification (still subject to permission + page visibility)
 *   email   → server round-trip (Resend), fire-and-forget
 *   webhook → server round-trip (SSRF-checked POST), gated to the
 *             webhook-alerts (analyst+) tier, fire-and-forget
 * Every match lands in the notification inbox regardless, so nothing is lost
 * when the toast is missed. `telegram` still needs a server round-trip and
 * isn't wired yet — `deliveryPending` reports it so the UI can say so honestly.
 *
 * The "should this fire" decision lives in `alert-rule-policy.ts`, kept pure so
 * it can be unit-tested without DOM or auth.
 */

import type { NewsItem } from '@/types';
import { loadAlertRules, type AlertRule, type AlertRuleMatch } from '@/services/alert-rules';
import {
  selectFiringRules,
  signatureFor,
  type AlertRuleFireState,
} from '@/services/alert-rule-policy';
import { notificationBus } from '@/services/notifications';
import { showShellNotification } from '@/app/shell-notifications';
import { canAccessFeature } from '@/services/feature-flags';
import { deliverAlertEmail, deliverAlertWebhook } from '@/services/alert-delivery';

export { deliveryPending, RECENCY_WINDOW_MS } from '@/services/alert-rule-policy';
export type { AlertRuleFireState } from '@/services/alert-rule-policy';

const FIRE_STATE_KEY = 'wm-alert-rule-fires-v1';

/** Mirrors breaking-news-alerts: don't fire on the initial hydrate. */
const STARTUP_GRACE_MS = 10 * 1000;

/** Cadence for tiers that can author rules but don't get real-time checks. */
const DEFERRED_INTERVAL_MS = 15 * 60 * 1000;

export interface AlertRuleFiring {
  rule: AlertRule;
  match: AlertRuleMatch;
  firedAt: number;
}

let fireState: Record<string, AlertRuleFireState> = {};
let initTimestamp = 0;
let lastDeferredRunAt = 0;
let loaded = false;

/* ---- fire state ---- */

function loadFireState(): void {
  if (loaded) return;
  loaded = true;
  try {
    const parsed = JSON.parse(localStorage.getItem(FIRE_STATE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      fireState = parsed as Record<string, AlertRuleFireState>;
    }
  } catch {
    fireState = {};
  }
}

function saveFireState(): void {
  try {
    localStorage.setItem(FIRE_STATE_KEY, JSON.stringify(fireState));
  } catch { /* quota */ }
}

/** Drop state for deleted rules so the map can't grow unbounded. */
function pruneFireState(liveRuleIds: Set<string>): void {
  let changed = false;
  for (const id of Object.keys(fireState)) {
    if (!liveRuleIds.has(id)) {
      delete fireState[id];
      changed = true;
    }
  }
  if (changed) saveFireState();
}

export function getAlertRuleFireState(ruleId: string): AlertRuleFireState | null {
  loadFireState();
  return fireState[ruleId] ?? null;
}

/* ---- delivery ---- */

function severityFor(rule: AlertRule): 'critical' | 'high' | 'medium' {
  if (rule.severity === 'critical') return 'critical';
  if (rule.severity === 'high') return 'high';
  return 'medium';
}

function dispatch(rule: AlertRule, match: AlertRuleMatch, now: number): AlertRuleFiring {
  fireState[rule.id] = { lastFiredAt: now, signature: signatureFor(match) };
  saveFireState();

  const severity = severityFor(rule);

  // The inbox entry is unconditional: it's the durable record of the firing.
  // `display: 'inbox'` also keeps it clear of the bus's kind-level toast/push
  // prefs, which default `signal` off and would otherwise silently mute a rule
  // the user explicitly configured. Per-rule channels are honoured instead.
  notificationBus.emit({
    id: `rule-${rule.id}-${now}`,
    kind: 'signal',
    family: 'alert',
    title: rule.name,
    summary: match.reason,
    detail: `Score ${match.score} · ${match.consideredCount} item${match.consideredCount === 1 ? '' : 's'} in window`,
    sourceLabel: 'Alert rule',
    severity,
    timestamp: now,
    display: 'inbox',
    forcePush: rule.channels.includes('desktop'),
    payload: { ruleId: rule.id, score: match.score },
  });

  if (rule.channels.includes('banner')) {
    showShellNotification(
      `${rule.name} — ${match.reason}`,
      severity === 'critical' ? 'error' : 'warning',
      6000,
      'top',
    );
  }

  const wantsEmail = rule.channels.includes('email') && !!rule.email;
  // Client-side tier gate avoids a doomed round-trip; the server re-checks
  // the same tier before actually sending (see deliver-alert-webhook.ts).
  const wantsWebhook = rule.channels.includes('webhook') && !!rule.webhookUrl && canAccessFeature('webhook-alerts');
  if (wantsEmail || wantsWebhook) {
    const deliveryMatch = {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      reason: match.reason,
      score: match.score,
      matchedKeywords: match.matchedKeywords,
      matchedEntities: match.matchedEntities,
      firedAt: now,
    };
    if (wantsEmail) void deliverAlertEmail(deliveryMatch, rule.email).catch(() => {});
    if (wantsWebhook) void deliverAlertWebhook(deliveryMatch, rule.webhookUrl).catch(() => {});
  }

  const firing: AlertRuleFiring = { rule, match, firedAt: now };
  document.dispatchEvent(new CustomEvent('wm:alert-rule-fired', { detail: firing }));
  return firing;
}

/* ---- evaluation ---- */

/**
 * Evaluate every active rule against the current news window and deliver any
 * matches. Exported without the tier/startup gates so callers that have already
 * decided to run can drive it directly.
 */
export function evaluateAlertRules(items: NewsItem[], now = Date.now()): AlertRuleFiring[] {
  loadFireState();
  const rules = loadAlertRules();
  pruneFireState(new Set(rules.map(rule => rule.id)));

  return selectFiringRules(rules, items, fireState, now)
    .map(({ rule, match }) => dispatch(rule, match, now));
}

/**
 * Pipeline entry point — called with the assembled news corpus after each
 * refresh. Applies the tier and startup gates.
 */
export function checkBatchForAlertRules(items: NewsItem[]): void {
  if (isInStartupGrace()) return;
  // Authoring rules is `alert-rules` (enthusiast); evaluating them on every
  // refresh is `realtime-alerts` (analyst). Tiers in between still get checks,
  // just on a slower cadence.
  if (!canAccessFeature('alert-rules')) return;

  const now = Date.now();
  if (!canAccessFeature('realtime-alerts')) {
    if (now - lastDeferredRunAt < DEFERRED_INTERVAL_MS) return;
    lastDeferredRunAt = now;
  }

  try {
    evaluateAlertRules(items, now);
  } catch (err) {
    console.error('[AlertRuleEngine] evaluation failed:', err);
  }
}

function isInStartupGrace(): boolean {
  return initTimestamp > 0 && (Date.now() - initTimestamp) < STARTUP_GRACE_MS;
}

export function initAlertRuleEngine(): void {
  initTimestamp = Date.now();
  lastDeferredRunAt = 0;
  loaded = false;
  loadFireState();
}

export function destroyAlertRuleEngine(): void {
  initTimestamp = 0;
  lastDeferredRunAt = 0;
  loaded = false;
  fireState = {};
}
