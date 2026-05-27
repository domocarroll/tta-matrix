import { describe, it, expect } from "vitest";
import { matchField } from "../fieldMatch.ts";
import type { FieldRunner } from "../fieldMatch.ts";
import type { AggregatedRace, AggregatedTip } from "../types.ts";

// ──────────────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────────────

function makeTip(overrides: Partial<AggregatedTip> & { horseName: string }): AggregatedTip {
  return {
    horseNumber: undefined,
    totalTips: 1,
    tipsterCount: 1,
    winTips: 1,
    place2Tips: 0,
    place3Tips: 0,
    place4Tips: 0,
    ...overrides,
  };
}

function makeRace(tips: AggregatedTip[], raceNumber = 1): AggregatedRace {
  return {
    category: "SR",
    raceNumber,
    meetingName: "Randwick",
    tips,
    totalSelectionsInRace: tips.reduce((s, t) => s + t.totalTips, 0),
    totalTipstersInRace: 3,
  };
}

function makeRunner(overrides: Partial<FieldRunner> & { number: number; name: string }): FieldRunner {
  return {
    jockey: "J. Smith",
    trainer: "T. Jones",
    barrier: 4,
    scratched: false,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────
// Exact / canonical matching
// ──────────────────────────────────────────────────────

describe("matchField — exact match", () => {
  it("anchors a tip to the field runner (canonical name + authoritative number)", () => {
    const race = makeRace([makeTip({ horseName: "winx", horseNumber: 99 })]);
    const field: FieldRunner[] = [
      makeRunner({ number: 7, name: "Winx", jockey: "H. Bowman", trainer: "C. Waller", barrier: 3 }),
    ];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips).toHaveLength(1);
    const tip = out.tips[0]!;
    expect(tip.horseName).toBe("Winx");
    expect(tip.horseNumber).toBe(7);
    expect(tip.jockey).toBe("H. Bowman");
    expect(tip.trainer).toBe("C. Waller");
    expect(tip.barrier).toBe(3);
    expect(tip.fieldMatched).toBe(true);
  });

  it("matches case-insensitively and ignoring punctuation/spacing", () => {
    const race = makeRace([makeTip({ horseName: "  O'Reilly's  PRIDE!! " })]);
    const field: FieldRunner[] = [makeRunner({ number: 2, name: "OReillys Pride" })];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips[0]!.horseName).toBe("OReillys Pride");
    expect(out.tips[0]!.horseNumber).toBe(2);
  });

  it("matches via token-set equality (word order differences)", () => {
    const race = makeRace([makeTip({ horseName: "Strip Nature" })]);
    const field: FieldRunner[] = [makeRunner({ number: 4, name: "Nature Strip" })];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips[0]!.horseName).toBe("Nature Strip");
    expect(out.tips[0]!.fieldMatched).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// OCR noise — the "xxxxCall Me Gorgeous" bug class
// ──────────────────────────────────────────────────────

describe("matchField — OCR leading-noise stripping", () => {
  it('strips an "xxxx" prefix and matches "Call Me Gorgeous" #5', () => {
    const race = makeRace([makeTip({ horseName: "xxxxCall Me Gorgeous" })]);
    const field: FieldRunner[] = [
      makeRunner({ number: 5, name: "Call Me Gorgeous", jockey: "J. McDonald" }),
    ];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips).toHaveLength(1);
    expect(out.tips[0]!.horseName).toBe("Call Me Gorgeous");
    expect(out.tips[0]!.horseNumber).toBe(5);
    expect(out.tips[0]!.jockey).toBe("J. McDonald");
    expect(out.tips[0]!.fieldMatched).toBe(true);
  });

  it('strips an "xx " noise token prefix', () => {
    const race = makeRace([makeTip({ horseName: "xx Sunlight" })]);
    const field: FieldRunner[] = [makeRunner({ number: 1, name: "Sunlight" })];

    const { race: out } = matchField(race, field);

    expect(out.tips[0]!.horseName).toBe("Sunlight");
    expect(out.tips[0]!.horseNumber).toBe(1);
  });
});

// ──────────────────────────────────────────────────────
// Fuzzy (Jaro-Winkler) matching + thresholds
// ──────────────────────────────────────────────────────

describe("matchField — fuzzy threshold behaviour", () => {
  it("matches a minor misspelling above the similarity threshold", () => {
    const race = makeRace([makeTip({ horseName: "Verry Eleegant" })]);
    const field: FieldRunner[] = [makeRunner({ number: 8, name: "Verry Elleegant" })];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips[0]!.horseName).toBe("Verry Elleegant");
    expect(out.tips[0]!.fieldMatched).toBe(true);
  });

  it("leaves a below-threshold typo unmatched and flags it", () => {
    const race = makeRace([makeTip({ horseName: "Zxqvbn" })]);
    const field: FieldRunner[] = [makeRunner({ number: 3, name: "Thunderbolt" })];

    const { race: out, flags } = matchField(race, field);

    expect(out.tips).toHaveLength(1);
    expect(out.tips[0]!.horseName).toBe("Zxqvbn");
    expect(out.tips[0]!.fieldMatched).toBeFalsy();
    expect(flags).toHaveLength(1);
    expect(flags[0]!.type).toBe("unmatched_runner");
    expect(flags[0]!.race).toBe(1);
    expect(flags[0]!.description).toContain("Zxqvbn");
  });

  it("does NOT match (or merge) on an ambiguous near-tie — regression guard", () => {
    // "Storm King" is near-equidistant to two similarly named runners.
    const race = makeRace([makeTip({ horseName: "Storm Kingg" })]);
    const field: FieldRunner[] = [
      makeRunner({ number: 1, name: "Storm King" }),
      makeRunner({ number: 2, name: "Storm Kong" }),
    ];

    const { race: out, flags } = matchField(race, field);

    // Ambiguous → must NOT guess.
    expect(out.tips).toHaveLength(1);
    expect(out.tips[0]!.fieldMatched).toBeFalsy();
    expect(flags).toHaveLength(1);
    expect(flags[0]!.type).toBe("unmatched_runner");
  });
});

// ──────────────────────────────────────────────────────
// Duplicate-row merge (the core dup-row fix)
// ──────────────────────────────────────────────────────

describe("matchField — duplicate-row merge", () => {
  it("merges two spellings of the same runner into one summed row", () => {
    const race = makeRace([
      makeTip({
        horseName: "xxxxCall Me Gorgeous",
        totalTips: 3,
        tipsterCount: 2,
        winTips: 2,
        place2Tips: 1,
        place3Tips: 0,
        place4Tips: 0,
      }),
      makeTip({
        horseName: "Call Me Gorgeous",
        totalTips: 2,
        tipsterCount: 2,
        winTips: 1,
        place2Tips: 0,
        place3Tips: 1,
        place4Tips: 0,
      }),
    ]);
    const field: FieldRunner[] = [makeRunner({ number: 5, name: "Call Me Gorgeous" })];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips).toHaveLength(1);
    const merged = out.tips[0]!;
    expect(merged.horseName).toBe("Call Me Gorgeous");
    expect(merged.horseNumber).toBe(5);
    expect(merged.totalTips).toBe(5);
    expect(merged.winTips).toBe(3);
    expect(merged.place2Tips).toBe(1);
    expect(merged.place3Tips).toBe(1);
    expect(merged.place4Tips).toBe(0);
    expect(merged.tipsterCount).toBe(4); // union of counts
    expect(merged.fieldMatched).toBe(true);
  });

  it("re-sorts merged tips by totalTips desc, then winTips desc", () => {
    const race = makeRace([
      makeTip({ horseName: "Underdog", totalTips: 4, winTips: 1 }),
      makeTip({ horseName: "Favourite A", totalTips: 3, winTips: 3 }),
      makeTip({ horseName: "Favorite A", totalTips: 3, winTips: 1 }), // merges into Favourite A
    ]);
    const field: FieldRunner[] = [
      makeRunner({ number: 1, name: "Underdog" }),
      makeRunner({ number: 2, name: "Favourite A" }),
    ];

    const { race: out } = matchField(race, field);

    expect(out.tips).toHaveLength(2);
    // Favourite A merged → 6 total tips, beats Underdog's 4
    expect(out.tips[0]!.horseName).toBe("Favourite A");
    expect(out.tips[0]!.totalTips).toBe(6);
    expect(out.tips[1]!.horseName).toBe("Underdog");
  });
});

// ──────────────────────────────────────────────────────
// Scratched runner
// ──────────────────────────────────────────────────────

describe("matchField — scratched runner", () => {
  it("keeps the tip but flags tip_on_scratched", () => {
    const race = makeRace([makeTip({ horseName: "Late Scratch" })]);
    const field: FieldRunner[] = [
      makeRunner({ number: 6, name: "Late Scratch", scratched: true }),
    ];

    const { race: out, flags } = matchField(race, field);

    expect(out.tips).toHaveLength(1);
    expect(out.tips[0]!.horseName).toBe("Late Scratch");
    expect(out.tips[0]!.horseNumber).toBe(6);
    expect(out.tips[0]!.fieldMatched).toBe(true);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.type).toBe("tip_on_scratched");
    expect(flags[0]!.race).toBe(1);
    expect(flags[0]!.description).toContain("Late Scratch");
  });
});

// ──────────────────────────────────────────────────────
// Unmatched (absent from field)
// ──────────────────────────────────────────────────────

describe("matchField — tipped horse absent from field", () => {
  it("keeps the tip verbatim and adds an unmatched_runner flag", () => {
    const race = makeRace([
      makeTip({ horseName: "Phantom Horse" }),
      makeTip({ horseName: "Real Runner" }),
    ]);
    const field: FieldRunner[] = [makeRunner({ number: 1, name: "Real Runner" })];

    const { race: out, flags } = matchField(race, field);

    expect(out.tips).toHaveLength(2);
    const phantom = out.tips.find((t) => t.horseName === "Phantom Horse")!;
    expect(phantom).toBeDefined();
    expect(phantom.fieldMatched).toBeFalsy();

    expect(flags).toHaveLength(1);
    expect(flags[0]!.type).toBe("unmatched_runner");
    expect(flags[0]!.description).toContain("Phantom Horse");
  });

  it("never drops a tip even when nothing matches", () => {
    const race = makeRace([
      makeTip({ horseName: "Ghost One" }),
      makeTip({ horseName: "Ghost Two" }),
    ]);
    const field: FieldRunner[] = [makeRunner({ number: 1, name: "Completely Different" })];

    const { race: out, flags } = matchField(race, field);

    expect(out.tips).toHaveLength(2);
    expect(flags).toHaveLength(2);
    expect(flags.every((f) => f.type === "unmatched_runner")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// Unicode / accented names
// ──────────────────────────────────────────────────────

describe("matchField — unicode / accented names", () => {
  it("matches accented characters against their base forms", () => {
    const race = makeRace([makeTip({ horseName: "Cafe Creme" })]);
    const field: FieldRunner[] = [makeRunner({ number: 9, name: "Café Crème" })];

    const { race: out, flags } = matchField(race, field);

    expect(flags).toHaveLength(0);
    expect(out.tips[0]!.horseName).toBe("Café Crème");
    expect(out.tips[0]!.horseNumber).toBe(9);
    expect(out.tips[0]!.fieldMatched).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// Graceful degrade
// ──────────────────────────────────────────────────────

describe("matchField — empty field", () => {
  it("returns the race unchanged with no flags", () => {
    const race = makeRace([
      makeTip({ horseName: "Alpha" }),
      makeTip({ horseName: "Beta" }),
    ]);

    const { race: out, flags } = matchField(race, []);

    expect(flags).toHaveLength(0);
    expect(out.tips).toHaveLength(2);
    expect(out.tips[0]!.horseName).toBe("Alpha");
    expect(out.tips[1]!.horseName).toBe("Beta");
    expect(out.tips[0]!.fieldMatched).toBeFalsy();
  });

  it("returns a race with no tips unchanged", () => {
    const race = makeRace([]);
    const field: FieldRunner[] = [makeRunner({ number: 1, name: "Lonely" })];

    const { race: out, flags } = matchField(race, field);

    expect(out.tips).toHaveLength(0);
    expect(flags).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────
// Immutability
// ──────────────────────────────────────────────────────

describe("matchField — immutability", () => {
  it("does not mutate the input race or its tips", () => {
    const inputTip = makeTip({ horseName: "xxxxCall Me Gorgeous", totalTips: 3 });
    const race = makeRace([inputTip]);
    const snapshotTip = JSON.parse(JSON.stringify(inputTip));
    const snapshotRace = JSON.parse(JSON.stringify(race));
    const field: FieldRunner[] = [makeRunner({ number: 5, name: "Call Me Gorgeous" })];

    const { race: out } = matchField(race, field);

    // Inputs untouched
    expect(JSON.parse(JSON.stringify(inputTip))).toEqual(snapshotTip);
    expect(JSON.parse(JSON.stringify(race))).toEqual(snapshotRace);
    // Output is a different object
    expect(out).not.toBe(race);
    expect(out.tips).not.toBe(race.tips);
    expect(out.tips[0]).not.toBe(inputTip);
  });

  it("does not mutate the input field array", () => {
    const field: FieldRunner[] = [makeRunner({ number: 5, name: "Call Me Gorgeous" })];
    const snapshot = JSON.parse(JSON.stringify(field));
    const race = makeRace([makeTip({ horseName: "Call Me Gorgeous" })]);

    matchField(race, field);

    expect(JSON.parse(JSON.stringify(field))).toEqual(snapshot);
  });
});
