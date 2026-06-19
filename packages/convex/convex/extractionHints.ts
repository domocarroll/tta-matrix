// Learned extraction corrections (compounding).
//
// A hint distilled from Pete's review — e.g. "Emergencies belong to the race
// above the block." Active hints are injected into the extraction prompt for
// future runs, scoped global / per-category / per-venue.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const scopeValidator = v.union(
  v.literal("global"),
  v.literal("category"),
  v.literal("venue"),
);

export const listForClient = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("extractionHints")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    return rows
      .filter((r) => r.active)
      .map((r) => ({
        id: r._id as unknown as string,
        scope: r.scope,
        category: r.category,
        venue: r.venue,
        hint: r.hint,
        source: r.source,
        createdAt: r.createdAt,
      }));
  },
});

export const add = mutation({
  args: {
    clientId: v.string(),
    scope: scopeValidator,
    category: v.optional(v.string()),
    venue: v.optional(v.string()),
    hint: v.string(),
    source: v.union(v.literal("manual"), v.literal("derived")),
  },
  handler: async (ctx, args) => {
    const hint = args.hint.trim();
    if (!hint) return { id: null, deduped: false };

    // De-dupe: identical active hint at the same scope already exists.
    const existing = await ctx.db
      .query("extractionHints")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    const dup = existing.find(
      (r) =>
        r.active &&
        r.hint.trim() === hint &&
        r.scope === args.scope &&
        (r.category ?? "") === (args.category ?? "") &&
        (r.venue ?? "") === (args.venue ?? ""),
    );
    if (dup) return { id: dup._id as unknown as string, deduped: true };

    const id = await ctx.db.insert("extractionHints", {
      clientId: args.clientId,
      scope: args.scope,
      category: args.category,
      venue: args.venue,
      hint,
      source: args.source,
      active: true,
      createdAt: Date.now(),
    });
    return { id: id as unknown as string, deduped: false };
  },
});

export const deactivate = mutation({
  args: { clientId: v.string(), id: v.id("extractionHints") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row && row.clientId === args.clientId) {
      await ctx.db.patch(args.id, { active: false });
    }
    return { ok: true };
  },
});
