# Slide Deck Handoff — Fresh Context Window

**Date**: 2026-03-30
**Task**: Flow the Open Protocol + Data Economy strategic evolution into the slide deck

---

## What Exists

### Google Slides Deck (live, shareable with Warwick)
- **URL**: https://docs.google.com/presentation/d/1HfJX8BqqWALL1_dAe5O-TCwwCCRV6E6XkVRojZlRxdQ/edit
- **Builder**: `~/tta-matrix/slide-deck/build_deck.py` (Python, uses `gws slides` API)
- **30 slides**, dark theme, corporate box metaphor already applied (slides 23-26)

### HTML Deck (premium visual version)
- **File**: `~/tta-matrix/slide-deck/conviction-game-deck.html`
- **reveal.js** with: gradient backgrounds, SVG diagrams (conviction loop hexagon, quadratic bars, moat rings, racecourse architecture, envelope icons, wave function collapse), CSS animations (pulse, breathe, fragment fade-ups), finish line motif
- **Open with**: `xdg-open ~/tta-matrix/slide-deck/conviction-game-deck.html`

### Speaker Notes
- **File**: `~/tta-matrix/slide-deck/SPEAKER-NOTES.md`

### GEPA-Evolved Copy
- **File**: `~/tta-matrix/slide-deck/deck_config_evolved.json`
- Key mutation: "ZERO-KNOWLEDGE PROOFS" → "SEALED ENVELOPES"
- Copy shortened 20-40% across dense slides

### Video Plan
- **File**: `~/tta-matrix/slide-deck/VIDEO-PLAN.md`
- Manim animations planned (quadratic cost, conviction loop, wave collapse, sandpile, N×M×P grid)

---

## What Changed (2026-03-30 Strategic Evolution)

**Read these files — they contain the gravity-10 evolution:**

1. **`~/tta-matrix/.planning/RSW-CONVICTION-GAME.md`** — Updated RSW with 13 new concepts (7 at gravity 10). New philosophies PH6-PH7, primitives P10-P12, features F15-F18, patterns PA11-PA13, strategies S5(evolved)+S7+S8.

2. **`~/.claude/projects/-home-dom/memory/tta-carnival-pivot.md`** — Full strategic memo on the open protocol + data economy architecture.

### The Core Shift

**Before**: Sell boxes to bookmakers (Salesforce model)
**After**: Open protocol, anyone stands up a box, revenue at the aggregation layer (Linux model)

Three revenue surfaces from one primitive (the conviction atom):
1. **Protocol** (open source, free, self-hostable — anyone runs a box)
2. **Managed Service** (we run your box — carnival activations, sponsored, white-label)
3. **Data Economy API** (cross-box intelligence — the ONLY thing that can't be self-hosted)

### Key New Concepts to Flow Into Deck

| Concept | What to say | Where in deck |
|---------|------------|---------------|
| **Anyone can build a box** | Protocol is open. Self-hosted. Free. Mates, clubs, pubs. | New slide after slide 26 |
| **Platform bridges** | Bridges to WhatsApp, Sportsbet, Discord. No permission needed. | Same slide or new |
| **We sell the view** | The boxes are free. The cross-box intelligence is the product. | New slide |
| **Carnival pop-ups** | Time-bounded boxes for events. Melbourne Cup week. FOMO. | Modify or add to business section |
| **Composable intelligence** | Conviction atoms as non-fungible, programmable data primitives | New slide or modify moat |
| **Developer-first** | `npx conviction init` — one command to run a box | New slide or modify |
| **Six-layer moat** | Add "network effects" as layer 5, bump meta-intelligence to 6 | Update slide 28 |

### Deck Emotional Arc (Updated)

```
Slide 1-3:   RECOGNITION    — "This is my world"
Slide 4-7:   PROBLEM         — "This is broken"
Slide 8-14:  CONCEPTS        — "That's clever" (unchanged)
Slide 15-18: SYNTHESIS       — "It all fits together" (unchanged)
Slide 19-22: THE GAME        — "I can see playing this" (unchanged)
Slide 23-26: THE BOX         — "Digital corporate box" (keep, add carnival)
Slide 27-28: THE PROTOCOL    — NEW: "Anyone can build a box. We sell the view."
Slide 29-30: THE MOAT        — Update to six layers + network effects
Slide 31-32: THE DATA        — NEW: "Composable intelligence API"
Slide 33-34: THE ASK         — Update asymmetry + closing
```

OR compress into existing 30 slides by making slides 27-28 the protocol/view slides and fitting the data economy into the moat section.

---

## Infrastructure Available

| Tool | Status | Location |
|------|--------|----------|
| `gws slides` | Working, authed | `gws slides presentations batchUpdate` |
| CLIProxyAPI | Running on :8317 | `systemctl --user status cli-proxy-api` |
| GEPA 0.1.1 | Installed | `pip` |
| Playwright + Chromium | Working | Python playwright |
| Manim 0.20.1 | Installed | `manim` |
| google-genai 1.69.0 | Installed (needs GEMINI_API_KEY) | `pip` |
| HTTP server | Running on :8770 | Serving `~/tta-matrix/slide-deck/` |
| render_deck.py | Working | `~/.claude/skills/slide-deck-optimizer/templates/` |
| Z-Image Turbo | HuggingFace MCP (quota may be reset) | MCP tool |

---

## What To Do

1. **Read the updated RSW** (`~/tta-matrix/.planning/RSW-CONVICTION-GAME.md`) — understand the 13 new concepts
2. **Update the HTML deck** (`conviction-game-deck.html`) with new slides for protocol + data economy
3. **Update the Google Slides deck** via `build_deck.py` with the same content
4. **Update SPEAKER-NOTES.md** with notes for new slides
5. **Generate visuals** — Manim animations if possible, more SVG diagrams at minimum
6. **Keep it sexy** — the HTML deck has premium styling, maintain that bar

### Design Principles (from SLIDE-DECK-PROMPT.md)
- ONE idea per slide
- Visual first, text second
- Under 20 words visible text per slide
- Progressive disclosure (each slide earns the next)
- Dark theme, gold accents, racing night vibes
- Warwick must understand immediately — no jargon without metaphor
