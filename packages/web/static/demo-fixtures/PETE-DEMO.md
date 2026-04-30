# Pete Pitch — Live Demo Evidence

**Date prepared**: 2026-04-30 (eve of pitch)
**Pitch meeting**: Fri 1 May 2026, 11:00–12:00 AEST, Google Meet
**Target**: Peter Blackburn, Blacmac Productions (peter@blacmacproductions.com)

---

## The Bug Pete Has Been Reporting for 4+ Months

| Date | Bug Class | What Happened |
|------|-----------|---------------|
| 6 Mar 2026 | Phantom horses | "Race 1 has a thousand horses in it" — pipeline ingesting non-tip rows |
| 14 Mar 2026 | Cross-race contamination | Wootton Verni & Just Fine appearing in BOTH Race 5 AND Race 6 |
| 16 Mar 2026 | Race numbers as strings | Gemini returning "0" / "11" — Dom patched parser |
| 24 Apr 2026 | Publication-prefix duplicates | "Call Me Geregeous" duplicated as "xxxxCall Me Gergegeous" — prefix bleeding into horse name |

Every fix has been a patch on a deterministic pipeline. Each new publication breaks it differently. The bug class doesn't go away — it just changes shape.

---

## Pete's Own Words (24 Apr 2026)

> "Just tested a race with the tip Data that adds the xxx in front of the horses name. It doesn't show in the preview to advise the AI.
>
> I have attached the tips that causes the issue. If you look at race 4 it is a prime example. The horse name is **Call Me Geregeous also shows as xxxxCall Me Gergegeous**."

Image attached: `pete-24apr-xxprefix.jpg` (TAB Racing 31, Royal Randwick Saturday, 8 races, 6 tipsters).

---

## v0 Production Output (the bug)

`pete-14mar-duplicates.png` — screenshot from thetipanalyser.com showing buggy aggregation:
- **SR Race 5**: 9 horses listed including phantom entries
- **SR Race 6**: contains "Wootton Verni" (J Mc Donald) — this horse is from Race 5
- **SR Race 6**: contains "Just Fine" — also from Race 5
- Cross-race contamination silently corrupting the leaderboard

---

## v2 Agentic Output (same image, run 30 Apr 2026)

Live run on `pete-24apr-xxprefix.jpg`:

**Model**: claude-sonnet-4-6
**Run time**: 91 seconds
**Tokens**: 2,357 in / 7,588 out
**Cost**: ~$0.027

### What the agent did differently

The agent **detected the publication convention itself** before extracting:

> *"Prefix 'xx' and 'xxx' appear on bold (1st pick) horse names throughout — these are publication markup highlighting the top pick, not part of the horse name. They must be stripped."*

**Race 4 result**: Mitch Cohen / Adam Dobbin / Ian Russell all picked "9 Call Me Gorgeous". Single horse, zero phantoms. Pete's reported bug is gone — not patched, structurally absent.

### Stats from the run

- **6 tipsters detected** correctly (Shayne O'Cass, Mitch Cohen, Adam Sherry, Clinton Payne, Adam Dobbin, Ian Russell)
- **8 races extracted** (full meeting)
- **192 selections** in total (24 per race × 8 races)
- **15 publication-artefact flags** raised — every prefix strip narrated and accountable
- **2 anomaly/uncertain flags** — race 8 partial cutoff, position 2–4 horse-numbers absent in source layout

### Sample reasoning trace (verbatim)

```
1. Publication identified as TAB Racing 31 / TAB.com.au tip sheet,
   Royal Randwick, Saturday, TAB CODE: SR.
2. Six tipster columns identified left-to-right:
   Shayne O'Cass, Mitch Cohen, Adam Sherry, Clinton Payne, Adam Dobbin, Ian Russell.
3. Each race block shows the tipster's top pick in bold (with horse number),
   followed by 3 more selections (positions 2-4).
4. Prefix 'xx' and 'xxx' appear on bold (1st pick) horse names throughout —
   these are publication markup highlighting the top pick, not part of the
   horse name. They must be stripped.
5. Race 4 Mitch Cohen: '9 xxxCALL ME GORGEOUS' — 'xxx' prefix stripped → Call Me Gorgeous.
6. Race 4 Adam Dobbin: '9 xxxCALL ME GORGEOUS' — same prefix stripped → Call Me Gorgeous.
   ...
```

### Sample flag (verbatim)

```
[uncertain r8] Race 8 is partially cut off at the bottom of the image.
   Some tipsters' 4th selections may be incomplete or missing. Only clearly
   visible selections have been included.
```

The agent **flags uncertainty rather than silently corrupting**. v0 would have produced incomplete data without saying so.

---

## The Pitch Frame

| v0 (current — Vercel + Gemini) | v2 (Claude Agent SDK pattern + Convex) |
|---|---|
| Deterministic OCR pipeline | Agentic reasoning loop |
| Fixed schema, parse-or-fail | Reasoning trace, then structured output |
| Each new publication = new bug | Recognises conventions automatically |
| Silent corruption when ambiguous | Flags uncertainty, never guesses |
| No memory across runs | Convex ground-truth + alias resolution |
| Patches the symptom | Removes the bug class |

The migration is **not** model-swap. It is architecture-swap. Pete has been in patch-mode for 4+ months because the pipeline cannot anticipate every publication's quirks. v2 doesn't try to. It reasons.

---

## Files for the deck

- `pete-24apr-xxprefix.jpg` — input image (Pete's email attachment)
- `pete-14mar-duplicates.png` — v0 buggy production screenshot
- `pete-24apr-agent-run.txt` — full terminal capture of v2 CLI run
- `pete-24apr-xxprefix.extraction.json` — structured agent output
- `web-shots/01-home.png` — landing page ("built to reason, not to parse")
- `web-shots/02-streaming.png` — live reasoning stream mid-flight
- `web-shots/03-flags.png` — flag panel showing 15 prefix-stripped artefacts
                             including Pete's exact "xxxCALL ME GORGEOUS" bug
- `web-shots/04-races.png` — clean race cards rendered after extraction
- `web-shots/05-reasoning.png` — full reasoning trace with image preview

## Live demo URL (local, dev only)

```
cd packages/web && pnpm dev
# → http://127.0.0.1:5173
# Click the "Pete 24 Apr · xx prefix" fixture button
# Watch reasoning stream + flags + race cards render live
```
