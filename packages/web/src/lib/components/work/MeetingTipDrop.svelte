<script lang="ts">
  // Per-meeting tip dropzone (hard-wall model). Every sheet dropped here is
  // bound to THIS locked meeting by key — no venue inference, no routing, no
  // pending state. Pete locks the field once, then drops all of that
  // meeting's tip sheets in here.
  import { runExtractionWithRetry, persistExtraction } from '$lib/extractionRunner'
  import type { UserField } from '$lib/userFields'

  interface Props {
    clientId: string
    meetingKey: string
    meetingName: string
    /** Locked field for this meeting — anchors extraction (V2 grounding). */
    field: UserField | null
    onChange: () => void | Promise<void>
  }
  let { clientId, meetingKey, meetingName, field, onChange }: Props = $props()

  // Serialise the locked field once for the extract call. Null until Gate 1
  // is approved — extraction degrades gracefully to ungrounded if absent.
  const fieldJson = $derived(
    field && field.races?.length ? JSON.stringify({ races: field.races }) : undefined
  )

  type ItemStatus = 'queued' | 'extracting' | 'done' | 'error'
  interface Item {
    id: string
    filename: string
    status: ItemStatus
    races?: number
    errorMessage?: string
  }

  let items = $state<Item[]>([])
  let processing = $state(false)
  let dragging = $state(false)
  const pendingQueue: Array<{ id: string; file: File }> = []

  function update(id: string, patch: Partial<Item>): void {
    items = items.map((it) => (it.id === id ? { ...it, ...patch } : it))
  }

  async function handleFiles(list: FileList | null): Promise<void> {
    if (!list || list.length === 0) return
    const queued: Item[] = Array.from(list).map((f) => ({
      id: crypto.randomUUID(),
      filename: f.name,
      status: 'queued'
    }))
    items = [...items, ...queued]
    const pairs = queued.map((it, i) => ({ id: it.id, file: list[i] as File }))
    if (!processing) void drainQueue(pairs)
    else for (const p of pairs) pendingQueue.push(p)
  }

  async function drainQueue(initial: Array<{ id: string; file: File }>): Promise<void> {
    processing = true
    const queue = [...initial]
    try {
      while (queue.length > 0 || pendingQueue.length > 0) {
        const next = queue.shift() ?? pendingQueue.shift()
        if (!next) break
        await processOne(next.id, next.file)
      }
    } finally {
      processing = false
    }
  }

  async function processOne(id: string, file: File): Promise<void> {
    update(id, { status: 'extracting' })
    const outcome = await runExtractionWithRetry(file, {}, undefined, fieldJson)
    if (!outcome.result) {
      update(id, { status: 'error', errorMessage: outcome.errorMessage ?? 'extraction failed' })
      return
    }
    const persisted = await persistExtraction({
      clientId,
      filename: file.name,
      durationMs: outcome.durationMs,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      model: 'tip-sheet',
      payload: outcome.result,
      // Bind directly to this meeting — the whole point of the hard wall.
      meetingKey
    })
    if (!persisted) {
      update(id, { status: 'error', errorMessage: 'extracted but failed to save' })
      return
    }
    update(id, { status: 'done', races: outcome.result.races?.length ?? 0 })
    await onChange()
  }

  function dismiss(id: string): void {
    items = items.filter((it) => it.id !== id)
  }
  function clearFinished(): void {
    items = items.filter((it) => it.status === 'queued' || it.status === 'extracting')
  }
</script>

<div
  role="region"
  aria-label="Tip sheet dropzone for {meetingName}"
  class="rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors {dragging
    ? 'border-blue-500 bg-blue-50'
    : 'border-soft bg-white hover:bg-soft-50/40'}"
  ondragover={(e) => {
    e.preventDefault()
    dragging = true
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => {
    e.preventDefault()
    dragging = false
    void handleFiles(e.dataTransfer?.files ?? null)
  }}
>
  <div class="mb-1 text-3xl">📰</div>
  <p class="c-fg text-base font-bold">Drop all tip sheets for {meetingName}</p>
  <p class="c-muted mt-1 text-sm">
    Every sheet is read and anchored to this meeting's locked field. Add as many as you like.
  </p>
  <label class="mt-4 inline-block cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-blue-700">
    <input
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      onchange={(e) => {
        const t = e.currentTarget as HTMLInputElement
        void handleFiles(t.files)
        t.value = ''
      }}
    />
    choose tip sheets
  </label>
</div>

{#if items.length > 0}
  <ul class="mt-3 space-y-2">
    {#each items as it (it.id)}
      <li class="flex items-baseline gap-3 rounded-lg border border-soft bg-white px-4 py-2.5">
        <span class="flex-1 truncate text-sm font-bold c-fg">{it.filename}</span>
        {#if it.status === 'queued'}
          <span class="text-[10px] font-bold uppercase tracking-wider c-muted">queued</span>
        {:else if it.status === 'extracting'}
          <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700">extracting…</span>
        {:else if it.status === 'done'}
          <span class="text-[10px] font-bold uppercase tracking-wider text-green-700">
            ✓ added{it.races ? ` · ${it.races} races` : ''}
          </span>
        {:else if it.status === 'error'}
          <span class="text-[10px] font-bold uppercase tracking-wider text-red-600">{it.errorMessage}</span>
        {/if}
        <button
          type="button"
          class="ml-2 text-[10px] font-bold uppercase tracking-wider c-muted hover:c-fg"
          onclick={() => dismiss(it.id)}
        >
          ✕
        </button>
      </li>
    {/each}
  </ul>
  {#if items.some((i) => i.status === 'done' || i.status === 'error')}
    <div class="mt-2 text-right">
      <button
        type="button"
        class="text-[10px] font-bold uppercase tracking-wider c-muted hover:c-fg"
        onclick={clearFinished}
      >
        clear finished
      </button>
    </div>
  {/if}
{/if}
