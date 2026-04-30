export interface ExtractionFlag {
  readonly type:
    | 'publication_artefact_stripped'
    | 'duplicate_resolved'
    | 'ambiguity'
    | 'uncertain'
    | 'anomaly'
  readonly race?: number
  readonly description: string
}

export interface ExtractionSelection {
  readonly position: number
  readonly horseName: string
  readonly horseNumber?: number
}

export interface ExtractionTip {
  readonly tipsterName: string
  readonly selections: ReadonlyArray<ExtractionSelection>
}

export interface ExtractionRace {
  readonly raceNumber: number
  readonly tips: ReadonlyArray<ExtractionTip>
}

export interface ExtractionResult {
  readonly publication: string
  readonly meeting: string
  readonly category: string
  readonly tipstersDetected: ReadonlyArray<string>
  readonly reasoning: ReadonlyArray<string>
  readonly races: ReadonlyArray<ExtractionRace>
  readonly flags: ReadonlyArray<ExtractionFlag>
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'reasoning_step'; text: string }
  | { type: 'extraction'; payload: ExtractionResult }
  | { type: 'tokens'; input: number; output: number }
  | { type: 'error'; message: string }
