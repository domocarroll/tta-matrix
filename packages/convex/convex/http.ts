// ──────────────────────────────────────────────────────
// HTTP Actions — External API for CF Worker & Agent
// ──────────────────────────────────────────────────────
//
// Cloudflare Workers and the agent process call these
// endpoints to push data into Convex. Internal Convex
// functions use mutations/queries directly.

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/** POST /scraper/meetings — Upsert meetings from scraper */
http.route({
  path: "/scraper/meetings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as {
      meetings: Array<{
        name: string;
        date: string;
        category: string;
        status: "upcoming" | "live" | "completed";
        raceCount: number;
      }>;
    };

    const ids = [];
    for (const meeting of body.meetings) {
      const id = await ctx.runMutation(api.meetings.upsert, meeting);
      ids.push(id);
    }

    return new Response(JSON.stringify({ meetingIds: ids }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** POST /scraper/races — Upsert races from scraper */
http.route({
  path: "/scraper/races",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as {
      races: Array<{
        meetingId: string;
        raceNumber: number;
        name?: string;
        distance?: number;
        class?: string;
        trackCondition?: string;
        scheduledTime?: string;
        status: "upcoming" | "running" | "resulted";
      }>;
    };

    const ids = [];
    for (const race of body.races) {
      const id = await ctx.runMutation(api.races.upsert, {
        ...race,
        meetingId: race.meetingId as any, // ID type cast
      });
      ids.push(id);
    }

    return new Response(JSON.stringify({ raceIds: ids }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** POST /scraper/horses — Upsert horses from scraper */
http.route({
  path: "/scraper/horses",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as {
      horses: Array<{
        raceId: string;
        horseNumber: number;
        horseName: string;
        jockey: string;
        trainer: string;
        weight: number;
        barrier: number;
        scratched: boolean;
        lastStartForm?: string;
      }>;
    };

    const ids = [];
    for (const horse of body.horses) {
      const id = await ctx.runMutation(api.horses.upsert, {
        ...horse,
        raceId: horse.raceId as any, // ID type cast
      });
      ids.push(id);
    }

    return new Response(JSON.stringify({ horseIds: ids }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** POST /scraper/results — Record race results */
http.route({
  path: "/scraper/results",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as {
      raceId: string;
      result: Array<{
        position: number;
        horseName: string;
        horseNumber: number;
      }>;
    };

    await ctx.runMutation(api.races.recordResult, {
      raceId: body.raceId as any,
      result: body.result,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/** GET /health — Health check */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ status: "ok", service: "tta-matrix" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
});

export default http;
