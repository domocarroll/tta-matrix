// ──────────────────────────────────────────────────────
// Stage 1 — meeting corrections (Pete's review/edit overlay)
// ──────────────────────────────────────────────────────
//
// Aggregations are computed from raw extractions. Pete's edits sit on
// top as an overlay so the agentic ground truth stays auditable and
// exports use the corrected values.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const horsePatchValidator = v.object({
  raceNumber: v.number(),
  originalName: v.string(),
  action: v.union(
    v.literal("rename"),
    v.literal("renumber"),
    v.literal("remove"),
  ),
  newHorseName: v.optional(v.string()),
  newHorseNumber: v.optional(v.number()),
});

/** Read corrections for a single meeting. Returns null if none recorded. */
export const getForMeeting = query({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("meetingCorrections")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (!row) return null;
    return {
      _id: row._id,
      label: row.label ?? null,
      notes: row.notes ?? null,
      horsePatches: row.horsePatches,
      updatedAt: row.updatedAt,
    };
  },
});

/** Read every corrections row for a client (workspace-wide overlay). */
export const listForClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("meetingCorrections")
      .withIndex("by_client_meeting", (q) => q.eq("clientId", args.clientId))
      .collect();
    return rows.map((row) => ({
      meetingKey: row.meetingKey,
      label: row.label ?? null,
      notes: row.notes ?? null,
      horsePatches: row.horsePatches,
      updatedAt: row.updatedAt,
    }));
  },
});

/** Upsert the corrections doc for a meeting. Replaces the patches array. */
export const upsert = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
    horsePatches: v.array(horsePatchValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("meetingCorrections")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        notes: args.notes,
        horsePatches: args.horsePatches,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("meetingCorrections", {
      clientId: args.clientId,
      meetingKey: args.meetingKey,
      label: args.label,
      notes: args.notes,
      horsePatches: args.horsePatches,
      updatedAt: now,
    });
  },
});

/** Clear all corrections for a meeting (revert to agent ground truth). */
export const clearForMeeting = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("meetingCorrections")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { ok: true as const };
  },
});
