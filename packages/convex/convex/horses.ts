// ──────────────────────────────────────────────────────
// Horses — mutations & queries
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Upsert a horse by (raceId + horseNumber). Used by scraper. */
export const upsert = mutation({
  args: {
    raceId: v.id("races"),
    horseNumber: v.number(),
    horseName: v.string(),
    jockey: v.string(),
    trainer: v.string(),
    weight: v.number(),
    barrier: v.number(),
    scratched: v.boolean(),
    lastStartForm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("horses")
      .withIndex("by_race_number", (q) =>
        q.eq("raceId", args.raceId).eq("horseNumber", args.horseNumber),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        horseName: args.horseName,
        jockey: args.jockey,
        trainer: args.trainer,
        weight: args.weight,
        barrier: args.barrier,
        scratched: args.scratched,
        lastStartForm: args.lastStartForm ?? existing.lastStartForm,
      });
      return existing._id;
    }

    return await ctx.db.insert("horses", args);
  },
});

/** Get all horses for a race */
export const getByRace = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    return await ctx.db
      .query("horses")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();
  },
});

/** Mark a horse as scratched */
export const scratch = mutation({
  args: {
    raceId: v.id("races"),
    horseNumber: v.number(),
  },
  handler: async (ctx, { raceId, horseNumber }) => {
    const horse = await ctx.db
      .query("horses")
      .withIndex("by_race_number", (q) =>
        q.eq("raceId", raceId).eq("horseNumber", horseNumber),
      )
      .first();

    if (horse) {
      await ctx.db.patch(horse._id, { scratched: true });
    }
  },
});

/** Find a horse by name (fuzzy matching handled by caller) */
export const getByName = query({
  args: { horseName: v.string() },
  handler: async (ctx, { horseName }) => {
    return await ctx.db
      .query("horses")
      .withIndex("by_name", (q) => q.eq("horseName", horseName))
      .collect();
  },
});
