# TipAnalyser v2 — Handoff

**Status:** production-ready. The extraction tool is feature-complete,
hardened, green, and builds a deployable artifact. One external input
(a Perplexity API key) and the deploy/DNS steps are Pete's ball.

**Date:** 2026-05-16

---

## The line — what is "done"

The **extraction tool** = `@tta/web` + `@tta/shared` + `@tta/convex`.
That is what Pete uses on thetipanalyser.com. It is done:

| Gate | Result |
|---|---|
| `@tta/shared` tests | **79 / 79 pass** |
| `@tta/shared` typecheck | clean |
| `@tta/convex` typecheck | clean |
| `@tta/web` svelte-check | **0 errors, 0 warnings** (438 files) |
| `@tta/web` unit tests | **11 / 11 pass** |
| `@tta/web` production build | clean (Cloudflare adapter) |

### What shipped this sprint

1. **Authoritative field resolution (Perplexity).** The real fix for the
   4-month complaint. Before aggregating, the tool resolves the official
   acceptance field (saddlecloth #, horse, jockey, trainer, barrier,
   scratched) for the meeting via the Perplexity API (web-grounded,
   cited, domain- and date-filtered to racenet/racing.com/punters), and
   caches it in Convex (`meetings`/`races`/`horses`). Replaces the
   deleted, brittle racenet HTML scraper.
   - `packages/convex/convex/fieldResolution.ts` — resolver action
   - `packages/web/src/routes/api/resolve-field/+server.ts` — API
   - `packages/shared/src/fieldMatch.ts` — pure matcher (18 tests)
2. **Tip-name anchoring.** Extracted tips are fuzzy-matched (normalise →
   token-set → Jaro-Winkler with an ambiguity guard) to the real
   runner, canonicalised to the official name + number, enriched with
   jockey/trainer/barrier. **This kills the "xxxxCall Me Gorgeous"
   duplicate-row class anchored to ground truth** — duplicate rows that
   resolve to one runner are merged.
3. **Non-destructive overlay.** A tip is never deleted by the field.
   No-match → kept + `unmatched_runner` flag. Matched-to-scratched →
   kept + `tip_on_scratched` flag. Ordering: agent ground truth → field
   canonicalisation → Pete's manual patches (human override always wins).
4. **Graceful degradation.** No key / field not published / resolver
   down → the workspace shows "field unavailable" and behaves exactly
   as before (tip-only aggregation). Field resolution never blocks
   extraction.
5. **Workspace UI.** Per-meeting field-status chip, manual
   "resolve/refresh field" button (forces a fresh pull for late
   scratchings), field-flag panel, cited sources, and an opt-in
   "+ field cols" CSV toggle (Jockey/Trainer/Barrier appended — **v0
   column order byte-for-byte preserved when off**).
6. **Hardening (real audit bugs):**
   - `categoriseError` now maps Anthropic `APIError` 429/413/401/5xx
     correctly (rate limits were silently non-retried before).
   - Share tokens use `crypto.getRandomValues` (was `Math.random`).
   - `/api/extract` rejects > 8 MB images with a clean 413 before
     calling Anthropic.
   - The 80-line streaming JSON parser extracted to
     `$lib/reasoningEmitter.ts` and unit-tested (11 cases).
7. **Dead weight removed.** Deleted `packages/scraper` (pure stub) and
   the racenet `cfBrowserScraper.ts`/`scraping.ts`; emptied `crons.ts`
   (field resolution is on-demand). Fixed the Convex tsconfig so the
   package typechecks clean.

---

## Pete's ball (not done — by design, needs him)

| Need | Why it's his | Effort |
|---|---|---|
| **`PERPLEXITY_API_KEY`** | His account/billing. Set as a Cloudflare Pages env var (and a Convex env var — the action reads `process.env.PERPLEXITY_API_KEY`). Until set, field resolution degrades cleanly. | 5 min |
| **Deploy** | Outward-facing; not auto-run. Commands below. | 10 min |
| **DNS on thetipanalyser.com** | He owns the domain (CNAME/A swap). See `CUTOVER-PLAN.md`. | 5 min |
| **Auth** | Confirmed out of scope — single-user, Pete only. `clientId` localStorage stays. If he ever wants multi-user, that's a new project. | — |
| **Convex prod tier** | Dev tier is ample for his volume. Only worth the prod deploy when migrating v0 customers. | 30 min |

### Known scoped-out: `@tta/agent` / `@tta/matrix-bot`

These are the **Matrix-bot surface (Stage 2), not the extraction tool**.
They have **pre-existing** typecheck debt (no `@types/node`; a Node CLI
that never typechecked — predates this sprint, confirmed on clean
checkout). Deliberately not fixed: the mandate was the extraction tool,
not gold-plating a surface Pete doesn't use. To green them later:
`pnpm --filter @tta/agent add -D @types/node` + add `"types":["node"]`,
`lib:["ES2022","DOM"]` to their tsconfigs + one param annotation.

---

## Deploy (Pete / when ready)

```bash
# 1. Build
pnpm --filter @tta/web build

# 2. Deploy Convex (dev tier is fine)
pnpm --filter @tta/convex exec npx convex deploy   # or: dev

# 3. Set the Perplexity key (Cloudflare Pages + Convex)
#    Pages: dashboard → tta-pete-demo → Settings → Env vars (secret)
#    Convex: npx convex env set PERPLEXITY_API_KEY <key>
#    Also confirm: ANTHROPIC_API_KEY, CONVEX_URL already set.

# 4. Deploy Pages
pnpm --filter @tta/web exec wrangler pages deploy .svelte-kit/cloudflare
```

## Live verification (the regression that matters)

1. Open `/workspace`, drop the 24-Apr Pete fixture (`demo-fixtures/`).
2. Watch reasoning stream → extraction lands in a meeting card.
3. Field chip flips `resolving… → field ✓ <time>` (with `PERPLEXITY_API_KEY`).
4. **Confirm "Call Me Gorgeous" is one row at the official saddlecloth #
   in R4** — not split by the `xx`-prefix OCR noise.
5. Any scratched/unmatched tips appear in the field-flag panel with
   cited sources.
6. CSV without "+ field cols" = identical to v0 layout; with it =
   3 appended columns.
7. Without the key: chip shows "field unavailable · Perplexity key not
   configured" and aggregation still works (degrade path).

---

## Architecture note

`buildMeetingGroups(rows, corrections, fields)` is the single pipeline:
`aggregateRaces` → `applyFieldMatch` (per-race `matchField`) →
`applyPatches`. `matchField` is pure and exhaustively unit-tested — the
correctness-critical logic has zero network and full coverage. The
resolver action **never throws**; a miss is a normal returned state.
