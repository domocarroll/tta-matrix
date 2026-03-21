# V0 Domain Knowledge Extract

**Source**: `~/v0-thetipanalyser/` (Next.js + Gemini, Vercel)
**Purpose**: Production-hardened patterns to carry forward into v2.
**Principle**: The algorithms don't change. The infrastructure they run on does.

---

## 1. Extraction Pipeline

### 1.1 Prompt Engineering

The extraction prompt uses **abbreviated JSON keys** to minimise token usage:

```
r = raceNumber, t = tips, n = tipsterName, s = selections, h = horseName, num = horseNumber
```

Output format: `[{"r":"1","t":[{"n":"TONY","s":[{"num":"2","h":"HORSE"}]}]}]`

Key rules baked into the prompt:
- Selections ordered by position (1st/win, 2nd, 3rd, 4th)
- Race numbers are 1-indexed (never 0), range 1-10
- Each race MUST be a separate object (never merge races)
- TV broadcast screenshots need special handling (identify which race tips belong to)
- Temperature: 0.1 (deterministic extraction)

**Carry forward**: The abbreviated key strategy saves ~40% tokens. The expansion
step (abbreviated → full names) is well-tested. Reuse both in Agent SDK tools.

### 1.2 Continuation Protocol

For large tip sheets that exceed output token limits:

```
Prompt includes: "If response is too long, stop mid-array and output [CONTINUE]"
```

The system then:
1. Detects `[CONTINUE]` in response (also checks for truncated `"horseName":`)
2. Strips the marker
3. Appends assistant response + `"continue"` user message
4. Calls API again with full conversation history
5. Concatenates responses
6. Repeats up to 5 times (safety limit)

**Carry forward**: Claude handles longer outputs than Gemini, but the pattern
is still useful for 10-race meetings with 8+ tipsters per image.

### 1.3 JSON Repair Pipeline

AI responses frequently arrive malformed. The repair chain:

```
Strategy 1: JSON.parse(stripped) → success
Strategy 2: jsonrepair(stripped) → JSON.parse(repaired) → success
Strategy 3: throw user-friendly error
```

Pre-processing steps:
- Strip markdown fences (```json ... ```)
- Remove `[CONTINUE]` markers
- Validate minimum length (>10 chars)

**Carry forward**: `jsonrepair` library is essential. AI models return
trailing commas, unclosed brackets, and mixed quotes regularly.

### 1.4 Field Expansion

Abbreviated keys expand to full names with validation:

```typescript
const rawRaceNumber = parseInt(race.r || race.raceNumber, 10)
const raceNumber = isNaN(rawRaceNumber)
  ? 1  // default to 1
  : Math.max(1, Math.min(10, rawRaceNumber))  // clamp 1-10
```

Horse numbers: `parseInt(sel.num || sel.horseNumber, 10) || undefined`
— undefined if unparseable, not NaN.

**Carry forward**: The dual-key pattern (`race.r || race.raceNumber`) handles
both abbreviated and full-name responses. Keep this defensive parsing.

---

## 2. Response Validation

### 2.1 Refusal Detection

42 known refusal phrases from vision models:

```typescript
const REFUSAL_PHRASES = [
  "i cannot", "i can't", "i'm unable", "i am unable",
  "sorry, but", "i apologize", "cannot fulfill",
  "unable to process", "unable to extract", "cannot extract",
  "cannot process", "not able to", "inappropriate",
  "cannot assist", "cannot help", "i don't see",
  "no text", "no readable", "image does not contain",
  "image doesn't contain", "cannot identify", "cannot read",
  "too blurry", "too dark", "illegible", "unreadable",
]
```

**Carry forward**: Claude has different refusal patterns than Gemini.
Update the phrase list but keep the detection architecture.

### 2.2 JSON vs Text Discrimination

Positive JSON indicators:
- Starts with `[` or `{`
- Contains ` ```json `
- Contains abbreviated keys (`"r":`, `"raceNumber":`)

Negative (text response) indicators:
- Starts with conversational words (hello, hi, here, based, unfortunately)
- Contains "it looks", "it appears", "i can see"

**Carry forward**: Claude is more obedient about output format than Gemini,
but the safety net is cheap and prevents silent failures.

---

## 3. Error Handling & Resilience

### 3.1 Error Categories

```typescript
type ErrorCategory =
  | 'RATE_LIMITED'      // 429, quota — retryable
  | 'TEXT_RESPONSE'     // AI returned prose — retryable
  | 'NETWORK_ERROR'     // fetch/socket — retryable
  | 'INVALID_IMAGE'     // corrupt/blank — NOT retryable
  | 'API_KEY_ERROR'     // auth — NOT retryable
  | 'PAYLOAD_TOO_LARGE' // 413, >3MB — NOT retryable
  | 'PARSE_ERROR'       // JSON failure — retryable
  | 'REFUSAL'           // AI won't process — retryable (sometimes works on retry)
  | 'TIMEOUT'           // timed out — retryable
  | 'UNKNOWN'           // catch-all — retryable once
```

Each category maps to:
- `isRetryable: boolean`
- `userMessage: string` (human-friendly)

### 3.2 Retry Logic

- Max 2 retries (3 total attempts)
- Exponential backoff: `initialDelay * 2^attempt`
- 30% jitter: `+ random * 0.3 * exponentialDelay`
- Max delay: 8s (was tuned for Vercel's 25s serverless limit)
- Retry decision delegated to `shouldRetry(categorisedError)`

**Carry forward**: In v2 (Convex actions / long-running agent), the 8s max
delay can increase. But the categorisation + backoff + jitter pattern is solid.

### 3.3 Batch Processing

- 1 image per API call (MAX_IMAGES_PER_BATCH = 1)
- Sequential processing with independent error handling per batch
- Partial results accepted (failed batches logged, processing continues)
- Total failure only if ALL batches fail

**Carry forward**: 1-image-per-call is the right default. Payload size limits
are real. Partial results > total failure.

---

## 4. Aggregation Algorithm

### 4.1 Core Logic

The aggregation takes raw extracted tips and produces per-race consensus rankings.

**Input**: Array of `RaceTips` (per-image extraction results, potentially overlapping)
**Output**: Array of `AggregatedRace` (deduplicated, ranked)

Key: `{category}-R{raceNumber}` (e.g., `SR-R3` = Sydney Race 3)

```typescript
interface AggregatedTip {
  horseName: string        // titleCase normalised
  horseNumber?: number
  totalTips: number        // total mentions across all tipsters & positions
  tipsterCount: number     // unique tipsters who picked this horse (any position)
  winTips: number          // times picked as 1st (index 0)
  place2Tips: number       // times picked as 2nd (index 1)
  place3Tips: number       // times picked as 3rd (index 2)
  place4Tips: number       // times picked as 4th (index 3)
}
```

### 4.2 Selection Position Mapping

Position is determined by array index in the tipster's selections:

```
index 0 → winTips      (1st pick / win selection)
index 1 → place2Tips   (2nd pick)
index 2 → place3Tips   (3rd pick)
index 3 → place4Tips   (4th pick)
```

This is critical domain knowledge: tipsters list their picks in order of
preference. The first horse is their win pick.

### 4.3 Deduplication & Matching

- Horse names normalised via `titleCase()` (lowercase → capitalise each word)
- Horse number backfilled if a later extraction provides it
- Tipster uniqueness tracked via `Set<string>` per race per horse
- `tipsterCount` = unique tipsters who picked this horse in ANY position
- `totalTips` = total selections (a tipster can contribute multiple if
  they picked the same horse at multiple positions — rare but possible)

### 4.4 Sorting

Primary sort: `totalTips` descending
Tiebreaker: `winTips` descending

Final output sorted by: category alphabetically, then raceNumber ascending.

### 4.5 Horse Details Merge

Dual-key lookup for matching horse details to aggregated tips:

```typescript
// Key by number: "{category}-{raceNumber}-{horseNumber}"
// Key by name:   "{category}-{raceNumber}-{titleCase(horseName)}"
```

Number key tried first, name key as fallback. This handles cases where
the extraction got the name but not the number, or vice versa.

**In v2**: Horse details come from the scraper (pre-populated in Convex),
so the merge happens at query time via Convex joins, not in-memory lookup.
But the dual-key matching strategy (number + name fallback) still applies
when matching extracted tip horse names against scraped field data.

---

## 5. Special Bets Calculations

### 5.1 Quaddie

**Definition**: A quaddie is a bet on the last 4 races of a meeting.
Pick the winner of each of the last 4 races.

**Algorithm**:
1. Group races by category (SR, MR, etc.)
2. Filter to valid race numbers (1-10)
3. Require ≥4 races in the category
4. Sort by raceNumber ascending
5. Take the LAST 4 races (`.slice(-4)`)
6. For each race, take top 3 horses by `totalTips`

**Output**: Per category, 4 races × 3 horses = 12 selections.

**Carry forward**: The "last 4 races" logic is correct for Australian racing.
The top 3 per leg gives the punter a boxed quaddie (3×3×3×3 = 81 combinations).

### 5.2 Trifecta

**Definition**: Pick the first 3 horses in exact order (or boxed).

**Algorithm**: Different sort from main aggregation!

```typescript
// Trifecta sort: sum of win + place2 + place3 tips
.sort((a, b) =>
  (b.winTips + b.place2Tips + b.place3Tips) -
  (a.winTips + a.place2Tips + a.place3Tips)
)
.slice(0, 3)
```

This weights horses that are consistently picked in the top 3 positions,
not just those with the most total mentions. A horse picked 4th by many
tipsters scores lower than one picked 1st/2nd/3rd fewer times.

**Carry forward**: The trifecta sort is intentionally different from the main
sort. Don't "fix" this — it's correct domain logic.

### 5.3 First Four

**Definition**: Pick the first 4 horses in exact order (or boxed).

**Algorithm**: Simply the top 4 from the main aggregation sort (totalTips).

```typescript
race.tips.slice(0, 4)
```

**Carry forward**: First Four uses the main sort, not the trifecta sort.
This is also intentional — for 4-horse exotic bets, overall consensus
matters more than positional accuracy.

---

## 6. Category System

```typescript
type RaceCategory = 'SR' | 'MR' | 'BR' | 'PR' | 'AR' | 'OR'

const categories = {
  SR: { name: 'Sydney',    color: '#4285f4' },
  MR: { name: 'Melbourne', color: 'oklch(0.6 0.2 150)' },
  BR: { name: 'Brisbane',  color: '#e94e37' },
  PR: { name: 'Perth',     color: 'oklch(0.7 0.15 95)' },
  AR: { name: 'Adelaide',  color: 'oklch(0.5 0.25 302)' },
  OR: { name: 'Other',     color: '#5f6368' },
}
```

**Carry forward**: These are state-based racing codes used across AU.
The mapping is stable. Colours are branding decisions for v2.

---

## 7. Input Formats (Proven)

Four tip sheet formats the extraction handles:

| Format | Example | Characteristics |
|---|---|---|
| Newspaper grid | caulfield-saturday-tips.jpg | Tipsters as columns, races as rows, numbered selections |
| Magazine | winning-post-caulfield-tips.jpg | Grouped by race, horse names + TAB numbers, "best from tracks" |
| Race card (TAB) | tab-doomben-tips.jpg | Full card with silks, form, track details, multiple tipsters |
| Form page | tips-full-page.jpg | Multi-source columns (SMH, Sky Racing), 10 races, clean grid |

**Carry forward**: The extraction prompt handles all four. Claude's vision
is at least as good as Gemini's for structured visual layouts. No prompt
changes expected, but test against all four formats during v2 development.

---

## 8. Export Formats

### 8.1 CSV

```
Category, Race, Horse Number, Horse Name, [Jockey, Trainer, Weight, Barrier],
Total Tips, Tipster Count, Total Tipsters In Race, Win Tips, 2nd, 3rd, 4th
```

- Horse details columns conditionally included (only if any horse has them)
- Horse names quoted with escaped internal quotes
- Filename: `tipsheet_analysis_YYYY-MM-DD.csv`

### 8.2 JSON

Full aggregated data as pretty-printed JSON.
Filename: `tipsheet_analysis_YYYY-MM-DD.json`

### 8.3 URL Share

Base64-encoded JSON in URL hash: `#data={base64}`
- Allows sharing results via link
- Recipient gets read-only view
- Validates race numbers on decode

**In v2**: Export is a Convex query. URL sharing becomes a permalink to
Convex data (immutable snapshot). CSV/JSON export via Convex HTTP action.

---

## 9. Metrics Tracked Per Horse

| Metric | Meaning | Used For |
|---|---|---|
| `totalTips` | Total mentions across all tipsters & positions | Main ranking sort |
| `tipsterCount` | Unique tipsters who picked this horse | Consensus breadth |
| `winTips` | Picked as 1st choice | Win confidence |
| `place2Tips` | Picked as 2nd choice | Place confidence |
| `place3Tips` | Picked as 3rd choice | Trifecta calculation |
| `place4Tips` | Picked as 4th choice | First Four calculation |
| `totalSelectionsInRace` | All selections across all tipsters for this race | Percentage denominator |
| `totalTipstersInRace` | Unique tipsters with data for this race | Tipster% denominator |

**Tipster%** = `tipsterCount / totalTipstersInRace × 100`
— "What percentage of experts picked this horse?"

**Carry forward**: This metric set is complete for the current product.
v2 adds historical metrics (strike rate, ROI) but these per-race metrics
remain the core of single-day aggregation.

---

## 10. Known Edge Cases (Production-Discovered)

1. **AI returns race 0**: Clamped to 1. Some models zero-index.
2. **NaN horse numbers**: Parsed with fallback to undefined, not NaN.
3. **Duplicate horse names across races**: Keyed by `{category}-R{number}` so no collision.
4. **Same horse, different capitalisation**: titleCase normalisation handles "WINX" vs "Winx".
5. **Tipster names with special characters**: Passed through as-is, no normalisation.
6. **Empty selections array**: Filtered out at expansion step (`.filter(race => race.tips.length > 0)`).
7. **Corrupted base64 in URL share**: Caught by try/catch, silently redirects to upload.
8. **Large images (>3MB)**: Rejected before API call with user-friendly message.
9. **TV screenshots with multiple races**: Prompt explicitly instructs "do not merge all tips into a single race".
10. **Continuation mid-JSON**: Response can break mid-object — jsonrepair handles this.
