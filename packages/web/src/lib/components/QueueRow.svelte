<script lang="ts">
  type Status = 'pending' | 'streaming' | 'done' | 'error' | 'cancelled'

  interface Props {
    filename: string
    status: Status
    durationMs?: number
    error?: string | null
    reasoningCount?: number
    onCancel?: () => void
    onRetry?: () => void
  }

  let {
    filename,
    status,
    durationMs = 0,
    error = null,
    reasoningCount = 0,
    onCancel,
    onRetry
  }: Props = $props()
</script>

<div class="flex items-center gap-4 px-4 py-3 rounded-md border border-border bg-bg-card">
  <div class="flex-1 min-w-0">
    <div class="text-text-primary truncate">{filename}</div>
    <div class="mono text-[10px] uppercase tracking-wider text-text-muted mt-0.5">
      {#if status === 'pending'}
        queued
      {:else if status === 'streaming'}
        reasoning · {reasoningCount} steps
      {:else if status === 'done'}
        done · {(durationMs / 1000).toFixed(1)}s
      {:else if status === 'error'}
        <span class="text-error">error · {error ?? 'unknown'}</span>
      {:else if status === 'cancelled'}
        cancelled
      {/if}
    </div>
  </div>

  <div class="flex items-center gap-3">
    {#if status === 'streaming'}
      <span class="inline-block h-1.5 w-1.5 rounded-full bg-accent pulse-dot"></span>
      {#if onCancel}
        <button
          type="button"
          class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-error"
          onclick={onCancel}
        >
          cancel
        </button>
      {/if}
    {:else if status === 'done'}
      <span class="text-success text-sm">✓</span>
    {:else if status === 'error' && onRetry}
      <button
        type="button"
        class="mono text-[10px] uppercase tracking-wider text-accent hover:text-accent-bright"
        onclick={onRetry}
      >
        retry
      </button>
    {/if}
  </div>
</div>
