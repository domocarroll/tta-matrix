// Client wrapper for /api/user-fields (Pete's approved race-card data).
//
// User-approved fields take priority over Perplexity-resolved fields
// for the same meetingKey. This is the authoritative path Pete asked
// for: he uploads the official cards, reviews, approves, and tip
// aggregation anchors to those runners.

import type { ResolvedField } from './fieldResolution'

export interface UserFieldRunner {
  number: number
  name: string
  jockey?: string
  trainer?: string
  barrier?: number
  scratched?: boolean
}

export interface UserFieldRace {
  raceNumber: number
  distance?: number
  runners: UserFieldRunner[]
}

export interface UserField {
  meetingKey: string
  races: UserFieldRace[]
  sourceFilenames: string[]
  approvedAt: number
}

export async function loadUserFields(clientId: string): Promise<UserField[]> {
  try {
    const r = await fetch(`/api/user-fields?clientId=${encodeURIComponent(clientId)}`)
    if (!r.ok) return []
    const j = (await r.json()) as { rows: UserField[] }
    return j.rows
  } catch {
    return []
  }
}

export async function saveUserField(input: {
  clientId: string
  meetingKey: string
  races: UserFieldRace[]
  sourceFilenames: string[]
}): Promise<boolean> {
  try {
    const r = await fetch('/api/user-fields', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteUserField(clientId: string, meetingKey: string): Promise<boolean> {
  try {
    const r = await fetch(
      `/api/user-fields?clientId=${encodeURIComponent(clientId)}&meetingKey=${encodeURIComponent(meetingKey)}`,
      { method: 'DELETE' }
    )
    return r.ok
  } catch {
    return false
  }
}

/** Convert UserField[] into the ResolvedField shape the matcher expects. */
export function userFieldsToResolvedMap(fields: UserField[]): Map<string, ResolvedField> {
  const out = new Map<string, ResolvedField>()
  for (const f of fields) {
    const sourceLabel =
      f.sourceFilenames.length > 0
        ? `user-approved · ${f.sourceFilenames.join(' + ')}`
        : 'user-approved'
    out.set(f.meetingKey, {
      resolved: true,
      source: sourceLabel,
      fetchedAt: f.approvedAt,
      citations: [],
      races: f.races.map((r) => ({
        raceNumber: r.raceNumber,
        runners: r.runners.map((rn) => ({
          number: rn.number,
          name: rn.name,
          jockey: rn.jockey ?? '',
          trainer: rn.trainer ?? '',
          barrier: rn.barrier ?? 0,
          scratched: rn.scratched ?? false
        }))
      }))
    })
  }
  return out
}

/** Merge two field maps — user fields win when both present. */
export function mergeFields(
  base: Map<string, ResolvedField>,
  user: Map<string, ResolvedField>
): Map<string, ResolvedField> {
  const out = new Map(base)
  for (const [k, v] of user) out.set(k, v)
  return out
}
