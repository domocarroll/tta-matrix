// ──────────────────────────────────────────────────────
// TTA Matrix — Seed Data (for development & testing)
// ──────────────────────────────────────────────────────
//
// Populates Convex with realistic race data for a given date.
// Used for:
// 1. Development: test the pipeline without waiting for scraper
// 2. Testing: deterministic data for integration tests
// 3. Demo: show the product working before live data flows
//
// Usage: call seedRaceDay action with a date and meeting config.

import { action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ────────────────────────────────────────────────
// Seed a full race day
// ────────────────────────────────────────────────

export const seedRaceDay = action({
  args: {
    date: v.string(),
    meetings: v.array(
      v.object({
        name: v.string(),
        category: v.string(),
        races: v.array(
          v.object({
            raceNumber: v.number(),
            name: v.optional(v.string()),
            distance: v.optional(v.number()),
            class: v.optional(v.string()),
            trackCondition: v.optional(v.string()),
            scheduledTime: v.optional(v.string()),
            horses: v.array(
              v.object({
                horseNumber: v.number(),
                horseName: v.string(),
                jockey: v.string(),
                trainer: v.string(),
                weight: v.number(),
                barrier: v.number(),
                scratched: v.optional(v.boolean()),
              }),
            ),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { date, meetings }) => {
    const results = {
      meetings: 0,
      races: 0,
      horses: 0,
    };

    for (const meeting of meetings) {
      const meetingId = await ctx.runMutation(api.meetings.upsert, {
        name: meeting.name,
        date,
        category: meeting.category,
        status: "upcoming",
        raceCount: meeting.races.length,
      });
      results.meetings++;

      for (const race of meeting.races) {
        const raceId = await ctx.runMutation(api.races.upsert, {
          meetingId,
          raceNumber: race.raceNumber,
          name: race.name,
          distance: race.distance,
          class: race.class,
          trackCondition: race.trackCondition,
          scheduledTime: race.scheduledTime,
          status: "upcoming",
        });
        results.races++;

        for (const horse of race.horses) {
          await ctx.runMutation(api.horses.upsert, {
            raceId,
            horseNumber: horse.horseNumber,
            horseName: horse.horseName,
            jockey: horse.jockey,
            trainer: horse.trainer,
            weight: horse.weight,
            barrier: horse.barrier,
            scratched: horse.scratched ?? false,
          });
          results.horses++;
        }
      }
    }

    return results;
  },
});

// ────────────────────────────────────────────────
// Quick seed: generates synthetic but realistic data
// for a typical Saturday race day
// ────────────────────────────────────────────────

export const seedSampleDay = action({
  args: {
    date: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const date = args.date ?? new Date().toISOString().split("T")[0]!;

    const sampleMeetings = [
      {
        name: "Randwick",
        category: "SR",
        races: generateSampleRaces(9, "Good 4", [
          "Randwick Stakes", "Doncaster Prelude", "Ranvet Stakes",
          "TJ Smith Stakes", "Galaxy Sprint", "Inglis Nursery",
          "Carbine Club Stakes", "Provincial Championship", "Benchmark 78",
        ]),
      },
      {
        name: "Flemington",
        category: "MR",
        races: generateSampleRaces(8, "Soft 5", [
          "Newmarket Handicap", "Australian Cup", "Lexus Stakes",
          "Coolmore Classic", "Yulong Stud Sprint", "Sires Produce",
          "Benchmark 84", "Maiden Plate",
        ]),
      },
      {
        name: "Eagle Farm",
        category: "BR",
        races: generateSampleRaces(8, "Good 3", [
          "Stradbroke Prelude", "QTC Cup", "Doomben Cup Prelude",
          "Eagle Farm Sprint", "BRC Classic", "Queensland Guineas",
          "Benchmark 72", "Class 3 Plate",
        ]),
      },
    ];

    return ctx.runAction(api.seed.seedRaceDay, {
      date,
      meetings: sampleMeetings,
    });
  },
});

// ────────────────────────────────────────────────
// Helper: generate sample race data
// ────────────────────────────────────────────────

function generateSampleRaces(
  count: number,
  trackCondition: string,
  raceNames: string[],
) {
  const jockeys = [
    "J McDonald", "H Bowman", "J Kah", "D Lane", "T Marquand",
    "N Rawiller", "K McEvoy", "R Moore", "C Williams", "B Avdulla",
    "J Collett", "T Berry", "G Boss", "D Oliver", "W Pike",
  ];

  const trainers = [
    "C Waller", "G Waterhouse", "J O'Shea", "A Cummings", "P Payne",
    "M Price", "J Cummings", "C Maher", "L Freedman", "R Hickmott",
    "M Newnham", "B Baker", "J Pride", "K Lees", "A Neasham",
  ];

  const horseNames = [
    "Storm Chaser", "Golden Mile", "Harbour View", "Dark Rhythm",
    "Sky Dancer", "Iron Heart", "Pearl Diver", "Shadow King",
    "Crystal Clear", "Thunder Road", "Autumn Gold", "Swift Justice",
    "Brave Heart", "Diamond Star", "Ocean Wave", "Fire Dragon",
    "Noble Spirit", "Silver Lining", "Midnight Sun", "Wild Card",
    "Luna Star", "Red Baron", "Blue Sapphire", "Green Flash",
    "Purple Rain", "White Knight", "Black Diamond", "Crimson Tide",
    "Jade Phoenix", "Amber Light", "Bronze Medal", "Platinum Edge",
    "Copper Moon", "Steel Force", "Ivory Tower", "Coral Reef",
    "Ruby Star", "Emerald Isle", "Topaz Dream", "Opal Fire",
    "Onyx Shadow", "Quartz Crystal", "Jasper Wind", "Garnet Storm",
    "Pearl Harbor", "Sapphire Blue", "Diamond Cut", "Amethyst Dawn",
  ];

  const distances = [1000, 1100, 1200, 1300, 1400, 1600, 1800, 2000, 2200, 2400];

  return Array.from({ length: count }, (_, i) => {
    const raceNumber = i + 1;
    const numHorses = 8 + Math.floor(Math.random() * 8); // 8-15 horses
    const distance = distances[Math.floor(Math.random() * distances.length)]!;
    const startHour = 11 + Math.floor(i / 2);
    const startMin = (i % 2) * 30;

    return {
      raceNumber,
      name: raceNames[i],
      distance,
      class: i < 3 ? "Group 1" : i < 5 ? "Listed" : `BM${70 + Math.floor(Math.random() * 20)}`,
      trackCondition,
      scheduledTime: `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`,
      horses: Array.from({ length: numHorses }, (_, j) => {
        const horseIdx = (i * 15 + j) % horseNames.length;
        const jockeyIdx = (i * 3 + j) % jockeys.length;
        const trainerIdx = (i * 2 + j) % trainers.length;

        return {
          horseNumber: j + 1,
          horseName: horseNames[horseIdx]!,
          jockey: jockeys[jockeyIdx]!,
          trainer: trainers[trainerIdx]!,
          weight: 54 + Math.floor(Math.random() * 8),
          barrier: j + 1,
          scratched: false,
        };
      }),
    };
  });
}
