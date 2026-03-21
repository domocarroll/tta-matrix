# TTA Matrix — Execution Plan

**Project**: The TipAnalyser v2
**Architecture**: Claude Agent SDK + Convex + Matrix
**Philosophy**: OOGI — the organisation IS the intelligence

---

## The Problem with v0

The current TipAnalyser is a **stateless UI wrapper around Gemini OCR**:
- No persistence — every session starts from scratch
- No memory — past tips, results, tipster performance all lost
- No collaboration — single-user, no shared intelligence
- No agentic interface — locked to a web form
- Fragile extraction — model changes break everything
- No feedback loop — can't learn which tipsters are actually good

The client doesn't need a prettier UI. He needs an **intelligent backend** that
accumulates knowledge and surfaces insights over time.

---

## The Inversion

v0: **User → UI → AI → ephemeral result → gone**
v2: **User → Matrix → Agent → Convex (persistent) → intelligence compounds**

The Matrix channel is not a chat wrapper. It IS the product. Punters live in group
chats. That's where tips flow. That's where banter happens. That's where collective
intelligence already exists — it just isn't captured or structured.

We don't move punters to our app. We move our intelligence to where punters already are.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MATRIX CHANNEL                         │
│              (Where punters already live)                  │
│                                                           │
│  @tipbot processes images, answers queries, tracks bets   │
│  Punters send tip sheets, ask questions, make predictions │
│  Results posted automatically, leaderboards updated       │
└────────────────────────┬─────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  CLAUDE AGENT SDK   │
              │  (Intelligence)     │
              │                     │
              │  - Vision OCR       │
              │  - Data validation  │
              │  - Query answering  │
              │  - Market reasoning │
              │  - Performance      │
              │    analysis         │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │      CONVEX         │
              │  (Ground Truth)     │
              │                     │
              │  - Races            │
              │  - Tips             │
              │  - Tipsters         │
              │  - Predictions      │
              │  - Results          │
              │  - ZK commitments   │
              └─────────────────────┘
```

---

## OOGI Mapping

From the kernel (thread 15):

| OOGI Principle | TTA Application |
|---|---|
| Knowledge work → Software | Tip analysis (reading papers, pattern matching) → structured extraction pipeline |
| Software → Embedded meta-agentics | Claude Agent SDK handles ALL cognitive work — extraction, validation, querying |
| Org IS intelligence | Matrix group + prediction market = collective intelligence that compounds |
| Gravity | Tips with more corroboration have higher gravitational pull in aggregation |

The Matrix channel isn't a product. It's an **organism** that gets smarter over time.
Every tip sheet processed adds to the knowledge graph. Every race result closes a
feedback loop. Every prediction market resolves into ground truth.

---

## Phase 0: Foundation (Convex Schema + Agent Core)

### 0.1 Convex Schema

```typescript
// convex/schema.ts

// Meetings (race days)
meetings: defineTable({
  name: v.string(),              // "Randwick", "Flemington"
  date: v.string(),              // "2026-03-21"
  category: v.string(),          // "SR" | "MR" | "BR" etc
  status: v.union(
    v.literal("upcoming"),
    v.literal("live"),
    v.literal("completed")
  ),
  raceCount: v.number(),
}).index("by_date", ["date"])
  .index("by_status", ["status"]),

// Individual races
races: defineTable({
  meetingId: v.id("meetings"),
  raceNumber: v.number(),
  name: v.optional(v.string()),   // race name if known
  status: v.union(
    v.literal("upcoming"),
    v.literal("running"),
    v.literal("resulted")
  ),
  result: v.optional(v.array(v.object({
    position: v.number(),
    horseName: v.string(),
    horseNumber: v.number(),
  }))),
}).index("by_meeting", ["meetingId"])
  .index("by_status", ["status"]),

// Horse details (from race cards)
horses: defineTable({
  raceId: v.id("races"),
  horseNumber: v.number(),
  horseName: v.string(),
  jockey: v.optional(v.string()),
  trainer: v.optional(v.string()),
  weight: v.optional(v.number()),
  barrier: v.optional(v.number()),
}).index("by_race", ["raceId"]),

// Extracted tips
tips: defineTable({
  raceId: v.id("races"),
  tipsterId: v.id("tipsters"),
  selections: v.array(v.object({
    position: v.number(),         // 1=win, 2=place, 3=show, 4=fourth
    horseName: v.string(),
    horseNumber: v.optional(v.number()),
  })),
  source: v.union(
    v.literal("image"),           // OCR extracted
    v.literal("manual"),          // typed in chat
    v.literal("api"),             // from external feed
  ),
  sourceImageId: v.optional(v.string()),
  extractedAt: v.number(),
  confidence: v.optional(v.number()),
}).index("by_race", ["raceId"])
  .index("by_tipster", ["tipsterId"]),

// Tipsters (identified sources)
tipsters: defineTable({
  name: v.string(),               // "TONY", "NICK", etc
  matrixUserId: v.optional(v.string()),
  type: v.union(
    v.literal("newspaper"),       // newspaper columnist
    v.literal("punter"),          // group member
    v.literal("algorithm"),       // bot/model
  ),
  stats: v.object({
    totalTips: v.number(),
    wins: v.number(),
    places: v.number(),
    strikeRate: v.number(),
    roi: v.number(),              // return on investment
    lastUpdated: v.number(),
  }),
  // ZK identity (Phase 3)
  zkIdentityCommitment: v.optional(v.string()),
}).index("by_name", ["name"])
  .searchIndex("search_name", { searchField: "name" }),

// Predictions (market positions)
predictions: defineTable({
  raceId: v.id("races"),
  userId: v.string(),             // matrix user ID
  selection: v.object({
    horseName: v.string(),
    horseNumber: v.optional(v.number()),
    betType: v.union(
      v.literal("win"),
      v.literal("place"),
      v.literal("each-way"),
    ),
  }),
  stake: v.number(),              // play money units
  odds: v.optional(v.number()),   // market odds at time of prediction
  status: v.union(
    v.literal("open"),
    v.literal("won"),
    v.literal("lost"),
    v.literal("void"),
  ),
  payout: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_race", ["raceId"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"]),

// Aggregated views (materialised for performance)
aggregations: defineTable({
  raceId: v.id("races"),
  data: v.any(),                  // aggregated tip data (same shape as v0)
  generatedAt: v.number(),
}).index("by_race", ["raceId"]),
```

### 0.2 Claude Agent SDK — Core Agent

```typescript
// src/agent.ts — The TipBot agent

import { Agent, tool } from "claude-agent-sdk"

const tipBot = new Agent({
  name: "TipBot",
  model: "claude-sonnet-4-5-20250514",
  instructions: `You are TipBot, a horse racing tip extraction and analysis agent.
    You process tip sheet images, structure the data, and help punters
    make informed decisions. You have access to historical data via Convex.`,
  tools: [
    extractTipsFromImage,     // Vision OCR → structured tips
    queryRace,                // Look up race data
    queryTipster,             // Tipster stats & history
    makePrediction,           // Record a prediction
    getLeaderboard,           // Punter/tipster rankings
    getAggregation,           // Aggregated tip consensus
    recordResult,             // Record race result, settle markets
  ],
})
```

### 0.3 Extraction Tool (replaces Gemini)

```typescript
const extractTipsFromImage = tool({
  name: "extract_tips",
  description: "Extract horse racing tips from a tip sheet image",
  parameters: z.object({
    imageBase64: z.string(),
    category: z.enum(["SR", "MR", "BR", "PR", "AR", "OR"]),
    meetingName: z.optional(z.string()),
  }),
  execute: async ({ imageBase64, category, meetingName }) => {
    // Claude's vision handles this natively — no separate OCR service needed
    // The agent itself IS the extractor
    // Results go straight to Convex
  },
})
```

**Key insight**: In v0, the AI is a black-box OCR service called via server action.
In v2, the AI is the agent — it sees, extracts, validates, and persists in one cognitive loop.
No intermediary review step needed because the agent can self-verify.

---

## Phase 0.5: Race Data Pipeline (Cloudflare Worker)

### 0.5.1 What it does

A Cloudflare Worker runs on a cron trigger and scrapes every race meeting in Australia.
By the time anyone sends a tip, the system already knows every horse, jockey, trainer,
barrier, and weight for every race that day.

A second cron runs after each race's scheduled jump time to scrape results.
This closes the feedback loop automatically — no manual entry.

### 0.5.2 Cloudflare Worker Architecture

```
workers/
  scraper/
    src/
      index.ts          — Worker entry point + cron handler
      scrape-fields.ts  — Scrape race fields (meetings, races, horses)
      scrape-results.ts — Scrape race results
      parse.ts          — HTML → structured data transforms
      convex-client.ts  — Push data to Convex via HTTP actions
    wrangler.toml       — Cron triggers + bindings
```

### 0.5.3 Cron Schedule

```toml
# wrangler.toml
[triggers]
crons = [
  "0 18 * * *",   # 6pm AEST day before — scrape tomorrow's fields
  "0 6 * * *",    # 6am AEST race day — refresh with final fields/scratchings
  "*/15 * * * *", # Every 15min during race hours — scrape results
]
```

### 0.5.4 Scraping with Cloudflare Browser Rendering

```typescript
// scrape-fields.ts
export async function scrapeFields(env: Env): Promise<Meeting[]> {
  // Use Cloudflare's /scrape REST API endpoint
  // Target: racenet.com.au/form-guide/ (well-structured, all states, all codes)
  //
  // Step 1: GET the day's meetings list
  // Step 2: For each meeting, scrape the fields page
  // Step 3: Parse into Meeting → Race → Horse structures
  // Step 4: Push to Convex via HTTP action

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/scrape`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.racenet.com.au/form-guide/",
        elements: [
          { selector: ".meeting-card", fields: { name: ".meeting-name", date: ".date" } },
          { selector: ".runner-row", fields: {
            number: ".runner-number",
            name: ".runner-name",
            jockey: ".jockey",
            trainer: ".trainer",
            weight: ".weight",
            barrier: ".barrier",
          }},
        ],
      }),
    }
  )

  // Parse and return structured data
}
```

### 0.5.5 Enhanced Schema (race fields pre-populated)

The horses table gains richer fields since we're scraping full form guides:

```typescript
horses: defineTable({
  raceId: v.id("races"),
  horseNumber: v.number(),
  horseName: v.string(),
  jockey: v.string(),
  trainer: v.string(),
  weight: v.number(),
  barrier: v.number(),
  scratched: v.boolean(),          // updated on morning scrape
  lastStartForm: v.optional(v.string()), // e.g. "1x23" recent form
}).index("by_race", ["raceId"])
  .index("by_name", ["horseName"]),
```

The races table gains timing and classification:

```typescript
races: defineTable({
  meetingId: v.id("meetings"),
  raceNumber: v.number(),
  name: v.optional(v.string()),
  distance: v.optional(v.number()),        // metres
  class: v.optional(v.string()),           // "Group 1", "Maiden", "BM72" etc
  trackCondition: v.optional(v.string()),  // "Good 4", "Heavy 8" etc
  scheduledTime: v.optional(v.string()),   // ISO timestamp for jump time
  status: v.union(
    v.literal("upcoming"),
    v.literal("running"),
    v.literal("resulted")
  ),
  result: v.optional(v.array(v.object({
    position: v.number(),
    horseName: v.string(),
    horseNumber: v.number(),
  }))),
}).index("by_meeting", ["meetingId"])
  .index("by_status", ["status"]),
```

### 0.5.6 Data Flow

```
Racenet.com.au
     │
     ▼
Cloudflare Worker (/scrape)
     │
     ▼
Parse HTML → { meetings, races, horses }
     │
     ▼
Convex HTTP Action (upsert)
     │
     ├── meetings: upsert by (name + date)
     ├── races: upsert by (meetingId + raceNumber)
     └── horses: upsert by (raceId + horseNumber)

     ... time passes, race runs ...

Cloudflare Worker (/scrape results)
     │
     ▼
Convex mutation: update race status → "resulted"
                 update tipster stats reactively
```

### 0.5.7 Why This Eliminates Horse Details Photos

In v0, the client uploads race card photos separately so the system knows
jockey/trainer/barrier. That's gone. The scraper handles it. The client
just uploads tip sheets. The agent matches tip names against pre-populated
horse data by fuzzy name matching (Claude handles this natively —
"WINX" matches "Winx", "HORSE 5" matches horse number 5, etc.)

---

## Phase 1: Matrix Bot

### 1.1 Bot Architecture

Using `matrix-rust-sdk` (we have experience from Element X fork) or `matrix-bot-sdk` (Node.js, simpler for TS ecosystem with Convex).

Given the stack is TypeScript (Claude Agent SDK + Convex), use **matrix-bot-sdk**:

```
npm install matrix-bot-sdk
```

### 1.2 Bot Commands

```
!tip <image>          → Extract tips from attached image, persist to Convex
!race <N>             → Show race N aggregation (consensus picks)
!tipster <name>       → Show tipster stats & track record
!predict <horse> <$>  → Make a prediction on a horse (play money)
!leaderboard          → Show top punters by ROI
!results              → Show latest race results
!quaddie              → Calculate optimal quaddie combinations
!help                 → Command list
```

### 1.3 Passive Intelligence

The bot doesn't just respond to commands. It watches the channel:
- Detects tip sheet images posted without commands → auto-extracts
- Notices when punters discuss horses → cross-references with data
- Posts pre-race summaries 30min before jump time
- Posts post-race results + market settlements automatically

### 1.4 Matrix Setup

- Homeserver: Existing Synapse on Hostinger VPS (huly.subfrac.cloud)
- Create new Space: "The TipAnalyser" (or client-chosen name)
  - #general — banter, discussion
  - #tips — tip sheet uploads + bot extractions (structured output)
  - #results — auto-posted race results + settlements
  - #leaderboard — tipster rankings (updated reactively)
- Bot account: `@tipbot:subfrac.cloud`
- Access: Private space, invite-only (the "closed garden")
- E2EE: Off for bot rooms (bot needs to read messages), optional for #general

---

## Phase 2: Intelligence Layer

### 2.1 Feedback Loop

```
Tips extracted → Race happens → Results recorded → Tipster stats updated
                                                    ↓
                                              Aggregation weights adjusted
                                              (better tipsters = higher weight)
```

This is the OOGI loop. The system gets smarter every race day because:
- Tipster reliability scores update with ground truth
- Aggregation algorithm learns which tipsters to weight higher
- Prediction market prices reflect collective belief
- Historical data enables pattern detection (e.g., "Tony is 40% on wet tracks")

### 2.2 Aggregation v2

v0 aggregation is simple counting. v2 is **weighted by tipster reliability**:

```typescript
// Weighted aggregation
function aggregateRace(tips: Tip[], tipsters: Tipster[]): AggregatedTip[] {
  // Weight each tipster's picks by their historical strike rate
  // A 60% tipster's win pick counts more than a 20% tipster's
  // This is wisdom-of-crowds with reputation weighting
}
```

### 2.3 Convex Real-time

Convex's reactive queries mean the Matrix bot gets **instant updates**:
- When results are recorded, affected predictions settle automatically
- When new tips are added, aggregations recompute reactively
- Leaderboard updates in real-time as races complete

---

## Phase 3: Prediction Market

### 3.1 Closed Garden Market

Not a public betting exchange. A **private intelligence aggregation mechanism**
for the group:

- Play money (avoids gambling regulation)
- Or real stakes via crypto (requires legal review — AU gambling laws)
- Each race creates a market automatically
- Punters "stake" on outcomes → prices reflect collective belief
- Market closes at race start → settles on result

### 3.2 Market Mechanics

```
Automated Market Maker (AMM) — constant product formula:
  x * y = k

For a race with horses A, B, C:
  shares_A * shares_B * shares_C = k

Price of horse A = (shares_B * shares_C) / (shares_A * shares_B + shares_A * shares_C + shares_B * shares_C)
```

Simpler alternative: **parimutuel pool** — total stakes distributed to winners
proportionally. This is how actual tote betting works. Familiar to punters.

### 3.3 Intelligence Signals

The market price IS a signal:
- If the group collectively bets heavily on Horse 5, that's a strong consensus
- Divergence between market price and tipster consensus = opportunity signal
- "Smart money" detection — which punters consistently move the market correctly?

---

## Phase 4: ZK Reputation (Research Required)

### 4.1 The Problem

Tipsters want to:
- Build reputation (prove they're profitable over time)
- Protect identity (competitors copy tips, personal exposure)
- Participate anonymously in the prediction market

### 4.2 ZK Solution Architecture

Using **Semaphore** (Ethereum ZK identity framework):

```
Identity commitment = hash(identity_secret)
                    ↓
Merkle tree of group members
                    ↓
ZK proof: "I am a member of this group AND
           my historical strike rate is > 55%
           WITHOUT revealing which member I am"
```

### 4.3 Selective Disclosure

- "I have tipped 200+ races with 35% win strike rate" (provable, anonymous)
- "My ROI over 6 months is +12%" (provable, anonymous)
- "I am the same person who tipped the last 5 winners" (provable, without revealing identity)

### 4.4 Implementation Notes

- Semaphore v4 (latest) or Semaphore v3 (more stable)
- Circom circuits for custom reputation proofs
- Convex stores ZK commitments, not identities
- Proof verification can run client-side (in-browser) or via Convex action

**This phase requires the archived research to be located.** The subagent is searching.

---

## Phase 5: Web UI (Optional)

If a web interface is still wanted:
- Convex-powered dashboard showing aggregations, leaderboards, markets
- Read-only view of what the Matrix channel sees
- Image upload as alternative to Matrix (for non-Matrix users)
- This is secondary — Matrix channel is the primary interface

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Intelligence | Claude Agent SDK | Best-in-class vision + structured output + tool use |
| Data | Convex | Real-time, reactive, TypeScript-native, mutations + queries |
| Interface | Matrix (matrix-bot-sdk) | Where punters already live, E2EE, self-hostable |
| Scraping | Cloudflare Workers + Browser Rendering | Free tier, /scrape endpoint, cron triggers, edge compute |
| Auth | Matrix identity | No separate auth system needed |
| Markets | Custom on Convex | Simple AMM or parimutuel, play money |
| ZK | Semaphore / Circom | Anonymous reputation proofs |
| Hosting | Convex Cloud + Cloudflare + VPS | Convex for data, CF for scraping, VPS for Matrix bot |

---

## Kernel Leverage

From the Hyprsphere kernel, this project exercises:

| Kernel Doc | Application |
|---|---|
| OOGI thesis | The group IS the intelligence — agentic tip analysis as org cognition |
| Semantic parser combinators | `extract() | validate() | persist() | aggregate()` — composable pipeline |
| Gravity model | Tips weighted by tipster reliability = gravitational pull |
| Observer pattern | Bot observes channel, Shadow-style event capture |
| Triarchy | Compute (Claude) + Algorithms (aggregation/AMM) + Novel Ideation (punter insight) |

---

## Milestone Sequence

```
M0: Foundation          — Convex schema + Claude Agent SDK core + extraction tool
M1: Race Data Pipeline  — Cloudflare Worker scrapes all AU races → Convex (fields + results)
M2: Matrix Bot          — Bot joins channel, processes images, responds to commands
M3: Tip Matching        — Tips matched against pre-populated race/horse data
M4: Intelligence        — Weighted aggregation + tipster stats + auto-feedback loop
M5: Prediction Market   — Play-money market per race + leaderboard
M6: ZK Reputation       — Anonymous identity + provable track records
M7: Polish              — Pre-race summaries, web dashboard, notifications
```

---

## Open Questions for Discussion

1. **Project name**: "TTA Matrix"? "TipNet"? "The Form Guide"? Client preference?
2. **Matrix space name**: Client-facing name for the space + channel structure?
3. **Play money vs real stakes**: Legal implications for AU gambling regulation
4. **Tipster identity**: Are newspaper tipsters always named? Only punters need ZK?
5. **Model choice**: Claude Sonnet for extraction (fast + cheap) or Opus (best quality)?
6. **Client's existing group**: Is there already a Matrix/Signal/WhatsApp group to bridge?
7. **Scrape target**: Racenet.com.au (best structured data, Apify scraper exists) or racing.com?
