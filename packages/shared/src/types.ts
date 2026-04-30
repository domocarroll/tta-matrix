// ──────────────────────────────────────────────────────
// TTA Matrix — Shared Domain Types
// ──────────────────────────────────────────────────────

/** Australian state-based racing codes */
export type RaceCategory = "SR" | "MR" | "BR" | "PR" | "AR" | "OR";

/** Meeting status lifecycle */
export type MeetingStatus = "upcoming" | "live" | "completed";

/** Race status lifecycle */
export type RaceStatus = "upcoming" | "running" | "resulted";

/** How a tip was ingested */
export type TipSource = "image" | "manual" | "api";

/** Type of tipster */
export type TipsterType = "newspaper" | "punter" | "algorithm";

/** Bet type for predictions */
export type BetType = "win" | "place" | "each-way";

/** Prediction lifecycle */
export type PredictionStatus = "open" | "won" | "lost" | "void";

// ──────────────────────────────────────────────────────
// Extraction Types (from agent vision pipeline)
// ──────────────────────────────────────────────────────

/** Raw extraction output — abbreviated keys for token efficiency */
export interface RawExtraction {
  readonly r: string;
  readonly t: ReadonlyArray<{
    readonly n: string;
    readonly s: ReadonlyArray<{
      readonly h: string;
      readonly num?: string;
    }>;
  }>;
}

/** Expanded extraction — full named keys */
export interface ExpandedTip {
  readonly raceNumber: number;
  readonly tips: ReadonlyArray<{
    readonly tipsterName: string;
    readonly selections: ReadonlyArray<{
      readonly horseName: string;
      readonly horseNumber?: number;
    }>;
  }>;
}

// ──────────────────────────────────────────────────────
// Aggregation Types
// ──────────────────────────────────────────────────────

export interface AggregatedTip {
  readonly horseName: string;
  readonly horseNumber?: number;
  readonly totalTips: number;
  readonly tipsterCount: number;
  readonly winTips: number;
  readonly place2Tips: number;
  readonly place3Tips: number;
  readonly place4Tips: number;
}

export interface AggregatedRace {
  readonly category: RaceCategory;
  readonly raceNumber: number;
  readonly meetingName: string;
  readonly tips: ReadonlyArray<AggregatedTip>;
  readonly totalSelectionsInRace: number;
  readonly totalTipstersInRace: number;
}

// ──────────────────────────────────────────────────────
// Race Result
// ──────────────────────────────────────────────────────

export interface RaceResult {
  readonly position: number;
  readonly horseName: string;
  readonly horseNumber: number;
}

// ──────────────────────────────────────────────────────
// Tipster Stats
// ──────────────────────────────────────────────────────

export interface TipsterStats {
  readonly totalTips: number;
  readonly wins: number;
  readonly places: number;
  readonly strikeRate: number;
  readonly roi: number;
  readonly lastUpdated: number;
}

// ──────────────────────────────────────────────────────
// Special Bets
// ──────────────────────────────────────────────────────

export interface QuaddieSelection {
  readonly raceNumber: number;
  readonly horses: ReadonlyArray<{
    readonly horseName: string;
    readonly horseNumber?: number;
    readonly totalTips: number;
  }>;
}

export interface TrifectaSelection {
  readonly raceNumber: number;
  readonly first: AggregatedTip;
  readonly second: AggregatedTip;
  readonly third: AggregatedTip;
}

export interface FirstFourSelection {
  readonly raceNumber: number;
  readonly selections: readonly [AggregatedTip, AggregatedTip, AggregatedTip, AggregatedTip];
}
