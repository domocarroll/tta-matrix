# TTA v0 — Short-Term Fixes

**Context**: Client discussion 2026-03-20. Persistent issues with Vercel capture tool.
Root cause hypothesis: Gemini 2.5 Flash performance degradation after model downgrade.

---

## Fix 1: Model Upgrade

**File**: `v0-thetipanalyser/app/actions.ts:12`

```diff
- const MODEL = google("gemini-2.5-flash")
+ const MODEL = google("gemini-2.5-pro")
```

**Why**: gemini-2.5-flash was a cost optimisation that degraded extraction quality.
gemini-2.5-pro has significantly better vision/OCR capabilities for structured extraction.

**Alternative**: If Pro still underperforms, consider switching to Claude via `@ai-sdk/anthropic`:
```ts
import { anthropic } from "@ai-sdk/anthropic"
const MODEL = anthropic("claude-sonnet-4-5-20250514")
```
Claude's structured output from images is best-in-class for this use case.

**Effort**: 1 line change + env var update on Vercel (if switching provider).

---

## Fix 2: Skip Intermediary Review Step

**Problem**: The 3-step flow (Upload → Review → Results) has an intermediary "Review & Refine"
step that the client finds useless. He wants to go straight to results.

**Current flow** (`app/page.tsx`):
```
Upload → handleViewResults() → step="review" → ReviewStep
         → handleAcceptAndAggregate() → step="results" → ResultsDisplay
```

**New flow**:
```
Upload → handleViewResults() → aggregate immediately → step="results" → ResultsDisplay
```

**Implementation** (`app/page.tsx:handleViewResults`):
After collecting all photo results at line ~183, instead of `setStep("review")`:

```ts
// Skip review — go straight to aggregation + results
const combinedJson = incomingPhotos.flatMap(p => p.result || [])
setExtractedJson(combinedJson)

const combinedHorseDetails = incomingHorseDetailsPhotos.flatMap(p => p.result || [])
setHorseDetails(combinedHorseDetails)

// Aggregate immediately
const finalAggregatedData = aggregateRaces(combinedJson, combinedHorseDetails)
setAggregatedRaces(finalAggregatedData as AggregatedRace[])
setStep("results")
```

**Effort**: ~15 lines changed in `page.tsx`.

---

## Fix 3: Add Back Button to Results

**Problem**: ResultsDisplay only has "Start Over" (full reset). Client needs a Back button
that preserves photo state so they can re-upload or add more photos.

**Implementation** (`components/ResultsDisplay.tsx`):

1. Add `onBack` prop to `ResultsDisplayProps`:
```ts
interface ResultsDisplayProps {
  // ... existing
  onBack?: () => void  // back to upload, preserving state
}
```

2. Add Back button next to Start Over:
```tsx
{onBack && !isReadOnly && (
  <button onClick={onBack} className="btn btn-outline">
    ← Back to Upload
  </button>
)}
```

3. Wire up in `page.tsx`:
```tsx
<ResultsDisplay
  // ... existing props
  onBack={handleBackToUpload}  // already exists, reuse
/>
```

**Effort**: ~10 lines across 2 files.

---

## Deployment Checklist

- [ ] Update model in `actions.ts`
- [ ] Update Vercel env var if switching provider
- [ ] Modify `page.tsx` to skip review step
- [ ] Add back button to `ResultsDisplay.tsx`
- [ ] Test with client's actual tip sheet images
- [ ] Deploy to Vercel
