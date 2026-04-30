<script lang="ts">
  import type { ExtractionRace } from '$lib/types'

  interface Props {
    races: ReadonlyArray<ExtractionRace>
  }
  let { races }: Props = $props()
</script>

<section>
  <header class="flex items-baseline gap-3 mb-4">
    <span class="mono text-[11px] uppercase tracking-[0.2em] text-accent"
      >03 · extraction</span
    >
    <span class="h-px flex-1 bg-border"></span>
    <span class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
      {races.length} race{races.length === 1 ? '' : 's'} · {races.reduce(
        (n, r) => n + r.tips.reduce((m, t) => m + t.selections.length, 0),
        0
      )} selections
    </span>
  </header>

  <div class="space-y-4">
    {#each races as race (race.raceNumber)}
      <article
        class="fade-up rounded-md border border-border bg-bg-card overflow-hidden"
      >
        <header
          class="flex items-baseline justify-between border-b border-border/60 px-4 py-2.5 bg-bg-surface"
        >
          <div class="flex items-baseline gap-3">
            <span class="serif text-xl text-text-primary"
              >Race {race.raceNumber}</span
            >
            <span
              class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted"
            >
              {race.tips.length} tipster{race.tips.length === 1 ? '' : 's'}
            </span>
          </div>
        </header>

        <div class="divide-y divide-border/50">
          {#each race.tips as tip (tip.tipsterName)}
            <div
              class="grid grid-cols-[minmax(120px,180px)_1fr] items-baseline gap-4 px-4 py-2.5"
            >
              <span class="mono text-[12px] uppercase tracking-wider text-text-secondary truncate"
                >{tip.tipsterName}</span
              >
              <ol class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {#each tip.selections as sel (sel.position)}
                  <li class="flex items-baseline gap-1.5">
                    {#if sel.position === 1}
                      <span
                        class="mono text-[10px] uppercase tracking-wider text-accent"
                        >top</span
                      >
                    {:else}
                      <span
                        class="mono text-[10px] uppercase tracking-wider text-text-muted tabular-nums"
                        >{sel.position}</span
                      >
                    {/if}
                    {#if sel.horseNumber !== undefined}
                      <span class="mono text-[12px] text-text-muted tabular-nums"
                        >{sel.horseNumber}</span
                      >
                    {/if}
                    <span class="text-text-primary text-[14px]"
                      >{sel.horseName}</span
                    >
                  </li>
                {/each}
              </ol>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </div>
</section>
