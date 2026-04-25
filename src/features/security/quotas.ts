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

/**
 * Java timeout in milliseconds for the SMS MVP.
 * @remarks Compilation can make Java slower than Python, but the cap stays hard
 * so SMS users get predictable feedback and cost exposure stays bounded.
 */
export const DEFAULT_JAVA_EXECUTION_TIMEOUT_MS = 8_000;

/**
 * Maximum execution commands accepted from one phone number per hour.
 * @remarks This product-level default is enforced before job creation; the
 * security workstream can later replace it with configurable quota rows.
 */
export const DEFAULT_SMS_EXECUTIONS_PER_HOUR = 20;

/**
 * Maximum execution commands accepted from one phone number per day.
 * @remarks Daily limits prevent a quiet but sustained SMS loop from creating
 * unbounded SMS provider and sandbox usage.
 */
export const DEFAULT_SMS_EXECUTIONS_PER_DAY = 100;

/**
 * Maximum output characters retained for execution previews.
 * @remarks Full storage and SMS truncation should share one default budget so
 * admin inspection and phone output do not drift.
 */
export const DEFAULT_EXECUTION_MAX_OUTPUT_CHARS = 4_000;
