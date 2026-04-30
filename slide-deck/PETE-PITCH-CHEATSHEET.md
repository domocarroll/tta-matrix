# Pete Pitch — Cheat Sheet

**When**: Fri 1 May 2026, 11:00–12:00 AEST · Google Meet
**Who**: Peter Blackburn, Blacmac Productions · peter@blacmacproductions.com · 0415 843 243
**Deck**: `slide-deck/pete-pitch-deck.html` (open in Chrome, hit `s` for speaker view)
**Live demo**: `cd packages/web && pnpm dev` → `http://127.0.0.1:5180`
**Backup**: terminal CLI · `cd packages/agent && pnpm exec tsx src/demo.ts ../../demo-fixtures/pete-24apr-xxprefix.jpg`

---

## 30 minutes before the call

- [ ] Open the deck in Chrome — full-screen, hit `s` for speaker notes pop-out
- [ ] Start dev server: `cd packages/web && pnpm dev` (verify on http://127.0.0.1:5180)
- [ ] Test the "Pete 24 Apr · xx prefix" fixture button — let it run all the way through. ~110s
- [ ] Plug in laptop charger. Browser zoom at 100%.
- [ ] Have the cheat sheet on phone in case laptop slides

---

## The opening line (first 30 seconds)

Pete, I want to walk you through where I've taken the TipAnalyser since we
last spoke. About 30 minutes. We'll start with the bugs you've been hitting,
I'll show you what I built, and then we can talk about where this goes.

Don't promise the world up front. Earn it.

---

## Slide-by-slide beats

### Slide 1 · Title
Hold for 3 seconds. "The TipAnalyser. Built to reason, not to parse."
Don't elaborate.

### Slide 2 · "The same bug, four months"
Set the diagnosis. The problem isn't Pete. It's the architecture.

### Slide 3 · Bug timeline
Walk it gently. Highlight the 16 Mar fix — that was when we both noticed
we were patching symptoms. The 24 Apr regression is what convinced me to
stop patching.

> Ask Pete: "Do you remember the 16 Mar fix? That was the moment for me."

### Slide 4 · Pete's words (24 Apr quote)
**Read it slowly.** This is the inciting incident of the rebuild.

### Slide 5 · The image
Show his image. Let him recognise it. Frame: his preview strips the prefix
before he sees it, but Gemini sees the raw glyphs. Architectural mismatch
between what HE sees and what the AI sees.

### Slide 6 · Pipeline vs agent
The pivot. Don't move past until Pete has nodded.

> "v0 is a pipeline. v2 is an agent. Pipelines patch. Agents reason."

### Slide 7 · "Watch it think" lead-in
**SWITCH TO BROWSER NOW.** localhost:5180.

### Slide 8 · (backup) Web UI home
Only if dev server flakes. Talk through the screenshot.

### LIVE DEMO (back in browser)

Click "Pete 24 Apr · xx prefix". Narrate as it streams:

1. **First 2s**: "First thing — image preview appears. Same image you sent."
2. **5–10s**: "Now it's identifying the publication. TAB Racing 31."
3. **10–20s**: "Six tipster columns detected. Watch — this is the agent
   noticing the xx prefix pattern by itself."
4. **20–60s**: Reasoning bullets keep landing. Don't fill silence — let
   Pete read.
5. **~70–110s**: Final flag panel appears. "Fifteen prefix artefacts stripped.
   Including your exact reported bug — Mitch Cohen R4, xxx Call Me Gorgeous.
   The agent named it in the same UI."
6. **~110s**: Race cards animate in. Race 4 has three tipsters all picking
   '9 Call Me Gorgeous'. Zero phantoms.

If demo flakes mid-run, switch to deck slides 9–11 (screenshot evidence).

### Slide 9 · Streaming reasoning (screenshot)
Use if you want to talk through the streaming UI without re-running.

### Slide 10 · Flag panel (the killer slide)
**Stop here. Let him read.**

> "Row five from the top. Mitch Cohen R4, xxx Call Me Gorgeous. Stripped.
> Your bug, named in the agent's words, in the same UI that showed it.
> Not patched — structurally absent."

### Slide 11 · Stats
The "0 phantom horses" line is the punchline. The "flagged race 8 cutoff"
is bonus — agent did MORE than fix the reported bug.

### Slide 12 · Architecture lead-in
Transition. He doesn't need a tech tour, but he does need to see the
new system can be absorbed not thrown-away.

### Slide 13 · v0 / v2 architecture diff
Provider-agnostic point matters most. He's been at Gemini's mercy for
4 months. v2 makes the model a commodity.

### Slide 14 · Migration · same UX, new brain
Reassurance. He's not risking customer trust for a tech upgrade.
We migrate the engine underneath them.

### Slide 15 · "What this unlocks" lead-in
Aperture widens here. Pete agreed v2 fixes bugs. Now show what's possible.

### Slide 16 · Memory is the moat
Pete needs to see v2 doesn't just fix — it generates an asset v0 couldn't.
Clean dataset accumulates. That's the durable advantage.

### Slide 17 · Build order (six steps)
**Crucial frame**: each step ships independently. Each is monetisable on
its own. He can stop after step 3 and still have a 10× better product.
The Conviction Game is a far-future option, not the near-term ask.

### Slide 18 · Tier journey
WhatsApp tier means his existing customers don't change anything — they
get value via the channel they already use. Matrix is opt-in upgrade.
Tier 3 is the long game.

### Slide 19 · What's already built
"Not just talk. I've already invested. This isn't a sales pitch — it's
a demo of work already done."

### Slide 20 · The ask (3 options)
**Don't push for a same-day decision.** The proof was the demo. The ask is
to keep the conversation going on terms Pete chooses. Give him optionality.
The option he picks tells you a lot about how big he wants this to get.

### Slide 21 · Closing
One last beat. **Don't say anything.** Let him close the meeting.

---

## If things go wrong

| Failure | Fallback |
|---------|----------|
| Web UI dev server doesn't start | Slides 8–11 are screenshot evidence — talk through them |
| Web UI starts but extraction times out | "Demo run took 110s last night — let me show you the recorded output" → open `demo-fixtures/pete-24apr-agent-run.txt` in terminal |
| WiFi flakes mid-stream | Same as above — paste the saved JSON output |
| Pete asks technical questions | The codebase is ready: `packages/agent/src/demo.ts` for the agent, `packages/web/src/routes/api/extract/+server.ts` for the streaming endpoint |
| Pete says "yes, when can we start?" | Don't commit dates. "Let me put together a 1-page scope for the engine swap. I'll have it to you Monday." |

---

## Lines to remember

> "Every fix has been a patch on a deterministic pipeline. The pipeline isn't
> broken — the pipeline is the problem."

> "v0 silently corrupts. v2 says 'I don't know about this part.' That's the
> honest failure mode."

> "The bug class is not patched. It is structurally absent."

> "We migrate the engine underneath your customers. They don't notice the swap."

> "Memory is the moat. Six months of clean tipster data is a moat your
> competitors can't copy in less than six months."

> "I'd rather build the right thing with you than the wrong thing for you."

---

## Things NOT to say

- "Claude is better than Gemini." (Wrong frame — agentic > deterministic.)
- "We need to throw out v0." (Frame as engine swap, not rewrite.)
- "The Conviction Game is the future." (Premature — keep it in step 6 of build order.)
- "I built this for you." (You built it because it's the right thing.
  Don't make him feel obligated.)
- "It's free." (Nothing about commercial terms is free or fixed yet.)
- Anything about Warwick, the broader $32B market, or v3+ unless he asks.

---

## After the call

- [ ] Send him a follow-up email same day. Two paragraphs max.
- [ ] Attach `PETE-DEMO.md` summary doc.
- [ ] Confirm whichever option he leaned toward.
- [ ] Schedule the next call for ~2 weeks out (per option C anyway).
- [ ] Update `MEMORY.md` with whatever he said about ownership/equity/scope.

---

## Pete's signal — what to listen for

| He says | Translation | Your move |
|---------|-------------|-----------|
| "How quickly can we cut over?" | He wants option A. He's sold. | Don't commit dates. "Let me scope it Monday." |
| "Who else have you shown this to?" | He's measuring exclusivity / urgency | "Just you. This is built around your bug history." |
| "What do you need from me?" | He's into it but unsure of cost | "Your bug list, your customer numbers, two weeks." |
| "I'd want to think about it" | Option C. Normal. Healthy. | "Of course. I'll send you the deck and the demo doc." |
| "I'm not sure I'm the right person" | He may be reaching for a partner / investor he trusts | Ask who. Could open Warwick door. |
| Silence | Reading. Don't fill it. | Wait. |

---

**Final note**: the demo did the work last night. Tomorrow the demo just has
to run. You don't need to sell — you need to let it land.
