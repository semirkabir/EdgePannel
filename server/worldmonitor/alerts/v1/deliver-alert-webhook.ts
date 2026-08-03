import type { UserTier } from '../../../_shared/auth-tier';
import { postToWebhookSafely } from '../../../_shared/ssrf-guard';
import type {
  AlertsServiceHandler,
  ServerContext,
  DeliverAlertWebhookRequest,
  DeliverAlertWebhookResponse,
} from '../../../../src/generated/server/worldmonitor/alerts/v1/service_server';

// Legacy tiers that map onto the app's current 'analyst'+ feature tier — see
// LEGACY_TIER_ALIASES in src/services/feature-entitlements.ts, the source of
// truth for this correspondence (pro->analyst, business->strategist,
// enterprise->maximalist — all >= analyst).
const ANALYST_OR_ABOVE: ReadonlySet<UserTier> = new Set(['pro', 'business', 'enterprise']);

export const deliverAlertWebhook: AlertsServiceHandler['deliverAlertWebhook'] = async (
  ctx: ServerContext,
  req: DeliverAlertWebhookRequest,
): Promise<DeliverAlertWebhookResponse> => {
  // The domain gateway (server/gateway.ts) already verified the caller's
  // Firebase token and resolved their tier here — no re-verification needed.
  if (!ctx.headers['x-wm-user-id']) throw new Error('Not authenticated');
  const tier = ctx.headers['x-wm-user-tier'] as UserTier | undefined;
  if (!tier || !ANALYST_OR_ABOVE.has(tier)) {
    throw new Error('Webhook alert delivery requires the Analyst plan or above');
  }

  const match = req.match!;
  const delivered = await postToWebhookSafely(req.webhookUrl, {
    ruleId: match.ruleId,
    ruleName: match.ruleName,
    severity: match.severity,
    reason: match.reason,
    score: match.score,
    matchedKeywords: match.matchedKeywords,
    matchedEntities: match.matchedEntities,
    firedAt: match.firedAt,
  });

  return { delivered };
};
