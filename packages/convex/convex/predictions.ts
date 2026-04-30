// ──────────────────────────────────────────────────────
// Predictions — mutations & queries (play-money market)
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Create a new prediction */
export const create = mutation({
  args: {
    raceId: v.id("races"),
    userId: v.string(),
    selection: v.object({
      horseName: v.string(),
      horseNumber: v.optional(v.number()),
      betType: v.union(
        v.literal("win"),
        v.literal("place"),
        v.literal("each-way"),
      ),
    }),
    stake: v.number(),
    odds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("predictions", {
      ...args,
      status: "open",
      payout: undefined,
      createdAt: Date.now(),
    });
  },
});

/** Get predictions for a race */
export const getByRace = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, { raceId }) => {
    return await ctx.db
      .query("predictions")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();
  },
});

/** Get user's predictions */
export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("predictions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Get user's prediction P&L */
export const getUserPnL = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const settled = predictions.filter((p) => p.status === "won" || p.status === "lost");
    const totalStaked = settled.reduce((sum, p) => sum + p.stake, 0);
    const totalReturn = settled.reduce((sum, p) => sum + (p.payout ?? 0), 0);
    const wins = settled.filter((p) => p.status === "won").length;

    return {
      totalBets: settled.length,
      openBets: predictions.filter((p) => p.status === "open").length,
      wins,
      losses: settled.length - wins,
      totalStaked,
      totalReturn,
      profit: totalReturn - totalStaked,
      roi: totalStaked > 0 ? ((totalReturn - totalStaked) / totalStaked) * 100 : 0,
    };
  },
});

/** Punter leaderboard by P&L */
export const punterLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const allPredictions = await ctx.db.query("predictions").collect();

    // Group by user
    const byUser = new Map<
      string,
      { staked: number; returned: number; wins: number; total: number }
    >();

    for (const p of allPredictions) {
      if (p.status !== "won" && p.status !== "lost") continue;
      const acc = byUser.get(p.userId) ?? {
        staked: 0,
        returned: 0,
        wins: 0,
        total: 0,
      };
      acc.staked += p.stake;
      acc.returned += p.payout ?? 0;
      acc.total += 1;
      if (p.status === "won") acc.wins += 1;
      byUser.set(p.userId, acc);
    }

    // Sort by ROI
    const leaderboard = Array.from(byUser.entries())
      .filter(([_, v]) => v.total >= 5)
      .map(([userId, v]) => ({
        userId,
        bets: v.total,
        wins: v.wins,
        staked: v.staked,
        returned: v.returned,
        profit: v.returned - v.staked,
        roi: v.staked > 0 ? ((v.returned - v.staked) / v.staked) * 100 : 0,
      }))
      .sort((a, b) => b.roi - a.roi);

    return leaderboard.slice(0, limit);
  },
});
