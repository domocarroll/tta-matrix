# Cutover Plan · v0 → v2 on thetipanalyser.com

**Status:** awaiting Pete's go-ahead
**Target:** zero downtime, side-by-side soak, customer-data continuity, one-click rollback

---

## Phase 0 · Decisions (before any cutover)

Pete confirms:

- [ ] **Cutover style:** A) hard cutover with rollback or B) side-by-side soak (recommend B)
- [ ] **Auth provider:** A) Convex Auth + Resend OTP (free) or B) Clerk ($25/mo) or C) carry over v0's auth
- [ ] **Subdomain for old version:** typically `old.thetipanalyser.com` for B above
- [ ] **Soak period length:** 7 days minimum recommended
- [ ] **Customer notification:** does Pete email customers about the upgrade? Suggest: yes, soft-launch language

---

## Phase 1 · Pre-cutover setup (~1 day, no customer impact)

### 1.1 Auth migration (4-8 hours)

If Convex Auth + Resend:
- [ ] Add `@convex-dev/auth` to `packages/convex`
- [ ] Configure Resend with custom from-domain
- [ ] Add `convex/auth.ts` with email OTP provider
- [ ] Update `extractions` schema: replace `clientId: v.string()` with `userId: v.id("users")` (migration via dual-write window)
- [ ] Update `+page.svelte` to use Convex Auth client
- [ ] Add `/auth/sign-in` route
- [ ] Test: new sign-up → extract → see in history; sign out → sign in same email → history preserved

If Clerk:
- [ ] Add Clerk Pages product
- [ ] Set Clerk publishable + secret keys as Pages secrets
- [ ] Wire `clerk-svelte` provider in `+layout.svelte`
- [ ] Convex auth.config.ts integration with Clerk JWT
- [ ] Same migration as above for `extractions`

### 1.2 Customer data migration (2-4 hours)

- [ ] Pete exports his v0 customer list (email + any historical extractions)
- [ ] Build `scripts/import-v0-customers.ts` — for each customer:
  - Create user record in new auth provider
  - Send welcome email with "your account moved" link
  - If v0 has historical extractions, insert them with the new user's `userId`
- [ ] Dry-run on staging first
- [ ] Verify random sample of migrated customers

### 1.3 Branding pass (1-2 hours)

- [ ] Replace "v2 · agentic · Pete demo" eyebrow with thetipanalyser branding
- [ ] Update favicon (currently subfracture wordmark)
- [ ] Update title metadata
- [ ] Update footer copyright

### 1.4 Feature parity audit (variable)

v0 has these features that v2 currently doesn't:
- [ ] **Review/edit step** — let user correct extraction before save. Decision: keep (replicate) or drop (v2 is accurate enough)
- [ ] **Multi-photo upload** — process multiple tip sheets in one session. Decision: keep (replicate) — punters often have multiple images
- [ ] **Horse details photos** — secondary upload for full form pages. Decision: keep (later phase) or drop
- [ ] **Export button** — JSON / CSV download. Decision: easy add, ~2 hours
- [ ] **Share button** — social media sharing of results. Decision: lower priority

### 1.5 Domain prep (15 min, requires Pete)

- [ ] Pete adds CF Pages custom domain in dashboard:
  - For side-by-side: `staging.thetipanalyser.com` or `next.thetipanalyser.com`
  - For hard cutover: `thetipanalyser.com` (only after soak)
- [ ] Verify DNS propagation
- [ ] Test custom domain serves the app + secrets work

---

## Phase 2 · Side-by-side soak (recommended; 7 days)

### 2.1 Launch staging URL (Day 0)

- [ ] `staging.thetipanalyser.com` → CF Pages
- [ ] `thetipanalyser.com` → still v0 on Vercel
- [ ] Pete emails his most engaged customers (10-20) inviting them to try v2
- [ ] Add `Try the new version →` banner on v0 site linking to staging

### 2.2 Monitor (Days 1-7)

- [ ] Daily: check Convex dashboard for extraction volume, errors
- [ ] Daily: check Cloudflare Pages analytics for traffic
- [ ] Daily: check Anthropic console for spend
- [ ] Mid-week: 1-on-1 with Pete to gather customer feedback
- [ ] End-week: any bugs reported? any feature requests?

### 2.3 Decision (Day 7)

- [ ] Soak passed (no critical bugs, customer feedback positive) → Phase 3
- [ ] Soak failed → fix, restart soak

---

## Phase 3 · Hard cutover (~30 min, requires Pete)

### 3.1 Pre-cutover checks

- [ ] Backup v0 database
- [ ] Verify all migrated customers can sign in to v2
- [ ] Verify no in-flight customer sessions on v0 (or accept their session loss)
- [ ] Cloudflare Pages secrets confirmed
- [ ] Convex prod deployment (not dev) ready: `npx convex deploy`

### 3.2 The swap

- [ ] In CF Pages dashboard: add `thetipanalyser.com` as custom domain (proxied)
- [ ] In Pete's DNS provider: update A record / CNAME to CF Pages target
- [ ] Verify SSL certificate provisions (auto via CF)
- [ ] Smoke test: visit thetipanalyser.com, sign in, run extraction
- [ ] Set `staging.thetipanalyser.com` to redirect to root (or take down)
- [ ] Set `old.thetipanalyser.com` → v0 Vercel (preserved for 30 days as rollback)

### 3.3 Post-cutover monitoring (24h)

- [ ] Cloudflare analytics every 2 hours
- [ ] Convex dashboard every 4 hours
- [ ] Customer-facing email: "we just upgraded the engine. tell us if anything looks off."
- [ ] Watch for support tickets / emails

### 3.4 Hold v0 for rollback (30 days)

- [ ] Don't decommission Vercel project for 30 days
- [ ] Don't delete v0 Supabase / data store for 30 days
- [ ] Keep `old.thetipanalyser.com` resolving to v0
- [ ] Document rollback procedure (point DNS back to Vercel)

---

## Rollback procedure (if needed)

1. In Pete's DNS: revert A record / CNAME to v0 Vercel
2. Allow 5-15 minutes for DNS to propagate
3. Verify `thetipanalyser.com` serves v0 again
4. Communicate: "we've reverted the engine while we investigate"
5. v2 data persists on Convex; nothing lost

---

## Cost projections

| Service | Stage 1 cost | At 1000 active customers/mo |
|---|---|---|
| Cloudflare Pages | free | free (huge headroom) |
| Convex | free (dev tier, 1M function calls) | ~$25/mo (production tier) |
| Anthropic | ~$0.15 per extraction | ~$150-450/mo (1k customers, 1-3 extractions/wk) |
| Resend (if used for OTP) | free up to 3000/mo | ~$20/mo |
| Clerk (if chosen) | free up to 10k MAU | $25-99/mo depending on tier |
| **Total monthly** | **~$0-25** | **~$200-550** |

Pete's current Vercel + Gemini costs are unknown but likely comparable. Net cost change: probably small. Net capability change: massive.
