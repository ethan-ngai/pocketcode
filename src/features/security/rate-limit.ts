/**
 * @file rate-limit.ts
 * @description Rate-limit boundary for SMS and API abuse controls.
 * @module security
 */
import type { RateLimitDecision } from "./security.types";

/**
 * Allows all requests until persistent rate limiting is implemented.
 * @returns An allow decision.
 * @remarks The function exists now so execution and SMS workstreams call a
 * shared boundary instead of baking policy decisions into their handlers.
 */
export function allowDuringPhaseZero(): RateLimitDecision {
  return { allowed: true, retryAfterSeconds: null };
}
