/**
 * T0.1 — Time-series persistence layer (Convex functions).
 *
 * Provides append-only writes and range reads for any named series.
 * High-frequency data (market tick) belongs in Redis Streams; use Convex
 * only for low-frequency intelligence/economic/sentiment series.
 *
 * Series IDs follow the convention:  domain:entity[:qualifier]
 *   "cii:pakistan"        Country Instability Index for Pakistan
 *   "escalation:ukraine"  Hotspot Escalation score for Ukraine
 *   "fred:GDP"            US GDP from FRED
 *   "sentiment:AAPL"      Entity-level news sentiment for AAPL
 *   "risk:strategic"      Global strategic risk score
 */

import { mutation, query } from "./_generated_server";
import { v } from "convex/values";

// ── Meta ──────────────────────────────────────────────────────────────────────

export const upsertMeta = mutation({
  args: {
    seriesId: v.string(),
    domain: v.union(
      v.literal("intelligence"),
      v.literal("economic"),
      v.literal("market"),
      v.literal("sentiment"),
      v.literal("risk"),
    ),
    label: v.string(),
    unit: v.optional(v.string()),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("time_series_meta")
      .withIndex("by_series_id", (q) => q.eq("seriesId", args.seriesId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return { status: "updated" };
    }
    await ctx.db.insert("time_series_meta", { ...args, createdAt: now, updatedAt: now });
    return { status: "created" };
  },
});

export const listMeta = query({
  args: {
    domain: v.optional(
      v.union(
        v.literal("intelligence"),
        v.literal("economic"),
        v.literal("market"),
        v.literal("sentiment"),
        v.literal("risk"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    if (args.domain) {
      return ctx.db
        .query("time_series_meta")
        .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
        .collect();
    }
    return ctx.db.query("time_series_meta").collect();
  },
});

// ── Data points ───────────────────────────────────────────────────────────────

/**
 * Append one data point. The caller is responsible for de-duplication if
 * needed (write idempotence is NOT enforced at the DB level for performance).
 */
export const appendPoint = mutation({
  args: {
    seriesId: v.string(),
    ts: v.number(),
    value: v.number(),
    meta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("time_series", args);
    return { status: "ok" };
  },
});

/**
 * Batch-append points for a single series.
 * Convex mutations are transactional, so all points land atomically.
 */
export const appendPoints = mutation({
  args: {
    seriesId: v.string(),
    points: v.array(
      v.object({
        ts: v.number(),
        value: v.number(),
        meta: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const p of args.points) {
      await ctx.db.insert("time_series", { seriesId: args.seriesId, ...p });
    }
    return { status: "ok", count: args.points.length };
  },
});

/**
 * Read a time range. Returns points sorted ascending by ts.
 * Pass fromTs / toTs as Unix ms.  Omit toTs for "up to now".
 */
export const readRange = query({
  args: {
    seriesId: v.string(),
    fromTs: v.number(),
    toTs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const to = args.toTs ?? Date.now();
    const lim = Math.min(args.limit ?? 1000, 5000);

    const points = await ctx.db
      .query("time_series")
      .withIndex("by_series_ts", (q) =>
        q.eq("seriesId", args.seriesId).gte("ts", args.fromTs).lte("ts", to),
      )
      .take(lim);

    return points.map((p) => ({ ts: p.ts, value: p.value, meta: p.meta }));
  },
});

/** Fetch the single most-recent point for a series. */
export const latestPoint = query({
  args: { seriesId: v.string() },
  handler: async (ctx, args) => {
    const point = await ctx.db
      .query("time_series")
      .withIndex("by_series_ts", (q) => q.eq("seriesId", args.seriesId))
      .order("desc")
      .first();

    return point ? { ts: point.ts, value: point.value, meta: point.meta } : null;
  },
});

/**
 * Delete points older than a given timestamp for housekeeping.
 * Convex doesn't support bulk deletes, so this is limited to 500 rows per call.
 */
export const pruneOlderThan = mutation({
  args: { seriesId: v.string(), beforeTs: v.number() },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("time_series")
      .withIndex("by_series_ts", (q) =>
        q.eq("seriesId", args.seriesId).lt("ts", args.beforeTs),
      )
      .take(500);

    for (const p of old) {
      await ctx.db.delete(p._id);
    }
    return { deleted: old.length };
  },
});
