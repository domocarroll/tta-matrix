import { describe, it, expect } from "vitest";
import {
  aggregateRaces,
  calculateQuaddie,
  calculateTrifecta,
  calculateFirstFour,
} from "../aggregation.ts";
import type { ExpandedTip, AggregatedRace } from "../types.ts";

function makeTips(
  ...tipsters: Array<{
    name: string;
    race: number;
    picks: string[];
  }>
): ExpandedTip[] {
  const byRace = new Map<number, Array<{ tipsterName: string; selections: Array<{ horseName: string }> }>>();

  for (const t of tipsters) {
    const existing = byRace.get(t.race) ?? [];
    existing.push({
      tipsterName: t.name,
      selections: t.picks.map((h) => ({ horseName: h })),
    });
    byRace.set(t.race, existing);
  }

  return Array.from(byRace.entries()).map(([raceNumber, tips]) => ({
    raceNumber,
    tips,
  }));
}

describe("aggregateRaces", () => {
  it("counts total tips and unique tipsters", () => {
    const tips = makeTips(
      { name: "Tony", race: 1, picks: ["Winx", "Verry Elleegant"] },
      { name: "Nick", race: 1, picks: ["Winx", "Nature Strip"] },
    );

    const result = aggregateRaces(tips, "SR", "Randwick");
    expect(result).toHaveLength(1);

    const race = result[0]!;
    expect(race.raceNumber).toBe(1);
    expect(race.totalTipstersInRace).toBe(2);

    // Winx: picked by both tipsters
    const winx = race.tips.find((t) => t.horseName === "Winx");
    expect(winx).toBeDefined();
    expect(winx!.totalTips).toBe(2);
    expect(winx!.tipsterCount).toBe(2);
    expect(winx!.winTips).toBe(2); // both picked Winx as 1st (index 0)
  });

  it("maps selection position correctly", () => {
    const tips = makeTips({
      name: "Tony",
      race: 1,
      picks: ["Horse A", "Horse B", "Horse C", "Horse D"],
    });

    const result = aggregateRaces(tips, "SR", "Randwick");
    const race = result[0]!;

    const horseA = race.tips.find((t) => t.horseName === "Horse A")!;
    expect(horseA.winTips).toBe(1);
    expect(horseA.place2Tips).toBe(0);

    const horseB = race.tips.find((t) => t.horseName === "Horse B")!;
    expect(horseB.winTips).toBe(0);
    expect(horseB.place2Tips).toBe(1);

    const horseC = race.tips.find((t) => t.horseName === "Horse C")!;
    expect(horseC.place3Tips).toBe(1);

    const horseD = race.tips.find((t) => t.horseName === "Horse D")!;
    expect(horseD.place4Tips).toBe(1);
  });

  it("sorts by totalTips desc, then winTips desc", () => {
    const tips = makeTips(
      { name: "Tony", race: 1, picks: ["Winx", "Nature Strip"] },
      { name: "Nick", race: 1, picks: ["Nature Strip", "Winx"] },
      { name: "Sara", race: 1, picks: ["Winx"] },
    );

    const result = aggregateRaces(tips, "SR", "Randwick");
    const race = result[0]!;

    // Winx: 3 total tips, 2 win tips
    // Nature Strip: 2 total tips, 1 win tip
    expect(race.tips[0]!.horseName).toBe("Winx");
    expect(race.tips[0]!.totalTips).toBe(3);
    expect(race.tips[1]!.horseName).toBe("Nature Strip");
  });

  it("handles multiple races", () => {
    const tips = makeTips(
      { name: "Tony", race: 1, picks: ["Horse A"] },
      { name: "Tony", race: 3, picks: ["Horse B"] },
      { name: "Tony", race: 2, picks: ["Horse C"] },
    );

    const result = aggregateRaces(tips, "MR", "Flemington");
    expect(result).toHaveLength(3);
    // Sorted by race number
    expect(result[0]!.raceNumber).toBe(1);
    expect(result[1]!.raceNumber).toBe(2);
    expect(result[2]!.raceNumber).toBe(3);
  });

  it("normalises horse names via titleCase", () => {
    const tips = makeTips(
      { name: "Tony", race: 1, picks: ["WINX"] },
      { name: "Nick", race: 1, picks: ["winx"] },
    );

    const result = aggregateRaces(tips, "SR", "Randwick");
    const race = result[0]!;

    // Both should merge into "Winx"
    expect(race.tips).toHaveLength(1);
    expect(race.tips[0]!.horseName).toBe("Winx");
    expect(race.tips[0]!.totalTips).toBe(2);
  });
});

describe("calculateQuaddie", () => {
  function makeRaces(count: number): AggregatedRace[] {
    return Array.from({ length: count }, (_, i) => ({
      category: "SR" as const,
      raceNumber: i + 1,
      meetingName: "Test",
      tips: [
        { horseName: `Horse A R${i + 1}`, totalTips: 5, tipsterCount: 3, winTips: 3, place2Tips: 1, place3Tips: 1, place4Tips: 0 },
        { horseName: `Horse B R${i + 1}`, totalTips: 4, tipsterCount: 3, winTips: 2, place2Tips: 1, place3Tips: 1, place4Tips: 0 },
        { horseName: `Horse C R${i + 1}`, totalTips: 3, tipsterCount: 2, winTips: 1, place2Tips: 1, place3Tips: 1, place4Tips: 0 },
        { horseName: `Horse D R${i + 1}`, totalTips: 1, tipsterCount: 1, winTips: 0, place2Tips: 0, place3Tips: 0, place4Tips: 1 },
      ],
      totalSelectionsInRace: 13,
      totalTipstersInRace: 4,
    }));
  }

  it("returns null for fewer than 4 races", () => {
    expect(calculateQuaddie(makeRaces(3))).toBeNull();
  });

  it("selects last 4 races", () => {
    const result = calculateQuaddie(makeRaces(8))!;
    expect(result).toHaveLength(4);
    expect(result[0]!.raceNumber).toBe(5);
    expect(result[3]!.raceNumber).toBe(8);
  });

  it("returns top 3 horses per leg", () => {
    const result = calculateQuaddie(makeRaces(4))!;
    expect(result[0]!.horses).toHaveLength(3);
    expect(result[0]!.horses[0]!.horseName).toBe("Horse A R1");
  });
});

describe("calculateTrifecta", () => {
  it("sorts by win+place2+place3 sum", () => {
    const race: AggregatedRace = {
      category: "SR",
      raceNumber: 1,
      meetingName: "Test",
      tips: [
        { horseName: "A", totalTips: 10, tipsterCount: 5, winTips: 1, place2Tips: 1, place3Tips: 1, place4Tips: 7 },
        { horseName: "B", totalTips: 6, tipsterCount: 4, winTips: 3, place2Tips: 2, place3Tips: 1, place4Tips: 0 },
        { horseName: "C", totalTips: 5, tipsterCount: 3, winTips: 2, place2Tips: 2, place3Tips: 1, place4Tips: 0 },
      ],
      totalSelectionsInRace: 21,
      totalTipstersInRace: 5,
    };

    const result = calculateTrifecta(race)!;
    // B: 3+2+1=6, C: 2+2+1=5, A: 1+1+1=3
    expect(result.first.horseName).toBe("B");
    expect(result.second.horseName).toBe("C");
    expect(result.third.horseName).toBe("A");
  });
});

describe("calculateFirstFour", () => {
  it("uses main sort order (totalTips)", () => {
    const race: AggregatedRace = {
      category: "SR",
      raceNumber: 1,
      meetingName: "Test",
      tips: [
        { horseName: "A", totalTips: 10, tipsterCount: 5, winTips: 5, place2Tips: 3, place3Tips: 1, place4Tips: 1 },
        { horseName: "B", totalTips: 8, tipsterCount: 4, winTips: 4, place2Tips: 2, place3Tips: 1, place4Tips: 1 },
        { horseName: "C", totalTips: 6, tipsterCount: 3, winTips: 3, place2Tips: 1, place3Tips: 1, place4Tips: 1 },
        { horseName: "D", totalTips: 4, tipsterCount: 2, winTips: 2, place2Tips: 1, place3Tips: 1, place4Tips: 0 },
      ],
      totalSelectionsInRace: 28,
      totalTipstersInRace: 5,
    };

    const result = calculateFirstFour(race)!;
    expect(result.selections[0].horseName).toBe("A");
    expect(result.selections[1].horseName).toBe("B");
    expect(result.selections[2].horseName).toBe("C");
    expect(result.selections[3].horseName).toBe("D");
  });

  it("returns null for fewer than 4 tips", () => {
    const race: AggregatedRace = {
      category: "SR",
      raceNumber: 1,
      meetingName: "Test",
      tips: [
        { horseName: "A", totalTips: 5, tipsterCount: 3, winTips: 3, place2Tips: 1, place3Tips: 1, place4Tips: 0 },
      ],
      totalSelectionsInRace: 5,
      totalTipstersInRace: 3,
    };

    expect(calculateFirstFour(race)).toBeNull();
  });
});
