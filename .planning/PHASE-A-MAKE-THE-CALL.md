# Phase A: Make The Call

## One-Line
Android app where punters study the field with a personal AI analyst, commit their picks before each race, and earn social recognition when they call it right — all on-device, works at the track.

## The CTA
**Make the call. Earn the nod.**

---

## The Shift

The v0/v2 extraction pipeline is admin infrastructure. It feeds tip sheets into the system.
The USER never scans a newspaper. The user does something much more primal:

1. **Study** — look at today's races, see the consensus, hear what your AI thinks
2. **Commit** — make your pick before the gates open. Put your name on it.
3. **Watch** — the race runs. Ground truth arrives.
4. **Earn** — you called it. The community sees. Your reputation grows.

The extraction pipeline stays server-side (Claude via Matrix bot, admin function).
The user-facing app is about **conviction and recognition**.

---

## What Gemma 4 Does for the USER

On-device AI isn't for tip extraction. It's the punter's **personal analyst**.

| Feature | What Gemma 4 Does | Why On-Device |
|---------|-------------------|---------------|
| **Race briefing** | "Race 5: 8 runners, soft track, consensus likes Horse 3 but she hasn't won on soft" | Instant, no API cost, works trackside |
| **Form analysis** | User scans form guide → AI summarises key factors per horse | Camera → local vision → structured insight |
| **Conviction coach** | "You've been strong on wet-track reads this season (68% strike rate). Trust your instinct here." | Requires personal history — private, on-device |
| **Post-race debrief** | "You called 3/5 today. Your best read was Race 4 — you spotted the pace collapse." | Personalised analysis, immediate, no server round-trip |
| **Voice reasoning** | Record "I like Horse 5 because..." before the race. AI transcribes + indexes for later. | Audio processing on-device. Your reasoning log. |

**The AI never makes the call.** The punter does. The AI helps you see clearly, then gets out of the way. After the race, it helps you learn from what you saw.

---

## The Loop (per race, ~30 minutes)

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│  STUDY (5-15 min before race)                         │
│  ├── See today's races + fields (from Convex)         │
│  ├── View consensus tips (admin-extracted, aggregated) │
│  ├── Ask your AI analyst (Gemma 4, on-device)         │
│  │   "What should I know about Race 5?"               │
│  └── Scan form guide if you have one (vision)         │
│                                                       │
│  COMMIT (before gates open)                           │
│  ├── Tap your pick: horse name, conviction level      │
│  ├── Optional: record voice reasoning (30s)           │
│  ├── Hash committed locally, synced to Convex         │
│  └── Lock. No changes after this.                     │
│                                                       │
│  RESOLVE (race runs, 2-3 min)                         │
│  ├── Results flow in from Convex                      │
│  ├── Your pick settles: ✓ called it / ✗ missed        │
│  └── Community results visible                        │
│                                                       │
│  RECOGNISE                                            │
│  ├── "You called it." — the nod.                      │
│  ├── Streak counter: "3 in a row"                     │
│  ├── Leaderboard position moves                       │
│  ├── AI debrief: "You read the pace perfectly"        │
│  └── Community feed: who called what                  │
│                                                       │
└──────────── next race ────────────────────────────────┘
```

---

## Social Recognition System

Recognition is the product. Not money. Not points. **The nod.**

### Micro (per race)
- "Called it" badge on your pick (visible to community)
- Streak counter (consecutive correct calls)
- "First to call" — if you picked a roughie nobody else did

### Meso (per day)
- Daily score: 3/8 called (shown as fraction, not percentage — feels more real)
- "Best read" — AI identifies your sharpest call of the day
- Day leaderboard position

### Macro (per season)
- Strike rate (lifetime, visible on profile)
- Specialisation tags: "Wet Track Reader", "Sprint Specialist", "Roughie Hunter"
  (earned by pattern, not claimed — Gemma 4 analyses your history on-device)
- Season leaderboard
- "The Nod" — community can acknowledge someone's call with a single tap
  (not a like, not a heart — a nod. One action. Respect.)

### The Nod Mechanic
```
After results:
  Community feed shows: "Dom called Horse 5 in Race 4 ✓"
  Any member can tap: [nod]
  
  One nod = one nod. No inflation. No double-tapping.
  Your profile shows: "47 nods received this season"
  
  That's it. No gamification layer on top. 
  The simplicity IS the design.
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Make The Call App                        │
│                                                            │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Race Feed  │  │  AI Analyst   │  │  My Calls         │  │
│  │  (Convex    │  │  (Gemma 4    │  │  (Room DB +       │  │
│  │   sync)     │  │   E2B local) │  │   Convex sync)    │  │
│  └──────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │               │                    │             │
│         ▼               ▼                    ▼             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    Race Screen                       │  │
│  │                                                      │  │
│  │  Race 5 — Randwick — 1200m — Soft 5                  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │ Consensus: Horse 3 (6 tips), Horse 7 (4)    │     │  │
│  │  │ Your AI: "Horse 3 hasn't won on soft.       │     │  │
│  │  │          Horse 7's last 3 on soft: 1,2,1"   │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │                                                      │  │
│  │  ┌─────────────────────────┐                         │  │
│  │  │  MAKE YOUR CALL         │                         │  │
│  │  │  [Horse 3] [Horse 7]   │  ← tap to select        │  │
│  │  │  [Horse 1] [Horse 5]   │                          │  │
│  │  │                         │                         │  │
│  │  │  [🎤 Record reasoning]  │  ← optional voice note  │  │
│  │  │                         │                         │  │
│  │  │  [ LOCK IT IN ]         │  ← commits the call     │  │
│  │  └─────────────────────────┘                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Community Feed                                      │  │
│  │  Dom called Horse 7 in Race 5 ✓        [nod] 3      │  │
│  │  Sarah called Horse 3 in Race 5 ✗                    │  │
│  │  Tony called Horse 7 in Race 5 ✓       [nod] 7      │  │
│  │  You're on a 3-race streak 🔥                        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Profile                                             │  │
│  │  Season: 47/142 called (33%)                         │  │
│  │  Streak: 3 current / 7 best                          │  │
│  │  Nods received: 47                                   │  │
│  │  Tags: Wet Track Reader, Sprint Specialist            │  │
│  │  Best read today: "Race 4 — pace collapse call"      │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## Gemma 4 Integration (Revised)

### Role: Personal Analyst (not extractor)

The AI serves the user in four modes:

#### 1. Race Briefing (text generation)
```kotlin
// Input: race field data from Convex + user's historical calls
val briefing = conversation.sendMessage(Contents.of(
    Content.Text("""
        Race 5, Randwick, 1200m, Soft 5
        Field: ${fieldJson}
        Consensus tips: ${consensusJson}
        Your history on soft track: ${userSoftTrackStats}
        
        Give a 3-sentence briefing. What should I know?
    """)
))
```

#### 2. Form Guide Analysis (vision)
```kotlin
// Input: photo of form guide page
val analysis = conversation.sendMessage(Contents.of(
    Content.ImageFile(formGuidePath),
    Content.Text("Summarise the key form factors for each horse. Focus on track condition, distance, and recent form.")
))
```

#### 3. Post-Race Debrief (text generation)
```kotlin
// Input: user's calls today + results
val debrief = conversation.sendMessage(Contents.of(
    Content.Text("""
        Today's calls:
        ${todaysCalls.map { "${it.race}: called ${it.horse} → ${it.result}" }.joinToString("\n")}
        
        What was my best read today and why? What pattern am I showing? One paragraph.
    """)
))
```

#### 4. Voice Reasoning (audio)
```kotlin
// Input: 30-second voice recording before race
val transcription = conversation.sendMessage(Contents.of(
    Content.AudioFile(voiceNotePath),
    Content.Text("Transcribe this racing analysis. Extract the key reasoning.")
))
// Stored locally, indexed by race — forms a reasoning diary
```

### System Instruction
```
You are a racing analyst working for the punter. You provide sharp, concise briefings.
You never make the call — that's the punter's job. You surface what matters and get out of the way.
Speak like a knowledgeable friend at the track, not a textbook.
When the punter calls it right, acknowledge it specifically — what they saw that others didn't.
When they miss, help them see what happened without excuses.
Keep it to 2-3 sentences unless asked for more.
```

---

## Data Model (Revised)

### Convex Schema Additions (extends existing 7 tables)

```typescript
// calls — the core of the app
defineTable({
  raceId: v.id("races"),
  userId: v.string(),           // device ID initially, auth later
  horseName: v.string(),
  horseNumber: v.optional(v.number()),
  committedAt: v.number(),      // epoch ms — BEFORE race start
  result: v.optional(v.union(
    v.literal("called"),        // picked the winner
    v.literal("placed"),        // picked a place-getter  
    v.literal("missed"),        // wrong
    v.literal("pending")        // race not yet run
  )),
  voiceReasoningRef: v.optional(v.string()),  // local file ref
  settledAt: v.optional(v.number()),
})
.index("by_race", ["raceId"])
.index("by_user", ["userId"])
.index("by_user_date", ["userId", "committedAt"])

// nods — one per person per call
defineTable({
  callId: v.id("calls"),
  fromUserId: v.string(),
  createdAt: v.number(),
})
.index("by_call", ["callId"])
.index("by_from", ["fromUserId"])
.index("unique_nod", ["callId", "fromUserId"])  // enforce one nod per person

// profiles — derived stats
defineTable({
  userId: v.string(),
  displayName: v.string(),
  totalCalls: v.number(),
  totalCalled: v.number(),       // wins
  totalPlaced: v.number(),
  currentStreak: v.number(),
  bestStreak: v.number(),
  totalNodsReceived: v.number(),
  totalNodsGiven: v.number(),
  tags: v.array(v.string()),     // earned specialisation tags
  seasonStart: v.number(),
})
.index("by_user", ["userId"])
.index("leaderboard_calls", ["totalCalled"])
.index("leaderboard_nods", ["totalNodsReceived"])
.index("leaderboard_streak", ["bestStreak"])
```

### Local (Room)
```kotlin
// Mirror of calls for offline commit
@Entity(tableName = "calls")
data class CallEntity(
    @PrimaryKey val id: String,    // UUID
    val raceId: String,
    val horseName: String,
    val horseNumber: Int?,
    val committedAt: Long,
    val result: String = "pending",
    val voiceReasoningPath: String? = null,
    val synced: Boolean = false
)

// AI conversation cache (briefings, debriefs)
@Entity(tableName = "ai_cache") 
data class AiCacheEntity(
    @PrimaryKey val raceId: String,
    val briefing: String?,
    val debrief: String?,
    val generatedAt: Long
)
```

---

## Offline Flow

```
AT THE TRACK (no signal):

1. Race fields were synced earlier (cached in Room)
2. Consensus tips were synced earlier (cached)
3. AI briefing generates locally (Gemma 4, no network needed)
4. User makes their call → saved to Room, marked unsynced
5. Voice reasoning → saved to local storage
6. Race happens (user watches live)
7. Results: user knows outcome. App marks pending until sync.

BACK IN RANGE:

8. Calls sync to Convex (with committed timestamps proving pre-race)
9. Results flow in from Convex (admin entered via Matrix bot)
10. Calls settle: called / placed / missed
11. Community feed populates with everyone's calls
12. Nods become available
13. AI debrief generates locally with full context
```

---

## MVP Scope (what ships first)

### In
- Race feed (from Convex, cached locally)
- Consensus tips display (admin-extracted, aggregated)
- Make a call (one horse per race, lock before start)
- Results + settlement (called / placed / missed)
- Community feed (who called what)
- The nod (one tap, one per person per call)
- Profile (strike rate, streak, nods received)
- AI briefing per race (Gemma 4 local)
- Offline call commitment

### Out (later phases)
- Conviction levels / QV credits (Phase B)
- Voice reasoning (Phase B — needs audio model loaded, battery cost)
- Form guide scanning (Phase B — vision for user, not just admin)
- Specialisation tags (Phase B — needs history for pattern detection)
- Post-race AI debrief (Phase B — needs result + call correlation)
- ZK privacy (Phase C)
- Synthetic observers (Phase C)
- B2B (Phase D)

---

## Project Structure (Revised)

```
~/tta-matrix/android/
├── app/src/main/kotlin/com/tta/makecall/
│   ├── MainActivity.kt
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── RaceFeedScreen.kt       # Today's races
│   │   │   ├── RaceDetailScreen.kt     # Field + consensus + AI briefing + MAKE CALL
│   │   │   ├── CommunityFeedScreen.kt  # Who called what + nods
│   │   │   └── ProfileScreen.kt        # Stats, streak, nods
│   │   ├── components/
│   │   │   ├── RaceCard.kt
│   │   │   ├── CallButton.kt           # The big "LOCK IT IN" button  
│   │   │   ├── NodButton.kt            # Single tap recognition
│   │   │   ├── StreakBadge.kt
│   │   │   └── AiBriefingCard.kt
│   │   └── theme/
│   ├── analyst/
│   │   ├── RaceAnalyst.kt              # Gemma 4 wrapper for briefings
│   │   ├── AnalystPrompts.kt           # System instructions + prompt templates
│   │   └── ModelManager.kt             # Download + init LiteRT-LM
│   ├── domain/
│   │   ├── models/                     # Call, Race, Profile, Nod
│   │   ├── aggregation/               # Port of v0/v2 consensus algorithm
│   │   └── settlement/                # Result → call settlement logic
│   ├── data/
│   │   ├── local/                     # Room DB
│   │   ├── remote/                    # Convex client
│   │   └── sync/                      # Offline-first sync engine
│   └── di/                            # Hilt modules
├── build.gradle.kts
└── gradle/
```

---

## Success Criteria (Revised)

Phase A is complete when:
1. User sees today's races with consensus tips
2. User can make a call on any race before it starts
3. Calls lock and cannot be changed after commitment
4. Results settle calls (called / placed / missed)
5. Community feed shows who called what
6. The nod works (one tap, one per person)
7. Profile shows strike rate, streak, nods
8. AI briefing generates on-device for each race
9. Works offline at the track (calls commit locally, sync later)
10. Tested on OG Galaxy Z Flip

---

## The Name

**Make The Call**

Not "TipAnalyser." Not "Conviction Game." Not "Racing AI."

Make The Call.

It's a verb. It's what you do. The app is named after the action it asks of you.
