/**
 * T0.3 — Audit log middleware.
 *
 * Fire-and-forget helper that writes an action record to Convex audit_log.
 * Designed to be called from any API route handler after the state-changing
 * operation succeeds. The helper swallows logging failures so audit storage
 * issues do not break the user-facing request.
 *
 * Usage in a route handler:
 *
 *   import { recordAuditEvent } from './_audit.js';
 *
 *   // inside handler, after resolving uid:
 *   recordAuditEvent(req, {
 *     firebaseUid: uid,
 *     action: 'prefs:save',
 *     tier,
 *   });
 *
 * Do NOT await this helper from within a response path — it is fire-and-forget.
 * `withAudit` calls it without awaiting so it never delays the response.
 * Direct callers (e.g. checkout) should also not await unless tail-exec is unavailable.
 */

function getConvex() {
  const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  const token = process.env.CONVEX_ADMIN_TOKEN;
  return url && token ? { url, token } : null;
}

function getClientIp(req) {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    undefined
  );
}

/**
 * Write an audit event to Convex asynchronously.
 *
 * @param {Request} req  The incoming Request object (for IP + User-Agent).
 * @param {{
 *   firebaseUid?: string,
 *   action: string,
 *   entityId?: string,
 *   entityType?: string,
 *   tier?: string,
 *   meta?: Record<string, unknown>,
 * }} event
 */
export function recordAuditEvent(req, event) {
  return Promise.resolve().then(async () => {
    const convex = getConvex();
    if (!convex) return;

    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') ?? undefined;

    const args = {
      firebaseUid: event.firebaseUid ?? undefined,
      action: event.action,
      entityId: event.entityId ?? undefined,
      entityType: event.entityType ?? undefined,
      ip,
      userAgent,
      tier: event.tier ?? undefined,
      meta: event.meta ? JSON.stringify(event.meta) : undefined,
      ts: Date.now(),
    };

    try {
      await fetch(`${convex.url}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${convex.token}`,
        },
        body: JSON.stringify({ path: 'audit:logAction', args }),
        signal: AbortSignal.timeout(2_000),
      });
    } catch {
      // Audit log failures are non-fatal.
    }
  });
}

/**
 * Wrap a Vercel edge handler to automatically audit all non-GET, non-OPTIONS requests.
 *
 * @param {(req: Request) => Promise<Response>} handler
 * @param {{
 *   action: string,
 *   getUid?: (req: Request) => Promise<string | undefined>,
 *   getEntityId?: (req: Request, url: URL) => string | undefined,
 *   entityType?: string,
 * }} options
 * @returns {(req: Request) => Promise<Response>}
 */
export function withAudit(handler, options) {
  return async (req) => {
    const response = await handler(req);

    const method = req.method?.toUpperCase();
    if (method !== 'GET' && method !== 'OPTIONS' && method !== 'HEAD') {
      const url = new URL(req.url);
      const uid = options.getUid ? await options.getUid(req).catch(() => undefined) : undefined;
      const entityId = options.getEntityId ? options.getEntityId(req, url) : undefined;

      // Fire-and-forget: audit log must not delay the response.
      recordAuditEvent(req, {
        firebaseUid: uid,
        action: options.action,
        entityId,
        entityType: options.entityType,
        meta: { method, path: url.pathname, status: response.status },
      });
    }

    return response;
  };
}
