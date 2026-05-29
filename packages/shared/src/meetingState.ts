// ──────────────────────────────────────────────────────
// 3-Gate workspace — pure meeting state machine
// ──────────────────────────────────────────────────────
//
// Models the lifecycle of a customer meeting in Gate 1:
//
//   draft  ── cards-uploaded ──> cards-pending
//   draft  ── field-approved ──> locked
//   cards-pending ── cards-extracted ──> cards-pending  (idempotent)
//   cards-pending ── field-approved   ──> locked
//   cards-pending ── cards-removed    ──> draft
//   locked ── field-unapproved ──> draft
//   any    ── force(target)     ──> target  (admin escape)
//
// Pure: no side effects. Used by the UI to compute next states and by
// tests to assert transitions. Convex mutations enforce the same rules
// at the write boundary.

export type MeetingState = "draft" | "cards-pending" | "locked";

export type MeetingEvent =
  | { readonly kind: "cards-uploaded" }
  | { readonly kind: "cards-extracted" }
  | { readonly kind: "field-approved" }
  | { readonly kind: "field-unapproved" }
  | { readonly kind: "cards-removed" }
  | { readonly kind: "force"; readonly target: MeetingState };

export type TransitionResult =
  | { readonly ok: true; readonly next: MeetingState }
  | {
      readonly ok: false;
      readonly reason: "invalid_transition";
      readonly from: MeetingState;
      readonly event: MeetingEvent["kind"];
    };

/** Pure transition. Returns the next state or an `invalid_transition`. */
export function nextState(
  current: MeetingState,
  event: MeetingEvent,
): TransitionResult {
  if (event.kind === "force") {
    return { ok: true, next: event.target };
  }
  switch (current) {
    case "draft":
      if (event.kind === "cards-uploaded") {
        return { ok: true, next: "cards-pending" };
      }
      if (event.kind === "field-approved") {
        return { ok: true, next: "locked" };
      }
      break;
    case "cards-pending":
      if (event.kind === "cards-extracted") {
        return { ok: true, next: "cards-pending" };
      }
      if (event.kind === "field-approved") {
        return { ok: true, next: "locked" };
      }
      if (event.kind === "cards-removed") {
        return { ok: true, next: "draft" };
      }
      break;
    case "locked":
      if (event.kind === "field-unapproved") {
        return { ok: true, next: "draft" };
      }
      // Re-approving a locked field is a no-op (idempotent save).
      if (event.kind === "field-approved") {
        return { ok: true, next: "locked" };
      }
      break;
  }
  return {
    ok: false,
    reason: "invalid_transition",
    from: current,
    event: event.kind,
  };
}

/** Human-readable label for UI chips. */
export function stateLabel(state: MeetingState): string {
  switch (state) {
    case "draft":
      return "draft";
    case "cards-pending":
      return "cards pending";
    case "locked":
      return "locked";
  }
}
