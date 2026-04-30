// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Tip Extraction Engine
// ──────────────────────────────────────────────────────
//
// Vision extraction pipeline ported from v0. Key changes:
// - Uses Claude vision (better than Gemini for structured layouts)
// - No separate OCR service — the agent IS the extractor
// - Continuation protocol preserved for large sheets
// - JSON repair pipeline preserved (AI still returns malformed JSON)

import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import {
  cleanResponse,
  needsContinuation,
  isRefusal,
  looksLikeJson,
  expandExtraction,
  categoriseError,
  shouldRetry,
  getRetryDelay,
  type RawExtraction,
  type ExpandedTip,
  EXTRACTION_TEMPERATURE,
  MAX_CONTINUATION_ATTEMPTS,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  JITTER_FACTOR,
} from "@tta/shared";
import { SYSTEM_PROMPT, buildExtractionMessages } from "./prompts.ts";

interface ExtractionResult {
  readonly tips: ReadonlyArray<ExpandedTip>;
  readonly rawResponse: string;
  readonly continuations: number;
  readonly model: string;
}

interface ExtractionError {
  readonly error: string;
  readonly category: string;
  readonly isRetryable: boolean;
}

type ExtractionOutcome = ExtractionResult | ExtractionError;

function isError(outcome: ExtractionOutcome): outcome is ExtractionError {
  return "error" in outcome;
}

/**
 * Parse and repair JSON from AI response.
 *
 * Strategy chain:
 * 1. Direct JSON.parse on cleaned response
 * 2. jsonrepair → JSON.parse
 * 3. Throw with context
 */
function parseExtractionJson(raw: string): ReadonlyArray<RawExtraction> {
  const cleaned = cleanResponse(raw);

  if (cleaned.length < 10) {
    throw new Error("Response too short to contain valid extraction data");
  }

  // Strategy 1: Direct parse
  try {
    return JSON.parse(cleaned) as ReadonlyArray<RawExtraction>;
  } catch {
    // Continue to repair
  }

  // Strategy 2: jsonrepair
  try {
    const repaired = jsonrepair(cleaned);
    return JSON.parse(repaired) as ReadonlyArray<RawExtraction>;
  } catch {
    throw new Error(`Failed to parse extraction JSON after repair: ${cleaned.slice(0, 200)}...`);
  }
}

/**
 * Extract tips from a single image.
 *
 * Handles:
 * - Vision API call with continuation protocol
 * - JSON parsing + repair
 * - Field expansion (abbreviated → full keys)
 * - Retry with exponential backoff
 */
export async function extractTipsFromImage(
  client: Anthropic,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg",
  model: string = "claude-sonnet-4-6",
): Promise<ExtractionOutcome> {
  let lastError: ExtractionError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await extractWithContinuation(
        client,
        imageBase64,
        mediaType,
        model,
      );
      return result;
    } catch (err) {
      const categorised = categoriseError(err);
      lastError = {
        error: categorised.userMessage,
        category: categorised.category,
        isRetryable: categorised.isRetryable,
      };

      if (!shouldRetry(categorised, attempt, MAX_RETRIES)) {
        return lastError;
      }

      const delay = getRetryDelay(
        attempt,
        INITIAL_RETRY_DELAY_MS,
        MAX_RETRY_DELAY_MS,
        JITTER_FACTOR,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return lastError ?? {
    error: "Extraction failed after all retries",
    category: "UNKNOWN",
    isRetryable: false,
  };
}

/**
 * Single extraction attempt with continuation support.
 */
async function extractWithContinuation(
  client: Anthropic,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  model: string,
): Promise<ExtractionResult> {
  let accumulatedResponse = "";
  let continuations = 0;

  for (let i = 0; i < MAX_CONTINUATION_ATTEMPTS; i++) {
    const messages = buildExtractionMessages(
      imageBase64,
      mediaType,
      accumulatedResponse || undefined,
    );

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      temperature: EXTRACTION_TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: messages as Anthropic.MessageParam[],
    });

    const text =
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("") || "";

    // Check for refusal
    if (isRefusal(text)) {
      throw new Error(`AI refused to process image: ${text.slice(0, 100)}`);
    }

    // Check for text response (not JSON)
    if (!looksLikeJson(text) && i === 0) {
      throw new Error(`AI returned text instead of JSON: ${text.slice(0, 100)}`);
    }

    accumulatedResponse += text;

    if (needsContinuation(accumulatedResponse)) {
      continuations++;
      continue;
    }

    // No continuation needed — parse and return
    break;
  }

  const rawData = parseExtractionJson(accumulatedResponse);
  const expanded = expandExtraction(rawData);

  return {
    tips: expanded,
    rawResponse: accumulatedResponse,
    continuations,
    model,
  };
}
