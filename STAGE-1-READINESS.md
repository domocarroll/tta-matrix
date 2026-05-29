# Stage 1 · Readiness

**Goal:** drop-in v0 replacement on `thetipanalyser.com` — same upload UX,
agentic backend, plus persistent per-customer history AND Pete's full
Friday workflow (multi-image, multi-meeting aggregation, edit-then-export).

**Date:** 2026-05-29
**Live at:** https://tta-pete-demo.pages.dev/ (production)
**Front door:** `/work` (3-Gate workspace). `/classic` stays as rollback escape.

## 3-Gate workspace cutover (2026-05-29)

Pete's mental model "set the rules first, then play the game" encoded as
three approval gates:

| Gate | Action | Output |
|---|---|---|
| ① field | Create meeting · upload official cards · review · approve | LOCKED FIELD |
| ② tips | Drop tip sheets · server post-routes to locked meetings | Routed / pending tips |
| ③ review | ClassicMeetingCard per meeting · quaddie/trif/F4 · edit · export | Customer payload |

**Load-bearing rule:** tips cannot land in an unlocked meeting. Enforced
server-side in `extractions.create` — locked meetings matched by
`(category, normalised-name)` not date, so Friday-extracted tips
correctly route to Saturday-locked meetings.

Tests added: 41 (routeExtraction · meetingState · inferCustomerMeetings ·
threeGateInvariant). 120 → 125 shared tests pass.

---

## What's done (no Pete cooperation required)

### Single-shot agent surface (`/`)

| Capability | Status | Where |
|---|---|---|
| Agentic image extraction | ✅ live | `/` (drop image, watch reason) |
| Streaming reasoning trace | ✅ live | server: `api/extract/+server.ts` |
| Cached replay fallback (`?cached=pete-24apr`) | ✅ live | demo safety net |
| v0 comparison panel | ✅ live | bottom of `/` |

### Friday workspace (`/workspace`) — v0 production parity

| Capability | Status | Where |
|---|---|---|
| Multi-image queue (drop N images, sequential process, cancel/retry per file) | ✅ live | `/workspace` |
| Auto-grouping by `(date, category, meeting)` — many meetings in one session | ✅ live | shared/workspace.ts |
| Per-meeting aggregation — totalTips, tipsterCount, tipster%, win/2nd/3rd/4th | ✅ live | shared/aggregation.ts |
| Quaddie · Trifecta · First Four cards | ✅ live | components/SpecialBets.svelte |
| **Inline review/edit** — rename horse, fix horse number, remove erroneous row | ✅ live | components/AggregationTable.svelte |
| Corrections persisted as overlay (preserves agent ground truth) | ✅ live | convex/corrections.ts |
| Display label + customer notes per meeting | ✅ live | meeting card meta editor |
| **CSV export** (v0 schema columns) | ✅ live | shared/csv.ts |
| **JSON export** (full aggregation incl. quaddie) | ✅ live | meeting card |
| **Share link** — public read-only `/share/<token>` snapshot | ✅ live | convex/snapshots.ts |
| Retry with exp backoff + jitter on transient errors | ✅ live | extractionRunner.ts |
| Refusal detection (port from v0) | ✅ live | shared/extraction.ts |
| Error categorisation (rate limit, parse, network, refusal, etc.) | ✅ live | shared/errors.ts |
| Persist failure surfaced to queue UI | ✅ live | workspace/+page.svelte |

### History (`/history`)

| Capability | Status | Where |
|---|---|---|
| Per-customer extraction history | ✅ live | `/history` |
| Detail view with reasoning + flags + races | ✅ live | `/history/[id]` |
| Per-row delete | ✅ live | history list |
| Stats strip (extractions, selections, flags) | ✅ live | history list |

### Infrastructure

| Capability | Status | Where |
|---|---|---|
| Convex schema (extractions, meetingCorrections, meetingSnapshots) | ✅ deployed | `dev:ardent-hound-725` |
| `clientId` localStorage identity | ✅ live | bridge to real auth |
| Cloudflare Pages deployment | ✅ live | `tta-pete-demo.pages.dev` |
| ANTHROPIC_API_KEY + CONVEX_URL secrets | ✅ set | wrangler pages secrets |

End-to-end verified on prod URL: drop fixture → 54 reasoning steps stream →
extraction lands in workspace → 8 races aggregated, xx-prefix dedup correct
(Call Me Gorgeous = 5/83% in R4, not split) → Quaddie/Trifecta/First Four
computed → CSV / JSON downloaded → share link minted → public `/share/<token>`
renders the customer-facing read-only view.

---

## What v0 had that we now match

| v0 feature | v2 status |
|---|---|
| Single-image upload | ✅ `/` |
| Multi-image batch | ✅ `/workspace` (queue) |
| Per-race aggregation across tipsters | ✅ aggregation table |
| Quaddie / Trifecta / First Four | ✅ special bets cards |
| Review/edit aggregated tips before export | ✅ inline edit + corrections overlay |
| CSV export | ✅ v0-compatible schema |
| JSON export | ✅ |
| URL share | ✅ `/share/<token>` |
| Refusal detection + retry | ✅ |
| Error categorisation | ✅ |

---

## What's blocked on Pete

| Need | Why | Time once unblocked |
|---|---|---|
| **DNS access to `thetipanalyser.com`** | Cutover requires CNAME or A-record swap | 5 min |
| **Customer list / data export from v0** | Migrate existing customer histories so they don't lose anything | 2-3 hours of script work + a soak |
| **Decision on auth provider** | Convex Auth (free) vs Clerk (paid, polished) vs custom email-OTP | 4-8 hours to implement + test |
| **Decision on cutover style** | Hard cutover with rollback OR side-by-side soak (`old.thetipanalyser.com` + `thetipanalyser.com`) | depends on choice |
| **Convex prod deploy decision** | Currently on Convex `dev` tier. Stage 1 stays on dev (free, ample headroom). Prod tier ($25/mo) unlocks higher limits and is a separate deployment with empty data — only worth it once ready to migrate v0 customers. | 30 min once decided |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `clientId` collision (two browsers, same UUID) | Vanishing low (random 122-bit) | Customer sees someone else's history | Real auth before public launch |
| Pete's customers lose history at cutover | Medium | Trust hit | Side-by-side soak + migration script |
| Cloudflare Workers timeout on long extractions | Low (verified at 114s on paid plan) | One extraction fails; user retries | Already streams; 5-minute paid plan ceiling |
| Anthropic rate limit at peak load (Sat morning) | Medium | Slow extractions | Sequential queue already throttles; add per-IP cap if needed |
| Convex free tier quota exhausted | Low (massive headroom for v0 audience) | Read errors | Upgrade plan ($25/mo) |
| Pete edits aggregation, refresh loses edits | None | None | Edits persisted to Convex meetingCorrections immediately |
| Share link leaks sensitive data | Low (tip sheets are public publications) | Privacy concern | Document retention policy; tokens are 22-char random |
| Image PII in extractions | Low | Privacy | `delete` UX exists; add retention cron later |
| Domain ownership of `tta-pete-demo.pages.dev` | None | None | Custom domain swap is reversible |

---

## Stage 1 → Stage 2 roadmap

Once Stage 1 is live on his domain and his customers are migrated:

| Step | Description | Estimate |
|---|---|---|
| Real auth swap | Replace `clientId` localStorage with Convex Auth or Clerk; migrate existing rows | 1-2 days |
| Image storage | Wire Convex `_storage`; update detail view to render saved images | 0.5 day |
| Race-fields scraper | Convex action + cron pulling racenet.com.au or similar nightly | 3-5 days |
| Race-results scraper + auto-settlement | Wire to existing `races.recordResult` mutation | 3-4 days |
| Tipster reliability scores live | Already coded in `tipsters.ts`; just needs settlement signal | 1 day |
| Public leaderboard | New `/leaderboard` SvelteKit route | 3 days |

Total Stage 2: **~3 weeks** of focused work.

---

## What to show Pete

Same pitch but with a complete Friday demo:

1. Open `https://tta-pete-demo.pages.dev/workspace` on the call
2. Drop the morning's tip sheets (multiple, multiple meetings)
3. Watch each one stream reasoning live
4. Watch them group into per-meeting cards as they land
5. Open one card, walk the aggregation table
6. Edit a horse name (e.g. fix a typo) — show that special bets recompute
7. Download the CSV — same shape his customers already get
8. Click "Copy share link" — open the public URL in a new tab — show the read-only customer view
9. Refresh the workspace — corrections still there

The diff vs v0:
- v0: stateless single-pass; corrupts data on edge cases (xx-prefix bug)
- v2: agentic, reasons through edge cases, persists to history, AND
  surfaces every customer-facing feature he already runs (review, export, share)

He doesn't need to give up anything. He gets the same workflow on a system
that won't keep silently corrupting tip sheets every other Saturday.
