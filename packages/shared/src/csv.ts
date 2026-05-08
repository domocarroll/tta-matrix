// ──────────────────────────────────────────────────────
// TTA Matrix — CSV export (ported from v0)
// ──────────────────────────────────────────────────────
//
// v0 schema:
// Category, Race, Horse Number, Horse Name,
// Total Tips, Tipster Count, Total Tipsters In Race,
// Win Tips, 2nd, 3rd, 4th
//
// Pete's customers expect this layout. Don't change column order.

import type { AggregatedRace } from "./types.ts";

const HEADER = [
  "Category",
  "Race",
  "Horse Number",
  "Horse Name",
  "Total Tips",
  "Tipster Count",
  "Total Tipsters In Race",
  "Tipster %",
  "Win Tips",
  "2nd",
  "3rd",
  "4th",
];

function escape(field: string | number | undefined | null): string {
  if (field === undefined || field === null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV body for a meeting's aggregated races. */
export function buildMeetingCsv(
  races: ReadonlyArray<AggregatedRace>,
  meta: { meeting: string; date: string },
): string {
  const lines: string[] = [];
  lines.push(`# ${meta.meeting} — ${meta.date}`);
  lines.push(HEADER.map(escape).join(","));
  for (const race of races) {
    for (const tip of race.tips) {
      const tipsterPct =
        race.totalTipstersInRace > 0
          ? Math.round((tip.tipsterCount / race.totalTipstersInRace) * 100)
          : 0;
      lines.push(
        [
          race.category,
          race.raceNumber,
          tip.horseNumber ?? "",
          tip.horseName,
          tip.totalTips,
          tip.tipsterCount,
          race.totalTipstersInRace,
          tipsterPct,
          tip.winTips,
          tip.place2Tips,
          tip.place3Tips,
          tip.place4Tips,
        ]
          .map(escape)
          .join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}

/** Filename: `tipsheet_{meeting}_{YYYY-MM-DD}.csv` (URL-safe). */
export function buildCsvFilename(meeting: string, date: string): string {
  const slug = meeting
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `tipsheet_${slug}_${date}.csv`;
}
