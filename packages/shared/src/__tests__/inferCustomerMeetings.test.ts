import { describe, expect, test } from "vitest";
import {
  inferCustomerMeetings,
  type ExtractionSeed,
  type UserFieldSeed,
} from "../inferCustomerMeetings.ts";

describe("inferCustomerMeetings", () => {
  test("empty inputs → empty output", () => {
    expect(inferCustomerMeetings([], [])).toEqual([]);
  });

  test("single extraction without userField → draft", () => {
    const ex: ExtractionSeed[] = [
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        category: "SR",
        meeting: "Royal Randwick",
        creationTimeMs: 0,
      },
    ];
    expect(inferCustomerMeetings(ex, [])).toEqual([
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        date: "2026-05-29",
        category: "SR",
        name: "Royal Randwick",
        state: "draft",
      },
    ]);
  });

  test("single extraction WITH userField → locked", () => {
    const ex: ExtractionSeed[] = [
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        category: "SR",
        meeting: "Royal Randwick",
        creationTimeMs: 0,
      },
    ];
    const uf: UserFieldSeed[] = [{ meetingKey: "2026-05-29|SR|Royal Randwick" }];
    const r = inferCustomerMeetings(ex, uf);
    expect(r[0]?.state).toBe("locked");
  });

  test("dedupes duplicate extraction keys", () => {
    const ex: ExtractionSeed[] = [
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        category: "SR",
        meeting: "Royal Randwick",
        creationTimeMs: 0,
      },
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        category: "SR",
        meeting: "Royal Randwick",
        creationTimeMs: 1,
      },
    ];
    expect(inferCustomerMeetings(ex, [])).toHaveLength(1);
  });

  test("derives key from creationTimeMs when meetingKey absent", () => {
    const ms = Date.UTC(2026, 4, 29, 12, 0, 0);
    const ex: ExtractionSeed[] = [
      { category: "SR", meeting: "Royal Randwick", creationTimeMs: ms },
    ];
    const r = inferCustomerMeetings(ex, []);
    expect(r[0]?.meetingKey).toBe("2026-05-29|SR|Royal Randwick");
  });

  test("includes userField-only meetings (no tip landed yet)", () => {
    const r = inferCustomerMeetings(
      [],
      [{ meetingKey: "2026-05-29|MR|Caulfield" }],
    );
    expect(r).toEqual([
      {
        meetingKey: "2026-05-29|MR|Caulfield",
        date: "2026-05-29",
        category: "MR",
        name: "Caulfield",
        state: "locked",
      },
    ]);
  });

  test("output sorted by meetingKey for determinism", () => {
    const ex: ExtractionSeed[] = [
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        category: "SR",
        meeting: "Royal Randwick",
        creationTimeMs: 0,
      },
      {
        meetingKey: "2026-05-29|MR|Caulfield",
        category: "MR",
        meeting: "Caulfield",
        creationTimeMs: 0,
      },
    ];
    const r = inferCustomerMeetings(ex, []);
    expect(r.map((m) => m.meetingKey)).toEqual([
      "2026-05-29|MR|Caulfield",
      "2026-05-29|SR|Royal Randwick",
    ]);
  });

  test("multi-meeting mix — extractions + userFields combine", () => {
    const ex: ExtractionSeed[] = [
      {
        meetingKey: "2026-05-29|SR|Royal Randwick",
        category: "SR",
        meeting: "Royal Randwick",
        creationTimeMs: 0,
      },
      {
        meetingKey: "2026-05-29|MR|Caulfield",
        category: "MR",
        meeting: "Caulfield",
        creationTimeMs: 0,
      },
    ];
    const uf: UserFieldSeed[] = [
      { meetingKey: "2026-05-29|SR|Royal Randwick" }, // locks one
      { meetingKey: "2026-05-29|BR|Doomben" }, // adds a third
    ];
    const r = inferCustomerMeetings(ex, uf);
    const byKey = new Map(r.map((m) => [m.meetingKey, m.state]));
    expect(byKey.get("2026-05-29|SR|Royal Randwick")).toBe("locked");
    expect(byKey.get("2026-05-29|MR|Caulfield")).toBe("draft");
    expect(byKey.get("2026-05-29|BR|Doomben")).toBe("locked");
    expect(r).toHaveLength(3);
  });
});
