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

// v0 columns — order is contractual, Pete's customers parse this.
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

// Field-resolution enrichment — APPENDED after the v0 columns so the
// historical layout is byte-for-byte preserved when this is off.
const FIELD_HEADER = ["Jockey", "Trainer", "Barrier"];

function escape(field: string | number | undefined | null): string {
  if (field === undefined || field === null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build CSV body for a meeting's aggregated races.
 *
 * @param opts.includeFieldData when true, appends Jockey/Trainer/Barrier
 *   columns sourced from the resolved field (blank where a tip wasn't
 *   confidently matched). Default false → identical to the v0 export.
 */
export function buildMeetingCsv(
  races: ReadonlyArray<AggregatedRace>,
  meta: { meeting: string; date: string },
  opts: { includeFieldData?: boolean } = {},
): string {
  const withField = opts.includeFieldData === true;
  const header = withField ? [...HEADER, ...FIELD_HEADER] : HEADER;

  const lines: string[] = [];
  lines.push(`# ${meta.meeting} — ${meta.date}`);
  lines.push(header.map(escape).join(","));
  for (const race of races) {
    for (const tip of race.tips) {
      // Pete's formula (3 Jul 2026): tips on this horse ÷ total tips in the
      // race × 100, to two decimals. Column position/header unchanged.
      const tipPct =
        race.totalSelectionsInRace > 0
          ? ((tip.totalTips / race.totalSelectionsInRace) * 100).toFixed(2)
          : "0.00";
      const base = [
        race.category,
        race.raceNumber,
        tip.horseNumber ?? "",
        tip.horseName,
        tip.totalTips,
        tip.tipsterCount,
        race.totalTipstersInRace,
        tipPct,
        tip.winTips,
        tip.place2Tips,
        tip.place3Tips,
        tip.place4Tips,
      ];
      const row = withField
        ? [...base, tip.jockey ?? "", tip.trainer ?? "", tip.barrier ?? ""]
        : base;
      lines.push(row.map(escape).join(","));
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
