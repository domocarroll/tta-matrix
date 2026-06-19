// Server-side: fetch persisted images out of Convex storage as Anthropic image
// blocks, so an extraction can be re-run from a stored card/sheet without the
// browser holding the original File (cross-session re-extract).

import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

export interface StoredImagePart {
  type: 'image'
  source: { type: 'base64'; media_type: MediaType; data: string }
}

function mediaFrom(contentType: string | null): MediaType {
  if (contentType === 'image/png' || contentType === 'image/webp' || contentType === 'image/gif') {
    return contentType
  }
  return 'image/jpeg'
}

/** Resolve storageIds → base64 image blocks (skips any that fail to fetch). */
export async function imagePartsFromStorage(storageIds: string[]): Promise<StoredImagePart[]> {
  const url = env.CONVEX_URL
  if (!url || storageIds.length === 0) return []
  const client = new ConvexHttpClient(url)
  const parts: StoredImagePart[] = []
  for (const sid of storageIds) {
    const signed = (await client.query(api.files.getUrl, { storageId: sid })) as string | null
    if (!signed) continue
    const res = await fetch(signed)
    if (!res.ok) continue
    const buf = Buffer.from(await res.arrayBuffer())
    parts.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaFrom(res.headers.get('content-type')), data: buf.toString('base64') }
    })
  }
  return parts
}
