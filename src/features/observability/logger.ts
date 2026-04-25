/**
 * @file logger.ts
 * @description Minimal Worker-safe logger boundary.
 * @module observability
 */
import type { LogLevel } from "./logger.types";

/**
 * Emits a structured log entry through the Worker console.
 * @param level - Severity used by downstream log processors.
 * @param message - Short event message.
 * @param metadata - Optional structured context.
 * @remarks A tiny wrapper gives later observability work a single replacement
 * point for traces or external sinks.
 */
export function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
  console[level](JSON.stringify({ level, message, metadata }));
}
