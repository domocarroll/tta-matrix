# Pete Demo — Next (3-Gate Workspace)

**Status:** ready for the next call.
**URL:** https://tta-pete-demo.pages.dev/ → redirects to /work
**Rollback:** https://tta-pete-demo.pages.dev/classic still serves the old surface.

---

## What changed since last call

Three gates replace the one-pile workspace:

| Gate | Pete does | Output |
|---|---|---|
| **① field** | Create meeting · upload official cards · review · approve | LOCKED FIELD per meeting |
| **② tips** | Drop tip sheets — extraction routes to locked meetings | Routed tips · pending tips surfaced for fix |
| **③ review** | Aggregated card per meeting · quaddie/trif/F4 · edit · export | Customer payload |

**Load-bearing rule:** tips cannot land in an unlocked meeting. Enforced server-side. If Pete drops a tip sheet before Gate 1 is locked, Gate 2 shows an amber "no locked meeting for X" row with a one-click "lock now →" button that jumps to Gate 1 prefilled.

---

## Walkthrough script (~5 min)

1. **Open https://tta-pete-demo.pages.dev/** — lands on `/work`. Gate header shows "0/0 locked · 0 tips · 0 ready".
2. **Gate 1: lock the day's meeting.**
   - Click `+ new meeting`.
   - Pick date · category (SR/MR/BR/PR/AR) · venue name (e.g. "Royal Randwick").
   - Hit `create meeting →`. Card upload modal opens.
   - Drop the official race card image(s) — single or multiple.
   - Claude extracts every race + runner.
   - Review the table; fix anything wrong; click `approve & lock field →`.
   - Meeting flips to **✓ locked** with green chip.
3. **Gate 2: drop tip sheets.**
   - Drop the tipster newspaper images on the dropzone.
   - Each row shows "extracting…" → green **✓ routed →** (link to Gate 3).
   - If a tip sheet's meeting doesn't match anything locked, the row stays amber: "no locked meeting for X" + `lock now →`. Click that → Gate 1 modal opens prefilled.
4. **Gate 3: review.**
   - The locked meeting now renders as a ClassicMeetingCard.
   - Tips anchored to the locked field — no "xxxxCall Me Gorgeous" duplicates.
   - Quaddie / Trifecta / First Four computed at the top.
   - `edit field` button per row → inline rename/scratch.
   - `export CSV` / `share link` buttons work as before.

### Edge cases (demo-safe)

- **Late scratching:** Gate 1 → `edit field` on the locked meeting → toggle scratched → save. No unlock required. Tips on that runner flag in Gate 3 as `tip_on_scratched`.
- **Unlock + relock:** Gate 1 → `unlock` → re-upload/edit cards → re-approve. Tips that were already routed stay routed.
- **Delete:** Gate 1 → `delete` removes the meeting + locked field. Cascades.

---

## Infrastructure (Pete's ball if anything dies)

- **Anthropic proxy:** `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY` on Cloudflare Pages env. Cloudflared tunnel points at the local CLIProxyAPI. If extraction returns 502 or hangs, the tunnel is down — restart from the local box:
  ```bash
  cloudflared tunnel --url http://localhost:8317 > /tmp/cf3.log 2>&1 &
  # Wait ~5s, grep the URL from /tmp/cf3.log, set ANTHROPIC_BASE_URL on Pages.
  ```
- **Convex dev tier** (`ardent-hound-725`) — schema deployed. Storage stays inside the dev project.

---

## Known limitations (out of scope for this sprint)

- Multi-meeting tip sheets (one image, six meetings) — upload per-meeting for now.
- Fuzzy meeting-name auto-routing — extraction must match locked name exactly. Mismatched ones surface in Gate 2 with a one-click fix.
- Authentication — still single-user (clientId in localStorage).
- Perplexity field resolver — kept as a quiet fallback for `/classic`; unwired from `/work` (user fields are the only path).

---

## Recovery / rollback

- If `/work` misbehaves mid-demo: open **`/classic`** — old surface still live.
- If a meeting gets stuck in `cards-pending`: Gate 1 → `delete` and recreate.
- If a tip got routed to the wrong meeting: Gate 3 → `clear meeting` on the bad one → re-drop the tip sheet (it'll re-route to the right locked meeting now).
