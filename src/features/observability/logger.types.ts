/**
 * @file logger.types.ts
 * @description Logging contracts for Worker-safe observability.
 * @module observability
 */

/**
 * Structured log level.
 * @remarks Keeping levels explicit helps future telemetry map Worker console
 * logs to provider severity without string drift.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
