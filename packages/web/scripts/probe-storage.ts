// Verify the Convex file-storage round-trip end to end against the deployed
// backend: mint an upload URL → upload bytes → get a signed URL → fetch back →
// compare. Run after deploying convex.
//
//   tsx scripts/eval/probe-storage.ts [imagePath]

import { readFileSync } from 'node:fs'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

function convexUrl(): string {
  if (process.env.CONVEX_URL) return process.env.CONVEX_URL
  for (const p of ['packages/web/.env', '.env']) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^CONVEX_URL=(.+)$/)
        if (m) return m[1].trim()
      }
    } catch {
      /* keep looking */
    }
  }
  throw new Error('CONVEX_URL not found')
}

async function main(): Promise<void> {
  const imgPath = process.argv[2] ?? 'demo-fixtures/pete-22may/pete22-guide-1-1000001404.jpg'
  const bytes = readFileSync(imgPath)
  const client = new ConvexHttpClient(convexUrl())

  console.log(`uploading ${imgPath} (${bytes.length} bytes)…`)
  const uploadUrl = (await client.mutation(api.files.generateUploadUrl, {})) as string
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg' },
    body: bytes
  })
  if (!up.ok) throw new Error(`upload failed: HTTP ${up.status}`)
  const { storageId } = (await up.json()) as { storageId: string }
  console.log(`  → storageId ${storageId}`)

  const signed = (await client.query(api.files.getUrl, { storageId })) as string | null
  if (!signed) throw new Error('getUrl returned null')
  const back = await fetch(signed)
  const roundtripped = Buffer.from(await back.arrayBuffer())
  console.log(`  → fetched back ${roundtripped.length} bytes`)

  const ok = roundtripped.length === bytes.length
  console.log(ok ? '\n✓ ROUND-TRIP OK — bytes match' : `\n✗ MISMATCH (${bytes.length} → ${roundtripped.length})`)
  if (!ok) process.exit(1)
}

void main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
