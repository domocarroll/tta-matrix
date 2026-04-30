// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Extraction Prompts
// ──────────────────────────────────────────────────────
//
// Ported from v0 with adaptations for Claude's vision.
// Key v0 learnings:
// - Abbreviated keys save ~40% tokens
// - Continuation protocol for large sheets
// - TV screenshots need explicit race separation
// - Temperature 0.1 for deterministic extraction

export const SYSTEM_PROMPT = `You are TipBot, a horse racing tip extraction and analysis agent for Australian racing.

You process tip sheet images, structure the data, and help punters make informed decisions.
You have access to historical race data, tipster performance stats, and aggregation functions.

When analysing, be precise. Horse names must be exact. Race numbers must be correct.
When uncertain, flag it rather than guess.`;

export const EXTRACTION_PROMPT = `Extract all horse racing tips from this image into structured JSON.

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

export const CONTINUATION_PROMPT = "continue";

/**
 * Build the extraction messages array for the Anthropic API.
 * Returns the messages to send for a new extraction or continuation.
 */
export function buildExtractionMessages(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  previousResponse?: string,
): Array<{
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}> {
  if (previousResponse) {
    // Continuation: append previous assistant response + "continue"
    return [
      {
        role: "user" as const,
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
      {
        role: "assistant" as const,
        content: previousResponse,
      },
      {
        role: "user" as const,
        content: CONTINUATION_PROMPT,
      },
    ];
  }

  return [
    {
      role: "user" as const,
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: imageBase64,
          },
        },
        { type: "text", text: EXTRACTION_PROMPT },
      ],
    },
  ];
}
