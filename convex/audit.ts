/**
 * T0.3 — Audit log (Convex functions).
 *
 * Append-only log of every state-changing API action.
 * Written by api/_audit.js middleware; never updated.
 *
 * Retention policy: callers should invoke pruneOldEntries periodically (e.g.
 * from a Vercel cron) to keep the table within Convex storage limits.
 * Default retention: 90 days.
 */

import { mutation, query } from "./_generated_server";
import { v } from "convex/values";

export const logAction = mutation({
  args: {
    firebaseUid: v.optional(v.string()),
    action: v.string(),
    entityId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    tier: v.optional(v.string()),
    meta: v.optional(v.string()),
    ts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("audit_log", {
      ...args,
      ts: args.ts ?? Date.now(),
    });
    return { status: "ok" };
  },
});

export const listAuditEvents = query({
  args: {
    firebaseUid: v.optional(v.string()),
    action: v.optional(v.string()),
    fromTs: v.optional(v.number()),
    toTs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lim = Math.min(args.limit ?? 200, 1000);

    if (args.firebaseUid) {
      const from = args.fromTs ?? 0;
      const to = args.toTs ?? Date.now();
      return ctx.db
        .query("audit_log")
        .withIndex("by_user_ts", (q) =>
          q.eq("firebaseUid", args.firebaseUid).gte("ts", from).lte("ts", to),
        )
        .order("desc")
        .take(lim);
    }

    if (args.action) {
      const from = args.fromTs ?? 0;
      const to = args.toTs ?? Date.now();
      return ctx.db
        .query("audit_log")
        .withIndex("by_action_ts", (q) =>
          q.eq("action", args.action!).gte("ts", from).lte("ts", to),
        )
        .order("desc")
        .take(lim);
    }

    // Full log (admin path) — most-recent first.
    return ctx.db
      .query("audit_log")
      .withIndex("by_ts", (q) =>
        args.fromTs !== undefined
          ? q.gte("ts", args.fromTs).lte("ts", args.toTs ?? Date.now())
          : q.gte("ts", 0),
      )
      .order("desc")
      .take(lim);
  },
});

/** Remove entries older than retentionDays (default 90). */
export const pruneOldEntries = mutation({
  args: { retentionDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.retentionDays ?? 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("audit_log")
      .withIndex("by_ts", (q) => q.lt("ts", cutoff))
      .take(500);
    for (const e of old) {
      await ctx.db.delete(e._id);
    }
    return { deleted: old.length, cutoff };
  },
});
