// Upload an image to Convex file storage and return its storageId.
//
// Best-effort: returns null on any failure so callers can proceed without a
// persisted image (the row still saves; cross-session re-extract just won't be
// available for it). Two hops — mint a URL via our Worker, then PUT/POST the
// bytes straight to Convex.

export async function uploadImage(file: File): Promise<string | null> {
  try {
    const urlRes = await fetch('/api/upload-url', { method: 'POST' })
    if (!urlRes.ok) return null
    const { uploadUrl } = (await urlRes.json()) as { uploadUrl?: string }
    if (!uploadUrl) return null

    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file
    })
    if (!up.ok) return null
    const { storageId } = (await up.json()) as { storageId?: string }
    return storageId ?? null
  } catch (err) {
    console.error('[uploadImage] failed:', err instanceof Error ? err.message : err)
    return null
  }
}
