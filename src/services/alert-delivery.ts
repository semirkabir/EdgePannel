import {
  AlertsServiceClient,
  type AlertMatch,
} from '@/generated/client/worldmonitor/alerts/v1/service_client';

const client = new AlertsServiceClient('', { fetch: (...args) => globalThis.fetch(...args) });

export interface AlertDeliveryMatch {
  ruleId: string;
  ruleName: string;
  severity: string;
  reason: string;
  score: number;
  matchedKeywords: string[];
  matchedEntities: string[];
  firedAt: number;
}

function toAlertMatch(m: AlertDeliveryMatch): AlertMatch {
  return {
    ruleId: m.ruleId,
    ruleName: m.ruleName,
    severity: m.severity,
    reason: m.reason,
    score: m.score,
    matchedKeywords: m.matchedKeywords,
    matchedEntities: m.matchedEntities,
    firedAt: m.firedAt,
  };
}

/** Fire-and-forget: sends a fired alert rule's match to an email address. Returns false on any failure. */
export async function deliverAlertEmail(match: AlertDeliveryMatch, email: string): Promise<boolean> {
  try {
    const resp = await client.deliverAlertEmail({ match: toAlertMatch(match), email });
    return resp.delivered;
  } catch (err) {
    console.error('[alert-delivery] email failed', err);
    return false;
  }
}

/** Fire-and-forget: POSTs a fired alert rule's match to a webhook URL. Returns false on any failure (including insufficient tier). */
export async function deliverAlertWebhook(match: AlertDeliveryMatch, webhookUrl: string): Promise<boolean> {
  try {
    const resp = await client.deliverAlertWebhook({ match: toAlertMatch(match), webhookUrl });
    return resp.delivered;
  } catch (err) {
    console.error('[alert-delivery] webhook failed', err);
    return false;
  }
}
