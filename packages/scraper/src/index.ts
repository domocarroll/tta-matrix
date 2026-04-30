// ──────────────────────────────────────────────────────
// TTA Matrix — Cloudflare Worker Scraper
// ──────────────────────────────────────────────────────
//
// Cron-triggered worker that scrapes Australian race
// data from racenet.com.au and pushes to Convex.
//
// Crons:
// - 8am AEST: Scrape today's fields
// - 8pm AEST: Scrape tomorrow's fields
// - Every 15min during race hours: Scrape results

interface Env {
  CONVEX_URL: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const hour = new Date().getUTCHours();

    // Determine action based on cron trigger time
    // 8am AEST = 22:00 UTC (prev day) or 6am AEST = 20:00 UTC
    // Results cron runs every 15 min during race hours

    if (hour === 8 || hour === 20) {
      // Fields scrape
      await scrapeFields(env);
    } else {
      // Results scrape
      await scrapeResults(env);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "tta-scraper" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Manual trigger endpoints for testing
    if (url.pathname === "/scrape/fields") {
      await scrapeFields(env);
      return new Response(JSON.stringify({ triggered: "fields" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/scrape/results") {
      await scrapeResults(env);
      return new Response(JSON.stringify({ triggered: "results" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

// ──────────────────────────────────────────────────────
// Scraping Functions (Phase 0.5 - to be implemented)
// ──────────────────────────────────────────────────────

async function scrapeFields(env: Env): Promise<void> {
  // TODO: Implement racenet.com.au field scraping
  // 1. Fetch form guide page
  // 2. Parse meetings, races, horses
  // 3. Push to Convex via HTTP actions
  console.log("Fields scrape triggered", { convexUrl: env.CONVEX_URL });
}

async function scrapeResults(env: Env): Promise<void> {
  // TODO: Implement race results scraping
  // 1. Fetch results page for today
  // 2. Parse results for each race
  // 3. Push to Convex via HTTP actions
  console.log("Results scrape triggered", { convexUrl: env.CONVEX_URL });
}
