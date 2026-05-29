// ──────────────────────────────────────────────────────
// 3-Gate routing — pure post-extraction matcher
// ──────────────────────────────────────────────────────
//
// Given a freshly extracted (date, category, meeting) triple and the
// current set of LOCKED customer meetings, decide whether the tip
// lands in a locked meeting (`routed`) or surfaces as `pending` for
// Pete to resolve in Gate 2 → Gate 1.
//
// Pure: no network, no side effects. Deterministic. Match by exact
// normalised (date, category, normalisedName) — we do NOT fuzz at
// this stage. Fuzzy is exhausted in fieldMatch.ts already; here we
// want loud failure ("this tip didn't land — what meeting did you
// mean?") instead of guessing the wrong one.

import { buildMeetingKey } from "./meetingKey.ts";

export interface ExtractedTarget {
  readonly meeting: string;
  readonly category: string;
  /** YYYY-MM-DD. */
  readonly date: string;
}

export interface LockedMeeting {
  readonly meetingKey: string;
  readonly date: string;
  readonly category: string;
  readonly name: string;
}

export type RouteResult =
  | {
      readonly routed: true;
      readonly meetingKey: string;
    }
  | {
      readonly routed: false;
      readonly reason: RouteFailureReason;
      readonly derivedKey: string;
    };

export type RouteFailureReason =
  | "no_locked_meeting_for_key"
  | "missing_date"
  | "missing_meeting_name";

/** Normalise a meeting name for compare — title-case + collapse whitespace. */
function normaliseName(raw: string): string {
  return (raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normaliseCategory(raw: string): string {
  return (raw || "OR").toUpperCase();
}

/**
 * Match a freshly extracted meeting against the locked-meeting registry.
 *
 * - Empty/missing date → `missing_date`.
 * - Empty/missing name → `missing_meeting_name`.
 * - Otherwise, build the canonical key (same algorithm as
 *   `buildMeetingKey`) and look it up against the supplied lockeds. If
 *   no exact match, the route fails with `no_locked_meeting_for_key`
 *   AND the derivedKey is returned so the caller (Gate 2 UI) can offer
 *   Pete a one-click jump to Gate 1 prefilled from it.
 */
export function routeExtraction(
  extracted: ExtractedTarget,
  lockedMeetings: ReadonlyArray<LockedMeeting>,
): RouteResult {
  const date = (extracted.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { routed: false, reason: "missing_date", derivedKey: "" };
  }
  const name = (extracted.meeting || "").trim();
  if (name.length === 0) {
    return { routed: false, reason: "missing_meeting_name", derivedKey: "" };
  }

  const cat = normaliseCategory(extracted.category);
  // buildMeetingKey takes whenMs; we already have the date string so
  // bypass the date-derivation and use the exact format directly.
  const derivedKey = `${date}|${cat}|${name.replace(/\s+/g, " ")}`;

  const normTarget = normaliseName(name);
  for (const m of lockedMeetings) {
    if (m.date !== date) continue;
    if (normaliseCategory(m.category) !== cat) continue;
    if (normaliseName(m.name) !== normTarget) continue;
    return { routed: true, meetingKey: m.meetingKey };
  }

  return {
    routed: false,
    reason: "no_locked_meeting_for_key",
    derivedKey,
  };
}

/**
 * Convenience: returns just the key the extraction WOULD live in,
 * regardless of routing outcome. Useful for grouping pending rows.
 */
export function deriveMeetingKeyFromExtraction(
  extracted: ExtractedTarget,
  fallbackWhenMs: number,
): string {
  const date = (extracted.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const cat = normaliseCategory(extracted.category);
    const norm = (extracted.meeting || "Unknown").trim().replace(/\s+/g, " ");
    return `${date}|${cat}|${norm}`;
  }
  return buildMeetingKey(extracted.category, extracted.meeting, fallbackWhenMs);
}
