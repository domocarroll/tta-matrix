// ──────────────────────────────────────────────────────
// TTA Matrix — Aggregation Algorithm (ported from v0)
// ──────────────────────────────────────────────────────
//
// Takes expanded tips and produces per-race consensus rankings.
// Domain logic: tipster selections are ordered by preference.
// index 0 = win pick, 1 = 2nd, 2 = 3rd, 3 = 4th.

import type {
  ExpandedTip,
  AggregatedTip,
  AggregatedRace,
  RaceCategory,
  QuaddieSelection,
  TrifectaSelection,
  FirstFourSelection,
} from "./types.ts";
import { titleCase } from "./extraction.ts";
import {
  QUADDIE_LEG_COUNT,
  QUADDIE_HORSES_PER_LEG,
  TRIFECTA_SELECTION_COUNT,
  FIRST_FOUR_SELECTION_COUNT,
} from "./constants.ts";

interface HorseAccumulator {
  horseName: string;
  horseNumber: number | undefined;
  totalTips: number;
  readonly tipsters: Set<string>;
  winTips: number;
  place2Tips: number;
  place3Tips: number;
  place4Tips: number;
}

interface RaceAccumulator {
  category: RaceCategory;
  raceNumber: number;
  meetingName: string;
  readonly horses: Map<string, HorseAccumulator>;
  readonly tipsterNames: Set<string>;
}

/** Create a unique race key */
function raceKey(category: RaceCategory, raceNumber: number): string {
  return `${category}-R${raceNumber}`;
}

/**
 * Aggregate tips from multiple extractions into consensus rankings.
 *
 * @param tips - Expanded tip data (possibly from multiple images/sources)
 * @param category - Racing category (SR, MR, etc.)
 * @param meetingName - Name of the meeting ("Randwick", "Flemington")
 * @returns Aggregated races sorted by race number
 */
export function aggregateRaces(
  tips: ReadonlyArray<ExpandedTip>,
  category: RaceCategory,
  meetingName: string,
): ReadonlyArray<AggregatedRace> {
  const races = new Map<string, RaceAccumulator>();

  for (const race of tips) {
    const key = raceKey(category, race.raceNumber);
    const acc: RaceAccumulator = races.get(key) ?? {
      category,
      raceNumber: race.raceNumber,
      meetingName,
      horses: new Map(),
      tipsterNames: new Set(),
    };

    for (const tip of race.tips) {
      acc.tipsterNames.add(tip.tipsterName);

      for (let i = 0; i < tip.selections.length; i++) {
        const sel = tip.selections[i];
        if (!sel) continue;

        const normalised = titleCase(sel.horseName);
        const horse: HorseAccumulator = acc.horses.get(normalised) ?? {
          horseName: normalised,
          horseNumber: undefined,
          totalTips: 0,
          tipsters: new Set(),
          winTips: 0,
          place2Tips: 0,
          place3Tips: 0,
          place4Tips: 0,
        };

        horse.totalTips += 1;
        horse.tipsters.add(tip.tipsterName);

        // Backfill horse number if available
        if (sel.horseNumber !== undefined && horse.horseNumber === undefined) {
          horse.horseNumber = sel.horseNumber;
        }

        // Position mapping: index → field
        switch (i) {
          case 0: horse.winTips += 1; break;
          case 1: horse.place2Tips += 1; break;
          case 2: horse.place3Tips += 1; break;
          case 3: horse.place4Tips += 1; break;
          // positions beyond 4th still count toward totalTips
        }

        acc.horses.set(normalised, horse);
      }
    }

    races.set(key, acc);
  }

  // Convert accumulators to immutable output, sorted by race number
  return Array.from(races.values())
    .sort((a, b) => a.raceNumber - b.raceNumber)
    .map((race) => {
      const sortedTips = Array.from(race.horses.values())
        .sort((a, b) => {
          // Primary: totalTips desc
          if (b.totalTips !== a.totalTips) return b.totalTips - a.totalTips;
          // Tiebreaker: winTips desc
          return b.winTips - a.winTips;
        })
        .map(
          (h): AggregatedTip => ({
            horseName: h.horseName,
            horseNumber: h.horseNumber,
            totalTips: h.totalTips,
            tipsterCount: h.tipsters.size,
            winTips: h.winTips,
            place2Tips: h.place2Tips,
            place3Tips: h.place3Tips,
            place4Tips: h.place4Tips,
          }),
        );

      const totalSelectionsInRace = sortedTips.reduce((sum, t) => sum + t.totalTips, 0);

      return {
        category: race.category,
        raceNumber: race.raceNumber,
        meetingName: race.meetingName,
        tips: sortedTips,
        totalSelectionsInRace,
        totalTipstersInRace: race.tipsterNames.size,
      };
    });
}

// ──────────────────────────────────────────────────────
// Special Bets
// ──────────────────────────────────────────────────────

/**
 * Calculate quaddie selections (last 4 races, top 3 horses each).
 * Requires >= 4 races in the category.
 */
export function calculateQuaddie(
  races: ReadonlyArray<AggregatedRace>,
): ReadonlyArray<QuaddieSelection> | null {
  if (races.length < QUADDIE_LEG_COUNT) return null;

  const lastFour = races.slice(-QUADDIE_LEG_COUNT);
  return lastFour.map((race) => ({
    raceNumber: race.raceNumber,
    horses: race.tips.slice(0, QUADDIE_HORSES_PER_LEG).map((h) => ({
      horseName: h.horseName,
      horseNumber: h.horseNumber,
      totalTips: h.totalTips,
    })),
  }));
}

/**
 * Calculate trifecta selection — top 3 by positional weighting.
 * Uses different sort from main aggregation: sum of win+place2+place3.
 */
export function calculateTrifecta(
  race: AggregatedRace,
): TrifectaSelection | null {
  if (race.tips.length < TRIFECTA_SELECTION_COUNT) return null;

  const sorted = [...race.tips].sort(
    (a, b) =>
      b.winTips + b.place2Tips + b.place3Tips -
      (a.winTips + a.place2Tips + a.place3Tips),
  );

  return {
    raceNumber: race.raceNumber,
    first: sorted[0]!,
    second: sorted[1]!,
    third: sorted[2]!,
  };
}

/**
 * Calculate first four — top 4 from main aggregation sort (totalTips).
 */
export function calculateFirstFour(
  race: AggregatedRace,
): FirstFourSelection | null {
  if (race.tips.length < FIRST_FOUR_SELECTION_COUNT) return null;

  return {
    raceNumber: race.raceNumber,
    selections: [race.tips[0]!, race.tips[1]!, race.tips[2]!, race.tips[3]!],
  };
}
