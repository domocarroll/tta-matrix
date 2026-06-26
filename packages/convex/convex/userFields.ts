// User-approved authoritative race field — Pete uploads cards, Claude
// extracts runners, Pete reviews + approves, this writes the result.
//
// Tip aggregation prefers this over any auto-resolved (Perplexity) field
// for the same meetingKey.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const runnerSchema = v.object({
  number: v.number(),
  name: v.string(),
  jockey: v.optional(v.string()),
  trainer: v.optional(v.string()),
  barrier: v.optional(v.number()),
  scratched: v.optional(v.boolean()),
  emergency: v.optional(v.boolean()),
});

const raceSchema = v.object({
  raceNumber: v.number(),
  distance: v.optional(v.number()),
  runners: v.array(runnerSchema),
});

export const setForMeeting = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
    races: v.array(raceSchema),
    sourceFilenames: v.array(v.string()),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userFields")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();

    const now = Date.now();
    let result: { id: string; replaced: boolean };
    if (existing) {
      // Re-approving sets the card images to exactly the supplied set. Delete
      // only the images that are NO LONGER referenced (a diff, not a blanket
      // wipe) so an ADD that passes old∪new keeps the originals. An omitted
      // array means "no change" — keep the existing images untouched.
      const hasNewImages = !!args.imageStorageIds && args.imageStorageIds.length > 0;
      if (hasNewImages && existing.imageStorageIds) {
        const keep = new Set(args.imageStorageIds);
        for (const old of existing.imageStorageIds) {
          if (!keep.has(old)) await ctx.storage.delete(old);
        }
      }
      await ctx.db.patch(existing._id, {
        races: args.races,
        sourceFilenames: args.sourceFilenames,
        ...(hasNewImages ? { imageStorageIds: args.imageStorageIds } : {}),
        approvedAt: now,
      });
      result = { id: existing._id as unknown as string, replaced: true };
    } else {
      const id = await ctx.db.insert("userFields", {
        clientId: args.clientId,
        meetingKey: args.meetingKey,
        races: args.races,
        sourceFilenames: args.sourceFilenames,
        imageStorageIds: args.imageStorageIds,
        approvedAt: now,
      });
      result = { id: id as unknown as string, replaced: false };
    }

    // ── 3-Gate side-effects ──
    // Approving a field IS the lock. Flip customerMeetings → locked
    // (creating the row if it doesn't exist yet, derived from key) and
    // re-route any pending extractions for this meetingKey.
    const meeting = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (meeting) {
      if (meeting.state !== "locked") {
        await ctx.db.patch(meeting._id, { state: "locked", updatedAt: now });
      }
    } else {
      const [date = "", category = "OR", name = "Unknown"] =
        args.meetingKey.split("|");
      await ctx.db.insert("customerMeetings", {
        clientId: args.clientId,
        meetingKey: args.meetingKey,
        date,
        category,
        name,
        state: "locked",
        createdAt: now,
        updatedAt: now,
      });
    }
    const pending = await ctx.db
      .query("extractions")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .collect();
    let rerouted = 0;
    for (const row of pending) {
      if (row.state === "pending-meeting") {
        await ctx.db.patch(row._id, {
          state: "routed",
          pendingReason: undefined,
        });
        rerouted += 1;
      }
    }
    return { ...result, rerouted };
  },
});

export const listForClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userFields")
      .withIndex("by_client_meeting", (q) => q.eq("clientId", args.clientId))
      .collect();
    return rows.map((r) => ({
      meetingKey: r.meetingKey,
      races: r.races,
      sourceFilenames: r.sourceFilenames,
      imageStorageIds: r.imageStorageIds ?? [],
      approvedAt: r.approvedAt,
    }));
  },
});

export const removeForMeeting = mutation({
  args: { clientId: v.string(), meetingKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userFields")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (!row) return { deleted: 0 };
    if (row.imageStorageIds) {
      for (const sid of row.imageStorageIds) await ctx.storage.delete(sid);
    }
    await ctx.db.delete(row._id);

    // ── 3-Gate side-effect ──
    // Unapproving the field UNLOCKS the meeting. Existing routed rows
    // stay routed (Pete only un-approves to re-edit, not to invalidate
    // history); they will re-route correctly on next persist if locked
    // again.
    const meeting = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (meeting && meeting.state === "locked") {
      await ctx.db.patch(meeting._id, {
        state: "draft",
        updatedAt: Date.now(),
      });
    }

    return { deleted: 1 };
  },
});
