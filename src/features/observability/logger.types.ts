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

/**
 * JSON-compatible metadata accepted by the logger.
 * @remarks Restricting metadata to serializable values keeps Worker console
 * output parseable by Cloudflare log sinks and future telemetry pipelines.
 */
export type LogMetadata = Record<string, unknown>;

/**
 * Structured logging interface used by feature modules.
 * @description Defines a small Worker-safe logger contract that can be replaced
 * by traces or provider-specific sinks without changing SMS or REPL code.
 */
export interface Logger {
  /**
   * Emits debug-only diagnostic context.
   * @param event - Stable event name for downstream filters.
   * @param metadata - JSON-safe context with secrets removed before emission.
   * @returns Nothing; logging should never influence request control flow.
   */
  debug(event: string, metadata?: LogMetadata): void;
  /**
   * Emits normal operational events.
   * @param event - Stable event name for downstream filters.
   * @param metadata - JSON-safe context with secrets removed before emission.
   * @returns Nothing; logging should never influence request control flow.
   */
  info(event: string, metadata?: LogMetadata): void;
  /**
   * Emits expected but noteworthy failures.
   * @param event - Stable event name for downstream filters.
   * @param metadata - JSON-safe context with secrets removed before emission.
   * @returns Nothing; logging should never influence request control flow.
   */
  warn(event: string, metadata?: LogMetadata): void;
  /**
   * Emits unexpected failures that require investigation.
   * @param event - Stable event name for downstream filters.
   * @param metadata - JSON-safe context with secrets removed before emission.
   * @returns Nothing; logging should never influence request control flow.
   */
  error(event: string, metadata?: LogMetadata): void;
}

/**
 * Runtime options for a logger instance.
 * @description Lets tests capture structured entries and lets production keep
 * source bodies out of logs unless a deployment explicitly opts in.
 */
export interface LoggerOptions {
  /** Deployment environment used to decide production-safe redaction defaults. */
  environment?: string;
  /** Explicitly allow full source or SMS bodies in logs for local debugging. */
  includeSensitiveBodies?: boolean;
  /** Console-like sink used by tests to capture emitted entries. */
  sink?: Pick<Console, LogLevel>;
}
