// Lazy-load a signed URL for a stored image (returns null on failure).

export async function loadImageUrl(storageId: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/image-url?storageId=${encodeURIComponent(storageId)}`)
    if (!r.ok) return null
    const j = (await r.json()) as { url?: string | null }
    return j.url ?? null
  } catch {
    return null
  }
}
