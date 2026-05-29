import { describe, expect, test } from "vitest";
import {
  routeExtraction,
  deriveMeetingKeyFromExtraction,
  type LockedMeeting,
} from "../routeExtraction.ts";

const lockeds: LockedMeeting[] = [
  {
    meetingKey: "2026-05-29|SR|Royal Randwick",
    date: "2026-05-29",
    category: "SR",
    name: "Royal Randwick",
  },
  {
    meetingKey: "2026-05-29|MR|Caulfield",
    date: "2026-05-29",
    category: "MR",
    name: "Caulfield",
  },
];

describe("routeExtraction", () => {
  test("exact match routes", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "Royal Randwick" },
      lockeds,
    );
    expect(r).toEqual({ routed: true, meetingKey: "2026-05-29|SR|Royal Randwick" });
  });

  test("case-insensitive name match routes", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "royal randwick" },
      lockeds,
    );
    expect(r.routed).toBe(true);
  });

  test("case-insensitive category match routes", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "sr", meeting: "Royal Randwick" },
      lockeds,
    );
    expect(r.routed).toBe(true);
  });

  test("collapses whitespace before matching", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "  Royal   Randwick " },
      lockeds,
    );
    expect(r.routed).toBe(true);
  });

  test("mismatch on date fails with derivedKey", () => {
    const r = routeExtraction(
      { date: "2026-05-30", category: "SR", meeting: "Royal Randwick" },
      lockeds,
    );
    expect(r).toEqual({
      routed: false,
      reason: "no_locked_meeting_for_key",
      derivedKey: "2026-05-30|SR|Royal Randwick",
    });
  });

  test("mismatch on category fails", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "BR", meeting: "Royal Randwick" },
      lockeds,
    );
    expect(r.routed).toBe(false);
  });

  test("mismatch on name fails", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "Rosehill" },
      lockeds,
    );
    expect(r.routed).toBe(false);
  });

  test("missing date fails distinctly", () => {
    const r = routeExtraction(
      { date: "", category: "SR", meeting: "Royal Randwick" },
      lockeds,
    );
    expect(r.routed).toBe(false);
    if (!r.routed) expect(r.reason).toBe("missing_date");
  });

  test("malformed date fails as missing_date", () => {
    const r = routeExtraction(
      { date: "29/05/2026", category: "SR", meeting: "Royal Randwick" },
      lockeds,
    );
    expect(r.routed).toBe(false);
    if (!r.routed) expect(r.reason).toBe("missing_date");
  });

  test("missing meeting name fails distinctly", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "" },
      lockeds,
    );
    expect(r.routed).toBe(false);
    if (!r.routed) expect(r.reason).toBe("missing_meeting_name");
  });

  test("empty locked list returns derivedKey", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "Royal Randwick" },
      [],
    );
    expect(r).toEqual({
      routed: false,
      reason: "no_locked_meeting_for_key",
      derivedKey: "2026-05-29|SR|Royal Randwick",
    });
  });

  test("does NOT fuzzy match — typo fails loud", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "SR", meeting: "Royal Randwik" }, // typo
      lockeds,
    );
    expect(r.routed).toBe(false);
  });

  test("two locked meetings same date+cat — picks the right one", () => {
    const r = routeExtraction(
      { date: "2026-05-29", category: "MR", meeting: "Caulfield" },
      lockeds,
    );
    expect(r).toEqual({ routed: true, meetingKey: "2026-05-29|MR|Caulfield" });
  });
});

describe("deriveMeetingKeyFromExtraction", () => {
  test("uses date when present", () => {
    expect(
      deriveMeetingKeyFromExtraction(
        { date: "2026-05-29", category: "SR", meeting: "Royal Randwick" },
        0,
      ),
    ).toBe("2026-05-29|SR|Royal Randwick");
  });

  test("falls back to whenMs when date missing", () => {
    const ms = Date.UTC(2026, 4, 29, 12, 0, 0); // 2026-05-29 UTC
    const k = deriveMeetingKeyFromExtraction(
      { date: "", category: "SR", meeting: "Royal Randwick" },
      ms,
    );
    expect(k).toBe("2026-05-29|SR|Royal Randwick");
  });

  test("upper-cases category", () => {
    expect(
      deriveMeetingKeyFromExtraction(
        { date: "2026-05-29", category: "sr", meeting: "X" },
        0,
      ),
    ).toBe("2026-05-29|SR|X");
  });
});
