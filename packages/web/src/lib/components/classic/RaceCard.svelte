<script lang="ts">
  // v0 RaceCard skin over the field-anchored shared AggregatedRace.
  import type { AggregatedRace } from '@tta/shared'

  interface Props {
    race: AggregatedRace
  }
  let { race }: Props = $props()

  const topHorse = $derived(race.tips[0])
  const hasDetails = $derived(race.tips.some((t) => t.jockey || t.trainer || t.barrier))

  // Pete's formula: tips on this horse ÷ total tips in the race × 100
  function pct(count: number, total: number): string {
    return total > 0 ? ((count / total) * 100).toFixed(2) : '0.00'
  }
</script>

{#if race && race.tips.length > 0}
  <div
    class="card card-hover animate-slide-up border-soft overflow-hidden"
    style="padding:0; border-width:2px;"
  >
    <div
      class="px-6 md:px-8 py-5 border-b border-soft"
      style="background:linear-gradient(to right, rgba(30,58,95,0.05), rgba(66,133,244,0.05));"
    >
      <div class="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <h2 class="text-2xl md:text-3xl font-bold c-primary">
            {race.category} Race {race.raceNumber}
          </h2>
          {#if topHorse}
            <p class="text-sm c-muted mt-1 font-medium">
              Leading:
              <span class="c-accent font-bold">{topHorse.horseName} #{topHorse.horseNumber}</span>
            </p>
          {/if}
        </div>
        <div class="text-right space-y-2">
          <div class="badge badge-accent">
            <span class="font-bold">{race.totalTipstersInRace}</span>
            <span class="ml-1">Expert Tipsters</span>
          </div>
          <div class="text-sm c-fg font-semibold">
            <span class="c-accent">{race.totalSelectionsInRace}</span> Total Selections
          </div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-soft border-b border-soft">
          <tr class="text-left c-muted font-bold uppercase tracking-wider text-xs">
            <th class="px-6 py-4 w-1/3 md:w-auto">Horse</th>
            {#if hasDetails}
              <th class="px-3 py-4 hidden lg:table-cell">Jockey</th>
              <th class="px-3 py-4 hidden xl:table-cell">Trainer</th>
              <th class="px-2 py-4 text-center hidden lg:table-cell">Bar</th>
            {/if}
            <th class="px-4 py-4 text-center">Total</th>
            <th class="px-4 py-4 text-center">Tip %</th>
            <th class="px-4 py-4 text-center">Win</th>
            <th class="px-4 py-4 text-center">2nd</th>
            <th class="px-4 py-4 text-center hidden sm:table-cell">3rd</th>
            <th class="px-4 py-4 text-center hidden md:table-cell">4th</th>
          </tr>
        </thead>
        <tbody>
          {#each race.tips as tip, index (tip.horseName)}
            <tr
              class="border-t border-soft transition-colors"
              style={index === 0 ? 'background:rgba(66,133,244,0.05);' : ''}
            >
              <td class="px-6 py-4 font-semibold">
                <span class="font-bold mr-3 c-accent text-lg">{tip.horseNumber || '-'}</span>
                <span class="truncate text-base c-fg font-bold">{tip.horseName}</span>
                {#if tip.fieldMatched}
                  <span class="c-success ml-2 text-xs" title="Anchored to official field">✓</span>
                {/if}
              </td>
              {#if hasDetails}
                <td class="px-3 py-4 text-sm c-muted hidden lg:table-cell">{tip.jockey || '-'}</td>
                <td class="px-3 py-4 text-sm c-muted hidden xl:table-cell">{tip.trainer || '-'}</td>
                <td class="px-2 py-4 text-center text-sm hidden lg:table-cell">{tip.barrier || '-'}</td>
              {/if}

              <!-- Total (highlighted) -->
              <td class="px-4 py-4 text-center">
                {#if tip.totalTips === 0}
                  <span class="c-muted">-</span>
                {:else}
                  <span class="text-base font-bold c-accent">{tip.totalTips}</span>
                {/if}
              </td>

              <!-- Tip % — tips on horse ÷ total tips in race -->
              <td class="px-4 py-4 text-center">
                {#if race.totalSelectionsInRace > 0 && tip.totalTips > 0}
                  <div class="flex flex-col items-center justify-center">
                    <span class="font-bold c-fg">{pct(tip.totalTips, race.totalSelectionsInRace)}%</span>
                    <span class="text-xs c-muted">({tip.totalTips}/{race.totalSelectionsInRace})</span>
                  </div>
                {:else}
                  <span class="c-muted">-</span>
                {/if}
              </td>

              {#each [tip.winTips, tip.place2Tips, tip.place3Tips, tip.place4Tips] as count, ci (ci)}
                <td
                  class="px-4 py-4 text-center {ci === 2 ? 'hidden sm:table-cell' : ''} {ci === 3 ? 'hidden md:table-cell' : ''}"
                >
                  {#if count === 0}
                    <span class="c-muted">-</span>
                  {:else}
                    <div class="flex flex-col items-center justify-center">
                      <span class="text-base font-bold c-fg">{count}</span>
                      <span class="text-xs c-muted">({pct(count, race.totalSelectionsInRace)}%)</span>
                    </div>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
