/**
 * @file result.ts
 * @description Small result type for feature boundaries that should not throw for user errors.
 * @module shared
 */

/**
 * Success or failure wrapper for expected domain outcomes.
 * @remarks Using an explicit result keeps SMS parsing and validation failures
 * separate from infrastructure exceptions that should still surface loudly.
 */
export type Result<TValue, TError extends string = string> =
  | { ok: true; value: TValue }
  | { ok: false; error: TError };
