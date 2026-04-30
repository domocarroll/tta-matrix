<script lang="ts">
  import type { ExtractionFlag } from '$lib/types'

  interface Props {
    flags: ReadonlyArray<ExtractionFlag>
  }
  let { flags }: Props = $props()

  const stats = $derived.by(() => {
    const byType: Record<string, number> = {}
    for (const f of flags) {
      byType[f.type] = (byType[f.type] ?? 0) + 1
    }
    return byType
  })

  const tone = (t: ExtractionFlag['type']): string => {
    switch (t) {
      case 'publication_artefact_stripped':
        return 'border-accent/40 text-accent'
      case 'duplicate_resolved':
        return 'border-accent/40 text-accent'
      case 'uncertain':
        return 'border-warning/40 text-warning'
      case 'ambiguity':
        return 'border-warning/40 text-warning'
      case 'anomaly':
        return 'border-error/40 text-error'
      default:
        return 'border-border text-text-secondary'
    }
  }
</script>

<section>
  <header class="flex items-baseline gap-3 mb-4">
    <span class="mono text-[11px] uppercase tracking-[0.2em] text-accent"
      >02 · flags</span
    >
    <span class="h-px flex-1 bg-border"></span>
    <span class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
      {flags.length} · honest failure mode
    </span>
  </header>

  {#if flags.length === 0}
    <div
      class="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-success"
    >
      <span class="mono text-[11px] uppercase tracking-wider">clean</span>
      <span class="ml-2">no artefacts detected, no ambiguity</span>
    </div>
  {:else}
    <div class="mb-3 flex flex-wrap gap-2 text-[12px]">
      {#each Object.entries(stats) as [type, count] (type)}
        <span
          class="mono uppercase tracking-wider rounded border px-2 py-0.5 {tone(
            type as ExtractionFlag['type']
          )}"
        >
          {type.replace(/_/g, ' ')} · {count}
        </span>
      {/each}
    </div>

    <ul class="space-y-1.5">
      {#each flags as f, i (i)}
        <li class="fade-up grid grid-cols-[auto_auto_1fr] items-baseline gap-3
          rounded-md border-l-2 bg-bg-card px-3 py-2 text-[14px] {tone(f.type)}">
          <span class="mono text-[10px] uppercase tracking-[0.18em]"
            >{f.type.replace(/_/g, ' ')}</span
          >
          {#if f.race !== undefined}
            <span class="mono text-[11px] text-text-muted tabular-nums"
              >r{f.race}</span
            >
          {:else}
            <span></span>
          {/if}
          <span class="text-text-primary leading-snug">{f.description}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
