/**
 * @file python.ts
 * @description Python runtime adapter boundary for sandbox execution.
 * @module repl
 */

/**
 * Python language identifier.
 * @remarks Exporting the literal keeps future runtime adapter registration tied
 * to the shared `ReplLanguage` contract.
 */
export const pythonLanguage = "python";
