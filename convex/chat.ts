import { mutation, query } from "./_generated_server";
import { v } from "convex/values";

const roomValidator = v.union(
  v.literal("world"),
  v.literal("tech"),
  v.literal("finance"),
  v.literal("supply-chain"),
  v.literal("good-news"),
  v.literal("conflicts"),
);

export const listMessages = query({
  args: {
    room: roomValidator,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 80, 100));
    const rows = await ctx.db
      .query("situation_room_messages")
      .withIndex("by_room_created_at", (q) => q.eq("room", args.room))
      .order("desc")
      .take(limit);
    return rows.reverse();
  },
});

export const postMessage = mutation({
  args: {
    room: roomValidator,
    firebaseUid: v.string(),
    userLabel: v.string(),
    avatarUrl: v.optional(v.string()),
    content: v.string(),
    viewUrl: v.optional(v.string()),
    viewLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("situation_room_messages", {
      ...args,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});
