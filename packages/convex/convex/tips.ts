// ──────────────────────────────────────────────────────
// Tips — mutations & queries
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Create a new tip entry (from agent extraction) */
export const create = mutation({
  args: {
    raceId: v.id("races"),
    tipsterId: v.id("tipsters"),
    selections: v.array(
      v.object({
        position: v.number(),
        horseName: v.string(),
        horseNumber: v.optional(v.number()),
      }),
    ),
    source: v.union(
      v.literal("image"),
      v.literal("manual"),
      v.literal("api"),
    ),
    sourceImageId: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate: same race + tipster
    const existing = await ctx.db
      .query("tips")
      .withIndex("by_race_tipster", (q) =>
        q.eq("raceId", args.raceId).eq("tipsterId", args.tipsterId),
      )
      .first();

    if (existing) {
      // Update existing tip with new selections
      await ctx.db.patch(existing._id, {
        selections: args.selections,
        source: args.source,
        sourceImageId: args.sourceImageId,
        extractedAt: Date.now(),
        confidence: args.confidence,
      });
      return existing._id;
    }

    return await ctx.db.insert("tips", {
      ...args,
      extractedAt: Date.now(),
    });
  },
});

/** Get all tips for a race */
export const getByRace = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    return await ctx.db
      .query("tips")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();
  },
});

/** Get all tips by a specific tipster */
export const getByTipster = query({
  args: { tipsterId: v.id("tipsters") },
  handler: async (ctx, { tipsterId }) => {
    return await ctx.db
      .query("tips")
      .withIndex("by_tipster", (q) => q.eq("tipsterId", tipsterId))
      .collect();
  },
});
