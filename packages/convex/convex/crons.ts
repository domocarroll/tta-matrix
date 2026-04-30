// ──────────────────────────────────────────────────────
// TTA Matrix — Cron Schedules
// ──────────────────────────────────────────────────────
//
// Convex scheduled functions for automated data scraping.
//
// Schedule (AEST / UTC):
//   6:00pm AEST (08:00 UTC) — Scrape tomorrow's fields
//   6:00am AEST (20:00 UTC prev day) — Refresh today's fields + scratchings
//   Every 15 min — Scrape results (during race hours)
//
// Note: Convex crons use UTC. AEST = UTC+10, AEDT = UTC+11.

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Evening before: scrape tomorrow's race fields
// 8:00 UTC = 6:00pm AEST (or 7:00pm AEDT)
crons.cron(
  "scrape-fields-evening",
  "0 8 * * *",
  internal.scraping.scrapeFields,
  { date: undefined },
);

// Morning of: refresh fields with final scratchings
// 20:00 UTC = 6:00am AEST next day (or 7:00am AEDT)
crons.cron(
  "scrape-fields-morning",
  "0 20 * * *",
  internal.scraping.scrapeFields,
  { date: undefined },
);

// Every 15 minutes: scrape results
// Runs 24/7 but the action itself checks if there are live meetings
crons.interval(
  "scrape-results",
  { minutes: 15 },
  internal.scraping.scrapeResults,
  { date: undefined },
);

export default crons;
