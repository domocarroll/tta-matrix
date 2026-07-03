import { describe, it, expect } from "vitest";
import { buildMeetingCsv } from "../csv.ts";
import type { AggregatedRace, AggregatedTip } from "../types.ts";

function makeTip(overrides: Partial<AggregatedTip> & { horseName: string }): AggregatedTip {
  return {
    horseNumber: 1,
    totalTips: 0,
    tipsterCount: 0,
    winTips: 0,
    place2Tips: 0,
    place3Tips: 0,
    place4Tips: 0,
    ...overrides,
  };
}

function makeRace(
  tips: ReadonlyArray<AggregatedTip>,
  overrides: Partial<AggregatedRace> = {},
): AggregatedRace {
  return {
    category: "MR",
    raceNumber: 7,
    meetingName: "Flemington",
    tips,
    totalSelectionsInRace: tips.reduce((sum, t) => sum + t.totalTips, 0),
    totalTipstersInRace: 22,
    ...overrides,
  };
}

describe("buildMeetingCsv — Tipster % column", () => {
  it("uses Pete's formula: tips on horse ÷ total tips in race × 100, two decimals", () => {
    // Pete's example (email 3 Jul 2026): Al Duca, MR race 7 —
    // 15 tips of 68 total in the race → 22.06%, NOT tipsterCount/totalTipsters.
    const alDuca = makeTip({ horseName: "Al Duca", horseNumber: 4, totalTips: 15, tipsterCount: 13 });
    const rest = makeTip({ horseName: "The Rest", horseNumber: 9, totalTips: 53, tipsterCount: 20 });
    const race = makeRace([alDuca, rest]);
    expect(race.totalSelectionsInRace).toBe(68);

    const csv = buildMeetingCsv([race], { meeting: "Flemington", date: "2026-07-03" });
    const alDucaRow = csv.split("\n").find((l) => l.includes("Al Duca"));
    expect(alDucaRow).toBeDefined();
    // Category,Race,Horse Number,Horse Name,Total Tips,Tipster Count,Total Tipsters In Race,Tipster %,...
    const cols = alDucaRow!.split(",");
    expect(cols[7]).toBe("22.06");
  });

  it("emits 0.00 when the race has no selections", () => {
    const race = makeRace([makeTip({ horseName: "Ghost", totalTips: 0 })], {
      totalSelectionsInRace: 0,
    });
    const csv = buildMeetingCsv([race], { meeting: "Flemington", date: "2026-07-03" });
    const row = csv.split("\n").find((l) => l.includes("Ghost"));
    expect(row!.split(",")[7]).toBe("0.00");
  });
});
