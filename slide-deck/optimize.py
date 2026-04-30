#!/usr/bin/env python3
"""
The Conviction Game — GEPA Deck Optimizer

Evolves deck_config.json through LLM-guided evolutionary search.
Uses CLIProxyAPI on localhost:8317 for zero-cost LLM access.

Usage:
    python3 -m http.server 8770 &    # serve the deck
    python3 optimize.py              # run optimization
"""

import base64
import json
import os
import re
import sys
import time
from pathlib import Path

import gepa.optimize_anything as oa
from gepa.optimize_anything import (
    EngineConfig,
    GEPAConfig,
    ReflectionConfig,
    optimize_anything,
)
from gepa.image import Image

# Import renderer
sys.path.insert(0, str(Path.home() / ".claude/skills/slide-deck-optimizer/templates"))
from render_deck import render

# ── Config ────────────────────────────────────

DECK_CONFIG = Path("./deck_config.json")
DECK_HTML = Path("./deck.html")
GALLERY = Path("./deck-evolution")
PREVIEW_URL = "http://localhost:8770/deck.html"

CLI_PROXY = "http://localhost:8317/v1"
API_KEY = "gepa-proxy-key"
MODEL = "openai/claude-sonnet"

MAX_ITERS = 10  # start small, increase if working

OBJECTIVE = """
Optimize this pitch deck config (JSON) for maximum persuasive impact on Warwick,
a racing industry insider who is NOT tech/crypto.

IMPROVE:
- Copy: shorter, punchier, more concrete racing metaphors
- Visual: better color contrast, spacing, font size balance
- Density: each slide under 25 words visible text (ideal: 10-20)
- Audience: would Warwick understand immediately? Would he keep clicking?

DO NOT CHANGE:
- The frozen section content (thesis, financials, concepts)
- Slide order or emotional arc structure
- The "id" fields on slides
- The meta or frozen sections
- Financial numbers ($32B, 4 users, $0/$25/$100)

Output MUST be valid JSON matching the input schema exactly.
"""

BACKGROUND = """
Audience: Warwick ("Woz"), racing industry insider.
Understands: punters, tipsters, bookmakers, corporate boxes, the track.
Does NOT understand: crypto, ZK proofs, quadratic voting (as tech concepts).
Responds to: concrete examples, racing metaphors, clear "so what" moments.
Disengages from: walls of text, academic framing, jargon.

The "digital corporate box" metaphor is the narrative spine — it should feel
natural and inevitable when it arrives at slide 23.
"""

VISUAL_PROMPT = """Score this slide screenshot. Dark theme presentation deck.

- READABILITY (RD): Text legibility, contrast ratio, font size (10 = perfect)
- HIERARCHY (HI): Clear title > body > dim hierarchy (10 = crystal clear)
- WHITESPACE (WS): Balanced breathing room (10 = ideal)
- PREMIUM (PM): Professional/premium feel (10 = boardroom quality)

Format EXACTLY:
RD: X.X
HI: X.X
WS: X.X
PM: X.X

Then 1-2 sentences of specific actionable improvement."""

VISUAL_AXES = {
    "rd": {"pattern": r"RD\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.30},
    "hi": {"pattern": r"HI\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.30},
    "ws": {"pattern": r"WS\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.20},
    "pm": {"pattern": r"PM\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.20},
}

# ── Helpers ───────────────────────────────────

_eval_count = 0


def screenshot_slides(url, out_dir, sample=None):
    """Screenshot slides via Playwright. sample = list of indices to capture."""
    from playwright.sync_api import sync_playwright

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(url, wait_until="networkidle")
        time.sleep(1.5)

        total = page.evaluate("Reveal.getTotalSlides()")
        indices = sample if sample else range(total)
        paths = []

        for i in indices:
            if i >= total:
                continue
            page.evaluate(f"Reveal.slide({i})")
            time.sleep(0.3)
            path = str(out_dir / f"slide_{i:02d}.png")
            page.screenshot(path=path)
            paths.append(path)

        browser.close()
    return paths


def llm_call(prompt, image_path=None):
    """Call LLM via litellm through CLIProxyAPI."""
    import litellm

    content = [{"type": "text", "text": prompt}]
    if image_path:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"}
        })

    resp = litellm.completion(
        model=MODEL,
        messages=[{"role": "user", "content": content}],
        api_base=CLI_PROXY,
        api_key=API_KEY,
    )
    return resp.choices[0].message.content


def parse_scores(feedback, axes):
    scores = {}
    for key, cfg in axes.items():
        m = re.search(cfg["pattern"], feedback, re.IGNORECASE)
        scores[key] = min(float(m.group(1)), 10.0) if m else 5.0
    composite = sum(scores[k] * axes[k]["weight"] for k in axes)
    return scores, composite


def word_count(config):
    """Programmatic density score."""
    counts = []
    for s in config.get("slides", []):
        words = 0
        for f in ["title", "body", "subtitle", "sidebar", "value", "label"]:
            v = s.get(f)
            if v is None:
                continue
            text = v if isinstance(v, str) else v.get("text", "")
            words += len(text.split())
        counts.append(words)
    over = sum(1 for c in counts if c > 25)
    avg = sum(counts) / max(len(counts), 1)
    return min(max(0, 10 - over * 1.5 - max(0, avg - 20) * 0.3), 10.0)


# ── Evaluator ─────────────────────────────────

def evaluate(candidate: str) -> tuple[float, dict]:
    global _eval_count
    _eval_count += 1
    n = _eval_count

    oa.log(f"=== Pass {n} ===")

    # Parse
    try:
        config = json.loads(candidate)
    except json.JSONDecodeError as e:
        oa.log(f"Bad JSON: {e}")
        return 0.0, {"error": str(e)}

    # Render
    DECK_CONFIG.write_text(candidate)
    render(str(DECK_CONFIG), str(DECK_HTML))
    slide_count = len(config.get("slides", []))
    oa.log(f"Rendered {slide_count} slides")

    # Screenshot sample slides (title, problem, concept, synthesis, game, business, moat, ask)
    shot_dir = GALLERY / f"pass-{n:03d}"
    sample = [0, 3, 5, 8, 10, 14, 19, 22, 26, 29]
    try:
        shots = screenshot_slides(PREVIEW_URL, shot_dir, sample=sample)
        oa.log(f"Screenshots: {len(shots)}")
    except Exception as e:
        oa.log(f"Screenshot failed: {e}")
        return 0.0, {"error": str(e)}

    # VLM score (sample 3 screenshots to save API calls)
    visual_scores = []
    visual_feedback = []
    for path in shots[:3]:
        try:
            fb = llm_call(VISUAL_PROMPT, image_path=path)
            sc, comp = parse_scores(fb, VISUAL_AXES)
            visual_scores.append(comp)
            visual_feedback.append(fb)
        except Exception as e:
            oa.log(f"VLM error: {e}")
            visual_scores.append(5.0)

    visual_avg = sum(visual_scores) / max(len(visual_scores), 1)

    # Density score
    density = word_count(config)

    # Composite
    composite = visual_avg * 0.40 + density * 0.60  # weight density high for copy optimization
    oa.log(f"Visual: {visual_avg:.1f} | Density: {density:.1f} | Composite: {composite:.1f}")

    # Archive
    (GALLERY / "scores.jsonl").open("a").write(
        json.dumps({"pass": n, "visual": visual_avg, "density": density, "composite": composite}) + "\n"
    )

    # ASI
    side = {
        "scores": {"visual": visual_avg, "density": density},
        "Feedback": "\n---\n".join(visual_feedback[:2]),
        "Pass": n,
    }
    if shots:
        side["Screenshot"] = Image.from_file(shots[0])

    return composite, side


# ── Main ──────────────────────────────────────

def main():
    GALLERY.mkdir(parents=True, exist_ok=True)

    seed = DECK_CONFIG.read_text()
    config = json.loads(seed)
    print(f"Seed: {len(config['slides'])} slides")
    print(f"Preview: {PREVIEW_URL}")
    print(f"Model: {MODEL} via CLIProxyAPI:{CLI_PROXY}")
    print(f"Budget: {MAX_ITERS} evaluations")
    print()

    os.environ["OPENAI_API_BASE"] = CLI_PROXY
    os.environ["OPENAI_API_KEY"] = API_KEY

    gepa_config = GEPAConfig(
        engine=EngineConfig(
            max_metric_calls=MAX_ITERS,
            run_dir=str(GALLERY / ".gepa_runs"),
            display_progress_bar=True,
            candidate_selection_strategy="pareto",
        ),
        reflection=ReflectionConfig(
            reflection_lm=oa.make_litellm_lm(MODEL),
        ),
    )

    print("Starting GEPA optimize_anything()...")
    print("=" * 60)

    result = optimize_anything(
        seed_candidate=seed,
        evaluator=evaluate,
        objective=OBJECTIVE,
        background=BACKGROUND,
        config=gepa_config,
    )

    best = result.best_candidate
    if isinstance(best, dict):
        best = best.get("current_candidate", json.dumps(best, indent=2))

    DECK_CONFIG.write_text(best)
    render(str(DECK_CONFIG), str(DECK_HTML))

    print()
    print("=" * 60)
    print(f"Optimization complete!")
    print(f"Best config: {DECK_CONFIG}")
    print(f"Best HTML: {DECK_HTML}")
    print(f"Gallery: {GALLERY}")


if __name__ == "__main__":
    main()
