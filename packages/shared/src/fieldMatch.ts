// ──────────────────────────────────────────────────────
// TTA Matrix — Pure Field Matcher
// ──────────────────────────────────────────────────────
//
// Anchors aggregated tip names to the AUTHORITATIVE race field.
// This kills the "xxxxCall Me Gorgeous" duplicate-row bug class:
// OCR noise / misspellings that produced two rows for one runner are
// canonicalised to the official name+number and MERGED into one.
//
// Pure & immutable: never mutates inputs; returns all-new structures.
// Zero network, zero side effects — fully deterministic.

import type { AggregatedRace, AggregatedTip } from "./types.ts";

/** A runner from the authoritative race field (source of truth) */
export interface FieldRunner {
  readonly number: number;
  readonly name: string;
  readonly jockey: string;
  readonly trainer: string;
  readonly barrier: number;
  readonly scratched: boolean;
  /**
   * Reserve/emergency runner — listed in the card's "Emergencies" block under
   * its race. Belongs to THAT race (the one above the block), keeps its own
   * saddlecloth number, and only starts if a scratching opens a spot. Tagged
   * so it can never bleed into the next race and so the UI can show it apart
   * from the main field. Absent on legacy/auto-resolved fields.
   */
  readonly emergency?: boolean;
}

/** A correctness/quality flag raised during matching */
export interface FieldMatchFlag {
  // unmatched_runner/tip_on_scratched: raised by matchField during anchoring.
  // cross_race/phantom/number_mismatch: raised by the Field Gate (fieldGate.ts),
  // the richer, attributed catch tier layered on top.
  readonly type:
    | "unmatched_runner"
    | "tip_on_scratched"
    | "cross_race"
    | "phantom"
    | "number_mismatch";
  readonly race: number;
  readonly description: string;
}

/** Minimum Jaro-Winkler similarity to accept a fuzzy match */
const FUZZY_THRESHOLD = 0.92;

/**
 * Minimum margin the best fuzzy candidate must beat the runner-up by.
 * Below this the match is "ambiguous" and we refuse to guess.
 */
const AMBIGUITY_MARGIN = 0.05;

// ──────────────────────────────────────────────────────
// Normalisation
// ──────────────────────────────────────────────────────

/**
 * Strip leading repeated-character OCR noise such as "xxxx" or "xx ".
 * Targets a run (>= 2) of the same letter at the very start, optionally
 * followed by a separator, when removing it still leaves real content.
 */
function stripLeadingOcrNoise(input: string): string {
  // e.g. "xxxxCall Me Gorgeous", "xx Sunlight", "ooo Real Name"
  const noise = /^([a-z])\1{1,}(?=[\s]|[a-z])\s*/i;
  const stripped = input.replace(noise, "");
  return stripped.trim().length > 0 ? stripped : input;
}

/**
 * Normalise a horse name for comparison:
 *  - strip leading OCR noise
 *  - lowercase
 *  - fold accents/diacritics to base ASCII (café → cafe)
 *  - strip non-alphanumerics
 *  - collapse whitespace
 */
function normalise(raw: string): string {
  const deNoised = stripLeadingOcrNoise(raw);
  return deNoised
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .toLowerCase()
    .replace(/['’`]/g, "") // apostrophes join letters (o'reilly → oreilly)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token set (sorted, de-duplicated words) for order-insensitive equality */
function tokenSetKey(normalised: string): string {
  const tokens = normalised.split(" ").filter((t) => t.length > 0);
  return Array.from(new Set(tokens)).sort().join(" ");
}

// ──────────────────────────────────────────────────────
// Jaro-Winkler similarity (inline, well-tested via fieldMatch.test.ts)
// ──────────────────────────────────────────────────────

/** Jaro similarity in [0, 1] */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions = transpositions / 2;

  const m = matches;
  return (m / a.length + m / b.length + (m - transpositions) / m) / 3;
}

/**
 * Jaro-Winkler similarity in [0, 1] — boosts strings that share a common
 * prefix (up to 4 chars), which suits horse names well.
 */
function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j === 0) return 0;

  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  const scalingFactor = 0.1;
  return j + prefix * scalingFactor * (1 - j);
}

// ──────────────────────────────────────────────────────
// Matching
// ──────────────────────────────────────────────────────

interface IndexedRunner {
  readonly runner: FieldRunner;
  readonly norm: string;
  readonly tokenKey: string;
}

interface MatchOutcome {
  /** Index into the indexed-runner array, or -1 for no confident match */
  readonly runnerIndex: number;
}

/**
 * Find the single confident runner for a tip name, or -1.
 * Priority: exact normalised == ; token-set equality ; Jaro-Winkler.
 * Fuzzy matches must clear the threshold AND be unambiguous.
 */
function findRunner(tipName: string, runners: ReadonlyArray<IndexedRunner>): MatchOutcome {
  const norm = normalise(tipName);
  if (norm.length === 0) return { runnerIndex: -1 };
  const tokenKey = tokenSetKey(norm);

  // 1. Exact normalised equality
  for (let i = 0; i < runners.length; i++) {
    if (runners[i]!.norm === norm) return { runnerIndex: i };
  }

  // 2. Token-set equality (handles word-order differences)
  for (let i = 0; i < runners.length; i++) {
    if (runners[i]!.tokenKey === tokenKey) return { runnerIndex: i };
  }

  // 3. Jaro-Winkler — best candidate, with ambiguity guard
  let bestIndex = -1;
  let bestScore = -1;
  let secondScore = -1;

  for (let i = 0; i < runners.length; i++) {
    const score = jaroWinkler(norm, runners[i]!.norm);
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestIndex = i;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestScore < FUZZY_THRESHOLD) return { runnerIndex: -1 };

  // Ambiguous: best does not clearly beat the runner-up → do NOT guess.
  if (secondScore >= 0 && bestScore - secondScore < AMBIGUITY_MARGIN) {
    return { runnerIndex: -1 };
  }

  return { runnerIndex: bestIndex };
}

// ──────────────────────────────────────────────────────
// Merge accumulation
// ──────────────────────────────────────────────────────

interface MergeAcc {
  readonly runner: FieldRunner;
  totalTips: number;
  tipsterCount: number;
  winTips: number;
  place2Tips: number;
  place3Tips: number;
  place4Tips: number;
}

function startAcc(runner: FieldRunner, tip: AggregatedTip): MergeAcc {
  return {
    runner,
    totalTips: tip.totalTips,
    tipsterCount: tip.tipsterCount,
    winTips: tip.winTips,
    place2Tips: tip.place2Tips,
    place3Tips: tip.place3Tips,
    place4Tips: tip.place4Tips,
  };
}

/** Fold a second tip into an existing accumulator (returns NEW object) */
function foldAcc(acc: MergeAcc, tip: AggregatedTip): MergeAcc {
  return {
    runner: acc.runner,
    totalTips: acc.totalTips + tip.totalTips,
    tipsterCount: acc.tipsterCount + tip.tipsterCount,
    winTips: acc.winTips + tip.winTips,
    place2Tips: acc.place2Tips + tip.place2Tips,
    place3Tips: acc.place3Tips + tip.place3Tips,
    place4Tips: acc.place4Tips + tip.place4Tips,
  };
}

function accToTip(acc: MergeAcc): AggregatedTip {
  return {
    horseName: acc.runner.name,
    horseNumber: acc.runner.number,
    totalTips: acc.totalTips,
    tipsterCount: acc.tipsterCount,
    winTips: acc.winTips,
    place2Tips: acc.place2Tips,
    place3Tips: acc.place3Tips,
    place4Tips: acc.place4Tips,
    jockey: acc.runner.jockey,
    trainer: acc.runner.trainer,
    barrier: acc.runner.barrier,
    fieldMatched: true,
  };
}

/**
 * Sort key matching aggregation.ts exactly:
 * primary totalTips desc, tiebreak winTips desc.
 */
function sortTips(a: AggregatedTip, b: AggregatedTip): number {
  if (b.totalTips !== a.totalTips) return b.totalTips - a.totalTips;
  return b.winTips - a.winTips;
}

// ──────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────

/**
 * Anchor a race's tips to the authoritative field.
 *
 * - Confident matches are canonicalised (official name + number) and
 *   enriched with jockey/trainer/barrier; multiple tip rows resolving
 *   to the same runner are MERGED (summed) into one row.
 * - Unmatched tips are kept verbatim and flagged `unmatched_runner`.
 * - Tips on scratched runners are kept and flagged `tip_on_scratched`.
 * - Empty field → race returned unchanged, no flags (graceful degrade).
 *
 * Pure: inputs are never mutated; all returned structures are new.
 *
 * @param race  The aggregated race to anchor
 * @param field The authoritative list of runners (may be empty)
 * @returns A new race plus any quality flags raised
 */
export function matchField(
  race: AggregatedRace,
  field: ReadonlyArray<FieldRunner>,
): { race: AggregatedRace; flags: ReadonlyArray<FieldMatchFlag> } {
  // Graceful degrade: nothing authoritative to anchor against.
  if (field.length === 0) {
    return { race, flags: [] };
  }

  const runners: ReadonlyArray<IndexedRunner> = field.map((runner) => {
    const norm = normalise(runner.name);
    return { runner, norm, tokenKey: tokenSetKey(norm) };
  });

  const flags: FieldMatchFlag[] = [];
  const scratchedFlagged = new Set<number>();

  // Merge buckets keyed by runner index; preserve first-seen order for
  // deterministic output before the final re-sort.
  const buckets = new Map<number, MergeAcc>();
  const bucketOrder: number[] = [];
  const passthrough: AggregatedTip[] = [];

  for (const tip of race.tips) {
    const { runnerIndex } = findRunner(tip.horseName, runners);

    if (runnerIndex === -1) {
      // No confident match — keep verbatim, flag, never drop.
      passthrough.push({ ...tip });
      flags.push({
        type: "unmatched_runner",
        race: race.raceNumber,
        description: `Tipped horse "${tip.horseName}" did not match any runner in the field for race ${race.raceNumber}`,
      });
      continue;
    }

    const matched = runners[runnerIndex]!.runner;

    if (matched.scratched && !scratchedFlagged.has(runnerIndex)) {
      scratchedFlagged.add(runnerIndex);
      flags.push({
        type: "tip_on_scratched",
        race: race.raceNumber,
        description: `Tipped horse "${tip.horseName}" matched scratched runner #${matched.number} ${matched.name} in race ${race.raceNumber}`,
      });
    }

    const existing = buckets.get(runnerIndex);
    if (existing === undefined) {
      buckets.set(runnerIndex, startAcc(matched, tip));
      bucketOrder.push(runnerIndex);
    } else {
      // Duplicate row for the same runner → MERGE (the dup-row fix).
      buckets.set(runnerIndex, foldAcc(existing, tip));
    }
  }

  const matchedTips = bucketOrder.map((idx) => accToTip(buckets.get(idx)!));

  // Re-sort by the SAME rule aggregation.ts uses.
  const tips = [...matchedTips, ...passthrough].sort(sortTips);

  const nextRace: AggregatedRace = {
    category: race.category,
    raceNumber: race.raceNumber,
    meetingName: race.meetingName,
    tips,
    totalSelectionsInRace: tips.reduce((sum, t) => sum + t.totalTips, 0),
    totalTipstersInRace: race.totalTipstersInRace,
  };

  return { race: nextRace, flags };
}
