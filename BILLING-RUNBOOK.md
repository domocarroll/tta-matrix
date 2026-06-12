# TTA Billing & Handoff — Org for Pete

**Model:** You create a dedicated Anthropic **organization for Pete**, fund it
with a small starter balance to unblock him today, mint a workspace-scoped key
for prod, and invite Pete as Admin so he takes over billing (his card) later.
Anthropic is the merchant, meter, and balance-enforcer — no Stripe, no code.

> Why a *dedicated org*: billing/credits live at the **org** level, not the
> workspace. A separate org keeps Pete's spend (and his future card) cleanly
> isolated from any other Anthropic work. A workspace inside it scopes the key
> and a spend cap, but the credit balance is per-org.

---

## Do this now (≈10 min, console.anthropic.com)

### 1. Create the org
- Org switcher (top-left) → **Create organization** → name it `TipAnalyser — Pete Blackburn`.
- Switch into the new org for all steps below.

### 2. Fund it (starter, to unblock today)
- **Settings → Billing** → **Buy credits** → **$25** prepaid.
- Leave **auto-reload OFF** (prepaid = hard ceiling, no surprise bill).
- Use your card for now; Pete swaps to his when he takes over (step 6).

### 3. Workspace + spend cap (runaway-loop breaker)
- **Settings → Workspaces → Create Workspace** → `TTA-Pete`.
- Set a **monthly spend limit** (e.g. **$40/mo**). A bad loop can't drain the balance.

### 4. Mint the prod key
- **API Keys → Create Key** → scope to the **`TTA-Pete`** workspace → copy once.
- This is the `ANTHROPIC_API_KEY` for Cloudflare (step 5).

### 5. Wire prod (Cloudflare Pages → `tta-pete-demo` → Settings → Env vars)
| Var | Value |
|---|---|
| `ANTHROPIC_API_KEY` | the key from step 4 |
| `TTA_MODEL` | `claude-sonnet-4-6` |
| `ANTHROPIC_BASE_URL` | **DELETE IT** (the proxy is gone; dead config) |

Then redeploy. (The code already always-calls Anthropic direct — this key is
what makes it work and what the old broken proxy was bypassing.)

### 6. Invite Pete (hand over billing)
- **Settings → Members → Invite** → `peter@blacmacproductions.com` → role **Admin**.
- Admin lets Pete add **his own card** under Billing when he's ready. Once he does,
  remove your card. From then on Pete tops up his own org — that's "Pete tops it up."

---

## What this gets you

- **Pete's upload bug fixed** at the root: prod calls Anthropic direct with a real,
  funded key. No proxy to die.
- **Throughput unblocked:** a funded org climbs the rate tier → no more ~50s/sheet.
- **Billing handled, no engineering:** prepaid credits, $40/mo workspace cap, Pete
  self-tops-up as Admin. Spend is tiny — see costs below.

## Cost reality (so the $25 makes sense)

- Weekly pull (~20 sheets) ≈ **$1.50** on Sonnet-V2. **$25 ≈ ~4 months.**
- Top-up is a roughly-quarterly event Pete does himself. No wallet, no metering.
- Lever if it ever matters: `TTA_MODEL=claude-haiku-4-5` (~⅓ cost, 99.6% in eval).

## After Pete has the key — I can help

- Quick **key sanity test** (one real extraction) to confirm prod auth works before
  you tell Pete it's live.
- The **live e2e** (drop one of Pete's real images through `/work`) — the final
  "it's fixed" gate.

## Limits / graduate later

Pete-only, single org. At customer #2: one master key + metered wallet + Stripe
(Rung 2) and real auth. Not now. See `memory/tta-compound-extraction-architecture.md`.
