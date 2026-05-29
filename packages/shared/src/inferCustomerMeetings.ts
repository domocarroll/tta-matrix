// ──────────────────────────────────────────────────────
// 3-Gate workspace — pure backfill inference
// ──────────────────────────────────────────────────────
//
// Given the existing extractions + userFields for a client, derive the
// set of `customerMeetings` rows that should exist. Pure: no DB calls.
// The Convex mutation `customerMeetings.backfillForClient` is a thin
// wrapper that applies these rows idempotently.

import { buildMeetingKey } from "./meetingKey.ts";
import type { MeetingState } from "./meetingState.ts";

export interface ExtractionSeed {
  readonly meetingKey?: string;
  readonly category: string;
  readonly meeting: string;
  /** Convex `_creationTime` (ms) — used to derive the key when absent. */
  readonly creationTimeMs: number;
}

export interface UserFieldSeed {
  readonly meetingKey: string;
}

export interface InferredCustomerMeeting {
  readonly meetingKey: string;
  readonly date: string;
  readonly category: string;
  readonly name: string;
  readonly state: MeetingState;
}

/**
 * Derive `customerMeetings` rows from raw data. Dedupes by key. If a
 * userField row exists for the key the inferred row is `locked`,
 * otherwise `draft`.
 */
export function inferCustomerMeetings(
  extractions: ReadonlyArray<ExtractionSeed>,
  userFields: ReadonlyArray<UserFieldSeed>,
): InferredCustomerMeeting[] {
  const userFieldKeys = new Set(userFields.map((u) => u.meetingKey));
  const seen = new Map<string, InferredCustomerMeeting>();

  for (const ex of extractions) {
    const key =
      ex.meetingKey ?? buildMeetingKey(ex.category, ex.meeting, ex.creationTimeMs);
    if (seen.has(key)) continue;
    const [date = "", category = "OR", name = "Unknown"] = key.split("|");
    seen.set(key, {
      meetingKey: key,
      date,
      category,
      name,
      state: userFieldKeys.has(key) ? "locked" : "draft",
    });
  }

  // Also include user-field-only meetings (Pete uploaded a card but no
  // tip ever landed for it yet) so they appear in Gate 1 as locked.
  for (const u of userFields) {
    if (seen.has(u.meetingKey)) continue;
    const [date = "", category = "OR", name = "Unknown"] = u.meetingKey.split("|");
    seen.set(u.meetingKey, {
      meetingKey: u.meetingKey,
      date,
      category,
      name,
      state: "locked",
    });
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.meetingKey.localeCompare(b.meetingKey),
  );
}
