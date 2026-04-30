// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Demo CLI (Agentic Extraction)
// ──────────────────────────────────────────────────────
//
// Single-shot demo entry point for the Pete pitch.
//
// Usage:
//   tsx src/demo.ts <image-path> [--model=<id>] [--save]
//
// What this does that the v0 deterministic pipeline does NOT:
//   1. Asks Claude to NARRATE its reasoning before extracting.
//      (publication detection, tipster identification, prefix
//      artefact recognition, ambiguity flagging.)
//   2. Returns reasoning_trace + extracted_tips + flags in one
//      structured response.
//   3. Refuses to silently corrupt — any uncertainty is FLAGGED.
//   4. Recognises publication-specific markup (XX prefix,
//      strikethrough, column-bleed) as artefacts to strip
//      rather than horse-name characters to ingest.
//
// This is the live demo we run on Pete's actual 24-Apr image.

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";

interface DemoFlag {
  readonly type:
    | "publication_artefact_stripped"
    | "duplicate_resolved"
    | "ambiguity"
    | "uncertain"
    | "anomaly";
  readonly race?: number;
  readonly description: string;
}

interface DemoSelection {
  readonly position: number;
  readonly horseName: string;
  readonly horseNumber?: number;
}

interface DemoTip {
  readonly tipsterName: string;
  readonly selections: ReadonlyArray<DemoSelection>;
}

interface DemoRace {
  readonly raceNumber: number;
  readonly tips: ReadonlyArray<DemoTip>;
}

interface DemoResult {
  readonly publication: string;
  readonly meeting: string;
  readonly category: string;
  readonly tipstersDetected: ReadonlyArray<string>;
  readonly reasoning: ReadonlyArray<string>;
  readonly races: ReadonlyArray<DemoRace>;
  readonly flags: ReadonlyArray<DemoFlag>;
}

const SYSTEM_PROMPT = `You are TipBot v2, an agentic horse-racing tip extraction system for Australian racing.

You replace a deterministic OCR pipeline that has failed for months on edge cases:
  - publication-specific prefix markup (e.g. "XX" / "xxx" prefix bleeding into horse names)
  - cross-race contamination (horses appearing in races they don't belong to)
  - phantom horses (rows from headers/footers being treated as picks)
  - duplicate tipsters (same person, different abbreviation)
  - silent corruption when race numbers are missing or ambiguous

Your job is to REASON about the image first, then extract.

Process:
  1. Identify the publication (Daily Telegraph, Herald Sun, Winning Post, TAB grid, TV screenshot, etc.)
  2. Identify the meeting (Randwick, Flemington, etc.) and racing category (SR/MR/BR/PR/AR/OR)
  3. Identify the tipsters (column headers in grid format, or row headers in some layouts)
  4. For each race, extract each tipster's selections IN ORDER (1st pick, 2nd, 3rd, 4th)
  5. NORMALISE horse names: strip publication prefixes (XX, xxx, ★, etc.), title-case consistently
  6. DE-DUPLICATE: if a horse appears with and without a prefix, treat as one horse
  7. FLAG ambiguity: if you can't tell which race a tip belongs to, flag it — never guess
  8. NARRATE every non-trivial decision: which prefixes you stripped, which duplicates you resolved

Output a single JSON object matching this schema. No markdown fences, no prose outside JSON.

{
  "publication": "<publication name or 'unknown'>",
  "meeting": "<meeting venue>",
  "category": "<SR|MR|BR|PR|AR|OR>",
  "tipstersDetected": ["<name>", ...],
  "reasoning": [
    "<step 1 of your reasoning>",
    "<step 2 ...>",
    "<a sentence per non-trivial observation>"
  ],
  "races": [
    {
      "raceNumber": 1,
      "tips": [
        {
          "tipsterName": "<exact name>",
          "selections": [
            {"position": 1, "horseName": "<normalised name>", "horseNumber": 5},
            ...
          ]
        }
      ]
    }
  ],
  "flags": [
    {
      "type": "publication_artefact_stripped|duplicate_resolved|ambiguity|uncertain|anomaly",
      "race": 4,
      "description": "<what you noticed and what you did>"
    }
  ]
}

Rules:
- Never silently merge or split data. If you do something to clean up, flag it.
- Race numbers are 1-indexed integers, never strings, never 0.
- If you see a horse with an "XX"/"xxx" prefix that matches another horse without the prefix in the same race, the prefix is publication markup — strip it and de-duplicate. Add a publication_artefact_stripped flag.
- If a horse name looks like it migrated from an adjacent race column, do NOT include it in this race. Add an anomaly flag.
- If you can't read a tipster column or selection clearly, OMIT it and add an uncertain flag rather than guessing.`;

function loadImage(imagePath: string): {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
} {
  const resolved = path.resolve(imagePath);
  const buffer = fs.readFileSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const mediaType = (
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
      ? "image/webp"
      : ext === ".gif"
      ? "image/gif"
      : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  return { base64: buffer.toString("base64"), mediaType };
}

function loadEnv(): { apiKey: string } {
  const envPath = path.resolve(import.meta.dirname ?? __dirname, "../../../.env");
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, "utf-8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && m[1] && !process.env[m[1]]) {
        process.env[m[1]] = m[2];
      }
    }
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in .env or environment");
  }
  return { apiKey };
}

function parseJsonLoose(raw: string): DemoResult {
  let cleaned = raw.trim();
  const fenceStart = cleaned.indexOf("```");
  if (fenceStart !== -1) {
    cleaned = cleaned.slice(fenceStart + 3);
    if (cleaned.startsWith("json")) cleaned = cleaned.slice(4);
    const fenceEnd = cleaned.lastIndexOf("```");
    if (fenceEnd !== -1) cleaned = cleaned.slice(0, fenceEnd);
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned) as DemoResult;
}

function dim(s: string): string {
  return `\x1b[2m${s}\x1b[0m`;
}
function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}
function cyan(s: string): string {
  return `\x1b[36m${s}\x1b[0m`;
}
function green(s: string): string {
  return `\x1b[32m${s}\x1b[0m`;
}
function yellow(s: string): string {
  return `\x1b[33m${s}\x1b[0m`;
}

function printResult(
  result: DemoResult,
  meta: { model: string; tokensIn: number; tokensOut: number; ms: number },
): void {
  const horseCount = result.races.reduce(
    (n, r) => n + r.tips.reduce((m, t) => m + t.selections.length, 0),
    0,
  );

  console.log("");
  console.log(bold(cyan("═══ TipBot v2 — Agentic Extraction ═══")));
  console.log("");
  console.log(`${dim("Publication:")}  ${result.publication}`);
  console.log(`${dim("Meeting:")}      ${result.meeting} (${result.category})`);
  console.log(
    `${dim("Tipsters:")}     ${result.tipstersDetected.length} — ${result.tipstersDetected.join(", ")}`,
  );
  console.log(`${dim("Races:")}        ${result.races.length}`);
  console.log(`${dim("Selections:")}   ${horseCount}`);
  console.log("");
  console.log(bold("AGENT REASONING"));
  result.reasoning.forEach((line, i) => {
    console.log(`  ${cyan(`${i + 1}.`)} ${line}`);
  });
  console.log("");

  if (result.flags.length > 0) {
    console.log(bold(yellow("FLAGS")));
    result.flags.forEach((f) => {
      const tag = `[${f.type}${f.race !== undefined ? ` r${f.race}` : ""}]`;
      console.log(`  ${yellow(tag)} ${f.description}`);
    });
    console.log("");
  } else {
    console.log(green("No flags — clean extraction."));
    console.log("");
  }

  console.log(bold("EXTRACTED RACES"));
  for (const race of result.races) {
    const tipsters = race.tips.length;
    const picks = race.tips.reduce((n, t) => n + t.selections.length, 0);
    console.log(`  ${bold(`Race ${race.raceNumber}`)}  ${dim(`${tipsters} tipsters · ${picks} picks`)}`);
    for (const tip of race.tips) {
      const sels = tip.selections
        .map((s) => `${s.horseNumber ?? "?"}.${s.horseName}`)
        .join("  ");
      console.log(`    ${dim(tip.tipsterName.padEnd(16))} ${sels}`);
    }
  }
  console.log("");
  console.log(
    dim(
      `model=${meta.model}  tokens=${meta.tokensIn}in/${meta.tokensOut}out  time=${meta.ms}ms`,
    ),
  );
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const imagePath = args.find((a) => !a.startsWith("--"));
  const modelArg = args.find((a) => a.startsWith("--model="));
  const saveOutput = args.includes("--save");

  if (!imagePath) {
    console.error("Usage: tsx src/demo.ts <image-path> [--model=<id>] [--save]");
    process.exit(1);
  }

  const { apiKey } = loadEnv();
  const model = modelArg
    ? modelArg.split("=")[1] ?? "claude-sonnet-4-6"
    : "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey });

  const { base64, mediaType } = loadImage(imagePath);
  console.log(dim(`▸ ${path.basename(imagePath)}  (${(base64.length * 0.75 / 1024).toFixed(0)}KB)`));
  console.log(dim(`▸ model=${model}  reasoning + structured extraction`));
  console.log(dim("▸ thinking..."));

  const t0 = Date.now();
  const response = await client.messages.create({
    model,
    max_tokens: 16384,
    temperature: 0.1,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extract this tip sheet. Reason first, then output the JSON object. No prose outside JSON.",
          },
        ],
      },
    ],
  });
  const ms = Date.now() - t0;

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let result: DemoResult;
  try {
    result = parseJsonLoose(text);
  } catch (err) {
    console.error("JSON parse failed.");
    console.error(text.slice(0, 500));
    throw err;
  }

  printResult(result, {
    model,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    ms,
  });

  if (saveOutput) {
    const outPath = imagePath.replace(/\.[^.]+$/, "") + ".extraction.json";
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(dim(`saved → ${outPath}`));
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
