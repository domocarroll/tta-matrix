<script lang="ts">
  // v0 upload skin — presentational. The page owns extraction + persistence;
  // this raises files (with chosen category) and renders per-photo status.
  import { categoryConfig, CATEGORY_ORDER } from '$lib/classic/categoryConfig'
  import type { ProcessedPhoto, RaceCategory } from '$lib/classic/types'

  interface Props {
    photos: ProcessedPhoto[]
    onAddFiles: (files: File[], category: RaceCategory) => void
    onRetry: (id: string) => void
    onRemove: (id: string) => void
  }
  let { photos, onAddFiles, onRetry, onRemove }: Props = $props()

  let raceCategory = $state<RaceCategory>('SR')
  let isDragActive = $state(false)
  let uploadError = $state<string | null>(null)
  let fileInput: HTMLInputElement

  const MAX_FILE_SIZE_MB = 8
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
  const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

  const readyCount = $derived(photos.filter((p) => p.status === 'ready').length)
  const processingCount = $derived(
    photos.filter((p) => p.status === 'processing' || p.status === 'uploading').length
  )
  const errorCount = $derived(photos.filter((p) => p.status === 'error').length)

  function validate(files: File[]): { ok: File[]; err: string | null } {
    const ok: File[] = []
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE_BYTES) return { ok, err: `"${f.name}" too large (max ${MAX_FILE_SIZE_MB}MB).` }
      if (!VALID_TYPES.includes(f.type)) return { ok, err: `"${f.name}" not a PNG/JPG/WEBP.` }
      ok.push(f)
    }
    return { ok, err: null }
  }

  function ingest(files: File[]): void {
    uploadError = null
    const { ok, err } = validate(files)
    if (err) {
      uploadError = err
      if (ok.length === 0) return
    }
    if (ok.length > 0) onAddFiles(ok, raceCategory)
  }

  function onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length) {
      ingest(Array.from(input.files))
      input.value = ''
    }
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault()
    isDragActive = false
    const files = e.dataTransfer?.files
    if (files && files.length) ingest(Array.from(files))
  }

  const statusText = (s: ProcessedPhoto['status']) =>
    s === 'uploading' ? 'Uploading…' : s === 'processing' ? 'Processing…' : s === 'ready' ? 'Saved' : 'Failed'
</script>

<div class="animate-fade-in space-y-8">
  <div class="py-2 text-center">
    <h2 class="mb-2 text-4xl font-bold tracking-tight md:text-5xl">Upload Tip Sheets</h2>
    <p class="c-muted mx-auto max-w-xl text-lg">
      Each photo is read by Claude, anchored to the official field, and saved automatically.
    </p>
  </div>

  <div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
    <!-- Upload -->
    <div class="card animate-slide-up space-y-6">
      <div>
        <h3 class="c-primary text-2xl font-bold">1. Select Category &amp; Upload</h3>
        <p class="c-muted mt-1 text-sm font-medium">Choose a category, then upload one or more photos.</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        {#each CATEGORY_ORDER as cat (cat)}
          {@const config = categoryConfig[cat]}
          {@const selected = raceCategory === cat}
          <button
            type="button"
            class="rounded-lg py-2.5 text-xs font-bold transition-all duration-150 sm:text-sm {selected ? 'scale-105 shadow-md' : 'bg-soft c-fg hover:opacity-80'}"
            style={selected ? `background:${config.color};color:#fff` : ''}
            onclick={() => (raceCategory = cat)}
          >
            {config.name}
          </button>
        {/each}
      </div>

      <div
        role="button"
        tabindex="0"
        class="relative rounded-xl border-2 border-dashed border-soft p-8 text-center transition-all duration-150 {isDragActive ? 'bg-accent-soft' : ''}"
        ondragenter={(e) => { e.preventDefault(); isDragActive = true }}
        ondragover={(e) => e.preventDefault()}
        ondragleave={() => (isDragActive = false)}
        ondrop={onDrop}
      >
        <svg class="c-muted mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5 7.5 12M12 7.5V21" />
        </svg>
        <p class="c-fg mt-3 text-sm font-medium">
          <button type="button" class="c-accent font-bold hover:underline" onclick={() => fileInput.click()}>Click to upload</button>
          or drag and drop
        </p>
        <p class="c-muted mt-2 text-xs font-medium">PNG, JPG, WEBP (Max {MAX_FILE_SIZE_MB}MB)</p>
        <input bind:this={fileInput} type="file" accept="image/png, image/jpeg, image/webp" multiple class="hidden" onchange={onFileChange} />
      </div>

      {#if uploadError}
        <div class="animate-fade-in rounded-lg border px-4 py-3" style="border-color:#e94e37;background:rgba(233,78,55,0.08)">
          <p class="c-destructive text-sm font-semibold">{uploadError}</p>
        </div>
      {/if}
    </div>

    <!-- Status -->
    <div class="card animate-slide-up space-y-6" style="animation-delay:0.1s">
      <div>
        <h3 class="c-primary text-2xl font-bold">2. Processing Status</h3>
        {#if photos.length > 0}
          <div class="mt-2 flex gap-4 text-sm font-medium">
            <span class="c-success">✓ {readyCount} Saved</span>
            {#if processingCount > 0}<span class="c-accent">⏳ {processingCount} Processing</span>{/if}
            {#if errorCount > 0}<span class="c-destructive">✗ {errorCount} Failed</span>{/if}
          </div>
        {/if}
      </div>

      {#if photos.length > 0}
        <ul class="max-h-96 space-y-3 overflow-y-auto">
          {#each photos as photo (photo.id)}
            {@const config = categoryConfig[photo.category]}
            <li class="bg-soft flex items-center justify-between rounded-lg border border-soft p-4">
              <div class="flex flex-1 items-center gap-4">
                <div class="relative">
                  <img src={photo.preview} alt="Preview" class="h-16 w-16 rounded-lg object-cover" />
                  <div class="absolute -right-2 -top-2 rounded-full border-2 border-soft bg-white p-1">
                    {#if photo.status === 'ready'}
                      <span class="c-success block h-4 w-4 text-center text-sm leading-4">✓</span>
                    {:else if photo.status === 'error'}
                      <span class="c-destructive block h-4 w-4 text-center text-sm leading-4">✗</span>
                    {:else}
                      <svg class="c-accent animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    {/if}
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-center gap-2">
                    <span class="badge font-bold" style="background:{config.color}">{photo.category}</span>
                    <span class="c-fg text-xs font-semibold">{statusText(photo.status)}</span>
                  </div>
                  <p class="c-muted truncate text-sm font-medium">{photo.file.name}</p>
                  {#if photo.error}<p class="c-destructive mt-1 text-xs">{photo.error}</p>{/if}
                </div>
              </div>
              <div class="flex gap-2">
                {#if photo.status === 'error'}
                  <button type="button" class="c-accent" title="Retry" onclick={() => onRetry(photo.id)}>↻</button>
                {/if}
                <button
                  type="button"
                  class="c-muted hover:opacity-70 disabled:opacity-40"
                  title="Remove"
                  disabled={photo.status === 'processing' || photo.status === 'uploading'}
                  onclick={() => onRemove(photo.id)}
                >✕</button>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="py-16 text-center">
          <div class="mb-3 text-4xl">📸</div>
          <p class="c-fg font-semibold">No photos uploaded yet</p>
          <p class="c-muted mt-1 text-sm">Upload a photo to get started.</p>
        </div>
      {/if}
    </div>
  </div>
</div>
