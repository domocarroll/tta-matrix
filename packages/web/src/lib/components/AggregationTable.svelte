<script lang="ts">
  import type { AggregatedRace, AggregatedTip } from '@tta/shared'
  import type { HorsePatch } from '$lib/workspace'

  interface Props {
    races: ReadonlyArray<AggregatedRace>
    patches: ReadonlyArray<HorsePatch>
    onPatch: (patch: HorsePatch) => void
    onClearRow: (raceNumber: number, originalName: string) => void
  }

  let { races, patches, onPatch, onClearRow }: Props = $props()

  let editingKey = $state<string | null>(null)
  let nameDraft = $state('')
  let numDraft = $state<string>('')

  function rowKey(raceNumber: number, name: string): string {
    return `R${raceNumber}|${name}`
  }

  function startEdit(raceNumber: number, tip: AggregatedTip): void {
    editingKey = rowKey(raceNumber, tip.horseName)
    nameDraft = tip.horseName
    numDraft = tip.horseNumber !== undefined ? String(tip.horseNumber) : ''
  }

  function commit(raceNumber: number, originalName: string): void {
    const newNum = numDraft.trim() === '' ? undefined : parseInt(numDraft.trim(), 10)
    const trimmedName = nameDraft.trim()
    if (trimmedName !== originalName && trimmedName.length > 0) {
      onPatch({
        raceNumber,
        originalName,
        action: 'rename',
        newHorseName: trimmedName
      })
    }
    if (!Number.isNaN(newNum as number)) {
      onPatch({
        raceNumber,
        originalName: trimmedName !== '' ? trimmedName : originalName,
        action: 'renumber',
        newHorseNumber: newNum
      })
    }
    editingKey = null
  }

  function cancelEdit(): void {
    editingKey = null
  }

  function removeRow(raceNumber: number, name: string): void {
    onPatch({ raceNumber, originalName: name, action: 'remove' })
  }

  function tipsterPct(tip: AggregatedTip, totalTipsters: number): number {
    if (totalTipsters <= 0) return 0
    return Math.round((tip.tipsterCount / totalTipsters) * 100)
  }

  function isPatched(raceNumber: number, name: string): boolean {
    return patches.some(
      (p) => p.raceNumber === raceNumber && p.originalName === name
    )
  }
</script>

{#each races as race (race.raceNumber)}
  <div class="mb-6">
    <div class="flex items-baseline gap-3 mb-2">
      <span class="mono text-[11px] uppercase tracking-[0.18em] text-accent">
        Race {race.raceNumber}
      </span>
      <span class="text-text-muted text-sm">
        {race.totalTipstersInRace} tipster{race.totalTipstersInRace === 1 ? '' : 's'} ·
        {race.totalSelectionsInRace} selection{race.totalSelectionsInRace === 1 ? '' : 's'}
      </span>
    </div>

    <table class="w-full text-sm">
      <thead>
        <tr class="text-left mono text-[10px] uppercase tracking-wider text-text-muted">
          <th class="py-2 w-12">#</th>
          <th class="py-2">Horse</th>
          <th class="py-2 text-right w-16">Tips</th>
          <th class="py-2 text-right w-16">Tipsters</th>
          <th class="py-2 text-right w-14">%</th>
          <th class="py-2 text-right w-12">1st</th>
          <th class="py-2 text-right w-12">2nd</th>
          <th class="py-2 text-right w-12">3rd</th>
          <th class="py-2 text-right w-12">4th</th>
          <th class="py-2 w-24"></th>
        </tr>
      </thead>
      <tbody>
        {#each race.tips as tip}
          {@const isEditing = editingKey === rowKey(race.raceNumber, tip.horseName)}
          {@const patched = isPatched(race.raceNumber, tip.horseName)}
          <tr
            class="border-t border-border {patched ? 'bg-accent/5' : ''}"
          >
            {#if isEditing}
              <td class="py-1.5">
                <input
                  type="number"
                  bind:value={numDraft}
                  class="w-12 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm"
                />
              </td>
              <td class="py-1.5">
                <input
                  type="text"
                  bind:value={nameDraft}
                  class="w-full bg-bg-surface border border-border-focus rounded px-2 py-0.5 text-sm"
                />
              </td>
              <td colspan="7" class="py-1.5"></td>
              <td class="py-1.5 text-right whitespace-nowrap">
                <button
                  class="mono text-[10px] uppercase tracking-wider text-accent hover:text-accent-bright"
                  onclick={() => commit(race.raceNumber, tip.horseName)}
                >
                  save
                </button>
                <button
                  class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary ml-2"
                  onclick={cancelEdit}
                >
                  cancel
                </button>
              </td>
            {:else}
              <td class="py-1.5 text-text-secondary">{tip.horseNumber ?? '—'}</td>
              <td class="py-1.5 text-text-primary">
                {tip.horseName}
                {#if patched}
                  <span class="ml-2 mono text-[9px] uppercase tracking-wider text-accent">edited</span>
                {/if}
              </td>
              <td class="py-1.5 text-right text-text-primary font-medium">{tip.totalTips}</td>
              <td class="py-1.5 text-right text-text-secondary">{tip.tipsterCount}</td>
              <td class="py-1.5 text-right text-text-secondary">{tipsterPct(tip, race.totalTipstersInRace)}%</td>
              <td class="py-1.5 text-right text-text-secondary">{tip.winTips}</td>
              <td class="py-1.5 text-right text-text-secondary">{tip.place2Tips}</td>
              <td class="py-1.5 text-right text-text-secondary">{tip.place3Tips}</td>
              <td class="py-1.5 text-right text-text-secondary">{tip.place4Tips}</td>
              <td class="py-1.5 text-right whitespace-nowrap">
                <button
                  class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-accent"
                  onclick={() => startEdit(race.raceNumber, tip)}
                  aria-label="Edit row"
                >
                  edit
                </button>
                {#if patched}
                  <button
                    class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary ml-2"
                    onclick={() => onClearRow(race.raceNumber, tip.horseName)}
                  >
                    revert
                  </button>
                {:else}
                  <button
                    class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-error ml-2"
                    onclick={() => removeRow(race.raceNumber, tip.horseName)}
                  >
                    remove
                  </button>
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/each}
