/**
 * @file quotas.ts
 * @description Execution quota defaults for the first SMS REPL implementation.
 * @module security
 */

/**
 * Default execution timeout in milliseconds.
 * @remarks Duplicating the documented MVP target as a named constant gives
 * security and execution workstreams a visible policy anchor.
 */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 5_000;
