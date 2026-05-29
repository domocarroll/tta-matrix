// ──────────────────────────────────────────────────────
// Workspace logic — group, aggregate, apply Pete's corrections
// ──────────────────────────────────────────────────────

import {
  aggregateRaces,
  buildMeetingKey,
  parseMeetingKey,
  matchField,
  type AggregatedRace,
  type ExpandedTip,
  type RaceCategory,
  type FieldMatchFlag,
} from '@tta/shared'

import type { ExtractionResult } from './types'
import type { ResolvedField } from './fieldResolution'

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
  /**
   * 3-Gate routing state. Legacy rows lacking this default to `routed`
   * (set in extractions.listFullByClient).
   */
  state?: 'routed' | 'pending-meeting'
  pendingReason?: string
}

export interface HorsePatch {
  raceNumber: number
  originalName: string
  /** Legacy: kept for back-compat. New patches use the explicit fields below. */
  action?: 'rename' | 'renumber' | 'remove'
  removed?: boolean
  newHorseName?: string
  newHorseNumber?: number
  newTotalTips?: number
  newTipsterCount?: number
  newWinTips?: number
  newPlace2Tips?: number
  newPlace3Tips?: number
  newPlace4Tips?: number
}

export interface MeetingCorrection {
  meetingKey: string
  label: string | null
  notes: string | null
  horsePatches: ReadonlyArray<HorsePatch>
  updatedAt: number
}

/** Field-resolution status surfaced per meeting card. */
export type FieldStatus =
  | { state: 'pending' }
  | {
      state: 'resolved'
      source: string
      fetchedAt: number
      citations: ReadonlyArray<string>
    }
  | { state: 'unavailable'; reason: string }

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
  /** Aggregated races AFTER field-anchoring + Pete's corrections. */
  aggregated: ReadonlyArray<AggregatedRace>
  /** Aggregated races as the agent originally produced (no overlay). */
  aggregatedRaw: ReadonlyArray<AggregatedRace>
  /** The patches in effect, for the edit UI. */
  patches: ReadonlyArray<HorsePatch>
  /** Authoritative-field resolution status for this meeting. */
  field: FieldStatus
  /** Quality flags raised by anchoring tips to the field. */
  fieldFlags: ReadonlyArray<FieldMatchFlag>
}

/**
 * Anchor a meeting's aggregated races to the resolved field.
 *
 * Ordering is deliberate: agent ground truth → field canonicalisation
 * → Pete's manual patches (applied by the caller AFTER this). The human
 * override always wins; the field just gives it a correct baseline so
 * Pete rarely has to fix OCR noise by hand any more.
 */
function applyFieldMatch(
  races: ReadonlyArray<AggregatedRace>,
  resolved: ResolvedField | undefined,
): { races: AggregatedRace[]; field: FieldStatus; flags: FieldMatchFlag[] } {
  if (!resolved) {
    return { races: races as AggregatedRace[], field: { state: 'pending' }, flags: [] }
  }
  if (!resolved.resolved) {
    return {
      races: races as AggregatedRace[],
      field: { state: 'unavailable', reason: resolved.reason },
      flags: [],
    }
  }

  const byRaceNumber = new Map(resolved.races.map((r) => [r.raceNumber, r.runners]))
  const flags: FieldMatchFlag[] = []
  const anchored = races.map((race) => {
    const runners = byRaceNumber.get(race.raceNumber) ?? []
    const result = matchField(race, runners)
    for (const f of result.flags) flags.push(f)
    return result.race
  })

  return {
    races: anchored,
    field: {
      state: 'resolved',
      source: resolved.source,
      fetchedAt: resolved.fetchedAt,
      citations: resolved.citations,
    },
    flags,
  }
}

/** Group rows by meetingKey then aggregate each group. */
export function buildMeetingGroups(
  rows: ReadonlyArray<WorkspaceRow>,
  corrections: ReadonlyArray<MeetingCorrection>,
  fields?: ReadonlyMap<string, ResolvedField>
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
    // Anchor to the authoritative field (if resolved), THEN apply Pete's
    // manual patches on top — human override wins over both.
    const fm = applyFieldMatch(aggregatedRaw, fields?.get(meetingKey))
    const aggregated = applyPatches(fm.races, correction?.horsePatches ?? [])

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
      patches: correction?.horsePatches ?? [],
      field: fm.field,
      fieldFlags: fm.flags
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
        let totalTips = tip.totalTips
        let tipsterCount = tip.tipsterCount
        let winTips = tip.winTips
        let place2Tips = tip.place2Tips
        let place3Tips = tip.place3Tips
        let place4Tips = tip.place4Tips
        let removed = false
        for (const p of ps) {
          if (p.action === 'remove' || p.removed) removed = true
          if (p.newHorseName !== undefined) horseName = p.newHorseName
          if (p.newHorseNumber !== undefined) horseNumber = p.newHorseNumber
          if (p.newTotalTips !== undefined) totalTips = p.newTotalTips
          if (p.newTipsterCount !== undefined) tipsterCount = p.newTipsterCount
          if (p.newWinTips !== undefined) winTips = p.newWinTips
          if (p.newPlace2Tips !== undefined) place2Tips = p.newPlace2Tips
          if (p.newPlace3Tips !== undefined) place3Tips = p.newPlace3Tips
          if (p.newPlace4Tips !== undefined) place4Tips = p.newPlace4Tips
        }
        if (removed) return null
        return {
          ...tip,
          horseName,
          horseNumber,
          totalTips,
          tipsterCount,
          winTips,
          place2Tips,
          place3Tips,
          place4Tips
        }
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      // Re-sort after edits — totalTips desc, winTips tiebreak (matches v0)
      .sort((a, b) => {
        if (b.totalTips !== a.totalTips) return b.totalTips - a.totalTips
        return b.winTips - a.winTips
      })

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
