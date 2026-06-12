// Hard guard against invalid race numbers leaking out of model output.
// The prompts forbid race 0 / non-integer / string race numbers, but a prompt
// is an instruction, not an invariant — this enforces it. Any race failing the
// check is dropped and surfaced as an anomaly flag, never silently shown.

export interface AnomalyFlag {
  type: 'anomaly'
  description: string
}

interface RaceLike {
  raceNumber?: unknown
}

function coerceRaceNumber(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * Returns races with valid 1-indexed integer raceNumbers (numeric strings are
 * coerced), plus an anomaly flag for every race that was dropped.
 */
export function sanitiseRaces<T extends RaceLike>(
  races: T[] | undefined | null
): { races: T[]; flags: AnomalyFlag[] } {
  const valid: T[] = []
  const flags: AnomalyFlag[] = []
  for (const race of races ?? []) {
    const n = coerceRaceNumber(race?.raceNumber)
    if (n === null) {
      flags.push({
        type: 'anomaly',
        description: `Dropped race with invalid race number ${JSON.stringify(race?.raceNumber)} — race numbers must be integers starting at 1.`
      })
      continue
    }
    valid.push(n === race.raceNumber ? race : { ...race, raceNumber: n })
  }
  return { races: valid, flags }
}
