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
    // ── Field resolution metadata (Perplexity-backed, additive/optional) ──
    // Set when the authoritative runner field has been resolved for this
    // meeting. Absent on legacy/unresolved rows — readers must tolerate
    // undefined and degrade to tip-only aggregation.
    fieldStatus: v.optional(
      v.union(v.literal("resolved"), v.literal("unavailable")),
    ),
    /** e.g. "perplexity:sonar-pro" */
    fieldSource: v.optional(v.string()),
    fieldFetchedAt: v.optional(v.number()),
    /** Source URLs Perplexity grounded the field on (audit trail). */
    fieldCitations: v.optional(v.array(v.string())),
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
    // ── 3-Gate routing (additive — legacy rows = state undefined → routed) ──
    /**
     * `routed` = landed in a locked customerMeeting.
     * `pending-meeting` = no locked meeting for derived key; surfaced in
     * Gate 2 for Pete to fix.
     */
    state: v.optional(
      v.union(v.literal("routed"), v.literal("pending-meeting")),
    ),
    /** Reason a row is pending, e.g. "no_locked_meeting_for_key". */
    pendingReason: v.optional(v.string()),
    /**
     * Client-generated idempotency key for the durable write outbox. The
     * client retries a persist (on error, reconnect, or next page load) with
     * the SAME key; `create` returns the existing row instead of inserting a
     * duplicate. Absent on legacy rows.
     */
    clientTxId: v.optional(v.string()),
  })
    .index("by_client", ["clientId"])
    .index("by_client_meeting", ["clientId", "meetingKey"])
    .index("by_client_tx", ["clientId", "clientTxId"]),

  // ────────────────────────────────────────────────
  // 3-Gate workspace — Customer meeting registry (Gate 1)
  // ────────────────────────────────────────────────
  //
  // One row per (clientId, meetingKey). `state === 'locked'` is the
  // load-bearing invariant: tips can only route to a locked meeting.
  // Denormalised mirror of "userFields row exists + approved" for cheap
  // lookups during /api/persist.

  customerMeetings: defineTable({
    clientId: v.string(),
    meetingKey: v.string(),
    date: v.string(),
    category: v.string(),
    name: v.string(),
    state: v.union(
      v.literal("draft"),
      v.literal("cards-pending"),
      v.literal("locked"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_client_meeting", ["clientId", "meetingKey"])
    .index("by_client_date", ["clientId", "date"]),

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
    /**
     * Per-horse patches keyed by `R{raceNumber}|${normalisedOriginalName}`.
     * `action` is legacy (rename/renumber/remove). New patches use any of
     * the optional override fields directly; `removed: true` removes.
     */
    horsePatches: v.array(
      v.object({
        raceNumber: v.number(),
        originalName: v.string(),
        action: v.optional(
          v.union(
            v.literal("rename"),
            v.literal("renumber"),
            v.literal("remove"),
          ),
        ),
        removed: v.optional(v.boolean()),
        newHorseName: v.optional(v.string()),
        newHorseNumber: v.optional(v.number()),
        newTotalTips: v.optional(v.number()),
        newTipsterCount: v.optional(v.number()),
        newWinTips: v.optional(v.number()),
        newPlace2Tips: v.optional(v.number()),
        newPlace3Tips: v.optional(v.number()),
        newPlace4Tips: v.optional(v.number()),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_client_meeting", ["clientId", "meetingKey"]),

  // ────────────────────────────────────────────────
  // User-approved authoritative field (Pete uploads race cards)
  // ────────────────────────────────────────────────
  //
  // Pete drops the official race-card image(s) per meeting. We extract
  // {number, name, jockey, trainer, barrier, scratched} via Claude, he
  // reviews + approves, and the approved field anchors tip aggregation
  // for that meetingKey — takes priority over Perplexity / scraped data.
  //
  // One row per (clientId, meetingKey). Re-uploading replaces.

  userFields: defineTable({
    clientId: v.string(),
    meetingKey: v.string(),
    races: v.array(
      v.object({
        raceNumber: v.number(),
        distance: v.optional(v.number()),
        runners: v.array(
          v.object({
            number: v.number(),
            name: v.string(),
            jockey: v.optional(v.string()),
            trainer: v.optional(v.string()),
            barrier: v.optional(v.number()),
            scratched: v.optional(v.boolean()),
            /** Reserve/emergency runner — belongs to this race, only starts on a scratching. */
            emergency: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
    sourceFilenames: v.array(v.string()),
    /** Persisted official card image(s) backing this field — for re-extraction. */
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    approvedAt: v.number(),
  }).index("by_client_meeting", ["clientId", "meetingKey"]),

  // ────────────────────────────────────────────────
  // Compounding: learned extraction corrections
  // ────────────────────────────────────────────────
  //
  // When Pete corrects an extraction ("emergencies belong to the race
  // above"), the fix can be saved as a standing hint scoped to this client
  // (optionally narrowed to a category or venue). Active hints are injected
  // into the extraction system prompt for future runs, so a correction made
  // once compounds — the system gets better at THIS customer's layouts.

  extractionHints: defineTable({
    clientId: v.string(),
    /** global = always; category = when category matches; venue = when venue matches. */
    scope: v.union(v.literal("global"), v.literal("category"), v.literal("venue")),
    category: v.optional(v.string()),
    venue: v.optional(v.string()),
    hint: v.string(),
    /** manual = Pete wrote it; derived = distilled from a correction he made. */
    source: v.union(v.literal("manual"), v.literal("derived")),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_client", ["clientId"]),

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
