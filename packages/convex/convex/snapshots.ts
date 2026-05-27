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

// The Convex runtime exposes the Web Crypto API as a global `crypto`, but the
// typecheck tsconfig uses `lib: ES2022` (no DOM lib), so we declare just the
// surface we use here. This keeps snapshots.ts typechecking cleanly without
// touching the shared tsconfig.
declare const crypto: { getRandomValues(array: Uint8Array): Uint8Array };

/**
 * Mint a 22-char url-safe token using the Convex runtime's Web Crypto global.
 * `crypto.getRandomValues` is cryptographically secure (unlike Math.random,
 * whose output is predictable and would make share links guessable).
 *
 * Rejection sampling keeps the distribution uniform across the 62-char
 * alphabet: a byte is only consumed if it falls within the largest multiple
 * of 62 (<=247), so no character is over-represented by the modulo bias.
 */
function randomToken(): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const tokenLength = 22;
  const max = Math.floor(256 / alphabet.length) * alphabet.length; // 248

  const chars: string[] = [];
  while (chars.length < tokenLength) {
    const bytes = new Uint8Array(tokenLength);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= max) continue; // discard to avoid modulo bias
      chars.push(alphabet.charAt(byte % alphabet.length));
      if (chars.length === tokenLength) break;
    }
  }
  return chars.join("");
}
