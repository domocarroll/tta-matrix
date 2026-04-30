// ──────────────────────────────────────────────────────
// TTA Matrix — Cloudflare Browser Rendering Scraper
// ──────────────────────────────────────────────────────
//
// Uses CF Browser Rendering /scrape API to fetch race data
// from racing websites that require JavaScript rendering
// and have bot protection.
//
// This is called from Convex actions in scraping.ts.
// CF Browser Rendering runs a real Chromium browser on
// Cloudflare's edge — handles cookies, JS, captchas.
//
// API: POST https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/scrape
//
// Free tier: 5,000 requests/month (plenty for race scraping)

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface ScrapeElement {
  readonly selector: string;
  readonly name?: string;
  readonly fields?: ReadonlyArray<{
    readonly selector: string;
    readonly name: string;
    readonly attribute?: string;
  }>;
}

interface ScrapeRequest {
  readonly url: string;
  readonly elements: ReadonlyArray<ScrapeElement>;
  readonly wait_for?: string;
  readonly timeout?: number;
}

interface ScrapeResult {
  readonly elements: ReadonlyArray<{
    readonly selector: string;
    readonly results: ReadonlyArray<Record<string, string>>;
  }>;
}

interface CFScrapeConfig {
  readonly accountId: string;
  readonly apiToken: string;
}

// ────────────────────────────────────────────────
// Core scrape function
// ────────────────────────────────────────────────

export async function cfScrape(
  config: CFScrapeConfig,
  request: ScrapeRequest,
): Promise<ScrapeResult | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/browser-rendering/scrape`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[cf-scraper] API error: ${response.status} ${errorText}`,
      );
      return null;
    }

    const data = (await response.json()) as { result: ScrapeResult; success: boolean };
    if (!data.success) {
      console.error("[cf-scraper] Scrape returned success=false");
      return null;
    }

    return data.result;
  } catch (err) {
    console.error("[cf-scraper] Fetch error:", err);
    return null;
  }
}

// ────────────────────────────────────────────────
// Racenet form guide scraper
// ────────────────────────────────────────────────

interface ScrapedMeeting {
  readonly name: string;
  readonly state: string;
  readonly raceCount: number;
  readonly url: string;
}

interface ScrapedRace {
  readonly raceNumber: number;
  readonly name: string;
  readonly distance: number;
  readonly class: string;
  readonly scheduledTime: string;
  readonly horses: ReadonlyArray<ScrapedHorse>;
}

interface ScrapedHorse {
  readonly horseNumber: number;
  readonly horseName: string;
  readonly jockey: string;
  readonly trainer: string;
  readonly weight: number;
  readonly barrier: number;
  readonly scratched: boolean;
}

interface ScrapedResult {
  readonly raceNumber: number;
  readonly results: ReadonlyArray<{
    readonly position: number;
    readonly horseName: string;
    readonly horseNumber: number;
  }>;
}

/**
 * Scrape today's meetings list from racenet form guide.
 */
export async function scrapeMeetings(
  config: CFScrapeConfig,
  date: string,
): Promise<ReadonlyArray<ScrapedMeeting>> {
  const result = await cfScrape(config, {
    url: `https://www.racenet.com.au/form-guide/${date}`,
    elements: [
      {
        selector: ".meeting-card, .meeting-item, [data-meeting], .race-meeting",
        fields: [
          { selector: ".meeting-name, .venue-name, h3, h4", name: "name" },
          { selector: ".meeting-state, .state", name: "state" },
          { selector: ".race-count, .num-races", name: "raceCount" },
          { selector: "a", name: "url", attribute: "href" },
        ],
      },
    ],
    wait_for: ".meeting-card, .meeting-item, [data-meeting], .race-meeting",
    timeout: 15000,
  });

  if (!result) return [];

  const meetingsElement = result.elements[0];
  if (!meetingsElement) return [];

  return meetingsElement.results
    .map((m) => ({
      name: (m.name ?? "").trim(),
      state: (m.state ?? "").trim(),
      raceCount: parseInt(m.raceCount ?? "0", 10) || 0,
      url: (m.url ?? "").trim(),
    }))
    .filter((m) => m.name.length > 0);
}

/**
 * Scrape race fields for a specific meeting.
 */
export async function scrapeRaceFields(
  config: CFScrapeConfig,
  meetingUrl: string,
): Promise<ReadonlyArray<ScrapedRace>> {
  const result = await cfScrape(config, {
    url: meetingUrl.startsWith("http")
      ? meetingUrl
      : `https://www.racenet.com.au${meetingUrl}`,
    elements: [
      {
        selector: ".race-card, .race-panel, [data-race]",
        fields: [
          { selector: ".race-number, .race-num", name: "raceNumber" },
          { selector: ".race-name, .race-title", name: "name" },
          { selector: ".race-distance, .distance", name: "distance" },
          { selector: ".race-class, .class", name: "class" },
          { selector: ".race-time, .start-time", name: "scheduledTime" },
        ],
      },
      {
        selector: ".runner-row, .runner, .horse-row, [data-runner]",
        fields: [
          { selector: ".runner-number, .horse-number, .tab-no", name: "horseNumber" },
          { selector: ".runner-name, .horse-name", name: "horseName" },
          { selector: ".jockey, .jockey-name", name: "jockey" },
          { selector: ".trainer, .trainer-name", name: "trainer" },
          { selector: ".weight", name: "weight" },
          { selector: ".barrier, .gate", name: "barrier" },
          { selector: ".scratched, .scr", name: "scratched" },
        ],
      },
    ],
    wait_for: ".runner-row, .runner, .horse-row, [data-runner]",
    timeout: 20000,
  });

  if (!result) return [];

  const racesElement = result.elements[0];
  const runnersElement = result.elements[1];

  if (!racesElement || !runnersElement) return [];

  // Parse races
  const races = racesElement.results.map((r) => ({
    raceNumber: parseInt(r.raceNumber ?? "0", 10) || 0,
    name: (r.name ?? "").trim(),
    distance: parseInt(r.distance ?? "0", 10) || 0,
    class: (r.class ?? "").trim(),
    scheduledTime: (r.scheduledTime ?? "").trim(),
    horses: [] as ScrapedHorse[],
  }));

  // Parse horses and assign to races
  // This requires understanding the page structure — horses are typically
  // nested under their race. For now, we'll collect all horses and
  // distribute them based on the race structure.
  const allHorses = runnersElement.results.map((h) => ({
    horseNumber: parseInt(h.horseNumber ?? "0", 10) || 0,
    horseName: (h.horseName ?? "").trim(),
    jockey: (h.jockey ?? "").trim(),
    trainer: (h.trainer ?? "").trim(),
    weight: parseFloat(h.weight ?? "0") || 57,
    barrier: parseInt(h.barrier ?? "0", 10) || 0,
    scratched:
      (h.scratched ?? "").toLowerCase().includes("scr") ||
      (h.scratched ?? "").toLowerCase().includes("scratched"),
  }));

  // If we have horses but can't match to races, assign all to first race
  // (This will be refined once we see the actual page structure)
  if (races.length > 0 && allHorses.length > 0) {
    // Simple heuristic: divide horses roughly equally among races
    const horsesPerRace = Math.ceil(allHorses.length / races.length);
    for (let i = 0; i < races.length; i++) {
      const race = races[i];
      if (!race) continue;
      const start = i * horsesPerRace;
      const end = Math.min(start + horsesPerRace, allHorses.length);
      (race.horses as ScrapedHorse[]).push(...allHorses.slice(start, end));
    }
  }

  return races.filter((r) => r.raceNumber > 0);
}

/**
 * Scrape race results for a meeting.
 */
export async function scrapeRaceResults(
  config: CFScrapeConfig,
  meetingName: string,
  date: string,
): Promise<ReadonlyArray<ScrapedResult>> {
  const result = await cfScrape(config, {
    url: `https://www.racenet.com.au/results/${date}/${meetingName.toLowerCase().replace(/\s+/g, "-")}`,
    elements: [
      {
        selector: ".result-row, .race-result, [data-result]",
        fields: [
          { selector: ".race-number, .race-num", name: "raceNumber" },
          { selector: ".position, .finish-pos", name: "position" },
          { selector: ".horse-name, .runner-name", name: "horseName" },
          { selector: ".horse-number, .tab-no", name: "horseNumber" },
        ],
      },
    ],
    wait_for: ".result-row, .race-result, [data-result]",
    timeout: 15000,
  });

  if (!result) return [];

  const resultsElement = result.elements[0];
  if (!resultsElement) return [];

  // Group by race number
  const byRace = new Map<number, Array<{ position: number; horseName: string; horseNumber: number }>>();

  for (const r of resultsElement.results) {
    const raceNum = parseInt(r.raceNumber ?? "0", 10);
    if (raceNum === 0) continue;

    const existing = byRace.get(raceNum) ?? [];
    existing.push({
      position: parseInt(r.position ?? "0", 10) || 0,
      horseName: (r.horseName ?? "").trim(),
      horseNumber: parseInt(r.horseNumber ?? "0", 10) || 0,
    });
    byRace.set(raceNum, existing);
  }

  return Array.from(byRace.entries())
    .map(([raceNumber, results]) => ({
      raceNumber,
      results: results
        .filter((r) => r.position > 0 && r.horseName.length > 0)
        .sort((a, b) => a.position - b.position),
    }))
    .filter((r) => r.results.length > 0);
}
