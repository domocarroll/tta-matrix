// ──────────────────────────────────────────────────────
// TTA Matrix — @tta/shared barrel export
// ──────────────────────────────────────────────────────

export type {
  RaceCategory,
  MeetingStatus,
  RaceStatus,
  TipSource,
  TipsterType,
  BetType,
  PredictionStatus,
  RawExtraction,
  ExpandedTip,
  AggregatedTip,
  AggregatedRace,
  RaceResult,
  TipsterStats,
  QuaddieSelection,
  TrifectaSelection,
  FirstFourSelection,
} from "./types.ts";

export {
  CATEGORIES,
  MIN_RACE_NUMBER,
  MAX_RACE_NUMBER,
  EXTRACTION_TEMPERATURE,
  MAX_CONTINUATION_ATTEMPTS,
  MAX_IMAGE_SIZE_BYTES,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  JITTER_FACTOR,
  QUADDIE_LEG_COUNT,
  QUADDIE_HORSES_PER_LEG,
  TRIFECTA_SELECTION_COUNT,
  FIRST_FOUR_SELECTION_COUNT,
  REFUSAL_PHRASES,
  JSON_INDICATORS,
  TEXT_RESPONSE_INDICATORS,
} from "./constants.ts";

export {
  titleCase,
  clampRaceNumber,
  parseHorseNumber,
  isRefusal,
  looksLikeJson,
  cleanResponse,
  needsContinuation,
  expandExtraction,
} from "./extraction.ts";

export {
  categoriseError,
  shouldRetry,
  getRetryDelay,
} from "./errors.ts";
export type { ErrorCategory } from "./errors.ts";

export {
  aggregateRaces,
  calculateQuaddie,
  calculateTrifecta,
  calculateFirstFour,
} from "./aggregation.ts";

export {
  buildMeetingKey,
  parseMeetingKey,
  todayUtc,
} from "./meetingKey.ts";

export {
  buildMeetingCsv,
  buildCsvFilename,
} from "./csv.ts";

export { matchField } from "./fieldMatch.ts";
export type { FieldRunner, FieldMatchFlag } from "./fieldMatch.ts";
export { validateAgainstField } from "./fieldGate.ts";
export {
  humanAdjudicator,
  reasoningAdjudicator,
  runAdjudication,
  ADJUDICATOR_SYSTEM,
} from "./adjudicator.ts";
export type {
  Adjudicator,
  AdjudicationCase,
  AdjudicationOutcome,
  AdjudicationPrompt,
  Resolution,
  Verdict,
  RawVerdict,
  ImageRegion,
  ReasoningAdjudicatorOptions,
} from "./adjudicator.ts";

export {
  routeExtraction,
  deriveMeetingKeyFromExtraction,
} from "./routeExtraction.ts";
export type {
  ExtractedTarget,
  LockedMeeting,
  RouteResult,
  RouteFailureReason,
} from "./routeExtraction.ts";

export { nextState, stateLabel } from "./meetingState.ts";
export type {
  MeetingState,
  MeetingEvent,
  TransitionResult,
} from "./meetingState.ts";

export { inferCustomerMeetings } from "./inferCustomerMeetings.ts";
export type {
  ExtractionSeed,
  UserFieldSeed,
  InferredCustomerMeeting,
} from "./inferCustomerMeetings.ts";
