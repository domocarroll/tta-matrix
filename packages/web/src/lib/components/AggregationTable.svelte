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
  // Edit drafts — each may be edited independently
  let nameDraft = $state('')
  let numDraft = $state<string>('')
  let totalDraft = $state<string>('')
  let tipstersDraft = $state<string>('')
  let winDraft = $state<string>('')
  let p2Draft = $state<string>('')
  let p3Draft = $state<string>('')
  let p4Draft = $state<string>('')

  function rowKey(raceNumber: number, name: string): string {
    return `R${raceNumber}|${name}`
  }

  function startEdit(raceNumber: number, tip: AggregatedTip): void {
    editingKey = rowKey(raceNumber, tip.horseName)
    nameDraft = tip.horseName
    numDraft = tip.horseNumber !== undefined ? String(tip.horseNumber) : ''
    totalDraft = String(tip.totalTips)
    tipstersDraft = String(tip.tipsterCount)
    winDraft = String(tip.winTips)
    p2Draft = String(tip.place2Tips)
    p3Draft = String(tip.place3Tips)
    p4Draft = String(tip.place4Tips)
  }

  function parseInteger(raw: string): number | undefined {
    const t = raw.trim()
    if (t === '') return undefined
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : undefined
  }

  function commit(raceNumber: number, originalName: string, original: AggregatedTip): void {
    const trimmedName = nameDraft.trim()
    const newName = trimmedName.length > 0 ? trimmedName : originalName

    const patch: HorsePatch = {
      raceNumber,
      originalName
    }
    if (newName !== originalName) patch.newHorseName = newName

    const newNum = parseInteger(numDraft)
    if (newNum !== original.horseNumber) patch.newHorseNumber = newNum

    const newTotal = parseInteger(totalDraft)
    if (newTotal !== undefined && newTotal !== original.totalTips) patch.newTotalTips = newTotal

    const newTipsters = parseInteger(tipstersDraft)
    if (newTipsters !== undefined && newTipsters !== original.tipsterCount) patch.newTipsterCount = newTipsters

    const newWin = parseInteger(winDraft)
    if (newWin !== undefined && newWin !== original.winTips) patch.newWinTips = newWin

    const newP2 = parseInteger(p2Draft)
    if (newP2 !== undefined && newP2 !== original.place2Tips) patch.newPlace2Tips = newP2

    const newP3 = parseInteger(p3Draft)
    if (newP3 !== undefined && newP3 !== original.place3Tips) patch.newPlace3Tips = newP3

    const newP4 = parseInteger(p4Draft)
    if (newP4 !== undefined && newP4 !== original.place4Tips) patch.newPlace4Tips = newP4

    // Only emit if anything actually changed
    const fields: (keyof HorsePatch)[] = [
      'newHorseName',
      'newHorseNumber',
      'newTotalTips',
      'newTipsterCount',
      'newWinTips',
      'newPlace2Tips',
      'newPlace3Tips',
      'newPlace4Tips'
    ]
    if (fields.some((f) => patch[f] !== undefined)) {
      onPatch(patch)
    }
    editingKey = null
  }

  function cancelEdit(): void {
    editingKey = null
  }

  function removeRow(raceNumber: number, name: string): void {
    onPatch({ raceNumber, originalName: name, removed: true })
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
              <td class="py-1.5 pr-1">
                <input
                  type="number"
                  bind:value={numDraft}
                  class="w-12 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm"
                  aria-label="Horse number"
                />
              </td>
              <td class="py-1.5 pr-2">
                <input
                  type="text"
                  bind:value={nameDraft}
                  class="w-full bg-bg-surface border border-border-focus rounded px-2 py-0.5 text-sm"
                  aria-label="Horse name"
                />
              </td>
              <td class="py-1.5 text-right">
                <input
                  type="number"
                  min="0"
                  bind:value={totalDraft}
                  class="w-12 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm text-right"
                  aria-label="Total tips"
                />
              </td>
              <td class="py-1.5 text-right">
                <input
                  type="number"
                  min="0"
                  bind:value={tipstersDraft}
                  class="w-12 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm text-right"
                  aria-label="Tipster count"
                />
              </td>
              <td class="py-1.5 text-right text-text-muted">—</td>
              <td class="py-1.5 text-right">
                <input
                  type="number"
                  min="0"
                  bind:value={winDraft}
                  class="w-10 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm text-right"
                  aria-label="Win tips"
                />
              </td>
              <td class="py-1.5 text-right">
                <input
                  type="number"
                  min="0"
                  bind:value={p2Draft}
                  class="w-10 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm text-right"
                  aria-label="2nd place tips"
                />
              </td>
              <td class="py-1.5 text-right">
                <input
                  type="number"
                  min="0"
                  bind:value={p3Draft}
                  class="w-10 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm text-right"
                  aria-label="3rd place tips"
                />
              </td>
              <td class="py-1.5 text-right">
                <input
                  type="number"
                  min="0"
                  bind:value={p4Draft}
                  class="w-10 bg-bg-surface border border-border-focus rounded px-1 py-0.5 text-sm text-right"
                  aria-label="4th place tips"
                />
              </td>
              <td class="py-1.5 text-right whitespace-nowrap">
                <button
                  class="mono text-[10px] uppercase tracking-wider text-accent hover:text-accent-bright"
                  onclick={() => commit(race.raceNumber, tip.horseName, tip)}
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
