// ──────────────────────────────────────────────────────
// 3-Gate workspace — Customer meetings (Gate 1)
// ──────────────────────────────────────────────────────
//
// One row per (clientId, meetingKey). State machine:
//
//   draft  ── cards-uploaded ──> cards-pending ── field-approved ──> locked
//      └── field-approved ──────────────────────────────────────────> locked
//   locked ── field-unapproved ──> draft  (tips re-route on next persist)
//
// `state === 'locked'` is the load-bearing invariant: tips can only
// route to a locked meeting (enforced in `extractions.create`).

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const stateValidator = v.union(
  v.literal("draft"),
  v.literal("cards-pending"),
  v.literal("locked"),
);

function buildMeetingKey(
  date: string,
  category: string,
  meeting: string,
): string {
  const cat = (category || "OR").toUpperCase();
  const norm = (meeting || "Unknown").trim().replace(/\s+/g, " ");
  return `${date}|${cat}|${norm}`;
}

/** Create or return-existing a customer meeting (idempotent on key). */
export const create = mutation({
  args: {
    clientId: v.string(),
    date: v.string(),
    category: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const meetingKey = buildMeetingKey(args.date, args.category, args.name);
    const existing = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", meetingKey),
      )
      .unique();
    if (existing) {
      return { id: existing._id, meetingKey, created: false };
    }
    const now = Date.now();
    const id = await ctx.db.insert("customerMeetings", {
      clientId: args.clientId,
      meetingKey,
      date: args.date,
      category: (args.category || "OR").toUpperCase(),
      name: args.name.trim(),
      state: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return { id, meetingKey, created: true };
  },
});

export const listForClient = query({
  args: {
    clientId: v.string(),
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) => q.eq("clientId", args.clientId))
      .take(500);
    const since = args.sinceMs ?? 0;
    return rows
      .filter((r) => r.createdAt >= since)
      .map((r) => ({
        meetingKey: r.meetingKey,
        date: r.date,
        category: r.category,
        name: r.name,
        state: r.state,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
  },
});

/** Force-transition state. Permissive — Pete can rescue stuck meetings. */
export const setState = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
    state: stateValidator,
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (!row) return { ok: false as const, reason: "not_found" };
    await ctx.db.patch(row._id, {
      state: args.state,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/**
 * Remove a customer meeting and cascade the userFields row + corrections +
 * extractions tied to the same meetingKey. Used when Pete deletes a
 * meeting created by mistake.
 */
export const removeForMeeting = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    let deletedMeeting = 0;
    if (row) {
      await ctx.db.delete(row._id);
      deletedMeeting = 1;
    }
    const uf = await ctx.db
      .query("userFields")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    let deletedUserField = 0;
    if (uf) {
      await ctx.db.delete(uf._id);
      deletedUserField = 1;
    }
    return { deletedMeeting, deletedUserField };
  },
});

/**
 * Idempotent backfill: groups existing extractions by meetingKey for a
 * client and creates customerMeetings rows. If a userFields row exists
 * for the key, the meeting is created as `locked`; otherwise `draft`.
 * Triggered on first /work page load for a clientId.
 */
export const backfillForClient = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const extractions = await ctx.db
      .query("extractions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    const userFields = await ctx.db
      .query("userFields")
      .withIndex("by_client_meeting", (q) => q.eq("clientId", args.clientId))
      .collect();
    const existing = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) => q.eq("clientId", args.clientId))
      .collect();

    const userFieldKeys = new Set(userFields.map((u) => u.meetingKey));
    const existingKeys = new Set(existing.map((m) => m.meetingKey));

    interface Seed {
      date: string;
      category: string;
      name: string;
    }
    const seeds = new Map<string, Seed>();
    for (const row of extractions) {
      const key =
        row.meetingKey ??
        (() => {
          const d = new Date(row._creationTime);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(d.getUTCDate()).padStart(2, "0");
          const cat = (row.category || "OR").toUpperCase();
          const norm = (row.meeting || "Unknown").trim().replace(/\s+/g, " ");
          return `${yyyy}-${mm}-${dd}|${cat}|${norm}`;
        })();
      if (seeds.has(key)) continue;
      const [date = "", cat = "OR", name = "Unknown"] = key.split("|");
      seeds.set(key, { date, category: cat, name });
    }

    let inserted = 0;
    let relocked = 0;
    const now = Date.now();
    for (const [key, seed] of seeds) {
      if (existingKeys.has(key)) {
        const row = existing.find((m) => m.meetingKey === key);
        if (!row) continue;
        const shouldBeLocked = userFieldKeys.has(key);
        if (shouldBeLocked && row.state !== "locked") {
          await ctx.db.patch(row._id, { state: "locked", updatedAt: now });
          relocked += 1;
        }
        continue;
      }
      await ctx.db.insert("customerMeetings", {
        clientId: args.clientId,
        meetingKey: key,
        date: seed.date,
        category: seed.category,
        name: seed.name,
        state: userFieldKeys.has(key) ? "locked" : "draft",
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }
    return { inserted, relocked, alreadyPresent: existingKeys.size };
  },
});

/** Internal helper-shaped query used by /api/meetings GET (same response). */
export const getByKey = query({
  args: { clientId: v.string(), meetingKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("customerMeetings")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (!row) return null;
    return {
      meetingKey: row.meetingKey,
      date: row.date,
      category: row.category,
      name: row.name,
      state: row.state,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
});
