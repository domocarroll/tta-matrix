// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Convex Client
// ──────────────────────────────────────────────────────
//
// Uses ConvexHttpClient with anyApi for type-safe function
// references that work without importing generated types.
//
// anyApi creates a dynamic Proxy that builds function
// references on access — e.g. api.meetings.getByDate
// produces a valid FunctionReference for "meetings:getByDate".

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

type ConvexId = string;

// anyApi is a Proxy — TS types the properties as possibly undefined
// but at runtime they always produce valid FunctionReferences.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any;

export class TTAConvexClient {
  private readonly client: ConvexHttpClient;

  constructor(url: string) {
    this.client = new ConvexHttpClient(url);
  }

  // ────────────────────────────────────────────────
  // Meetings
  // ────────────────────────────────────────────────

  async getMeetingsByDate(date: string) {
    return this.client.query(api.meetings.getByDate, { date });
  }

  async getMeetingsByStatus(status: "upcoming" | "live" | "completed") {
    return this.client.query(api.meetings.getByStatus, { status });
  }

  // ────────────────────────────────────────────────
  // Races
  // ────────────────────────────────────────────────

  async getRacesByMeeting(meetingId: ConvexId) {
    return this.client.query(api.races.getByMeeting, { meetingId });
  }

  async getRaceByMeetingAndNumber(meetingId: ConvexId, raceNumber: number) {
    return this.client.query(api.races.getByMeetingAndNumber, {
      meetingId,
      raceNumber,
    });
  }

  async recordResult(
    raceId: ConvexId,
    result: Array<{
      position: number;
      horseName: string;
      horseNumber: number;
    }>,
  ) {
    return this.client.mutation(api.races.recordResult, {
      raceId,
      result,
    });
  }

  // ────────────────────────────────────────────────
  // Horses
  // ────────────────────────────────────────────────

  async getHorsesByRace(raceId: ConvexId) {
    return this.client.query(api.horses.getByRace, { raceId });
  }

  // ────────────────────────────────────────────────
  // Tips
  // ────────────────────────────────────────────────

  async createTip(args: {
    raceId: ConvexId;
    tipsterId: ConvexId;
    selections: Array<{
      position: number;
      horseName: string;
      horseNumber?: number;
    }>;
    source: "image" | "manual" | "api";
    sourceImageId?: string;
    confidence?: number;
  }) {
    return this.client.mutation(api.tips.create, args);
  }

  async getTipsByRace(raceId: ConvexId) {
    return this.client.query(api.tips.getByRace, { raceId });
  }

  // ────────────────────────────────────────────────
  // Tipsters
  // ────────────────────────────────────────────────

  async getOrCreateTipster(
    name: string,
    type: "newspaper" | "punter" | "algorithm",
    matrixUserId?: string,
  ) {
    return this.client.mutation(api.tipsters.getOrCreate, {
      name,
      type,
      matrixUserId,
    });
  }

  async getTipsterByName(name: string) {
    return this.client.query(api.tipsters.getByName, { name });
  }

  async searchTipsters(searchQuery: string) {
    return this.client.query(api.tipsters.search, { query: searchQuery });
  }

  async getLeaderboard(
    limit?: number,
    sortBy?: "strikeRate" | "roi" | "wins",
  ) {
    return this.client.query(api.tipsters.leaderboard, { limit, sortBy });
  }

  // ────────────────────────────────────────────────
  // Predictions
  // ────────────────────────────────────────────────

  async createPrediction(args: {
    raceId: ConvexId;
    userId: string;
    selection: {
      horseName: string;
      horseNumber?: number;
      betType: "win" | "place" | "each-way";
    };
    stake: number;
    odds?: number;
  }) {
    return this.client.mutation(api.predictions.create, args);
  }

  async getUserPnL(userId: string) {
    return this.client.query(api.predictions.getUserPnL, { userId });
  }

  async getPunterLeaderboard(limit?: number) {
    return this.client.query(api.predictions.punterLeaderboard, { limit });
  }

  // ────────────────────────────────────────────────
  // Aggregations
  // ────────────────────────────────────────────────

  async getAggregation(raceId: ConvexId) {
    return this.client.query(api.aggregations.getByRace, { raceId });
  }

  async upsertAggregation(raceId: ConvexId, data: unknown) {
    return this.client.mutation(api.aggregations.upsert, { raceId, data });
  }
}
