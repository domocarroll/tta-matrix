# Pitch Morning · 1 May 2026

**Pete · 11:00 AEST · Google Meet**

Everything you need is here. Start at the top, work down.

---

## 30 minutes before the call

```bash
# 1. Start the web UI dev server
cd ~/tta-matrix/packages/web
pnpm dev
# → http://127.0.0.1:5180

# 2. In a SECOND terminal, also have the CLI ready as backup
cd ~/tta-matrix/packages/agent
# (no need to run yet — just have the directory ready)
```

Then in your browser:

1. **Tab 1**: open the deck — `file:///home/dom/tta-matrix/slide-deck/pete-pitch-deck.html`
   - Press `s` to open speaker notes in a popup
   - Press `f` for fullscreen
   - Arrow keys to navigate
2. **Tab 2**: live demo — `http://127.0.0.1:5180/`
   - Confirm "Pete 24 Apr · xx prefix" button is visible
3. **Tab 3** (safety net): cached replay — `http://127.0.0.1:5180/?cached=pete-24apr`
   - Don't open this until you need it
   - Identical UX, no network call, instant fallback if live fails

Have the cheat sheet open on your phone or printed:
`~/tta-matrix/slide-deck/PETE-PITCH-CHEATSHEET.md`

---

## The pitch flow (30 minutes)

| Time | Slide | What you're doing |
|------|-------|-------------------|
| 0:00 | 1 — Title | Hold for 3 seconds. Don't elaborate. |
| 0:30 | 2 — "Same bug, four months" | Frame the diagnosis |
| 1:00 | 3 — Bug timeline | Walk gently. Highlight 16 Mar fix moment. |
| 3:00 | 4 — Pete's words | Read the 24 Apr quote slowly |
| 4:00 | 5 — The image | Let him recognise it |
| 5:00 | 6 — Pipeline vs Agent | The pivot — wait for the nod |
| 7:00 | 7 — "Watch it think" | **SWITCH TO TAB 2** |
| 7:30 | LIVE DEMO | Click "Pete 24 Apr · xx prefix". Narrate ~2 mins |
| 10:00 | 9 → 11 | Back to deck — flags, stats |
| 12:00 | 12 → 14 | Architecture diff + migration |
| 16:00 | 15 → 19 | What it unlocks (memory, build order, tiers, what's built) |
| 24:00 | 20 — The ask | Three options, no pressure |
| 28:00 | 21 — Close | Don't fill silence |

---

## If something goes wrong

| Failure | Fix |
|---------|-----|
| Dev server won't start | `pnpm install --filter @tta/web` then retry |
| Live demo stalls past 30s | Switch to tab 3 (cached replay) — same UX, no network |
| Browser shows old version | Hard reload: `Ctrl+Shift+R` |
| WiFi dies completely | Use the deck slides 8–11 — they ARE the demo evidence as screenshots |
| `pnpm dev` errors out | Check `packages/web/.env` has `ANTHROPIC_API_KEY=...` (copied from `~/tta-matrix/.env` last night) |
| Pete asks "show me the code" | `~/tta-matrix/packages/agent/src/demo.ts` is the agent. `packages/web/src/routes/api/extract/+server.ts` is the streaming endpoint. |

---

## After the call

1. Send Pete a follow-up email same day (≤2 paragraphs)
2. Attach `demo-fixtures/PETE-DEMO.md`
3. Update `~/.claude/projects/-home-dom-tta-matrix/memory/pete-blackburn-tipanalyser.md` with whatever he said
4. If he picked option A or B, draft scope-and-cost over the weekend
5. If he picked option C, schedule the next call for ~2 weeks out

---

## Files reference

| File | Purpose |
|------|---------|
| `slide-deck/pete-pitch-deck.html` | The deck. Open in Chrome. |
| `slide-deck/PETE-PITCH-CHEATSHEET.md` | Slide-by-slide notes + signal reading |
| `slide-deck/SPEAKER-NOTES.md` | Older Warwick speaker notes — IGNORE for Pete |
| `packages/web/` | The live demo UI |
| `packages/agent/src/demo.ts` | The CLI agent (terminal backup) |
| `demo-fixtures/PETE-DEMO.md` | Email-able post-call summary |
| `demo-fixtures/pete-24apr-xxprefix.jpg` | Pete's input image |
| `demo-fixtures/pete-24apr-xxprefix.extraction.json` | Cached agent output (used by ?cached=pete-24apr) |
| `demo-fixtures/pete-24apr-agent-run.txt` | Full terminal capture if you want to show it |
| `demo-fixtures/web-shots/` | Web UI screenshots used in deck |

---

## Status of code

- **3 commits pushed locally** (not yet pushed to remote — push if you want to)
- **Convex deployed** at dev:ardent-hound-725
- **Anthropic key** working, Sonnet 4.6 model confirmed available
- **Dev server** runs on port 5180 (not 5173 — to avoid conflicts)

---

## The thesis (so you don't drift)

This pitch is **not** "Claude > Gemini." It is **agentic > deterministic pipeline**.

The migration is architectural. v0 patches symptoms forever; v2 removes the bug class.
Every slide should reinforce that frame. Don't let the conversation slide into
"which model is better" — that's the wrong frame and it loses the pitch.

If Pete pushes on cost or latency, redirect: "the question isn't whether Sonnet
is faster than Gemini — it's whether you want a system that can REASON about
edge cases or one that has to be patched every time a new publication ships
new markup."

---

**You've got this. The demo did the work last night. Today the demo just has to run.**
