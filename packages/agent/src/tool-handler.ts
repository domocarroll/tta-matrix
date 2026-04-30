// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Tool Execution Handler
// ──────────────────────────────────────────────────────
//
// Dispatches tool calls from the agent to the appropriate
// Convex operations. Each tool returns a JSON string that
// gets passed back to the agent as a tool result.

import type Anthropic from "@anthropic-ai/sdk";
import type { TTAConvexClient } from "./convex-client.ts";
import { extractTipsFromImage } from "./extract.ts";
import {
  aggregateRaces,
  calculateQuaddie,
  type RaceCategory,
  type AggregatedRace,
} from "@tta/shared";

// Convex document shapes (before codegen, these are manual)
interface ConvexMeeting {
  _id: string;
  name: string;
  date: string;
  category: string;
  status: string;
  raceCount: number;
}

interface ConvexRace {
  _id: string;
  meetingId: string;
  raceNumber: number;
  name?: string;
  status: string;
}

interface ConvexHorse {
  _id: string;
  raceId: string;
  horseName: string;
  horseNumber: number;
  scratched: boolean;
}

interface ConvexTipster {
  _id: string;
  name: string;
  type: string;
  stats: Record<string, unknown>;
}

interface ConvexAggregation {
  _id: string;
  raceId: string;
  data: unknown;
  generatedAt: number;
}

export class ToolHandler {
  constructor(
    private readonly convex: TTAConvexClient,
    private readonly anthropic: Anthropic,
    private readonly model: string,
  ) {}

  /**
   * Execute a tool call and return the result as a string.
   */
  async execute(
    toolName: string,
    toolInput: Record<string, unknown>,
  ): Promise<string> {
    switch (toolName) {
      case "extract_tips":
        return this.handleExtractTips(toolInput);
      case "query_race":
        return this.handleQueryRace(toolInput);
      case "query_tipster":
        return this.handleQueryTipster(toolInput);
      case "make_prediction":
        return this.handleMakePrediction(toolInput);
      case "get_leaderboard":
        return this.handleGetLeaderboard(toolInput);
      case "get_aggregation":
        return this.handleGetAggregation(toolInput);
      case "record_result":
        return this.handleRecordResult(toolInput);
      case "get_todays_meetings":
        return this.handleGetTodaysMeetings(toolInput);
      case "calculate_quaddie":
        return this.handleCalculateQuaddie(toolInput);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  }

  private async handleExtractTips(
    input: Record<string, unknown>,
  ): Promise<string> {
    const imageBase64 = input.image_base64 as string;
    const mediaType = (input.media_type as string) || "image/jpeg";
    const category = input.category as RaceCategory;
    const meetingName = input.meeting_name as string;

    const result = await extractTipsFromImage(
      this.anthropic,
      imageBase64,
      mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      this.model,
    );

    if ("error" in result) {
      return JSON.stringify(result);
    }

    // Persist extracted tips to Convex
    const today = new Date().toISOString().split("T")[0]!;
    const meetings: ConvexMeeting[] = await this.convex.getMeetingsByDate(today);
    const meeting = meetings.find(
      (m: ConvexMeeting) => m.name.toLowerCase() === meetingName.toLowerCase(),
    );

    if (!meeting) {
      return JSON.stringify({
        tips: result.tips,
        warning: `Meeting "${meetingName}" not found in Convex for ${today}. Tips extracted but not persisted. Run the scraper first.`,
        continuations: result.continuations,
      });
    }

    const races: ConvexRace[] = await this.convex.getRacesByMeeting(meeting._id);
    let persistedCount = 0;

    for (const extractedRace of result.tips) {
      const race = races.find(
        (r: ConvexRace) => r.raceNumber === extractedRace.raceNumber,
      );
      if (!race) continue;

      for (const tipData of extractedRace.tips) {
        const tipsterId = await this.convex.getOrCreateTipster(
          tipData.tipsterName,
          "newspaper",
        );

        await this.convex.createTip({
          raceId: race._id,
          tipsterId,
          selections: tipData.selections.map((sel, idx) => ({
            position: idx + 1,
            horseName: sel.horseName,
            horseNumber: sel.horseNumber,
          })),
          source: "image",
          confidence: undefined,
        });
        persistedCount++;
      }
    }

    // Generate aggregations for affected races
    const aggregatedRaces = aggregateRaces(result.tips, category, meetingName);

    for (const aggRace of aggregatedRaces) {
      const race = races.find((r: ConvexRace) => r.raceNumber === aggRace.raceNumber);
      if (race) {
        await this.convex.upsertAggregation(race._id, aggRace);
      }
    }

    return JSON.stringify({
      racesExtracted: result.tips.length,
      tipstersFound: result.tips.flatMap((r) => r.tips).length,
      tipsPersisted: persistedCount,
      continuations: result.continuations,
      aggregationsUpdated: aggregatedRaces.length,
    });
  }

  private async handleQueryRace(
    input: Record<string, unknown>,
  ): Promise<string> {
    const date = input.date as string;
    const meetingName = input.meeting_name as string;
    const raceNumber = input.race_number as number;

    const meetings: ConvexMeeting[] = await this.convex.getMeetingsByDate(date);
    const meeting = meetings.find(
      (m: ConvexMeeting) => m.name.toLowerCase() === meetingName.toLowerCase(),
    );

    if (!meeting) {
      return JSON.stringify({
        error: `Meeting "${meetingName}" not found for ${date}`,
      });
    }

    const race = await this.convex.getRaceByMeetingAndNumber(
      meeting._id,
      raceNumber,
    );
    if (!race) {
      return JSON.stringify({
        error: `Race ${raceNumber} not found at ${meetingName} on ${date}`,
      });
    }

    const [horses, tips, aggregation]: [ConvexHorse[], unknown[], ConvexAggregation | null] = await Promise.all([
      this.convex.getHorsesByRace(race._id),
      this.convex.getTipsByRace(race._id),
      this.convex.getAggregation(race._id),
    ]);

    return JSON.stringify({
      race,
      horses: horses.filter((h: ConvexHorse) => !h.scratched),
      scratched: horses.filter((h: ConvexHorse) => h.scratched),
      tipsCount: tips.length,
      aggregation: aggregation?.data ?? null,
    });
  }

  private async handleQueryTipster(
    input: Record<string, unknown>,
  ): Promise<string> {
    const name = input.name as string;
    const tipster: ConvexTipster | null = await this.convex.getTipsterByName(name);

    if (!tipster) {
      const results: ConvexTipster[] = await this.convex.searchTipsters(name);
      if (results.length === 0) {
        return JSON.stringify({ error: `Tipster "${name}" not found` });
      }
      return JSON.stringify({
        exactMatch: false,
        suggestions: results.map((t: ConvexTipster) => ({
          name: t.name,
          type: t.type,
          stats: t.stats,
        })),
      });
    }

    return JSON.stringify({
      name: tipster.name,
      type: tipster.type,
      stats: tipster.stats,
    });
  }

  private async handleMakePrediction(
    input: Record<string, unknown>,
  ): Promise<string> {
    const predictionId = await this.convex.createPrediction({
      raceId: input.race_id as string,
      userId: input.user_id as string,
      selection: {
        horseName: input.horse_name as string,
        horseNumber: input.horse_number as number | undefined,
        betType: input.bet_type as "win" | "place" | "each-way",
      },
      stake: input.stake as number,
      odds: input.odds as number | undefined,
    });

    return JSON.stringify({
      predictionId,
      message: `Prediction recorded: ${input.stake} units on ${input.horse_name} (${input.bet_type})`,
    });
  }

  private async handleGetLeaderboard(
    input: Record<string, unknown>,
  ): Promise<string> {
    const type = input.type as "tipsters" | "punters";
    const limit = (input.limit as number) ?? 10;

    if (type === "tipsters") {
      const sortBy =
        (input.sort_by as "strikeRate" | "roi" | "wins") ?? "strikeRate";
      const leaderboard = await this.convex.getLeaderboard(limit, sortBy);
      return JSON.stringify({ type: "tipsters", sortBy, entries: leaderboard });
    }

    const leaderboard = await this.convex.getPunterLeaderboard(limit);
    return JSON.stringify({ type: "punters", entries: leaderboard });
  }

  private async handleGetAggregation(
    input: Record<string, unknown>,
  ): Promise<string> {
    const aggregation: ConvexAggregation | null = await this.convex.getAggregation(
      input.race_id as string,
    );

    if (!aggregation) {
      return JSON.stringify({ error: "No aggregation data for this race" });
    }

    return JSON.stringify(aggregation.data);
  }

  private async handleRecordResult(
    input: Record<string, unknown>,
  ): Promise<string> {
    const result = (input.result as Array<Record<string, unknown>>).map(
      (r: Record<string, unknown>) => ({
        position: r.position as number,
        horseName: r.horse_name as string,
        horseNumber: r.horse_number as number,
      }),
    );

    await this.convex.recordResult(input.race_id as string, result);

    return JSON.stringify({
      message: "Result recorded. Predictions settled. Tipster stats updated.",
    });
  }

  private async handleGetTodaysMeetings(
    input: Record<string, unknown>,
  ): Promise<string> {
    const date =
      (input.date as string) ?? new Date().toISOString().split("T")[0]!;
    const meetings: ConvexMeeting[] = await this.convex.getMeetingsByDate(date);

    return JSON.stringify({
      date,
      meetings: meetings.map((m: ConvexMeeting) => ({
        id: m._id,
        name: m.name,
        category: m.category,
        status: m.status,
        raceCount: m.raceCount,
      })),
    });
  }

  private async handleCalculateQuaddie(
    input: Record<string, unknown>,
  ): Promise<string> {
    const meetingId = input.meeting_id as string;
    const races: ConvexRace[] = await this.convex.getRacesByMeeting(meetingId);

    // Get aggregation for each race
    const aggregatedRaces: AggregatedRace[] = [];
    for (const race of races) {
      const agg: ConvexAggregation | null = await this.convex.getAggregation(race._id);
      if (agg?.data) {
        aggregatedRaces.push(agg.data as AggregatedRace);
      }
    }

    const quaddie = calculateQuaddie(aggregatedRaces);
    if (!quaddie) {
      return JSON.stringify({
        error: "Need at least 4 races with aggregated data for quaddie",
      });
    }

    return JSON.stringify({ quaddie });
  }
}
