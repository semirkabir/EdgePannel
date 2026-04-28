/**
 * T0.3 — User profile + workspace management (Convex functions).
 *
 * Supplements the existing `registrations` table with:
 *   - `users`             Extended profile (display name, avatar, last seen)
 *   - `workspaces`        Named collaborative spaces
 *   - `workspace_members` Role-based membership
 */

import { mutation, query } from "./_generated_server";
import { v } from "convex/values";

// ── User profile ──────────────────────────────────────────────────────────────

export const upsertUser = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.email !== undefined && { email: args.email }),
        ...(args.displayName !== undefined && { displayName: args.displayName }),
        ...(args.avatarUrl !== undefined && { avatarUrl: args.avatarUrl }),
        ...(args.tier !== undefined && { tier: args.tier }),
        updatedAt: now,
        lastSeenAt: now,
      });
      return { status: "updated", id: existing._id };
    }

    const id = await ctx.db.insert("users", {
      firebaseUid: args.firebaseUid,
      email: args.email,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      tier: args.tier ?? "free",
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
    return { status: "created", id };
  },
});

export const getUser = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
  },
});

export const touchLastSeen = mutation({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .first();
    if (user) {
      await ctx.db.patch(user._id, { lastSeenAt: Date.now() });
    }
    return { status: user ? "updated" : "not_found" };
  },
});

// ── Workspaces ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export const createWorkspace = mutation({
  args: {
    name: v.string(),
    ownerFirebaseUid: v.string(),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const base = slugify(args.name);
    // Ensure slug uniqueness by appending a short timestamp suffix when colliding.
    let slug = base;
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", base))
      .first();
    if (existing) {
      slug = `${base}-${Date.now().toString(36)}`;
    }

    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      slug,
      ownerFirebaseUid: args.ownerFirebaseUid,
      description: args.description,
      isPublic: args.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-add owner as a member.
    await ctx.db.insert("workspace_members", {
      workspaceId,
      firebaseUid: args.ownerFirebaseUid,
      role: "owner",
      joinedAt: now,
    });

    return { status: "created", workspaceId, slug };
  },
});

export const getWorkspace = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listUserWorkspaces = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("workspace_members")
      .withIndex("by_user", (q) => q.eq("firebaseUid", args.firebaseUid))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const ws = await ctx.db.get(m.workspaceId);
        return ws ? { ...ws, role: m.role } : null;
      }),
    );
    return workspaces.filter(Boolean);
  },
});

export const addWorkspaceMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    firebaseUid: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    callerFirebaseUid: v.string(),
  },
  handler: async (ctx, args) => {
    // Only owner or editor can invite.
    const caller = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("firebaseUid", args.callerFirebaseUid),
      )
      .first();
    if (!caller || caller.role === "viewer") {
      return { status: "unauthorized" };
    }

    const existing = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("firebaseUid", args.firebaseUid),
      )
      .first();
    if (existing) return { status: "already_member", role: existing.role };

    await ctx.db.insert("workspace_members", {
      workspaceId: args.workspaceId,
      firebaseUid: args.firebaseUid,
      role: args.role,
      joinedAt: Date.now(),
    });
    return { status: "added" };
  },
});

export const listWorkspaceMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workspace_members")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const updateWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    callerFirebaseUid: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("firebaseUid", args.callerFirebaseUid),
      )
      .first();
    if (!membership || membership.role !== "owner") {
      return { status: "unauthorized" };
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.isPublic !== undefined) patch.isPublic = args.isPublic;

    await ctx.db.patch(args.workspaceId, patch as Parameters<typeof ctx.db.patch>[1]);
    return { status: "updated" };
  },
});
