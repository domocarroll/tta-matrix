# The Conviction Game — Multi-Lens Analysis

**Date**: 2026-03-21
**Lenses**: Game Design, Game Theory, Self-Organising Criticality, Geometry, Hermetic Principles
**Companion**: RSW-CONVICTION-GAME.md (5-layer concept decomposition)

---

## Lens 1: Game Design (MDA Framework)

### Core Loop

```
SENSE → DECIDE → COMMIT → REVEAL → REFLECT → SENSE...

Sense:    Read the field. Tipster consensus. Community mood.
Decide:   Form private conviction. Where is MY edge?
Commit:   Allocate QV credits. Quadratic cost forces honest prioritisation.
Reveal:   Race runs. Ground truth resolves. Commitments settle.
Reflect:  Forensics. Who was right? Who was suspicious? What patterns?
```

30-minute loop during race hours. 8-10 loops per Saturday. Each is a complete
game cycle with resolution. Season-long reputation arc layered on top.

### Player Archetypes (Bartle + Racing Culture)

| Archetype | Bartle | Behaviour | Desire |
|-----------|--------|-----------|--------|
| The Analyst | Achiever | Studies form, optimises strike rate | Proof they're the best. Leaderboard. |
| The Punter | Explorer | Hunches, long shots, varied allocation | Discovery. Finding an overlay. |
| The Socialiser | Socialiser | Lives in chat, discusses tips, builds alliances | Belonging. Community IS the product. |
| The Shark | Killer | Hunts cartel patterns, exposes manipulation, forensics | Power. Catching the gamers. |

All four served by the same mechanism. The social deduction dynamics CREATE
the Shark archetype, which doesn't exist in any current tipping platform.

### Reward Loops (Nested)

```
Micro (per race):     Credits gained/lost from this allocation
Meso (per race day):  Daily P&L, races called, daily forensics
Macro (per season):   Reputation score, leaderboard, tier access
Meta (cross-season):  ZK-provable lifetime track record
```

### Information Architecture

| Phase | Available | Hidden |
|-------|-----------|--------|
| Pre-race (Night) | Race field, tipster consensus, own budget | Others' allocations, their balances |
| Allocation window | Own allocation forming | Everyone else's |
| Post-allocation | "N players committed" (count only) | All allocations |
| Post-race (Dawn) | Result, own P&L, aggregate vs result | Individual allocations (unless revealed) |
| Forensics (Day) | Anomaly signals, statistical patterns | Individual votes, who triggered anomaly |
| Discussion (Dusk) | Community speculation, voluntary reveals | Ground truth about manipulation |

This information asymmetry IS the game. Fog in Night creates tension.
Partial reveal in Day creates drama. Voluntary reveal creates social moments.

---

## Lens 2: Game Theory (Formal)

### The Game as Mechanism Design

| Property | Value |
|----------|-------|
| Players | N punters (anonymous under ZK) |
| Types | Honest (genuine conviction) vs Strategic (cartel coordination) |
| Actions | QV credit allocation across K horses |
| Cost function | Quadratic: c(v) = v² for v votes |
| Information | Private types, private allocations, public resolution |
| Resolution | Exogenous ground truth (race result) |
| Payoff (honest) | Reputation → intelligence access → betting edge |
| Payoff (strategic) | Short-term: odds manipulation. Long-term: reputation destruction |

### Folk Theorem Application

Horse racing is "effectively infinite" repeated play. The trigger strategy is
reputation decay. An honest punter's long-run payoff (accumulated reputation →
edge → profit) exceeds short-run manipulation payoff (one distortion → reputation
destruction).

**Honesty is the dominant strategy for any player with time horizon > ~20 races.**

The cartel only wins if members have SHORTER time horizons than the decay rate.
Quadratic cost accelerates their depletion.

### Mechanism Properties

| Property | Status | Mechanism |
|----------|--------|-----------|
| Incentive Compatible | Yes | Honest conviction maximises long-run reputation |
| Strategy-Proof | Partial | QV is strategy-proof for intensity. ZK prevents conditioning on others |
| Collusion-Resistant | Yes | MACI key-change makes coordination unenforceable |
| Sybil-Resistant | Conditional | Proof-of-personhood + quadratic cost taxes Sybil splits |
| Budget-Balanced | Yes | Parimutuel pool. Winners funded by losers' spent credits |
| Individually Rational | Yes | Can always opt out (not allocate) |

### Asymmetric Coordination

The critical insight: the mechanism makes pro-social coordination EASY
(public forensics, community discussion) while anti-social coordination
is HARD (MACI anti-collusion, ZK hiding).

```
Helpful coordination (detecting manipulation):  FRICTIONLESS
Harmful coordination (executing manipulation):  CRYPTOGRAPHICALLY RESISTANT
```

---

## Lens 3: Criticality & Self-Organising Systems

### Three Phases

**Frozen** (too much order):
Few high-reputation players dominate. Signal is monoculture. Fragile.
Symptom: Very low variance in conviction signals.

**Chaotic** (too much disorder):
No reputation weighting works. Signal is noise. No intelligence emerges.
Symptom: No predictive power above chance.

**Critical** (edge of chaos):
Sufficient diversity. Reputation amplifies genuine signal. Small clusters of
strong conviction can move the aggregate (power law). New information propagates
rapidly.
Symptom: Signal outperforms individuals AND simple aggregation.

### Mechanisms Maintaining Criticality

Prevent freezing:
- Seasonal credit resets (prevents permanent power concentration)
- Quadratic cost (can't dominate linearly)
- New player credit allocation (fresh perspectives)

Prevent chaos:
- Reputation accumulation (accuracy earns influence)
- Ground truth settlement (noise filtered every 30 minutes)
- Community forensics (social coordination weights genuine signal)

### Self-Organised Criticality (Per Bak's Sandpile)

```
Conviction credits = grains of sand
Races = perturbations
Reputation scores = pile height

As reputation concentrates, system becomes sensitive to a single wrong call
by a high-reputation player (avalanche). Wrong call redistributes reputation.
System finds new critical state. Repeat.
```

The "avalanches" — leaderboard reshuffles when a leading tipster gets it
wrong — are the most engaging moments. They're emergent, not designed.
The SOC property generates its own drama.

### Stigmergy (Ant Pheromone Coordination)

Punters don't communicate allocations directly. They:
1. Observe aggregate conviction signal (environment)
2. Modify own allocation (action)
3. Their action modifies the aggregate (environment change)

Each allocation is a "pheromone deposit." ZK means you can't see individual
deposits, only the aggregate trail. Pure stigmergic coordination.

Quadratic cost prevents "pheromone flooding." Ground truth oracle "evaporates"
incorrect trails. What remains is the optimised path — genuine consensus.

### Attractor Dynamics

**Honest Attractor (stable fixed point):**
Accuracy → reputation → influence → better signal → more participants →
stronger community → more data → better accuracy → ...

**Manipulation Attractor (unstable fixed point):**
False signal → short-term profit → reputation decay → less influence →
diminishing returns → collapses → pushed toward honest attractor or exit.

Over iterated play, the system converges to the honest attractor with
probability 1.

---

## Lens 4: Geometry

### The Conviction Simplex

Each allocation on a K-horse race defines a point in a (K-1)-simplex.
For a 10-horse race: a point in a 9-dimensional simplex.

The aggregate conviction is the QV-weighted centroid. Quadratic cost means
points near vertices (extreme conviction) are rarer and more expensive than
points near centre (spread conviction). The geometry produces a signal
resistant to extremism.

### Curvature of the Cost Manifold

c(v) = v² defines a paraboloid in conviction-cost space.

- High curvature (near vertices) = expensive to push further toward one outcome
- Low curvature (near centre) = cheap mild conviction across many outcomes

A cartel pushes the centroid UPHILL on this paraboloid.
The honest majority holds the centroid IN THE VALLEY.
Geometry literally works against the attacker.

### Information Geometry

The aggregate signal is a probability distribution over outcomes.

- KL divergence between conviction distribution and true probability = system accuracy
- Fisher information at each timestep = how much new data refines the distribution
- Convergence rate ∝ Fisher information ∝ number of honest participants

**More honest players = faster convergence to truth.** The mathematical
structure IS the intelligence mechanism.

### Reputation Topology (Hyprsphere Connection)

Each punter's reputation vector (strike rate, ROI, consistency, speciality)
defines a point in multi-dimensional space. The community forms a manifold.

Over time, similar-accuracy punters cluster — forming reputation topologies.
ZK means you can't see individual points but CAN see the manifold shape.

"Two distinct clusters of high-accuracy punters disagree on this race" is
far more valuable than a single consensus number.

Agents as points on a manifold. Relationships as geometric structure.
Intelligence as topology. This IS the Hyprsphere.

---

## Lens 5: Hermetic Principles

### 1. Mentalism — "The All is Mind"

The conviction market IS a collective mind. Each allocation is a thought.
The aggregate is a collective belief. Ground truth is reality-testing the belief.
The system is a cognitive loop: sense, believe, act, observe, revise.

Convex is the memory. MACI is the privacy of thought. QV is the cost of
attention. The architecture is a distributed cognitive architecture.

### 2. Correspondence — "As above, so below"

The same structure repeats at every scale:

| Scale | Conviction | Cost | Truth | Reputation |
|-------|-----------|------|-------|------------|
| Race | Credit allocation | Quadratic/horse | Result | Single-race accuracy |
| Day | Budget across races | Opportunity cost | Day's results | Daily strike rate |
| Season | Strategic focus | Time + attention | Season record | Seasonal ranking |
| Career | Domain expertise | Years | Lifetime record | ZK-provable legacy |

The micro game is structurally identical to the macro game. Same primitives
at every level. The game is fractal.

### 3. Vibration — "Nothing rests"

The conviction signal vibrates — updating with every allocation, result,
reputation adjustment. Frequency set by racing calendar: ~8-10 races per
meeting, ~3-4 meetings per day, ~6 days per week.

Horse racing's high frequency is why it's the ideal first domain:
**the conviction game vibrates faster here than anywhere else.**

International racing adds harmonics. Multiple codes add vibrational modes.
The system resonates more richly with more data sources.

### 4. Polarity — "Everything is dual"

Fundamental polarity: honesty ↔ manipulation. Same spectrum, different ends.
The action is identical. The intent differs. The mechanism aligns incentives
so the honest pole is the attractor.

Other polarities:
- Privacy ↔ Transparency (resolved by optional Conviction Reveal)
- Individual ↔ Collective (resolved by QV weighting)
- Simplicity ↔ Depth (resolved by tiered access)
- Competition ↔ Cooperation (simultaneously competing for leaderboard
  AND cooperating to maintain signal quality)

### 5. Rhythm — "Everything flows"

The Social Deduction Loop IS rhythm:

```
Night (inward) → Dawn (resolution) → Day (outward) → Dusk (reflection) → Night...
```

The breath of the conviction market. Inhale (private conviction forming).
Exhale (public resolution and discussion).

Seasonal credit reset = macro rhythm (prevents permanent accumulation).
Mycelium growth = longest rhythm (invisible → valuable → visible → defensible).

### 6. Cause and Effect — "Every cause has its effect"

Constructive chain (stable):
```
Accurate conviction → Credit accumulation → Reputation → Signal influence →
Community trust → Growth → Better aggregation → Edge → Profit → Loyalty
```

Destructive chain (unstable):
```
False conviction → Odds distortion → Reputation decay → Signal corruption →
Distrust → Exodus → Worse aggregation → Platform death
```

No link can be skipped. Every claim resolves against ground truth.
The constructive chain is stable. The destructive chain is unstable.
Cause and effect, properly aligned, IS the moat.

### 7. Gender — "Gender is in everything"

Generative polarity: Signal (active) and Trust (receptive).

- QV generates signal (conviction-weighted estimates)
- ZK generates trust (verified anonymous reputation)
- Community generates the field where they interact

Neither alone creates intelligence. Their union does.

The "birth" event — when aggregate conviction first demonstrably outperforms
individual tipsters — is the moment collective intelligence is born from
the union of signal and trust.

---

## Synthesis: What The Lenses Reveal Together

Each lens illuminates a different face of the same crystal:

| Lens | Core Revelation |
|------|----------------|
| Game Design | The 30-minute loop + season arc creates four player archetypes, all served by one mechanism |
| Game Theory | Honesty dominates in iterated play. Pro-social coordination is frictionless, anti-social is cryptographically hard |
| Criticality | The system self-organises to the edge of chaos. Drama (avalanches) is emergent, not designed |
| Geometry | The conviction simplex + paraboloid cost surface means geometry literally defends the honest signal |
| Hermetic | The game is fractal (Correspondence), vibrates at racing frequency (Vibration), and intelligence is born from the union of signal and trust (Gender) |

**The deepest pattern across all lenses**: The Conviction Game is a system designed
to be smarter than its participants, more honest than its incentives, and more
engaging than its complexity. It achieves this not through top-down control but
through the emergent properties of well-chosen primitives under iterated play
against relentless ground truth.

The game doesn't need to be explained. It needs to be played.
