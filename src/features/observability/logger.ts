/**
 * @file logger.ts
 * @description Worker-safe structured logger with conservative redaction.
 * @module observability
 */
import type { Logger, LoggerOptions, LogLevel, LogMetadata } from "./logger.types";

const REDACTED = "[redacted]";
const SECRET_KEY_PATTERN =
  /(auth.?token|api.?key|token|secret|password|database.?url|db.?url|connection.?string)/i;
const BODY_KEY_PATTERN = /^(body|code|source|sourceCode|fullCode)$/i;

/**
 * Default application logger.
 * @remarks Feature modules import this singleton so tests can still exercise the
 * same structured event shape without configuring an external telemetry sink.
 */
export const logger = createLogger();

/**
 * Creates a structured logger for Worker-compatible console sinks.
 * @param options - Redaction and sink controls used by tests or deployment code.
 * @returns Logger instance with level-specific helpers.
 * @remarks Secret redaction happens at the boundary so feature code can log
 * operational context without every caller reimplementing deny lists.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? console;

  return {
    debug: (event, metadata) => emit(sink, "debug", event, metadata, options),
    info: (event, metadata) => emit(sink, "info", event, metadata, options),
    warn: (event, metadata) => emit(sink, "warn", event, metadata, options),
    error: (event, metadata) => emit(sink, "error", event, metadata, options),
  };
}

/**
 * Emits a structured log entry through the default logger.
 * @param level - Severity used by downstream log processors.
 * @param event - Stable event name.
 * @param metadata - Optional structured context.
 * @returns Nothing; the function exists for older call sites.
 * @remarks Keeping this wrapper avoids unrelated churn while new code can use
 * the clearer `logger.info("event", metadata)` API.
 */
export function log(level: LogLevel, event: string, metadata?: LogMetadata): void {
  logger[level](event, metadata);
}

/**
 * Produces a short non-cryptographic fingerprint for log correlation.
 * @param value - Identifier that should not be emitted in full.
 * @returns Stable short hash or null when no value is available.
 * @remarks The hash is only for correlating operational logs, not for security
 * decisions or irreversible anonymization guarantees.
 */
export function hashLogValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(16);
}

/**
 * Serializes and writes one structured log entry.
 * @param sink - Console-compatible destination.
 * @param level - Severity used by downstream log processors.
 * @param event - Stable event name.
 * @param metadata - Optional structured context.
 * @param options - Redaction controls for this logger instance.
 * @returns Nothing; logging errors are intentionally swallowed by the console.
 */
function emit(
  sink: Pick<Console, LogLevel>,
  level: LogLevel,
  event: string,
  metadata: LogMetadata | undefined,
  options: LoggerOptions,
): void {
  sink[level](
    JSON.stringify({
      level,
      event,
      metadata: sanitizeMetadata(metadata, options),
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Removes secrets and production-sensitive bodies from metadata.
 * @param metadata - Caller-supplied structured context.
 * @param options - Runtime redaction controls.
 * @returns Metadata safe enough for default production logs.
 */
function sanitizeMetadata(
  metadata: LogMetadata | undefined,
  options: LoggerOptions,
): LogMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  return sanitizeObject(metadata, shouldRedactBodies(options)) as LogMetadata;
}

/**
 * Recursively sanitizes arbitrary JSON-like values.
 * @param value - Metadata branch to sanitize.
 * @param redactBodies - Whether source-like text fields should be removed.
 * @returns Sanitized value suitable for JSON serialization.
 */
function sanitizeObject(value: unknown, redactBodies: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item, redactBodies));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key) || (redactBodies && BODY_KEY_PATTERN.test(key))) {
      sanitized[key] = REDACTED;
    } else {
      sanitized[key] = sanitizeObject(nestedValue, redactBodies);
    }
  }

  return sanitized;
}

/**
 * Determines whether source-like fields are safe to emit.
 * @param options - Runtime options supplied to `createLogger`.
 * @returns True when body fields should be replaced by a placeholder.
 */
function shouldRedactBodies(options: LoggerOptions): boolean {
  if (options.includeSensitiveBodies) {
    return false;
  }

  const environment = options.environment?.trim().toLowerCase();
  return !environment || environment === "production" || environment === "prod";
}
