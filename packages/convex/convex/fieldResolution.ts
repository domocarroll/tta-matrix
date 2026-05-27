// ──────────────────────────────────────────────────────
// TTA Matrix — Authoritative Race Field Resolution
// ──────────────────────────────────────────────────────
//
// Replaces the (deleted) racenet HTML scraper. Resolves the official
// acceptance field for a meeting — saddlecloth number, horse, jockey,
// trainer, barrier, scratched — via the Perplexity API (web-grounded,
// cited), then caches it in meetings/races/horses.
//
// Contract: this NEVER throws to the caller. On any failure (no API
// key, network, bad JSON, low confidence) it returns
// `{ resolved: false, reason }` and the pipeline degrades to the
// existing tip-only aggregation. Field data is advisory, not gospel —
// late scratchings can lag the index, so it annotates, never deletes.

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Cache is considered fresh for 6h. Race-morning scratchings are handled
// by the caller's explicit `force` refetch, not by short TTLs (which
// would burn API calls on every workspace load).
const FRESHNESS_MS = 6 * 60 * 60 * 1000;
const PERPLEXITY_URL = "https://api.perplexity.ai/v1/responses";
const PERPLEXITY_PRESET = "fast-search"; // deep-research for full meeting (slower)
const PERPLEXITY_MODEL = `agent:${PERPLEXITY_PRESET}`; // fieldSource label
const REQUEST_TIMEOUT_MS = 60_000;

interface ResolvedRunner {
  number: number;
  name: string;
  jockey: string;
  trainer: string;
  barrier: number;
  scratched: boolean;
}

interface ResolvedRace {
  raceNumber: number;
  runners: ResolvedRunner[];
}

type ResolveResult =
  | {
      resolved: true;
      source: string;
      fetchedAt: number;
      citations: string[];
      races: ResolvedRace[];
    }
  | { resolved: false; reason: string };

/** Best-effort JSON extraction without pulling a repair dependency into
 *  the Convex bundle. json_schema responses are clean; this is a guard. */
function parseLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function coerceRaces(parsed: unknown): ResolvedRace[] | null {
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { races?: unknown }).races)
  ) {
    return null;
  }
  const out: ResolvedRace[] = [];
  for (const r of (parsed as { races: unknown[] }).races) {
    if (typeof r !== "object" || r === null) continue;
    const rr = r as Record<string, unknown>;
    const raceNumber = Number(rr.raceNumber);
    if (!Number.isFinite(raceNumber) || raceNumber <= 0) continue;
    const runnersRaw = Array.isArray(rr.runners) ? rr.runners : [];
    const runners: ResolvedRunner[] = [];
    for (const h of runnersRaw) {
      if (typeof h !== "object" || h === null) continue;
      const hh = h as Record<string, unknown>;
      const number = Number(hh.number);
      const name = typeof hh.name === "string" ? hh.name.trim() : "";
      if (!Number.isFinite(number) || number <= 0 || name === "") continue;
      runners.push({
        number,
        name,
        jockey: typeof hh.jockey === "string" ? hh.jockey.trim() : "TBA",
        trainer: typeof hh.trainer === "string" ? hh.trainer.trim() : "TBA",
        barrier: Number.isFinite(Number(hh.barrier)) ? Number(hh.barrier) : 0,
        scratched: hh.scratched === true,
      });
    }
    if (runners.length > 0) out.push({ raceNumber, runners });
  }
  // Sanity: a real meeting has runners; reject an empty/degenerate parse
  // so the caller degrades cleanly rather than caching garbage.
  return out.length > 0 ? out : null;
}

async function callPerplexity(
  apiKey: string,
  meetingName: string,
  date: string,
): Promise<{ races: ResolvedRace[]; citations: string[] } | null> {
  // Perplexity Agent API (/v1/responses). Verified to return real per-runner
  // AU fields where /chat/completions + sonar-pro returned nothing.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const input =
      `Official acceptance field for the Australian thoroughbred meeting ` +
      `"${meetingName}" on ${date}. For EVERY race list every runner: ` +
      `saddlecloth number, horse name, jockey, trainer, barrier, ` +
      `scratched(true/false). Include scratched runners with scratched=true. ` +
      `Return ONLY JSON: {"races":[{"raceNumber":1,"runners":[{"number":1,` +
      `"name":"","jockey":"","trainer":"","barrier":1,"scratched":false}]}]}`;

    const res = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({ preset: PERPLEXITY_PRESET, input }),
    });

    if (!res.ok) {
      console.warn(`[fieldResolution] perplexity ${res.status} ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as { output?: unknown };
    const out = Array.isArray(data.output) ? data.output : [];
    let answer = "";
    const citations: string[] = [];
    for (const it of out) {
      const item = it as { type?: string; content?: unknown; results?: unknown };
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          const text = (c as { text?: unknown })?.text;
          if (typeof text === "string") answer += text;
        }
      }
      if (item?.type === "search_results" && Array.isArray(item.results)) {
        for (const r of item.results) {
          const url = (r as { url?: unknown })?.url;
          if (typeof url === "string") citations.push(url);
        }
      }
    }
    if (answer.trim() === "") return null;

    const races = coerceRaces(parseLoose(answer));
    if (!races) return null;

    return { races, citations };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fieldResolution] perplexity call failed: ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve (or return cached) authoritative field for a meeting.
 * Web app calls this via ConvexHttpClient.action.
 */
export const resolveMeetingField = action({
  args: {
    date: v.string(),
    meetingName: v.string(),
    category: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<ResolveResult> => {
    const { date, meetingName, category } = args;

    // 1. Cache hit (fresh, unless forced)
    if (!args.force) {
      const cached = await ctx.runQuery(api.meetings.getResolvedField, {
        date,
        name: meetingName,
      });
      if (
        cached.resolved &&
        Date.now() - cached.fetchedAt < FRESHNESS_MS &&
        cached.races.length > 0
      ) {
        return cached;
      }
    }

    // 2. Need a key, else degrade
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return { resolved: false, reason: "no_api_key" };
    }

    // 3. Resolve via Perplexity
    const result = await callPerplexity(apiKey, meetingName, date);

    if (!result) {
      // Record "unavailable" so the UI can show why and not hammer the API.
      try {
        const meetingId = await ctx.runMutation(api.meetings.upsert, {
          name: meetingName,
          date,
          category,
          status: "upcoming" as const,
          raceCount: 0,
        });
        await ctx.runMutation(api.meetings.recordFieldResolution, {
          meetingId,
          fieldStatus: "unavailable" as const,
          fieldSource: `perplexity:${PERPLEXITY_MODEL}`,
          fieldFetchedAt: Date.now(),
          fieldCitations: [],
        });
      } catch {
        /* best-effort; never throw */
      }
      return { resolved: false, reason: "field_unavailable" };
    }

    // 4. Persist into the existing meetings/races/horses tables
    const fetchedAt = Date.now();
    try {
      const meetingId = await ctx.runMutation(api.meetings.upsert, {
        name: meetingName,
        date,
        category,
        status: "upcoming" as const,
        raceCount: result.races.length,
      });

      for (const race of result.races) {
        const raceId = await ctx.runMutation(api.races.upsert, {
          meetingId,
          raceNumber: race.raceNumber,
          status: "upcoming" as const,
        });
        for (const runner of race.runners) {
          await ctx.runMutation(api.horses.upsert, {
            raceId,
            horseNumber: runner.number,
            horseName: runner.name,
            jockey: runner.jockey || "TBA",
            trainer: runner.trainer || "TBA",
            weight: 57, // not provided by field resolution; schema requires it
            barrier: runner.barrier,
            scratched: runner.scratched,
          });
        }
      }

      await ctx.runMutation(api.meetings.recordFieldResolution, {
        meetingId,
        fieldStatus: "resolved" as const,
        fieldSource: `perplexity:${PERPLEXITY_MODEL}`,
        fieldFetchedAt: fetchedAt,
        fieldCitations: result.citations,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[fieldResolution] persist failed: ${msg}`);
      // Persist failed but we still have the field in memory — return it
      // so this run isn't wasted; next call will re-resolve & re-cache.
      return {
        resolved: true,
        source: `perplexity:${PERPLEXITY_MODEL}`,
        fetchedAt,
        citations: result.citations,
        races: result.races,
      };
    }

    return {
      resolved: true,
      source: `perplexity:${PERPLEXITY_MODEL}`,
      fetchedAt,
      citations: result.citations,
      races: result.races,
    };
  },
});
