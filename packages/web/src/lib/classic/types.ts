// ──────────────────────────────────────────────────────
// Classic UI types — ported verbatim from v0-thetipanalyser/types.ts
// ──────────────────────────────────────────────────────
// Kept self-contained (not re-using @tta/shared) because v0's aggregation
// is multi-category and keys on category+raceNumber, whereas the shared
// aggregateRaces is single-meeting and requires a meetingName.

export type RaceCategory = 'SR' | 'MR' | 'BR' | 'PR' | 'AR' | 'OR'

export interface Tip {
  horseNumber?: number
  horseName: string
}

export interface TipsterSelection {
  tipsterName: string
  selections: Tip[]
}

export interface RaceTips {
  raceNumber: number
  tips: TipsterSelection[]
  category?: RaceCategory
}

export interface AggregatedTip {
  horseName: string
  horseNumber?: number
  totalTips: number
  tipsterCount: number
  winTips: number
  place2Tips: number
  place3Tips: number
  place4Tips: number
  // Optional horse-details enrichment (unused in v1 — backend doesn't emit it)
  jockey?: string
  trainer?: string
  weight?: number
  barrier?: number
}

export interface AggregatedRace {
  raceNumber: number
  category: RaceCategory
  tips: AggregatedTip[]
  totalSelectionsInRace: number
  totalTipstersInRace: number
}

export type PhotoStatus = 'uploading' | 'processing' | 'ready' | 'error' | 'reextracting'

// `ExtractionResult` is the canonical agent output (see $lib/types). We keep
// the last raw result on the photo so a "fix this sheet" re-extract can replay
// it as the prior assistant turn, and `extractionId` so we can replace the
// persisted row in place rather than inserting a duplicate.
import type { ExtractionResult } from '$lib/types'

export interface ProcessedPhoto {
  id: string
  file: File
  preview: string
  category: RaceCategory
  status: PhotoStatus
  result?: RaceTips[]
  error?: string
  /** Convex extraction document id, set once persisted (enables re-extract). */
  extractionId?: string
  /** Last agent result for this image — the prior turn for re-extract. */
  lastResult?: ExtractionResult
}
