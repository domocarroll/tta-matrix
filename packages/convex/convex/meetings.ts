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

/**
 * Record Perplexity field-resolution metadata on a meeting.
 * Kept separate from `upsert` so the resolver doesn't have to thread
 * these optional fields through the scraper-shaped upsert signature.
 */
export const recordFieldResolution = mutation({
  args: {
    meetingId: v.id("meetings"),
    fieldStatus: v.union(v.literal("resolved"), v.literal("unavailable")),
    fieldSource: v.string(),
    fieldFetchedAt: v.number(),
    fieldCitations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.meetingId, {
      fieldStatus: args.fieldStatus,
      fieldSource: args.fieldSource,
      fieldFetchedAt: args.fieldFetchedAt,
      fieldCitations: args.fieldCitations,
    });
  },
});

/**
 * Assemble the resolved runner field for a meeting (by date + name).
 * Returns the FieldRunner-per-race shape the shared matcher expects, or
 * `{ resolved: false }` when nothing is cached yet.
 */
export const getResolvedField = query({
  args: { date: v.string(), name: v.string() },
  handler: async (ctx, { date, name }) => {
    const meeting = await ctx.db
      .query("meetings")
      .withIndex("by_date_name", (q) => q.eq("date", date).eq("name", name))
      .first();

    if (!meeting || meeting.fieldStatus !== "resolved") {
      return { resolved: false as const };
    }

    const races = await ctx.db
      .query("races")
      .withIndex("by_meeting", (q) => q.eq("meetingId", meeting._id))
      .collect();

    const racesWithRunners = await Promise.all(
      races
        .slice()
        .sort((a, b) => a.raceNumber - b.raceNumber)
        .map(async (race) => {
          const horses = await ctx.db
            .query("horses")
            .withIndex("by_race", (q) => q.eq("raceId", race._id))
            .collect();
          return {
            raceNumber: race.raceNumber,
            runners: horses
              .slice()
              .sort((a, b) => a.horseNumber - b.horseNumber)
              .map((h) => ({
                number: h.horseNumber,
                name: h.horseName,
                jockey: h.jockey,
                trainer: h.trainer,
                barrier: h.barrier,
                scratched: h.scratched,
              })),
          };
        }),
    );

    return {
      resolved: true as const,
      source: meeting.fieldSource ?? "unknown",
      fetchedAt: meeting.fieldFetchedAt ?? 0,
      citations: meeting.fieldCitations ?? [],
      races: racesWithRunners,
    };
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
