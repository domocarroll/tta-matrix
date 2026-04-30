// ──────────────────────────────────────────────────────
// TTA Matrix Agent — Configuration
// ──────────────────────────────────────────────────────

import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY required"),
  CONVEX_URL: z.string().url("CONVEX_URL must be a valid URL"),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing environment variables: ${missing}`);
  }
  return result.data;
}
