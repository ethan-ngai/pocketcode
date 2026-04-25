/**
 * @file java.ts
 * @description Java runtime adapter boundary for sandbox execution.
 * @module repl
 */

/**
 * Java language identifier.
 * @remarks Exporting the literal keeps future runtime adapter registration tied
 * to the shared `ReplLanguage` contract.
 */
export const javaLanguage = "java";
