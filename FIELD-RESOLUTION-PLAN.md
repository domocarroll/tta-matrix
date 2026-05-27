# Sprint Plan · Perplexity Field Resolution → Production-Done

**Goal:** anchor tip aggregation to the authoritative race field (horse #, name,
jockey, trainer, barrier, scratched) via Perplexity API, harden the real bugs,
delete dead weight, write one handoff doc. Then hands off.

**Scope guardrails (confirmed with Dom):**
- Single-user, Pete only. **No auth.** Out.
- Out: results scraping, auto-settlement, tipster scores, leaderboard,
  multi-tenant, image storage, prod-Convex migration (all Stage 2 / Pete's).
- In: field resolution, the hardening bundle, dead-scraper removal, handoff.

---

## Phase 1 · Field Resolver (Perplexity → Convex cache)

`packages/convex/convex/fieldResolution.ts` — a Convex action.

- Input: `{ date, meetingName, category }` (Claude already extracts these;
  meetingKey = `${date}|${category}|${meeting}`).
- Cache check: `meetings` by `by_date_name` → `races` → `horses`. Hit → return.
- Miss → Perplexity `sonar-pro`:
  - endpoint `https://api.perplexity.ai/chat/completions`, Bearer
    `PERPLEXITY_API_KEY`.
  - `response_format: json_schema` — races[] → runners[]
    `{ number, name, jockey, trainer, barrier, scratched }`.
  - `search_domain_filter: ["racenet.com.au","racing.com","punters.com.au"]`,
    `search_after_date_filter`/`search_before_date_filter` pinned ±1 day of
    meeting date.
  - 45s timeout (cold schema delay), jsonrepair fallback (already a dep),
    validate runner count sane, capture `citations` + `fetchedAt`.
- Persist into existing `meetings`/`races`/`horses` tables. Add `fieldSource`
  + `fieldFetchedAt` + `fieldCitations` to `meetings` (additive schema, no
  migration risk — all optional).
- No key / API fail / low confidence → return `{ resolved:false, reason }`.
  Never throws to caller.

## Phase 2 · Field Matcher (pure, fully tested)

`packages/shared/src/fieldMatch.ts` — zero network, 100% unit-testable.

- `matchField(aggregatedRace, fieldRunners)` → enriched race + flags.
- Per extracted horse: normalise → token overlap → Jaro-Winkler threshold to a
  field runner.
  - Confident match → canonical official name, authoritative saddlecloth #,
    attach jockey/trainer/barrier. (This is the xx-prefix / dup-row killer,
    anchored.)
  - No match → keep verbatim, flag `unmatched_runner` (advisory).
  - Matched runner `scratched` → flag `tip_on_scratched`.
- **Non-destructive:** never drops a tip; only canonicalises + annotates.
  Original name preserved for the reasoning/audit trail.
- Unit tests: exact, xx-prefix, misspelling, scratched, missing runner,
  ambiguous near-tie (must NOT auto-merge), empty field (degrade), unicode.

## Phase 3 · Wire into workspace (non-destructive overlay)

- `buildMeetingGroups` / aggregation flow: after `aggregateRaces`, if field
  resolved, run `matchField` per race before corrections overlay applies.
- `/workspace` MeetingCard: field status chip — `field ✓ {sources} ·
  {fetchedAt}` or `field unavailable — tip-only`. Existing flags strip shows
  scratched/unmatched.
- "Resolve field" manual button per meeting (so Pete can refetch if a late
  scratching matters). Idempotent, re-caches.
- CSV/JSON export: jockey/trainer/barrier as **optional** columns; v0 CSV
  schema stays the default shape.

## Phase 4 · Hardening bundle (real bugs found in audit)

- `packages/shared/src/errors.ts`: `categoriseError` handles Anthropic
  `APIError` (status 429/413/401) — currently falls through to UNKNOWN so rate
  limits aren't retried. + test.
- `packages/convex/convex/snapshots.ts`: share token →
  `crypto.getRandomValues`, not `Math.random`.
- `/api/extract`: reject image > N MB before calling Anthropic (clean 413
  surface) + size in error category.
- `makeReasoningEmitter` (the untested 80-line streaming JSON parser): extract
  to `packages/web/src/lib/reasoningEmitter.ts`, unit test escape/partial/
  malformed cases.

## Phase 5 · Delete dead weight + green build

- Remove `packages/scraper` entirely (Perplexity supersedes the racenet
  scraper; it was pure stub). Drop from `pnpm-workspace.yaml`, scraper cron
  config. Kills both `TODO` stubs.
- Fix remaining `pnpm typecheck` red: `packages/convex` `cfBrowserScraper.ts` /
  `http.ts` / `scraping.ts` — these were scraper-support; delete the ones only
  the scraper used, add proper lib types (`webworker`) to convex tsconfig for
  any genuinely-needed Convex HTTP actions.
- Green gate: `pnpm -r test` ✓, `pnpm -r typecheck` ✓, `pnpm check` ✓,
  `pnpm -r build` ✓.

## Phase 6 · Verify live + handoff

- Deploy to `tta-pete-demo.pages.dev`, set `PERPLEXITY_API_KEY` Pages secret.
- E2E on prod (agent-browser): drop the 24-Apr Pete fixture → extraction
  streams → field resolves → "Call Me Gorgeous" anchored to real saddlecloth #
  in R4 (the canonical regression) → scratched flag if any → CSV/JSON/share.
- `HANDOFF.md`: what's done, the exact line, what's Pete's ball (DNS, prod
  Convex tier, supplying his Perplexity key, any auth if he ever wants
  multi-user). One page. The "we went above and beyond, here it is" doc.

---

## Sequencing / commits

Atomic conventional commits per phase. Phases 1–2 parallelisable (resolver vs
pure matcher). 3 depends on 1+2. 4–5 independent, can interleave. 6 last.

## Risks

| Risk | Mitigation |
|---|---|
| Perplexity wrong runner | citations surfaced, count-validated, advisory-only, Pete can refetch |
| Race-morning scratching | manual refetch button + `scratched` flag, never auto-delete |
| No PERPLEXITY_API_KEY | graceful degrade to tip-only (today's behaviour) |
| Scraper deletion breaks convex import | grep all refs first; convex `horses`/`races` tables stay |
| Cold schema 10-30s latency | 45s timeout, per-meeting cache, async with status chip |
