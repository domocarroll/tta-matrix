# Official Race-Card Data for The TipAnalyser — for your decision

## Why this matters
The two issues you spotted last week — Sydney races mixing horses across races, and a horse doubling up ("I Am Dirty") — both come from the same root: **the tool has no official race card to check the tips against.** When several sheets are combined, nothing tells it which horses actually belong in Race 7, or that #1 and #11 are the same runner read two ways.

The fix is to **cross-check every tipped horse against the official field** for that race. That:
- stops cross-race mixing (a horse not in Race 7's official field gets dropped),
- merges the duplicates automatically (locks each horse to its real saddlecloth number + name),
- and lets us add **jockey and barrier** columns if you want them.

To do that, we need a reliable, legitimate source for the official card: **horse number, horse name, jockey, barrier — per race, per meeting.**

## The options

| Source | Accurate? | Cost | Notes |
|---|---|---|---|
| Perplexity (what we use now) | ✗ patchy | Free | Guesses from the open web — this is what caused the gaps. |
| TAB feed | ✓ | Commercial licence ($$$) | Built for big operators; overkill. |
| **Betfair Exchange API** | ✓ | **Free** | **Recommended.** Official, licensed source; has every field we need. |
| Punting Form licence | ✓ | Paid (~modest) | Good fallback if we ever want richer form data. |

## Recommended: Betfair Exchange API
- **Free** — Betfair's "delayed" data key costs nothing. (There's a paid live key, ~£499 one-off — we do **not** need it for race cards.)
- **Legitimate** — the data comes from a licensed operator, which keeps us on cleaner legal footing than scraping.
- **Complete** — returns horse number, name, jockey, trainer and barrier for every runner in every Australian race.
- **Reliable** — a proper data feed, not a web search. Accurate every time.

## What you'd need to do (≈5 minutes)
The key has to be set up under **your** account — it's tied to identity (gambling KYC), and it's your product and your call. Steps:
1. Have (or create) a Betfair account.
2. Generate a **free Application Key** (Betfair's developer portal walks you through it — we'll send exact click-by-click).
3. Send us the App Key, plus ideally a **dedicated data-only login** (not your personal punting account) so nothing sensitive is shared.

We handle all the wiring — it's already built and waiting on the key.

## Cost
**$0** for what we need (free delayed key). No deposits, no subscription.

## Legal note (plain English — not legal advice)
- Using the official card **internally, to clean and validate your tips**, is low-risk.
- The grey area is **publicly displaying the full official field** (every runner's jockey/barrier) on your website — Australian racing bodies regulate "publishing race-field data."
- Two safe paths: **(a)** we use the card only to correct your tips, and you keep publishing *your tips* (the existing columns) — lowest risk; or **(b)** if you want to show full fields, a quick one-off check with an AU racing/gaming lawyer confirms you're clear (cheap insurance).
- We'll follow whichever you prefer.

## Your decision
1. **Set up the free Betfair key** (recommended) — most accurate, $0, fixes the mixing/double-ups.
2. **Prefer a paid data licence** (Punting Form / official feed) — we'll scope the cost.
3. **Leave as-is for now** — it works, but the mixing/double-ups can recur on multi-sheet meetings.

*Happy to walk through any of this on Friday.*
