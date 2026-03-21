# TTA Matrix — Project Brief

## Product

A **paid community platform** for horse racing tip aggregation and intelligence.
Regenerating a previously active community. Mobile-first.

## Business Model

- Commercial paid subscription
- Target: Australian punters
- Community was active years ago, rebuilding it with better tooling

## User Surface

**Whitelabelled Hyprsphere Matrix client** (forked Element X Android).
Same rebrand playbook as `com.hyprsphere.chat` — new identity, icon, palette
for TTA. Punters download "The TipAnalyser" app. They never know it's Matrix.

Prior art: `~/element-x-android/` (Hyprsphere fork, full rebrand complete).
Repo: `domocarroll/element-x-android`.

Key: "download the app" onboarding, not "join this Matrix server."

## Racing Scope

- **Codes**: Thoroughbred (primary). Harness + greyhounds TBD.
- **States**: All Australia
  - SR = Sydney Racing
  - MR = Melbourne Racing
  - BR = Brisbane Racing
  - PR = Perth Racing
  - AR = Adelaide Racing
  - OR = Other Racing
- **Scale**: 1-10 races per meeting, multiple meetings per day

## Tip Sources

Proven in v0 — four input types:
1. **Newspaper tip grids** — tipsters as columns, races as rows (most common)
2. **Magazine/book format** — grouped by race, horse names + TAB numbers
3. **Full race cards** — complex layout with silks, form, track details
4. **Full form pages** — multi-source columns (SMH, Racing NSW, Sky Racing)

Sources: newspapers (Daily Telegraph, Herald Sun), magazines (Winning Post),
web, television (Sky Racing screenshots).

Test images at: `~/v0-thetipanalyser/e2e/fixtures/images/`

## Architecture

```
Cloudflare Worker (cron) ──scrape──► racenet.com.au
         │
         ▼
      CONVEX (ground truth)
    meetings│races│horses│tips│tipsters
         ▲                    ▲
         │                    │
  results scraper        Claude Agent SDK
  (auto-close loop)      (vision extraction)
         ▲                    ▲
         │                    │
      Cloudflare Worker    Matrix Bot
      (results cron)      (@tipbot)
                              ▲
                              │
                     MATRIX SPACE (subfrac.cloud)
                     #tips #results #leaderboard #general
```

## Tech Stack

- **Language**: TypeScript (entire stack)
- **Data**: Convex (new project)
- **Intelligence**: Claude Agent SDK
- **Scraping**: Cloudflare Workers + Browser Rendering API (free tier)
- **Interface**: Matrix (existing Synapse on Hostinger VPS)
- **Repo**: Monorepo at `~/tta-matrix/`
- **Secrets**: `.env` files

## Monorepo Structure

```
tta-matrix/
  packages/
    convex/           — schema, mutations, queries, actions
    agent/            — Claude Agent SDK bot + tools
    scraper/          — Cloudflare Worker (fields + results)
    matrix-bot/       — Matrix integration (matrix-bot-sdk)
    shared/           — types, utils, domain constants
  .env                — secrets
  package.json        — workspace root
  tsconfig.base.json  — shared TS config
```

## Milestones

```
M0: Foundation          — Convex schema + Claude Agent SDK core
M1: Race Data Pipeline  — Cloudflare Worker scrapes all AU races → Convex
M2: Matrix Bot          — Bot in channel, processes images, responds to commands
M3: Tip Matching        — Tips matched against pre-populated horse data
M4: Intelligence        — Weighted aggregation + tipster stats + feedback loop
M5: Prediction Market   — Play-money market per race + leaderboard (parked)
M6: ZK Reputation       — Anonymous identity + provable track records (parked)
M7: Polish              — Pre-race summaries, web dashboard, notifications
```

## MVP Target

Full leaderboard and intelligence layer. Client drops a tip sheet image
in the Matrix channel → bot extracts → matches against pre-populated race data →
aggregates with weighted tipster reliability → posts structured results.
Race results auto-scraped → tipster stats auto-updated → leaderboard reflects
ground truth.

## Infrastructure

- **Synapse**: Existing instance on Hostinger VPS (huly.subfrac.cloud)
- **Cloudflare**: Existing account (free plan sufficient)
- **Convex**: New project under existing org
- **VPS**: Hostinger — SSH: `ssh -i ~/.ssh/hostinger_vps root@76.13.16.225`

## Prior Art

- `~/v0-thetipanalyser/` — Current v0 (Next.js + Gemini, stateless, Vercel)
- `~/tipanalyser/` — Python backend (older)
- `~/tipanalyserLM/` — SurrealDB experiment
- `~/tip-ocr-ts/` — TS OCR experiment
- `~/tac/` — Multiple OCR iterations
- Extraction prompts, resilience patterns, error handling all proven in v0
