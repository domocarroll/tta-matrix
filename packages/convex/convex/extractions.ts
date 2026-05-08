// ──────────────────────────────────────────────────────
// Stage 1 — extractions API for customer history surface
// ──────────────────────────────────────────────────────
//
// The web app calls these from its SvelteKit server endpoints. Today
// `clientId` comes from a localStorage UUID; when real auth ships,
// derive it from `ctx.auth.getUserIdentity().tokenIdentifier` instead
// and update the validator accordingly.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const flagValidator = v.object({
  type: v.string(),
  race: v.optional(v.number()),
  description: v.string(),
});

// Validators are deliberately permissive — Pete's images vary and the
// agent occasionally omits `position` or `horseNumber`. We backfill in
// the handler instead of failing the whole persist.
const selectionValidator = v.object({
  position: v.optional(v.number()),
  horseName: v.string(),
  horseNumber: v.optional(v.number()),
});

const tipValidator = v.object({
  tipsterName: v.string(),
  selections: v.array(selectionValidator),
});

const raceValidator = v.object({
  raceNumber: v.number(),
  tips: v.array(tipValidator),
});

interface NormalisedSelection {
  position: number;
  horseName: string;
  horseNumber?: number;
}

interface IncomingSelection {
  position?: number;
  horseName: string;
  horseNumber?: number;
}

interface IncomingTip {
  tipsterName: string;
  selections: IncomingSelection[];
}

interface IncomingRace {
  raceNumber: number;
  tips: IncomingTip[];
}

interface NormalisedTip {
  tipsterName: string;
  selections: NormalisedSelection[];
}

interface NormalisedRace {
  raceNumber: number;
  tips: NormalisedTip[];
}

function normaliseRaces(races: IncomingRace[]): NormalisedRace[] {
  return races.map((race) => ({
    raceNumber: race.raceNumber,
    tips: race.tips.map((tip) => ({
      tipsterName: tip.tipsterName,
      selections: tip.selections.map((sel, i) => ({
        position: typeof sel.position === "number" ? sel.position : i + 1,
        horseName: sel.horseName,
        horseNumber: sel.horseNumber,
      })),
    })),
  }));
}

/** Generate an upload URL for direct browser → Convex storage uploads. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Build the workspace meeting key — `${YYYY-MM-DD}|${category}|${meeting}`. */
function buildMeetingKey(category: string, meeting: string, when: number): string {
  const d = new Date(when);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;
  const cat = (category || "OR").toUpperCase();
  const norm = (meeting || "Unknown").trim().replace(/\s+/g, " ");
  return `${date}|${cat}|${norm}`;
}

/** Persist a completed extraction for the current client. */
export const create = mutation({
  args: {
    clientId: v.string(),
    filename: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    publication: v.string(),
    meeting: v.string(),
    category: v.string(),
    tipstersDetected: v.array(v.string()),
    reasoning: v.array(v.string()),
    races: v.array(raceValidator),
    flags: v.array(flagValidator),
    tokensIn: v.number(),
    tokensOut: v.number(),
    durationMs: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const meetingKey = buildMeetingKey(args.category, args.meeting, Date.now());
    const races = normaliseRaces(args.races as IncomingRace[]);
    return await ctx.db.insert("extractions", { ...args, races, meetingKey });
  },
});

/**
 * List FULL extractions for a client since a given timestamp.
 * Powers the workspace surface — needs full race data so we can aggregate.
 */
export const listFullByClient = query({
  args: {
    clientId: v.string(),
    sinceMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const since = args.sinceMs ?? 0;
    const rows = await ctx.db
      .query("extractions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(args.limit ?? 200);
    return rows
      .filter((r) => r._creationTime >= since)
      .map((row) => ({
        _id: row._id,
        _creationTime: row._creationTime,
        filename: row.filename,
        publication: row.publication,
        meeting: row.meeting,
        category: row.category,
        tipstersDetected: row.tipstersDetected,
        reasoning: row.reasoning,
        races: row.races,
        flags: row.flags,
        tokensIn: row.tokensIn,
        tokensOut: row.tokensOut,
        durationMs: row.durationMs,
        model: row.model,
        meetingKey:
          row.meetingKey ??
          buildMeetingKey(row.category, row.meeting, row._creationTime),
      }));
  },
});

/** Backfill meetingKey on existing rows lacking one. Idempotent. */
export const backfillMeetingKeys = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("extractions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    let patched = 0;
    for (const row of rows) {
      if (row.meetingKey) continue;
      const meetingKey = buildMeetingKey(
        row.category,
        row.meeting,
        row._creationTime,
      );
      await ctx.db.patch(row._id, { meetingKey });
      patched += 1;
    }
    return { patched };
  },
});

/** List extractions for a given client, newest first. */
export const listByClient = query({
  args: {
    clientId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("extractions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(args.limit ?? 50);

    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      filename: row.filename,
      publication: row.publication,
      meeting: row.meeting,
      category: row.category,
      tipsterCount: row.tipstersDetected.length,
      raceCount: row.races.length,
      flagCount: row.flags.length,
      durationMs: row.durationMs,
      model: row.model,
      hasImage: row.imageStorageId !== undefined,
    }));
  },
});

/** Fetch a single extraction in full (for replay on the history detail page). */
export const getById = query({
  args: {
    id: v.id("extractions"),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    if (row.clientId !== args.clientId) {
      // Soft auth: row exists but doesn't belong to this client.
      return null;
    }
    let imageUrl: string | null = null;
    if (row.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(row.imageStorageId);
    }
    return { ...row, imageUrl };
  },
});

/**
 * Delete every extraction (and the correction overlay) for a meetingKey.
 * Pete uses this from the workspace to clear a meeting's data — useful
 * after he's exported and wants the slate clean for the next session.
 */
export const removeByMeetingKey = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("extractions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    let deleted = 0;
    for (const row of rows) {
      const key =
        row.meetingKey ??
        buildMeetingKey(row.category, row.meeting, row._creationTime);
      if (key !== args.meetingKey) continue;
      if (row.imageStorageId) await ctx.storage.delete(row.imageStorageId);
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    // Also clear corrections overlay for this meeting
    const correction = await ctx.db
      .query("meetingCorrections")
      .withIndex("by_client_meeting", (q) =>
        q.eq("clientId", args.clientId).eq("meetingKey", args.meetingKey),
      )
      .unique();
    if (correction) await ctx.db.delete(correction._id);
    return { deleted };
  },
});

/** Delete an extraction (only if it belongs to the requesting client). */
export const remove = mutation({
  args: {
    id: v.id("extractions"),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return { ok: false, reason: "not_found" as const };
    if (row.clientId !== args.clientId) {
      return { ok: false, reason: "wrong_client" as const };
    }
    if (row.imageStorageId) {
      await ctx.storage.delete(row.imageStorageId);
    }
    await ctx.db.delete(args.id);
    return { ok: true as const };
  },
});

/** Per-client stats (used on the history page header). */
export const statsByClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("extractions")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    const totalSelections = rows.reduce((n, row) => {
      return (
        n +
        row.races.reduce(
          (m: number, race: { tips: { selections: unknown[] }[] }) =>
            m + race.tips.reduce((k, tip) => k + tip.selections.length, 0),
          0,
        )
      );
    }, 0);

    const totalFlags = rows.reduce((n, row) => n + row.flags.length, 0);
    const artefactsStripped = rows.reduce(
      (n, row) =>
        n + row.flags.filter((f) => f.type === "publication_artefact_stripped").length,
      0,
    );

    return {
      extractionCount: rows.length,
      totalSelections,
      totalFlags,
      artefactsStripped,
      firstExtractionAt: rows.length > 0 ? rows[rows.length - 1]?._creationTime : null,
      latestExtractionAt: rows.length > 0 ? rows[0]?._creationTime : null,
    };
  },
});
