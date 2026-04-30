# Video Plan: Animated Concept Explainers

**Tools**: Manim (mathematical animation) + Remotion (polished video production)
**Output**: GIFs embedded in reveal.js slides + standalone MP4 explainers
**Purpose**: Each key concept gets a 10-15 second animated visualization

---

## Phase 1: Manim Animations (Mathematical Precision)

Manim creates beautiful mathematical animations. Each produces a GIF for slide embedding AND an MP4 for standalone use.

### Animation 1: Quadratic Cost Curve
**Slide**: 11 (QUADRATIC COST)
**Duration**: 12s
**Storyboard**:
1. (0-2s) X-axis appears: "Votes". Y-axis: "Cost"
2. (2-6s) Parabola draws itself (y = x²), gold line on dark bg
3. (6-8s) Dots plot at (1,1), (2,4), (3,9), (5,25) with labels fading in
4. (8-10s) Text "3.3× advantage" materializes at center
5. (10-12s) Arrow showing "attacker pushes uphill" vs "honesty sits in valley"

```python
# quadratic_cost.py
from manim import *

class QuadraticCost(Scene):
    def construct(self):
        ax = Axes(x_range=[0, 6], y_range=[0, 30], axis_config={"color": "#6a6a78"})
        curve = ax.plot(lambda x: x**2, color="#f0c040", x_range=[0, 5.5])
        dots = [(1,1), (2,4), (3,9), (5,25)]

        self.play(Create(ax), run_time=1)
        self.play(Create(curve), run_time=2)
        for x, y in dots:
            dot = Dot(ax.c2p(x, y), color="#f0c040")
            label = Text(f"{y}", font_size=20, color="#c8c8d0").next_to(dot, UP)
            self.play(FadeIn(dot), FadeIn(label), run_time=0.5)

        stat = Text("3.3×", font_size=72, color="#f0c040", font="Montserrat")
        stat.move_to(ax.c2p(3, 15))
        self.play(FadeIn(stat, scale=0.5), run_time=1)
        self.wait(2)
```

### Animation 2: The Conviction Loop
**Slide**: 16 (The Closed Loop)
**Duration**: 15s
**Storyboard**:
1. (0-2s) First node appears: "GROUND TRUTH" (gold, top)
2. (2-8s) Each subsequent node draws in clockwise with connecting arrow
3. (8-10s) Final arrow completes the loop back to GROUND TRUTH
4. (10-12s) All arrows pulse gold simultaneously (the system breathing)
5. (12-15s) "30 min" appears at center, clock icon ticking

### Animation 3: Wave Function Collapse
**Slide**: 18 (Honesty dominates)
**Duration**: 10s
**Storyboard**:
1. (0-2s) Wide probability distribution (uncertainty) across horse field
2. (2-4s) Label: "Race 1 result" — distribution snaps narrower
3. (4-6s) Label: "Race 10" — distribution tightens further
4. (6-8s) Label: "Race 20" — distribution collapses to a spike
5. (8-10s) Text: "Honesty is the dominant strategy" fades in

### Animation 4: Sandpile Avalanche
**Slide**: 22 (The Shark) or new slide
**Duration**: 12s
**Storyboard**:
1. (0-3s) Leaderboard bars stack up — top player grows tall
2. (3-5s) Top player gets one wrong — bar trembles
3. (5-7s) AVALANCHE — bars redistribute, new leader emerges
4. (7-10s) System finds new equilibrium
5. (10-12s) Text: "Emergent drama. Not designed."

### Animation 5: N×M×P Grid
**Slide**: 26 (Every Bookmaker Gets a Box)
**Duration**: 12s
**Storyboard**:
1. (0-2s) Empty 3D grid materializes (rows × cols × depth)
2. (2-6s) Boxes fill in one by one — Sportsbet row, Ladbrokes row, TAB row
3. (6-8s) Each box lights up with conviction signals
4. (8-10s) Camera pulls back to show META layer glowing above all
5. (10-12s) Text: "Only the box-builder sees all boxes"

---

## Phase 2: Remotion Video Production

Remotion wraps Manim outputs + slide content into polished video segments with transitions, titles, and sound design hooks.

### Deliverable A: Concept Trailer (60s)
Assembly of all 5 Manim animations with:
- Title cards between each
- Consistent dark theme
- Sound design: low drone, subtle clicks for transitions
- Closing: "The Conviction Game — Coming soon"
- **Use**: Twitter/LinkedIn teaser, investor intro

### Deliverable B: Per-Slide Videos
Each animation rendered at 1280×720 to match slide dimensions.
Embedded as `<video>` elements in reveal.js with `data-autoplay`.
Video plays when the slide appears, pauses when you navigate away.

```html
<!-- reveal.js video embed -->
<section data-bg="synthesis">
  <video data-autoplay loop muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0.15;">
    <source src="videos/conviction-loop.mp4" type="video/mp4">
  </video>
  <h2 class="white">The Closed Loop</h2>
  <!-- ... content overlaid on the ambient video ... -->
</section>
```

### Deliverable C: Full Deck Recording (5min)
Screen recording of the deck being presented with:
- Auto-advancing slides
- Manim animations playing at each concept
- Voiceover track (Kokoro TTS with af_v0nicole voice)
- Background music (low, premium)
- **Use**: Send to investors who can't attend live pitch

---

## Phase 3: AI-Generated Atmospheric Backgrounds

Once GEMINI_API_KEY is set, use Nano Banana to generate:

| Slide | Prompt | Purpose |
|-------|--------|---------|
| Title | Racing track at night, floodlights, wet turf, cinematic | Set the world |
| Problem section | Punters at bar with form guides, warm amber light, moody | Recognition |
| Corporate box | Luxury suite interior, glass walls, dark premium | The reveal |
| Mycelium (moat) | Bioluminescent underground network, gold threads | Organic defense |
| Dawn (ask) | Sunrise over racecourse, golden hour, silhouette | New beginning |

These become background images with `opacity: 0.12` overlay — atmospheric, not distracting.

---

## Implementation Sequence

| Step | Tool | Effort | Deps |
|------|------|--------|------|
| 1. Install manim | `pip install manim` | 5 min | ffmpeg, cairo |
| 2. Write quadratic_cost.py | Manim | 30 min | manim |
| 3. Write conviction_loop.py | Manim | 30 min | manim |
| 4. Write wave_collapse.py | Manim | 20 min | manim |
| 5. Render to GIF | `manim -ql --format gif` | auto | manim |
| 6. Embed GIFs in deck HTML | Edit HTML | 15 min | GIFs |
| 7. Set GEMINI_API_KEY | User action | 1 min | key |
| 8. Generate backgrounds | Nano Banana | 10 min | google-genai |
| 9. Embed backgrounds | Edit HTML | 15 min | PNGs |
| 10. Scaffold Remotion project | `npx create-video` | 10 min | node |
| 11. Assemble trailer | Remotion | 1 hr | all above |

---

## The Vision

The final deck isn't slides — it's a *cinematic experience*. Each concept has:
- **Text** (GEPA-evolved, punchy, Warwick-legible)
- **Diagram** (SVG, precise, structural)
- **Animation** (Manim, mathematical, beautiful)
- **Atmosphere** (Nano Banana, evocative, racing-night)

Warwick doesn't read the deck. He *watches* it unfold.
The medium IS the message: "These people build premium things."
