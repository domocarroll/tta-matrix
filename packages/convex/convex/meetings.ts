// ──────────────────────────────────────────────────────
// Meetings — mutations & queries
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Upsert a meeting by (date + name). Used by scraper. */
export const upsert = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    category: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("live"),
      v.literal("completed"),
    ),
    raceCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("meetings")
      .withIndex("by_date_name", (q) =>
        q.eq("date", args.date).eq("name", args.name),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        category: args.category,
        status: args.status,
        raceCount: args.raceCount,
      });
      return existing._id;
    }

    return await ctx.db.insert("meetings", args);
  },
});

/** Get meetings by date */
export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    return await ctx.db
      .query("meetings")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
  },
});

/** Get meetings by status */
export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("upcoming"),
      v.literal("live"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, { status }) => {
    return await ctx.db
      .query("meetings")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

/** Update meeting status */
export const updateStatus = mutation({
  args: {
    meetingId: v.id("meetings"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("live"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, { meetingId, status }) => {
    await ctx.db.patch(meetingId, { status });
  },
});
