// ──────────────────────────────────────────────────────
// Workspace logic — group, aggregate, apply Pete's corrections
// ──────────────────────────────────────────────────────

import {
  aggregateRaces,
  buildMeetingKey,
  parseMeetingKey,
  type AggregatedRace,
  type ExpandedTip,
  type RaceCategory,
} from '@tta/shared'

import type { ExtractionResult } from './types'

/** A row coming back from /api/workspace (full-fat extraction). */
export interface WorkspaceRow {
  _id: string
  _creationTime: number
  filename: string
  publication: string
  meeting: string
  category: string
  tipstersDetected: ReadonlyArray<string>
  reasoning: ReadonlyArray<string>
  races: ExtractionResult['races']
  flags: ExtractionResult['flags']
  tokensIn: number
  tokensOut: number
  durationMs: number
  model: string
  meetingKey: string
}

export interface HorsePatch {
  raceNumber: number
  originalName: string
  action: 'rename' | 'renumber' | 'remove'
  newHorseName?: string
  newHorseNumber?: number
}

export interface MeetingCorrection {
  meetingKey: string
  label: string | null
  notes: string | null
  horsePatches: ReadonlyArray<HorsePatch>
  updatedAt: number
}

export interface MeetingGroup {
  meetingKey: string
  date: string
  category: RaceCategory
  meeting: string
  label: string | null
  notes: string | null
  rows: WorkspaceRow[]
  totalTipsters: ReadonlyArray<string>
  raceNumbers: ReadonlyArray<number>
  flagCount: number
  /** Aggregated races AFTER Pete's corrections applied. */
  aggregated: ReadonlyArray<AggregatedRace>
  /** Aggregated races as the agent originally produced (no overlay). */
  aggregatedRaw: ReadonlyArray<AggregatedRace>
  /** The patches in effect, for the edit UI. */
  patches: ReadonlyArray<HorsePatch>
}

/** Group rows by meetingKey then aggregate each group. */
export function buildMeetingGroups(
  rows: ReadonlyArray<WorkspaceRow>,
  corrections: ReadonlyArray<MeetingCorrection>
): MeetingGroup[] {
  const correctionsByKey = new Map<string, MeetingCorrection>()
  for (const c of corrections) correctionsByKey.set(c.meetingKey, c)

  const grouped = new Map<string, WorkspaceRow[]>()
  for (const row of rows) {
    const key = row.meetingKey || buildMeetingKey(row.category, row.meeting, row._creationTime)
    const arr = grouped.get(key) ?? []
    arr.push(row)
    grouped.set(key, arr)
  }

  const groups: MeetingGroup[] = []
  for (const [meetingKey, groupRows] of grouped) {
    const { date, category, meeting } = parseMeetingKey(meetingKey)
    const correction = correctionsByKey.get(meetingKey) ?? null

    // Build ExpandedTip[] from all rows in this group
    const allTips = expandedTipsFromRows(groupRows)
    const aggregatedRaw = aggregateRaces(allTips, category, meeting)
    const aggregated = applyPatches(aggregatedRaw, correction?.horsePatches ?? [])

    const tipsters = new Set<string>()
    const raceNums = new Set<number>()
    let flagCount = 0
    for (const row of groupRows) {
      for (const t of row.tipstersDetected) tipsters.add(t)
      for (const r of row.races) raceNums.add(r.raceNumber)
      flagCount += row.flags.length
    }

    groups.push({
      meetingKey,
      date,
      category,
      meeting,
      label: correction?.label ?? null,
      notes: correction?.notes ?? null,
      rows: groupRows.sort((a, b) => b._creationTime - a._creationTime),
      totalTipsters: Array.from(tipsters).sort(),
      raceNumbers: Array.from(raceNums).sort((a, b) => a - b),
      flagCount,
      aggregated,
      aggregatedRaw,
      patches: correction?.horsePatches ?? []
    })
  }

  // Sort groups: newest extraction in group first
  groups.sort((a, b) => {
    const aMax = Math.max(...a.rows.map((r) => r._creationTime))
    const bMax = Math.max(...b.rows.map((r) => r._creationTime))
    return bMax - aMax
  })
  return groups
}

/** Convert ExtractionRace[] to ExpandedTip[] across multiple rows. */
function expandedTipsFromRows(rows: ReadonlyArray<WorkspaceRow>): ExpandedTip[] {
  const byRaceNum = new Map<
    number,
    { raceNumber: number; tips: { tipsterName: string; selections: { horseName: string; horseNumber?: number }[] }[] }
  >()
  for (const row of rows) {
    for (const race of row.races) {
      const acc = byRaceNum.get(race.raceNumber) ?? { raceNumber: race.raceNumber, tips: [] }
      for (const tip of race.tips) {
        acc.tips.push({
          tipsterName: tip.tipsterName,
          selections: tip.selections.map((s) => ({
            horseName: s.horseName,
            horseNumber: s.horseNumber
          }))
        })
      }
      byRaceNum.set(race.raceNumber, acc)
    }
  }
  return Array.from(byRaceNum.values()).sort((a, b) => a.raceNumber - b.raceNumber)
}

/** Apply Pete's edits as an overlay on the aggregated output. */
function applyPatches(
  races: ReadonlyArray<AggregatedRace>,
  patches: ReadonlyArray<HorsePatch>
): AggregatedRace[] {
  if (patches.length === 0) return races as AggregatedRace[]

  // Index patches by `R{n}|{originalName}` (already title-cased on save)
  const byKey = new Map<string, HorsePatch[]>()
  for (const p of patches) {
    const key = `R${p.raceNumber}|${p.originalName}`
    const arr = byKey.get(key) ?? []
    arr.push(p)
    byKey.set(key, arr)
  }

  return races.map((race) => {
    const newTips = race.tips
      .map((tip) => {
        const key = `R${race.raceNumber}|${tip.horseName}`
        const ps = byKey.get(key) ?? []
        let horseName = tip.horseName
        let horseNumber = tip.horseNumber
        let removed = false
        for (const p of ps) {
          if (p.action === 'remove') removed = true
          if (p.action === 'rename' && p.newHorseName) horseName = p.newHorseName
          if (p.action === 'renumber') horseNumber = p.newHorseNumber
        }
        if (removed) return null
        return { ...tip, horseName, horseNumber }
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)

    return {
      ...race,
      tips: newTips,
      totalSelectionsInRace: newTips.reduce((s, t) => s + t.totalTips, 0)
    }
  })
}

/** Build the export filename slug (matches v0 expectations). */
export function meetingFilenameSlug(group: MeetingGroup): string {
  const base = (group.label ?? group.meeting).toLowerCase()
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
