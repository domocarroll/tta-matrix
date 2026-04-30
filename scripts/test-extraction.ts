// ──────────────────────────────────────────────────────
// Test extraction pipeline against real tip sheet images
// ──────────────────────────────────────────────────────
//
// Usage: ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-extraction.ts
//
// Tests Claude vision extraction against the v0 fixture images.
// Does NOT need Convex deployed — just the Anthropic API key.

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  cleanResponse,
  needsContinuation,
  isRefusal,
  looksLikeJson,
  expandExtraction,
  aggregateRaces,
} from "../packages/shared/src/index.ts";
import { jsonrepair } from "jsonrepair";

const FIXTURES_DIR = path.resolve(
  process.env.HOME ?? "~",
  "v0-thetipanalyser/e2e/fixtures/images",
);

const EXTRACTION_PROMPT = `Extract all horse racing tips from this image into structured JSON.

OUTPUT FORMAT (use abbreviated keys to minimise tokens):
[{"r":"<raceNumber>","t":[{"n":"<tipsterName>","s":[{"h":"<horseName>","num":"<horseNumber>"}]}]}]

RULES:
1. r = race number (1-10, never 0)
2. t = array of tipsters for this race
3. n = tipster name (exactly as shown)
4. s = selections array, ORDERED BY PREFERENCE:
   - index 0 = win/1st pick
   - index 1 = 2nd pick
   - index 2 = 3rd pick
   - index 3 = 4th pick
5. h = horse name (exactly as shown)
6. num = horse/TAB number (if visible, omit if not)
7. Each race MUST be a separate object — never merge races
8. If this is a TV broadcast screenshot, identify which race each set of tips belongs to
9. If the image shows multiple meetings, extract ALL of them
10. If response would be too long, stop mid-array and output [CONTINUE]

OUTPUT ONLY THE JSON ARRAY. No explanation, no markdown fences, no prose.`;

function getMediaType(
  filePath: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function parseExtractionJson(raw: string): unknown[] {
  const cleaned = cleanResponse(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(jsonrepair(cleaned));
    } catch {
      throw new Error(
        `Failed to parse: ${cleaned.slice(0, 200)}...`,
      );
    }
  }
}

async function testImage(
  client: Anthropic,
  imagePath: string,
  model: string,
): Promise<{
  file: string;
  success: boolean;
  races: number;
  tipsters: number;
  tips: number;
  continuations: number;
  tokens: { input: number; output: number };
  error?: string;
  duration: number;
}> {
  const file = path.basename(imagePath);
  const start = Date.now();

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");
    const mediaType = getMediaType(imagePath);

    // Check file size
    if (imageBuffer.length > 3 * 1024 * 1024) {
      return {
        file,
        success: false,
        races: 0,
        tipsters: 0,
        tips: 0,
        continuations: 0,
        tokens: { input: 0, output: 0 },
        error: "File too large (>3MB)",
        duration: Date.now() - start,
      };
    }

    let accumulated = "";
    let continuations = 0;
    let totalInput = 0;
    let totalOutput = 0;

    // Initial extraction
    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (isRefusal(text)) {
      return {
        file,
        success: false,
        races: 0,
        tipsters: 0,
        tips: 0,
        continuations: 0,
        tokens: { input: totalInput, output: totalOutput },
        error: `Refusal: ${text.slice(0, 80)}`,
        duration: Date.now() - start,
      };
    }

    accumulated = text;

    // Handle continuations
    while (needsContinuation(accumulated) && continuations < 5) {
      continuations++;
      const contResponse = await client.messages.create({
        model,
        max_tokens: 8192,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
          { role: "assistant", content: accumulated },
          { role: "user", content: "continue" },
        ],
      });

      totalInput += contResponse.usage.input_tokens;
      totalOutput += contResponse.usage.output_tokens;

      const contText = contResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      accumulated += contText;
    }

    // Parse and expand
    const rawData = parseExtractionJson(accumulated);
    const expanded = expandExtraction(rawData as any);

    // Count totals
    let totalTipsters = 0;
    let totalTips = 0;
    for (const race of expanded) {
      totalTipsters += race.tips.length;
      for (const tip of race.tips) {
        totalTips += tip.selections.length;
      }
    }

    return {
      file,
      success: true,
      races: expanded.length,
      tipsters: totalTipsters,
      tips: totalTips,
      continuations,
      tokens: { input: totalInput, output: totalOutput },
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      file,
      success: false,
      races: 0,
      tipsters: 0,
      tips: 0,
      continuations: 0,
      tokens: { input: 0, output: 0 },
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY environment variable");
    process.exit(1);
  }

  const model = process.env.MODEL ?? "claude-opus-4-20250514";
  const client = new Anthropic({ apiKey });

  // Find fixture images
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .filter((f) => !f.startsWith("invalid") && !f.startsWith("oversized"));

  console.log(`Found ${files.length} test images in ${FIXTURES_DIR}`);
  console.log(`Model: ${model}`);
  console.log("─".repeat(80));

  // Test specific file if provided as argument
  const targetFile = process.argv[2];
  const filesToTest = targetFile
    ? files.filter((f) => f.includes(targetFile))
    : files;

  if (filesToTest.length === 0) {
    console.error(`No matching files found${targetFile ? ` for "${targetFile}"` : ""}`);
    process.exit(1);
  }

  const results = [];
  for (const file of filesToTest) {
    const imagePath = path.join(FIXTURES_DIR, file);
    console.log(`\nTesting: ${file}`);

    const result = await testImage(client, imagePath, model);
    results.push(result);

    if (result.success) {
      console.log(
        `  ✓ ${result.races} races, ${result.tipsters} tipsters, ${result.tips} selections` +
          (result.continuations > 0
            ? ` (${result.continuations} continuations)`
            : "") +
          ` [${(result.duration / 1000).toFixed(1)}s, ${result.tokens.input}in/${result.tokens.output}out]`,
      );
    } else {
      console.log(`  ✗ ${result.error} [${(result.duration / 1000).toFixed(1)}s]`);
    }
  }

  // Summary
  console.log("\n" + "─".repeat(80));
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalTokensIn = results.reduce((s, r) => s + r.tokens.input, 0);
  const totalTokensOut = results.reduce((s, r) => s + r.tokens.output, 0);

  console.log(
    `\nResults: ${passed}/${results.length} passed, ${failed} failed`,
  );
  console.log(
    `Total tokens: ${totalTokensIn} input, ${totalTokensOut} output`,
  );

  if (failed > 0) {
    console.log("\nFailed:");
    for (const r of results.filter((r) => !r.success)) {
      console.log(`  ${r.file}: ${r.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
