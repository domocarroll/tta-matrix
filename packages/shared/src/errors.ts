// ──────────────────────────────────────────────────────
// TTA Matrix — Error Categorisation (from v0 production)
// ──────────────────────────────────────────────────────

export type ErrorCategory =
  | "RATE_LIMITED"
  | "TEXT_RESPONSE"
  | "NETWORK_ERROR"
  | "INVALID_IMAGE"
  | "API_KEY_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "PARSE_ERROR"
  | "REFUSAL"
  | "TIMEOUT"
  | "UNKNOWN";

interface CategorisedError {
  readonly category: ErrorCategory;
  readonly isRetryable: boolean;
  readonly userMessage: string;
  readonly originalError?: unknown;
}

const ERROR_CONFIG: Record<
  ErrorCategory,
  { readonly isRetryable: boolean; readonly userMessage: string }
> = {
  RATE_LIMITED: {
    isRetryable: true,
    userMessage: "Rate limited — retrying shortly.",
  },
  TEXT_RESPONSE: {
    isRetryable: true,
    userMessage: "AI returned a text response instead of structured data. Retrying.",
  },
  NETWORK_ERROR: {
    isRetryable: true,
    userMessage: "Network error — retrying.",
  },
  INVALID_IMAGE: {
    isRetryable: false,
    userMessage: "Image appears corrupted or blank. Please try a different image.",
  },
  API_KEY_ERROR: {
    isRetryable: false,
    userMessage: "Authentication error. Check API key configuration.",
  },
  PAYLOAD_TOO_LARGE: {
    isRetryable: false,
    userMessage: "Image exceeds 3MB limit. Please compress and retry.",
  },
  PARSE_ERROR: {
    isRetryable: true,
    userMessage: "Failed to parse extraction results. Retrying.",
  },
  REFUSAL: {
    isRetryable: true,
    userMessage: "AI declined to process this image. Retrying with adjusted prompt.",
  },
  TIMEOUT: {
    isRetryable: true,
    userMessage: "Request timed out — retrying.",
  },
  UNKNOWN: {
    isRetryable: true,
    userMessage: "Unexpected error. Retrying once.",
  },
} as const;

/** Categorise an error from the extraction pipeline */
export function categoriseError(error: unknown): CategorisedError {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const statusCode =
    error instanceof Response ? error.status : undefined;

  let category: ErrorCategory;

  if (statusCode === 429 || message.includes("rate limit") || message.includes("quota")) {
    category = "RATE_LIMITED";
  } else if (statusCode === 413 || message.includes("payload too large")) {
    category = "PAYLOAD_TOO_LARGE";
  } else if (statusCode === 401 || statusCode === 403 || message.includes("api key") || message.includes("unauthorized")) {
    category = "API_KEY_ERROR";
  } else if (message.includes("timeout") || message.includes("timed out")) {
    category = "TIMEOUT";
  } else if (message.includes("fetch") || message.includes("network") || message.includes("econnrefused")) {
    category = "NETWORK_ERROR";
  } else {
    category = "UNKNOWN";
  }

  const config = ERROR_CONFIG[category];
  return {
    category,
    isRetryable: config.isRetryable,
    userMessage: config.userMessage,
    originalError: error,
  };
}

/** Determine if an error should be retried */
export function shouldRetry(
  error: CategorisedError,
  attempt: number,
  maxRetries: number,
): boolean {
  return error.isRetryable && attempt < maxRetries;
}

/** Calculate retry delay with exponential backoff + jitter */
export function getRetryDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  jitterFactor: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt);
  const jitter = Math.random() * jitterFactor * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}
