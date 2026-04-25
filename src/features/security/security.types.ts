/**
 * @file security.types.ts
 * @description Security policy contracts for rate limiting and quotas.
 * @module security
 */

/**
 * Rate limit decision produced by security checks.
 * @remarks SMS and admin surfaces can consume one decision shape even if the
 * backing implementation changes from in-memory to Durable Objects later.
 */
export interface RateLimitDecision {
  /** Whether the request may proceed. */
  allowed: boolean;
  /** Seconds until retry when the request is denied. */
  retryAfterSeconds: number | null;
  /** Stable reason used by logs and admin tools. */
  reason: "allowed" | "disabled" | "hourly_limit" | "daily_limit";
  /** User-facing refusal copy when the request is denied. */
  message: string | null;
}
