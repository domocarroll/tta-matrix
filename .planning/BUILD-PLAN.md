# The Conviction Game — Build Plan

**Date**: 30 March 2026
**Status**: Planning
**Goal**: Ship a working conviction game for horse racing intelligence
**Research**: See `RESEARCH-FINDINGS.md` for full agent research outputs

### Key Research Outcomes (30 Mar 2026)

1. **Keep direct Anthropic API** — Agent SDK wraps Claude Code CLI (too heavy for embedded bot)
2. **Semaphore v4 works FULLY off-chain** — no blockchain needed for ZK anonymous membership
3. **MACI requires on-chain** — implement anti-collusion as simpler commitment scheme instead
4. **Convex crons replace CF Workers** — scraping moves into Convex actions, one less deployment
5. **Convex fuzzy search removed** — Claude handles name normalisation natively, no issue
6. **matrix-bot-sdk v0.8.0 confirmed** — maintained by Element HQ, current code is correct
7. **Noir > Circom** for custom reputation proofs — Rust-like, TypeScript-native, off-chain
8. **Architecture simplifies to 2 deployment targets**: Convex Cloud + Hostinger VPS

---

## Current State Assessment

### What Exists (M0 — COMPLETE)

The monorepo at `~/tta-matrix/` has 5 packages with real, working code:

| Package | Status | What's There |
|---------|--------|-------------|
| `packages/convex/` | **Complete** | Full schema (7 tables), mutations, queries, auto-settlement, tipster stats update |
| `packages/agent/` | **Complete** | TipBot agent using Anthropic API directly. 9 tools. Image processing. Agentic loop with tool use. ConvexHttpClient. |
| `packages/matrix-bot/` | **Complete** | Matrix bot via `matrix-bot-sdk`. Command parsing (!tip, !race, !tipster, !predict, !leaderboard, !results, !quaddie). Auto-extracts tip sheet images. |
| `packages/scraper/` | **Deprecated** | CF Worker skeleton — research shows Convex crons replace this entirely. Scraping moves to Convex actions. |
| `packages/shared/` | **Complete** | Domain types, extraction types, aggregation logic, error handling. Tests. |

**Convex is NOT deployed yet.** Running `npx convex dev` deploys it — 5 minutes.

### What Doesn't Exist Yet

- Scraper implementation (empty stubs)
- WhatsApp bridge
- Conviction allocation system (QV credits)
- Social deduction game loop
- ZK privacy layer
- Synthetic observers
- Personal swarms
- B2B community boundaries

### Critical Dependency Chain

```
Convex deployment
  → Scraper (race data + results)
    → Agent extraction (tips matched against pre-populated horses)
      → Matrix bot live (community can use it)
        → Conviction Game v1 (QV credits, transparent)
          → Social deduction layer (forensics, phases)
            → ZK layer (anonymous reputation)
              → Synthetic intelligence (observers + swarms)
                → B2B platform (community boundaries)
```

Each step validates the next. Each step can generate revenue from the step before.

---

## Phase 1: Ground Truth Pipeline

**Duration**: 1-2 weeks
**Dependencies**: None
**Outcome**: Race fields and results automatically flow into Convex every day

### 1.1 Deploy Convex

```bash
cd ~/tta-matrix/packages/convex
npx convex dev
```

This creates the Convex project, deploys the schema, and generates TypeScript types. Takes 5 minutes. Unblocks everything.

### 1.2 Implement Race Field Scraper

**File**: `packages/scraper/src/scrape-fields.ts`

Target: `racenet.com.au/form-guide/` — well-structured, all states, all codes.

Approach options (evaluate in order of simplicity):
1. **Racenet API** — Check if racenet exposes a JSON API (many racing sites have undocumented APIs backing their frontend). Inspect network tab. If found, use `fetch()` directly — no browser rendering needed.
2. **CF Browser Rendering `/scrape`** — Cloudflare's structured scraping endpoint. Define CSS selectors, get back JSON. No headless browser management.
3. **Direct HTML fetch + cheerio** — Fetch the page with `fetch()`, parse with `cheerio`. Works if the page is server-rendered (not SPA).

Data to extract per meeting:
- Meeting name, date, category (SR/MR/BR/PR/AR/OR)
- Per race: number, name, distance, class, track condition, scheduled time
- Per horse: number, name, jockey, trainer, weight, barrier, scratched status

Push to Convex via HTTP actions (already defined in `convex/http.ts`).

### 1.3 Implement Results Scraper

**File**: `packages/scraper/src/scrape-results.ts`

Runs every 15 minutes during race hours. For each meeting with status "live":
1. Fetch results page
2. Parse finishing order (position, horse name, horse number)
3. Call `races:recordResult` mutation in Convex
4. This automatically: settles predictions, updates tipster stats

### 1.4 Deploy CF Worker

```bash
cd ~/tta-matrix/packages/scraper
npx wrangler deploy
```

Set secrets: `CONVEX_URL`

### 1.5 Verification

- [ ] Race fields appear in Convex for tomorrow's meetings
- [ ] Results populate after each race
- [ ] Tipster stats auto-update when results arrive
- [ ] Manual trigger endpoints work (`/scrape/fields`, `/scrape/results`)

---

## Phase 2: Extraction + Bot Live

**Duration**: 1-2 weeks
**Dependencies**: Phase 1 (Convex deployed, race data flowing)
**Outcome**: Drop a tip sheet image in Matrix → structured intelligence appears

### 2.1 Verify Extraction Pipeline

The agent already handles image extraction. Verify with real tip sheet images from `~/v0-thetipanalyser/e2e/fixtures/images/`.

Key test: does the agent correctly match extracted tipster names against horse data pre-populated by the scraper? The tool handler already does this (`handleExtractTips` looks up today's meetings and races).

### 2.2 Deploy Matrix Bot

On the Hostinger VPS (`ssh -i ~/.ssh/hostinger_vps root@76.13.16.225`):

1. Create bot account on existing Synapse: `@tipbot:subfrac.cloud`
2. Create Space: "The TipAnalyser"
   - `#tips` — tip uploads + bot extractions
   - `#results` — auto-posted race results
   - `#leaderboard` — tipster rankings
   - `#general` — banter
3. Deploy `packages/matrix-bot` as systemd service
4. Set env vars: `MATRIX_HOMESERVER_URL`, `MATRIX_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `CONVEX_URL`

### 2.3 End-to-End Test

- [ ] Drop tip sheet image in #tips → bot extracts and posts structured data
- [ ] `!race 3` → shows aggregation for Race 3
- [ ] `!tipster TONY` → shows Tony's stats
- [ ] Race results auto-post in #results after each race
- [ ] Leaderboard updates reactively

### 2.4 WhatsApp Onramp

Deploy `mautrix-whatsapp` bridge on VPS. This bridges WhatsApp → Matrix, so the same TipBot agent serves both channels.

WhatsApp tier delivers:
- Consensus tips per race (aggregated from all tipster extractions)
- Race results
- "Download the app" CTA

**Content policy**: Zero gambling language on WhatsApp. Information delivery only.

---

## Phase 3: The Conviction Game v1 (Transparent QV)

**Duration**: 3-4 weeks
**Dependencies**: Phase 2 (community using the platform, data flowing)
**Outcome**: Punters allocate conviction credits with quadratic cost, settled against ground truth

**Strategic decision**: Ship QV without ZK first. Prove the mechanism works with transparent voting. Add privacy later.

### 3.1 Schema Evolution

New Convex tables:

```typescript
// Credit balances for each participant
creditBalances: defineTable({
  userId: v.string(),           // Matrix user ID
  balance: v.number(),          // Current credit balance
  totalEarned: v.number(),      // Lifetime credits earned
  totalSpent: v.number(),       // Lifetime credits spent
  seasonId: v.string(),         // Current season
  lastUpdated: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_season", ["userId", "seasonId"]),

// Conviction allocations (the core primitive)
convictionAllocations: defineTable({
  raceId: v.id("races"),
  userId: v.string(),
  allocations: v.array(v.object({
    horseNumber: v.number(),
    horseName: v.string(),
    credits: v.number(),          // Credits spent (QV cost)
    votes: v.number(),            // Effective votes (sqrt of credits)
  })),
  totalCreditsSpent: v.number(),
  status: v.union(
    v.literal("open"),            // Pre-race, can modify
    v.literal("locked"),          // Race about to start, locked in
    v.literal("settled"),         // Result in, P&L calculated
  ),
  pnl: v.optional(v.number()),   // Credits earned/lost after settlement
  createdAt: v.number(),
  lockedAt: v.optional(v.number()),
})
  .index("by_race", ["raceId"])
  .index("by_user", ["userId"])
  .index("by_race_user", ["raceId", "userId"])
  .index("by_status", ["status"]),

// Conviction aggregation (what the community sees)
convictionSignals: defineTable({
  raceId: v.id("races"),
  totalParticipants: v.number(),
  totalCreditsAllocated: v.number(),
  signals: v.array(v.object({
    horseNumber: v.number(),
    horseName: v.string(),
    totalVotes: v.number(),       // Sum of sqrt(credits) across all participants
    participantCount: v.number(), // How many people backed this horse
    convictionShare: v.number(),  // Percentage of total conviction signal
  })),
  anomalyFlags: v.optional(v.array(v.string())),
  generatedAt: v.number(),
})
  .index("by_race", ["raceId"]),

// Seasons (for credit reset cycles)
seasons: defineTable({
  name: v.string(),               // "2026-Autumn"
  startDate: v.string(),
  endDate: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("completed"),
  ),
  initialCreditAllocation: v.number(),
})
  .index("by_status", ["status"]),
```

### 3.2 Quadratic Cost Engine

The core mechanism — pure function, belongs in `packages/shared/`:

```typescript
// The QV cost function
function quadraticCost(votes: number): number {
  return votes * votes;
}

// Inverse: how many votes do N credits buy?
function votesFromCredits(credits: number): number {
  return Math.sqrt(credits);
}

// Allocate credits across horses with QV cost
function validateAllocation(
  allocations: Array<{ horseNumber: number; credits: number }>,
  availableBalance: number,
): { valid: boolean; totalSpent: number; error?: string } {
  const totalSpent = allocations.reduce((sum, a) => sum + a.credits, 0);

  if (totalSpent > availableBalance) {
    return { valid: false, totalSpent, error: "Insufficient credits" };
  }

  // Each allocation's credits must be a perfect square (1, 4, 9, 16, 25...)
  // Or allow fractional votes (spend any amount, get sqrt(amount) votes)
  // Decision: allow any amount, votes = sqrt(credits)

  return { valid: true, totalSpent };
}
```

### 3.3 Settlement Engine

When `races:recordResult` fires, also settle conviction allocations:

```typescript
// Settlement logic (in Convex mutation)
async function settleConvictionAllocations(ctx, raceId, result) {
  const allocations = await ctx.db
    .query("convictionAllocations")
    .withIndex("by_race", q => q.eq("raceId", raceId))
    .collect();

  const winner = result.find(r => r.position === 1);

  // Pool-based settlement:
  // Total pool = sum of all credits spent on this race
  // Winners split the pool proportional to their votes on the winning horse
  const totalPool = allocations.reduce((sum, a) => sum + a.totalCreditsSpent, 0);
  const winnerAllocations = allocations.filter(a =>
    a.allocations.some(h =>
      h.horseNumber === winner.horseNumber || h.horseName === winner.horseName
    )
  );

  // Total votes on winner
  const totalWinnerVotes = winnerAllocations.reduce((sum, a) => {
    const winAlloc = a.allocations.find(h =>
      h.horseNumber === winner.horseNumber || h.horseName === winner.horseName
    );
    return sum + (winAlloc?.votes ?? 0);
  }, 0);

  for (const allocation of allocations) {
    const winAlloc = allocation.allocations.find(h =>
      h.horseNumber === winner.horseNumber || h.horseName === winner.horseName
    );

    if (winAlloc && totalWinnerVotes > 0) {
      // Winner: proportional share of pool
      const share = winAlloc.votes / totalWinnerVotes;
      const payout = totalPool * share;
      const pnl = payout - allocation.totalCreditsSpent;

      await ctx.db.patch(allocation._id, { status: "settled", pnl });
      // Update credit balance
      await updateCreditBalance(ctx, allocation.userId, pnl);
    } else {
      // Loser: lost their credits
      const pnl = -allocation.totalCreditsSpent;
      await ctx.db.patch(allocation._id, { status: "settled", pnl });
      await updateCreditBalance(ctx, allocation.userId, pnl);
    }
  }
}
```

### 3.4 Bot Commands for Conviction Game

New commands added to Matrix bot:

```
!allocate <race> <horse> <credits>  → Allocate QV credits to a horse
!budget                              → Show remaining credit balance
!signal <race>                       → Show aggregate conviction signal
!reveal <race>                       → Voluntarily reveal your allocation (post-race)
!conviction-leaderboard              → Rankings by conviction accuracy
```

### 3.5 Phase Loop Implementation

The game's temporal structure:

```
ALLOCATION WINDOW (opens when race fields published)
  → Punters allocate credits via !allocate
  → Aggregate signal updates in real-time (Convex reactive)

LOCK (5 min before scheduled race time)
  → All allocations locked
  → Final aggregate signal posted to #tips

SETTLEMENT (when result arrives from scraper)
  → Credits redistribute
  → PnL calculated
  → Signal posted to #results

FORENSICS (after settlement)
  → Anomaly detection runs
  → "Race 3 had unusual conviction concentration" posted
  → Community discussion in #general
```

This maps to the social deduction loop:
Night (allocation) → Dawn (settlement) → Day (forensics) → Dusk (discussion)

### 3.6 Credit Economics

- New users: 100 credits on signup (seasonal allocation)
- Accurate conviction earns credits (pool-based settlement)
- Inaccurate conviction loses credits (spent credits go to pool)
- Seasonal reset: partial rebalancing every 3 months
- Credits are NEVER purchasable, redeemable, or transferable (play-money safe harbour)

### 3.7 Verification

- [ ] QV allocation works: 1 vote = 1 credit, 2 votes = 4 credits, 3 votes = 9
- [ ] Settlement redistributes credits based on accuracy
- [ ] Aggregate conviction signal reflects quadratic weighting
- [ ] Leaderboard ranks by conviction accuracy over time
- [ ] Seasonal reset works
- [ ] Budget constraint enforced (can't overspend)

---

## Phase 4: Social Deduction Layer

**Duration**: 2-3 weeks
**Dependencies**: Phase 3 (conviction game mechanics working)
**Outcome**: The game feels like a game. Forensics. Drama. The Shark archetype emerges.

### 4.1 Forensic Pattern Detection

After each race settlement, run statistical analysis:

```typescript
function detectAnomalies(allocations, signal) {
  const flags = [];

  // Concentration anomaly: >60% of conviction on one horse from <20% of participants
  for (const horse of signal.signals) {
    if (horse.convictionShare > 0.6 && horse.participantCount / signal.totalParticipants < 0.2) {
      flags.push(`High concentration: ${horse.horseName} had ${(horse.convictionShare * 100).toFixed(0)}% of conviction from only ${horse.participantCount} participants`);
    }
  }

  // Correlation anomaly: multiple users with identical allocation patterns
  // (indicates possible coordination)
  // ... statistical correlation detection

  // Whale anomaly: single allocation > 30% of total pool
  // ... outlier detection

  return flags;
}
```

Posted to #tips as: "Race 3 forensics: unusual conviction concentration detected."
No individual allocations revealed. Just the pattern.

### 4.2 Conviction Reveal System

Post-race optional transparency:

```
!reveal 3   → "I allocated 16 credits (4 votes) to Horse 5 in Race 3.
               Result: Horse 5 won. P&L: +12 credits."
```

This creates social moments. "I called it." It's voluntary — privacy by default, exhibitionism by choice.

### 4.3 Reputation Decay

For participants whose conviction consistently deviates from accuracy:
- 5+ consecutive races with negative PnL → reputation warning
- 10+ → reduced credit allocation next season
- Correlated wrong allocations across multiple accounts → flag for investigation

This is the immune system. Not punitive for bad luck — targeted at systematic manipulation patterns.

### 4.4 Discussion Facilitation

Bot posts prompts during the "Dusk" phase:
- "Race 3 had the highest conviction divergence today. What did you see?"
- "Tony's newspaper tips were 4/8 today. The conviction signal was 5/8. Community beat the expert."
- "This week's most accurate participants: 1. [User A], 2. [User B], 3. [User C]"

These prompts generate discussion in #general. The discussion IS the social deduction layer.

---

## Phase 5: ZK Privacy Layer

**Duration**: 4-6 weeks
**Dependencies**: Phase 4 (game mechanics proven with transparent voting)
**Outcome**: Anonymous reputation. Provable track records. Cartel-resistant allocations.

### 5.1 Technology Selection

**Recommended stack** (based on research):

| Component | Technology | Why |
|-----------|-----------|-----|
| Anonymous group membership | Semaphore v4 | Production since 2020, TypeScript SDK, PSE-backed |
| Conviction commitments | Hash commitment scheme | Simple: `hash(userId + horseId + credits + salt)` stored before race, opened after |
| Anti-collusion | MACI v2 | Key-change primitive makes cartels unenforceable |
| Custom reputation proofs | Circom or Noir circuits | "My strike rate is >X%" without revealing identity |
| On-chain anchoring | Base L2 | Cheap, Coinbase ecosystem. Only for commitment storage. |

### 5.2 Implementation Sequence

```
Step 1: Hash commitment scheme (no blockchain, just Convex)
  → Punters submit hash(allocation + salt) before race
  → Open commitment after race to prove what they allocated
  → This alone gives "provable track record" without ZK

Step 2: Semaphore anonymous membership
  → "I am a member of this community" without revealing which member
  → Anonymous allocation with Semaphore nullifiers

Step 3: MACI anti-collusion
  → Key-change primitive: silently override committed allocation
  → Makes bribery/coercion unenforceable

Step 4: Custom reputation circuits
  → Circom circuit: "I am a member AND my strike rate > X%"
  → ZK-provable anonymous leaderboard
```

Each step can be shipped independently. Step 1 requires NO new dependencies.

### 5.3 Schema Evolution

```typescript
// ZK commitment layer
commitments: defineTable({
  raceId: v.id("races"),
  commitment: v.string(),        // hash(allocation + salt)
  nullifier: v.optional(v.string()),  // Semaphore nullifier (Phase 5.2)
  opened: v.boolean(),           // Has the commitment been revealed?
  openedData: v.optional(v.any()),    // Revealed allocation data
  createdAt: v.number(),
})
  .index("by_race", ["raceId"])
  .index("by_commitment", ["commitment"]),

// ZK reputation proofs
reputationProofs: defineTable({
  proofHash: v.string(),
  proofType: v.string(),         // "strike_rate_above", "roi_above", etc.
  claim: v.string(),             // "My strike rate is above 35%"
  verified: v.boolean(),
  createdAt: v.number(),
})
  .index("by_hash", ["proofHash"]),
```

### 5.4 Legal Gate

**MUST obtain legal opinion BEFORE this phase goes live.**

Budget: AUD 3-5K from Addisons or Thomson Geer.
Question: Do play-money QV credits with hash commitments fall outside IGA?
Reference: ICLG Gambling Laws Australia 2026 play-money safe harbour.

---

## Phase 6: Synthetic Intelligence

**Duration**: 4-6 weeks
**Dependencies**: Phase 3+ (conviction game working; ZK not required)
**Outcome**: 1,000+ synthetic observers. Personal swarms. Cold start solved.

### 6.1 Synthetic Observer Architecture

Each synthetic observer is:
- An analytical agent with a unique persona (data weightings, specialisations)
- Connected to real data feeds (form guides, track conditions, historical results)
- Participating in the conviction game with real reputation consequences
- Transparently labelled as synthetic

### 6.2 Seven Founding Species

From the Pi-mono × MiroFish synthesis plan:

| Species | Specialisation | Data Sources |
|---------|---------------|-------------|
| Formist | Historical form analysis | Past results, class ratings |
| Trackist | Track condition specialist | Weather, going, rail position |
| Clocker | Speed figure analysis | Sectional times, pace maps |
| Breeder | Bloodline + distance analysis | Pedigree, distance aptitude |
| Jockey | Rider + trainer patterns | Jockey/trainer combos, statistics |
| Contrarian | Finds overlays against consensus | Market odds vs conviction signal divergence |
| Generalist | Balanced multi-factor | All sources, weighted equally |

### 6.3 Personal Swarm Product

Premium tier ($100/mo):
- Punter configures 10-100 synthetic agents tuned to their philosophy
- Swarm produces conviction signals the punter reviews and composes with their own
- Swarm co-evolves through the season (models recalibrate based on accuracy)
- Non-transferable — the switching cost IS the co-evolved intelligence

### 6.4 Ecosystem Seeding

Before human launch:
1. Generate 1,000+ synthetic observers with enforced analytical diversity
2. Run them on historical race data for 3 months (backtesting)
3. Each builds a verifiable track record
4. Humans walk into a living game with active signals and populated leaderboards

---

## Phase 7: B2B Platform

**Duration**: 6-8 weeks
**Dependencies**: Phases 1-4 proven (mechanism works, community exists)
**Outcome**: Bookmakers can deploy branded conviction game communities

### 7.1 Community Boundary Abstraction

```typescript
communities: defineTable({
  name: v.string(),               // "Sportsbet Community"
  brandId: v.string(),            // External brand identifier
  sport: v.string(),              // "horse_racing", "nrl", etc
  config: v.object({
    initialCredits: v.number(),
    seasonLength: v.number(),     // days
    qvEnabled: v.boolean(),
    zkEnabled: v.boolean(),
  }),
  memberCount: v.number(),
  createdAt: v.number(),
})
  .index("by_brand", ["brandId"]),
```

### 7.2 Inter-Community Competition

Same races, different communities. Weekly scorecards:
"Sportsbet's community called 7/10. Ladbrokes got 5."

### 7.3 Meta-Intelligence Layer

Cross-community aggregation visible ONLY to the protocol operator.
Where communities disagree on the same race → that divergence IS the signal.

### 7.4 Go-to-Market: Sportsbet vs Ladbrokes Activation

```
1. Grassroots campaign: "Which bookmaker's punters are smarter?"
2. Punters self-identify bookmaker tribe
3. Conviction game runs head-to-head for 4 weeks
4. Results published weekly (content, drama, tribal identity)
5. Walk into CDO's office with data: "This is what your punters did without you"
```

---

## Milestone Map

```
PHASE 1: Ground Truth Pipeline                          Week 1-2
  ├── 1.1 Deploy Convex                                 Day 1
  ├── 1.2 Implement field scraper                       Week 1
  ├── 1.3 Implement results scraper                     Week 1
  ├── 1.4 Deploy CF Worker                              Week 1
  └── 1.5 Verify end-to-end                             Week 2

PHASE 2: Extraction + Bot Live                          Week 3-4
  ├── 2.1 Verify extraction pipeline                    Week 3
  ├── 2.2 Deploy Matrix bot                             Week 3
  ├── 2.3 End-to-end test                               Week 3-4
  └── 2.4 WhatsApp onramp                               Week 4

PHASE 3: Conviction Game v1 (Transparent QV)            Week 5-8
  ├── 3.1 Schema evolution                              Week 5
  ├── 3.2 QV cost engine                                Week 5
  ├── 3.3 Settlement engine                             Week 5-6
  ├── 3.4 Bot commands                                  Week 6
  ├── 3.5 Phase loop (allocation → lock → settle)       Week 6-7
  ├── 3.6 Credit economics                              Week 7
  └── 3.7 Verification                                  Week 7-8

PHASE 4: Social Deduction Layer                         Week 9-11
  ├── 4.1 Forensic pattern detection                    Week 9
  ├── 4.2 Conviction reveal system                      Week 9
  ├── 4.3 Reputation decay                              Week 10
  └── 4.4 Discussion facilitation                       Week 10-11

PHASE 5: ZK Privacy Layer                               Week 12-17
  ├── 5.1 Technology selection + legal opinion           Week 12-13
  ├── 5.2 Hash commitment scheme                        Week 13-14
  ├── 5.3 Semaphore anonymous membership                Week 14-15
  ├── 5.4 MACI anti-collusion                           Week 15-17
  └── 5.5 Custom reputation circuits                    Week 16-17

PHASE 6: Synthetic Intelligence                         Week 12-17 (parallel with Phase 5)
  ├── 6.1 Synthetic observer architecture               Week 12-13
  ├── 6.2 Seven founding species                        Week 13-14
  ├── 6.3 Personal swarm product                        Week 14-16
  └── 6.4 Ecosystem seeding (backtest)                  Week 15-17

PHASE 7: B2B Platform                                   Week 18-25
  ├── 7.1 Community boundary abstraction                Week 18-19
  ├── 7.2 Inter-community competition                   Week 20-21
  ├── 7.3 Meta-intelligence layer                       Week 22-23
  └── 7.4 Sportsbet vs Ladbrokes activation             Week 24-25
```

---

## Revenue Checkpoints

| Phase | Revenue Source | Expected MRR |
|-------|--------------|-------------|
| Phase 2 | Matrix subscriptions ($25/mo) | AUD 100-500 |
| Phase 3 | Conviction game premium access | AUD 500-2,000 |
| Phase 4 | Full game experience + WhatsApp onramp | AUD 2,000-5,000 |
| Phase 6 | Personal swarms ($100/mo premium) | AUD 5,000-15,000 |
| Phase 7 | B2B community licensing | AUD 15,000+ |

**Break-even at 4 paying users** (Phase 2). Infrastructure costs: AUD 22-100/month.

---

## Regulatory Gates (Hard Blockers)

| Gate | When | Cost | Status |
|------|------|------|--------|
| Racing Australia data agreement | Before Phase 2 launch | AUD 5-15K/year | Not started |
| Gambling law legal opinion | Before Phase 5 | AUD 3-5K | Not started |
| Element AGPL compliance | Before Phase 2 | Free (publish source) or paid (Build subscription) | Not started |

---

## Tech Stack (Final)

| Layer | Technology | Status |
|-------|-----------|--------|
| Data | Convex | Schema complete, not deployed |
| Intelligence | Anthropic API (direct, with tool use) | Agent complete |
| Interface | Matrix (matrix-bot-sdk) | Bot complete, not deployed |
| Scraping | Cloudflare Workers | Skeleton complete, stubs |
| WhatsApp | mautrix-whatsapp bridge | Not started |
| QV Engine | Pure TypeScript (packages/shared) | Not started |
| ZK | Semaphore v4 + MACI v2 + Circom | Research complete, not started |
| On-chain | Base L2 (for commitment storage only) | Not started |
| Hosting | Convex Cloud + Cloudflare + Hostinger VPS | Existing infra |

---

## What to Build First (This Week)

```
Day 1:  Deploy Convex (5 min)
Day 1:  Investigate racenet.com.au data sources (API vs scraping)
Day 2:  Implement scrapeFields()
Day 3:  Implement scrapeResults()
Day 4:  Deploy CF Worker, verify data flowing
Day 5:  Test extraction pipeline with real tip sheets against live data
Day 6:  Deploy Matrix bot on VPS
Day 7:  End-to-end: image in → intelligence out → results settle → stats update
```

After this week, you have a working tip intelligence platform.
After Phase 3 (week 8), you have The Conviction Game.

---

## The Formula (From RSW)

> **Collective intelligence emerges from private conviction under quadratic cost, verified against ground truth, in a system where honest coordination is frictionless and dishonest coordination is cryptographically hard.**

Phase 1 gives you **ground truth**.
Phase 2 gives you **intelligence**.
Phase 3 gives you **conviction under quadratic cost**.
Phase 4 gives you **honest coordination** (frictionless forensics + discussion).
Phase 5 gives you **dishonest coordination is cryptographically hard**.
Phase 6 gives you **collective** (human + synthetic hybrid intelligence).
Phase 7 gives you **the platform**.

Each word in the formula maps to a phase. Build them in order.
