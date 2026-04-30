<script lang="ts">
  interface Props {
    onFile: (file: File) => void
  }
  let { onFile }: Props = $props()

  let dragOver = $state(false)
  let inputEl: HTMLInputElement | null = null

  function handleFile(file: File | null | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    onFile(file)
  }

  function onDrop(ev: DragEvent) {
    ev.preventDefault()
    dragOver = false
    handleFile(ev.dataTransfer?.files?.[0])
  }

  function onPick(ev: Event) {
    const target = ev.target as HTMLInputElement
    handleFile(target.files?.[0])
  }

  async function loadFixture(path: string) {
    try {
      const r = await fetch(path)
      const blob = await r.blob()
      const file = new File([blob], path.split('/').pop() ?? 'fixture.jpg', {
        type: blob.type
      })
      onFile(file)
    } catch (err) {
      console.error('fixture load failed', err)
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  class="relative rounded-lg border border-dashed transition-colors duration-300 px-8 py-20 text-center cursor-pointer
    {dragOver
    ? 'border-accent bg-accent/5'
    : 'border-border hover:border-border-focus bg-bg-surface'}"
  ondragover={(e) => {
    e.preventDefault()
    dragOver = true
  }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  onclick={() => inputEl?.click()}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputEl?.click()
    }
  }}
>
  <input
    bind:this={inputEl}
    type="file"
    accept="image/*"
    class="hidden"
    onchange={onPick}
  />
  <div class="serif text-2xl text-text-primary">Drop a tip sheet</div>
  <div class="mt-2 text-text-secondary">
    or click to choose an image — JPG, PNG, WebP
  </div>
  <div
    class="mt-8 mono text-[11px] uppercase tracking-[0.18em] text-text-muted"
  >
    or run a known fixture
  </div>
  <div class="mt-3 flex items-center justify-center gap-3">
    <button
      type="button"
      class="rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-4 py-2 text-sm text-text-primary transition-colors"
      onclick={(e) => {
        e.stopPropagation()
        loadFixture('/fixtures/pete-24apr-xxprefix.jpg')
      }}
    >
      Pete 24 Apr · "xx prefix"
    </button>
    <button
      type="button"
      class="rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-4 py-2 text-sm text-text-primary transition-colors"
      onclick={(e) => {
        e.stopPropagation()
        loadFixture('/fixtures/pete-14mar-duplicates.png')
      }}
    >
      Pete 14 Mar · phantom horses
    </button>
  </div>
</div>
