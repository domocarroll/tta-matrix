# Slide Deck Refactor: The Digital Corporate Box

**Context**: This document is a complete refactoring plan for `build_deck.py`. Feed this into the operational context window building the Google Slides deck. It specifies every change, why, and the exact copy.

**Status of slides 23-26**: Already updated in `build_deck.py` with box framing (section header, tiers as Grandstand/Members/Box Seat, bookmaker boxes). This plan covers the REST of the deck.

---

## The Strategic Insight

The "digital corporate box" is not a business section rename. It's a **narrative device** that restructures how Warwick processes the entire deck. The key realization:

> The pub IS an unbranded corporate box.
> The WhatsApp group IS an unequipped digital box.
> The conviction game community IS a fully-equipped digital box.

The deck already tells a story of **upgrading the gathering place** (pub → WhatsApp → conviction game). The corporate box metaphor makes this journey legible to a racing person because Warwick has literally walked from grandstand → members → corporate box at the track. He knows the upgrade path viscerally.

**The refactoring principle**: Plant seeds in the early slides. Let the "digital corporate box" reveal at slide 23 land as an "aha" — not a surprise, but a naming of something Warwick has been feeling since slide 2. The metaphor should feel inevitable when it arrives.

---

## What NOT to Change

The **concepts section (slides 8-14)** is strong as-is. Don't inject box language into ground truth, conviction, QV, ZK, anti-collusion, or social deduction. These are mechanism slides — they explain HOW the box works, not WHAT the box is. Mixing metaphors here would weaken both.

The **synthesis section (slides 15-18)** should stay mechanism-focused. The closed loop, the 30-minute cycle, the honesty property — these are mathematical properties, not marketing copy.

**Slide 25 (break-even at 4 users)** stays as-is. It refers to D2C phase, not B2B boxes. The number is powerful precisely because it's concrete and small.

---

## Tier 1: Direct Slide Modifications

### Slide 6 — "Intelligence flows one way"

**Current body text**:
```
The punter commons existed.
In pubs. At the track. In WhatsApp groups.

Industrialised bookmaking enclosed it.
Not destroyed. Enclosed.

The intelligence is still there
in every punter's head.

There's just no mechanism to aggregate it honestly
and return it to the people who generated it.
```

**Change to**:
```
The punter commons existed.
In pubs. At the track. In WhatsApp groups.
Every gathering place where punters sit together.

Industrialised bookmaking enclosed it.
Not destroyed. Enclosed.

The intelligence is still there
in every punter's head.

There's just no venue that aggregates it honestly
and returns it to the people who generated it.
```

**Why**: Two subtle word changes. "Every gathering place where punters sit together" plants the VENUE/BOX seed without naming it. "No venue that aggregates" (replacing "mechanism") shifts from technical to spatial language. Warwick thinks in venues — pubs, tracks, boxes. When slide 23 says "THE DIGITAL CORPORATE BOX," his brain completes the connection: "The venue I've been hearing about since slide 6."

---

### Slide 7 — "What if the pub could think?"

**Current**: Single big text: "What if the pub could think?"

**Change title to**: "What if the gathering place could think?"

**Why**: "Pub" is too narrow. By slide 7, we've established three gathering places (pubs, track, WhatsApp). "The gathering place" is more inclusive and maps forward to the corporate box reveal. The pub is ONE box. The gathering place is THE box — wherever punters congregate.

**IMPORTANT ALTERNATIVE**: If the team feels "pub" is more visceral and Warwick-friendly (it is), KEEP "pub" and instead add a subtitle:

```
What if the pub could think?

(The WhatsApp group. The track. Any place punters gather.)
```

This preserves the punch of "pub" while expanding to the general case. Use DIM color for the subtitle.

---

### Slide 20 — "What a Saturday Looks Like"

**Current title**: "What a Saturday Looks Like"

**Change to**: "A Saturday Inside"

**Why**: Two words that do enormous work. "Inside" implies a bounded space — a room, a venue, a box. Without naming "corporate box," this slide becomes "this is what it feels like to be INSIDE the product." When Warwick reaches slide 23, the box framing explains what "inside" means. Remove "looks like" — the content already shows the timeline. The title should evoke the feeling of BEING IN IT, not observing it.

**Body text**: No change needed. The timeline is perfect as-is.

---

### Slide 28 — "Five Layers Deep" (Moat)

**Current text** (Layer 1):
```
1.  COMMUNITY
     Social fabric. Can't clone a WhatsApp group.
     Can't manufacture pub trust.
```

**Change Layer 1 to**:
```
1.  THE ROOM
     The people inside each box.
     Can't clone a WhatsApp group.
     Can't manufacture pub trust.
```

**Current text** (Layer 5):
```
5.  META-INTELLIGENCE
     Cross-community signal. Exclusively ours.
     No single community has this view.
```

**Change Layer 5 to**:
```
5.  THE VIEW ACROSS ALL BOXES
     Cross-community signal. Exclusively ours.
     No single bookmaker has this view.
     Only the box-builder does.
```

**Why**: Layer 1 and Layer 5 bookend the moat with box language. Layer 1 is the micro-moat (each box has irreplaceable social fabric). Layer 5 is the macro-moat (the platform sees across ALL boxes — an advantage no individual box-holder has). "Only the box-builder does" positions the company as the racecourse, not a box.

**Layers 2-4**: Leave as-is. Data, mechanism, and personal swarms don't need box language — they're the CONTENTS of the box, not the box itself.

---

### Slide 29 — "The Asymmetry"

**No text changes.** But the current "UPSIDE: Protocol company in a $32B market" could optionally become: "UPSIDE: The racecourse in a $32B market" — because if bookmakers are box-holders, and you built the racecourse, you're the platform. This is a judgment call. "Protocol company" is more VC-legible. "The racecourse" is more Warwick-legible. **For this deck (audience: Warwick), use "The racecourse."**

**Change**:
```
'UPSIDE\nProtocol company\nin a $32B market'
```
**To**:
```
'UPSIDE\nThe racecourse\nin a $32B market'
```

---

### Slide 30 — "The Ask"

**Current**:
```
Title: "The game doesn't need to be explained."
Body: "It needs to be played."
CTA: "Let's build it."
```

**Add a second CTA line below "Let's build it."** in DIM color:

```
'Want a box with your logo on it?'
```

**Why**: The slide currently closes on the D2C play ("play the game"). Adding the box line plants the B2B seed. It's the last thing on screen. It lingers. Warwick walks away with two ideas: (1) I want to play this, and (2) bookmakers would pay for this.

---

## Tier 2: Speaker Notes

The deck builder currently has NO speaker notes. This is a significant gap. Speaker notes are where Dom carries the depth — the box metaphor, the objection handling, the "say this when Warwick asks about..." moments.

**Implementation**: The Google Slides API supports speaker notes via `notesPage`. Add a helper function:

```python
def mk_notes(slide_id, text):
    """Add speaker notes to a slide."""
    notes_id = f'notes_{slide_id}'
    return [{
        'insertText': {
            'objectId': notes_id,
            'text': text,
            'insertionIndex': 0
        }
    }]
```

**NOTE**: Google Slides API speaker notes are tricky — the notes page shape objectId must be retrieved from the created slide, not constructed. The safer approach is a second pass: after all slides are created, GET the presentation, find each slide's `notesPage.notesProperties.speakerNotesObjectId`, then insert text. This requires a two-pass build.

**If two-pass is too complex**: Skip speaker notes in the API and create a separate SPEAKER-NOTES.md file that Dom reads from his phone or prints. This is pragmatically better — Dom won't be looking at the Google Slides speaker notes panel during a conversation with Warwick anyway.

### Speaker Notes Content (per slide):

**Slide 2** — "Every Saturday":
> These punters already gather. Pubs, track, WhatsApp. The gathering is the primitive — we don't create it, we upgrade it. Remember this: we never move punters to us. We bring intelligence to where they already are.

**Slide 6** — "Intelligence flows one way":
> The pub, the WhatsApp group, the trackside conversation — these are all informal boxes. No brand on the door. No intelligence captured. No score kept. The bookmaker extracts intelligence from the betting market. We extract it from the gathering place.

**Slide 7** — "What if the gathering place could think?":
> This is the question the whole deck answers. The pub was the first gathering place. WhatsApp was the second. The conviction game is the third. Each one is more structured, more intelligent, more valuable. By slide 23, we'll call this a digital corporate box.

**Slide 14** — "Social Deduction":
> If Warwick asks "but why would people play this?" — the answer is: punters already play this. Every pub conversation about racing IS social deduction. "Wazza's been suspiciously quiet about Race 5." "Don't listen to Macca, he's talked up Horse 3 all week." We're just giving it a score.

**Slide 20** — "A Saturday Inside":
> Walk Warwick through this as if he's IN the box. "Saturday morning, tip sheets hit the channel. AI strips them into structured data. You study form, allocate your credits. Race 1 locks. 30 seconds later, the result arrives. Your credits settle. The forensics light up — unusual concentration on Horse 4 in Race 2. Who's behind it? The conversation starts. This happens 8-10 times. By evening, the leaderboard's moved. You check your rank. You're hooked."

**Slide 23** — "THE DIGITAL CORPORATE BOX":
> This is the reframe. Pause here. Let Warwick process.
>
> "You know what a corporate box is, Woz. Premium view. Exclusive membership. The brand's logo on the door. You're not paying for the race — everyone sees the same race. You're paying for the experience inside the box."
>
> "That's exactly what we're building. A digital corporate box. The conviction signal is the view. The AI swarm is the catering. The leaderboard is the social status. The brand on the door? That's the bookmaker who leases it."

**Slide 24** — "Three Seats at the Track":
> Map it to what Warwick knows:
> - Grandstand = you're at the track, you can see the race, but you're standing in the rain. WhatsApp. Free.
> - Members = you're inside the fence. You've got a seat. You can hear the jockey interviews. Matrix community. $25/mo.
> - Box Seat = you've got your own room. Personal screen. Dedicated staff. AI swarm tuned to your form. $100/mo.
>
> "Everyone watches the same race. The difference is the experience."

**Slide 26** — "Every Bookmaker Gets Their Own Box":
> The one-sentence B2B pitch: "Your punters are already at the track. We built the boxes. Want one with your logo on it?"
>
> If Warwick asks "why would Sportsbet pay?" — "Which box called more winners? Sportsbet's box: 7 of 10. Ladbrokes' box: 5. That's content. That's tribal identity. That's an engagement metric no other platform offers."
>
> The bookmaker doesn't build the racecourse. They lease a box. Same economic structure. Same cultural logic.

**Slide 28** — "Five Layers Deep":
> If Warwick asks about defensibility, walk through the layers:
> - "The people in each box can't be cloned. Social fabric takes time."
> - "Six months of conviction-vs-truth data can't be faked or generated retroactively."
> - "The QV + ZK mechanism is 12-18 months of cryptographic engineering to replicate."
> - "The personal AI swarm co-evolves with each punter. Switching cost is cognitive."
> - "And the meta-intelligence — the view across ALL boxes — that's exclusively ours. No single bookmaker has it. Only the box-builder does."

**Slide 29** — "The Asymmetry":
> "Downside: $50-100 a month in server costs. The business is essentially unkillable on a cash basis."
> "Upside: We're the racecourse in a $32B market. Every bookmaker, every sport, every sponsor — they all need a box."
> "Comps: Polymarket hit $9B. Kalshi hit $22B. We have a faster truth clock and cultural resonance they don't."

**Slide 30** — "The Ask":
> Don't oversell here. The deck should have done the work.
> "The game doesn't need to be explained. It needs to be played. Want to play it with me?"
> Then, quieter: "And when the CDO at Sportsbet asks what we sell — we sell digital corporate boxes."

---

## Tier 3: Structural Observations (Do Not Implement — For Future Consideration)

### The Subtitle on Slide 1

Current: "Rewilding the Punter Commons"

Consider for a future version: "Rewilding the Punter Commons" is strong for a crypto/academic audience. For Warwick, "The Digital Corporate Box" could BE the subtitle. But this would tip the hand too early — the reveal at slide 23 is stronger if the title doesn't preview it.

**Recommendation**: Keep "Rewilding the Punter Commons" for now. It creates intrigue without explanation. If Warwick later asks "what does that mean?" — it means "restoring the pub, but digital, but intelligent, but competitive."

### Potential New Slide: The Comparison Table

The physical-to-digital box mapping table is powerful in a briefing doc. But on a slide, 7 rows of table is too much text for the ONE-IDEA-PER-SLIDE principle. If it's needed, make it a LEAVE-BEHIND document, not a slide.

### Potential New Slide: "The Racecourse Architecture"

A slide showing Matrix federation as the racecourse:
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  SPORTSBET  │  │  LADBROKES  │  │     TAB     │
│     BOX     │  │     BOX     │  │     BOX     │
│  (Matrix    │  │  (Matrix    │  │  (Matrix    │
│   room)     │  │   room)     │  │   room)     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────▼─────────┐
              │  THE RACECOURSE   │
              │  (Protocol layer) │
              │  Same races.      │
              │  Same ground      │
              │  truth.           │
              └───────────────────┘
```

This could replace or augment the text on slide 26. The diagram makes the architecture tangible — three branded rooms sitting on shared infrastructure. This is a good candidate for the operational window to implement if there's space.

---

## Implementation Summary

| Slide | Change Type | Effort |
|-------|------------|--------|
| 6 | Two-word swap + one added line | Trivial |
| 7 | Title text change (or add subtitle) | Trivial |
| 20 | Title change ("A Saturday Inside") | Trivial |
| 23-26 | Already done | Done |
| 28 | Layer 1 + Layer 5 reword | Small |
| 29 | "Protocol company" → "The racecourse" | Trivial |
| 30 | Add second CTA line | Trivial |
| All | Speaker notes (separate file or API) | Medium |

**Total slide text changes: 7 slides touched, ~30 words changed.**

The refactoring is intentionally light. The box metaphor is powerful BECAUSE it's restrained — it appears in the places where Warwick's brain naturally reaches for it, not in places where mechanism language serves better.

---

## One-Liner for the Operational Window

> Apply the "digital corporate box" refactoring plan from `slide-deck/CORPORATE-BOX-REFACTOR.md`. Update slides 6, 7, 20, 28, 29, 30 in `build_deck.py` with the exact copy specified. Create `slide-deck/SPEAKER-NOTES.md` with the per-slide notes. Slides 23-26 are already updated — verify they match the plan but don't double-apply.
