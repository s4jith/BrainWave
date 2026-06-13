/**
 * Centralized environment configuration.
 * All env access goes through this module so we can validate once and
 * avoid sprinkling `process.env.*` across the codebase.
 */

type PublicEnvKey = "NEXT_PUBLIC_API_URL";

function readPublicEnv(key: PublicEnvKey, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    if (typeof window === "undefined") {
      return fallback ?? "";
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  apiUrl: readPublicEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000"),
  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV !== "production",
} as const;

export type Env = typeof env;
