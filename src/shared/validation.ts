/**
 * @file validation.ts
 * @description Shared validation primitives for feature-level inputs.
 * @module shared
 */

/**
 * Checks whether a phone number is already normalized to a conservative E.164 shape.
 * @param value - Candidate phone number from provider input or tests.
 * @returns True when the value is safe to store as an E.164 phone number.
 * @remarks Full phone parsing belongs in the SMS provider layer; this guard only
 * protects shared contracts from obviously invalid values.
 */
export function isLikelyE164(value: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(value);
}
