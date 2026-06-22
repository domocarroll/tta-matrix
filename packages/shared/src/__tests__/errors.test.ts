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

  it("categorises an Anthropic usage-limit 400 as SERVICE_LIMIT (non-retryable)", () => {
    // Real shape: BadRequestError, status 400, message mentions usage limits.
    const err = Object.assign(new Error("You have reached your specified API usage limits."), {
      status: 400,
    });
    const result = categoriseError(err);
    expect(result.category).toBe("SERVICE_LIMIT");
    expect(result.isRetryable).toBe(false);
    expect(result.userMessage).toMatch(/usage limit/i);
  });

  it("categorises a low credit-balance error as SERVICE_LIMIT", () => {
    const result = categoriseError(new Error("Your credit balance is too low to access the API"));
    expect(result.category).toBe("SERVICE_LIMIT");
    expect(result.isRetryable).toBe(false);
  });

  // Anthropic SDK throws APIError subclasses with a numeric `.status` (not a
  // Response). These must be categorised by status so rate limits get retried.
  it("categorises an Anthropic RateLimitError (status 429)", () => {
    const err = Object.assign(new Error("Rate limit reached"), { status: 429 });
    const result = categoriseError(err);
    expect(result.category).toBe("RATE_LIMITED");
    expect(result.isRetryable).toBe(true);
  });

  it("categorises an Anthropic BadRequestError 413 payload (status 413)", () => {
    const err = Object.assign(new Error("Bad request"), { status: 413 });
    const result = categoriseError(err);
    expect(result.category).toBe("PAYLOAD_TOO_LARGE");
    expect(result.isRetryable).toBe(false);
  });

  it("categorises an Anthropic AuthenticationError (status 401)", () => {
    const err = Object.assign(new Error("invalid x-api-key"), { status: 401 });
    const result = categoriseError(err);
    expect(result.category).toBe("API_KEY_ERROR");
    expect(result.isRetryable).toBe(false);
  });

  it("categorises a status 403 permission error as API_KEY_ERROR", () => {
    const err = Object.assign(new Error("forbidden"), { status: 403 });
    const result = categoriseError(err);
    expect(result.category).toBe("API_KEY_ERROR");
    expect(result.isRetryable).toBe(false);
  });

  it("categorises an Anthropic 5xx (status 529 overloaded) as NETWORK_ERROR", () => {
    const err = Object.assign(new Error("Overloaded"), { status: 529 });
    const result = categoriseError(err);
    expect(result.category).toBe("NETWORK_ERROR");
    expect(result.isRetryable).toBe(true);
  });

  it("categorises a generic 500 InternalServerError as NETWORK_ERROR", () => {
    const err = Object.assign(new Error("internal server error"), { status: 500 });
    const result = categoriseError(err);
    expect(result.category).toBe("NETWORK_ERROR");
    expect(result.isRetryable).toBe(true);
  });

  it("also reads a numeric `statusCode` field", () => {
    const result = categoriseError({ statusCode: 429, message: "too many" });
    expect(result.category).toBe("RATE_LIMITED");
    expect(result.isRetryable).toBe(true);
  });

  it("still categorises a native Response by status (no regression)", () => {
    const result = categoriseError(new Response(null, { status: 429 }));
    expect(result.category).toBe("RATE_LIMITED");
    expect(result.isRetryable).toBe(true);
  });

  it("ignores a non-numeric status field and falls back to message", () => {
    const err = Object.assign(new Error("something weird"), { status: "oops" });
    const result = categoriseError(err);
    expect(result.category).toBe("UNKNOWN");
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
