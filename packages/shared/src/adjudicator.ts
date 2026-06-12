// ──────────────────────────────────────────────────────
// The ADJUDICATE tier — contract / sketch.
// ──────────────────────────────────────────────────────
//
// The Field Gate (fieldGate.ts) DETECTS exceptions. An adjudicator RESOLVES
// them — correct the pick, drop it, confirm it, or escalate to a human.
//
//   LABOUR  →  GROUND  →  CATCH (Field Gate)  →  ADJUDICATE (this box)
//
// Today the adjudicator is Pete: every exception escalates to Gate 3 review.
// That's `humanAdjudicator` below — modelled as an adjudicator so the rest of
// the pipeline is byte-identical the day a reasoning model takes the box.
//
// At scale (customers > eyeballs), `reasoningAdjudicator` fills it: hand the
// model JUST one flagged case — the flag, the true field, the sibling picks,
// and the cropped source image — and let it re-read with full reasoning budget
// on the 0.4% that actually need it. Confidence-gated: resolve when sure,
// escalate when not, so a human only ever sees the irreducible residue.
//
// This module stays PURE — the model call is injected, so `@tta/shared` never
// depends on the SDK. NOT WIRED into the app yet: this is the seam, typed and
// demonstrable, so the scale path exists before the spend does.

import type { FieldMatchFlag, FieldRunner } from "./fieldMatch.ts";
import type { AggregatedTip } from "./types.ts";

/** A cropped region of the source sheet, for the model to re-read. */
export interface ImageRegion {
  readonly mediaType: "image/jpeg" | "image/png" | "image/webp";
  readonly base64: string;
  /** Optional crop hint to the flagged race; full sheet if absent. */
  readonly crop?: { x: number; y: number; w: number; h: number };
}

/** One exception, with everything an adjudicator needs to resolve it. */
export interface AdjudicationCase {
  /** What the Field Gate caught (cross_race / phantom / number_mismatch / …). */
  readonly flag: FieldMatchFlag;
  /** The offending pick, verbatim. */
  readonly pick: AggregatedTip;
  readonly raceNumber: number;
  /** The authoritative runners for this race — the truth to reconcile against. */
  readonly field: ReadonlyArray<FieldRunner>;
  /** Other picks in the same race — context for disambiguation. */
  readonly siblingPicks: ReadonlyArray<AggregatedTip>;
  /** Source pixels for re-reading. Optional until image-passing is wired. */
  readonly image?: ImageRegion;
}

/** The resolution — a discriminated union so callers handle each outcome. */
export type Resolution =
  | { readonly kind: "correct"; readonly horseName: string; readonly horseNumber?: number; readonly rationale: string }
  | { readonly kind: "drop"; readonly rationale: string } // contamination / header artefact — remove
  | { readonly kind: "confirm"; readonly rationale: string } // gate was over-cautious; pick stands
  | { readonly kind: "escalate"; readonly rationale: string }; // not confident — hand to a human

export interface Verdict {
  readonly case: AdjudicationCase;
  readonly resolution: Resolution;
  readonly confidence: number; // 0..1
}

/** The contract. Human-backed today, model-backed at scale — same shape. */
export interface Adjudicator {
  adjudicate(c: AdjudicationCase): Promise<Verdict>;
}

// ── Tier 1 (live today): the human. Everything escalates to Gate 3. ──
export const humanAdjudicator: Adjudicator = {
  async adjudicate(c) {
    return {
      case: c,
      resolution: { kind: "escalate", rationale: "Routed to Gate 3 for Pete to adjudicate." },
      confidence: 0,
    };
  },
};

// ── Tier 2 (scale): the reasoning model. Seam typed; not wired. ──

/** The prompt the model receives — documented so the contract is legible. */
export interface AdjudicationPrompt {
  readonly system: string;
  readonly flag: FieldMatchFlag;
  readonly field: ReadonlyArray<FieldRunner>;
  readonly pick: AggregatedTip;
  readonly siblingPicks: ReadonlyArray<AggregatedTip>;
  readonly image?: ImageRegion;
}

export interface RawVerdict {
  readonly resolution: Resolution;
  readonly confidence: number;
}

export interface ReasoningAdjudicatorOptions {
  /** Spend intelligence where ambiguity lives, e.g. "claude-opus-4-8". */
  readonly model: string;
  /** Below this confidence, ANY resolution is downgraded to escalate. Never guess. */
  readonly minConfidence: number;
  /** Injected model call — keeps this module SDK-free and testable. */
  readonly call: (prompt: AdjudicationPrompt) => Promise<RawVerdict>;
}

export const ADJUDICATOR_SYSTEM = `You adjudicate a SINGLE flagged horse-racing tip that failed validation against the official field.

You are given: the flag, the authoritative runners for the race, the other picks in that race, and (when available) the cropped source image. Re-read carefully and decide ONE outcome:
- correct: the pick is a real selection but misread — give the right horse name and/or saddlecloth number from the field.
- drop: the pick is cross-race contamination or a header/footer artefact — it should be removed.
- confirm: the field gate was over-cautious — the pick is actually valid as-is.
- escalate: you are not clearly confident — a human will decide.

Reason from the image first, then the field. If the image and field disagree, trust the field for WHICH runners exist, the image for WHAT was written. Output {resolution, confidence} where confidence is 0..1. If not clearly confident, choose escalate. NEVER guess a correction you are unsure of — a wrong "fix" that looks clean is worse than an honest escalation.`;

export function reasoningAdjudicator(opts: ReasoningAdjudicatorOptions): Adjudicator {
  return {
    async adjudicate(c) {
      const raw = await opts.call({
        system: ADJUDICATOR_SYSTEM,
        flag: c.flag,
        field: c.field,
        pick: c.pick,
        siblingPicks: c.siblingPicks,
        image: c.image,
      });
      // Confidence gate — the whole trick. Below the bar, downgrade any
      // resolution to an escalation so a human, not a guess, makes the call.
      const resolution: Resolution =
        raw.confidence >= opts.minConfidence
          ? raw.resolution
          : {
              kind: "escalate",
              rationale: `Model confidence ${raw.confidence.toFixed(2)} < ${opts.minConfidence.toFixed(2)} — routed to human.`,
            };
      return { case: c, resolution, confidence: raw.confidence };
    },
  };
}

// ── Driver: run an adjudicator over a meeting's flagged cases, partition. ──
export interface AdjudicationOutcome {
  /** Auto-resolved (correct / drop / confirm) — applied without a human. */
  readonly resolved: ReadonlyArray<Verdict>;
  /** Could not resolve confidently — surfaced to a human. */
  readonly escalated: ReadonlyArray<Verdict>;
}

export async function runAdjudication(
  cases: ReadonlyArray<AdjudicationCase>,
  adjudicator: Adjudicator,
): Promise<AdjudicationOutcome> {
  const verdicts = await Promise.all(cases.map((c) => adjudicator.adjudicate(c)));
  return {
    resolved: verdicts.filter((v) => v.resolution.kind !== "escalate"),
    escalated: verdicts.filter((v) => v.resolution.kind === "escalate"),
  };
}
