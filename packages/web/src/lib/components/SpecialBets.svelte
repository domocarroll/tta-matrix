<script lang="ts">
  import {
    calculateQuaddie,
    calculateTrifecta,
    calculateFirstFour,
    type AggregatedRace
  } from '@tta/shared'

  interface Props {
    races: ReadonlyArray<AggregatedRace>
  }
  let { races }: Props = $props()

  const quaddie = $derived(calculateQuaddie(races))
  const trifectas = $derived(
    races.map((r) => calculateTrifecta(r)).filter((t) => t !== null)
  )
  const firstFours = $derived(
    races.map((r) => calculateFirstFour(r)).filter((t) => t !== null)
  )
</script>

<div class="grid gap-6 md:grid-cols-3">
  <!-- Quaddie -->
  <div class="rounded-md border border-border bg-bg-card px-4 py-3">
    <div class="mono text-[11px] uppercase tracking-wider text-accent mb-2">
      Quaddie · last 4 races
    </div>
    {#if quaddie}
      {#each quaddie as leg, i}
        <div class="mb-2">
          <div class="mono text-[10px] uppercase tracking-wider text-text-muted">
            Leg {i + 1} · R{leg.raceNumber}
          </div>
          <div class="text-sm text-text-primary">
            {leg.horses
              .map((h) => `${h.horseNumber ?? '·'} ${h.horseName}`)
              .join(' · ')}
          </div>
        </div>
      {/each}
    {:else}
      <div class="text-text-muted text-sm">need 4+ races to compute</div>
    {/if}
  </div>

  <!-- Trifectas -->
  <div class="rounded-md border border-border bg-bg-card px-4 py-3">
    <div class="mono text-[11px] uppercase tracking-wider text-accent mb-2">
      Trifecta · per race
    </div>
    {#if trifectas.length > 0}
      {#each trifectas as t}
        <div class="mb-1.5">
          <span class="mono text-[10px] uppercase tracking-wider text-text-muted mr-2">R{t.raceNumber}</span>
          <span class="text-sm text-text-primary">
            {t.first.horseName} · {t.second.horseName} · {t.third.horseName}
          </span>
        </div>
      {/each}
    {:else}
      <div class="text-text-muted text-sm">need 3+ horses per race</div>
    {/if}
  </div>

  <!-- First Four -->
  <div class="rounded-md border border-border bg-bg-card px-4 py-3">
    <div class="mono text-[11px] uppercase tracking-wider text-accent mb-2">
      First Four · per race
    </div>
    {#if firstFours.length > 0}
      {#each firstFours as f}
        <div class="mb-1.5">
          <span class="mono text-[10px] uppercase tracking-wider text-text-muted mr-2">R{f.raceNumber}</span>
          <span class="text-sm text-text-primary">
            {f.selections.map((s) => s.horseName).join(' · ')}
          </span>
        </div>
      {/each}
    {:else}
      <div class="text-text-muted text-sm">need 4+ horses per race</div>
    {/if}
  </div>
</div>
