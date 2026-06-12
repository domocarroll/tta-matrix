// ──────────────────────────────────────────────────────
// The Field Gate — the deterministic catch tier.
// ──────────────────────────────────────────────────────
//
// After the model (the "labour" tier — Haiku or Sonnet) extracts tips, every
// pick is checked against Pete's locked official field. This is pure code, not
// a model: "does this pick exist in its race?" is a lookup, not a judgement.
//
// It catches the exact failure modes that motivated leaving the OCR pipeline —
// cross-race contamination, phantom horses, number misreads — and hands each
// one to the human (Gate 3) or, at scale, to a reasoning model, as an
// adjudication-ready note. Cheap model + cheap validator = trustworthy output.
//
// Pure & immutable: never mutates inputs.

import type { AggregatedRace } from "./types.ts";
import type { FieldRunner, FieldMatchFlag } from "./fieldMatch.ts";

// Canonical name key: drop parenthetical country codes ("(FR)", "(Nz)") that the
// official card carries but tipsters omit, lowercase, strip non-alphanumeric.
export function nameKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Levenshtein — absorbs spelling drift (Glamorous vs Glamourous) between the
// tipster's hand and the official card.
function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Fuzzy equal: exact key, or edit distance within ~15% of length (min 2).
export function fuzzyEq(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return lev(a, b) <= Math.max(2, Math.floor(Math.min(a.length, b.length) * 0.15));
}

/**
 * Validate every pick in `races` against the locked field. Returns one
 * attributed flag per exception — nothing for picks that reconcile cleanly.
 *
 * Verdict order:
 *   1. name matches a runner in THIS race → OK (flag only on number disagreement)
 *   2. name matches a runner in ANOTHER race → cross_race (a strong name match
 *      elsewhere beats a bare number coincidence here — the conflict is exactly
 *      what Pete should adjudicate, not something to silently resolve)
 *   3. saddlecloth number anchors to a real runner here → OK (abbreviated name,
 *      matched nowhere else by name)
 *   4. name found nowhere in the field → phantom
 *
 * `tip_on_scratched` is left to matchField, which already detects it during
 * anchoring; this layer adds the richer, attributed catches on top.
 */
export function validateAgainstField(
  races: ReadonlyArray<AggregatedRace>,
  fieldByRace: ReadonlyMap<number, ReadonlyArray<FieldRunner>>,
): FieldMatchFlag[] {
  const flags: FieldMatchFlag[] = [];
  if (fieldByRace.size === 0) return flags;

  // Global index: nameKey → { race, number } for cross-race attribution.
  const elsewhere = new Map<string, { race: number; number: number }>();
  for (const [raceNumber, runners] of fieldByRace) {
    for (const r of runners) {
      const k = nameKey(r.name);
      if (k && !elsewhere.has(k)) elsewhere.set(k, { race: raceNumber, number: r.number });
    }
  }

  const findInOtherRaces = (
    k: string,
    notRace: number,
  ): { race: number; number: number } | null => {
    for (const [raceNumber, runners] of fieldByRace) {
      if (raceNumber === notRace) continue;
      for (const r of runners) {
        if (fuzzyEq(k, nameKey(r.name))) return { race: raceNumber, number: r.number };
      }
    }
    return null;
  };

  for (const race of races) {
    const field = fieldByRace.get(race.raceNumber);
    if (!field || field.length === 0) continue; // no truth for this race — can't validate

    for (const tip of race.tips) {
      const k = nameKey(tip.horseName);

      // 1. name matches a runner in THIS race
      const here = field.find((r) => fuzzyEq(k, nameKey(r.name)));
      if (here) {
        if (!here.scratched && tip.horseNumber != null && tip.horseNumber !== here.number) {
          flags.push({
            type: "number_mismatch",
            race: race.raceNumber,
            description: `${tip.horseName} tipped as #${tip.horseNumber} in R${race.raceNumber} — the field has it as #${here.number}. Saddlecloth number likely misread.`,
          });
        }
        continue;
      }

      // 2. name belongs to another race → contamination, with attribution.
      // Checked BEFORE the number anchor: a confident name match elsewhere is a
      // stronger signal than a saddlecloth number that merely exists here.
      const other = findInOtherRaces(k, race.raceNumber);
      if (other) {
        flags.push({
          type: "cross_race",
          race: race.raceNumber,
          description: `${tip.horseName} tipped in R${race.raceNumber} — that horse runs in R${other.race} (#${other.number}). Likely cross-race contamination.`,
        });
        continue;
      }

      // 3. number anchors to a real runner here (abbreviated/unreadable name,
      // not matched anywhere by name)
      if (tip.horseNumber != null && field.some((r) => r.number === tip.horseNumber)) {
        continue;
      }

      // 4. nowhere in the field → phantom
      flags.push({
        type: "phantom",
        race: race.raceNumber,
        description: `${tip.horseName}${tip.horseNumber != null ? ` (#${tip.horseNumber})` : ""} tipped in R${race.raceNumber} — not in the field for any race. Likely a misread or header artefact.`,
      });
    }
  }

  return flags;
}
