<script lang="ts">
  interface Props {
    reasoning: ReadonlyArray<string>
    streaming: boolean
  }
  let { reasoning, streaming }: Props = $props()
</script>

<section>
  <header class="flex items-baseline gap-3 mb-4">
    <span class="mono text-[11px] uppercase tracking-[0.2em] text-accent"
      >01 · reasoning</span
    >
    <span class="h-px flex-1 bg-border"></span>
    <span class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted"
      >{reasoning.length} step{reasoning.length === 1 ? '' : 's'}</span
    >
  </header>

  <ol class="space-y-2">
    {#each reasoning as step, i (i)}
      <li
        class="flex gap-3 items-start fade-up rounded-md border border-border/50 bg-bg-card px-4 py-3"
      >
        <span class="mono text-[11px] text-accent tabular-nums shrink-0 pt-0.5"
          >{String(i + 1).padStart(2, '0')}</span
        >
        <span class="text-text-primary leading-relaxed text-[15px]">{step}</span>
      </li>
    {/each}

    {#if streaming}
      <li
        class="flex gap-3 items-center text-text-muted px-4 py-3"
      >
        <span class="mono text-[11px] text-accent tabular-nums">··</span>
        <span class="shimmer text-[15px]">thinking through the image…</span>
      </li>
    {/if}

    {#if !streaming && reasoning.length === 0}
      <li class="text-text-muted px-4 py-6 text-center">
        no reasoning steps emitted
      </li>
    {/if}
  </ol>
</section>
