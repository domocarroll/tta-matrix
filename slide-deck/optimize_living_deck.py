#!/usr/bin/env python3
"""
The Conviction Game -- Living Deck GEPA Optimizer
==================================================
Evolves WebGL shader parameters in conviction-game-living.html through
LLM-guided evolutionary search. Each slide is alive with a tectonic
recursion shader whose uniforms encode narrative arc position.

GEPA mutates the SECTION_PRESETS JSON embedded in the HTML, then
screenshots every slide via Playwright and scores them with a VLM.

Usage:
    # 1. Start a local HTTP server
    python3 -m http.server 8770 --directory ~/tta-matrix/slide-deck &

    # 2. Run the optimizer
    python3 optimize_living_deck.py

    # Optional flags:
    python3 optimize_living_deck.py --max-iters 50 --sample 0,3,8,14,22,29

Requires:
    - gepa, litellm, playwright (pip install gepa litellm playwright)
    - playwright install chromium
    - CLIProxyAPI running on localhost:8317
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------

_MISSING: list[str] = []

try:
    import gepa  # noqa: F401
except ImportError:
    _MISSING.append("gepa")

try:
    import litellm  # noqa: F401
except ImportError:
    _MISSING.append("litellm")

try:
    import playwright  # noqa: F401
except ImportError:
    _MISSING.append("playwright")

if _MISSING:
    print(f"Missing dependencies: {', '.join(_MISSING)}")
    print(f"Install with: pip install {' '.join(_MISSING)}")
    if "playwright" not in _MISSING:
        print("Then: playwright install chromium")
    sys.exit(1)

# Check Playwright browsers
try:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        _browser = p.chromium.launch(headless=True)
        _browser.close()
except Exception:
    print("Playwright chromium not installed.")
    print("Run: playwright install chromium")
    sys.exit(1)

import gepa.optimize_anything as oa
from gepa.optimize_anything import (
    EngineConfig,
    GEPAConfig,
    ReflectionConfig,
    optimize_anything,
)
from gepa.image import Image
from gepa.utils.stop_condition import (
    NoImprovementStopper,
    ScoreThresholdStopper,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DECK_DIR = Path("/home/dom/tta-matrix/slide-deck")
LIVING_HTML = DECK_DIR / "conviction-game-living.html"
GALLERY_DIR = DECK_DIR / "deck-evolution"
SCORES_LOG = GALLERY_DIR / "living-scores.jsonl"

HTTP_PORT = 8770
PREVIEW_URL = f"http://localhost:{HTTP_PORT}/conviction-game-living.html"
CLI_PROXY_BASE = "http://localhost:8317/v1"
API_KEY = "gepa-proxy-key"
REFLECTION_MODEL = "openai/claude-sonnet-4-5-20250929"

MAX_ITERATIONS = 30  # sensible default, override with --max-iters
SCORE_THRESHOLD = 8.5
PATIENCE = 15  # stop after N evals with no improvement

# Per-slide screenshot wait (seconds) for shader to develop visual character
SHADER_SETTLE_TIME = 2.5

# Viewport matches Reveal.js configured dimensions
VIEWPORT = {"width": 1280, "height": 720}

# ---------------------------------------------------------------------------
# The mutation surface: SECTION_PRESETS
# ---------------------------------------------------------------------------

# This regex captures the SECTION_PRESETS = { ... } object literal from the HTML.
# The optimizer replaces ONLY this object, leaving all other code untouched.
PRESETS_PATTERN = re.compile(
    r"(const\s+SECTION_PRESETS\s*=\s*)([\s\S]*?)(;\s*\n)",
    re.MULTILINE,
)

# The parameter ranges GEPA is allowed to explore.
# Used for validation and documented in the objective/background.
PARAM_RANGES = {
    "u_speed":             (0.008, 0.060),
    "u_warpStrength":      (0.4,   3.5),
    "u_fractureIntensity": (2.0,   35.0),
    "u_terracottaBleed":   (0.01,  0.25),
    "u_grainAmount":       (0.005, 0.045),
    "u_vignetteStrength":  (0.02,  0.30),
    "u_flowAngle":         (0.0,   1.5),
    "u_contrastBoost":     (0.02,  0.25),
}

# Sections in the deck, mapped to narrative arc positions.
# This defines which slides belong to which arc section.
SECTION_ARC = {
    "recognition": "opening",
    "problem":     "problem",
    "concepts":    "evidence",
    "synthesis":   "insight",
    "game":        "solution",
    "business":    "proof",
    "moat":        "climax",
    "ask":         "closing",
}

# ---------------------------------------------------------------------------
# Scoring rubric
# ---------------------------------------------------------------------------

OBJECTIVE = """
Optimize the SECTION_PRESETS shader parameters in this Living Conviction Game
slide deck for maximum visual and communication impact.

The mutation surface is a JSON object mapping section names (recognition,
problem, concepts, synthesis, game, business, moat, ask) to shader uniform
values. Each section has these tunable parameters:

- u_speed (0.008-0.060): Animation speed. Lower = more meditative, higher = more energy
- u_warpStrength (0.4-3.5): Domain warp intensity. How geological/tectonic the pattern feels
- u_fractureIntensity (2.0-35.0): Fracture line visibility via fwidth multiplier
- u_terracottaBleed (0.01-0.25): How much terracotta accent seeps through fractures
- u_grainAmount (0.005-0.045): Film grain opacity
- u_vignetteStrength (0.02-0.30): Edge darkening / spotlight effect
- u_flowAngle (0.0-1.5): Directional flow of the noise pattern
- u_contrastBoost (0.02-0.25): Overall contrast push

GOALS:
1. Narrative arc encoding: opening slides should be CALM and restrained,
   problem slides should feel TENSE, concepts should be STRUCTURED,
   synthesis should CRYSTALLIZE, game should feel ALIVE, business should
   feel CONFIDENT, moat should be the CLIMAX (maximum energy), ask should
   return to CALM authority.

2. Text readability: ALL text on EVERY slide must be clearly legible over
   the shader. The shader enhances, never competes.

3. Motion quality: Organic, geological, meditative -- not mechanical or
   flashy. This is a sophisticated pitch deck, not a shader demo.

4. Design coherence: All slides should feel like they belong to the same
   family while having distinct character per arc position.

5. Anti-generic: Avoid converging to flat, boring, or generic AI aesthetics.
   The deck should feel hand-crafted and intentional.

Output the SECTION_PRESETS as valid JSON. Keep ALL section keys present.
Do NOT add new parameters or remove existing sections.
HIGHER SCORE = BETTER. Target: composite >= 8.5/10.
"""

BACKGROUND = """
## Deck Context
The Conviction Game is a pitch deck for a horse racing intelligence platform
presented to "Warwick" -- a racing industry insider. The visual language should
feel premium, warm, tectonic -- like geological forces beneath a calm surface.

## Brand Palette
- Parchment warm: approximately (0.96, 0.94, 0.91) or #f5f0e8
- Parchment cool: approximately (0.91, 0.93, 0.96) or #e8edf5
- Terracotta accent: approximately (0.77, 0.35, 0.24) or #c55a3d
- Base dark: #0a0e17 -- but the shader uses parchment tones with dark vignette

## Arc Energy Curve (target)
opening: 2/10 energy (barely moving, sophisticated restraint)
problem: 5/10 (fractures emerging, tension building)
evidence: 3/10 (clean, structured, data-friendly)
insight: 6/10 (crystallization, focal point pulls)
solution: 5/10 (confident directional flow)
proof: 7/10 (rich detail, dense conviction)
climax: 9/10 (maximum tectonic activity)
closing: 2/10 (return to authority, echo of opening)

## What NOT to do
- Do NOT make any section flashy or sci-fi
- Do NOT make all sections look the same (that means the arc encoding failed)
- Do NOT increase speed beyond 0.06 anywhere
- Do NOT crank fracture intensity above 35 -- it becomes noise
- Do NOT sacrifice text readability for visual drama
- Do NOT use extreme vignette that blackens slide edges too aggressively

## Scoring Criteria (weighted composite)
- Visual Impact (25%): Does the shader + content create a compelling visual?
- Text Readability (25%): Is ALL text clearly readable over the shader?
- Motion Quality (20%): Does the shader feel organic, not mechanical?
- Design Coherence (15%): Does this slide belong in the same deck family?
- Distinctiveness (15%): Does it avoid generic AI aesthetics?
"""

# Per-slide VLM scoring prompt
SCORING_PROMPT = """You are evaluating a single slide from a WebGL-powered pitch deck.
The slide has a tectonic recursion shader as its background with text overlaid.

Score EACH dimension 0-10 (decimals allowed). Be critical and honest.

Dimensions:
- Visual Impact (VI): Does the shader + content create a compelling, premium visual?
  Consider depth, color harmony, movement suggestion, cinematic quality.
- Text Readability (TR): Is ALL text on this slide clearly legible over the shader?
  Even dim/secondary text should be readable. Contrast is critical.
- Motion Quality (MQ): Based on this static frame, does the noise pattern suggest
  organic, geological motion? No banding, no mechanical grid artifacts, no aliasing?
- Design Coherence (DC): Does this slide feel like it belongs in a premium, cohesive
  deck? Consider palette consistency, visual weight, spacing.
- Distinctiveness (DI): Does this avoid looking like "generic AI art"? Is there
  intentionality and craft? Would a human designer be proud of this?

Format your response EXACTLY as:
VI: X.X
TR: X.X
MQ: X.X
DC: X.X
DI: X.X

Then provide 1-2 sentences of SPECIFIC, ACTIONABLE feedback for improvement.
Mention which parameters might need adjustment (speed, warp, fracture, terracotta,
grain, vignette, contrast) and in which direction.
"""

# Axis config for score parsing
SCORE_AXES = {
    "vi": {"pattern": r"VI\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.25},
    "tr": {"pattern": r"TR\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.25},
    "mq": {"pattern": r"MQ\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.20},
    "dc": {"pattern": r"DC\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.15},
    "di": {"pattern": r"DI\s*[:\-=]\s*(\d+\.?\d*)", "weight": 0.15},
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_eval_count = 0


def _detect_last_pass() -> int:
    """Resume from the last archived pass number."""
    existing = list(GALLERY_DIR.glob("living-pass-*"))
    if not existing:
        return 0
    nums = []
    for f in existing:
        try:
            nums.append(int(f.name.split("-")[2]))
        except (IndexError, ValueError):
            continue
    return max(nums) if nums else 0


def extract_presets(html: str) -> dict | None:
    """Extract the SECTION_PRESETS object from the HTML source."""
    m = PRESETS_PATTERN.search(html)
    if not m:
        return None
    raw_js = m.group(2).strip()
    # JS object literal -> JSON: add quotes to unquoted keys, handle trailing commas
    jsonified = _js_object_to_json(raw_js)
    try:
        return json.loads(jsonified)
    except json.JSONDecodeError:
        return None


def _js_object_to_json(js: str) -> str:
    """Best-effort conversion of a JS object literal to valid JSON.
    Handles: unquoted keys, single-quoted strings, trailing commas, comments.
    """
    # Remove single-line comments
    s = re.sub(r"//[^\n]*", "", js)
    # Remove multi-line comments
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    # Quote unquoted keys: word chars before a colon
    s = re.sub(r'(?<=[{,\n])\s*(\w+)\s*:', r' "\1":', s)
    # Replace single quotes with double quotes (simple cases)
    s = s.replace("'", '"')
    # Remove trailing commas before } or ]
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s


def inject_presets(html: str, presets: dict) -> str:
    """Replace the SECTION_PRESETS object in HTML with the new presets dict."""
    presets_json = json.dumps(presets, indent=2)
    # Convert JSON to JS object literal style (unquoted keys are fine in ES6,
    # but we keep the JSON format since it's valid JS too)
    replacement = rf"\g<1>{presets_json}\g<3>"
    new_html, count = PRESETS_PATTERN.subn(replacement, html)
    if count == 0:
        raise ValueError(
            "Could not find SECTION_PRESETS in the HTML. "
            "Ensure conviction-game-living.html contains "
            "'const SECTION_PRESETS = { ... };'"
        )
    return new_html


def clamp_presets(presets: dict) -> dict:
    """Clamp all parameter values to their valid ranges."""
    clamped = {}
    for section, params in presets.items():
        clamped_params = {}
        for key, val in params.items():
            if key in PARAM_RANGES and isinstance(val, (int, float)):
                lo, hi = PARAM_RANGES[key]
                clamped_params[key] = round(max(lo, min(hi, float(val))), 4)
            elif key == "u_focalCenter" and isinstance(val, list):
                clamped_params[key] = [
                    round(max(0.0, min(1.0, float(v))), 3) for v in val[:2]
                ]
            else:
                clamped_params[key] = val
        clamped[section] = clamped_params
    return clamped


def screenshot_all_slides(
    url: str,
    out_dir: Path,
    sample_indices: list[int] | None = None,
) -> list[str]:
    """Screenshot slides via Playwright's Reveal.js API.

    Returns list of screenshot file paths.
    """
    from playwright.sync_api import sync_playwright

    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        page.goto(url, wait_until="networkidle")
        # Wait for Reveal.js to initialize
        page.wait_for_function("typeof Reveal !== 'undefined' && Reveal.isReady()")
        time.sleep(1.0)

        total = page.evaluate("Reveal.getTotalSlides()")
        indices = sample_indices if sample_indices is not None else list(range(total))

        for i in indices:
            if i >= total:
                continue
            # Navigate to the slide
            page.evaluate(f"Reveal.slide({i})")
            # Wait for shader to develop visual character
            time.sleep(SHADER_SETTLE_TIME)
            path = str(out_dir / f"slide_{i:02d}.png")
            page.screenshot(path=path)
            paths.append(path)

        browser.close()

    return paths


def llm_score_slide(image_path: str) -> tuple[dict, float, str]:
    """Score a single slide screenshot via VLM.

    Returns (per_axis_scores, composite, raw_feedback).
    """
    import litellm as _litellm

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    try:
        response = _litellm.completion(
            model=REFLECTION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": SCORING_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{b64}",
                            },
                        },
                    ],
                }
            ],
            api_base=CLI_PROXY_BASE,
            api_key=API_KEY,
        )
        feedback = response.choices[0].message.content
    except Exception as e:
        feedback = (
            f"VI: 5.0\nTR: 5.0\nMQ: 5.0\nDC: 5.0\nDI: 5.0\n"
            f"VLM scoring failed: {e}"
        )

    scores = {}
    for key, cfg in SCORE_AXES.items():
        m = re.search(cfg["pattern"], feedback, re.IGNORECASE)
        scores[key] = min(float(m.group(1)), 10.0) if m else 5.0

    composite = sum(scores[k] * SCORE_AXES[k]["weight"] for k in SCORE_AXES)
    return scores, composite, feedback


def compute_arc_energy_score(presets: dict) -> float:
    """Programmatic check: does the energy curve match the target arc?

    Compares the 'energy' (composite of speed + warp + fracture) per section
    against the target energy curve. Returns 0-10, higher = better alignment.
    """
    target_energy = {
        "recognition": 0.2,
        "problem":     0.5,
        "concepts":    0.3,
        "synthesis":   0.6,
        "game":        0.5,
        "business":    0.7,
        "moat":        0.9,
        "ask":         0.2,
    }

    if not presets:
        return 5.0

    errors: list[float] = []
    for section, target in target_energy.items():
        params = presets.get(section, {})
        # Normalize each parameter to 0-1 within its range, then compute energy
        speed_norm = _normalize(params.get("u_speed", 0.02), 0.008, 0.060)
        warp_norm = _normalize(params.get("u_warpStrength", 1.0), 0.4, 3.5)
        frac_norm = _normalize(params.get("u_fractureIntensity", 10.0), 2.0, 35.0)
        terra_norm = _normalize(params.get("u_terracottaBleed", 0.05), 0.01, 0.25)

        actual_energy = (
            speed_norm * 0.3
            + warp_norm * 0.3
            + frac_norm * 0.25
            + terra_norm * 0.15
        )
        errors.append(abs(actual_energy - target))

    mean_error = sum(errors) / len(errors)
    # Convert error (0-1) to score (0-10)
    return round(max(0.0, 10.0 - mean_error * 20.0), 2)


def _normalize(val: float, lo: float, hi: float) -> float:
    """Normalize value to 0-1 range."""
    if hi <= lo:
        return 0.5
    return max(0.0, min(1.0, (val - lo) / (hi - lo)))


def compute_section_diversity_score(presets: dict) -> float:
    """Score how distinct sections are from each other. 0-10.

    We want sections to be different enough to encode the narrative arc.
    All-identical sections score 0. Maximum spread scores 10.
    """
    if not presets or len(presets) < 2:
        return 5.0

    vectors: list[list[float]] = []
    for _section, params in presets.items():
        vec = [
            _normalize(params.get("u_speed", 0.02), 0.008, 0.060),
            _normalize(params.get("u_warpStrength", 1.0), 0.4, 3.5),
            _normalize(params.get("u_fractureIntensity", 10.0), 2.0, 35.0),
            _normalize(params.get("u_terracottaBleed", 0.05), 0.01, 0.25),
            _normalize(params.get("u_grainAmount", 0.02), 0.005, 0.045),
            _normalize(params.get("u_vignetteStrength", 0.1), 0.02, 0.30),
        ]
        vectors.append(vec)

    # Mean pairwise distance
    distances: list[float] = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            dist = sum((a - b) ** 2 for a, b in zip(vectors[i], vectors[j])) ** 0.5
            distances.append(dist)

    if not distances:
        return 5.0

    mean_dist = sum(distances) / len(distances)
    # Max possible distance for 6D unit cube ~ sqrt(6) ~ 2.45
    # Good diversity ~0.5-1.0 mean distance
    return round(min(10.0, mean_dist * 12.0), 2)


def archive_pass(
    pass_num: int,
    presets: dict,
    per_slide_scores: dict[int, dict],
    composite: float,
    feedback_texts: list[str],
    screenshot_dir: Path,
) -> None:
    """Archive this evaluation pass to the gallery."""
    # Save presets
    presets_file = GALLERY_DIR / f"living-presets-{pass_num:03d}.json"
    presets_file.write_text(json.dumps(presets, indent=2))

    # Append to scores log
    log_entry = {
        "pass": pass_num,
        "composite": round(composite, 3),
        "per_slide": {
            str(k): {axis: round(v, 2) for axis, v in scores.items()}
            for k, scores in per_slide_scores.items()
        },
    }
    with SCORES_LOG.open("a") as f:
        f.write(json.dumps(log_entry) + "\n")


# ---------------------------------------------------------------------------
# The Evaluator
# ---------------------------------------------------------------------------


def evaluate_living_deck(candidate: str) -> tuple[float, dict]:
    """
    GEPA evaluator for the living deck.

    The candidate is the SECTION_PRESETS JSON string.

    Pipeline:
    1. Parse candidate as JSON presets
    2. Clamp values to valid ranges
    3. Inject into HTML and write to disk
    4. Screenshot each slide via Playwright + Reveal.js API
    5. Score each slide via VLM (Claude vision)
    6. Compute programmatic arc energy + diversity scores
    7. Return weighted composite + rich ASI
    """
    global _eval_count
    _eval_count += 1
    pass_num = _eval_count

    oa.log(f"=== Living Deck Pass {pass_num} ===")

    # 1. Parse presets
    try:
        presets = json.loads(candidate)
    except json.JSONDecodeError as e:
        oa.log(f"Invalid JSON: {e}")
        return 0.0, {"error": f"JSON parse error: {e}"}

    # 2. Clamp to valid ranges
    presets = clamp_presets(presets)
    oa.log(f"Sections: {list(presets.keys())}")

    # 3. Inject into HTML
    try:
        base_html = LIVING_HTML.read_text()
        new_html = inject_presets(base_html, presets)
        LIVING_HTML.write_text(new_html)
        oa.log("Injected presets into living HTML")
    except Exception as e:
        oa.log(f"Injection failed: {e}")
        return 0.0, {"error": str(e)}

    # 4. Screenshot slides
    shot_dir = GALLERY_DIR / f"living-pass-{pass_num:03d}"
    try:
        # Get total slide count first, then screenshot all of them
        from playwright.sync_api import sync_playwright as _sp

        with _sp() as p:
            br = p.chromium.launch(headless=True)
            pg = br.new_page(viewport=VIEWPORT)
            pg.goto(PREVIEW_URL, wait_until="networkidle")
            pg.wait_for_function(
                "typeof Reveal !== 'undefined' && Reveal.isReady()"
            )
            total_slides = pg.evaluate("Reveal.getTotalSlides()")
            br.close()

        oa.log(f"Total slides: {total_slides}")

        # Sample slides: take every slide if <= 12, otherwise sample key ones
        if total_slides <= 12:
            sample = list(range(total_slides))
        else:
            # Sample: first, last, and evenly spaced in between + section starts
            step = max(1, total_slides // 10)
            sample = sorted(
                set(
                    [0, total_slides - 1]
                    + list(range(0, total_slides, step))
                    + [3, 7, 14, 19, 22, 27]  # key narrative slides
                )
            )
            sample = [s for s in sample if s < total_slides]

        shots = screenshot_all_slides(PREVIEW_URL, shot_dir, sample)
        oa.log(f"Screenshots captured: {len(shots)}")
    except Exception as e:
        oa.log(f"Screenshot failed: {e}")
        return 0.0, {"error": f"Screenshot error: {e}"}

    # 5. VLM-score each screenshot
    per_slide_scores: dict[int, dict] = {}
    per_slide_composites: list[float] = []
    all_feedback: list[str] = []

    for shot_path in shots:
        slide_idx = int(Path(shot_path).stem.split("_")[1])
        try:
            scores, comp, feedback = llm_score_slide(shot_path)
            per_slide_scores[slide_idx] = scores
            per_slide_composites.append(comp)
            all_feedback.append(f"Slide {slide_idx}: {feedback}")
            oa.log(
                f"  Slide {slide_idx}: VI={scores['vi']:.1f} TR={scores['tr']:.1f} "
                f"MQ={scores['mq']:.1f} DC={scores['dc']:.1f} DI={scores['di']:.1f} "
                f"=> {comp:.2f}"
            )
        except Exception as e:
            oa.log(f"  Slide {slide_idx} scoring error: {e}")
            per_slide_composites.append(5.0)

    # Mean VLM score across sampled slides
    vlm_mean = (
        sum(per_slide_composites) / len(per_slide_composites)
        if per_slide_composites
        else 5.0
    )

    # 6. Programmatic scores
    arc_score = compute_arc_energy_score(presets)
    diversity_score = compute_section_diversity_score(presets)
    oa.log(f"Arc alignment: {arc_score:.1f} | Diversity: {diversity_score:.1f}")

    # 7. Weighted composite
    # VLM covers visual impact, readability, motion, coherence, distinctiveness
    # Arc + diversity are programmatic correctness checks
    composite = (
        vlm_mean * 0.70        # VLM visual quality (dominant signal)
        + arc_score * 0.18     # Narrative arc encoding
        + diversity_score * 0.12  # Section distinctiveness
    )
    composite = round(composite, 3)

    oa.log(
        f"VLM: {vlm_mean:.2f} | Arc: {arc_score:.1f} | "
        f"Diversity: {diversity_score:.1f} | COMPOSITE: {composite:.2f}"
    )

    # 8. Archive
    archive_pass(
        pass_num, presets, per_slide_scores, composite, all_feedback, shot_dir
    )
    oa.log(f"Archived to living-pass-{pass_num:03d}")

    # 9. Build ASI (Actionable Side Information)
    # Include the first screenshot for the reflection LM to see
    side_info: dict[str, Any] = {
        "scores": {
            "vlm_visual_mean": round(vlm_mean, 2),
            "arc_alignment": arc_score,
            "section_diversity": diversity_score,
        },
        "per_slide_scores": {
            str(k): {ax: round(v, 2) for ax, v in sc.items()}
            for k, sc in per_slide_scores.items()
        },
        "Feedback": "\n---\n".join(all_feedback[:6]),
        "Pass": pass_num,
        "Presets": presets,
    }

    # Attach up to 3 screenshots for the VLM reflection
    for i, shot_path in enumerate(shots[:3]):
        side_info[f"Screenshot_{i}"] = Image(path=shot_path)

    return composite, side_info


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="GEPA optimizer for the Living Conviction Game deck"
    )
    parser.add_argument(
        "--max-iters",
        type=int,
        default=MAX_ITERATIONS,
        help=f"Maximum GEPA iterations (default: {MAX_ITERATIONS})",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=SCORE_THRESHOLD,
        help=f"Stop when composite >= this (default: {SCORE_THRESHOLD})",
    )
    parser.add_argument(
        "--patience",
        type=int,
        default=PATIENCE,
        help=f"Stop after N evals with no improvement (default: {PATIENCE})",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last archived pass",
    )
    args = parser.parse_args()

    # Verify living HTML exists
    if not LIVING_HTML.exists():
        print(f"ERROR: {LIVING_HTML} does not exist.")
        print(
            "Create the living deck first (with WebGL shaders and SECTION_PRESETS), "
            "then run this optimizer."
        )
        sys.exit(1)

    # Verify SECTION_PRESETS is present
    html_content = LIVING_HTML.read_text()
    seed_presets = extract_presets(html_content)
    if seed_presets is None:
        print("ERROR: Could not find SECTION_PRESETS in the HTML.")
        print(
            "The file must contain: const SECTION_PRESETS = { ... }; "
            "with valid JSON-like section presets."
        )
        sys.exit(1)

    # Check CLIProxyAPI
    try:
        import urllib.request

        req = urllib.request.Request(
            f"{CLI_PROXY_BASE}/models",
            headers={"Authorization": f"Bearer {API_KEY}"},
        )
        urllib.request.urlopen(req, timeout=5)
        print("CLIProxyAPI: connected")
    except Exception as e:
        print(f"WARNING: CLIProxyAPI not reachable at {CLI_PROXY_BASE}: {e}")
        print("Ensure CLIProxyAPI is running: cd ~/CLIProxyAPI && ./cli-proxy-api &")
        print("Continuing anyway -- VLM calls will fail gracefully.")

    # Setup
    GALLERY_DIR.mkdir(parents=True, exist_ok=True)

    global _eval_count
    if args.resume:
        _eval_count = _detect_last_pass()
        if _eval_count > 0:
            print(f"Resuming from pass {_eval_count}")

    # Seed candidate is the SECTION_PRESETS JSON
    seed_json = json.dumps(seed_presets, indent=2)

    print(f"Seed presets loaded: {len(seed_presets)} sections")
    print(f"  Sections: {', '.join(seed_presets.keys())}")
    print(f"Living HTML: {LIVING_HTML}")
    print(f"Preview URL: {PREVIEW_URL}")
    print(f"Gallery: {GALLERY_DIR}")
    print(f"Reflection model: {REFLECTION_MODEL} via CLIProxyAPI")
    print(f"Budget: {args.max_iters} iterations")
    print(f"Threshold: {args.threshold} | Patience: {args.patience}")
    print()

    # Configure GEPA
    os.environ["OPENAI_API_BASE"] = CLI_PROXY_BASE
    os.environ["OPENAI_API_KEY"] = API_KEY

    config = GEPAConfig(
        engine=EngineConfig(
            max_metric_calls=args.max_iters,
            run_dir=str(GALLERY_DIR / ".gepa_living_runs"),
            display_progress_bar=True,
            candidate_selection_strategy="pareto",
        ),
        reflection=ReflectionConfig(
            reflection_lm=oa.make_litellm_lm(REFLECTION_MODEL),
        ),
        stop_callbacks=[
            ScoreThresholdStopper(threshold=args.threshold),
            NoImprovementStopper(patience=args.patience),
        ],
    )

    print("Starting GEPA optimize_anything()...")
    print("=" * 60)

    result = optimize_anything(
        seed_candidate=seed_json,
        evaluator=evaluate_living_deck,
        objective=OBJECTIVE,
        background=BACKGROUND,
        config=config,
    )

    # Extract best candidate
    best = result.best_candidate
    if isinstance(best, dict):
        best = best.get("current_candidate", json.dumps(best, indent=2))

    # Parse and inject final result
    try:
        best_presets = json.loads(best) if isinstance(best, str) else best
        best_presets = clamp_presets(best_presets)

        # Read the original HTML (not the last mutation) to avoid corruption
        final_html = LIVING_HTML.read_text()
        final_html = inject_presets(final_html, best_presets)
        LIVING_HTML.write_text(final_html)

        # Also save the best presets standalone
        best_presets_path = GALLERY_DIR / "best-presets.json"
        best_presets_path.write_text(json.dumps(best_presets, indent=2))

        print()
        print("=" * 60)
        print("Optimization complete.")
        print(f"Best presets written to: {LIVING_HTML}")
        print(f"Best presets backup: {best_presets_path}")
        print(f"Score log: {SCORES_LOG}")
        print(f"Gallery: {GALLERY_DIR}")
        print(f"Preview: {PREVIEW_URL}")
    except Exception as e:
        print(f"Error writing final result: {e}")
        # Dump raw best candidate for manual recovery
        fallback = GALLERY_DIR / "best-candidate-raw.txt"
        fallback.write_text(str(best))
        print(f"Raw best candidate saved to: {fallback}")


if __name__ == "__main__":
    main()
