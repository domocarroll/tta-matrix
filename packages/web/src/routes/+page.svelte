<script lang="ts">
  import ImageDropzone from '$lib/components/ImageDropzone.svelte'
  import ReasoningStream from '$lib/components/ReasoningStream.svelte'
  import RaceCards from '$lib/components/RaceCards.svelte'
  import FlagPanel from '$lib/components/FlagPanel.svelte'
  import V0Comparison from '$lib/components/V0Comparison.svelte'
  import type { ExtractionResult, StreamEvent } from '$lib/types'

  type RunStatus = 'idle' | 'streaming' | 'parsed' | 'error'

  let status = $state<RunStatus>('idle')
  let imagePreview = $state<string | null>(null)
  let imageFilename = $state<string>('')
  let rawStream = $state<string>('')
  let reasoning = $state<string[]>([])
  let result = $state<ExtractionResult | null>(null)
  let errorMessage = $state<string>('')
  let stats = $state<{ ms: number; tokensIn?: number; tokensOut?: number }>({ ms: 0 })

  async function runExtraction(file: File, options: { cachedKey?: string } = {}) {
    status = 'streaming'
    rawStream = ''
    reasoning = []
    result = null
    errorMessage = ''
    stats = { ms: 0 }
    imageFilename = file.name

    const reader = new FileReader()
    reader.onload = () => {
      imagePreview = reader.result as string
    }
    reader.readAsDataURL(file)

    const t0 = performance.now()

    if (options.cachedKey) {
      try {
        await playCachedRun(options.cachedKey)
        stats.ms = Math.round(performance.now() - t0)
        return
      } catch (err) {
        status = 'error'
        errorMessage = err instanceof Error ? err.message : 'cached run failed'
        return
      }
    }

    const fd = new FormData()
    fd.append('image', file)

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }

      const decoder = new TextDecoder()
      const sseReader = res.body.getReader()
      let buffer = ''

      while (true) {
        const { value, done } = await sseReader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const raw of lines) {
          const line = raw.trim()
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const ev = JSON.parse(data) as StreamEvent
            applyStreamEvent(ev)
          } catch {
            /* skip malformed line */
          }
        }
      }

      stats.ms = Math.round(performance.now() - t0)
      if (!result) {
        // Final parse attempt from accumulated raw stream
        result = parseLooseJson(rawStream)
        if (result) {
          reasoning = [...result.reasoning]
          status = 'parsed'
        } else {
          throw new Error('Stream completed but no extraction parsed.')
        }
      }
    } catch (err) {
      status = 'error'
      errorMessage = err instanceof Error ? err.message : String(err)
    }
  }

  function applyStreamEvent(ev: StreamEvent): void {
    if (ev.type === 'text') {
      rawStream += ev.text
    } else if (ev.type === 'reasoning_step') {
      reasoning = [...reasoning, ev.text]
    } else if (ev.type === 'extraction') {
      result = ev.payload
      reasoning = [...ev.payload.reasoning]
      status = 'parsed'
    } else if (ev.type === 'tokens') {
      stats = { ...stats, tokensIn: ev.input, tokensOut: ev.output }
    } else if (ev.type === 'error') {
      status = 'error'
      errorMessage = ev.message
    }
  }

  function parseLooseJson(raw: string): ExtractionResult | null {
    let cleaned = raw.trim()
    const fenceStart = cleaned.indexOf('```')
    if (fenceStart !== -1) {
      cleaned = cleaned.slice(fenceStart + 3)
      if (cleaned.startsWith('json')) cleaned = cleaned.slice(4)
      const fenceEnd = cleaned.lastIndexOf('```')
      if (fenceEnd !== -1) cleaned = cleaned.slice(0, fenceEnd)
    }
    try {
      return JSON.parse(cleaned.trim()) as ExtractionResult
    } catch {
      return null
    }
  }

  function reset() {
    status = 'idle'
    imagePreview = null
    rawStream = ''
    reasoning = []
    result = null
    errorMessage = ''
  }

  /**
   * Cached / offline replay mode. Loads a saved ExtractionResult and
   * streams its reasoning array progressively to mimic the live UX.
   * Triggered by ?cached=pete-24apr query param. Pitch fallback when
   * live demo fails.
   */
  async function playCachedRun(key: string): Promise<void> {
    const map: Record<string, { json: string; image: string }> = {
      'pete-24apr': {
        json: '/fixtures/pete-24apr-xxprefix.extraction.json',
        image: '/fixtures/pete-24apr-xxprefix.jpg'
      }
    }
    const entry = map[key]
    if (!entry) throw new Error(`unknown cached key: ${key}`)

    const res = await fetch(entry.json)
    if (!res.ok) throw new Error('cached extraction not found')
    const cached = (await res.json()) as ExtractionResult

    // Trickle reasoning steps in to mimic live stream
    for (const step of cached.reasoning) {
      reasoning = [...reasoning, step]
      await new Promise((r) => setTimeout(r, 220))
    }

    result = cached
    status = 'parsed'
    stats = { ...stats, tokensIn: 2357, tokensOut: 7588 }
  }

  // Auto-replay if ?cached= param is present (pitch fallback path)
  $effect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const key = params.get('cached')
    if (key && status === 'idle') {
      const map: Record<string, string> = {
        'pete-24apr': '/fixtures/pete-24apr-xxprefix.jpg'
      }
      const imgPath = map[key]
      if (imgPath) {
        fetch(imgPath)
          .then((r) => r.blob())
          .then((blob) => {
            const file = new File(
              [blob],
              imgPath.split('/').pop() ?? 'cached.jpg',
              { type: blob.type }
            )
            runExtraction(file, { cachedKey: key })
          })
      }
    }
  })
</script>

<svelte:head>
  <title>The TipAnalyser · v2 demo</title>
</svelte:head>

<main class="min-h-screen px-6 py-10 md:px-12 md:py-16">
  <header class="mx-auto max-w-6xl mb-12 md:mb-20">
    <div class="flex items-baseline gap-3">
      <span
        class="mono text-[11px] uppercase tracking-[0.2em] text-text-muted"
      >v2 · agentic</span>
      <span class="h-px flex-1 bg-border"></span>
      <span class="mono text-[11px] uppercase tracking-[0.2em] text-accent"
        >Pete demo · 2026‑05‑01</span
      >
    </div>
    <h1 class="serif mt-6 text-5xl md:text-6xl text-text-primary leading-[1.05]">
      The TipAnalyser
    </h1>
    <p class="serif mt-3 text-2xl md:text-3xl italic text-text-secondary">
      built to reason, not to parse.
    </p>
    <p class="mt-6 max-w-2xl text-text-secondary leading-relaxed">
      Drop a tip sheet. Watch the agent identify the publication, the meeting,
      the tipster columns. Watch it strip publication artefacts, de-duplicate
      cleanly, and flag what it isn't sure about — instead of silently corrupting
      the data downstream.
    </p>
  </header>

  <section class="mx-auto max-w-6xl">
    {#if status === 'idle' || status === 'error'}
      <ImageDropzone onFile={runExtraction} />
      {#if status === 'error'}
        <div
          class="mt-6 rounded-md border border-error/40 bg-error/10 px-4 py-3 text-error fade-up"
        >
          <span class="mono text-xs uppercase tracking-wider">error</span>
          <p class="mt-1">{errorMessage}</p>
          <button
            class="mt-2 mono text-xs uppercase tracking-wider underline"
            onclick={reset}>reset</button
          >
        </div>
      {/if}
    {:else}
      <div class="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
        <!-- Left: image + meta (sticky on desktop) -->
        <aside class="space-y-4 md:sticky md:top-8 self-start">
          <div class="rounded-md border border-border bg-bg-surface overflow-hidden">
            {#if imagePreview}
              <img
                src={imagePreview}
                alt={imageFilename}
                class="block w-full h-auto"
              />
            {/if}
          </div>
          <div class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <div>file · {imageFilename}</div>
            {#if result}
              <div class="mt-1">
                publication · <span class="text-text-secondary normal-case"
                  >{result.publication}</span
                >
              </div>
              <div>
                meeting · <span class="text-text-secondary normal-case"
                  >{result.meeting} ({result.category})</span
                >
              </div>
              <div>tipsters · {result.tipstersDetected.length}</div>
              <div>races · {result.races.length}</div>
            {/if}
            {#if status === 'streaming'}
              <div class="mt-3 flex items-center gap-2 text-accent">
                <span
                  class="inline-block h-1.5 w-1.5 rounded-full bg-accent pulse-dot"
                ></span>
                <span class="shimmer normal-case tracking-normal"
                  >reasoning — watch it think</span
                >
              </div>
            {/if}
            {#if status === 'parsed'}
              <div class="mt-3 text-success">
                ✓ extraction complete
                {#if stats.ms > 0}<span class="text-text-muted"
                    >· {(stats.ms / 1000).toFixed(1)}s</span
                  >{/if}
                {#if stats.tokensIn}<span class="text-text-muted ml-1"
                    >· {stats.tokensIn}in/{stats.tokensOut}out</span
                  >{/if}
              </div>
              <button
                class="mt-3 mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-accent-bright underline"
                onclick={reset}>run another →</button
              >
            {/if}
          </div>
        </aside>

        <!-- Right: reasoning stream + extraction render -->
        <div class="space-y-8">
          <ReasoningStream {reasoning} streaming={status === 'streaming'} />
          {#if result}
            <FlagPanel flags={result.flags} />
            <RaceCards races={result.races} />
            <V0Comparison />
          {/if}
        </div>
      </div>
    {/if}
  </section>

  <footer class="mx-auto max-w-6xl mt-20 pt-8 border-t border-border">
    <div class="flex justify-between text-[11px] mono uppercase tracking-[0.18em] text-text-muted">
      <span>The TipAnalyser · v2 prototype</span>
      <span>Claude Sonnet 4.6 · Convex · agentic loop</span>
    </div>
  </footer>
</main>
