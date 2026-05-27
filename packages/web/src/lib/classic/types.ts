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

export type PhotoStatus = 'uploading' | 'processing' | 'ready' | 'error'

export interface ProcessedPhoto {
  id: string
  file: File
  preview: string
  category: RaceCategory
  status: PhotoStatus
  result?: RaceTips[]
  error?: string
}
