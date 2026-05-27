<script lang="ts">
  import type { AggregatedRace, AggregatedTip } from '@tta/shared'
  import { categoryConfig, getCategoryName } from '$lib/classic/categoryConfig'
  import { getQuaddieSelections } from '$lib/classic/quaddie'

  interface Props {
    races: ReadonlyArray<AggregatedRace>
  }
  let { races }: Props = $props()

  const quaddieSelections = $derived(getQuaddieSelections(races))

  function trifecta(race: AggregatedRace): AggregatedTip[] {
    return [...race.tips]
      .sort(
        (a, b) =>
          b.winTips + b.place2Tips + b.place3Tips - (a.winTips + a.place2Tips + a.place3Tips)
      )
      .slice(0, 3)
  }
  function firstFour(race: AggregatedRace): AggregatedTip[] {
    return race.tips.slice(0, 4)
  }
</script>

{#snippet betHorse(horse: AggregatedTip, index: number)}
  <div class="flex items-center gap-2 p-1.5 rounded bg-soft">
    <span class="font-semibold c-muted text-sm w-5 text-center">{index + 1}.</span>
    <span class="font-bold w-6 text-right c-accent">{horse.horseNumber || '-'}</span>
    <span class="c-fg truncate font-medium">{horse.horseName}</span>
  </div>
{/snippet}

{#if races.length > 0}
  <div class="card animate-fade-in">
    <div class="flex items-center gap-3 mb-6">
      <span class="text-2xl">🔖</span>
      <h2 class="text-2xl font-bold tracking-tight c-primary">Expert Picks &amp; Multi-Bets</h2>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quaddie -->
      <div class="lg:col-span-1 space-y-4">
        <h3 class="text-lg font-semibold c-primary">Quaddie Selections</h3>
        {#if quaddieSelections.length > 0}
          {#each quaddieSelections as q (q.category)}
            {@const config = categoryConfig[q.category]}
            <div class="p-3 bg-soft-50 rounded-lg space-y-3 border border-soft">
              <h4 class="font-bold text-center text-sm">
                <span
                  class="font-semibold border text-xs rounded-full px-2 py-0.5"
                  style="color:{config.color};border-color:{config.color};background:{config.bgColor};"
                >
                  {getCategoryName(q.category)} Quaddie
                </span>
              </h4>
              {#each q.races as race (race.raceNumber)}
                <div>
                  <p class="font-semibold c-muted text-xs mb-1">Race {race.raceNumber}</p>
                  <div class="space-y-1">
                    {#each race.tips as horse, i (horse.horseName)}
                      {@render betHorse(horse, i)}
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/each}
        {:else}
          <p class="text-sm c-muted">Not enough races for a Quaddie.</p>
        {/if}
      </div>

      <!-- Trifecta & First Four -->
      <div class="lg:col-span-2 max-h-[400px] overflow-y-auto space-y-4 pr-3 -mr-3">
        <h3 class="text-lg font-semibold c-primary">Trifecta &amp; First Four Picks</h3>
        {#each races as race (`${race.category}-${race.raceNumber}`)}
          <div class="p-3 bg-soft-50 rounded-lg border border-soft">
            <h4 class="font-semibold c-fg mb-2">{race.category} Race {race.raceNumber}</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p class="text-xs font-bold c-muted mb-1.5 uppercase tracking-wider">Trifecta</p>
                <div class="space-y-1">
                  {#each trifecta(race) as horse, i (horse.horseName)}
                    {@render betHorse(horse, i)}
                  {/each}
                </div>
              </div>
              <div>
                <p class="text-xs font-bold c-muted mb-1.5 uppercase tracking-wider">First Four</p>
                <div class="space-y-1">
                  {#each firstFour(race) as horse, i (horse.horseName)}
                    {@render betHorse(horse, i)}
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
