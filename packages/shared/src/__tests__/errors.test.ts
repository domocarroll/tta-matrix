import { describe, it, expect } from "vitest";
import { categoriseError, shouldRetry, getRetryDelay } from "../errors.ts";

describe("categoriseError", () => {
  it("categorises rate limit errors", () => {
    const result = categoriseError(new Error("rate limit exceeded"));
    expect(result.category).toBe("RATE_LIMITED");
    expect(result.isRetryable).toBe(true);
  });

  it("categorises API key errors", () => {
    const result = categoriseError(new Error("unauthorized"));
    expect(result.category).toBe("API_KEY_ERROR");
    expect(result.isRetryable).toBe(false);
  });

  it("categorises timeout errors", () => {
    const result = categoriseError(new Error("request timed out"));
    expect(result.category).toBe("TIMEOUT");
    expect(result.isRetryable).toBe(true);
  });

  it("categorises network errors", () => {
    const result = categoriseError(new Error("fetch failed: ECONNREFUSED"));
    expect(result.category).toBe("NETWORK_ERROR");
    expect(result.isRetryable).toBe(true);
  });

  it("defaults to UNKNOWN", () => {
    const result = categoriseError(new Error("something weird"));
    expect(result.category).toBe("UNKNOWN");
    expect(result.isRetryable).toBe(true);
  });
});

describe("shouldRetry", () => {
  it("retries retryable errors within limit", () => {
    const error = categoriseError(new Error("rate limit"));
    expect(shouldRetry(error, 0, 2)).toBe(true);
    expect(shouldRetry(error, 1, 2)).toBe(true);
  });

  it("does not retry past max attempts", () => {
    const error = categoriseError(new Error("rate limit"));
    expect(shouldRetry(error, 2, 2)).toBe(false);
  });

  it("does not retry non-retryable errors", () => {
    const error = categoriseError(new Error("unauthorized"));
    expect(shouldRetry(error, 0, 2)).toBe(false);
  });
});

describe("getRetryDelay", () => {
  it("applies exponential backoff", () => {
    // With 0 jitter factor to test pure exponential
    const d0 = getRetryDelay(0, 1000, 8000, 0);
    const d1 = getRetryDelay(1, 1000, 8000, 0);
    const d2 = getRetryDelay(2, 1000, 8000, 0);

    expect(d0).toBe(1000);
    expect(d1).toBe(2000);
    expect(d2).toBe(4000);
  });

  it("caps at max delay", () => {
    const delay = getRetryDelay(10, 1000, 8000, 0);
    expect(delay).toBe(8000);
  });

  it("adds jitter", () => {
    const delay = getRetryDelay(0, 1000, 8000, 0.3);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1300);
  });
});
