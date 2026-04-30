// ──────────────────────────────────────────────────────
// Tipsters — mutations & queries
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Get or create a tipster by name */
export const getOrCreate = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("newspaper"),
      v.literal("punter"),
      v.literal("algorithm"),
    ),
    matrixUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tipsters")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("tipsters", {
      name: args.name,
      type: args.type,
      matrixUserId: args.matrixUserId,
      stats: {
        totalTips: 0,
        wins: 0,
        places: 0,
        strikeRate: 0,
        roi: 0,
        lastUpdated: Date.now(),
      },
    });
  },
});

/** Get a tipster by name */
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("tipsters")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
  },
});

/** Search tipsters by name */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    return await ctx.db
      .query("tipsters")
      .withSearchIndex("search_name", (q) => q.search("name", searchQuery))
      .take(10);
  },
});

/** Get leaderboard — top tipsters by strike rate (min 10 tips) */
export const leaderboard = query({
  args: {
    limit: v.optional(v.number()),
    sortBy: v.optional(
      v.union(v.literal("strikeRate"), v.literal("roi"), v.literal("wins")),
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const allTipsters = await ctx.db.query("tipsters").collect();

    // Filter to tipsters with meaningful history
    const qualified = allTipsters.filter((t) => t.stats.totalTips >= 10);

    // Sort by requested metric
    const sortBy = args.sortBy ?? "strikeRate";
    const sorted = qualified.sort((a, b) => {
      switch (sortBy) {
        case "strikeRate":
          return b.stats.strikeRate - a.stats.strikeRate;
        case "roi":
          return b.stats.roi - a.stats.roi;
        case "wins":
          return b.stats.wins - a.stats.wins;
      }
    });

    return sorted.slice(0, limit);
  },
});

/** Get tipster by ID with full stats */
export const get = query({
  args: { tipsterId: v.id("tipsters") },
  handler: async (ctx, { tipsterId }) => {
    return await ctx.db.get(tipsterId);
  },
});
