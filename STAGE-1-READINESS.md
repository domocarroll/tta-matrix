# Stage 1 · Readiness

**Goal:** drop-in v0 replacement on `thetipanalyser.com` — same upload UX,
agentic backend, plus persistent per-customer history.

**Date:** 2026-05-01
**Live at:** https://tta-pete-demo.pages.dev/ (staging)

---

## What's done (no Pete cooperation required)

| Capability | Status | Where |
|---|---|---|
| Agentic image extraction | ✅ live | `/` (drop image, watch reason) |
| Streaming reasoning trace | ✅ live | server: `api/extract/+server.ts` |
| Per-customer extraction history | ✅ live | `/history` |
| Detail view with reasoning + flags + races | ✅ live | `/history/[id]` |
| Per-row delete | ✅ live | history list |
| Stats strip (extractions, selections, flags) | ✅ live | history list |
| Cached replay fallback (`?cached=pete-24apr`) | ✅ live | demo safety net |
| v0 comparison panel | ✅ live | bottom of `/` and `/history/[id]` |
| Convex schema with `extractions` table | ✅ deployed | `dev:ardent-hound-725` |
| `clientId` localStorage identity | ✅ live | bridge to real auth |
| Cloudflare Pages deployment | ✅ live | `tta-pete-demo.pages.dev` |
| ANTHROPIC_API_KEY + CONVEX_URL secrets | ✅ set | wrangler pages secrets |

End-to-end verified: drop image → reasoning streams → flags render → row appears in `/history` → click row → full detail with all 54 reasoning steps. Tested on production CF deployment.

---

## What's blocked on Pete

| Need | Why | Time once unblocked |
|---|---|---|
| **DNS access to `thetipanalyser.com`** | Cutover requires CNAME or A-record swap | 5 min |
| **Customer list / data export from v0** | Migrate existing customer histories so they don't lose anything | 2-3 hours of script work + a soak |
| **Decision on auth provider** | Convex Auth (free) vs Clerk (paid, polished) vs custom email-OTP | 4-8 hours to implement + test |
| **Decision on cutover style** | Hard cutover with rollback OR side-by-side soak (`old.thetipanalyser.com` + `thetipanalyser.com`) | depends on choice |
| **Branding pass** | Replace "v2 · agentic · Pete demo" with thetipanalyser branding | 1-2 hours |
| **Feature parity audit** | v0 has review/edit step + horse details photos + export/share — decide whether to keep, drop, or replicate | 1-3 days depending on which |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `clientId` collision (two browsers, same UUID) | Vanishing low (random 122-bit) | Customer sees someone else's history | Real auth before public launch |
| Pete's customers lose history at cutover | Medium | Trust hit | Side-by-side soak + migration script |
| Cloudflare Workers timeout on long extractions | Low (verified at 114s on paid plan) | One extraction fails; user retries | Already streams; 5-minute paid plan ceiling |
| Anthropic rate limit at peak load | Medium | Slow extractions Saturday morning | Add per-IP throttle; Convex action queue if needed |
| Convex free tier quota exhausted | Low (massive headroom for v0 audience) | Read errors | Upgrade plan ($25/mo) |
| Image PII in extractions | Low (tip sheets are public publications) | Privacy concern | Document retention policy; add `delete` UX (already done) |
| Domain ownership of `tta-pete-demo.pages.dev` | None | None | Custom domain swap is reversible |

---

## Stage 1 → Stage 2 roadmap

Once Stage 1 is live on his domain and his customers are migrated:

| Step | Description | Estimate |
|---|---|---|
| Real auth swap | Replace `clientId` localStorage with Convex Auth or Clerk; migrate existing rows | 1-2 days |
| Image storage | Wire Convex `_storage`; update detail view to render saved images | 0.5 day |
| Race-fields scraper | Convex action + cron pulling racenet.com.au or similar nightly | 3-5 days |
| Race-results scraper + auto-settlement | Wire to existing `races.recordResult` mutation | 3-4 days |
| Tipster reliability scores live | Already coded in `tipsters.ts`; just needs settlement signal | 1 day |
| Public leaderboard | New `/leaderboard` SvelteKit route | 3 days |

Total Stage 2: **~3 weeks** of focused work.

---

## What to demo Pete tomorrow morning

The same pitch deck, but you can now also show:

1. The same extraction flow he's used to in v0...
2. ...automatically saved to a persistent history he can revisit
3. Tap his clientId in localStorage → "every customer gets the same surface"
4. Click into a past extraction → "every reasoning step preserved, auditable, replayable"

The history surface IS the strongest material answer to "where does this go?"
v0 is stateless. v2 compounds. Pete's customers won't know the engine swapped;
they'll only know the app suddenly remembers them.
