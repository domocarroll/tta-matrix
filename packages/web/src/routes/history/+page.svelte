<script lang="ts">
  import { onMount } from 'svelte'
  import { getClientId, resetClientId } from '$lib/clientId'

  interface HistoryRow {
    _id: string
    _creationTime: number
    filename: string
    publication: string
    meeting: string
    category: string
    tipsterCount: number
    raceCount: number
    flagCount: number
    durationMs: number
    model: string
    hasImage: boolean
  }

  interface HistoryStats {
    extractionCount: number
    totalSelections: number
    totalFlags: number
    artefactsStripped: number
    firstExtractionAt: number | null
    latestExtractionAt: number | null
  }

  let rows = $state<HistoryRow[]>([])
  let stats = $state<HistoryStats | null>(null)
  let loading = $state(true)
  let errorMessage = $state<string | null>(null)
  let clientId = $state<string | null>(null)

  async function loadHistory(): Promise<void> {
    loading = true
    errorMessage = null
    const id = getClientId()
    clientId = id
    if (!id) {
      loading = false
      return
    }
    try {
      const res = await fetch(`/api/history?clientId=${encodeURIComponent(id)}&limit=100`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { rows: HistoryRow[]; stats: HistoryStats }
      rows = j.rows
      stats = j.stats
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'load failed'
    } finally {
      loading = false
    }
  }

  async function deleteRow(id: string): Promise<void> {
    if (!clientId) return
    if (!confirm('Delete this extraction?')) return
    try {
      const res = await fetch(`/api/history/${id}?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      rows = rows.filter((r) => r._id !== id)
      if (stats) stats = { ...stats, extractionCount: Math.max(0, stats.extractionCount - 1) }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'delete failed'
    }
  }

  function newClient(): void {
    if (!confirm('Reset client identity? This wipes your local link to past extractions (the records remain on the server).')) return
    resetClientId()
    rows = []
    stats = null
    void loadHistory()
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

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  onMount(() => {
    void loadHistory()
  })
</script>

<svelte:head>
  <title>History · The TipAnalyser</title>
</svelte:head>

<main class="min-h-screen px-6 py-10 md:px-12 md:py-16">
  <header class="mx-auto max-w-6xl mb-12">
    <div class="flex items-baseline gap-3">
      <span class="mono text-[11px] uppercase tracking-[0.2em] text-text-muted">history</span>
      <span class="h-px flex-1 bg-border"></span>
      <a
        href="/"
        class="mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-accent-bright"
      >
        ← extract another
      </a>
    </div>
    <h1 class="serif mt-6 text-5xl md:text-6xl text-text-primary leading-[1.05]">
      Your extractions
    </h1>
    <p class="serif mt-3 text-2xl md:text-3xl italic text-text-secondary">
      every tip sheet you've fed to the agent.
    </p>
  </header>

  {#if errorMessage}
    <div class="mx-auto max-w-6xl mb-6 rounded-md border border-error/40 bg-error/10 px-4 py-3 text-error">
      <span class="mono text-xs uppercase tracking-wider">error</span>
      <p class="mt-1">{errorMessage}</p>
    </div>
  {/if}

  {#if loading}
    <div class="mx-auto max-w-6xl text-text-muted">loading…</div>
  {:else if !clientId}
    <div class="mx-auto max-w-6xl text-text-secondary">
      Browser identity unavailable. Re-open this page to generate one.
    </div>
  {:else if rows.length === 0}
    <section class="mx-auto max-w-6xl rounded-md border border-dashed border-border bg-bg-surface px-8 py-16 text-center">
      <p class="serif text-2xl text-text-primary">No extractions yet.</p>
      <p class="mt-2 text-text-secondary">
        Drop a tip sheet on the home page — every extraction lands here automatically.
      </p>
      <a
        href="/"
        class="mt-6 inline-block rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-5 py-2.5 text-text-primary transition-colors"
      >
        Extract a tip sheet →
      </a>
    </section>
  {:else}
    <!-- Stats strip -->
    {#if stats}
      <section class="mx-auto max-w-6xl mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="rounded-md border border-border bg-bg-card px-5 py-4">
          <div class="mono text-[10px] uppercase tracking-wider text-text-muted">extractions</div>
          <div class="serif text-3xl text-accent mt-1">{stats.extractionCount}</div>
        </div>
        <div class="rounded-md border border-border bg-bg-card px-5 py-4">
          <div class="mono text-[10px] uppercase tracking-wider text-text-muted">selections</div>
          <div class="serif text-3xl text-accent mt-1">{stats.totalSelections}</div>
        </div>
        <div class="rounded-md border border-border bg-bg-card px-5 py-4">
          <div class="mono text-[10px] uppercase tracking-wider text-text-muted">artefacts stripped</div>
          <div class="serif text-3xl text-accent mt-1">{stats.artefactsStripped}</div>
        </div>
        <div class="rounded-md border border-border bg-bg-card px-5 py-4">
          <div class="mono text-[10px] uppercase tracking-wider text-text-muted">flags raised</div>
          <div class="serif text-3xl text-accent mt-1">{stats.totalFlags}</div>
        </div>
      </section>
    {/if}

    <!-- Rows -->
    <section class="mx-auto max-w-6xl space-y-2">
      {#each rows as row (row._id)}
        <article
          class="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-5 gap-y-1 rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-5 py-4 transition-colors"
        >
          <div class="row-meta">
            <div class="mono text-[11px] tracking-wider text-text-muted">
              {formatDate(row._creationTime)}
            </div>
            <div class="mono text-[10px] uppercase tracking-wider text-accent mt-1">
              {row.category}
            </div>
          </div>
          <div>
            <a
              href="/history/{row._id}"
              class="serif text-xl text-text-primary hover:text-accent-bright"
            >
              {row.meeting}
            </a>
            <div class="text-text-secondary text-sm mt-0.5">
              {row.publication} · {row.tipsterCount} tipster{row.tipsterCount === 1 ? '' : 's'} ·
              {row.raceCount} race{row.raceCount === 1 ? '' : 's'}
              {#if row.flagCount > 0}
                · <span class="text-accent">{row.flagCount} flag{row.flagCount === 1 ? '' : 's'}</span>
              {/if}
            </div>
            <div class="mono text-[10px] uppercase tracking-wider text-text-muted mt-0.5">
              {row.filename} · {formatDuration(row.durationMs)} · {row.model}
            </div>
          </div>
          <div class="flex items-baseline gap-3">
            <a
              href="/history/{row._id}"
              class="mono text-[11px] uppercase tracking-wider text-accent hover:text-accent-bright"
            >
              open →
            </a>
            <button
              type="button"
              class="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-error"
              onclick={() => deleteRow(row._id)}
              aria-label="Delete extraction"
            >
              delete
            </button>
          </div>
        </article>
      {/each}
    </section>

    <footer class="mx-auto max-w-6xl mt-16 pt-8 border-t border-border flex justify-between items-baseline">
      <div class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
        client · {clientId?.slice(0, 8)}…{clientId?.slice(-4)}
      </div>
      <button
        type="button"
        class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted hover:text-error underline"
        onclick={newClient}
      >
        reset client identity
      </button>
    </footer>
  {/if}
</main>
