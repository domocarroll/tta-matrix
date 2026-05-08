// ──────────────────────────────────────────────────────
// Stage 1 — meeting snapshots (Pete's "share to customers" links)
// ──────────────────────────────────────────────────────
//
// Pete corrects an aggregation, then publishes a frozen read-only view
// at /share/{token}. The token is unguessable; payload is whatever the
// client sends (already-aggregated + corrected). No auth on read by
// design — the link IS the auth.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Mint a share token. Returns { token, url-relative path }. */
export const create = mutation({
  args: {
    clientId: v.string(),
    meetingKey: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const token = randomToken();
    await ctx.db.insert("meetingSnapshots", {
      token,
      clientId: args.clientId,
      meetingKey: args.meetingKey,
      payload: args.payload,
      createdAt: Date.now(),
    });
    return { token };
  },
});

/** Public read of a snapshot by token. */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("meetingSnapshots")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!row) return null;
    return {
      meetingKey: row.meetingKey,
      payload: row.payload,
      createdAt: row.createdAt,
    };
  },
});

function randomToken(): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 22; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}
