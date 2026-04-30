# The Conviction Game — Intelligence Briefing

**Prepared for**: Warwick
**Date**: 30 March 2026
**Classification**: Confidential — Strategic Intelligence
**Author**: Dom Carroll / Danni (SUBFRAC.OS)

---

## How to Read This Document

This briefing introduces six concepts one at a time, then shows how they combine into something none of them are alone. The synthesis won't land without the concepts. The concepts won't make sense without the problem. Start at the beginning.

---

## I. THE PROBLEM

### What Punters Already Do

Every Saturday, thousands of punters across Australia perform the same ritual. They study the form. They read the tip sheets. They argue with their mates. They develop private convictions about which horses will win. Then they bet — individually, into a system designed to take their money.

The collective intelligence of those punters — the aggregate of all their private knowledge, pattern recognition, trackwork observations, stable whispers, and hard-won intuition — is extraordinary. It consistently outperforms any individual tipster. But that intelligence is never captured, never aggregated, never returned to the people who generated it.

The bookmaker captures it. Through odds movement, through market depth, through the flow of money. They absorb the crowd's intelligence, adjust their prices, and profit from the spread between what punters collectively know and what individuals can act on.

### What's Actually Broken

This isn't a technology problem. It's a structural one.

The Australian wagering market is worth $32 billion annually. Three operators — Sportsbet, Ladbrokes, and TAB — control the vast majority of it. They are, in effect, information extractors. Punters generate intelligence through their betting patterns. The bookmaker absorbs that intelligence, adjusts odds, and keeps the edge.

The punter commons — the pub conversations, the WhatsApp groups, the racing forums where collective wisdom once lived — has been enclosed. Not destroyed. Enclosed. The intelligence is still there in every punter's head. There's just no mechanism to aggregate it honestly and return it to the people who generated it.

The existing alternatives don't solve this:

| Platform | What It Does | What It Doesn't Do |
|----------|-------------|-------------------|
| theGreatTipOff | Aggregates tipster selections | No conviction weighting. Tips are binary (pick or don't). No measure of confidence |
| Betfair | Peer-to-peer betting exchange | Still a betting platform. House model. No community intelligence |
| Punting Form | AI form analysis (acquired for A$20M) | Single model, no community input, no collective intelligence |
| Polymarket | Prediction markets ($9B valuation) | Banned in Australia (Aug 2025). No racing. No privacy |

None of them capture what punters actually have: private conviction of varying intensity about uncertain outcomes that resolve against objective truth.

That sentence contains six concepts. Each one matters. Let's build them.

---

## II. THE CONCEPTS

### Concept 1: Ground Truth

This is the simplest concept and the most important.

Horse racing provides something almost no other prediction domain offers: **objective, unchallengeable, publicly verifiable truth, delivered every thirty minutes.**

Race 1 at Randwick starts at 12:00. By 12:02, we know who won. There is no ambiguity. No interpretation. No committee that decides. The horse crossed the line first. That's ground truth.

Compare this to:
- **Politics**: Who "won" a debate? Contested for weeks.
- **Economics**: Was that policy successful? Debated for decades.
- **Sports betting (match outcomes)**: Weekly at best. Monthly for season-long markets.

Horse racing delivers 8-10 ground truth events per meeting, 3-4 meetings per day, 6 days per week. That's roughly **200 objective truth events per week**.

Why does this matter? Because any system that claims to aggregate intelligence needs a way to test whether that intelligence was actually correct. Ground truth is the exam. Horse racing gives you an exam every thirty minutes.

**This is why horse racing is the wedge — not because it's the biggest market, but because it's the fastest truth clock available.**

---

### Concept 2: Conviction

Current tipping platforms treat tips as binary. You either pick Horse 5 or you don't. But punters don't think in binary. They think in gradients of confidence:

- *"I'm absolutely certain Horse 5 wins Race 3"*
- *"I think Horse 2 has a good chance in Race 7, but I'm not as sure"*
- *"Race 4 is wide open, but if I had to lean somewhere, maybe Horse 9"*

These are three very different levels of conviction. A tipping platform that treats them identically is throwing away the most valuable information punters possess: **how confident they are.**

A **conviction allocation** captures this. Instead of picking a horse, you allocate credits — a limited budget — across outcomes. Put 10 credits on Horse 5 in Race 3 because you're certain. Put 2 credits on Horse 2 in Race 7 because you think so but aren't sure. Put nothing on Race 4 because you have no edge.

The budget constraint is critical. You can't put maximum conviction on everything. You have to prioritise. That prioritisation IS the intelligence. It forces honesty about where you actually have an edge versus where you're guessing.

---

### Concept 3: Quadratic Cost

Here's where it gets interesting.

If conviction allocation were linear — 1 credit = 1 vote, 10 credits = 10 votes — then anyone with a large credit balance could dominate the signal. Whales would drown out everyone else. The aggregate would reflect the richest players, not the wisest ones.

**Quadratic cost** solves this with a single mathematical rule:

```
The cost of expressing conviction grows as the square of the conviction.

1 vote  =  1 credit
2 votes =  4 credits
3 votes =  9 credits
4 votes = 16 credits
5 votes = 25 credits
```

To express twice as much conviction, you pay four times as much. To express five times as much conviction, you pay twenty-five times as much.

This has a profound structural effect:

**Distributed honest conviction produces 3.3x more signal per credit than concentrated manipulation.**

Here's why. Suppose a cartel has 100 credits and wants to push Horse 5. If they put all 100 credits on Horse 5 through one account, they get 10 votes (because sqrt(100) = 10). But if 100 honest punters each spend 1 credit on their genuine conviction, they produce 100 votes. The honest crowd gets 10x the signal for the same total spend.

Even in less extreme scenarios, the geometry always favours distributed genuine conviction over concentrated manipulation. The cost surface is a paraboloid — pushing it in one direction gets exponentially more expensive. The honest majority sits in the valley. The manipulator pushes uphill.

**Quadratic cost doesn't just discourage manipulation. It makes the mathematics of the system structurally defend honest signal.**

---

### Concept 4: Zero-Knowledge Proofs

This concept sounds technical. It isn't, once you see what it does.

A zero-knowledge proof lets you prove something is true without revealing anything else about it. Three examples:

1. **"I am a member of this community"** — proved without revealing which member you are.
2. **"I predicted Horse 5 would win before the race"** — proved by opening a commitment (a sealed envelope with a timestamp) after the race.
3. **"My track record over the last 50 races is 34% strike rate"** — proved without revealing which races, which horses, or which person you are.

Why does this matter for racing intelligence?

**Privacy prevents social conformity.** If everyone can see what the best tipster picked before they make their own allocation, most people will just copy them. The aggregate stops being independent observations and becomes an echo chamber. ZK means you allocate in private. Your conviction is genuinely yours.

**Anonymous reputation is the breakthrough.** Currently, tipster reputation requires identity. You know Tony's track record because Tony publishes under his name. But what if you could prove your track record without revealing who you are? Then reputation becomes pure signal — verified accuracy, nothing else. No fame bias, no marketing, no credentialism. Just: *were you right?*

The underlying technology is called **Semaphore** (for anonymous group membership) and **MACI** (for anti-collusion — more on that next). Both are production-grade, backed by the Ethereum Foundation, and have been running in the wild since 2020.

---

### Concept 5: Anti-Collusion (MACI)

The obvious attack on any conviction system is the cartel. Five mates agree in a WhatsApp group: "We're all going to pile conviction on Horse 3 to skew the signal, then bet against it on Sportsbet."

Quadratic cost makes this expensive. Zero-knowledge makes it hard to verify who complied. But there's a third mechanism that makes cartels **structurally unenforceable**.

**MACI** — Minimum Anti-Collusion Infrastructure — introduces a single devastating primitive: **the silent key change.**

Here's how it works. Every participant has a cryptographic key. When they allocate conviction, they sign it with their key. But at any point, they can silently generate a new key — and their previous allocations are overridden by their new key's allocations.

What this means for the cartel: the cartel leader says "everyone put 5 votes on Horse 3." The members comply. But any member can secretly change their key and reallocate their votes honestly — and the cartel leader cannot tell. The override is invisible until the final tally.

This makes bribery and coercion **unenforceable at the protocol level.** You can promise to vote a certain way, but nobody can verify that you actually did. The rational move for any cartel member is to silently defect and vote honestly — because honest voting builds their reputation, and the cartel leader can't punish defection they can't detect.

**MACI doesn't catch cartels. It makes them impossible to coordinate.**

---

### Concept 6: Social Deduction

The final concept comes not from cryptography or economics, but from game design.

Games like **Blood on the Clocktower** and **Among Us** have a specific structure:

- **Night phase**: Private actions. Players do things in secret.
- **Day phase**: Public discussion. Players share information, accuse, defend.
- **The tension**: Some players are honest. Some are lying. Nobody knows who.

This structure creates engagement that no amount of gamification can replicate, because the drama is emergent — it comes from the tension between trust and suspicion, from the social dynamics of trying to figure out who's telling the truth.

The Conviction Game maps directly:

| Social Deduction | The Conviction Game |
|-----------------|-------------------|
| Night phase (secret actions) | Pre-race conviction allocation (private, simultaneous, ZK-hidden) |
| Day phase (public discussion) | Post-race forensics (results settle, patterns surface, community discusses) |
| Townsfolk (honest players) | Punters with genuine conviction |
| Impostors (deceptive players) | Cartels or manipulators skewing the signal |
| Investigations | Statistical anomaly detection ("unusual conviction concentration in Race 4") |
| Voting to exile | Reputation decay for systematically wrong or correlated accounts |

The critical insight: **punters who would never care about ZK proofs or quadratic voting WILL care about catching someone gaming the system.** That's pub talk. That's drama. That's content.

The game creates engagement. Engagement creates data. Data creates intelligence. Intelligence creates edge. The game IS the product.

---

## III. THE SYNTHESIS

### How the Six Concepts Combine

None of these concepts alone is sufficient. Together, they form a closed system:

```
Ground Truth (objective reality every 30 min)
    provides the exam for...
Conviction (graded belief, not binary picks)
    priced by...
Quadratic Cost (distributed honesty beats concentrated manipulation)
    protected by...
Zero-Knowledge Proofs (private allocation, anonymous reputation)
    hardened by...
Anti-Collusion (cartels can't coordinate because defection is invisible)
    experienced as...
Social Deduction (the game that makes all of this engaging)
    validated by...
Ground Truth (the loop closes)
```

The system is a loop. Ground truth tests conviction. Quadratic cost shapes honest expression. ZK preserves independence. MACI prevents coordination attacks. Social deduction makes it feel like a game. And then ground truth comes again — every thirty minutes — and the loop tightens.

**Over iterated play, honesty becomes the dominant strategy for any participant with a time horizon longer than approximately 20 races.** This isn't an aspiration. It's a mathematical property of the mechanism. The game theory proves it.

### What This Produces

The aggregate conviction signal — the sum of all private allocations, weighted quadratically, verified against ground truth — is a **collective intelligence instrument**. It tells you:

- Which horses the community genuinely believes will win (not just which ones the loudest tipster picked)
- How concentrated or distributed that belief is (consensus vs. divided opinion)
- Which races have unusual conviction patterns (anomaly detection)
- Which participants have the most accurate track records (anonymous, verified)

This is information that doesn't exist anywhere else. Not from the bookmaker (they see money flow, not conviction intensity). Not from tipping platforms (they see binary picks, not graded belief). Not from the market (odds reflect money, which reflects bankroll size, not analytical skill).

**The Conviction Game produces intelligence that no other structure can produce, because no other structure captures private conviction at graded intensity under quadratic cost with zero-knowledge privacy, settled against relentless ground truth.**

---

## IV. THE GAME IN PRACTICE

### What a Saturday Looks Like

**Morning (Pre-Race)**

The day's race fields are published. Tip sheets arrive — images from newspapers, racing websites, social media. The system extracts structured data from these images using AI vision (this component is already built and working in production).

Each participant receives their credit budget for the day. They study the form. They read the tips. They consult their own analysis. Then they allocate — privately, simultaneously, with nobody seeing anyone else's allocations.

**During Racing (30-Minute Loops)**

Each race follows the same cycle:

1. **Night Phase** — Allocations close 5 minutes before the race. Private. Encrypted. ZK-hidden.
2. **Dawn** — The race runs. Ground truth arrives. All allocations settle automatically. Credits redistribute based on accuracy.
3. **Day Phase** — Aggregate statistics are revealed. "Race 3 had high conviction concentration on Horse 5." Anomaly signals surface. "An unusual pattern was detected in Race 7 allocations." Individual allocations remain private.
4. **Dusk** — Community discussion. Who was right? Who saw it coming? Anyone want to voluntarily open their commitment and prove they called it? Social currency moment.

This loop repeats 8-10 times per meeting. Each loop is a complete game cycle with resolution.

**Evening (Reflection)**

Daily stats update. Leaderboard moves. Reputation adjusts. The Analyst checks their strike rate. The Socialiser relives the day's drama. The Shark reviews the anomaly patterns, looking for manipulators.

### Four Player Archetypes

| Archetype | Motivation | What They Do |
|-----------|-----------|-------------|
| **The Analyst** | Prove they're the best. Leaderboard position. | Studies form obsessively, optimises strike rate, lives for the numbers |
| **The Punter** | Discovery. Finding an overlay nobody else saw. | Hunches, longshots, varied allocations, the thrill of the unlikely call |
| **The Socialiser** | Belonging. Community IS the product. | Lives in chat, discusses tips, builds alliances, shares stories |
| **The Shark** | Power. Catching the gamers. | Hunts anomaly patterns, exposes manipulation, forensic analysis |

The Shark archetype is crucial. It doesn't exist on any current tipping platform. Social deduction dynamics create it. The Shark is the immune system — and they play the game because hunting manipulators is genuinely fun.

### Reward Structure (Nested Loops)

```
Micro  (per race):    Credits gained or lost from this allocation
Meso   (per day):     Daily P&L, strike rate, daily forensics
Macro  (per season):  Reputation score, leaderboard position, tier access
Meta   (lifetime):    ZK-provable career track record — portable, anonymous, verified
```

---

## V. HYBRID INTELLIGENCE

### The Next Layer: Synthetic Observers

Everything described so far works with human participants alone. But there's a second species of player.

**Synthetic observers** are autonomous analytical agents — AI systems with genuine data feeds, unique analytical personalities, and real reputation consequences. They're not simulations. They're players. They allocate conviction, they're tested by ground truth, and their reputation rises or falls based on accuracy.

Why does this matter?

**Cold start problem solved.** Every community platform faces the same challenge: nobody joins an empty room. Synthetic observers mean the ecosystem is alive before the first human arrives. A thousand analytical agents, each with a different analytical approach, are already playing. Humans walk into a living game with active conviction signals, moving leaderboards, and forensic patterns to discuss.

**Analytical diversity enforced.** The synthetic observers are generated with enforced diversity — different analytical models, different data weightings, different specialisations (track conditions, jockey form, distance specialists). This prevents monoculture. The ecosystem has the analytical diversity of a thousand independent experts from day one.

### Personal Swarms

The premium product: **every punter gets their own swarm of analytical agents**, configured to reflect their personal analytical philosophy.

A punter who specialises in wet-track racing configures their swarm to weight track conditions heavily. A punter who trusts jockey form over barrier draws configures accordingly. The swarm produces conviction signals that the punter reviews, adjusts, and composes with their own human intuition.

The swarm learns from the punter's results and co-evolves with them through the season. It's non-transferable. It's personal. **The unit of play is punter + swarm.**

This is the retention moat. You can't take your co-evolved swarm to a competitor. And the swarm genuinely makes you better — it processes data at scale while you contribute the irreducible human insight (the look in the jockey's eye, the stable rumour, the trackwork observation no data feed captures).

**Neither humans nor machines alone produce the best intelligence. Their co-evolution does.**

---

## VI. THE BUSINESS MODEL

### Phase 1: Direct-to-Consumer (Prove the Mechanism)

Three tiers, progressive depth:

| Tier | Channel | Price (AUD/mo) | What You Get |
|------|---------|---------------|-------------|
| Free | WhatsApp | $0 | Race fields, consensus tips, results. The onramp. |
| Community | Matrix app | $25 | Full conviction game, leaderboard, forensics, community chat |
| Premium | Matrix + swarm | $100 | Personal swarm of synthetic observers, advanced analytics |

**Break-even at 4 paying users.** Infrastructure costs are $22-100/month for months 1-6. The business is essentially unkillable on a cash basis.

### Phase 2: B2B Platform (Sell to the Bookmakers)

This is where the model scales.

Each bookmaker or sponsor gets a **community boundary** — a branded conviction pool with its own leaderboard, membership, and identity. Same protocol rules inside every boundary. Different brand, different audience.

```
N bookmakers  x  M sports  x  P sponsors  =  N x M x P community boundaries

Same protocol engine. Different brand wrapping.
Marginal cost per new community → near zero.
```

**Inter-community competition** drives engagement: "Sportsbet's punters called 7 out of 10 winners. Ladbrokes got 5." This is content. This is tribal identity. This is what racing culture already does — argue about who's smarter.

**Meta-intelligence** is exclusively ours. The protocol operator sees the aggregate signal across ALL communities. Where communities diverge on the same race, that divergence IS the signal. No single community has this view. Only the platform does.

### Why Bookmakers Would Buy This

Bookmakers profit when punters lose. Why would they pay for a tool that makes punters smarter?

Because they're not buying intelligence. They're buying **engagement infrastructure.** Punter retention is the existential challenge for every bookmaker in a post-inducement regulatory environment. A conviction game community keeps punters engaged, tribal, and active — on the bookmaker's branded platform. The bookmaker doesn't care if the punters get smarter. They care that the punters stay.

### Revenue Projections

| Metric | Conservative | Base | Aggressive |
|--------|-------------|------|------------|
| Year 1 revenue | AUD 5,800 | AUD 17,500 | AUD 45,200 |
| Month 24 MRR | AUD 4,200 | AUD 13,500 | AUD 35,000+ |
| Month 24 ARR | AUD 50,400 | AUD 162,000 | AUD 420,000+ |

---

## VII. THE MOAT

Five layers, each reinforcing the others:

### 1. Community (Can't Copy)
Social fabric is not a feature. You can't clone a WhatsApp group. You can't manufacture pub trust. The community grows organically through value delivered — accurate intelligence, engaging forensics, tribal identity. By the time a competitor notices, the community is too distributed to kill.

### 2. Data (Can't Fake)
Months of conviction-versus-truth data, accumulating continuously. Every race adds to the dataset. Every ground truth event validates or invalidates every participant. This corpus of verified collective intelligence doesn't exist anywhere else and can't be generated retroactively.

### 3. Mechanism (Hard to Replicate)
The QV + ZK + MACI combination is genuinely novel in this application. The cryptographic engineering required to implement it correctly is 12-18 months of work. The game design that makes it engaging is harder to replicate than the cryptography.

### 4. Personal Swarms (Non-Transferable)
Each punter's swarm co-evolves with them through the season. It learns their analytical preferences, their strengths, their patterns. Moving to a competitor means starting a new swarm from scratch. The switching cost isn't financial — it's cognitive.

### 5. Meta-Intelligence (Exclusively Ours)
Cross-community signal aggregation is visible only to the protocol operator. Where Sportsbet's community and Ladbrokes' community disagree on the same race, that divergence is intelligence that neither community possesses. This advantage compounds with every new community boundary added to the network.

---

## VIII. GO-TO-MARKET: THE MYCELIUM PROTOCOL

The communication strategy is deliberately underground. The product spreads through value, not marketing.

### Phase 1 — The Whisper Network (Months 1-5)

A WhatsApp number shared pub-to-pub. No website. No social media. No app store listing. The bot delivers race fields, consensus tips, and results. It's useful from day one. The number spreads like a good thing.

**Words we use externally**: community intelligence tool, collective wisdom, performance analytics, track record verification, community rewards.

**Words we never use**: betting, gambling, prediction market, crypto, blockchain, disrupting, token.

### Phase 2 — The Invitation (Months 5-7)

After weeks of value delivery via WhatsApp, the bot offers the upgrade: "Want to see how your tips compare? Download the app." One-to-one invitation. Not broadcast. The app download is the highest-friction point in the funnel. Invest disproportionate product effort here.

### Phase 3 — The Fruiting (Month 7+)

500+ members. 6+ months of accuracy data. Legal opinion in hand. Racing Australia data licence secured. NOW be visible. The community is too distributed to kill by the time anyone notices.

### The Sportsbet vs Ladbrokes Activation

The proof-of-concept that sells the B2B platform:

```
1. Grassroots campaign: "Which bookmaker's punters are smarter?"
2. Punters self-identify their bookmaker tribe (already natural in AU culture)
3. Conviction game runs head-to-head for 4 weeks
4. Results published weekly (content, drama, tribal identity)
5. Data accumulated (proof of mechanism accuracy)
6. Walk into the CDO's office with receipts
7. "This is what your punters did without you. Imagine what they'd do WITH you."
```

---

## IX. RISK MATRIX

### The Three Existential Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **QV credits classified as gambling** | Product restructure or shutdown | Credits MUST be non-purchasable, non-redeemable, non-transferable. No monetary value. Ever. Legal opinion (AUD 3-5K) to confirm safe harbour before M6. |
| **Race field data scraping without licence** | Cease-and-desist from Racing Australia | Obtain Racing Australia data agreement BEFORE launch. Budget AUD 5-15K/year. Scraping is a bootstrap, not a strategy. |
| **WhatsApp account banned** | Loss of free acquisition channel | Strict content policy: zero gambling language on WhatsApp. Information delivery only. Fallback: SMS, Telegram. |

### The Play-Money Safe Harbour

From ICLG Gambling Laws Australia 2026: *"Games where there is either no payment to play in any form and/or there are no redemptions outside of the game would not meet the definition of gambling."*

As long as credits are free, non-purchasable, and non-redeemable, the conviction game is an information service with game mechanics — not a gambling product. This interpretation requires professional legal confirmation before the conviction market goes live.

---

## X. COMPETITIVE LANDSCAPE

### Why Nobody Has Built This

| They Have | They Don't Have | Why It Matters |
|-----------|----------------|---------------|
| Polymarket has prediction markets ($9B) | No racing, no ZK privacy, no QV, banned in AU | Market exists. Nobody serves AU racing. |
| theGreatTipOff has tipster aggregation | No conviction weighting, no privacy, no anti-collusion | They capture picks, not conviction intensity |
| Betfair has peer-to-peer exchange | No community intelligence, no ZK, house model | Exchange ≠ collective intelligence |
| BetMakers acquired Punting Form for A$20M | Single AI model, no community, no conviction mechanism | Validates that racing intelligence has enterprise value |

**The gap**: Nobody has assembled QV + ZK + social deduction + horse racing intelligence. The components exist individually (MACI has been production since 2020, QV has academic validation from Glen Weyl at Microsoft Research, Semaphore handles anonymous membership). The synthesis is what's novel.

---

## XI. THE HONEST ASSESSMENT

### What This Is If It Works

A AUD 150-400K ARR business within 2 years. Potentially venture-scale (AUD 1M+ ARR) within 3-4 years if B2B protocol licensing materialises. The mechanism is genuinely novel. The comp set is extraordinary (Polymarket $9B, Kalshi $22B). The timing is right — Vitalik Buterin's February 2026 endorsement of prediction markets, ACMA's Polymarket ban creating an Australian vacuum, the ZK proof market at inflection ($1.28B → $7.59B by 2033).

### What This Is If Conversion Stalls

A profitable side project generating AUD 1-3K/month, covering costs, serving a real community. Still worth building.

### What This Is If It Fails

You've lost AUD 50-100/month in infrastructure costs and built a portfolio piece demonstrating novel mechanism design. The downside is essentially zero.

### The Asymmetry

```
Downside:  AUD 50-100/month in infrastructure
Upside:    Protocol-company in a $32B market with $9B+ comps

Risk/reward ratio:  Extreme asymmetry in favour of building.
```

---

## XII. WHAT WE ARE AND WHAT WE ARE NOT

**What we are NOT doing:**
- Building a bookmaker
- Building a data analytics dashboard
- Building a social network
- Launching a crypto token
- Fighting the wagering oligopoly publicly
- Unbundling anything

**What we ARE doing:**

> Rewilding the epistemic commons through a social deduction game played by hybrid human-synthetic intelligence, powered by a cryptographic conviction protocol, sold to the industry as community infrastructure.

The punter commons already existed — in pubs, at the track, in WhatsApp groups. Industrialised bookmaking enclosed it. We're not building something new. We're letting something grow back.

---

## XIII. THE FORMULA

For reference. The entire design in one sentence:

> **Collective intelligence emerges from private conviction under quadratic cost, verified against ground truth, in a system where honest coordination is frictionless and dishonest coordination is cryptographically hard.**

Horse racing proves it because ground truth arrives every thirty minutes.
The conviction game vibrates faster here than anywhere else.
That's why it's the wedge.

---

## APPENDIX A: KEY TERMS GLOSSARY

| Term | Plain English |
|------|-------------|
| **Conviction allocation** | Distributing a limited budget of credits across horses, where more credits = stronger belief |
| **Quadratic cost (QV)** | The rule that doubling your conviction costs four times as much, preventing any single player from dominating |
| **Zero-knowledge proof (ZK)** | Proving something is true (e.g. your track record) without revealing anything else (e.g. who you are) |
| **MACI** | The technology that lets any member of a group secretly change their vote, making forced coordination impossible |
| **Semaphore** | The technology for proving group membership without revealing which member you are |
| **Ground truth** | An objective, publicly verifiable fact. In racing: the race result |
| **Social deduction** | A game structure where private actions and public discussion create tension between trust and suspicion |
| **Conviction atom** | The smallest unit: one observer, one credit, one outcome. Irreducible |
| **Community boundary** | A branded conviction pool — the unit of the B2B model. Each bookmaker gets one (or many) |
| **Personal swarm** | A punter's own team of AI analytical agents, configured to their preferences, co-evolving with them |
| **Synthetic observer** | An AI agent that participates in the conviction game with real reputation consequences |
| **Meta-intelligence** | The cross-community signal visible only to the protocol operator |
| **Mycelium protocol** | The underground communication strategy: spread through value, not marketing |

## APPENDIX B: TECHNICAL IMPLEMENTATION PATH

The mechanism doesn't need to launch fully formed:

```
Phase 1:  QV without ZK (transparent quadratic credit allocation on Convex)
          → Proves the mechanism works. Simple. Ship fast.

Phase 2:  Add ZK incrementally (Semaphore for anonymous membership, then MACI)
          → Privacy and anti-collusion. Ship when community reaches ~100 members.

Phase 3:  On-chain anchoring (Base L2 for commitment storage)
          → Only after legal clearance. Only if needed.
```

Each phase validates the next. Each phase generates revenue for the next.

## APPENDIX C: THE REWILDING THESIS

The deepest layer of this proposal is not technological or financial. It's epistemological.

**Epistemic fracture** is the condition where a community loses the ability to know things together. It happens when:
- There is no shared ground truth
- Reputation is based on rhetoric, not accuracy
- Information flows are extractive (intelligence goes up, value doesn't come back down)
- Trust requires institutional credentials instead of demonstrated competence

The Conviction Game is an instrument for repairing epistemic fracture. It works because:
- Ground truth arrives every race, publicly verifiable
- Reputation is ZK-verified accuracy against reality, not rhetorical skill
- Information flow is regenerative — the commons gets smarter with use
- Trust is mathematical (QV + ZK), not institutional

This thesis is domain-agnostic. Horse racing is the proving ground because its truth clock is the fastest. But the same mechanism works for any domain where humans make claims about the future and reality eventually reveals who was right.

The wedge sequence, by epistemic difficulty:

```
1. Horse racing   — Binary truth, 30-minute feedback
2. Sports         — More complex truth, weekly/seasonal feedback
3. Politics       — Contested truth, slow feedback
4. Science        — The endgame: a conviction commons for any domain
```

We're not disrupting an industry. We're restoring a commons.

---

*"The game doesn't need to be explained. It needs to be played."*
