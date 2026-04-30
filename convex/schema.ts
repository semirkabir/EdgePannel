import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  registrations: defineTable({
    email: v.string(),
    normalizedEmail: v.string(),
    registeredAt: v.number(),
    source: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    referralCode: v.optional(v.string()),
    referredBy: v.optional(v.string()),
    referralCount: v.optional(v.number()),
    firebaseUid: v.optional(v.string()),
    tier: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("business"), v.literal("enterprise"))),
  })
    .index("by_normalized_email", ["normalizedEmail"])
    .index("by_referral_code", ["referralCode"])
    .index("by_firebase_uid", ["firebaseUid"]),
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  // --- Data Marketplace ---

  datasets: defineTable({
    /** Unique dataset key, e.g. "naval-incidents-2024" */
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    format: v.union(v.literal("json"), v.literal("csv"), v.literal("geojson")),
    recordCount: v.optional(v.number()),
    fileSizeBytes: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Minimum tier required to read. */
    minTier: v.literal("pro"),
    price: v.optional(v.number()), // cents, 0 = included in tier
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    /** The full dataset as a JSON string. For small-medium datasets (<1MB)
     * stored directly in Convex.  Larger datasets go through Redis. */
    dataJson: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
    previewJson: v.optional(v.string()), // sample rows for preview
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  purchases: defineTable({
    firebaseUid: v.string(),
    datasetSlug: v.string(),
    purchasedAt: v.number(),
    priceCents: v.optional(v.number()),
  })
    .index("by_user", ["firebaseUid"])
    .index("by_dataset", ["datasetSlug"]),

  // ── T0.1 Time-series ─────────────────────────────────────────────────────

  /** Metadata registry for every tracked series. */
  time_series_meta: defineTable({
    /** Stable identifier, e.g. "cii:pakistan", "fred:GDP", "price:AAPL". */
    seriesId: v.string(),
    /** Broad domain for listing / filtering. */
    domain: v.union(
      v.literal("intelligence"),
      v.literal("economic"),
      v.literal("market"),
      v.literal("sentiment"),
      v.literal("risk"),
    ),
    label: v.string(),
    unit: v.optional(v.string()),
    /** Data frequency hint, e.g. "1d", "1h", "5m". */
    resolution: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_series_id", ["seriesId"])
    .index("by_domain", ["domain"]),

  /** Individual time-series data points. Kept lean for query efficiency. */
  time_series: defineTable({
    seriesId: v.string(),
    /** Unix ms timestamp for this point. */
    ts: v.number(),
    value: v.number(),
    /** Optional JSON blob for extra dimensions (e.g. low/high/volume). */
    meta: v.optional(v.string()),
  })
    .index("by_series_ts", ["seriesId", "ts"])
    .index("by_series_id", ["seriesId"]),

  // ── T0.2 Reference data ───────────────────────────────────────────────────

  /**
   * Cross-reference table mapping financial identifiers.
   * Populated lazily by the reference resolver; never re-fetched within TTL.
   */
  entity_xref: defineTable({
    ticker: v.optional(v.string()),
    cusip: v.optional(v.string()),
    isin: v.optional(v.string()),
    lei: v.optional(v.string()),
    figi: v.optional(v.string()),
    name: v.string(),
    country: v.optional(v.string()),
    sector: v.optional(v.string()),
    exchange: v.optional(v.string()),
    /** "company" | "etf" | "index" | "crypto" | "sovereign" | "fund" */
    entityType: v.optional(v.string()),
    /** Unix ms; drives TTL logic in the resolver. */
    updatedAt: v.number(),
  })
    .index("by_ticker", ["ticker"])
    .index("by_isin", ["isin"])
    .index("by_lei", ["lei"])
    .index("by_cusip", ["cusip"]),

  // ── T0.3 Users / Workspaces / Audit ──────────────────────────────────────

  /** Extended user profile (supplements the registrations table). */
  users: defineTable({
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    tier: v.optional(
      v.union(
        v.literal("free"),
        v.literal("pro"),
        v.literal("business"),
        v.literal("enterprise"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  }).index("by_firebase_uid", ["firebaseUid"]),

  /** Named workspaces for collaborative analyst work. */
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerFirebaseUid: v.string(),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerFirebaseUid"])
    .index("by_slug", ["slug"]),

  /** Many-to-many workspace membership with roles. */
  workspace_members: defineTable({
    workspaceId: v.id("workspaces"),
    firebaseUid: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["firebaseUid"])
    .index("by_workspace_user", ["workspaceId", "firebaseUid"]),

  /**
   * Immutable append-only audit log.
   * Written by api/_audit.js middleware; never updated, only inserted.
   */
  audit_log: defineTable({
    /** null → anonymous / unauthenticated request */
    firebaseUid: v.optional(v.string()),
    /** Dot-namespaced action, e.g. "prefs:save", "portfolio:add_position". */
    action: v.string(),
    /** Primary entity affected, e.g. "AAPL", "pakistan". */
    entityId: v.optional(v.string()),
    /** Entity kind, e.g. "ticker", "country", "workspace". */
    entityType: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    tier: v.optional(v.string()),
    /** JSON blob for request-specific extra context. */
    meta: v.optional(v.string()),
    ts: v.number(),
  })
    .index("by_user_ts", ["firebaseUid", "ts"])
    .index("by_action_ts", ["action", "ts"])
    .index("by_ts", ["ts"]),
});
