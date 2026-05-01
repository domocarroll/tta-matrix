<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { getClientId } from '$lib/clientId'
  import ReasoningStream from '$lib/components/ReasoningStream.svelte'
  import RaceCards from '$lib/components/RaceCards.svelte'
  import FlagPanel from '$lib/components/FlagPanel.svelte'
  import V0Comparison from '$lib/components/V0Comparison.svelte'
  import type { ExtractionResult } from '$lib/types'

  interface ExtractionDoc extends ExtractionResult {
    _id: string
    _creationTime: number
    filename: string
    durationMs: number
    tokensIn: number
    tokensOut: number
    model: string
    imageUrl: string | null
  }

  let row = $state<ExtractionDoc | null>(null)
  let loading = $state(true)
  let errorMessage = $state<string | null>(null)

  const id = $derived(page.params.id ?? '')

  async function load(): Promise<void> {
    loading = true
    errorMessage = null
    const clientId = getClientId()
    if (!clientId) {
      loading = false
      errorMessage = 'No browser identity. Visit the home page first.'
      return
    }
    try {
      const res = await fetch(`/api/history/${id}?clientId=${encodeURIComponent(clientId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      row = (await res.json()) as ExtractionDoc
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'load failed'
    } finally {
      loading = false
    }
  }

  function formatDate(ms: number): string {
    return new Date(ms).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  onMount(() => {
    void load()
  })
</script>

<svelte:head>
  <title>{row ? `${row.meeting} · history` : 'History'} · The TipAnalyser</title>
</svelte:head>

<main class="min-h-screen px-6 py-10 md:px-12 md:py-16">
  <header class="mx-auto max-w-6xl mb-10">
    <div class="flex items-baseline gap-3">
      <a
        href="/history"
        class="mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-accent-bright"
      >
        ← history
      </a>
      <span class="h-px flex-1 bg-border"></span>
      <a
        href="/"
        class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted hover:text-accent"
      >
        extract another →
      </a>
    </div>

    {#if row}
      <h1 class="serif mt-6 text-4xl md:text-5xl text-text-primary leading-[1.05]">
        {row.meeting}
      </h1>
      <p class="serif mt-3 text-xl italic text-text-secondary">
        {row.publication} · {row.category}
      </p>
      <div class="mt-4 mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
        {formatDate(row._creationTime)} · {row.filename} ·
        {(row.durationMs / 1000).toFixed(1)}s · {row.tokensIn}in/{row.tokensOut}out · {row.model}
      </div>
    {/if}
  </header>

  {#if loading}
    <div class="mx-auto max-w-6xl text-text-muted">loading…</div>
  {:else if errorMessage}
    <div class="mx-auto max-w-6xl rounded-md border border-error/40 bg-error/10 px-4 py-3 text-error">
      <span class="mono text-xs uppercase tracking-wider">error</span>
      <p class="mt-1">{errorMessage}</p>
    </div>
  {:else if row}
    <div class="mx-auto max-w-6xl grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
      <aside class="space-y-4 md:sticky md:top-8 self-start">
        {#if row.imageUrl}
          <div class="rounded-md border border-border bg-bg-surface overflow-hidden">
            <img src={row.imageUrl} alt={row.filename} class="block w-full h-auto" />
          </div>
        {:else}
          <div class="rounded-md border border-dashed border-border bg-bg-surface px-5 py-8 text-center text-text-muted">
            <p class="mono text-[11px] uppercase tracking-wider">image not stored</p>
            <p class="mt-2 text-sm">
              Stage 1 records the extraction; image bytes will land here once Convex file storage is wired.
            </p>
          </div>
        {/if}
      </aside>

      <div class="space-y-8">
        <ReasoningStream reasoning={row.reasoning} streaming={false} />
        <FlagPanel flags={row.flags} />
        <RaceCards races={row.races} />
        <V0Comparison />
      </div>
    </div>
  {/if}
</main>
