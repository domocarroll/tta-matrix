// Client wrapper for /api/meetings (3-Gate workspace registry).

import type { MeetingState } from '@tta/shared'

export interface CustomerMeeting {
  meetingKey: string
  date: string
  category: string
  name: string
  state: MeetingState
  createdAt: number
  updatedAt: number
}

export async function listCustomerMeetings(
  clientId: string,
  sinceMs?: number
): Promise<CustomerMeeting[]> {
  try {
    const params = new URLSearchParams({ clientId })
    if (sinceMs !== undefined) params.set('sinceMs', String(sinceMs))
    const r = await fetch(`/api/meetings?${params.toString()}`)
    if (!r.ok) return []
    const j = (await r.json()) as { rows: CustomerMeeting[] }
    return j.rows
  } catch {
    return []
  }
}

export async function createCustomerMeeting(input: {
  clientId: string
  date: string
  category: string
  name: string
}): Promise<{ meetingKey: string; created: boolean } | null> {
  try {
    const r = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (!r.ok) return null
    return (await r.json()) as { meetingKey: string; created: boolean }
  } catch {
    return null
  }
}

export async function setCustomerMeetingState(input: {
  clientId: string
  meetingKey: string
  state: MeetingState
}): Promise<boolean> {
  try {
    const r = await fetch('/api/meetings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteCustomerMeeting(
  clientId: string,
  meetingKey: string
): Promise<boolean> {
  try {
    const r = await fetch(
      `/api/meetings?clientId=${encodeURIComponent(clientId)}&meetingKey=${encodeURIComponent(meetingKey)}`,
      { method: 'DELETE' }
    )
    return r.ok
  } catch {
    return false
  }
}

export async function runBackfill(clientId: string): Promise<void> {
  try {
    await fetch('/api/meetings/backfill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId })
    })
  } catch {
    // Non-fatal — backfill is idempotent so the next load can retry.
  }
}
