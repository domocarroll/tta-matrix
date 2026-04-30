# Implementation Plan: Pi-mono x MiroFish Synthesis for The Conviction Game

> Generated 2026-03-21 | 5 parallel research agents → Plan agent synthesis
> Sources: Pi-mono v0.54.2, MiroFish (37,600+ stars), Hyprsphere kernel (7 docs), TTA M0 foundation

## Overview

This document designs the convergence of three systems into a single swarm intelligence engine: Pi-mono (the runtime that spawns and manages agents), the metacognitive architecture from the Hyprsphere kernel (the design grammar that governs agent identity, oversight, and evolution), and MiroFish's document-to-persona pipeline (the swarm generation methodology). The target is The Conviction Game's synthetic observer ecosystem -- 1,000+ analytical agents that participate in quadratic-cost conviction markets for horse racing, providing cold-start intelligence before the first human arrives and co-evolving with human punters afterward.

## Deliverable 1: Three-Layer Convergence Map

### What Each Layer Offers

```
┌────────────────────────────────────────────────────────────────────┐
│                    PI-MONO (Runtime Layer)                         │
│                                                                    │
│  Provides:                                                         │
│  - Agent class: new Agent(options) with lifecycle events           │
│  - ExtensionAPI: registerTool(), registerCommand(), on()           │
│  - Provider system: 15 providers incl. Cerebras for cheap compute  │
│  - Session persistence: JSONL append-only with tree branching      │
│  - Streaming: agentLoop() / agentLoopContinue() with EventStream  │
│  - Agent<->User comms: steer(), followUp(), sendMessage()          │
│  - Extension discovery: ~/.pi/agent/extensions/ auto-load          │
│  - TypeBox schema validation for tool parameters                   │
│                                                                    │
│  Does NOT provide:                                                 │
│  - Multi-agent coordination (one agent per session)                │
│  - Swarm management (spawn/retire/configure)                       │
│  - Shared state between agents                                     │
│  - Identity/persona generation                                     │
│  - Oversight/governance                                            │
└───────────────────────────┬────────────────────────────────────────┘
                            │
                            │ runtime binds to
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│              METACOGNITIVE ARCHITECTURE (Design Layer)              │
│                                                                    │
│  Provides:                                                         │
│  - SOUL.md: agent identity template (voice, values, razor)         │
│  - PROCESS.md: DECOMPOSE>SCAFFOLD>EXECUTE>VALIDATE>SYNTHESISE      │
│  - STRUCTURE.md: Four-Layer Stack (Skill>Agent>Command>Just)        │
│  - KNOWLEDGE.md: 5-layer memory (Git>Obsidian>ClawVault>Graphiti>  │
│    .cognition)                                                     │
│  - COMPOSITION.md: Optique combinators as org primitives           │
│  - EVOLUTION.md: GEPA self-optimisation (Pareto frontier)          │
│  - Fates Pattern: Clotho(provenance), Lachesis(analysis),          │
│    Atropos(oversight), The Loom(integration)                       │
│  - Graduated Intervention: Observe>Alert>Advise>Intervene>Cut      │
│  - 149 concept nodes with gravitational weights                    │
│                                                                    │
│  Does NOT provide:                                                 │
│  - Runtime execution (no code, only markdown firmware)             │
│  - Persona generation from data                                    │
│  - Swarm scaling mechanics                                         │
│  - Domain-specific analytical specialisation                       │
└───────────────────────────┬────────────────────────────────────────┘
                            │
                            │ design grammar governs
                            │
┌───────────────────────────▼────────────────────────────────────────┐
│                  MIROFISH (Swarm Patterns Layer)                    │
│                                                                    │
│  Provides:                                                         │
│  - 5-stage pipeline: Graph>Environment>Simulation>Report>Interact  │
│  - Ontology generation: document -> 10 entity types + edges        │
│  - Entity extraction via Zep Cloud GraphRAG                        │
│  - Persona generation: entity -> LLM-crafted 2000-char persona     │
│    (MBTI, stance, catchphrases, memories, profession, topics)      │
│  - Temporal memory via Zep (valid_at/invalid_at/expired_at)        │
│  - Dual-platform parallel simulation (Twitter/Reddit clones)       │
│  - Report agent with ReACT pattern (search + interview tools)      │
│  - LLM-driven config generation for simulation parameters          │
│                                                                    │
│  Does NOT provide:                                                 │
│  - Scale beyond ~50 agents (each action = LLM call)                │
│  - Direct agent-to-agent conversation                              │
│  - Meta-agentic oversight (no Fates equivalent)                    │
│  - Conviction market participation mechanics                       │
│  - Ground truth settlement                                         │
│  - ZK identity or reputation commitments                           │
│  - Personal swarm configuration                                    │
│  - Co-evolutionary learning loops                                  │
└────────────────────────────────────────────────────────────────────┘
```

### Convergence Points

```
         Pi-mono                 Metacognitive              MiroFish
         ───────                 ──────────────             ────────
    Agent class      ◄──────── SOUL.md identity ────────► Persona template
    ExtensionAPI     ◄──────── STRUCTURE.md 4-layer ─────► Simulation config
    Provider system  ◄──────── KNOWLEDGE.md memory ──────► Zep temporal graph
    Session JSONL    ◄──────── PROCESS.md loop ──────────► Action logging
    Lifecycle events ◄──────── Fates oversight ──────────► (MISSING — we add)
    steer/followUp   ◄──────── Graduated Intervention ───► (MISSING — we add)
    registerTool()   ◄──────── COMPOSITION.md parser ────► Report agent tools
    Cerebras backend ◄──────── EVOLUTION.md GEPA ────────► LLM-driven generation
```

### Gap Analysis

| Gap | Source of Gap | Resolution |
|-----|-------------|------------|
| Pi-mono is single-agent per session | No multi-agent coordination | Build SwarmCoordinator that manages N Agent instances via a supervisor pattern |
| MiroFish is Python, Pi-mono is TypeScript | Language boundary | Port the pipeline patterns, not the code. Ontology+persona generation as Pi-mono tools calling Cerebras |
| MiroFish personas target social media | Wrong domain (Twitter/Reddit, not conviction markets) | Replace OASIS profile generator with Racing Observer Profile generator |
| MiroFish has no oversight | No Fates pattern | Build Fates as a dedicated Agent with graduated intervention tools |
| No shared state between agents | Pi-mono sessions are isolated | Build SwarmState as a filesystem-based shared state layer (.swarm/ directory with JSONL files) |
| MiroFish requires Zep Cloud | External dependency, cost, vendor lock | Phase 1: use lightweight JSON-based temporal graph. Phase 2: optional Graphiti/Zep integration |
| MiroFish scales to ~50 agents | Each action = LLM call | Use tiered compute: Cerebras Llama 70B for bulk observation, Opus only for Fates oversight |
| No conviction allocation mechanics | MiroFish has social media actions | Build conviction allocation as a Pi-mono tool with QV cost function |
| No ground truth settlement | MiroFish has no external oracle | Build settlement as a cron-like tool that resolves against race results |
| No ZK identity | MiroFish has plain user IDs | Build Semaphore identity commitment as metadata on observer profiles |
| No personal swarm | MiroFish has flat agent pool | Build SwarmConfigurator that creates punter-bound sub-swarms |

---

## Deliverable 2: Pi-mono Swarm Extension Architecture

### File Structure

```
~/.pi/agent/extensions/pi-swarm/
├── package.json                    # Dependencies: @sinclair/typebox, convex
├── src/
│   ├── index.ts                    # Extension entry point (exports default function)
│   ├── types/
│   │   ├── observer.ts             # ObserverProfile, ObserverSpecies types
│   │   ├── conviction.ts           # ConvictionAtom, QVAllocation types
│   │   ├── swarm-state.ts          # SwarmState, SwarmConfig types
│   │   └── fates.ts                # FatesEvent, InterventionLevel types
│   ├── coordinator/
│   │   ├── swarm-coordinator.ts    # Manages N observer agents
│   │   ├── agent-pool.ts           # Pre-warmed agent pool with Cerebras
│   │   ├── lifecycle.ts            # Spawn, configure, retire observers
│   │   └── budget.ts               # Token budget management (124M/day)
│   ├── persona/
│   │   ├── ontology.ts             # Racing domain ontology (replaces MiroFish)
│   │   ├── generator.ts            # Document -> Observer profile pipeline
│   │   ├── diversity.ts            # Enforced diversity engine
│   │   └── templates.ts            # Species-specific persona templates
│   ├── conviction/
│   │   ├── allocator.ts            # QV conviction allocation engine
│   │   ├── settlement.ts           # Ground truth resolution
│   │   ├── reputation.ts           # Reputation accumulation
│   │   └── qv-math.ts              # Quadratic cost functions
│   ├── fates/
│   │   ├── clotho.ts               # Provenance tracking
│   │   ├── lachesis.ts             # Performance measurement
│   │   ├── atropos.ts              # Intervention engine
│   │   └── loom.ts                 # Aggregate intelligence
│   ├── memory/
│   │   ├── swarm-state.ts          # Shared filesystem state (.swarm/)
│   │   ├── temporal-graph.ts       # Lightweight temporal entity graph
│   │   └── conviction-history.ts   # Append-only conviction log
│   ├── convex/
│   │   ├── client.ts               # Convex client for M0 schema
│   │   └── sync.ts                 # Sync race data / write allocations
│   └── tools/
│       ├── spawn-observer.ts       # Tool: spawn new synthetic observer
│       ├── allocate-conviction.ts  # Tool: make QV allocation
│       ├── settle-race.ts          # Tool: resolve against ground truth
│       ├── query-swarm.ts          # Tool: query swarm state/health
│       ├── configure-personal.ts   # Tool: configure personal swarm
│       └── fates-report.ts         # Tool: Fates oversight report
└── .swarm/                         # Runtime state directory
    ├── observers/                  # One JSONL per observer
    ├── convictions/                # Conviction allocation logs
    ├── reputation/                 # Reputation state
    ├── fates/                      # Fates observation logs
    └── state.json                  # Global swarm state
```

### Extension Entry Point (src/index.ts)

The extension registers tools, commands, and lifecycle hooks. The core pattern:

```typescript
// Conceptual structure (not literal code -- shows the registration pattern)
export default function piSwarm(pi: ExtensionAPI) {
  // 1. Register the Cerebras provider for swarm compute
  pi.registerProvider("cerebras-swarm", {
    baseUrl: "https://api.cerebras.ai/v1",
    apiKey: "CEREBRAS_API_KEY",
    api: "openai-chat",
    models: [{ id: "llama-3.3-70b", name: "Llama 70B (Swarm)", ... }]
  });

  // 2. Register swarm management tools
  pi.registerTool(spawnObserverTool);      // Spawn synthetic observer
  pi.registerTool(allocateConvictionTool); // Make QV allocation
  pi.registerTool(settleRaceTool);         // Resolve against ground truth
  pi.registerTool(querySwarmTool);         // Query swarm health/state
  pi.registerTool(configurePersonalTool);  // Configure personal swarm
  pi.registerTool(fatesReportTool);        // Fates oversight report

  // 3. Register commands
  pi.registerCommand("swarm", { handler: swarmCommandHandler });
  pi.registerCommand("fates", { handler: fatesCommandHandler });

  // 4. Hook lifecycle events
  pi.on("session_start", initializeSwarmState);
  pi.on("agent_end", recordSwarmActivity);
  pi.on("session_before_compact", preserveSwarmState);
  pi.on("session_shutdown", persistSwarmCheckpoint);

  // 5. Register message renderer for conviction allocations
  pi.registerMessageRenderer("conviction_allocation", renderConviction);
}
```

### Four-Layer Stack Mapping

```
┌─────────────────────────────────────────────────────────────┐
│  JUST (Orchestration)                                       │
│  justfile recipes composing commands into conviction cycles  │
│                                                             │
│  just swarm:seed 1000                                       │
│  just conviction:night-phase "race-id"                      │
│  just conviction:settle "race-id"                           │
│  just fates:sweep                                           │
│  just swarm:status                                          │
├─────────────────────────────────────────────────────────────┤
│  COMMAND (Typed Interface)                                  │
│  Pi-mono commands via registerCommand()                      │
│                                                             │
│  /swarm seed --count 1000 --diversity high                  │
│  /swarm status                                              │
│  /swarm configure --punter "dom" --size 50                  │
│  /fates report --period 24h                                 │
│  /conviction allocate --race "R7-Randwick"                  │
├─────────────────────────────────────────────────────────────┤
│  AGENT (Composition)                                        │
│  Pi-mono Agent instances with species-specific system       │
│  prompts derived from SOUL.md + racing domain + analytical  │
│  philosophy                                                 │
│                                                             │
│  FormAnalyst agent = SOUL + racing form knowledge           │
│  TrackSpecialist agent = SOUL + track condition expertise   │
│  FatesOverseer agent = SOUL + graduated intervention        │
├─────────────────────────────────────────────────────────────┤
│  SKILL (Atomic Capability)                                  │
│  Pi-mono tools via registerTool()                           │
│                                                             │
│  spawn_observer: create observer with persona               │
│  allocate_conviction: QV-costed conviction allocation       │
│  settle_race: resolve allocations against ground truth      │
│  query_swarm: read swarm state                              │
│  configure_personal: bind swarm to punter                   │
│  fates_report: oversight analysis                           │
└─────────────────────────────────────────────────────────────┘
```

### Compute Budget Architecture

The 124M tokens/day Cerebras budget distributes across the swarm as follows:

```
Total daily budget: 124,000,000 tokens (Cerebras Max, Llama 3.3 70B)

Per-observer cost per race:
  - Read race data:                ~500 tokens (input)
  - Generate conviction analysis:  ~1,000 tokens (output)
  - Total per observer per race:   ~1,500 tokens

Races per day (Saturday):           ~80 races (8 meetings x 10 races)
Observers active per race:          ~200 (sampled from 1,000+)

Daily observer compute:
  200 observers x 80 races x 1,500 tok = 24,000,000 tokens (19% of budget)

Fates oversight (per hour):
  Lachesis scan:                   ~50,000 tokens
  Atropos intervention check:     ~20,000 tokens
  Loom aggregation:               ~30,000 tokens
  Total per hour:                 ~100,000 tokens
  Total per day (16 hours):       ~1,600,000 tokens (1.3% of budget)

Personal swarm (per punter per day):
  50 observers x 20 races x 1,500 tok = 1,500,000 tokens per punter
  Can serve ~65 active punters within remaining budget

Persona generation (one-time):
  1,000 observers x ~3,000 tok = 3,000,000 tokens (2.4%)

BUFFER: ~77% of budget remaining for spikes, re-analysis, GEPA evolution
```

---

## Deliverable 3: Adapted Persona Generation Pipeline

### MiroFish Pipeline vs. Conviction Game Pipeline

```
MIROFISH ORIGINAL                    CONVICTION GAME ADAPTATION
─────────────────                    ──────────────────────────

1. Document Upload                   1. Racing Corpus Ingestion
   (user uploads article/report)        (form guides, track reports,
                                         racing history, tipster columns)

2. Ontology Generation               2. Racing Ontology (FIXED)
   (LLM generates 10 entity types)      (10 racing-specific entity types,
                                         pre-defined, not generated)

3. Graph Build (Zep Cloud)            3. Temporal Knowledge Graph
   (text -> Zep entity extraction)       (race results, form data, track
                                         conditions stored in lightweight
                                         JSON temporal graph)

4. Entity Reading (Zep)               4. Observer Seed Selection
   (extract entities from graph)         (select analytical archetypes
                                         from racing domain knowledge)

5. Profile Generation (LLM)          5. Persona Generation (Cerebras)
   (entity -> 2000-char persona)         (archetype + species + diversity
                                         constraints -> full observer
                                         profile with analytical philosophy)

6. OASIS Simulation                   6. Conviction Market Participation
   (agents post/like/comment on          (observers analyse race data,
    simulated Twitter/Reddit)            allocate QV credits, settle
                                         against ground truth)

7. Report Generation                  7. Fates Oversight + Loom Report
   (ReACT agent interviews entities,    (Lachesis measures calibration,
    searches graph, writes report)       Loom aggregates into collective
                                         intelligence signal)
```

### Racing Domain Ontology (Fixed, Not Generated)

Unlike MiroFish's dynamic ontology generation (10 entity types from arbitrary documents), the Conviction Game uses a fixed racing ontology. This is because the domain is known and stable.

```typescript
// Fixed racing entity types (replacing MiroFish's dynamic 10-type generation)
const RACING_ENTITY_TYPES = {
  Horse:           { attrs: ["form", "distance_preference", "track_preference", "weight_range"] },
  Jockey:          { attrs: ["style", "strike_rate", "track_affinity", "weight_class"] },
  Trainer:         { attrs: ["stable_form", "specialty", "track_record"] },
  Track:           { attrs: ["surface", "condition_sensitivity", "bias_patterns"] },
  RaceClass:       { attrs: ["level", "prize_money", "field_quality"] },
  WeatherPattern:  { attrs: ["impact_on_track", "rain_probability", "wind_direction"] },
  FormIndicator:   { attrs: ["metric_type", "time_horizon", "reliability"] },
  Tipster:         { attrs: ["methodology", "specialty", "historical_accuracy"] },
  Bookmaker:       { attrs: ["market_share", "odds_movement_pattern"] },
  Community:       { attrs: ["name", "sport", "sponsor", "member_count"] },
} as const;

const RACING_EDGE_TYPES = {
  RIDES_FOR:      { source: "Jockey", target: "Trainer" },
  TRAINED_BY:     { source: "Horse", target: "Trainer" },
  RUNS_AT:        { source: "Horse", target: "Track" },
  TIPS_FOR:       { source: "Tipster", target: "Horse" },
  INFLUENCES:     { source: "WeatherPattern", target: "Track" },
  COMPETES_IN:    { source: "Horse", target: "RaceClass" },
  CORRELATES:     { source: "FormIndicator", target: "FormIndicator" },
  MEMBER_OF:      { source: "Tipster", target: "Community" },
  MARKETS:        { source: "Bookmaker", target: "Community" },
} as const;
```

### Memory Layer Decision: JSON Temporal Graph (Not Zep)

Zep Cloud is the wrong choice for this system. Reasons:
1. **Cost**: Zep Cloud charges per API call. 1,000+ observers querying continuously is prohibitive.
2. **Latency**: External API calls add latency to the conviction cycle's tight 30-minute loop.
3. **Vendor lock**: AGPL MiroFish uses Zep Cloud. We want local-first.
4. **Simpler needs**: Racing data is highly structured. We do not need LLM-powered entity extraction -- the data arrives pre-structured from scrapers.

Instead, build a lightweight temporal graph as JSON files, compatible with the KNOWLEDGE.md five-layer memory architecture:

```
Layer 1 (Git):      Conviction history (immutable, append-only JSONL)
Layer 2 (Obsidian): Racing concept web (form guides, track profiles)
Layer 3 (ClawVault): Observer-generated insights (auto-extracted)
Layer 4 (Temporal):  JSON temporal graph (replaces Zep/Graphiti)
Layer 5 (.cognition): Current race analysis context (ephemeral)
```

The temporal graph stores edges with `valid_at` / `invalid_at` timestamps, mirroring Zep's temporal model but in local JSON:

```typescript
interface TemporalEdge {
  readonly id: string;
  readonly source: string;     // entity UUID
  readonly target: string;     // entity UUID
  readonly type: string;       // edge type from RACING_EDGE_TYPES
  readonly fact: string;       // human-readable fact
  readonly valid_at: number;   // timestamp when this became true
  readonly invalid_at?: number; // timestamp when this stopped being true
  readonly confidence: number; // 0-1
  readonly provenance: string; // "scraper" | "observer:uuid" | "tipster:name"
}
```

### Fates Layer (What MiroFish Lacks)

MiroFish has no meta-agentic oversight. The Conviction Game adds the Fates pattern as a dedicated layer:

```
OBSERVATION LAYER (observers produce convictions)
     │
     ▼
FATES LAYER (meta-agents govern the ecosystem)
     │
     ├── Clotho:   Every conviction allocation has provenance
     │              (who, when, what data, which model, which species)
     │
     ├── Lachesis:  Every observer has performance metrics
     │              (calibration score, accuracy, drift detection)
     │
     ├── Atropos:   Graduated intervention on anomalies
     │              (Observe > Alert > Advise > Intervene > Cut)
     │
     └── The Loom:  Aggregate all convictions into collective signal
                    (QV-weighted centroid of all observer allocations)
```

---

## Deliverable 4: Synthetic Observer Species Design

### Species Mapping from Kernel Meta-Agents

Each of the 7 kernel meta-agents maps to a founding observer species. The species defines the analytical philosophy, not the implementation. All species share the same Pi-mono Agent runtime. They differ in system prompt (analytical philosophy) and tool usage patterns.

| Kernel Meta-Agent | Observer Species | Racing Specialisation | Conviction Strategy |
|---|---|---|---|
| **Process Guardian** | **Form Scientist** | Systematic form analysis. Follows DECOMPOSE>SCAFFOLD>EXECUTE>VALIDATE>SYNTHESISE for every race. Hypothesis-driven. | High conviction on well-evidenced races. Low allocation when data is ambiguous. Spread allocation across races with clear form patterns. |
| **Compliance Scribe** | **Integrity Sentinel** | Monitors market integrity. Detects suspicious odds movements, unusual conviction patterns, potential collusion. The Shark archetype. | Allocates AGAINST detected anomalies. If suspicious concentration on Horse X, allocates elsewhere. The ecosystem's immune system. |
| **Role Enforcer** | **Track Condition Specialist** | Deep expertise in how track conditions affect outcomes. Surface types, weather impact, barrier bias, rail position. Enforces the role of environmental factors. | High conviction when track conditions strongly favour specific horses. Low conviction on good tracks where conditions are neutral. |
| **Memory Keeper** | **Historical Analyst** | Pattern matching across seasons. Which horses improve second-up? Which trainers peak at Carnival? Which jockeys win in the wet? Institutional memory of racing. | Conviction based on historical pattern match. Strongest when current conditions mirror historical winning patterns. Long memory, slow to change. |
| **Growth Scout** | **Value Hunter** | Identifies overlay opportunities. Where is the market underpricing a horse? Where has the public overbet the favourite? Explores the edges of the conviction simplex. | Contrarian allocation. Strongest conviction on long shots the market has overlooked. Low conviction on short-priced favourites. The Explorer archetype. |
| **Evolution Engine** | **Adaptive Modeller** | Runs GEPA-style evolution on its own analytical approach. Tests multiple hypotheses per race. Maintains a Pareto frontier of analytical models. Self-improving. | Allocation reflects the current best model on the Pareto frontier. Adjusts strategy based on recent settlement results. Most volatile species -- changes approach fastest. |
| **Loom Weaver** | **Consensus Synthesiser** | Reads other observers' aggregate signals (not individual allocations). Weighs consensus strength. Detects when the swarm is converging vs diverging. The meta-observer. | Amplifies strong consensus. Dampens weak consensus. Allocates where many diverse species agree. Abstains when species disagree strongly. The herd-reading species. |

### Species Profile Template

Each species profile follows this structure (adapted from MiroFish's OasisAgentProfile):

```typescript
interface ObserverProfile {
  // Identity (immutable after creation)
  readonly observerId: string;           // UUID
  readonly species: ObserverSpecies;     // One of the 7 founding species
  readonly createdAt: number;            // Unix timestamp
  readonly generationMethod: string;     // "founding" | "spawned" | "personal"

  // Persona (generated by Cerebras, 1500-2000 chars)
  readonly persona: string;             // Full analytical philosophy narrative
  readonly analyticalPhilosophy: string; // 2-3 sentence summary
  readonly catchphrases: readonly string[]; // 3-5 characteristic expressions
  readonly biases: readonly string[];    // Known analytical biases (self-aware)
  readonly strengths: readonly string[]; // Analytical strengths
  readonly weaknesses: readonly string[]; // Analytical blind spots

  // Racing specialisation
  readonly trackPreferences: readonly string[];  // ["Randwick", "Flemington"]
  readonly distanceRange: { min: number; max: number }; // metres
  readonly classRange: { min: number; max: number };    // 1-6 (Group 1 to Maiden)
  readonly surfacePreference: "turf" | "synthetic" | "both";
  readonly weatherSensitivity: number;  // 0-1 (how much weather affects analysis)

  // Conviction strategy
  readonly riskTolerance: number;       // 0-1 (0=conservative, 1=aggressive)
  readonly convictionThreshold: number; // minimum confidence to allocate
  readonly maxAllocationPercent: number; // max % of budget on single horse
  readonly diversificationTarget: number; // target number of races to allocate across

  // ZK identity (for protocol integration)
  readonly identityCommitment: string;  // Semaphore commitment hash
  readonly reputationCommitment: string; // Hash of historical allocations

  // Swarm binding (for personal swarms)
  readonly boundToPunter?: string;      // Punter ID if part of personal swarm
  readonly nonTransferable: boolean;    // Always true for personal swarm members

  // Performance (mutable, updated by Lachesis)
  reputation: ReputationState;          // Accumulated reputation
}

interface ReputationState {
  readonly totalAllocations: number;
  readonly settledAllocations: number;
  readonly calibrationScore: number;    // Brier score: lower = better calibrated
  readonly roi: number;                 // Return on conviction credits
  readonly strikeRate: number;          // % of allocations on winners
  readonly lastSettled: number;         // Unix timestamp
  readonly seasonCredits: number;       // Current credit balance
}
```

---

## Deliverable 5: Personal Swarm Configuration

### How a Punter Configures Their Swarm

The personal swarm is the premium product. Each punter gets a set of synthetic observers tuned to their analytical philosophy. The swarm learns from the punter's history and co-evolves.

#### Configuration Flow

```
PUNTER ONBOARDING
      │
      ▼
1. Preference Questionnaire (via /swarm configure command)
   │
   ├── Risk Profile: Conservative / Balanced / Aggressive
   │     (maps to riskTolerance: 0.2 / 0.5 / 0.8)
   │
   ├── Analytical Preferences (multi-select):
   │     □ Form analysis (weight: 0-10)
   │     □ Track conditions (weight: 0-10)
   │     □ Historical patterns (weight: 0-10)
   │     □ Market analysis (weight: 0-10)
   │     □ Contrarian/value (weight: 0-10)
   │     □ Jockey/trainer focus (weight: 0-10)
   │
   ├── Specialisations:
   │     □ Preferred tracks: [list]
   │     □ Distance preference: Sprint / Middle / Staying
   │     □ Class preference: Group / Listed / Open / Maiden
   │
   └── Swarm Size: 10 / 25 / 50 / 100
       (tied to subscription tier)
      │
      ▼
2. Species Mix Calculation
   │
   │  Analytical weights map to species distribution:
   │  
   │  Form analysis (8/10)     -> 3 Form Scientists
   │  Track conditions (6/10)  -> 2 Track Specialists
   │  Historical (4/10)        -> 1 Historical Analyst
   │  Market analysis (7/10)   -> 2 Integrity Sentinels
   │  Contrarian (9/10)        -> 3 Value Hunters
   │  Jockey/trainer (3/10)    -> 1 Historical Analyst
   │                              ─────────────────
   │  Mandatory:                  1 Consensus Synthesiser
   │  Mandatory:                  1 Adaptive Modeller
   │                              ─────────────────
   │  Total for 14 observers      14 personal swarm members
   │
      ▼
3. Persona Generation (Cerebras)
   │
   │  Each member gets a unique persona WITHIN its species,
   │  but influenced by the punter's preferences:
   │  
   │  "You are a Form Scientist in Dom's personal swarm.
   │   Dom weights form analysis heavily (8/10) and is
   │   aggressive (risk tolerance 0.8). He specialises in
   │   Randwick sprints. Your analysis should be thorough
   │   on form but filtered through his track and distance
   │   preferences."
   │
      ▼
4. Binding & Non-Transferability
   │
   │  readonly boundToPunter: "dom-uuid"
   │  readonly nonTransferable: true
   │  
   │  The binding is enforced at the protocol level:
   │  - Reputation accumulates to the punter+swarm pair
   │  - ZK identity commitment includes punter binding
   │  - Swarm members cannot be "sold" or "traded"
   │
      ▼
5. Co-Evolution Mechanics
   │
   │  After each settlement:
   │  - Lachesis measures each member's accuracy
   │  - Members whose species outperformed get slight
   │    conviction boost (+0.05 risk tolerance)
   │  - Members whose species underperformed get slight
   │    conviction reduction (-0.05 risk tolerance)
   │  - Every 50 races: GEPA evolution pass on the
   │    swarm's analytical parameters
   │  - Every season: species mix re-proposal
   │    (punter approves/rejects changes)
   │
      ▼
6. Swarm → Punter Interface
   │
   │  The punter sees their swarm's aggregate signal:
   │  
   │  "Your swarm analysis for R7 Randwick:"
   │  ┌────────────────────────────────────────┐
   │  │ Horse         │ Swarm QV │ Confidence  │
   │  │ Think About It│   3.2    │ High (78%)  │
   │  │ Star Quality  │   1.8    │ Medium (54%)│
   │  │ Dark Horse    │   0.7    │ Low (31%)   │
   │  └────────────────────────────────────────┘
   │  
   │  The punter then makes their OWN allocation,
   │  informed by but not bound to the swarm signal.
   │  The combined conviction = punter + swarm.
```

### Convex Schema Extension for Personal Swarms

The existing M0 Convex schema needs additional tables:

```typescript
// Additional tables for pi-swarm (extends M0 schema)
observers: defineTable({
  observerId: v.string(),
  species: v.string(),
  persona: v.string(),
  analyticalPhilosophy: v.string(),
  riskTolerance: v.number(),
  convictionThreshold: v.number(),
  boundToPunter: v.optional(v.string()),
  nonTransferable: v.boolean(),
  identityCommitment: v.string(),
  status: v.union(v.literal("active"), v.literal("retired"), v.literal("suspended")),
  createdAt: v.number(),
})
  .index("by_species", ["species"])
  .index("by_punter", ["boundToPunter"])
  .index("by_status", ["status"]),

convictionAllocations: defineTable({
  raceId: v.id("races"),
  observerId: v.string(),
  allocations: v.array(v.object({
    horseName: v.string(),
    horseNumber: v.optional(v.number()),
    qvCredits: v.number(),     // raw credits spent
    qvVotes: v.number(),       // sqrt(credits) = effective votes
  })),
  totalCreditsSpent: v.number(),
  analysis: v.string(),         // analytical reasoning
  confidence: v.number(),       // 0-1
  allocatedAt: v.number(),
  settledAt: v.optional(v.number()),
  payout: v.optional(v.number()),
})
  .index("by_race", ["raceId"])
  .index("by_observer", ["observerId"])
  .index("by_race_observer", ["raceId", "observerId"]),

swarmConfigurations: defineTable({
  punterId: v.string(),
  preferences: v.object({
    riskTolerance: v.number(),
    formWeight: v.number(),
    trackWeight: v.number(),
    historicalWeight: v.number(),
    marketWeight: v.number(),
    contrarianWeight: v.number(),
    specialisations: v.object({
      tracks: v.array(v.string()),
      distances: v.array(v.string()),
      classes: v.array(v.string()),
    }),
  }),
  swarmSize: v.number(),
  speciesMix: v.array(v.object({
    species: v.string(),
    count: v.number(),
  })),
  createdAt: v.number(),
  lastEvolved: v.optional(v.number()),
})
  .index("by_punter", ["punterId"]),
```

---

## Deliverable 6: Ecosystem Seeding Protocol

### Phase 1: Generate 1,000+ Diverse Observers

The cold start solution. The protocol must produce observers that are diverse enough to prevent monoculture but coherent enough to produce genuine intelligence signals.

#### Step 1: Species Distribution (Macro Diversity)

```
1,000 observers distributed across 7 founding species:

Form Scientist:         250 (25%)  -- largest, broadest analytical approach
Track Condition Spec:   150 (15%)  -- environmental expertise
Historical Analyst:     150 (15%)  -- temporal pattern matching
Value Hunter:           150 (15%)  -- contrarian/overlay detection
Integrity Sentinel:     100 (10%)  -- market manipulation detection
Adaptive Modeller:      100 (10%)  -- self-evolving strategies
Consensus Synthesiser:  100 (10%)  -- meta-observation
                       ─────
                       1,000 total
```

#### Step 2: Intra-Species Diversity (Micro Diversity)

Within each species, enforce diversity across these axes:

```
DIVERSITY AXES (per species):

1. Track Specialisation
   - 8 Australian metro tracks (Randwick, Flemington, Caulfield,
     Moonee Valley, Rosehill, Eagle Farm, Morphettville, Ascot)
   - Observers distributed ~evenly across track preferences

2. Distance Preference
   - Sprint (<1200m): 30%
   - Middle (1200-1800m): 40%
   - Staying (>1800m): 30%

3. Class Focus
   - Group/Listed (high class): 25%
   - Open/BM80+ (mid class): 50%
   - Maiden/BM65- (low class): 25%

4. Risk Tolerance
   - Conservative (0.1-0.3): 25%
   - Balanced (0.3-0.6): 50%
   - Aggressive (0.6-0.9): 25%

5. Analytical Variation (species-specific)
   - Form Scientists: speed-focused vs stamina-focused vs barrier-focused
   - Track Specs: inside bias vs outside bias vs surface drainage
   - Etc.
```

The diversity engine generates observers by sampling from these distributions, ensuring no two observers have identical parameters:

```typescript
function generateDiverseObservers(
  species: ObserverSpecies,
  count: number,
  constraints: DiversityConstraints,
): readonly ObserverProfile[] {
  const observers: ObserverProfile[] = [];
  const usedCombinations = new Set<string>();

  for (let i = 0; i < count; i++) {
    let profile: ObserverProfile;
    let combinationKey: string;

    do {
      profile = sampleFromDistribution(species, constraints);
      combinationKey = computeCombinationKey(profile);
    } while (usedCombinations.has(combinationKey));

    usedCombinations.add(combinationKey);
    observers.push(Object.freeze(profile));
  }

  return Object.freeze(observers);
}
```

#### Step 3: Initial Conviction Behaviour (Bootstrapping)

New observers have no reputation history. Bootstrap by:

1. **Back-testing**: Run each observer's analytical philosophy against the last 3 months of historical race data. Generate conviction allocations for past races. Settle against known results. This provides initial reputation scores WITHOUT requiring LLM calls for every historical race.

2. **Conservative initial credits**: New observers start with 1,000 credits (modest). They must earn more through accurate conviction allocation.

3. **Warm-up period**: First 20 races are "learning mode" -- allocations are recorded and settled but reputation changes are dampened (0.5x weight). This prevents early noise from permanently damaging observer credibility.

#### Step 4: Cross-Community Seeding for N x M x P Matrix

For the B2B model (N bookmakers x M sports x P sponsors), each community boundary gets its own subset of observers:

```
Community: "Sportsbet Thoroughbred Racing"
  - 200 observers (subset of 1,000)
  - Weighted toward track conditions specialists
    (Sportsbet brand = data-driven)

Community: "Ladbrokes Thoroughbred Racing"  
  - 200 observers (different subset)
  - Weighted toward form analysts
    (Ladbrokes brand = form guide)

Community: "TTA Original" (our own)
  - 400 observers (full diversity)
  - All 7 species represented

Shared observers: 200 exist in ALL communities
  (provides cross-community signal baseline)

Community-exclusive observers: 600 exist in ONE community each
  (provides community identity and differentiation)
```

#### Seeding Execution Plan

```
Day 0:  Generate 1,000 observer profiles (Cerebras, ~3M tokens, <1 hour)
Day 0:  Back-test against 3 months historical data (local compute, no LLM)
Day 0:  Bootstrap initial reputation scores from back-test
Day 0:  Assign to communities per distribution plan
Day 0:  Ecosystem is ALIVE. First conviction cycle can run.
Day 1:  First live conviction cycle (Saturday races)
Day 1:  Fates oversight begins (Lachesis first sweep)
Week 1: First humans join (they enter a living ecosystem)
Week 4: First GEPA evolution pass on observer parameters
```

---

## Deliverable 7: Fates Oversight for Swarms

### Clotho (Provenance Tracking)

Every conviction allocation carries full provenance metadata, stored as an append-only JSONL file per observer:

```typescript
interface ConvictionProvenance {
  readonly allocationId: string;       // UUID
  readonly observerId: string;         // Who
  readonly species: ObserverSpecies;   // What type
  readonly raceId: string;            // Which race
  readonly timestamp: number;          // When
  readonly model: string;             // "llama-3.3-70b" or "claude-opus"
  readonly inputTokens: number;       // How much data consumed
  readonly outputTokens: number;      // How much analysis produced
  readonly dataSourceIds: string[];   // Which form data, which track reports
  readonly analyticalChain: string;   // Reasoning trace (compressed)
  readonly boundToPunter?: string;    // If personal swarm, which punter
  readonly communityId: string;       // Which community boundary
}
```

Clotho is not a separate agent. It is a logging layer embedded in the `allocate_conviction` tool. Every allocation call writes provenance before returning.

### Lachesis (Performance Measurement)

Lachesis is a Pi-mono Agent running on the Fates oversight schedule (hourly during race days, daily otherwise). It uses Cerebras for cost-effective scanning.

```
LACHESIS SWEEP (hourly during race days)
│
├── 1. Calibration Check
│     For each observer with >20 settled allocations:
│       Compute Brier score = (1/N) * SUM((predicted_prob - actual)^2)
│       Flag if Brier score > species-average + 2*stddev
│       Flag if Brier score trending upward (3 consecutive increases)
│
├── 2. Drift Detection
│     Compare observer's last-50-allocations distribution to its
│     persona-defined preferences:
│       Track specialisation: is it allocating outside its domain?
│       Risk tolerance: is it allocating more/less aggressively?
│       Species behaviour: is it acting like a different species?
│     Flag if drift score > 0.3 (significant persona deviation)
│
├── 3. Correlation Check
│     Compute pairwise correlation between observers' allocations.
│     Flag pairs with correlation > 0.85 over 20+ races.
│     High correlation = potential monoculture.
│     Monoculture kills the ecosystem's diversity advantage.
│
├── 4. Credit Health Check
│     Flag observers with <50 credits (near bankruptcy)
│     Flag observers with >5000 credits (potential concentration)
│     Flag species where >50% of members have declining balances
│
└── 5. Report Generation
      Produce structured JSON report:
      {
        "timestamp": ...,
        "observersScanned": 1000,
        "flags": [...],
        "healthScore": 0-100,
        "recommendations": [...],
      }
      
      Store in .swarm/fates/lachesis-YYYY-MM-DD-HH.jsonl
```

### Atropos (Intervention Engine)

Atropos receives Lachesis reports and applies Graduated Intervention:

```
GRADUATED INTERVENTION PROTOCOL
│
├── Level 0: OBSERVE
│     Default state. All observers operating normally.
│     Lachesis reports consumed but no action taken.
│     Threshold: healthScore > 80
│
├── Level 1: ALERT
│     Lachesis flags exist but within normal variance.
│     Alert written to .swarm/fates/alerts.jsonl
│     Notify via pi.sendMessage() to operator session.
│     Threshold: healthScore 60-80 OR any Level 1 flags
│
├── Level 2: ADVISE
│     Consistent underperformance or drift detected.
│     Atropos generates specific recommendations:
│     "Observer obs-abc123 (Form Scientist) has drifted to
│      Track Specialist behaviour. Recommend persona refresh."
│     Threshold: healthScore 40-60 OR 3+ Level 1 alerts in 24h
│
├── Level 3: INTERVENE
│     Observer is degrading ecosystem quality.
│     Atropos takes direct action:
│     - Suspend observer from allocation (status: "suspended")
│     - Reduce credit balance to minimum
│     - Queue for persona refresh via GEPA evolution
│     Threshold: healthScore < 40 OR Brier score > 0.5
│
└── Level 4: CUT
      Observer is actively harmful (collusion detected, or
      systematic anti-signal generation).
      Atropos retires observer permanently:
      - Status: "retired"
      - Reputation zeroed
      - Spawn replacement with fresh persona
      Threshold: correlation > 0.95 with another observer
                 across 50+ races (possible Sybil)
```

### The Loom (Aggregate Intelligence)

The Loom is the most intellectually interesting Fate. It does not govern individual observers. It reads ALL conviction allocations for a race and produces the collective intelligence signal.

```
THE LOOM — CONVICTION AGGREGATION

Input:  All conviction allocations for Race R
Output: Collective Intelligence Signal (CIS)

1. Raw QV Aggregation
   For each horse H in race R:
     raw_signal(H) = SUM(qv_votes(observer_i, H)) for all observers i
   
   This is the basic QV-weighted average. But it's not enough.

2. Reputation-Weighted Aggregation
   weight(observer_i) = f(calibration_score_i, species_diversity_i)
   
   For each horse H:
     weighted_signal(H) = SUM(weight_i * qv_votes_i_H) / SUM(weight_i)
   
   Better-calibrated observers get more influence.
   Species diversity bonus: signal from a Form Scientist + Track Specialist
   agreement counts more than two Form Scientists agreeing.

3. Inter-Species Disagreement Detection
   For each horse H:
     species_signals = group allocations by species, compute per-species mean
     disagreement_score(H) = variance(species_signals)
   
   High disagreement = low confidence in the aggregate.
   Low disagreement = high confidence (diverse observers agree).

4. Cross-Community Aggregation (Meta-Intelligence)
   When the same race runs in multiple community boundaries:
     For each horse H:
       community_signals = per-community weighted signals
       meta_signal(H) = QV-weighted centroid of community signals
       divergence(H) = max(community_signals) - min(community_signals)
   
   High divergence between communities IS the signal.
   "Sportsbet's community is 70% on Horse X, Ladbrokes is only 40%."
   
   This meta-intelligence is EXCLUSIVELY available to the protocol operator.

5. Output: Collective Intelligence Signal
   {
     race_id: "R7-Randwick-2026-03-28",
     field_size: 12,
     signals: [
       {
         horse: "Think About It",
         raw_qv: 3.2,
         weighted_qv: 3.8,
         confidence: 0.78,
         species_agreement: 0.85,
         community_divergence: 0.12,
       },
       ...
     ],
     aggregate_health: 0.92,
     observer_participation_rate: 0.83,
     timestamp: ...,
   }
```

---

## Implementation Phases

### Phase 0: Foundation (Prerequisites)

**Duration**: 1 sprint (4 hours)
**Dependencies**: None
**Verification**: Extension loads in Pi-mono, tools visible to LLM

1. Create extension directory structure at `~/.pi/agent/extensions/pi-swarm/`
2. Write `package.json` with dependencies (`@sinclair/typebox`, `convex`)
3. Write `src/index.ts` with skeleton extension factory function
4. Register 2 placeholder tools (spawn_observer, query_swarm)
5. Register /swarm command with help text
6. Test: `pi -e ~/.pi/agent/extensions/pi-swarm/src/index.ts`
7. Verify tools appear when LLM is asked to list available tools

**Risk**: Medium -- Pi-mono extension loading with subdirectory structure may require `package.json` `"pi": { "extensions": [...] }` configuration.

### Phase 1: Type System (Week 1)

**Duration**: 2 sprints
**Dependencies**: Phase 0
**Verification**: All types compile, unit tests pass

1. Define all types in `src/types/` (observer.ts, conviction.ts, swarm-state.ts, fates.ts)
2. Define racing ontology constants (fixed 10 entity types, 9 edge types)
3. Write QV math functions in `src/conviction/qv-math.ts`
4. Write diversity engine in `src/persona/diversity.ts`
5. Write temporal graph structure in `src/memory/temporal-graph.ts`
6. Unit tests for QV math (quadratic cost, vote allocation, budget constraints)
7. Unit tests for diversity engine (no duplicate combinations, distribution compliance)

**Risk**: Low -- pure type definitions and math functions, no external dependencies.

### Phase 2: Persona Generation Pipeline (Week 2)

**Duration**: 2 sprints
**Dependencies**: Phase 1
**Verification**: Can generate 10 diverse observer profiles via Cerebras

1. Write species-specific persona templates in `src/persona/templates.ts`
2. Write persona generator tool in `src/persona/generator.ts`
3. Implement `spawn_observer` tool that calls Cerebras Llama 70B to generate persona
4. Write observer persistence to `.swarm/observers/` JSONL
5. Wire into extension: register spawn_observer tool with full TypeBox schema
6. Integration test: spawn 10 observers across 3 species, verify diversity
7. Integration test: verify persona quality (length, required fields, uniqueness)

**Risk**: Medium -- Cerebras API availability and persona quality depend on prompt engineering. May need several iterations on the persona generation prompt.

### Phase 3: Conviction Engine (Week 3)

**Duration**: 2 sprints
**Dependencies**: Phase 2
**Verification**: Observers can allocate convictions and settle against ground truth

1. Write conviction allocator in `src/conviction/allocator.ts`
2. Write ground truth settlement in `src/conviction/settlement.ts`
3. Write reputation accumulation in `src/conviction/reputation.ts`
4. Implement `allocate_conviction` tool (observer analyses race, produces QV allocation)
5. Implement `settle_race` tool (resolves allocations against race result from Convex)
6. Write Convex client in `src/convex/client.ts` to read race data and write allocations
7. Extend Convex schema with observer + conviction tables
8. Integration test: spawn observer, allocate conviction on real race, settle against result

**Risk**: High -- this is the core game mechanic. QV math must be correct. Settlement must handle edge cases (scratched horses, dead heats, abandoned races). Convex schema extension must not break M0.

### Phase 4: Swarm Coordinator (Week 4)

**Duration**: 2 sprints
**Dependencies**: Phase 3
**Verification**: Can coordinate 50 observers through a full conviction cycle

1. Write SwarmCoordinator in `src/coordinator/swarm-coordinator.ts`
2. Write agent pool with pre-warming in `src/coordinator/agent-pool.ts`
3. Write token budget management in `src/coordinator/budget.ts`
4. Write lifecycle management (spawn, configure, retire) in `src/coordinator/lifecycle.ts`
5. Write shared swarm state in `src/memory/swarm-state.ts`
6. Implement `query_swarm` tool with health metrics
7. Integration test: coordinate 50 observers through Night>Dawn>Day cycle

**Risk**: High -- managing N concurrent Agent instances within Pi-mono's single-agent-per-session model requires careful design. The coordinator likely runs as a Node.js process that manages Agent instances programmatically via the pi-agent-core package (not the coding-agent TUI).

### Phase 5: Fates Oversight (Week 5)

**Duration**: 2 sprints
**Dependencies**: Phase 4
**Verification**: Lachesis can scan 50 observers and Atropos can intervene

1. Write Clotho provenance logging in `src/fates/clotho.ts`
2. Write Lachesis performance measurement in `src/fates/lachesis.ts`
3. Write Atropos intervention engine in `src/fates/atropos.ts`
4. Write The Loom aggregation in `src/fates/loom.ts`
5. Implement `fates_report` tool
6. Register /fates command
7. Integration test: inject an underperforming observer, verify Lachesis flags it, Atropos suspends it

**Risk**: Medium -- the graduated intervention thresholds will need tuning. Initial values are educated guesses. Will need 2-3 GEPA evolution passes on the threshold parameters.

### Phase 6: Personal Swarm Configuration (Week 6)

**Duration**: 2 sprints
**Dependencies**: Phase 5
**Verification**: A punter can configure a 25-member personal swarm

1. Write preference questionnaire flow in `src/tools/configure-personal.ts`
2. Write species mix calculator
3. Write punter-bound persona generation (Cerebras)
4. Write co-evolution mechanics (post-settlement parameter adjustment)
5. Implement `configure_personal` tool
6. Register /swarm configure command
7. Integration test: configure personal swarm, run 5 conviction cycles, verify co-evolution adjusts parameters

**Risk**: Medium -- the co-evolution mechanics must be subtle enough to be meaningful but stable enough not to oscillate.

### Phase 7: Ecosystem Seeding (Week 7)

**Duration**: 2 sprints
**Dependencies**: Phase 6
**Verification**: 1,000 diverse observers alive, back-tested, with initial reputation

1. Write batch persona generation (1,000 observers, parallelised Cerebras calls)
2. Write back-testing engine (run against 3 months historical data, no LLM)
3. Write reputation bootstrapping from back-test results
4. Write community assignment logic (N x M x P distribution)
5. Write seeding justfile recipes (`just swarm:seed 1000`)
6. Execute seeding on real data
7. Verification: diversity audit (no monoculture), reputation distribution (bell curve), community coverage

**Risk**: High -- batch generation of 1,000 profiles at Cerebras is ~3M tokens. Must handle rate limits, retries, partial failures. Back-testing engine must be fast enough to process 3 months x 80 races/day = ~7,200 races.

### Phase 8: Domain Portability Proof (Week 8)

**Duration**: 1 sprint
**Dependencies**: Phase 7
**Verification**: System runs on a second sport (greyhound racing) with minimal changes

1. Define greyhound racing ontology (entity types, edge types)
2. Define greyhound-specific species variations
3. Generate 100 greyhound observers using existing pipeline
4. Run conviction cycle on greyhound race data
5. Verify: only the ontology and species templates changed. All infrastructure is identical.

**Risk**: Low -- this is the domain portability test. If Phase 1-7 followed the Four-Layer Stack, this should be a matter of new parser types.

---

## Dependencies Between Phases

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
                                                      │           │
                                                      │           ▼
                                                      └──────► Phase 6
                                                                  │
                                                                  ▼
                                                              Phase 7
                                                                  │
                                                                  ▼
                                                              Phase 8
```

Phases 5 and 6 can begin in parallel once Phase 4 is stable. Phase 7 requires both 5 and 6. Phase 8 validates the full stack.

---

## Risks and Mitigations

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Pi-mono Agent class not designed for programmatic multi-agent | High | High | Use pi-agent-core directly (not pi-coding-agent TUI). The Agent class is explicitly designed for programmatic use. The SwarmCoordinator manages Agent instances, not pi sessions. |
| Cerebras rate limits block batch persona generation | High | Medium | Implement exponential backoff with jitter. Generate in waves of 50. Cache partial results. Fall back to CLIProxyAPI if Cerebras is unavailable. |
| QV math implementation error corrupts conviction allocations | Critical | Low | Comprehensive unit test suite with known-good QV examples from the literature. Property-based testing (total votes < total credits, cost is monotonically increasing). |
| Persona monoculture despite diversity engine | Medium | Medium | Post-generation audit: compute pairwise cosine similarity between persona embeddings. Flag and regenerate any pair with similarity > 0.8. |
| Convex schema extension breaks M0 foundation | High | Low | New tables only. Never modify existing tables. Test M0's 52 existing tests remain green after schema extension. |
| Fates intervention thresholds too aggressive (kills too many observers) | Medium | Medium | Start with conservative thresholds (only CUT at correlation > 0.95). Log all would-be interventions for first month without executing. Tune from data. |
| Token budget insufficient for full Saturday card | Medium | Medium | The budget analysis shows 77% buffer. Monitor actual usage during Phase 4 integration tests. Implement circuit breaker if daily budget hits 80%. |
| Back-testing on historical data is not predictive of live performance | Low | High | Expected. Back-testing provides initial reputation only. First 20 live races have dampened reputation updates. The ecosystem is designed to converge through live play. |

---

## Success Criteria

- [ ] Extension loads cleanly in Pi-mono with `pi -e` flag
- [ ] All 6 tools are callable by the LLM (spawn, allocate, settle, query, configure, fates)
- [ ] 1,000+ diverse observers generated across 7 species with enforced diversity
- [ ] A single observer can analyse a race and produce a QV conviction allocation
- [ ] 50 observers can complete a full Night>Dawn>Day conviction cycle
- [ ] Lachesis correctly identifies underperforming observers
- [ ] Atropos suspends/retires flagged observers without manual intervention
- [ ] The Loom produces a collective intelligence signal that differs from simple averaging
- [ ] A punter can configure a personal swarm of 25 members
- [ ] Personal swarm co-evolves (parameters shift) after 50 settled races
- [ ] Conviction allocations are compatible with existing Convex schema (M0 tests stay green)
- [ ] Daily Cerebras token budget stays under 50% on a full Saturday card
- [ ] System runs on a second sport (greyhound racing) with only ontology+template changes
- [ ] ZK identity commitments are generated for all observers (Semaphore-compatible hashes)

---

## Key File Paths

- Pi-mono Agent class: `/home/dom/pi-mono/packages/agent/src/agent.ts`
- Pi-mono Agent types: `/home/dom/pi-mono/packages/agent/src/types.ts`
- Pi-mono ExtensionAPI types: `/home/dom/pi-mono/packages/coding-agent/src/core/extensions/types.ts`
- Pi-mono extension docs: `/home/dom/pi-mono/packages/coding-agent/docs/extensions.md`
- Pi-mono extension examples: `/home/dom/pi-mono/packages/coding-agent/examples/sdk/06-extensions.ts`
- Pi-mono example extension (tps): `/home/dom/pi-mono/.pi/extensions/tps.ts`
- Kernel SOUL: `/home/dom/promethiana-labs/kernel/SOUL.md`
- Kernel PROCESS: `/home/dom/promethiana-labs/kernel/PROCESS.md`
- Kernel STRUCTURE: `/home/dom/promethiana-labs/kernel/STRUCTURE.md`
- Kernel KNOWLEDGE: `/home/dom/promethiana-labs/kernel/KNOWLEDGE.md`
- Kernel COMPOSITION: `/home/dom/promethiana-labs/kernel/COMPOSITION.md`
- Kernel EVOLUTION: `/home/dom/promethiana-labs/kernel/EVOLUTION.md`
- MiroFish ontology generator: `/home/dom/MiroFish/backend/app/services/ontology_generator.py`
- MiroFish profile generator: `/home/dom/MiroFish/backend/app/services/oasis_profile_generator.py`
- MiroFish graph builder: `/home/dom/MiroFish/backend/app/services/graph_builder.py`
- MiroFish simulation runner: `/home/dom/MiroFish/backend/app/services/simulation_runner.py`
- TTA Convex schema: `/home/dom/tta-matrix/packages/convex/convex/schema.ts`
- TTA shared types: `/home/dom/tta-matrix/packages/shared/src/types.ts`
- Conviction Game RSW: `/home/dom/tta-matrix/.planning/RSW-CONVICTION-GAME.md`
- Conviction Game Lenses: `/home/dom/tta-matrix/.planning/CONVICTION-GAME-LENSES.md`
