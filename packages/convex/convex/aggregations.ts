// ──────────────────────────────────────────────────────
// Aggregations — materialised views for fast retrieval
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Store/update an aggregation for a race */
export const upsert = mutation({
  args: {
    raceId: v.id("races"),
    data: v.any(),
  },
  handler: async (ctx, { raceId, data }) => {
    const existing = await ctx.db
      .query("aggregations")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data,
        generatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("aggregations", {
      raceId,
      data,
      generatedAt: Date.now(),
    });
  },
});

/** Get aggregation for a race */
export const getByRace = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    return await ctx.db
      .query("aggregations")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .first();
  },
});
