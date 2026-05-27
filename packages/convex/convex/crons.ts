// ──────────────────────────────────────────────────────
// TTA Matrix — Cron Schedules
// ──────────────────────────────────────────────────────
//
// No scheduled jobs in Stage 1.
//
// Race-field resolution is now ON-DEMAND (Perplexity-backed, see
// `fieldResolution.ts`) — it runs when Pete drops a tip sheet and is
// cached per meeting, so there is nothing to pre-scrape on a cron.
//
// Results scraping + auto-settlement is Stage 2 (deliberately out of
// scope). The previous racenet HTML scraper was deleted; if results
// ingestion is built later, add the cron here and push via the existing
// `/scraper/results` HTTP action in `http.ts`.

import { cronJobs } from "convex/server";

const crons = cronJobs();

export default crons;
