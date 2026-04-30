// ──────────────────────────────────────────────────────
// TTA Matrix — Domain Constants
// ──────────────────────────────────────────────────────

import type { RaceCategory } from "./types.ts";

/** Category metadata — state-based racing codes across Australia */
export const CATEGORIES: Record<
  RaceCategory,
  { readonly name: string; readonly color: string }
> = {
  SR: { name: "Sydney", color: "#4285f4" },
  MR: { name: "Melbourne", color: "#34a853" },
  BR: { name: "Brisbane", color: "#e94e37" },
  PR: { name: "Perth", color: "#d4a843" },
  AR: { name: "Adelaide", color: "#7b2fbe" },
  OR: { name: "Other", color: "#5f6368" },
} as const;

/** Valid race number range */
export const MIN_RACE_NUMBER = 1;
export const MAX_RACE_NUMBER = 10;

/** Extraction config */
export const EXTRACTION_TEMPERATURE = 0.1;
export const MAX_CONTINUATION_ATTEMPTS = 5;
export const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

/** Retry config */
export const MAX_RETRIES = 2;
export const INITIAL_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 8000;
export const JITTER_FACTOR = 0.3;

/** Aggregation defaults */
export const QUADDIE_LEG_COUNT = 4;
export const QUADDIE_HORSES_PER_LEG = 3;
export const TRIFECTA_SELECTION_COUNT = 3;
export const FIRST_FOUR_SELECTION_COUNT = 4;

/** Refusal phrases — indicators that the AI declined to process the image */
export const REFUSAL_PHRASES: ReadonlyArray<string> = [
  "i cannot",
  "i can't",
  "i'm unable",
  "i am unable",
  "sorry, but",
  "i apologize",
  "cannot fulfill",
  "unable to process",
  "unable to extract",
  "cannot extract",
  "cannot process",
  "not able to",
  "inappropriate",
  "cannot assist",
  "cannot help",
  "i don't see",
  "no text",
  "no readable",
  "image does not contain",
  "image doesn't contain",
  "cannot identify",
  "cannot read",
  "too blurry",
  "too dark",
  "illegible",
  "unreadable",
] as const;

/** Positive JSON indicators in AI response */
export const JSON_INDICATORS: ReadonlyArray<string> = [
  "[",
  "{",
  "```json",
  '"r":',
  '"raceNumber":',
] as const;

/** Negative (text/prose) indicators in AI response */
export const TEXT_RESPONSE_INDICATORS: ReadonlyArray<string> = [
  "hello",
  "hi ",
  "here",
  "based",
  "unfortunately",
  "it looks",
  "it appears",
  "i can see",
] as const;
