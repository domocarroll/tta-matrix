# Phase A: Local Extraction App — Architecture Sketch

## One-Line
Android app that extracts horse racing tips from photos using on-device Gemma 4 E2B, aggregates consensus picks, and syncs to Convex — no cloud AI, no API costs, works at the track.

## Why This First
- Proves on-device vision extraction works (the technical risk)
- Standalone product value (scan tip sheet → consensus rankings → offline)
- Zero marginal inference cost per user
- Foundation for conviction game client (Phase B)
- Inherits months of prompt engineering from v0/v2

---

## Hardware Constraints

| Spec | Value | Impact |
|------|-------|--------|
| Device | Samsung Galaxy Z Flip SM-F700F | Primary test device |
| SoC | Snapdragon 855 | No AICore, no NPU for LiteRT |
| RAM | 8 GB | ~4.5GB free after OS. Model needs ~2GB |
| Android | 13 (One UI 5.1) | LiteRT-LM compatible |
| GPU | Adreno 640 | No ML Drift support — CPU only |

**Performance expectations (E2B on CPU):**
- Engine init: ~10 seconds (one-time on app start)
- First token: 3-5 seconds
- Decode: 5-10 tok/sec
- Total extraction per tip sheet: 15-30 seconds
- Battery per sheet: ~equivalent to 30s of camera use

---

## Integration Path: LiteRT-LM

**Why LiteRT-LM (not ML Kit or AICore):**
- Only path that works on SD855 / Z Flip hardware
- Supports vision input (image → inference)
- Function calling with constrained decoding (forced JSON schema)
- System prompts
- 32K context window
- Production stable
- No device partnership required

**Model:** `litert-community/gemma-4-E2B-it-litert-lm` (2.58 GB)
- Mixed 2/4/8-bit quantization
- Download on first launch to internal storage
- Or bundle as asset (increases APK significantly)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     TTA Local App                        │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Camera   │───▶│  LiteRT-LM   │───▶│  Aggregation  │  │
│  │  /Gallery │    │  Gemma 4 E2B │    │  Engine       │  │
│  └──────────┘    │              │    │  (Kotlin port) │  │
│                  │  Vision +     │    └───────┬───────┘  │
│                  │  Constrained  │            │          │
│                  │  Decoding     │            ▼          │
│                  └──────────────┘    ┌───────────────┐  │
│                                      │  Results UI    │  │
│                                      │  Race Cards    │  │
│  ┌──────────┐                        │  Special Bets  │  │
│  │  Room DB  │◀──────────────────────│  Export/Share  │  │
│  │  (offline │                        └───────────────┘  │
│  │   cache)  │                               │          │
│  └─────┬────┘                                │          │
│        │                                     │          │
│        ▼                                     ▼          │
│  ┌──────────┐                        ┌───────────────┐  │
│  │  Convex   │◀───── sync when ──────│  Sync Engine  │  │
│  │  Client   │       online          │  (background)  │  │
│  └──────────┘                        └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Extraction Pipeline (Inheriting from v0/v2)

### The Prompt (adapted for constrained decoding)

The v0/v2 extraction prompt is:
```
Extract horse racing tips from images into compact JSON using ONLY these field names:
r = raceNumber, t = tips, n = tipsterName, s = selections, h = horseName, num = horseNumber
...
```

**On-device adaptation:** Instead of prompting for JSON and repairing, we use LiteRT-LM's
`OpenApiTool` with constrained decoding. The model is FORCED to output valid JSON matching
our schema.

### System Instruction
```
You are a horse racing tip sheet extraction specialist for Australian racing.
Extract ALL tipsters and their selections from the provided image.
Each race MUST be a separate entry. Never combine races.
Race numbers are 1-indexed (1-10). Horse names must be exact as shown.
Use the extract_tips tool to return structured data.
```

### Tool Schema (constrained decoding)
```json
{
  "name": "extract_tips",
  "description": "Extract structured tip data from a horse racing tip sheet image",
  "parameters": {
    "type": "object",
    "properties": {
      "races": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "r": { "type": "integer", "description": "Race number (1-10)" },
            "t": {
              "type": "array",
              "description": "Tipsters for this race",
              "items": {
                "type": "object",
                "properties": {
                  "n": { "type": "string", "description": "Tipster name exactly as shown" },
                  "s": {
                    "type": "array",
                    "description": "Selections ordered by preference (0=win, 1=2nd, 2=3rd, 3=4th)",
                    "items": {
                      "type": "object",
                      "properties": {
                        "h": { "type": "string", "description": "Horse name exactly as shown" },
                        "num": { "type": "integer", "description": "Horse/TAB number if visible" }
                      },
                      "required": ["h"]
                    }
                  }
                },
                "required": ["n", "s"]
              }
            }
          },
          "required": ["r", "t"]
        }
      }
    },
    "required": ["races"]
  }
}
```

**What this buys us vs v0/v2:**
- No jsonrepair needed (output is structurally valid by construction)
- No continuation protocol needed (constrained decoding handles chunking)
- No refusal detection needed (tool calling doesn't refuse)
- No markdown stripping needed (tool output is pure JSON)
- Abbreviated keys preserved (r, t, n, s, h, num) for token efficiency

### What We STILL Need (inherited from v0/v2)
- Race number clamping (1-10) — defense in depth
- Horse name normalization (Title Case)
- Duplicate tipster deduplication (Set-based counting)
- Position-index mapping (i=0→win, i=1→place2, etc.)

---

## Aggregation Engine (Kotlin Port of v0/v2)

Direct port of `packages/shared/src/aggregation.ts` and `v0-thetipanalyser/utils/aggregateRaces.ts`.

### Core Algorithm (Kotlin, immutable)
```kotlin
data class ExtractedRace(val r: Int, val t: List<Tipster>)
data class Tipster(val n: String, val s: List<Selection>)
data class Selection(val h: String, val num: Int? = null)

data class AggregatedHorse(
    val horseName: String,
    val horseNumber: Int? = null,
    val totalTips: Int,
    val winTips: Int,
    val place2Tips: Int,
    val place3Tips: Int,
    val place4Tips: Int,
    val tipsterCount: Int
)

data class AggregatedRace(
    val raceNumber: Int,
    val horses: List<AggregatedHorse>,
    val totalTipsters: Int
)

fun aggregateRaces(extractions: List<ExtractedRace>): List<AggregatedRace> {
    return extractions
        .groupBy { it.r }
        .map { (raceNum, races) ->
            val tipsterSet = mutableSetOf<String>()
            val horseMap = mutableMapOf<String, HorseAccumulator>()

            races.flatMap { it.t }.forEach { tipster ->
                tipsterSet.add(tipster.n)
                tipster.s.forEachIndexed { idx, sel ->
                    val key = sel.h.toTitleCase()
                    val acc = horseMap.getOrPut(key) { HorseAccumulator(key, sel.num) }
                    acc.totalTips++
                    when (idx) {
                        0 -> acc.winTips++
                        1 -> acc.place2Tips++
                        2 -> acc.place3Tips++
                        3 -> acc.place4Tips++
                    }
                    acc.tipsters.add(tipster.n)
                }
            }

            AggregatedRace(
                raceNumber = raceNum.coerceIn(1, 10),
                horses = horseMap.values
                    .map { it.toAggregatedHorse() }
                    .sortedWith(compareByDescending<AggregatedHorse> { it.totalTips }
                        .thenByDescending { it.winTips }),
                totalTipsters = tipsterSet.size
            )
        }
        .sortedBy { it.raceNumber }
}
```

### Special Bets (direct port)
```kotlin
// Quaddie: last 4 races, top 3 horses each
fun calculateQuaddie(races: List<AggregatedRace>): List<QuaddieLeg> =
    races.takeLast(4).map { race ->
        QuaddieLeg(race.raceNumber, race.horses.take(3))
    }

// Trifecta: top 3 by (win + place2 + place3)
fun calculateTrifecta(race: AggregatedRace): List<AggregatedHorse> =
    race.horses
        .sortedByDescending { it.winTips + it.place2Tips + it.place3Tips }
        .take(3)

// First Four: top 4 by totalTips (already sorted)
fun calculateFirstFour(race: AggregatedRace): List<AggregatedHorse> =
    race.horses.take(4)
```

---

## Data Layer

### Local (Room Database)
```kotlin
@Entity(tableName = "extractions")
data class ExtractionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val category: String,        // SR, MR, BR, PR, AR, OR
    val meetingName: String,
    val extractedAt: Long,       // epoch millis
    val rawJson: String,         // full extraction JSON
    val synced: Boolean = false  // false until Convex confirms
)

@Entity(tableName = "aggregations")
data class AggregationEntity(
    @PrimaryKey val raceKey: String,  // "{category}-R{number}"
    val raceNumber: Int,
    val aggregationJson: String,
    val updatedAt: Long
)
```

### Cloud (Convex — reuse existing schema)
- Sync extracted tips to `tips` table via ConvexHttpClient
- Sync aggregations to `aggregations` table
- Pull race fields and results from `races` table
- **Only structured data syncs — images never leave device**

### Sync Strategy
```
1. Extract locally → save to Room → display immediately
2. Background: check connectivity
3. If online: push unsynced extractions to Convex
4. Pull latest race fields / results from Convex
5. Mark synced extractions
6. If offline: everything still works, syncs on reconnect
```

---

## UI (Jetpack Compose)

### Screen Flow
```
Launch → [Model loading spinner, first time only ~10s]
  ↓
Home → Category picker (SR/MR/BR/PR/AR/OR) + Today's meetings
  ↓
Capture → Camera viewfinder OR gallery picker
  ↓
Processing → [15-30s extraction, progress indicator]
  ↓
Results → Race cards with consensus rankings
  ├── Per-race: horse list sorted by totalTips
  ├── Special bets: quaddie, trifecta, first four
  ├── Tipster breakdown (who tipped what)
  └── Export / Share (JSON, CSV, URL)
```

### Key UX Decisions
- **No streaming text** — extraction takes 15-30s on CPU. Show a progress spinner,
  not a chatbot-style token stream. The result appears all at once.
- **Batch mode** — tap + to add another tip sheet. Aggregation accumulates across sheets.
  (This is the core v0 workflow: multiple sources → single consensus)
- **Offline indicator** — small badge showing sync status. Never blocks the user.
- **Camera-first** — default to camera, gallery as secondary option.
  Most users will point at a newspaper or TV screen.

---

## Project Structure

```
~/tta-matrix/android/
├── app/
│   ├── src/main/
│   │   ├── kotlin/com/tta/local/
│   │   │   ├── MainActivity.kt
│   │   │   ├── ui/
│   │   │   │   ├── theme/
│   │   │   │   ├── screens/
│   │   │   │   │   ├── HomeScreen.kt
│   │   │   │   │   ├── CaptureScreen.kt
│   │   │   │   │   ├── ProcessingScreen.kt
│   │   │   │   │   └── ResultsScreen.kt
│   │   │   │   └── components/
│   │   │   │       ├── RaceCard.kt
│   │   │   │       ├── SpecialBets.kt
│   │   │   │       └── CategoryPicker.kt
│   │   │   ├── extraction/
│   │   │   │   ├── TipSheetExtractor.kt      # LiteRT-LM wrapper
│   │   │   │   ├── ExtractionSchema.kt        # OpenApiTool definition
│   │   │   │   └── ExtractionModels.kt        # Data classes
│   │   │   ├── aggregation/
│   │   │   │   ├── AggregationEngine.kt       # Port of v0/v2 algorithm
│   │   │   │   └── SpecialBets.kt             # Quaddie, trifecta, first four
│   │   │   ├── data/
│   │   │   │   ├── local/
│   │   │   │   │   ├── AppDatabase.kt         # Room
│   │   │   │   │   ├── ExtractionDao.kt
│   │   │   │   │   └── AggregationDao.kt
│   │   │   │   ├── remote/
│   │   │   │   │   └── ConvexSyncClient.kt    # Reuses tta-matrix Convex schema
│   │   │   │   └── SyncEngine.kt              # Offline-first sync
│   │   │   └── model/
│   │   │       └── ModelManager.kt             # Download + init LiteRT-LM engine
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── gradle/
└── build.gradle.kts
```

---

## What We're NOT Building (Phase A scope)

- ❌ Conviction game / QV credits (Phase B)
- ❌ Matrix integration (stays in v2 bot)
- ❌ WhatsApp bridge
- ❌ Synthetic observers / swarms
- ❌ ZK proofs
- ❌ B2B platform
- ❌ Audio processing (commentary)
- ❌ Live race analysis

Phase A is pure: **camera → extract → aggregate → display → sync**.
The simplest thing that delivers standalone value.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| E2B extraction quality too low | Medium | High | Test against v0/v2 fixtures. Fall back to cloud Claude for hard cases. |
| 15-30s extraction too slow | Medium | Medium | UX: clear progress feedback. Background processing. Batch queue. |
| 2.58GB model too large for install | Low | Medium | Download on first launch, not bundled. Show download progress. |
| SD855 CPU inference unstable | Low | High | Extensive testing on Z Flip. Memory monitoring. Graceful degradation. |
| Constrained decoding misses edge cases | Medium | Medium | Post-validation (race 1-10 clamp, name normalization). Same defenses as v2. |

---

## Success Criteria

Phase A is complete when:
1. User can photograph a tip sheet and get structured race data in <30 seconds
2. Aggregation across multiple tip sheets produces correct consensus rankings
3. Special bets (quaddie, trifecta, first four) calculate correctly
4. App works fully offline (no network required for core function)
5. Extracted data syncs to Convex when online
6. Tested on OG Galaxy Z Flip with real tip sheets from v0 test fixtures

---

## Next Steps

1. Initialize Android project at `~/tta-matrix/android/`
2. Add LiteRT-LM dependency, download E2B model
3. Implement ExtractionSchema (OpenApiTool with constrained decoding)
4. Port aggregation algorithm to Kotlin
5. Build minimal UI (camera → process → results)
6. Test against v0/v2 fixture images
7. Add Room persistence + Convex sync
