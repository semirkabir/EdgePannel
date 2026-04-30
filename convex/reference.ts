/**
 * T0.2 — Reference data / entity resolver (Convex functions).
 *
 * Provides cache-aware lookup of cross-reference mappings:
 * ticker ↔ CUSIP ↔ ISIN ↔ LEI ↔ FIGI.
 *
 * Records are populated lazily by api/reference/resolve.js and cached
 * here with a 30-day TTL (driven by the `updatedAt` field).
 */

import { mutation, query } from "./_generated_server";
import { v } from "convex/values";

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Reads ─────────────────────────────────────────────────────────────────────

export const lookupByTicker = query({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("entity_xref")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker.toUpperCase()))
      .first();
    if (!row || Date.now() - row.updatedAt > TTL_MS) return null;
    return row;
  },
});

export const lookupByIsin = query({
  args: { isin: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("entity_xref")
      .withIndex("by_isin", (q) => q.eq("isin", args.isin.toUpperCase()))
      .first();
    if (!row || Date.now() - row.updatedAt > TTL_MS) return null;
    return row;
  },
});

export const lookupByLei = query({
  args: { lei: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("entity_xref")
      .withIndex("by_lei", (q) => q.eq("lei", args.lei.toUpperCase()))
      .first();
    if (!row || Date.now() - row.updatedAt > TTL_MS) return null;
    return row;
  },
});

export const lookupByCusip = query({
  args: { cusip: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("entity_xref")
      .withIndex("by_cusip", (q) => q.eq("cusip", args.cusip.toUpperCase()))
      .first();
    if (!row || Date.now() - row.updatedAt > TTL_MS) return null;
    return row;
  },
});

// ── Writes (upsert) ───────────────────────────────────────────────────────────

export const upsertEntityXref = mutation({
  args: {
    ticker: v.optional(v.string()),
    cusip: v.optional(v.string()),
    isin: v.optional(v.string()),
    lei: v.optional(v.string()),
    figi: v.optional(v.string()),
    name: v.string(),
    country: v.optional(v.string()),
    sector: v.optional(v.string()),
    exchange: v.optional(v.string()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticker = args.ticker?.toUpperCase();
    const isin = args.isin?.toUpperCase();
    const lei = args.lei?.toUpperCase();
    const cusip = args.cusip?.toUpperCase();

    // Find by any primary identifier.
    let existing = ticker
      ? await ctx.db
          .query("entity_xref")
          .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
          .first()
      : null;

    if (!existing && isin) {
      existing = await ctx.db
        .query("entity_xref")
        .withIndex("by_isin", (q) => q.eq("isin", isin))
        .first();
    }
    if (!existing && lei) {
      existing = await ctx.db
        .query("entity_xref")
        .withIndex("by_lei", (q) => q.eq("lei", lei))
        .first();
    }
    if (!existing && cusip) {
      existing = await ctx.db
        .query("entity_xref")
        .withIndex("by_cusip", (q) => q.eq("cusip", cusip))
        .first();
    }

    const now = Date.now();
    const payload = {
      ticker,
      cusip,
      isin,
      lei,
      figi: args.figi,
      name: args.name,
      country: args.country,
      sector: args.sector,
      exchange: args.exchange,
      entityType: args.entityType,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { status: "updated", id: existing._id };
    }

    const id = await ctx.db.insert("entity_xref", payload);
    return { status: "created", id };
  },
});
