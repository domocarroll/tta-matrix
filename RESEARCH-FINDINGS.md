# Research Findings — 30 March 2026

Three parallel research agents completed. Key findings that affect the build plan:

---

## 1. Claude Agent SDK vs Direct API

**Finding**: The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) IS real and production-ready. BUT it wraps the Claude Code CLI under the hood — requires `@anthropic-ai/claude-code` installed globally. Heavier deployment.

**Decision**: **Keep the current approach.** The codebase already uses `@anthropic-ai/sdk` directly with a manual agentic loop. This gives more control, lighter deployment, and is perfectly suited to a Matrix bot. The Agent SDK is better for coding assistant-style agents, not embedded bots.

**No code changes needed.**

---

## 2. Semaphore v4 Works FULLY Off-Chain

**Finding**: This is the biggest win. Semaphore v4's `verifyProof()` is pure TypeScript. No blockchain required.

```typescript
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, verifyProof } from "@semaphore-protocol/proof"

// Client-side: user proves anonymous membership
const identity = new Identity("user-secret")
const group = new Group(allCommitmentsFromConvex)
const proof = await generateProof(identity, group, voteValue, scopeId)

// Server-side (Convex action): verify anonymously
const isValid = await verifyProof(proof)
// Check nullifier hasn't been used, store it
```

**Impact**: Phase 5 (ZK Privacy) is dramatically simpler than planned. No chain needed. Store group membership tree in Convex. Proof generation runs client-side (WASM). Verification runs in Convex actions.

**Package**: `@semaphore-protocol/core` (v4.9.0+, audited, stable)

---

## 3. MACI Requires On-Chain (Can't Go Off-Chain)

**Finding**: MACI's anti-collusion guarantees are architecturally tied to smart contracts. Can't run off-chain.

**Decision**: For Phase 5, implement the anti-collusion property differently:
- Use a **simpler commitment + key-change scheme** stored in Convex
- The key insight: what makes cartels unenforceable is that members can secretly change their vote. This can be implemented as a re-commitment window before final tally — no blockchain needed.
- Full MACI integration (Phase 7+) only if/when on-chain settlement is needed for B2B credibility.

---

## 4. Convex Crons Replace Cloudflare Workers

**Finding**: Convex scheduled functions + cron jobs are production-ready. 10-minute action timeout. Node.js runtime for external fetch.

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
const crons = cronJobs();
crons.cron("scrape-fields", "0 18 * * *", internal.scraping.scrapeFields);
crons.interval("scrape-results", { minutes: 15 }, internal.scraping.scrapeResults);
export default crons;
```

**Impact**: **Eliminates the CF Worker entirely.** Scraping moves into Convex actions. One less deployment target. One less set of secrets. The entire backend is Convex.

**Revised architecture**:
```
BEFORE: CF Worker (cron) → Convex (data) → Matrix Bot (interface)
AFTER:  Convex (cron + data) → Matrix Bot (interface)
```

---

## 5. Convex Fuzzy Search Removed

**Finding**: Fuzzy search was deprecated and removed January 2025. Only exact prefix matching.

**Impact**: Horse name matching (tip extraction vs pre-populated fields) needs a normalisation layer. Options:
1. Normalise all horse names on ingest (uppercase, strip punctuation)
2. Use vector search for semantic similarity (overkill)
3. Let Claude handle the fuzzy matching in the agent (it already does this natively — "WINX" matches "Winx")

**Decision**: Option 3. The agent already has access to the horse list via tools. Claude handles name normalisation natively during extraction. No additional infrastructure needed.

---

## 6. Matrix Bot SDK Confirmed

**Finding**: `matrix-bot-sdk` v0.8.0 (January 2026), now maintained by Element HQ. Correct choice. Current codebase already uses it properly.

**No changes needed.**

---

## 7. mautrix-whatsapp — Works but Account-Ban Risk

**Finding**: v26.03 (March 2026). Works well technically. But WhatsApp actively detects bridge traffic and bans accounts.

**Decision**: WhatsApp onramp is still valuable but is an operational risk, not a technical one. Mitigations:
- Use a dedicated phone number (not personal)
- Comply strictly with WhatsApp Commerce Policy
- Have Telegram as fallback channel
- Consider WhatsApp Cloud API (official) when scale justifies the cost

---

## 8. Noir > Circom for Custom Reputation Proofs

**Finding**: Noir (Aztec Labs) has a Rust-like syntax, compiles to WASM, runs in TypeScript via `@noir-lang/noir_js`. Still beta but functional. 30x faster than Circom for some circuits. No manual R1CS thinking.

**Decision**: When custom reputation circuits are needed (Phase 5.4 — "prove my strike rate > X%"), use Noir instead of Circom. Lower learning curve, TypeScript-native, off-chain capable.

---

## Architecture Revision Summary

### Before (5 deployment targets):
```
Convex Cloud (data)
Cloudflare Worker (scraper)
Hostinger VPS (Matrix bot)
Hostinger VPS (WhatsApp bridge)
Base L2 (ZK commitments)
```

### After (2 deployment targets):
```
Convex Cloud (data + scraping + settlement + ZK verification)
Hostinger VPS (Matrix bot + WhatsApp bridge)
```

Base L2 deferred to Phase 7+. Everything else consolidated.
