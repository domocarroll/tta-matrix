// ──────────────────────────────────────────────────────
// Regression test — the date-keyed routing bug (oracle B1).
//
// Pete plans Saturday's meeting on Friday. The server must resolve the
// locked meeting by (category, name) even when the extracted "today"
// (UTC) is a different day. Oracle blocked the first implementation
// because we matched on (date, category, name), reproducing the
// 24-Apr failure mode in a different shape.
//
// This is a pure-logic regression test — the actual routing lives in
// `extractions.create` (Convex), but the algorithm is the same shape:
// filter locked meetings by (cat, normalisedName) ignoring date.
// ──────────────────────────────────────────────────────

import { describe, expect, test } from "vitest";
import type { LockedMeeting } from "../routeExtraction.ts";

function normaliseName(raw: string): string {
  return (raw || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function resolveServerSide(
  extracted: { category: string; meeting: string },
  todayUtc: string,
  lockeds: ReadonlyArray<LockedMeeting>,
): { meetingKey: string | null; pickedFrom: number } {
  const cat = (extracted.category || "OR").toUpperCase();
  const name = normaliseName(extracted.meeting);
  const candidates = lockeds.filter(
    (m) => m.category.toUpperCase() === cat && normaliseName(m.name) === name,
  );
  if (candidates.length === 0) return { meetingKey: null, pickedFrom: 0 };
  if (candidates.length === 1) {
    return { meetingKey: candidates[0]!.meetingKey, pickedFrom: 1 };
  }
  const todayMatch = candidates.find((c) => c.date === todayUtc);
  if (todayMatch) {
    return { meetingKey: todayMatch.meetingKey, pickedFrom: candidates.length };
  }
  return { meetingKey: candidates[0]!.meetingKey, pickedFrom: candidates.length };
}

describe("3-gate routing invariant — Pete's Friday→Saturday case", () => {
  test("tip extracted on Friday UTC routes to a Saturday-locked meeting", () => {
    const lockeds: LockedMeeting[] = [
      {
        meetingKey: "2026-05-30|SR|Royal Randwick",
        date: "2026-05-30",
        category: "SR",
        name: "Royal Randwick",
      },
    ];
    const r = resolveServerSide(
      { category: "SR", meeting: "Royal Randwick" },
      "2026-05-29",
      lockeds,
    );
    expect(r.meetingKey).toBe("2026-05-30|SR|Royal Randwick");
  });

  test("two locked Royal Randwicks on different days — today wins", () => {
    const lockeds: LockedMeeting[] = [
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        date: "2026-05-29",
        category: "SR",
        name: "Royal Randwick",
      },
      {
        meetingKey: "2026-05-30|SR|Royal Randwick",
        date: "2026-05-30",
        category: "SR",
        name: "Royal Randwick",
      },
    ];
    const r = resolveServerSide(
      { category: "SR", meeting: "Royal Randwick" },
      "2026-05-30",
      lockeds,
    );
    expect(r.meetingKey).toBe("2026-05-30|SR|Royal Randwick");
  });

  test("no match → null (server persists as pending-meeting)", () => {
    const lockeds: LockedMeeting[] = [
      {
        meetingKey: "2026-05-30|SR|Royal Randwick",
        date: "2026-05-30",
        category: "SR",
        name: "Royal Randwick",
      },
    ];
    const r = resolveServerSide(
      { category: "MR", meeting: "Caulfield" },
      "2026-05-29",
      lockeds,
    );
    expect(r.meetingKey).toBeNull();
  });

  test("category mismatch fails even when name matches", () => {
    const lockeds: LockedMeeting[] = [
      {
        meetingKey: "2026-05-30|SR|Royal Randwick",
        date: "2026-05-30",
        category: "SR",
        name: "Royal Randwick",
      },
    ];
    const r = resolveServerSide(
      { category: "BR", meeting: "Royal Randwick" },
      "2026-05-29",
      lockeds,
    );
    expect(r.meetingKey).toBeNull();
  });

  test("case-insensitive name match (extracted vs locked)", () => {
    const lockeds: LockedMeeting[] = [
      {
        meetingKey: "2026-05-30|SR|Royal Randwick",
        date: "2026-05-30",
        category: "SR",
        name: "Royal Randwick",
      },
    ];
    const r = resolveServerSide(
      { category: "sr", meeting: "ROYAL RANDWICK" },
      "2026-05-29",
      lockeds,
    );
    expect(r.meetingKey).toBe("2026-05-30|SR|Royal Randwick");
  });
});
