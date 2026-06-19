import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueCorrection,
  enqueuePersist,
  flush,
  pendingCorrections,
  pendingCount,
  type PersistBody
} from '../outbox'

// ── localStorage shim (node env — no jsdom) ──
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
}

const CID = 'client-123'

function samplePersist(clientTxId: string): PersistBody {
  return {
    clientId: CID,
    clientTxId,
    filename: 'sheet.jpg',
    durationMs: 100,
    tokensIn: 1,
    tokensOut: 2,
    model: 'claude-sonnet-4-6',
    // minimal payload — outbox treats it as opaque
    payload: { races: [] } as unknown as PersistBody['payload']
  }
}

beforeEach(() => {
  ;(globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage() }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as { window?: unknown }).window
})

describe('outbox — corrections', () => {
  it('coalesces by meetingKey (latest edit wins)', () => {
    enqueueCorrection(CID, { meetingKey: 'm1', horsePatches: [], label: 'first' })
    enqueueCorrection(CID, { meetingKey: 'm1', horsePatches: [], label: 'second' })
    enqueueCorrection(CID, { meetingKey: 'm2', horsePatches: [] })

    expect(pendingCount(CID)).toBe(2)
    const overlay = pendingCorrections(CID)
    const m1 = overlay.find((c) => c.meetingKey === 'm1')!
    expect(m1.label).toBe('second')
  })

  it('exposes pending edits as a MeetingCorrection overlay', () => {
    enqueueCorrection(CID, {
      meetingKey: 'm1',
      notes: 'check race 3',
      horsePatches: [{ raceNumber: 3, originalName: 'Old Name', newHorseName: 'New Name' }]
    })
    const [c] = pendingCorrections(CID)
    expect(c.meetingKey).toBe('m1')
    expect(c.notes).toBe('check race 3')
    expect(c.horsePatches).toHaveLength(1)
    expect(c.label).toBeNull()
  })
})

describe('outbox — flush', () => {
  it('delivers and clears jobs on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock

    enqueueCorrection(CID, { meetingKey: 'm1', horsePatches: [] })
    enqueuePersist(CID, samplePersist('tx-1'))

    const res = await flush(CID)
    expect(res.delivered).toBe(2)
    expect(res.failed).toBe(0)
    expect(pendingCount(CID)).toBe(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/corrections', expect.objectContaining({ method: 'PUT' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/persist', expect.objectContaining({ method: 'POST' }))
  })

  it('keeps the job and backs off on failure (nothing lost)', async () => {
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    enqueueCorrection(CID, { meetingKey: 'm1', horsePatches: [] })
    const res = await flush(CID)

    expect(res.delivered).toBe(0)
    expect(res.failed).toBe(1)
    // Still durably queued for retry.
    expect(pendingCount(CID)).toBe(1)

    // Immediate re-flush is a no-op: backoff pushed nextMs into the future.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    ;(globalThis as { fetch?: unknown }).fetch = fetchMock
    const res2 = await flush(CID)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(res2.delivered).toBe(0)
    expect(pendingCount(CID)).toBe(1)
  })

  it('survives a network throw without losing the job', async () => {
    ;(globalThis as { fetch?: unknown }).fetch = vi.fn().mockRejectedValue(new Error('offline'))
    enqueuePersist(CID, samplePersist('tx-1'))
    const res = await flush(CID)
    expect(res.failed).toBe(1)
    expect(pendingCount(CID)).toBe(1)
  })
})

describe('outbox — persist idempotency', () => {
  it('coalesces repeated enqueues of the same clientTxId', () => {
    enqueuePersist(CID, samplePersist('tx-1'))
    enqueuePersist(CID, samplePersist('tx-1'))
    expect(pendingCount(CID)).toBe(1)
  })
})
