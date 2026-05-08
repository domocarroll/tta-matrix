// ──────────────────────────────────────────────────────
// TTA Matrix — Convex Schema (Ground Truth)
// ──────────────────────────────────────────────────────
//
// This is the single source of truth for all racing data.
// Meetings → Races → Horses (from scraper)
// Tips → Tipsters (from agent extraction)
// Predictions (from punters via Matrix bot)
// Aggregations (materialised views for performance)

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ────────────────────────────────────────────────
  // Race Infrastructure (populated by scraper)
  // ────────────────────────────────────────────────

  /** Race meetings — one per venue per day */
  meetings: defineTable({
    name: v.string(),
    date: v.string(),
    category: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("live"),
      v.literal("completed"),
    ),
    raceCount: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_status", ["status"])
    .index("by_date_name", ["date", "name"]),

  /** Individual races within a meeting */
  races: defineTable({
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
    result: v.optional(
      v.array(
        v.object({
          position: v.number(),
          horseName: v.string(),
          horseNumber: v.number(),
        }),
      ),
    ),
  })
    .index("by_meeting", ["meetingId"])
    .index("by_meeting_number", ["meetingId", "raceNumber"])
    .index("by_status", ["status"]),

  /** Horses in each race (from scraper form guide data) */
  horses: defineTable({
    raceId: v.id("races"),
    horseNumber: v.number(),
    horseName: v.string(),
    jockey: v.string(),
    trainer: v.string(),
    weight: v.number(),
    barrier: v.number(),
    scratched: v.boolean(),
    lastStartForm: v.optional(v.string()),
  })
    .index("by_race", ["raceId"])
    .index("by_race_number", ["raceId", "horseNumber"])
    .index("by_name", ["horseName"]),

  // ────────────────────────────────────────────────
  // Tip Intelligence (populated by agent)
  // ────────────────────────────────────────────────

  /** Extracted tips from images or manual input */
  tips: defineTable({
    raceId: v.id("races"),
    tipsterId: v.id("tipsters"),
    selections: v.array(
      v.object({
        position: v.number(),
        horseName: v.string(),
        horseNumber: v.optional(v.number()),
      }),
    ),
    source: v.union(
      v.literal("image"),
      v.literal("manual"),
      v.literal("api"),
    ),
    sourceImageId: v.optional(v.string()),
    extractedAt: v.number(),
    confidence: v.optional(v.number()),
  })
    .index("by_race", ["raceId"])
    .index("by_tipster", ["tipsterId"])
    .index("by_race_tipster", ["raceId", "tipsterId"]),

  /** Tipster profiles with rolling performance stats */
  tipsters: defineTable({
    name: v.string(),
    matrixUserId: v.optional(v.string()),
    type: v.union(
      v.literal("newspaper"),
      v.literal("punter"),
      v.literal("algorithm"),
    ),
    stats: v.object({
      totalTips: v.number(),
      wins: v.number(),
      places: v.number(),
      strikeRate: v.number(),
      roi: v.number(),
      lastUpdated: v.number(),
    }),
    zkIdentityCommitment: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .searchIndex("search_name", { searchField: "name" }),

  // ────────────────────────────────────────────────
  // Prediction Market (Phase 3)
  // ────────────────────────────────────────────────

  /** Punter predictions with play-money stakes */
  predictions: defineTable({
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
    status: v.union(
      v.literal("open"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("void"),
    ),
    payout: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_race", ["raceId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_race_user", ["raceId", "userId"]),

  // ────────────────────────────────────────────────
  // Materialised Views
  // ────────────────────────────────────────────────

  /** Pre-computed aggregations for fast retrieval */
  aggregations: defineTable({
    raceId: v.id("races"),
    data: v.any(),
    generatedAt: v.number(),
  }).index("by_race", ["raceId"]),

  // ────────────────────────────────────────────────
  // Stage 1: Customer-facing extraction history
  // ────────────────────────────────────────────────
  //
  // `clientId` is a per-browser UUID stored in localStorage. When real
  // auth lands, swap this for `tokenIdentifier` from `ctx.auth.getUser
  // Identity()` — the rest of the queries don't change.

  /** Per-customer extraction history surface (the "v0 replacement" data). */
  extractions: defineTable({
    clientId: v.string(),
    filename: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    publication: v.string(),
    meeting: v.string(),
    category: v.string(),
    tipstersDetected: v.array(v.string()),
    reasoning: v.array(v.string()),
    races: v.any(),
    flags: v.array(
      v.object({
        type: v.string(),
        race: v.optional(v.number()),
        description: v.string(),
      }),
    ),
    tokensIn: v.number(),
    tokensOut: v.number(),
    durationMs: v.number(),
    model: v.string(),
    /** Workspace key — `${YYYY-MM-DD}|${category}|${meeting}` for daily grouping. */
    meetingKey: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_client_meeting", ["clientId", "meetingKey"]),

  // ────────────────────────────────────────────────
  // Workspace corrections — Pete's review/edit overlay
  // ────────────────────────────────────────────────
  //
  // Aggregations are computed on the fly. Pete's edits sit on top as an
  // overlay so the agentic ground truth is preserved (audit trail), and
  // exports use the corrected values.

  /** One row per (clientId, meetingKey). Patches are merged on read. */
  meetingCorrections: defineTable({
    clientId: v.string(),
    meetingKey: v.string(),
    /** Free-form display label override, e.g. "Randwick Saturday 10 May". */
    label: v.optional(v.string()),
    /** Notes Pete wants attached to the meeting export. */
    notes: v.optional(v.string()),
    /** Per-horse patches keyed by `R{raceNumber}|${normalisedOriginalName}`. */
    horsePatches: v.array(
      v.object({
        raceNumber: v.number(),
        originalName: v.string(),
        action: v.union(
          v.literal("rename"),
          v.literal("renumber"),
          v.literal("remove"),
        ),
        newHorseName: v.optional(v.string()),
        newHorseNumber: v.optional(v.number()),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_client_meeting", ["clientId", "meetingKey"]),

  /** Public read-only snapshots for Pete's "share to customers" links. */
  meetingSnapshots: defineTable({
    /** Random url-safe token used in the share link. */
    token: v.string(),
    clientId: v.string(),
    meetingKey: v.string(),
    /** Frozen aggregated payload at share time. */
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_token", ["token"]),
});
