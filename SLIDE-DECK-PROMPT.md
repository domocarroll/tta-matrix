# PROMPT: The Conviction Game — Slide Deck

## MISSION

Build a visually compelling slide deck that communicates The Conviction Game to a co-founder (Warwick, "Woz") who is a racing person, not a crypto/tech person. A 3,800-word intelligence briefing already failed — he couldn't engage with it. The ideas are strong but the medium was wrong.

**The deck must make him FEEL the idea before he understands the mechanism.** Start with what he knows (racing, punters, tipping, the pub). Build each concept visually. Land the synthesis as an "aha" that earns itself.

## AUDIENCE

**Warwick ("Woz")**
- Racing insider. Understands punters, tipsters, bookmakers, the culture.
- NOT a crypto person. NOT a tech person. Zero assumed knowledge of ZK, QV, MACI, mechanism design.
- Responds to: concrete examples, visual metaphors, clear "so what?" moments.
- Disengages from: walls of text, academic framing, jargon-first explanations.
- Needs to feel: "I get it. This is real. Let's build this."

## THE CORE THESIS (Compressed)

The Conviction Game is a social deduction game (Blood on the Clocktower / Among Us) where punters allocate conviction credits across horses before each race. The cost of expressing stronger belief grows quadratically (2x conviction = 4x cost), which mathematically guarantees that distributed honest opinion beats concentrated manipulation. Zero-knowledge proofs let punters build anonymous verified track records. Anti-collusion cryptography makes cartels structurally unenforceable. Ground truth arrives every 30 minutes (the race result). The game creates engagement. Engagement creates data. Data creates intelligence. Intelligence creates edge.

**One sentence**: Collective intelligence emerges from private conviction under quadratic cost, verified against ground truth, in a system where honest coordination is frictionless and dishonest coordination is cryptographically hard.

**Business model**: D2C tiers (WhatsApp free → Matrix $25/mo → Premium $100/mo), then B2B (sell branded community boundaries to bookmakers as engagement infrastructure). Break-even at 4 paying users.

**Why horse racing**: Fastest ground truth clock available. ~200 objective truth events per week. The conviction game vibrates faster here than anywhere else.

## SOURCE FILES (read these for full detail)

All in `~/tta-matrix/.planning/`:

1. **`RSW-CONVICTION-GAME.md`** — The complete 5-layer Recursive Semantic Web. 26 concepts across Philosophy → Primitives → Features → Patterns → Strategy. This is the structural blueprint.

2. **`CONVICTION-GAME-LENSES.md`** — Five analytical lenses (Game Design, Game Theory, Self-Organising Criticality, Geometry, Hermetic Principles) examining the same design. Rich with visual metaphors that should inform slide design.

3. **`SITUATION-ANALYSIS.md`** — Competitive landscape, financial model, regulatory risk matrix, fundraising strategy, go-to-market (mycelium protocol). The business case.

4. **`WARWICK-BRIEFING.md`** — The text briefing that didn't land. Study its structure but DO NOT replicate its density. Extract the key ideas and find visual ways to express them.

5. **`synthesis/SYNTHESIS-PLAN.md`** — The Pi-mono × MiroFish synthetic observer layer. Personal swarms, hybrid intelligence. The advanced product vision.

## DESIGN DIRECTION

**Format**: reveal.js HTML slide deck. Single self-contained HTML file. Dark theme (racing night vibes — dark backgrounds, accent colours that pop). Must look premium, not academic.

**Slide design principles**:
- ONE idea per slide. Maximum.
- Visual first, text second. If the slide needs more than 20 words, it needs redesign.
- Use diagrams, not paragraphs. Circles, arrows, loops — the conviction game IS a loop.
- Progressive disclosure: each slide earns the next. No concept used before it's introduced.
- Speaker notes for Dom to present from (put the depth there, not on screen).
- Animations where they serve understanding (reveal elements progressively on a slide).

**Emotional arc of the deck**:
```
Slide 1-3:   RECOGNITION   — "I know this world. This is my world."
Slide 4-7:   PROBLEM        — "I've always felt this was broken but couldn't name it."
Slide 8-14:  CONCEPTS       — "Oh, that's clever." (one concept per slide, visual)
Slide 15-18: SYNTHESIS      — "Holy shit, it all fits together."
Slide 19-22: THE GAME       — "I can see myself playing this."
Slide 23-26: THE DIGITAL CORPORATE BOX — "This makes money. Real money."
Slide 27-28: THE MOAT       — "Nobody can copy this."
Slide 29-30: THE ASK        — "Let's build it."
```

**Visual metaphors from the source material** (use these):
- The pub → the WhatsApp group → the conviction market (evolution of the commons)
- Sandpile / avalanche (self-organising criticality — leaderboard reshuffles are emergent drama)
- Paraboloid cost surface (geometry defending honest signal — attackers push uphill)
- Night/Day loop (social deduction phases mapped to racing schedule)
- Mycelium (underground growth → fruiting body when ready)
- Wave function collapse (all outcomes in superposition → race result collapses to truth)
- Rewilding (not disrupting, restoring — wolves reintroduced → river changes course)

## RESEARCH PHASE

Before building, research:
1. The best reveal.js slide decks for pitch/concept presentations — study what makes them land
2. Dark-themed data visualisation and slide design patterns
3. How the best pitch decks handle progressive concept building (Airbnb, Coinbase, Figma original decks)
4. reveal.js features: fragments, vertical slides, speaker notes, backgrounds, transitions
5. CSS techniques for premium dark-themed presentations (gradients, glow effects, subtle animations)

## QUALITY BAR

This is not a demo. This is not a "starting point." This is the artefact Dom uses to get his co-founder on board. It must be:
- Beautiful enough that the medium itself signals "this person is serious"
- Clear enough that Warwick walks away understanding the core mechanism
- Compelling enough that he wants to build it
- Complete — every section of the emotional arc above must be present
- Self-contained — single HTML file, no external dependencies (inline all CSS/JS, use CDN for reveal.js)

## DELIVERY

Save the final deck to `~/tta-matrix/conviction-game-deck.html`. It should open directly in any browser. Test it locally.

## BEGIN

Read all 5 source files first. Then research. Then plan the deck slide-by-slide (get alignment before building). Then build it. Then review it. Then refine it.
