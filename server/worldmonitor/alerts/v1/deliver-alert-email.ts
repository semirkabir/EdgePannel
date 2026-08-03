import type {
  AlertsServiceHandler,
  ServerContext,
  DeliverAlertEmailRequest,
  DeliverAlertEmailResponse,
} from '../../../../src/generated/server/worldmonitor/alerts/v1/service_server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAlertEmailHtml(req: DeliverAlertEmailRequest): string {
  const match = req.match!;
  const keywords = match.matchedKeywords.map(escapeHtml).join(', ') || '—';
  const entities = match.matchedEntities.map(escapeHtml).join(', ') || '—';
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 32px 24px;">
      <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">World Monitor Alert</div>
      <div style="background: #111; border: 1px solid #1a1a1a; border-left: 3px solid #4ade80; padding: 20px 24px; margin-bottom: 20px;">
        <p style="font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 6px;">${escapeHtml(match.ruleName)}</p>
        <p style="font-size: 13px; color: #999; margin: 0;">Severity: ${escapeHtml(match.severity || 'all')} · Score: ${Math.round(match.score)}</p>
      </div>
      <p style="font-size: 14px; color: #ccc; line-height: 1.5;">${escapeHtml(match.reason || 'Rule matched.')}</p>
      <p style="font-size: 12px; color: #888; margin-top: 16px;">Keywords: ${keywords}</p>
      <p style="font-size: 12px; color: #888;">Entities: ${entities}</p>
    </div>
  `;
}

export const deliverAlertEmail: AlertsServiceHandler['deliverAlertEmail'] = async (
  ctx: ServerContext,
  req: DeliverAlertEmailRequest,
): Promise<DeliverAlertEmailResponse> => {
  // The domain gateway (server/gateway.ts) already verified the caller's
  // Firebase token and stamps the uid here — no re-verification needed.
  if (!ctx.headers['x-wm-user-id']) throw new Error('Not authenticated');

  if (!EMAIL_RE.test(req.email)) throw new Error('Invalid email address');

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('Email delivery not configured');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'World Monitor <noreply@edgepannel.app>',
      to: [req.email],
      subject: `Alert: ${req.match?.ruleName ?? 'Rule matched'}`,
      html: buildAlertEmailHtml(req),
    }),
    signal: AbortSignal.timeout(8_000),
  });

  return { delivered: resp.ok };
};
