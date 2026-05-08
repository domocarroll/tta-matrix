<script lang="ts">
  interface Props {
    onFiles: (files: File[]) => void
    disabled?: boolean
  }
  let { onFiles, disabled = false }: Props = $props()

  let dragOver = $state(false)
  let inputEl: HTMLInputElement | null = null

  function accept(list: FileList | null | undefined): File[] {
    if (!list) return []
    const out: File[] = []
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) continue
      out.push(f)
    }
    return out
  }

  function handleFiles(list: FileList | null | undefined): void {
    const files = accept(list)
    if (files.length > 0) onFiles(files)
  }

  async function loadFixture(path: string): Promise<void> {
    try {
      const r = await fetch(path)
      const blob = await r.blob()
      const file = new File([blob], path.split('/').pop() ?? 'fixture.jpg', {
        type: blob.type
      })
      onFiles([file])
    } catch (err) {
      console.error('fixture load failed', err)
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  aria-disabled={disabled}
  class="relative rounded-lg border border-dashed transition-colors duration-300 px-8 py-14 text-center {disabled
    ? 'border-border bg-bg-surface/50 opacity-50'
    : 'cursor-pointer ' +
      (dragOver
        ? 'border-accent bg-accent/5'
        : 'border-border hover:border-border-focus bg-bg-surface')}"
  ondragover={(e) => {
    if (disabled) return
    e.preventDefault()
    dragOver = true
  }}
  ondragleave={() => (dragOver = false)}
  ondrop={(e) => {
    if (disabled) return
    e.preventDefault()
    dragOver = false
    handleFiles(e.dataTransfer?.files)
  }}
  onclick={() => {
    if (!disabled) inputEl?.click()
  }}
  onkeydown={(e) => {
    if (disabled) return
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
    multiple
    class="hidden"
    onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
  />
  <div class="serif text-2xl text-text-primary">Drop tip sheets</div>
  <div class="mt-2 text-text-secondary">
    one image or many — JPG, PNG, WebP. Each gets queued and extracted.
  </div>
  <div class="mt-6 mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
    or test with a known fixture
  </div>
  <div class="mt-3 flex items-center justify-center gap-3 flex-wrap">
    <button
      type="button"
      class="rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-4 py-2 text-sm text-text-primary transition-colors"
      onclick={(e) => {
        e.stopPropagation()
        void loadFixture('/fixtures/pete-24apr-xxprefix.jpg')
      }}
    >
      Pete 24 Apr · "xx prefix"
    </button>
  </div>
</div>
