# Pete demo — live now

**URL:** https://tta-pete-demo.pages.dev/classic

**Backend:** Claude via local CLIProxyAPI → cloudflared quick-tunnel
(`https://chamber-lined-practices-tournament.trycloudflare.com`).
Bypasses the rate-limited Anthropic key. Keep this laptop online — tunnel +
proxy must stay up during the call.

---

## What's new since last week (lead with this)

> "You told me you want to upload the official cards and approve them
> before tips anchor. That's now live."

Per-meeting button **"upload race cards →"** lets you drop the official
acceptance card image(s). Claude extracts every runner
(number · horse · jockey · trainer · barrier · scratched). You get a
**review table** — fix anything, mark scratchings — then **"approve &
lock field"**. From that moment, every tip on that meeting is anchored
to your approved field. No Perplexity. No guessing.

---

## Demo flow (5 minutes)

### 1. Drop tip sheets first
- Open `/classic`
- Pick **Sydney**
- Drop one of his weekly sheets (or click the fixture button on
  `/workspace` — `Pete 24 Apr · "xx prefix"`)
- Watch the meeting card appear in seconds

### 2. Show the new button
- Top-right of the meeting card: **"upload race cards →"** (accent colour, prominent)
- Click it — modal opens

### 3. Upload the official card
- Drop the official meeting card image(s) — one or many
- Modal shows **"Reading the card…"**
- Lands on the **review table**: every race, every runner, every field
  editable

### 4. Walk the review surface
- Point out: editable horse number, name, jockey, trainer, barrier
- **Scratched checkbox** per row — visually strikes through
- **Remove** button per row for spurious extractions
- "edit any field — then approve to lock in" caption

### 5. Approve
- Click **"approve & lock field →"**
- Modal flips to "Field approved. Tips are now anchored to your authoritative card."
- Closes
- Meeting card chip flips: `FIELD ✓` with `user-approved · <filenames>` as the source
- **Tips re-anchor automatically** — the "xx-prefix" duplicate-row bug
  is resolved against HIS source, not Perplexity's guess

### 6. Talk about the principle
> "Perplexity was a stopgap. The real architecture is:
> **your card → your approval → your truth.** Everything anchors to
> what you signed off on. We never overwrite it. Late scratchings? Open
> the card again, edit, re-approve. Done."

---

## Talking points if asked

**Why this matters (vs. last week's Perplexity demo):**
- Perplexity guesses from the public web. Sometimes the field isn't
  published yet, or the source is partial.
- Your approval is the contract. The system never invents — it
  extracts, asks you, locks.

**Auth / accounts:**
- Still single-user (per-browser ID). When Pete's ready to onboard
  customers, we wire real auth in a day.

**Cost:**
- Backend Claude usage is on your Claude Code subscription via the
  proxy (essentially free for this volume). Anthropic key remains as
  a fallback for when you want it.

---

## Fallback if something breaks live

1. **Refresh** — most issues are transient stream drops.
2. **Try the workspace surface** at `/workspace` — same engine, dark
   theme, also has the upload button.
3. The fixture buttons on `/workspace` give you a known-good extraction
   in ~100s if you want a baseline meeting visible quickly.

---

## What's still Pete's ball (unchanged)

- DNS swap to `thetipanalyser.com` (5 min — his domain)
- His own Anthropic key when he wants to take ownership
- Multi-customer auth when he wants to migrate v0 customers
