// ──────────────────────────────────────────────────────
// TTA Matrix — meeting key helpers
// ──────────────────────────────────────────────────────
//
// A meeting key groups daily extractions by venue+code so the workspace
// can render one card per meeting. Format: `${YYYY-MM-DD}|${CAT}|${meeting}`.

import type { RaceCategory } from "./types.ts";

const VALID_CATEGORIES: ReadonlyArray<RaceCategory> = [
  "SR",
  "MR",
  "BR",
  "PR",
  "AR",
  "OR",
];

/** Build a meeting key for grouping. `whenMs` is an extraction creationTime. */
export function buildMeetingKey(
  category: string,
  meeting: string,
  whenMs: number,
): string {
  const d = new Date(whenMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;
  const cat = (category || "OR").toUpperCase();
  const norm = (meeting || "Unknown").trim().replace(/\s+/g, " ");
  return `${date}|${cat}|${norm}`;
}

/** Parse a meeting key back into its parts. */
export function parseMeetingKey(key: string): {
  date: string;
  category: RaceCategory;
  meeting: string;
} {
  const [date = "", cat = "OR", meeting = "Unknown"] = key.split("|");
  const category = (
    VALID_CATEGORIES.includes(cat as RaceCategory) ? cat : "OR"
  ) as RaceCategory;
  return { date, category, meeting };
}

/** YYYY-MM-DD for "today" in UTC — matches the buildMeetingKey calendar. */
export function todayUtc(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
