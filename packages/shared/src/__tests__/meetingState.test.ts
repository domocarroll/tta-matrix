import { describe, expect, test } from "vitest";
import { nextState, stateLabel } from "../meetingState.ts";

describe("meetingState.nextState — valid transitions", () => {
  test("draft + cards-uploaded → cards-pending", () => {
    expect(nextState("draft", { kind: "cards-uploaded" })).toEqual({
      ok: true,
      next: "cards-pending",
    });
  });

  test("draft + field-approved → locked", () => {
    expect(nextState("draft", { kind: "field-approved" })).toEqual({
      ok: true,
      next: "locked",
    });
  });

  test("cards-pending + cards-extracted → cards-pending (idempotent)", () => {
    expect(nextState("cards-pending", { kind: "cards-extracted" })).toEqual({
      ok: true,
      next: "cards-pending",
    });
  });

  test("cards-pending + field-approved → locked", () => {
    expect(nextState("cards-pending", { kind: "field-approved" })).toEqual({
      ok: true,
      next: "locked",
    });
  });

  test("cards-pending + cards-removed → draft", () => {
    expect(nextState("cards-pending", { kind: "cards-removed" })).toEqual({
      ok: true,
      next: "draft",
    });
  });

  test("locked + field-unapproved → draft", () => {
    expect(nextState("locked", { kind: "field-unapproved" })).toEqual({
      ok: true,
      next: "draft",
    });
  });

  test("locked + field-approved → locked (no-op re-save)", () => {
    expect(nextState("locked", { kind: "field-approved" })).toEqual({
      ok: true,
      next: "locked",
    });
  });
});

describe("meetingState.nextState — invalid transitions", () => {
  test("draft + cards-extracted is invalid", () => {
    const r = nextState("draft", { kind: "cards-extracted" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_transition");
      expect(r.from).toBe("draft");
      expect(r.event).toBe("cards-extracted");
    }
  });

  test("draft + cards-removed is invalid", () => {
    expect(nextState("draft", { kind: "cards-removed" }).ok).toBe(false);
  });

  test("draft + field-unapproved is invalid", () => {
    expect(nextState("draft", { kind: "field-unapproved" }).ok).toBe(false);
  });

  test("cards-pending + cards-uploaded is invalid (already uploading)", () => {
    expect(nextState("cards-pending", { kind: "cards-uploaded" }).ok).toBe(
      false,
    );
  });

  test("locked + cards-uploaded is invalid (must unlock first)", () => {
    expect(nextState("locked", { kind: "cards-uploaded" }).ok).toBe(false);
  });

  test("locked + cards-removed is invalid", () => {
    expect(nextState("locked", { kind: "cards-removed" }).ok).toBe(false);
  });
});

describe("meetingState.nextState — force (admin escape)", () => {
  test("force to draft from locked", () => {
    expect(nextState("locked", { kind: "force", target: "draft" })).toEqual({
      ok: true,
      next: "draft",
    });
  });

  test("force to locked from draft", () => {
    expect(nextState("draft", { kind: "force", target: "locked" })).toEqual({
      ok: true,
      next: "locked",
    });
  });

  test("force to same state is a no-op success", () => {
    expect(
      nextState("cards-pending", { kind: "force", target: "cards-pending" }),
    ).toEqual({ ok: true, next: "cards-pending" });
  });
});

describe("meetingState.stateLabel", () => {
  test("labels are human readable", () => {
    expect(stateLabel("draft")).toBe("draft");
    expect(stateLabel("cards-pending")).toBe("cards pending");
    expect(stateLabel("locked")).toBe("locked");
  });
});
