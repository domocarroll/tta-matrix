// ──────────────────────────────────────────────────────
// Durable write outbox — survives reload, retries, flushes on unload
// ──────────────────────────────────────────────────────
//
// Pete's #1 complaint: edits and extractions vanish when he exits the app or
// when something errors. Root cause: writes went straight to the network with
// no local buffer, and a failed write was followed by a `refresh()` that wiped
// the optimistic state from the screen.
//
// This outbox is the durable buffer. Every workspace write — a correction
// (Pete's edit) or a completed extraction — is written to localStorage FIRST,
// then delivered to the server. If the tab closes, the network blips, or the
// server 500s, the job simply waits in localStorage and is retried on the next
// flush (including the next time the page loads). Deliveries are idempotent
// server-side (corrections upsert by meetingKey; persists dedupe by clientTxId)
// so at-least-once retries never duplicate data.

import type { HorsePatch, MeetingCorrection } from './workspace'
import type { ExtractionResult } from './types'

const KEY = (clientId: string) => `tta:outbox:${clientId}`
const MAX_BACKOFF_MS = 30_000
const BASE_BACKOFF_MS = 1_000

export interface CorrectionBody {
  meetingKey: string
  label?: string
  notes?: string
  horsePatches: HorsePatch[]
}

export interface PersistBody {
  clientId: string
  /** Client-generated idempotency key — server dedupes on it. */
  clientTxId: string
  filename: string
  durationMs: number
  tokensIn: number
  tokensOut: number
  model: string
  payload: ExtractionResult
  overrideCategory?: string
  meetingKey?: string
}

interface JobBase {
  id: string
  attempts: number
  /** Epoch ms before which this job should not be retried (backoff). */
  nextMs: number
  lastError?: string
  updatedAt: number
}
export interface CorrectionJob extends JobBase {
  kind: 'correction'
  body: CorrectionBody
}
export interface PersistJob extends JobBase {
  kind: 'persist'
  body: PersistBody
}
export type OutboxJob = CorrectionJob | PersistJob

// ── Storage ──────────────────────────────────────────────

function read(clientId: string): OutboxJob[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY(clientId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as OutboxJob[]
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[outbox] read failed:', err)
    return []
  }
}

function write(clientId: string, jobs: OutboxJob[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY(clientId), JSON.stringify(jobs))
  } catch (err) {
    // localStorage full or blocked. The in-memory session copy still drives
    // this tab; surface so we notice rather than silently losing durability.
    console.error('[outbox] write failed:', err)
  }
}

// ── Enqueue ──────────────────────────────────────────────

/** Queue a correction. Coalesces by meetingKey — the latest edit wins. */
export function enqueueCorrection(clientId: string, body: CorrectionBody): void {
  const jobs = read(clientId).filter(
    (j) => !(j.kind === 'correction' && j.body.meetingKey === body.meetingKey)
  )
  jobs.push({
    id: `correction:${body.meetingKey}`,
    kind: 'correction',
    body,
    attempts: 0,
    nextMs: 0,
    updatedAt: Date.now()
  })
  write(clientId, jobs)
}

/** Queue a completed extraction for durable delivery. */
export function enqueuePersist(clientId: string, body: PersistBody): void {
  const jobs = read(clientId).filter(
    (j) => !(j.kind === 'persist' && j.body.clientTxId === body.clientTxId)
  )
  jobs.push({
    id: `persist:${body.clientTxId}`,
    kind: 'persist',
    body,
    attempts: 0,
    nextMs: 0,
    updatedAt: Date.now()
  })
  write(clientId, jobs)
}

// ── Read helpers ─────────────────────────────────────────

export function pendingCount(clientId: string): number {
  return read(clientId).length
}

/** Pending corrections as a MeetingCorrection overlay for optimistic display. */
export function pendingCorrections(clientId: string): MeetingCorrection[] {
  return read(clientId)
    .filter((j): j is CorrectionJob => j.kind === 'correction')
    .map((j) => ({
      meetingKey: j.body.meetingKey,
      label: j.body.label ?? null,
      notes: j.body.notes ?? null,
      horsePatches: j.body.horsePatches,
      updatedAt: j.updatedAt
    }))
}

// ── Delivery ─────────────────────────────────────────────

function backoff(attempts: number): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempts)
  return ceiling / 2 + Math.random() * (ceiling / 2) // half fixed, half jitter
}

async function deliver(clientId: string, job: OutboxJob): Promise<void> {
  if (job.kind === 'correction') {
    const res = await fetch('/api/corrections', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, ...job.body })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return
  }
  const res = await fetch('/api/persist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(job.body)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export interface FlushResult {
  delivered: number
  failed: number
  pending: number
}

const inFlight = new Set<string>()

/**
 * Attempt delivery of every due job. Guarded so overlapping calls (interval +
 * debounce + online event) don't double-send. On failure a job is kept and its
 * retry is pushed out with exponential backoff + jitter.
 */
export async function flush(clientId: string): Promise<FlushResult> {
  if (inFlight.has(clientId)) {
    return { delivered: 0, failed: 0, pending: read(clientId).length }
  }
  inFlight.add(clientId)
  try {
    const jobs = read(clientId)
    const now = Date.now()
    let delivered = 0
    let failed = 0
    for (const job of jobs) {
      if (job.nextMs > now) continue
      try {
        await deliver(clientId, job)
        // Re-read: an edit may have coalesced this job while it was in flight.
        // Only drop it if untouched (same updatedAt) so a newer edit survives.
        const current = read(clientId)
        const match = current.find((j) => j.id === job.id)
        if (match && match.updatedAt === job.updatedAt) {
          write(
            clientId,
            current.filter((j) => j.id !== job.id)
          )
        }
        delivered += 1
      } catch (err) {
        failed += 1
        const current = read(clientId)
        const idx = current.findIndex((j) => j.id === job.id)
        if (idx !== -1) {
          const j = current[idx]!
          current[idx] = {
            ...j,
            attempts: j.attempts + 1,
            nextMs: Date.now() + backoff(j.attempts),
            lastError: err instanceof Error ? err.message : 'delivery failed'
          }
          write(clientId, current)
        }
      }
    }
    return { delivered, failed, pending: read(clientId).length }
  } finally {
    inFlight.delete(clientId)
  }
}

/**
 * Best-effort delivery during page unload. `keepalive` lets these requests
 * outlive the document. Anything that doesn't make it stays in the outbox and
 * is retried on the next load — idempotency makes the overlap safe.
 */
export function flushBeacon(clientId: string): void {
  if (typeof window === 'undefined') return
  for (const job of read(clientId)) {
    try {
      if (job.kind === 'correction') {
        void fetch('/api/corrections', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ clientId, ...job.body }),
          keepalive: true
        })
      } else {
        void fetch('/api/persist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(job.body),
          keepalive: true
        })
      }
    } catch {
      /* stays in outbox for next load */
    }
  }
}
