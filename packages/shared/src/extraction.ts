// ──────────────────────────────────────────────────────
// TTA Matrix — Extraction Utilities (ported from v0)
// ──────────────────────────────────────────────────────

import {
  MIN_RACE_NUMBER,
  MAX_RACE_NUMBER,
  REFUSAL_PHRASES,
  JSON_INDICATORS,
  TEXT_RESPONSE_INDICATORS,
} from "./constants.ts";
import type { RawExtraction, ExpandedTip } from "./types.ts";

/** Normalise horse name to Title Case */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
    .trim();
}

/** Clamp race number to valid range [1, 10] */
export function clampRaceNumber(raw: number | string): number {
  const parsed = typeof raw === "string" ? parseInt(raw, 10) : raw;
  if (isNaN(parsed)) return MIN_RACE_NUMBER;
  return Math.max(MIN_RACE_NUMBER, Math.min(MAX_RACE_NUMBER, parsed));
}

/** Parse horse number — returns undefined for unparseable values (not NaN) */
export function parseHorseNumber(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const parsed = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return isNaN(parsed) ? undefined : parsed;
}

/** Detect if AI response is a refusal */
export function isRefusal(text: string): boolean {
  const lower = text.toLowerCase();
  return REFUSAL_PHRASES.some((phrase) => lower.includes(phrase));
}

/** Detect if response looks like JSON (not prose) */
export function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  const hasPositiveIndicator = JSON_INDICATORS.some(
    (indicator) => trimmed.startsWith(indicator) || trimmed.includes(indicator),
  );
  if (hasPositiveIndicator) return true;

  const lower = trimmed.toLowerCase();
  const hasNegativeIndicator = TEXT_RESPONSE_INDICATORS.some(
    (indicator) => lower.startsWith(indicator),
  );
  return !hasNegativeIndicator;
}

/** Strip markdown fences and continuation markers from AI response */
export function cleanResponse(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  // Remove continuation markers
  cleaned = cleaned.replace(/\[CONTINUE\]/gi, "");

  return cleaned.trim();
}

/** Detect if response was truncated (continuation needed) */
export function needsContinuation(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.includes("[CONTINUE]")) return true;
  // Truncated mid-object — ends with an incomplete key-value pair
  if (trimmed.endsWith('"horseName":') || trimmed.endsWith('"h":')) return true;
  // Ends with incomplete JSON (trailing comma or open bracket)
  if (trimmed.endsWith(",") || trimmed.endsWith("[") || trimmed.endsWith("{")) return true;
  return false;
}

/**
 * Expand abbreviated extraction keys to full names.
 * Handles both abbreviated (r, t, n, s, h, num) and full keys.
 * The AI may return either format — this handles both defensively.
 */
export function expandExtraction(raw: ReadonlyArray<RawExtraction>): ReadonlyArray<ExpandedTip> {
  return raw.map((race) => {
    const raceAny = race as unknown as Record<string, unknown>;
    const raceNum = race.r ?? (raceAny.raceNumber as string | undefined) ?? "1";
    const tipsList = race.t ?? (raceAny.tips as RawExtraction["t"] | undefined) ?? [];

    return {
      raceNumber: clampRaceNumber(raceNum),
      tips: tipsList.map((tip) => {
        const tipAny = tip as unknown as Record<string, unknown>;
        const tipsterName = tip.n ?? (tipAny.tipsterName as string | undefined) ?? "Unknown";
        const selections = tip.s ?? (tipAny.selections as RawExtraction["t"][number]["s"] | undefined) ?? [];

        return {
          tipsterName,
          selections: selections
            .map((sel) => {
              const selAny = sel as unknown as Record<string, unknown>;
              const horseName = sel.h ?? (selAny.horseName as string | undefined) ?? "";
              const horseNum = sel.num ?? (selAny.horseNumber as string | undefined);
              return {
                horseName: titleCase(horseName),
                horseNumber: parseHorseNumber(horseNum),
              };
            })
            .filter((s) => s.horseName.length > 0),
        };
      }).filter((tip) => tip.selections.length > 0),
    };
  }).filter((race) => race.tips.length > 0);
}
