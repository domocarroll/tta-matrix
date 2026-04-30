// ──────────────────────────────────────────────────────
// TTA Matrix — Race Data Scraping (Convex Actions)
// ──────────────────────────────────────────────────────
//
// Convex actions that fetch race field data and results
// from external sources. Called by cron triggers.
//
// Data flow:
//   Cron trigger → internalAction (fetch + parse) → mutations (upsert)
//
// Primary source: Cloudflare Browser Rendering /scrape API
// (handles JS rendering and bot protection on racing sites)
//
// Australian timezone: AEST = UTC+10, AEDT = UTC+11

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import {
  scrapeMeetings,
  scrapeRaceFields,
  scrapeRaceResults,
} from "./cfBrowserScraper";

// ────────────────────────────────────────────────
// Category detection from meeting name/state
// ────────────────────────────────────────────────

const CATEGORY_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly category: string;
}> = [
  { pattern: /randwick|rosehill|canterbury|warwick farm|kensington|royal randwick|kembla|gosford|hawkesbury|wyong|newcastle|scone/i, category: "SR" },
  { pattern: /flemington|caulfield|moonee valley|sandown|cranbourne|pakenham|mornington|ballarat|geelong|bendigo|wangaratta|kilmore|seymour/i, category: "MR" },
  { pattern: /eagle farm|doomben|gold coast|sunshine coast|ipswich|toowoomba|cairns|townsville|rockhampton|mackay/i, category: "BR" },
  { pattern: /ascot|belmont|northam|pinjarra|bunbury|kalgoorlie|geraldton|albany/i, category: "PR" },
  { pattern: /morphettville|murray bridge|gawler|port augusta|mount gambier|port lincoln|strathalbyn/i, category: "AR" },
];

function detectCategory(meetingName: string, state?: string): string {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(meetingName)) return category;
  }
  if (state) {
    const stateMap: Record<string, string> = {
      NSW: "SR", VIC: "MR", QLD: "BR", WA: "PR", SA: "AR",
      TAS: "OR", ACT: "SR", NT: "OR",
    };
    return stateMap[state.toUpperCase()] ?? "OR";
  }
  return "OR";
}

// ────────────────────────────────────────────────
// Date utilities (AEST aware)
// ────────────────────────────────────────────────

function getAESTDate(offsetDays = 0): string {
  const now = new Date();
  const aestMs = now.getTime() + 10 * 60 * 60 * 1000;
  const aest = new Date(aestMs);
  aest.setDate(aest.getDate() + offsetDays);
  return aest.toISOString().split("T")[0]!;
}

// ────────────────────────────────────────────────
// CF config from environment
// ────────────────────────────────────────────────

function getCFConfig(): { accountId: string; apiToken: string } | null {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) {
    console.warn("[scraper] CF_ACCOUNT_ID or CF_API_TOKEN not set — scraping disabled");
    return null;
  }
  return { accountId, apiToken };
}

// ────────────────────────────────────────────────
// Scrape Fields Action
// ────────────────────────────────────────────────

export const scrapeFields = internalAction({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const date = args.date ?? getAESTDate();
    console.log(`[scraper] Scraping fields for ${date}`);

    const cfConfig = getCFConfig();
    if (!cfConfig) {
      return { meetingsProcessed: 0, error: "CF credentials not configured" };
    }

    const scrapedMeetings = await scrapeMeetings(cfConfig, date);

    if (scrapedMeetings.length === 0) {
      console.log(`[scraper] No meetings found for ${date}`);
      return { meetingsProcessed: 0 };
    }

    let totalRaces = 0;
    let totalHorses = 0;

    for (const scraped of scrapedMeetings) {
      const category = detectCategory(scraped.name, scraped.state);

      const meetingId = await ctx.runMutation(api.meetings.upsert, {
        name: scraped.name,
        date,
        category,
        status: "upcoming" as const,
        raceCount: scraped.raceCount,
      });

      // Scrape detailed fields if meeting has a URL
      if (scraped.url) {
        const races = await scrapeRaceFields(cfConfig, scraped.url);

        for (const race of races) {
          const raceId = await ctx.runMutation(api.races.upsert, {
            meetingId,
            raceNumber: race.raceNumber,
            name: race.name || undefined,
            distance: race.distance || undefined,
            class: race.class || undefined,
            scheduledTime: race.scheduledTime || undefined,
            status: "upcoming" as const,
          });
          totalRaces++;

          for (const horse of race.horses) {
            await ctx.runMutation(api.horses.upsert, {
              raceId,
              horseNumber: horse.horseNumber,
              horseName: horse.horseName,
              jockey: horse.jockey || "TBA",
              trainer: horse.trainer || "TBA",
              weight: horse.weight || 57,
              barrier: horse.barrier || 0,
              scratched: horse.scratched,
            });
            totalHorses++;
          }
        }

        // Update race count based on actual races found
        if (races.length > 0) {
          await ctx.runMutation(api.meetings.upsert, {
            name: scraped.name,
            date,
            category,
            status: "upcoming" as const,
            raceCount: races.length,
          });
        }
      }
    }

    console.log(
      `[scraper] Fields: ${scrapedMeetings.length} meetings, ${totalRaces} races, ${totalHorses} horses`,
    );
    return {
      meetingsProcessed: scrapedMeetings.length,
      racesProcessed: totalRaces,
      horsesProcessed: totalHorses,
    };
  },
});

// ────────────────────────────────────────────────
// Scrape Results Action
// ────────────────────────────────────────────────

export const scrapeResults = internalAction({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const date = args.date ?? getAESTDate();
    console.log(`[scraper] Scraping results for ${date}`);

    const cfConfig = getCFConfig();
    if (!cfConfig) {
      return { resultsRecorded: 0, error: "CF credentials not configured" };
    }

    const liveMeetings = await ctx.runQuery(api.meetings.getByDate, { date });
    let resultsRecorded = 0;

    for (const meeting of liveMeetings) {
      if (meeting.status === "completed") continue;

      const races = await ctx.runQuery(api.races.getByMeeting, {
        meetingId: meeting._id,
      });

      const scrapedResults = await scrapeRaceResults(
        cfConfig,
        meeting.name,
        date,
      );

      let anyResulted = false;
      let allResulted = true;

      for (const race of races) {
        if (race.status === "resulted") {
          anyResulted = true;
          continue;
        }

        const raceResult = scrapedResults.find(
          (r) => r.raceNumber === race.raceNumber,
        );
        if (!raceResult || raceResult.results.length === 0) {
          allResulted = false;
          continue;
        }

        await ctx.runMutation(api.races.recordResult, {
          raceId: race._id,
          result: raceResult.results.map((r) => ({
            position: r.position,
            horseName: r.horseName,
            horseNumber: r.horseNumber,
          })),
        });
        resultsRecorded++;
        anyResulted = true;
      }

      if (allResulted && races.length > 0) {
        await ctx.runMutation(api.meetings.updateStatus, {
          meetingId: meeting._id,
          status: "completed",
        });
      } else if (anyResulted) {
        await ctx.runMutation(api.meetings.updateStatus, {
          meetingId: meeting._id,
          status: "live",
        });
      }
    }

    console.log(`[scraper] Results: ${resultsRecorded} races resulted`);
    return { resultsRecorded };
  },
});

// ────────────────────────────────────────────────
// Manual triggers (public actions for testing)
// ────────────────────────────────────────────────

export const triggerScrapeFields = action({
  args: { date: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    return ctx.runAction(internal.scraping.scrapeFields, {
      date: args.date,
    });
  },
});

export const triggerScrapeResults = action({
  args: { date: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    return ctx.runAction(internal.scraping.scrapeResults, {
      date: args.date,
    });
  },
});
