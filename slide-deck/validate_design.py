#!/usr/bin/env python3
"""
The Conviction Game — Better Casey Design Validation
=====================================================
Screenshots every slide of the living deck and runs a multi-dimensional
design critique inspired by Better Casey's anti-pattern detection and
Impeccable's design language.

Outputs a full design review to DESIGN-REVIEW.md.

Usage:
    cd ~/tta-matrix/slide-deck
    python3 validate_design.py

Requires:
    - CLIProxyAPI running on localhost:8317
    - playwright Python package (with chromium installed)
    - litellm Python package
"""

import base64
import json
import os
import re
import signal
import subprocess
import sys
import textwrap
import time
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SLIDE_DECK_DIR = Path("/home/dom/tta-matrix/slide-deck")
DECK_FILE = "conviction-game-deck.html"
SCREENSHOT_DIR = SLIDE_DECK_DIR / "screenshots"
REPORT_PATH = SLIDE_DECK_DIR / "DESIGN-REVIEW.md"

HTTP_PORT = 8098
PREVIEW_URL = f"http://localhost:{HTTP_PORT}/{DECK_FILE}"

CLI_PROXY_BASE = "http://localhost:8317/v1"
API_KEY = "design-validate"
MODEL = "openai/claude-sonnet-4-5-20250929"

VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720

# Wait times (seconds)
INITIAL_LOAD_WAIT = 3.0  # WebGL shader + font load
PER_SLIDE_WAIT = 2.0     # Shader morph + text reveals

# ---------------------------------------------------------------------------
# Design Critique Dimensions (Better Casey style)
# ---------------------------------------------------------------------------

CRITIQUE_DIMENSIONS = {
    "palette_coherence": {
        "code": "PC",
        "label": "Palette Coherence",
        "weight": 0.20,
        "description": (
            "Do all slides share a unified color system? Are accents used "
            "sparingly and intentionally? Tinted neutrals (never pure gray/black)? "
            "No more than 5 colors beyond neutrals? Is the 60-30-10 visual weight "
            "rule respected?"
        ),
    },
    "typography_hierarchy": {
        "code": "TH",
        "label": "Typography Hierarchy",
        "weight": 0.20,
        "description": (
            "Is there a clear, consistent typographic scale across slides? "
            "Title > body > dim hierarchy crystal clear? Max 2-3 font sizes per "
            "slide? No orphaned words on headings? Body text minimum 16px? "
            "Line heights above 1.4 for body? Tabular nums for data?"
        ),
    },
    "shader_text_readability": {
        "code": "SR",
        "label": "Shader-Text Readability",
        "weight": 0.25,
        "description": (
            "Is text perfectly legible over the background treatment (shader, "
            "gradient, noise)? Sufficient contrast ratio for WCAG AA? Does the "
            "background enhance or compete with the text? Any areas where visual "
            "noise degrades readability?"
        ),
    },
    "visual_rhythm": {
        "code": "VR",
        "label": "Visual Rhythm",
        "weight": 0.20,
        "description": (
            "Viewed as a sequence, do slides alternate density appropriately? "
            "Is there breathing room between high-density and low-density slides? "
            "Does whitespace feel intentional? Does the emotional arc (recognition "
            "-> problem -> concepts -> synthesis -> game -> business -> moat -> ask) "
            "have a visual energy curve that matches?"
        ),
    },
    "anti_ai_slop": {
        "code": "AS",
        "label": "Anti-AI Slop",
        "weight": 0.15,
        "description": (
            "The AI Slop Test: if you showed this to someone and said 'AI made "
            "this,' would they believe you immediately? Check for: purple/blue "
            "gradients (the AI slop aesthetic), generic card layouts, centered-"
            "everything defaults, bounce/elastic easing, competing focal points, "
            "over-designed borders/shadows, decorative-without-purpose motion, "
            "Dribbble cliche compositions."
        ),
    },
}

# ---------------------------------------------------------------------------
# Per-slide critique prompt
# ---------------------------------------------------------------------------

PER_SLIDE_PROMPT = textwrap.dedent("""\
    You are Better Casey, the AI design director with impeccable taste.
    Critique this slide screenshot from a dark-themed pitch deck called
    "The Conviction Game" (horse racing meets game theory).

    Score each dimension 0-10 (10 = flawless). Be critical — a 7 is generous.

    Dimensions:
    - PC (Palette Coherence): {pc_desc}
    - TH (Typography Hierarchy): {th_desc}
    - SR (Shader-Text Readability): {sr_desc}
    - VR (Visual Rhythm): {vr_desc}
    - AS (Anti-AI Slop): {as_desc}

    Format your scores EXACTLY as:
    PC: X.X
    TH: X.X
    SR: X.X
    VR: X.X
    AS: X.X

    Then provide 2-3 sentences of specific, actionable critique for THIS slide.
    Reference concrete visual elements (colors, sizes, spacing, contrast).
    Do NOT be generic. Name what you see.
""").format(
    pc_desc=CRITIQUE_DIMENSIONS["palette_coherence"]["description"],
    th_desc=CRITIQUE_DIMENSIONS["typography_hierarchy"]["description"],
    sr_desc=CRITIQUE_DIMENSIONS["shader_text_readability"]["description"],
    vr_desc=CRITIQUE_DIMENSIONS["visual_rhythm"]["description"],
    as_desc=CRITIQUE_DIMENSIONS["anti_ai_slop"]["description"],
)

# ---------------------------------------------------------------------------
# Batch synthesis prompt (all slides at once)
# ---------------------------------------------------------------------------

SYNTHESIS_PROMPT = textwrap.dedent("""\
    You are Better Casey, the AI design director with impeccable taste.
    You're reviewing the ENTIRE slide deck "The Conviction Game" as a cohesive
    presentation. Below are screenshots of every slide in order.

    The deck's emotional arc: Recognition -> Problem -> Concepts -> Synthesis ->
    Game -> Business -> Moat -> Ask.

    Perform a holistic design critique across these dimensions:

    1. **Palette Coherence** (PC): {pc_desc}
    2. **Typography Hierarchy** (TH): {th_desc}
    3. **Shader-Text Readability** (SR): {sr_desc}
    4. **Visual Rhythm** (VR): {vr_desc}
    5. **Anti-AI Slop** (AS): {as_desc}

    For each dimension, provide:
    - A score 0-10 (be critical — 7 is generous)
    - 3-5 specific observations with slide references (e.g., "Slide 5: ...")
    - Concrete recommendations (exact colors, sizes, spacing values)

    Also provide:
    - **Overall Composite Score** (weighted: PC 20%, TH 20%, SR 25%, VR 20%, AS 15%)
    - **Top 3 Strengths** — what the deck does well
    - **Top 3 Weaknesses** — highest-impact improvements
    - **The Casey Verdict** — one sentence summary of design quality

    Format dimension scores EXACTLY as:
    PC: X.X
    TH: X.X
    SR: X.X
    VR: X.X
    AS: X.X
    COMPOSITE: X.X

    Then provide the full critique.
""").format(
    pc_desc=CRITIQUE_DIMENSIONS["palette_coherence"]["description"],
    th_desc=CRITIQUE_DIMENSIONS["typography_hierarchy"]["description"],
    sr_desc=CRITIQUE_DIMENSIONS["shader_text_readability"]["description"],
    vr_desc=CRITIQUE_DIMENSIONS["visual_rhythm"]["description"],
    as_desc=CRITIQUE_DIMENSIONS["anti_ai_slop"]["description"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_http_server_proc = None


def start_http_server():
    """Start a Python HTTP server serving the slide deck directory."""
    global _http_server_proc
    _http_server_proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(HTTP_PORT)],
        cwd=str(SLIDE_DECK_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.0)
    print(f"  HTTP server started on port {HTTP_PORT} (PID {_http_server_proc.pid})")
    return _http_server_proc


def stop_http_server():
    """Stop the HTTP server."""
    global _http_server_proc
    if _http_server_proc is not None:
        _http_server_proc.terminate()
        try:
            _http_server_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _http_server_proc.kill()
        print("  HTTP server stopped.")
        _http_server_proc = None


def screenshot_all_slides():
    """Screenshot every slide using Playwright. Returns list of file paths."""
    from playwright.sync_api import sync_playwright

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

    paths = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT}
        )

        print(f"  Navigating to {PREVIEW_URL}")
        page.goto(PREVIEW_URL, wait_until="networkidle")

        print(f"  Waiting {INITIAL_LOAD_WAIT}s for initial load...")
        time.sleep(INITIAL_LOAD_WAIT)

        total_slides = page.evaluate("Reveal.getTotalSlides()")
        print(f"  Detected {total_slides} slides")

        for i in range(total_slides):
            page.evaluate(f"Reveal.slide({i})")
            time.sleep(PER_SLIDE_WAIT)

            path = str(SCREENSHOT_DIR / f"slide-{i:02d}.png")
            page.screenshot(path=path)
            paths.append(path)
            print(f"    Captured slide {i:02d}/{total_slides - 1}")

        browser.close()

    print(f"  {len(paths)} screenshots saved to {SCREENSHOT_DIR}")
    return paths


def encode_image(path):
    """Read an image file and return its base64 encoding."""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def llm_call(prompt, image_paths=None):
    """Call the VLM via CLIProxyAPI with optional images."""
    import litellm

    content = [{"type": "text", "text": prompt}]

    if image_paths:
        for img_path in image_paths:
            b64 = encode_image(img_path)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64}"},
            })

    response = litellm.completion(
        model=MODEL,
        messages=[{"role": "user", "content": content}],
        api_base=CLI_PROXY_BASE,
        api_key=API_KEY,
    )
    return response.choices[0].message.content


def parse_scores(feedback):
    """Extract dimension scores from LLM feedback text."""
    scores = {}
    patterns = {
        "palette_coherence": r"PC\s*[:\-=]\s*(\d+\.?\d*)",
        "typography_hierarchy": r"TH\s*[:\-=]\s*(\d+\.?\d*)",
        "shader_text_readability": r"SR\s*[:\-=]\s*(\d+\.?\d*)",
        "visual_rhythm": r"VR\s*[:\-=]\s*(\d+\.?\d*)",
        "anti_ai_slop": r"AS\s*[:\-=]\s*(\d+\.?\d*)",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, feedback, re.IGNORECASE)
        if match:
            scores[key] = min(float(match.group(1)), 10.0)
        else:
            scores[key] = 5.0

    composite = sum(
        scores[k] * CRITIQUE_DIMENSIONS[k]["weight"]
        for k in CRITIQUE_DIMENSIONS
    )
    return scores, round(composite, 2)


def parse_composite_from_synthesis(feedback):
    """Extract the COMPOSITE score from synthesis feedback."""
    match = re.search(r"COMPOSITE\s*[:\-=]\s*(\d+\.?\d*)", feedback, re.IGNORECASE)
    if match:
        return min(float(match.group(1)), 10.0)
    return None


def critique_per_slide(screenshot_paths):
    """Run per-slide critique. Returns list of (slide_index, scores, feedback)."""
    results = []
    total = len(screenshot_paths)

    for i, path in enumerate(screenshot_paths):
        print(f"  Critiquing slide {i:02d}/{total - 1}...")
        try:
            feedback = llm_call(PER_SLIDE_PROMPT, image_paths=[path])
            scores, composite = parse_scores(feedback)
            results.append({
                "slide": i,
                "scores": scores,
                "composite": composite,
                "feedback": feedback,
                "screenshot": Path(path).name,
            })
            print(f"    Composite: {composite:.1f}")
        except Exception as e:
            print(f"    Error on slide {i}: {e}")
            results.append({
                "slide": i,
                "scores": {k: 0.0 for k in CRITIQUE_DIMENSIONS},
                "composite": 0.0,
                "feedback": f"Error: {e}",
                "screenshot": Path(path).name,
            })

    return results


def critique_batch_synthesis(screenshot_paths):
    """Run holistic batch critique across all slides. Returns (scores, composite, feedback)."""
    print("  Running holistic synthesis critique (all slides)...")

    # Send all screenshots in a single request
    try:
        feedback = llm_call(SYNTHESIS_PROMPT, image_paths=screenshot_paths)
        scores, weighted_composite = parse_scores(feedback)
        explicit_composite = parse_composite_from_synthesis(feedback)
        composite = explicit_composite if explicit_composite is not None else weighted_composite
        print(f"  Synthesis composite: {composite:.1f}")
        return scores, composite, feedback
    except Exception as e:
        print(f"  Synthesis critique failed: {e}")
        return (
            {k: 0.0 for k in CRITIQUE_DIMENSIONS},
            0.0,
            f"Error: {e}",
        )


# ---------------------------------------------------------------------------
# Report Generation
# ---------------------------------------------------------------------------

def generate_report(
    per_slide_results,
    synthesis_scores,
    synthesis_composite,
    synthesis_feedback,
    screenshot_paths,
):
    """Generate the DESIGN-REVIEW.md markdown report."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    total_slides = len(per_slide_results)

    # Compute per-dimension averages across all slides
    dim_averages = {}
    for dim_key in CRITIQUE_DIMENSIONS:
        values = [r["scores"].get(dim_key, 0) for r in per_slide_results]
        dim_averages[dim_key] = round(sum(values) / max(len(values), 1), 1)

    overall_per_slide_avg = round(
        sum(r["composite"] for r in per_slide_results) / max(total_slides, 1), 1
    )

    # Find best and worst slides
    sorted_slides = sorted(per_slide_results, key=lambda r: r["composite"])
    worst_3 = sorted_slides[:3]
    best_3 = sorted_slides[-3:][::-1]

    # Build the report
    lines = []

    # Header
    lines.append("# The Conviction Game -- Design Review")
    lines.append("")
    lines.append(f"**Generated**: {now}")
    lines.append(f"**Deck**: `{DECK_FILE}`")
    lines.append(f"**Slides**: {total_slides}")
    lines.append(f"**Model**: `{MODEL}` via CLIProxyAPI")
    lines.append(f"**Method**: Better Casey design critique (per-slide + holistic synthesis)")
    lines.append("")

    # Score Summary
    lines.append("---")
    lines.append("")
    lines.append("## Score Summary")
    lines.append("")
    lines.append("| Dimension | Code | Weight | Per-Slide Avg | Synthesis Score |")
    lines.append("|-----------|------|--------|---------------|-----------------|")
    for dim_key, dim_cfg in CRITIQUE_DIMENSIONS.items():
        code = dim_cfg["code"]
        weight = f"{dim_cfg['weight']:.0%}"
        avg = dim_averages.get(dim_key, 0)
        synth = synthesis_scores.get(dim_key, 0)
        lines.append(f"| {dim_cfg['label']} | {code} | {weight} | {avg:.1f} | {synth:.1f} |")
    lines.append("")
    lines.append(f"**Per-Slide Average Composite**: {overall_per_slide_avg:.1f} / 10")
    lines.append(f"**Holistic Synthesis Composite**: {synthesis_composite:.1f} / 10")
    lines.append("")

    # Score Distribution
    lines.append("### Score Distribution")
    lines.append("")
    lines.append("```")
    for r in per_slide_results:
        bar_len = int(r["composite"] * 3)
        bar = "#" * bar_len + "." * (30 - bar_len)
        lines.append(f"  Slide {r['slide']:02d}  [{bar}] {r['composite']:.1f}")
    lines.append("```")
    lines.append("")

    # Best & Worst
    lines.append("### Strongest Slides")
    lines.append("")
    for r in best_3:
        lines.append(f"- **Slide {r['slide']:02d}** ({r['composite']:.1f})")
    lines.append("")

    lines.append("### Weakest Slides (highest improvement potential)")
    lines.append("")
    for r in worst_3:
        lines.append(f"- **Slide {r['slide']:02d}** ({r['composite']:.1f})")
    lines.append("")

    # Holistic Synthesis
    lines.append("---")
    lines.append("")
    lines.append("## Holistic Synthesis Critique")
    lines.append("")
    lines.append(synthesis_feedback)
    lines.append("")

    # Per-Slide Detail
    lines.append("---")
    lines.append("")
    lines.append("## Per-Slide Detail")
    lines.append("")
    for r in per_slide_results:
        lines.append(f"### Slide {r['slide']:02d} -- Composite: {r['composite']:.1f}")
        lines.append("")
        lines.append(f"![Slide {r['slide']:02d}](screenshots/{r['screenshot']})")
        lines.append("")
        lines.append("| Dimension | Score |")
        lines.append("|-----------|-------|")
        for dim_key, dim_cfg in CRITIQUE_DIMENSIONS.items():
            score = r["scores"].get(dim_key, 0)
            lines.append(f"| {dim_cfg['label']} | {score:.1f} |")
        lines.append("")
        # Clean up the feedback -- remove the score lines since we show them in the table
        feedback_lines = r["feedback"].strip().split("\n")
        critique_lines = []
        for fl in feedback_lines:
            if re.match(r"^(PC|TH|SR|VR|AS)\s*[:\-=]", fl.strip()):
                continue
            critique_lines.append(fl)
        critique_text = "\n".join(critique_lines).strip()
        if critique_text:
            lines.append(f"> {critique_text}")
            lines.append("")
        lines.append("")

    # Methodology
    lines.append("---")
    lines.append("")
    lines.append("## Methodology")
    lines.append("")
    lines.append("This review uses the Better Casey design critique framework:")
    lines.append("")
    lines.append("1. **Per-slide analysis**: Each slide screenshotted and scored individually")
    lines.append("   on 5 dimensions by a VLM (vision-language model).")
    lines.append("2. **Holistic synthesis**: All screenshots sent as a batch for cross-slide")
    lines.append("   coherence analysis (palette flow, visual rhythm, narrative arc alignment).")
    lines.append("3. **Anti-AI Slop Test**: \"If you showed this to someone and said 'AI made")
    lines.append("   this,' would they believe you immediately? If yes, that's the problem.\"")
    lines.append("")
    lines.append("### Scoring Guide")
    lines.append("")
    lines.append("- **9-10**: Exceptional. Ships as-is.")
    lines.append("- **7-8**: Strong. Minor polish needed.")
    lines.append("- **5-6**: Acceptable. Clear improvement opportunities.")
    lines.append("- **3-4**: Weak. Needs significant rework.")
    lines.append("- **1-2**: Broken. Fundamental issues.")
    lines.append("")

    report = "\n".join(lines)
    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("  The Conviction Game -- Better Casey Design Validation")
    print("=" * 60)
    print()

    # Verify deck file exists
    deck_path = SLIDE_DECK_DIR / DECK_FILE
    if not deck_path.exists():
        print(f"ERROR: Deck file not found at {deck_path}")
        sys.exit(1)

    # Step 1: Start HTTP server
    print("[1/5] Starting HTTP server...")
    start_http_server()

    try:
        # Step 2: Screenshot all slides
        print()
        print("[2/5] Screenshotting all slides...")
        screenshot_paths = screenshot_all_slides()

        if not screenshot_paths:
            print("ERROR: No screenshots captured.")
            sys.exit(1)

        # Step 3: Per-slide critique
        print()
        print("[3/5] Running per-slide design critique...")
        per_slide_results = critique_per_slide(screenshot_paths)

        # Step 4: Holistic synthesis critique (all slides as batch)
        print()
        print("[4/5] Running holistic synthesis critique...")
        synthesis_scores, synthesis_composite, synthesis_feedback = (
            critique_batch_synthesis(screenshot_paths)
        )

        # Step 5: Generate report
        print()
        print("[5/5] Generating design review report...")
        report = generate_report(
            per_slide_results,
            synthesis_scores,
            synthesis_composite,
            synthesis_feedback,
            screenshot_paths,
        )

        REPORT_PATH.write_text(report)
        print(f"  Report written to {REPORT_PATH}")

        # Print summary
        print()
        print("=" * 60)
        print("  DESIGN REVIEW COMPLETE")
        print("=" * 60)
        print()

        per_slide_avg = round(
            sum(r["composite"] for r in per_slide_results)
            / max(len(per_slide_results), 1),
            1,
        )
        print(f"  Per-Slide Average:    {per_slide_avg} / 10")
        print(f"  Holistic Synthesis:   {synthesis_composite} / 10")
        print()

        for dim_key, dim_cfg in CRITIQUE_DIMENSIONS.items():
            values = [r["scores"].get(dim_key, 0) for r in per_slide_results]
            avg = sum(values) / max(len(values), 1)
            synth = synthesis_scores.get(dim_key, 0)
            print(f"  {dim_cfg['label']:.<30s} avg {avg:.1f}  synth {synth:.1f}")

        print()
        print(f"  Report: {REPORT_PATH}")
        print(f"  Screenshots: {SCREENSHOT_DIR}/")
        print()

    finally:
        # Always stop the HTTP server
        stop_http_server()


if __name__ == "__main__":
    main()
