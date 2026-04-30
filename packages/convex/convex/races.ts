// ──────────────────────────────────────────────────────
// Races — mutations & queries
// ──────────────────────────────────────────────────────

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Upsert a race by (meetingId + raceNumber). Used by scraper. */
export const upsert = mutation({
  args: {
    meetingId: v.id("meetings"),
    raceNumber: v.number(),
    name: v.optional(v.string()),
    distance: v.optional(v.number()),
    class: v.optional(v.string()),
    trackCondition: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    status: v.union(
      v.literal("upcoming"),
      v.literal("running"),
      v.literal("resulted"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("races")
      .withIndex("by_meeting_number", (q) =>
        q.eq("meetingId", args.meetingId).eq("raceNumber", args.raceNumber),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        distance: args.distance ?? existing.distance,
        class: args.class ?? existing.class,
        trackCondition: args.trackCondition ?? existing.trackCondition,
        scheduledTime: args.scheduledTime ?? existing.scheduledTime,
        status: args.status,
      });
      return existing._id;
    }

    return await ctx.db.insert("races", {
      ...args,
      result: undefined,
    });
  },
});

/** Get all races for a meeting */
export const getByMeeting = query({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    return await ctx.db
      .query("races")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meetingId))
      .collect();
  },
});

/** Record a race result and settle related predictions */
export const recordResult = mutation({
  args: {
    raceId: v.id("races"),
    result: v.array(
      v.object({
        position: v.number(),
        horseName: v.string(),
        horseNumber: v.number(),
      }),
    ),
  },
  handler: async (ctx, { raceId, result }) => {
    // Update race with result
    await ctx.db.patch(raceId, {
      status: "resulted" as const,
      result,
    });

    // Settle open predictions for this race
    const predictions = await ctx.db
      .query("predictions")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    const winner = result.find((r) => r.position === 1);
    const placeGetters = result.filter((r) => r.position <= 3);

    for (const prediction of predictions) {
      if (prediction.status !== "open") continue;

      const selectedHorse = prediction.selection.horseName.toLowerCase();
      const isWinner =
        winner?.horseName.toLowerCase() === selectedHorse ||
        winner?.horseNumber === prediction.selection.horseNumber;
      const isPlace = placeGetters.some(
        (p) =>
          p.horseName.toLowerCase() === selectedHorse ||
          p.horseNumber === prediction.selection.horseNumber,
      );

      let status: "won" | "lost" = "lost";
      let payout = 0;

      if (prediction.selection.betType === "win") {
        if (isWinner) {
          status = "won";
          payout = prediction.stake * (prediction.odds ?? 2);
        }
      } else if (prediction.selection.betType === "place") {
        if (isPlace) {
          status = "won";
          payout = prediction.stake * ((prediction.odds ?? 2) * 0.4);
        }
      } else if (prediction.selection.betType === "each-way") {
        if (isWinner) {
          status = "won";
          const winPay = (prediction.stake / 2) * (prediction.odds ?? 2);
          const placePay = (prediction.stake / 2) * ((prediction.odds ?? 2) * 0.4);
          payout = winPay + placePay;
        } else if (isPlace) {
          status = "won";
          payout = (prediction.stake / 2) * ((prediction.odds ?? 2) * 0.4);
        }
      }

      await ctx.db.patch(prediction._id, { status, payout });
    }

    // Update tipster stats for tips on this race
    const tips = await ctx.db
      .query("tips")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    for (const tip of tips) {
      const tipster = await ctx.db.get(tip.tipsterId);
      if (!tipster) continue;

      const winPick = tip.selections.find((s) => s.position === 1);
      const placePicks = tip.selections.filter((s) => s.position <= 3);

      const isWinCorrect = winPick
        ? winner?.horseName.toLowerCase() === winPick.horseName.toLowerCase() ||
          winner?.horseNumber === winPick.horseNumber
        : false;

      const isPlaceCorrect = placePicks.some((pick) =>
        placeGetters.some(
          (p) =>
            p.horseName.toLowerCase() === pick.horseName.toLowerCase() ||
            p.horseNumber === pick.horseNumber,
        ),
      );

      const newTotalTips = tipster.stats.totalTips + 1;
      const newWins = tipster.stats.wins + (isWinCorrect ? 1 : 0);
      const newPlaces = tipster.stats.places + (isPlaceCorrect ? 1 : 0);

      await ctx.db.patch(tipster._id, {
        stats: {
          totalTips: newTotalTips,
          wins: newWins,
          places: newPlaces,
          strikeRate: newTotalTips > 0 ? newWins / newTotalTips : 0,
          roi: tipster.stats.roi, // ROI needs actual stake/return data
          lastUpdated: Date.now(),
        },
      });
    }
  },
});

/** Get a specific race by meeting and number */
export const getByMeetingAndNumber = query({
  args: {
    meetingId: v.id("meetings"),
    raceNumber: v.number(),
  },
  handler: async (ctx, { meetingId, raceNumber }) => {
    return await ctx.db
      .query("races")
      .withIndex("by_meeting_number", (q) =>
        q.eq("meetingId", meetingId).eq("raceNumber", raceNumber),
      )
      .first();
  },
});
