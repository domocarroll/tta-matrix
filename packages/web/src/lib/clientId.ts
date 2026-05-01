// Per-browser client identity.
//
// Stage 1 uses a localStorage UUID to scope extraction history to the
// current browser. When real auth lands (Convex Auth + Resend OTP, or
// Clerk), swap the localStorage read for `useAuth().tokenIdentifier`
// — every consumer of `getClientId()` continues to work.
//
// SSR-safe: returns null on the server so callers can hydrate.

const STORAGE_KEY = 'tta.clientId.v1'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for very old environments (CF Workers all support crypto.randomUUID).
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined') crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getClientId(): string | null {
  if (typeof window === 'undefined') return null
  let id = window.localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = generateUuid()
    window.localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

export function resetClientId(): string {
  const id = generateUuid()
  window.localStorage.setItem(STORAGE_KEY, id)
  return id
}
