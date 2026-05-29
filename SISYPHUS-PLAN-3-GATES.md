# Sisyphus Plan — 3-Gate Workflow

**Mandate:** rebuild the TipAnalyser workspace as Pete Blackburn's 3-gate
workflow. Gate 1 locks the field. Gate 2 ingests tips. Gate 3 reviews +
exports. **A tip cannot land in an unlocked meeting.** That invariant
drives every design decision below.

**Context owner:** read this entire document before any work. Then read
`HANDOFF.md`, `STAGE-1-READINESS.md`, and skim `packages/web/src/lib/workspace.ts`,
`packages/shared/src/fieldMatch.ts`, `packages/convex/convex/schema.ts`.

**Target:** ready for Pete's next call (~7 days). Quality bar:
production-deployable, green `typecheck` + `test` at every phase
checkpoint, no regressions in `/classic` or `/workspace` until the
new surface flips.

---

## 1 · Why 3 gates

Today's flow lets tips arrive before the field is set. Result: extractions
hit an empty/Perplexity-guessed field, every horse flags as unmatched,
Pete sees a broken-looking meeting card and has to upload cards
*after* to retro-anchor. We saw this fail live today — 66 unmatched
runners on the 24-Apr fixture because the field belonged to a different
date.

Pete's mental model is "set the rules first, then play the game." Gates
encode that:

```
GATE 1 · FIELD          GATE 2 · TIPS            GATE 3 · REVIEW
─────────────           ─────────────            ─────────────
precondition:           precondition:            precondition:
  meeting created         meeting locked           tips routed
action:                 action:                  action:
  upload cards            drop tip sheets          aggregate
  review every runner     extraction anchors       quaddie/trif/F4
  mark scratchings        live to locked field     edit overrides
  APPROVE                 unmatched surfaces       EXPORT / SHARE
output:                 output:                  output:
  LOCKED FIELD            routed tip-set           customer payload
source of truth:        source of truth:         source of truth:
  Pete's approval         tipster sheet +          locked field +
                          locked field             intake + patches
```

Three approvals → three handover points → three debug surfaces.
Failure at Gate 3 drills back to Gate 2 (tip read wrong?) → Gate 1
(field wrong?).

---

## 2 · Load-bearing invariant

**Tips cannot land in an unlocked meeting.**

Enforced server-side in `/api/persist`:

- Extraction returns `{ meeting, category, date-implied-by-creationTime }`
  → derive `meetingKey`
- Look up `customerMeetings.findByKey(clientId, meetingKey)`
- If row exists AND `state === 'locked'` → persist with
  `state: 'routed'`
- Else → persist with `state: 'pending-meeting'` + populate
  `pendingReason` so the Gate 2 UI can offer Pete a one-click jump to
  Gate 1 to fix it

This single rule cascades everything good — no false flags, no
retroactive re-anchor, no "did I upload cards yet" puzzle. Late
scratchings are handled by inline edit of the locked field (no unlock
required) — locked means "shape is set", scratchings are a small
overlay.

---

## 3 · Schema additions (additive only — no migrations)

### `customerMeetings` (new)

```ts
customerMeetings: defineTable({
  clientId: v.string(),
  meetingKey: v.string(),            // "YYYY-MM-DD|CAT|name"
  date: v.string(),                  // duplicated for cheap querying
  category: v.string(),
  name: v.string(),
  state: v.union(
    v.literal('draft'),              // created, no cards yet
    v.literal('cards-pending'),      // card images uploaded, extracting/awaiting review
    v.literal('locked'),             // userFields row exists + Pete approved
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_client_meeting', ['clientId', 'meetingKey'])
  .index('by_client_date', ['clientId', 'date'])
```

### `extractions` (extend — optional fields, no migration)

```ts
// Append to existing extractions defineTable:
state: v.optional(
  v.union(v.literal('routed'), v.literal('pending-meeting'))
),
pendingReason: v.optional(v.string()),  // e.g. "no_locked_meeting_for_key"
```

Missing/legacy rows = `state === undefined` → treat as `routed` (back-compat).

### `userFields` (no change — already exists from today)

Continues to store approved field per `(clientId, meetingKey)`. Existence
+ `approvedAt` IS the lock. `customerMeetings.state === 'locked'` is a
denormalized index of that — set it explicitly when the userFields row
is written.

---

## 4 · Architecture decisions

| decision | choice | why |
|---|---|---|
| Reuse `meetings` table? | No — new `customerMeetings` | Existing `meetings` is for Stage-2 scraper data, different blast radius. Additive is safer. |
| Tip routing model | Post-route (server-side after extraction) | One global Gate-2 dropzone supports multi-meeting sheets cleanly. Per-meeting dropzones don't scale. |
| Extraction-time anchoring | Pure-function `routeExtraction(extracted, lockedMeetings)` | Deterministic, fully testable, zero network. |
| Late scratching workflow | Inline patch on locked field, no unlock | Lock = shape; scratchings are overlay. Faster Pete UX. |
| Unlock semantics | Allowed but rare; re-anchors tips automatically | `userFields` row removed → state flips → tips re-route on next derive. |
| Page strategy | Build new at `/work`, flip `/` redirect when green | `/classic` and `/workspace` keep working through build. Zero downtime. |
| Demo continuity | `/classic` stays untouched until `/work` is green + verified | Pete can always show the current site. |
| Tests | Existing 79 shared + 11 web must stay green at every checkpoint | Non-negotiable. New code adds its own coverage. |

---

## 5 · Phase breakdown

### Phase A · Backend schema + endpoints

Sequential. A6 can parallel after A1+A2.

- **A1** Add `customerMeetings` table to `packages/convex/convex/schema.ts`
  with indices above. Run `npx convex dev --once` to deploy schema to dev.
- **A2** Create `packages/convex/convex/customerMeetings.ts` with:
  - `create({clientId, date, category, name})` → returns `{meetingKey, id}`
  - `listForClient({clientId, sinceMs?})` → all customerMeetings
  - `setState({clientId, meetingKey, state})` mutation
  - `removeForMeeting({clientId, meetingKey})` mutation
- **A3** Extend `extractions` schema with optional `state` + `pendingReason`.
  Deploy to dev.
- **A4** New SvelteKit endpoint `/api/meetings`:
  - `GET ?clientId=` → list
  - `POST` body `{clientId, date, category, name}` → create
  - `PUT` body `{clientId, meetingKey, state}` → setState
  - `DELETE ?clientId=&meetingKey=` → remove (also cascades userFields.removeForMeeting)
- **A5** Modify `/api/persist` to post-route:
  - After extraction success, look up `customerMeetings` by `(clientId, derivedMeetingKey)`
  - If `state === 'locked'` → persist with `state: 'routed'`
  - Else → persist with `state: 'pending-meeting'` + reason
  - Update Convex `extractions.persist` mutation to accept the new fields
- **A6** Backfill mutation `extractions.backfillCustomerMeetings({clientId})`:
  - Group existing extractions by meetingKey
  - For each, upsert customerMeetings row with `state: userField exists ? 'locked' : 'draft'`
  - Idempotent — repeated calls produce no duplicates
  - Trigger on first `/work` page load for a clientId

**Phase A checkpoint:** `pnpm --filter @tta/convex typecheck` green;
new endpoints curl-testable; existing `/classic` extraction flow still
green (extractions land as `state: 'routed'` automatically once
backfill has populated customerMeetings).

### Phase B · Pure logic + tests (parallel with A)

- **B1** `packages/shared/src/routeExtraction.ts`:
  ```ts
  export function routeExtraction(
    extracted: { meeting: string; category: string; date: string },
    lockedMeetings: ReadonlyArray<{ meetingKey: string; date: string; category: string; name: string }>
  ): { meetingKey: string; routed: true } | { routed: false; reason: string }
  ```
  Match logic: normalise (title-case + trim) + exact `(date, category,
  normalisedName)`. No fuzzy at this stage — fail loud, ask Pete.
- **B2** `packages/shared/src/meetingState.ts` — pure state machine:
  - `nextState(current, event)` where events are `'cards-uploaded'`,
    `'cards-extracted'`, `'field-approved'`, `'field-unapproved'`,
    `'cards-removed'`
  - Forbid invalid transitions (e.g. can't go to `locked` without a
    userFields row)
- **B3** Backfill inference pure fn `inferCustomerMeetings(extractions, userFields)`
  → `customerMeetings[]` to upsert. Lets A6 stay a thin wrapper.

Tests for B1, B2, B3 — exhaustive cases (exact match, mismatch, missing
date, scratching transition, etc.). Pure, fast, zero network.

**Phase B checkpoint:** `pnpm --filter @tta/shared test` adds ~30
tests, all green. `typecheck` green.

### Phase C · UI components (mostly parallel)

Each component owns its file, no cross-component state — the page
wires them together in Phase D.

- **C1** `packages/web/src/lib/components/work/GateOneMeetings.svelte`
  + `MeetingRow.svelte` + `NewMeetingModal.svelte`:
  - GateOne renders header strip ("Lock meetings · 2 of 3 locked") + list
  - MeetingRow shows state chip + actions: "edit field", "approve",
    "unlock", "delete"
  - NewMeetingModal: form (date / category / venue name) → submit →
    create meeting → immediately open card upload (reuse current
    `RaceCardUploadModal` logic but inlined as a step)
  - Approve = POST to `/api/user-fields` (existing) + PUT
    `/api/meetings` setState `locked`

- **C2** `packages/web/src/lib/components/work/GateTwoTipIntake.svelte`
  + `PendingTipRow.svelte` + `RoutedTipRow.svelte`:
  - Global dropzone "drop tip sheets" (disabled with copy if no
    locked meetings)
  - Queue rows during extraction (reuse `QueueRow.svelte`)
  - After extraction, the persist API returns `{state, meetingKey?, pendingReason?}`
  - Routed → tick + jump-link to that meeting in Gate 3
  - Pending → amber row "looks like 'Royal Hobart' — no meeting locked.
    [Create + lock now →]" jumps to Gate 1 with prefilled name

- **C3** `packages/web/src/lib/components/work/GateThreeReview.svelte`:
  - Wraps existing `ClassicMeetingCard` per locked-and-populated meeting
  - Empty state copy: "Lock a meeting and drop tip sheets to populate
    review"
  - No logic changes to ClassicMeetingCard — it already does
    aggregation, special bets, edit, export, share

- **C4** `packages/web/src/lib/components/work/GateHeader.svelte`:
  - Strip at top: "Friday 24 May 2026 — ① 2/3 locked · ② 9 tips · ③ 2 ready"
  - Click ① / ② / ③ to scroll to section

Component-level Svelte 5 patterns (runes), Tailwind, mirrors existing
classic-skinned design tokens (`c-fg`, `c-muted`, `c-accent`, etc.).

**Phase C checkpoint:** each component compiles standalone in a Svelte
test harness; visual screenshot via agent-browser on a dev story page;
`svelte-check` zero errors zero warnings.

### Phase D · Page wiring + new route

- **D1** New SvelteKit route `packages/web/src/routes/work/+page.svelte`:
  ```
  <GateHeader ... />
  <GateOneMeetings ... />
  <GateTwoTipIntake ... />
  <GateThreeReview ... />
  ```
- **D2** State at the page level (Svelte runes):
  - `customerMeetings` from `/api/meetings`
  - `userFields` from `/api/user-fields`
  - `extractions` (+ corrections) from `/api/workspace`
  - Derived: `lockedMeetings`, `groupsForGate3`, `pendingTips`
  - `mergedFieldsByKey` (already pattern from today's work) feeds Gate 3
- **D3** Empty / onboarding copy per gate:
  - Gate 1: "No meetings yet. Lock your first meeting to start." [+ new meeting]
  - Gate 2: "Lock at least one meeting in Gate 1 before adding tips." (disabled dropzone)
  - Gate 3: "Lock meetings + add tip sheets to see review surfaces here."

**Phase D checkpoint:** `/work` renders end-to-end with seeded data
(create meeting → upload card → approve → drop tip via fixture → see
in Gate 3 → export CSV). Existing `/classic` untouched.

### Phase E · Backfill + cutover

- **E1** First `/work` load for a clientId triggers
  `extractions.backfillCustomerMeetings` (Convex mutation). Idempotent.
- **E2** Verify `/classic` still works end-to-end side by side. No
  regressions.
- **E3** Flip `/` redirect from `/classic` → `/work` in
  `packages/web/src/routes/+page.svelte`.
- **E4** Move `/classic` → `/classic-legacy` (rename folder); keep
  reachable for one week as a rollback escape hatch. Add a thin banner
  on `/classic-legacy`: "Legacy view. New 3-gate workspace at /."

**Phase E checkpoint:** prod deploy via wrangler pages; smoke test on
`tta-pete-demo.pages.dev/` end-to-end.

### Phase F · Polish + verify + handoff

- **F1** E2E test (agent-browser script in `scripts/e2e-3-gate.ts`):
  1. Open `/`, create meeting "Royal Randwick · SR · today"
  2. Upload `demo-fixtures/pete-24apr-xxprefix.jpg` AS A CARD (simulate
     official card) — for the demo, ship a real card fixture if
     possible (place under `demo-fixtures/cards/`)
  3. Approve → assert `field ✓ user-approved` chip
  4. In Gate 2, drop a tipster fixture → assert routed
  5. In Gate 3, assert aggregation + special bets + export
- **F2** Edge cases (manual):
  - Pending-meeting flow: drop tip before Gate 1 → Gate 2 shows pending row
  - Late scratching: locked meeting → click "edit field" → mark
    scratched on R4 #5 → save → assert affected tips show
    `tip_on_scratched` flag in Gate 3 with no unlock
  - Unlock-edit-relock: assert tips re-anchor automatically
- **F3** Docs:
  - `HANDOFF.md` updated with 3-gate flow + new endpoints
  - `PETE-DEMO-NEXT.md` — walkthrough script for the call
  - `STAGE-1-READINESS.md` updated state matrix

**Phase F checkpoint:** all E2E green; docs land; ready for Pete.

---

## 6 · Existing wiring to reuse (do not rebuild)

- `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` env vars on Pages — set
  to the local CLIProxyAPI via cloudflared tunnel. Already deployed.
  Both `/api/extract` + `/api/extract-card` honor `baseURL`. **Tunnel
  must stay up during dev + demo; document in `PETE-DEMO-NEXT.md`.**
- `RaceCardUploadModal.svelte` — extraction + review + approve flow.
  Refactor into NewMeetingModal as Step-2 of meeting creation.
- `userFields.ts` (Convex + web wrapper) — full path already wired.
- `buildMeetingGroups` + `applyFieldMatch` + `matchField` — pure
  pipeline, do not touch logic. Just feed `mergedFieldsByKey` (user
  fields always present in 3-gate model — Perplexity becomes
  unnecessary in steady state).
- `ClassicMeetingCard` — drop-in for Gate 3. Existing CSV/JSON/share
  logic stays.
- `meetingKey` helpers (`buildMeetingKey`, `parseMeetingKey`,
  `todayUtc`) — reuse verbatim.

---

## 7 · Risks + mitigations

| risk | mitigation |
|---|---|
| Rebuilding `/classic` breaks demo URL | Build at `/work`, flip last. `/classic-legacy` as rollback. |
| Tunnel goes down mid-build | Add a precondition check at start of every phase: `curl -s $ANTHROPIC_BASE_URL/v1/messages …` |
| Convex dev tier limits during heavy testing | Verify with `npx convex env list` + watch insights. Stage 1 stays on dev. |
| Multi-meeting tip sheets | Out of scope this sprint — document as known limitation, Pete uploads per-meeting for now. |
| Fuzzy meeting-name routing | Out of scope. Exact match + Pete-fix UX. Add fuzzy later if pain emerges. |
| State machine bug → meeting stuck in `cards-pending` | Pure-fn state machine in B2 with exhaustive tests. Plus admin escape: `setState` accepts any target with a `force:true` flag, surfaced as "reset state" in MeetingRow. |
| Cloudflare Pages cache serving old `/classic` after redirect flip | Add cache-bust headers on `/`. Hard-refresh during smoke test. |

---

## 8 · Definition of done

Every item below must be true before declaring complete:

- [ ] `pnpm typecheck` clean across `@tta/shared`, `@tta/convex`, `@tta/web`
- [ ] `pnpm test` green across all packages (no fewer tests than today)
- [ ] `pnpm --filter @tta/web build` clean (Cloudflare adapter)
- [ ] `tta-pete-demo.pages.dev/` serves the new 3-gate workspace
- [ ] `tta-pete-demo.pages.dev/classic-legacy` still serves the old surface (rollback path)
- [ ] E2E script in `scripts/e2e-3-gate.ts` passes end-to-end via
      agent-browser against prod URL
- [ ] No tip can be persisted to a non-locked meeting (server-side
      enforcement, verified with a unit test on `/api/persist`)
- [ ] Backfill is idempotent (verified by running twice — no duplicates)
- [ ] `HANDOFF.md` + `PETE-DEMO-NEXT.md` updated
- [ ] Three screenshots in `demo-fixtures/web-shots/`: Gate 1 with two locked + one draft, Gate 2 with routed + pending, Gate 3 with one full meeting incl. special bets

---

## 9 · Commit / branch hygiene

- Branch: `3-gate-workspace`
- One commit per phase checkpoint (atomic, descriptive)
- Conventional commits: `feat(work):`, `feat(convex):`, `test(shared):`,
  `docs:`, `chore(deploy):`
- Final commit: `feat(work): cut over / to 3-gate workspace, /classic → /classic-legacy`
- PR to `main` only when all Phase F items are green

---

## 10 · Out of scope (for this sprint)

- Multi-meeting tip sheets (one image, six meetings)
- Fuzzy meeting-name auto-routing
- Authentication / multi-customer (still single-user, clientId)
- Convex prod tier migration (stays on dev — `ardent-hound-725`)
- Image storage for cards (raw images discarded post-extraction)
- Race results / settlement / tipster reliability (Stage 2)
- Perplexity removal — keep the endpoint as a quiet fallback but
  unwire from the 3-gate page (user fields are the only path in steady
  state)

---

## 11 · First action for Sisyphus

1. Read `HANDOFF.md`, `STAGE-1-READINESS.md`, this file.
2. `git checkout -b 3-gate-workspace`
3. Verify proxy + tunnel up:
   `curl -s $ANTHROPIC_BASE_URL/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY" -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"ok"}]}'`
   (Read env from `wrangler pages secret list` if needed; tunnel URL in
   `/tmp/cf3.log` — restart with the snippet in §6 if dead.)
4. Begin Phase A1: schema for `customerMeetings`.
5. Checkpoint after every phase. Update this file's checkboxes in §8 as
   you go. Commit. Continue.

Good luck. Pete's worth doing this right.
