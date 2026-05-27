// ──────────────────────────────────────────────────────
// Client wrapper for /api/resolve-field (Perplexity-backed)
// ──────────────────────────────────────────────────────
//
// The authoritative runner field for a meeting. A "miss" (no key,
// field not published yet, transport fault) is a normal, expected
// state — the workspace degrades to tip-only aggregation. This wrapper
// never throws; callers branch on `resolved`.

import type { FieldRunner } from '@tta/shared'

export interface ResolvedFieldRace {
  raceNumber: number
  runners: FieldRunner[]
}

export type ResolvedField =
  | {
      resolved: true
      source: string
      fetchedAt: number
      citations: string[]
      races: ResolvedFieldRace[]
    }
  | { resolved: false; reason: string }

export async function resolveField(input: {
  date: string
  meetingName: string
  category: string
  force?: boolean
}): Promise<ResolvedField> {
  try {
    const res = await fetch('/api/resolve-field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (!res.ok) {
      return { resolved: false, reason: `http_${res.status}` }
    }
    return (await res.json()) as ResolvedField
  } catch (err) {
    return {
      resolved: false,
      reason: err instanceof Error ? err.message : 'request_failed'
    }
  }
}
